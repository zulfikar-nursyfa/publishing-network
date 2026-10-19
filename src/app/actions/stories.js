"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireWebsite } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { z } from "zod";
import { changeStories } from "@/lib/story-bulk";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const STATUSES = ["new", "selected", "skipped"];

export async function bulkStoryStatus(_prev, formData) {
  const user = await requireUser();
  const result = await changeStories({
    db: await createClient(),
    ids: formData.getAll("story_ids"),
    status: formData.get("status"),
    authorize: requireWebsite,
    audit: ({ websiteId, storyIds, status }) =>
      recordAudit({
        action: `story.bulk_${status}`,
        entityType: "story",
        websiteId,
        actorId: user.id,
        details: { story_ids: storyIds },
      }),
    cancelJobs: (ids) =>
      createAdminClient()
        .from("jobs")
        .update({ status: "cancelled", locked_by: null, locked_until: null, last_error: "Story was skipped" })
        .in("story_id", ids)
        .in("status", ["queued", "running"]),
  });
  revalidatePath("/stories");
  revalidatePath("/jobs");
  return result;
}

export async function setStoryStatus(storyId, status) {
  const user = await requireUser();
  if (!STATUSES.includes(status) || !z.uuid().safeParse(storyId).success) return { error: "Invalid story or status" };
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("story_candidates")
    .select("website_id")
    .eq("id", storyId)
    .maybeSingle();
  if (!current) return { error: "Story unavailable" };
  await requireWebsite(current.website_id);
  // RLS limits this to stories on the user's websites; "used" stories belong to automation.
  const { data: story, error } = await supabase
    .from("story_candidates")
    .update({ status })
    .eq("id", storyId)
    .neq("status", "used")
    .select("id, website_id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!story) return { error: "Story unavailable or already used" };
  // A draft for an unselected story can never finish; cancel it so it stops holding a review-buffer place.
  let cancellationError;
  if (story && status !== "selected") {
    const { error: cancelError } = await createAdminClient()
      .from("jobs")
      .update({ status: "cancelled", locked_by: null, locked_until: null, last_error: "Story was unselected" })
      .eq("story_id", storyId)
      .in("status", ["queued", "running"]);
    cancellationError = cancelError;
  }
  await recordAudit({
    action: `story.${status}`,
    entityType: "story",
    entityId: storyId,
    websiteId: story.website_id,
    actorId: user.id,
  });
  revalidatePath("/stories");
  revalidatePath("/jobs");
  return cancellationError
    ? {
        error:
          "Story updated, but its job could not be cancelled. It cannot finish drafting while unselected; reload and retry.",
      }
    : { ok: true, message: `Story ${status === "new" ? "unselected" : status}.` };
}
