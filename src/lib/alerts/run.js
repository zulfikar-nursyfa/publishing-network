import "server-only";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAlerts } from "./checks";
import { emailConfigured, sendEmail } from "./email";

export function alertEmail(alerts) {
  const appUrl = serverEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const lines = alerts.map((alert) => `- ${alert.message}\n  ${appUrl}${alert.path}`);
  return {
    subject:
      alerts.length === 1
        ? `Publishing Network alert: ${alerts[0].message.slice(0, 80)}`
        : `Publishing Network: ${alerts.length} alerts`,
    text: `${lines.join("\n\n")}\n\nYou receive these because you are an alert recipient in Network settings.`,
  };
}

/**
 * Emails new problems to the network's alert recipients, in one message per run. Keys are
 * claimed before sending so overlapping runs never send the same alert twice; if the email
 * fails, the claims are released and the next run tries again.
 */
export async function runAlerts() {
  const db = createAdminClient();
  const { data: settings, error } = await db.from("network_settings").select("alert_emails").single();
  if (error) throw new Error(error.message);
  if (!settings.alert_emails.length) return { skipped: "No alert recipients" };
  if (!emailConfigured()) return { skipped: "Email is not configured" };

  const found = await findAlerts(db);
  if (!found.length) return { sent: 0 };
  const { data: claimed, error: claimError } = await db
    .from("alerts")
    .upsert(
      found.map(({ path: _path, ...alert }) => alert),
      { onConflict: "key", ignoreDuplicates: true },
    )
    .select("id, key");
  if (claimError) throw new Error(claimError.message);
  if (!claimed.length) return { sent: 0 };

  const claimedKeys = new Set(claimed.map((row) => row.key));
  try {
    await sendEmail({ to: settings.alert_emails, ...alertEmail(found.filter((alert) => claimedKeys.has(alert.key))) });
  } catch (sendError) {
    await db
      .from("alerts")
      .delete()
      .in(
        "id",
        claimed.map((row) => row.id),
      );
    throw sendError;
  }
  return { sent: claimed.length };
}
