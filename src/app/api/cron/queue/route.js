import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/automation/cron";
import { queueSelectedStories } from "@/lib/automation/jobs";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

export async function GET(request) {
  if (!isCronRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ queued: await queueSelectedStories(createAdminClient()) });
}
