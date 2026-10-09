import "server-only";
import { createHash } from "node:crypto";
import {
  createGeminiClient,
  GeminiError,
  groundingResults,
  responseImage,
  responseJson,
  responseUsage,
  withoutImageData,
} from "./gemini";
import { serverEnv } from "@/lib/env";
import { responseSchema } from "@/lib/automation/draft-checks";

const MAX_SEARCHES = 5;

/**
 * One budgeted Gemini call for a job. With `search`, returns the raw grounded response; with
 * `image`, the image bytes; otherwise the parsed JSON for `schema`. Completed text responses are
 * reused if a worker died before persisting the next job step (image bytes are not kept).
 */
export async function generateForJob(
  db,
  job,
  worker,
  { model, operation, prompt, schema, search = false, image = false, assertControls },
) {
  const contents = [{ role: "user", parts: [{ text: prompt }] }];
  const jsonSchema = schema ? responseSchema(schema) : null;
  // An image is billed as output tokens (about 1,300 at 1K resolution).
  const outputTokens = search ? 2048 : image ? 4096 : 8192;
  const parse = (response) =>
    search ? response : image ? responseImage(response) : schema.parse(responseJson(response));
  const inputHash = createHash("sha256")
    .update(
      JSON.stringify({ model, operation, contents, generation: job.state?.generation ?? null, schema: jsonSchema }),
    )
    .digest("hex");
  await assertControls();
  const { data: cached, error: cacheError } = await db
    .from("ai_usage")
    .select("result")
    .eq("job_id", job.id)
    .eq("operation", operation)
    .eq("input_hash", inputHash)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cacheError) throw new Error(`Could not read usage records: ${cacheError.message}`);
  if (cached?.result && !image) return parse(cached.result);
  const client = createGeminiClient({ apiKey: serverEnv().GEMINI_API_KEY });
  const count = await client.countTokens(model, contents, jsonSchema);
  if (count > 32_000) throw new GeminiError("Evidence exceeds the drafting input limit");
  await assertControls();
  const { data, error } = await db.rpc("reserve_ai_call", {
    target_job: job.id,
    worker,
    chosen_model: model,
    operation_name: operation,
    prompt_hash: inputHash,
    prompt_tokens: count,
    maximum_output_tokens: outputTokens,
    maximum_searches: search ? MAX_SEARCHES : 0,
  });
  if (error) throw new Error(error.message);
  const usage = data?.[0];
  if (!usage) throw new Error("AI budget reservation failed");
  const settle = async (outcome, fields) => {
    const { error: settleError } = await db.rpc("settle_ai_call", {
      usage_id: usage.id,
      outcome,
      prompt_tokens: 0,
      generated_tokens: 0,
      response_data: null,
      explanation: null,
      searches: 0,
      ...fields,
    });
    if (settleError) throw new Error("Could not record AI usage; reservation retained for reconciliation");
  };
  try {
    await assertControls();
  } catch (error) {
    await settle("failed", { explanation: "Stopped before provider request" });
    throw error;
  }
  // A lost response remains conservatively reserved; never assume a timeout was free.
  let response;
  try {
    response = search
      ? await client.search(model, contents, outputTokens)
      : image
        ? await client.image(model, contents)
        : await client.generate(model, contents, jsonSchema);
  } catch (error) {
    await settle(error.uncertain ? "uncertain" : "failed", { explanation: error.message });
    throw error;
  }
  const tokens = responseUsage(response);
  // Billed per search query on newer models and per grounded prompt on 2.5, so this is an upper estimate.
  const searches = search ? Math.min(MAX_SEARCHES, groundingResults(response).queries) : 0;
  await settle(tokens ? "completed" : "uncertain", {
    prompt_tokens: tokens?.input ?? 0,
    generated_tokens: tokens?.output ?? 0,
    response_data: image ? withoutImageData(response) : response,
    searches,
    explanation: tokens ? null : "Provider usage missing; reservation retained",
  });
  if (!tokens) throw new GeminiError("Provider usage was missing; review the reserved estimate before retrying");
  return parse(response);
}
