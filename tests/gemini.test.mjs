import assert from "node:assert/strict";
import { test } from "node:test";
import { createGeminiClient, groundingResults, responseJson, responseUsage } from "@/lib/ai/gemini";

const ok = (body) => ({ ok: true, status: 200, json: async () => body });

test("search requests use Google Search grounding", async () => {
  let sent;
  const client = createGeminiClient({
    apiKey: "key",
    fetch: async (url, options) => {
      sent = { url, body: JSON.parse(options.body) };
      return ok({});
    },
  });
  await client.search("gemini-2.5-flash", [{ role: "user", parts: [{ text: "Find coverage" }] }]);
  assert.match(sent.url, /gemini-2\.5-flash:generateContent$/);
  assert.deepEqual(sent.body.tools, [{ google_search: {} }]);
});

test("grounded pages and search counts are read from the response", () => {
  const response = {
    candidates: [
      {
        groundingMetadata: {
          webSearchQueries: ["british airways a380", "ba business class"],
          groundingChunks: [
            { web: { uri: "https://a.test/1" } },
            { web: { uri: "https://a.test/1" } },
            { web: { uri: "https://b.test/2" } },
            {},
          ],
        },
      },
    ],
  };
  assert.deepEqual(groundingResults(response), { urls: ["https://a.test/1", "https://b.test/2"], queries: 2 });
  assert.deepEqual(groundingResults({}), { urls: [], queries: 0 });
});

test("token usage includes thinking tokens", () => {
  assert.deepEqual(
    responseUsage({ usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200, thoughtsTokenCount: 30 } }),
    { input: 100, output: 230 },
  );
  assert.equal(responseUsage({}), null);
});

test("JSON is only accepted from a completed response", () => {
  const response = (finishReason, text) => ({ candidates: [{ finishReason, content: { parts: [{ text }] } }] });
  assert.deepEqual(responseJson(response("STOP", '{"a":1}')), { a: 1 });
  assert.throws(() => responseJson(response("MAX_TOKENS", '{"a":1}')), /incomplete/);
  assert.throws(() => responseJson(response("STOP", "not json")), /valid JSON/);
});

test("server errors are retryable and generation failures may have been charged", async () => {
  const client = createGeminiClient({ apiKey: "key", fetch: async () => ({ ok: false, status: 503 }) });
  await assert.rejects(client.generate("gemini-2.5-flash", [], {}), (error) => error.retryable && error.uncertain);
  const missingKey = createGeminiClient({ apiKey: "" });
  await assert.rejects(missingKey.generate("gemini-2.5-flash", [], {}), /GEMINI_API_KEY/);
});
