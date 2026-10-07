/** REST adapter with injected fetch; provider secrets and raw errors never enter job messages. */
export class GeminiError extends Error {
  constructor(message, { retryable = false, uncertain = false } = {}) {
    super(message);
    this.name = "GeminiError";
    this.retryable = retryable;
    this.uncertain = uncertain;
  }
}

// Low thinking keeps each call well inside the cron's 60 s: on Gemini 3 default thinking took 20-35 s
// for research, low about 8 s. Quotes, sources and copying are checked in code, and Inas reviews every draft.
function thinkingConfig(model) {
  if (model.startsWith("gemini-2.5-flash")) return { thinkingConfig: { thinkingBudget: 0 } };
  if (model.startsWith("gemini-3")) return { thinkingConfig: { thinkingLevel: "low" } };
  return {};
}

export function createGeminiClient({ apiKey, fetch: fetchImpl = globalThis.fetch }) {
  const generationRequest = (model, contents, schema, maxOutputTokens = 8192) => ({
    contents,
    generationConfig: {
      candidateCount: 1, maxOutputTokens, temperature: 0.2,
      responseFormat: { text: { mimeType: "APPLICATION_JSON", schema } },
      ...thinkingConfig(model),
    },
  });
  async function call(model, method, body, timeoutMs) {
    if (!apiKey) throw new GeminiError("Set GEMINI_API_KEY before running draft jobs");
    if (!/^gemini-[A-Za-z0-9._-]+$/.test(model)) throw new GeminiError("Choose a supported Gemini model ID");
    let response;
    try {
      response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}`, {
        method: "POST", headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
        body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs), cache: "no-store",
      });
    } catch {
      throw new GeminiError("Gemini request timed out or could not be reached", { retryable: true, uncertain: method === "generateContent" });
    }
    if (!response.ok) throw new GeminiError(`Gemini returned HTTP ${response.status}`, {
      retryable: response.status === 429 || response.status >= 500,
      uncertain: method === "generateContent" && (response.status === 408 || response.status >= 500),
    });
    try { return await response.json(); }
    catch { throw new GeminiError("Gemini returned an unreadable response", { retryable: true, uncertain: method === "generateContent" }); }
  }

  return {
    async countTokens(model, contents, schema) {
      // Include the same schema and steering information as generation in the input estimate.
      const body = schema ? { generateContentRequest: { model: `models/${model}`, ...generationRequest(model, contents, schema) } } : { contents };
      const result = await call(model, "countTokens", body, 5_000);
      if (!Number.isSafeInteger(result.totalTokens) || result.totalTokens < 1) throw new GeminiError("Gemini did not return a valid input token count");
      return result.totalTokens;
    },
    async generate(model, contents, schema, maxOutputTokens = 8192) {
      return call(model, "generateContent", generationRequest(model, contents, schema, maxOutputTokens), 50_000);
    },
    // Grounded search: the useful output is groundingMetadata (pages Google found), not the text.
    async search(model, contents, maxOutputTokens = 2048) {
      return call(model, "generateContent", {
        contents, tools: [{ google_search: {} }],
        generationConfig: { candidateCount: 1, maxOutputTokens, temperature: 0, ...thinkingConfig(model) },
      }, 40_000);
    },
  };
}

/** Pages found by a grounded search (Google redirect links, resolved when fetched) and the query count. */
export function groundingResults(response) {
  const metadata = response.candidates?.[0]?.groundingMetadata ?? {};
  const urls = (metadata.groundingChunks ?? []).map((chunk) => chunk.web?.uri).filter((uri) => typeof uri === "string");
  return { urls: [...new Set(urls)], queries: metadata.webSearchQueries?.length ?? 0 };
}

export function responseUsage(response) {
  const usage = response.usageMetadata;
  if (!usage || !Number.isSafeInteger(usage.promptTokenCount) || !Number.isSafeInteger(usage.candidatesTokenCount)) return null;
  return { input: usage.promptTokenCount, output: usage.candidatesTokenCount + (usage.thoughtsTokenCount ?? 0) };
}

export function responseJson(response) {
  const candidate = response.candidates?.[0];
  if (candidate?.finishReason !== "STOP") throw new GeminiError("Gemini output was blocked or incomplete; review the job before retrying");
  const text = candidate.content?.parts?.filter((part) => !part.thought).map((part) => part.text ?? "").join("");
  try { return JSON.parse(text); }
  catch { throw new GeminiError("Gemini did not return valid JSON"); }
}
