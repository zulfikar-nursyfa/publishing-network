import "server-only";
import { z } from "zod";
import { generateForEditor } from "@/lib/ai/editor";
import { nicheGuideFor, textModelFor } from "./context";
import { screenPrompt } from "./prompts";

/** Stories screened per AI call; about 3k tokens of input with the niche guide. */
export const SCREEN_BATCH = 20;

const screenSchema = z.object({
  stories: z
    .array(
      z.object({
        story: z.int().min(1).max(SCREEN_BATCH),
        fits: z.boolean(),
        reason: z
          .string()
          .trim()
          .overwrite((value) => value.slice(0, 300)),
      }),
    )
    .max(SCREEN_BATCH),
});

/**
 * One budgeted AI call judging whether each story fits the website's niche, from its headline and summary.
 * Returns story id → { fits, reason }; a story the AI left out is missing and is screened again next time.
 */
export async function screenStories(db, website, network, stories) {
  const [niche, categories] = await Promise.all([
    website.niche_id
      ? db.from("niches").select("*").eq("id", website.niche_id).single()
      : Promise.resolve({ data: null }),
    db.from("categories").select("name, description").eq("website_id", website.id).is("archived_at", null),
  ]);
  if (niche.error || categories.error) throw new Error("Could not load the niche guide for story screening");
  const output = await generateForEditor(db, website.id, {
    model: textModelFor({ website, network }),
    operation: "screen",
    prompt: screenPrompt(website, nicheGuideFor({ ...website, niche: niche.data }), categories.data, stories),
    schema: screenSchema,
    maxOutputTokens: 2048,
  });
  return new Map(
    output.stories
      .filter(({ story }) => stories[story - 1])
      .map(({ story, fits, reason }) => [stories[story - 1].id, { fits, reason }]),
  );
}
