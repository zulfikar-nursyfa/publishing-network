import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/automation/cron";
import { runScheduler } from "@/lib/automation/scheduler";

export const maxDuration = 300;

export async function GET(request) {
  if (!isCronRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runScheduler());
}
