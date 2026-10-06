import "server-only";
import { createHash } from "node:crypto";
import { createGeminiClient, GeminiError, responseJson, responseUsage } from "./gemini";
import { serverEnv } from "@/lib/env";
import { responseSchema } from "@/lib/automation/draft-checks";

/** Completed responses are reusable if a worker died before persisting the next job step. */
export async function generateForJob(db, job, worker, model, operation, prompt, schema, assertControls) {
  const contents = [{ role: "user", parts: [{ text: prompt }] }];
  const inputHash = createHash("sha256").update(JSON.stringify({ model, operation, contents, generation: job.state?.generation ?? null, schema: responseSchema(schema) })).digest("hex");
  await assertControls();
  const { data: cached, error: cacheError } = await db.from("ai_usage").select("result")
    .eq("job_id", job.id).eq("operation", operation).eq("input_hash", inputHash).eq("status", "completed")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (cacheError) throw new Error(`Could not read usage records: ${cacheError.message}`);
  if (cached?.result) return schema.parse(responseJson(cached.result));
  const client = createGeminiClient({ apiKey: serverEnv().GEMINI_API_KEY });
  const count = await client.countTokens(model, contents, responseSchema(schema));
  if (count > 32_000) throw new GeminiError("Evidence exceeds the drafting input limit");
  await assertControls();
  const { data, error } = await db.rpc("reserve_ai_call", {
    target_job: job.id, worker, chosen_model: model, operation_name: operation,
    prompt_hash: inputHash, prompt_tokens: count, maximum_output_tokens: 8192,
  });
  if (error) throw new Error(error.message);
  const usage = data?.[0];
  if (!usage) throw new Error("AI budget reservation failed");
  // A lost response remains conservatively reserved; never assume a timeout was free.
  let response;
  try {
    await assertControls();
  } catch (error) {
    const { error: releaseError } = await db.rpc("settle_ai_call", {
      usage_id: usage.id, outcome: "failed", prompt_tokens: 0, generated_tokens: 0, response_data: null, explanation: "Stopped before provider request",
    });
    if (releaseError) throw new Error("Could not release an unused AI reservation");
    throw error;
  }
  try {
    response = await client.generate(model, contents, responseSchema(schema));
  } catch (error) {
    const { error: settleError } = await db.rpc("settle_ai_call", {
      usage_id: usage.id, outcome: error.uncertain ? "uncertain" : "failed", prompt_tokens: 0, generated_tokens: 0,
      response_data: null, explanation: error.message,
    });
    if (settleError) throw new Error("Could not settle AI usage; reservation retained for reconciliation");
    throw error;
  }
  const tokens = responseUsage(response);
  const { error: settleError } = await db.rpc("settle_ai_call", {
    usage_id: usage.id, outcome: tokens ? "completed" : "uncertain", prompt_tokens: tokens?.input ?? 0,
    generated_tokens: tokens?.output ?? 0, response_data: response, explanation: tokens ? null : "Provider usage missing; reservation retained",
  });
  if (settleError) throw new Error("Could not record AI usage; reservation retained for reconciliation");
  if (!tokens) throw new GeminiError("Provider usage was missing; review the reserved estimate before retrying");
  return schema.parse(responseJson(response));
}
