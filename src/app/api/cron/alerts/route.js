import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/automation/cron";
import { runAlerts } from "@/lib/alerts/run";

export async function GET(request) {
  if (!isCronRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runAlerts());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
