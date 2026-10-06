"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const STATUSES = ["new", "selected", "skipped"];

export async function setStoryStatus(storyId, status) {
  await requireUser();
  if (!STATUSES.includes(status)) return;
  const supabase = await createClient();
  // RLS limits this to stories on the user's websites; "used" stories belong to automation.
  await supabase.from("story_candidates").update({ status }).eq("id", storyId).neq("status", "used");
  revalidatePath("/stories");
}
