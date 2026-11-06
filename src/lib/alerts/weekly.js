import "server-only";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadWeeklyReport, weekParam, weeklyEmail } from "@/lib/weekly-report";
import { emailConfigured, sendEmail } from "./email";

/**
 * Emails last week's report to the alert and weekly-report recipients once. The week is claimed on
 * network_settings before sending so overlapping runs send it once; a failed send releases it.
 */
export async function runWeeklyReport(now = new Date()) {
  const db = createAdminClient();
  const { data: settings, error } = await db
    .from("network_settings")
    .select("alert_emails, weekly_report_emails, weekly_report_sent_for")
    .single();
  if (error) throw new Error(error.message);
  const recipients = [...new Set([...settings.alert_emails, ...settings.weekly_report_emails])];
  if (!recipients.length) return { skipped: "No weekly report recipients" };
  if (!emailConfigured()) return { skipped: "Email is not configured" };

  const week = weekParam(null, now);
  const { data: claimed, error: claimError } = await db
    .from("network_settings")
    .update({ weekly_report_sent_for: week })
    .eq("id", true)
    .or(`weekly_report_sent_for.is.null,weekly_report_sent_for.neq.${week}`)
    .select("id");
  if (claimError) throw new Error(claimError.message);
  if (!claimed.length) return { skipped: `Week ${week} already sent` };

  try {
    const report = await loadWeeklyReport(db, week);
    const appUrl = serverEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    await sendEmail({ to: recipients, ...weeklyEmail(report, week, appUrl) });
  } catch (sendError) {
    await db
      .from("network_settings")
      .update({ weekly_report_sent_for: settings.weekly_report_sent_for })
      .eq("id", true);
    throw sendError;
  }
  return { sent: week };
}
