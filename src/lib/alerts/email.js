import "server-only";
import { serverEnv } from "@/lib/env";

export function emailConfigured() {
  const env = serverEnv();
  return Boolean(env.RESEND_API_KEY && env.ALERT_EMAIL_FROM);
}

/** Sends one plain-text email through the Resend API. Throws when it is not accepted. */
export async function sendEmail({ to, subject, text }) {
  const env = serverEnv();
  if (!emailConfigured()) throw new Error("Email is not configured (RESEND_API_KEY and ALERT_EMAIL_FROM)");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.ALERT_EMAIL_FROM, to, subject, text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new Error(`Email was not sent (${response.status}): ${(await response.text()).slice(0, 300)}`);
}
