import "server-only";
import { createHash } from "node:crypto";
import { createGeminiClient, GeminiError, responseJson, responseUsage } from "./gemini";
import { serverEnv } from "@/lib/env";
import { responseSchema } from "@/lib/automation/draft-checks";

const MAX_OUTPUT_TOKENS = 1024;

/**
 * One budgeted Gemini call an editor asked for (no draft job), parsed with `schema`. Reserved and
 * settled in ai_usage like job calls, so it counts against the website and network budgets.
 * `db` is the secret-key client; check the editor's access to the website first.
 */
export async function generateForEditor(db, websiteId, { model, operation, prompt, schema }) {
  const contents = [{ role: "user", parts: [{ text: prompt }] }];
  const jsonSchema = responseSchema(schema);
  const client = createGeminiClient({ apiKey: serverEnv().GEMINI_API_KEY });
  const count = await client.countTokens(model, contents, jsonSchema);
  if (count > 32_000) throw new GeminiError("The article is too long to process in one request");
  const { data, error } = await db.rpc("reserve_editor_ai_call", {
    target_website: websiteId,
    chosen_model: model,
    operation_name: operation,
    prompt_hash: createHash("sha256").update(JSON.stringify({ model, operation, contents })).digest("hex"),
    prompt_tokens: count,
    maximum_output_tokens: MAX_OUTPUT_TOKENS,
  });
  if (error) throw new GeminiError(error.message);
  const usage = data?.[0];
  if (!usage) throw new GeminiError("AI budget reservation failed");
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
    if (settleError) console.error(`Could not settle AI usage ${usage.id}: ${settleError.message}`);
  };

  let response;
  try {
    response = await client.generate(model, contents, jsonSchema, MAX_OUTPUT_TOKENS);
  } catch (error) {
    // A lost response stays reserved; never assume a timeout was free.
    await settle(error instanceof GeminiError && error.uncertain ? "uncertain" : "failed", {
      explanation: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
  const tokens = responseUsage(response);
  await settle(tokens ? "completed" : "uncertain", {
    prompt_tokens: tokens?.input ?? 0,
    generated_tokens: tokens?.output ?? 0,
    response_data: response,
    explanation: tokens ? null : "Provider usage missing; reservation retained",
  });
  return schema.parse(responseJson(response));
}
