import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/automation/cron";
import { tickDraftJobs } from "@/lib/automation/jobs";

export const maxDuration = 60;

export async function GET(request) {
  if (!isCronRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await tickDraftJobs());
}
