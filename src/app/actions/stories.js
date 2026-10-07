"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const STATUSES = ["new", "selected", "skipped"];

export async function setStoryStatus(storyId, status) {
  await requireUser();
  if (!STATUSES.includes(status)) return;
  const supabase = await createClient();
  // RLS limits this to stories on the user's websites; "used" stories belong to automation.
  const { data: story } = await supabase.from("story_candidates").update({ status }).eq("id", storyId).neq("status", "used").select("id").maybeSingle();
  // A draft for an unselected story can never finish; cancel it so it stops holding a review-buffer place.
  if (story && status !== "selected") {
    await createAdminClient().from("jobs").update({ status: "cancelled", locked_by: null, locked_until: null, last_error: "Story was unselected" })
      .eq("story_id", storyId).in("status", ["queued", "running"]);
  }
  revalidatePath("/stories");
  revalidatePath("/jobs");
}
