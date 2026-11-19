import { z } from "zod";

const bulkSchema = z.object({ ids: z.array(z.uuid()).min(1).max(100), status: z.enum(["selected", "skipped"]) });

/** Authorize every website before any mutation; callers supply user-scoped reads and writes. */
export async function changeStories({ db, ids, status, authorize, audit, cancelJobs }) {
  const parsed = bulkSchema.safeParse({ ids: [...new Set(ids)], status });
  if (!parsed.success) return { error: "Choose up to 100 stories and Select or Skip." };
  const { data: stories, error } = await db
    .from("story_candidates")
    .select("id, website_id, status")
    .in("id", parsed.data.ids);
  if (error || stories.length !== parsed.data.ids.length)
    return { error: "Some stories are unavailable. Reload and try again." };
  const websiteIds = [...new Set(stories.map((story) => story.website_id))];
  for (const websiteId of websiteIds) await authorize(websiteId);
  const { data: changed, error: updateError } = await db
    .from("story_candidates")
    .update({ status, skip_reason: status === "skipped" ? "Skipped by an editor" : null })
    .in("id", parsed.data.ids)
    .neq("status", "used")
    .select("id, website_id");
  if (updateError) return { error: updateError.message };
  for (const websiteId of websiteIds) {
    const storyIds = changed.filter((story) => story.website_id === websiteId).map((story) => story.id);
    if (storyIds.length) await audit({ websiteId, storyIds, status });
  }
  if (status === "skipped" && changed.length) {
    const { error: cancelError } = await cancelJobs(changed.map((story) => story.id));
    if (cancelError)
      return {
        error:
          "Stories skipped, but jobs could not be cancelled. Skipped stories cannot finish drafting; reload and retry.",
      };
  }
  return { ok: true, message: `${changed.length} stories ${status}. Used stories were left unchanged.` };
}
