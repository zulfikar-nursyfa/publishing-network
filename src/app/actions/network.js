"use server";

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, sendEmail } from "@/lib/alerts/email";
import {
  alertEmailsSchema,
  alertMutingSchema,
  fieldErrorsFrom,
  modelPriceSchema,
  networkSettingsSchema,
  strictDraftChecksSchema,
} from "@/lib/validation";

export async function updateStrictDraftChecks(_prev, formData) {
  const user = await requireAdmin();
  const parsed = strictDraftChecksSchema.safeParse({ strict_draft_checks: formData.getAll("strict_draft_checks") });
  if (!parsed.success) return { error: "Choose known draft checks", fieldErrors: fieldErrorsFrom(parsed.error) };
  const db = await createClient();
  const { error } = await db
    .from("network_settings")
    .update({ ...parsed.data, updated_by: user.id })
    .eq("id", true);
  if (error) return { error: error.message };
  await recordAudit({
    action: "network.strict_draft_checks_updated",
    entityType: "network",
    actorId: user.id,
    details: parsed.data,
  });
  revalidatePath("/network");
  return { ok: true, message: "Draft checks saved. They apply from the next draft job step." };
}

/** Network kill switch: stops automation on every website. Manual and scheduled publishing continue. */
export async function setNetworkPaused(paused) {
  const user = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("network_settings")
    .update({ automation_paused: paused, updated_by: user.id })
    .eq("id", true);
  if (error) return { error: error.message };
  await recordAudit({
    action: paused ? "network.automation_paused" : "network.automation_resumed",
    entityType: "network",
    actorId: user.id,
  });
  revalidatePath("/", "layout");
  return { ok: true, message: paused ? "Network automation paused." : "Network automation resumed." };
}

export async function updateNetworkSettings(_prev, formData) {
  const user = await requireAdmin();
  const parsed = networkSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };
  const db = await createClient();
  const { error } = await db
    .from("network_settings")
    .update({ ...parsed.data, updated_by: user.id })
    .eq("id", true);
  if (error) return { error: error.message };
  await recordAudit({
    action: "network.settings_updated",
    entityType: "network",
    actorId: user.id,
    details: parsed.data,
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Network settings saved." };
}

export async function updateAlertEmails(_prev, formData) {
  const user = await requireAdmin();
  const parsed = alertEmailsSchema.safeParse({ alert_emails: formData.get("alert_emails") });
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Check the recipients",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  const db = await createClient();
  const { error } = await db
    .from("network_settings")
    .update({ ...parsed.data, updated_by: user.id })
    .eq("id", true);
  if (error) return { error: error.message };
  await recordAudit({
    action: "network.alert_emails_updated",
    entityType: "network",
    actorId: user.id,
    details: { recipients: parsed.data.alert_emails.length },
  });
  revalidatePath("/network");
  return { ok: true, message: "Alert recipients saved.", emails: parsed.data.alert_emails };
}

export async function sendTestAlert() {
  const user = await requireAdmin();
  const db = await createClient();
  const { data, error } = await db.from("network_settings").select("alert_emails").single();
  if (error) return { error: error.message };
  if (!data.alert_emails.length) return { error: "Save at least one alert recipient first." };
  if (!emailConfigured())
    return { error: "Email is not configured: set RESEND_API_KEY and ALERT_EMAIL_FROM in Vercel." };
  try {
    await sendEmail({
      to: data.alert_emails,
      subject: "Publishing Network: test alert",
      text: "This is a test. Alerts for spending limits, missed publishing slots, publishing failures and failed AI drafts will arrive at this address.",
    });
  } catch (sendError) {
    return { error: sendError.message };
  }
  await recordAudit({ action: "network.test_alert_sent", entityType: "network", actorId: user.id });
  return { ok: true, message: `Test email sent to ${data.alert_emails.join(", ")}.` };
}

export async function updateAlertMuting(_prev, formData) {
  const user = await requireAdmin();
  const parsed = alertMutingSchema.safeParse({ muted_website_ids: formData.getAll("muted_website_ids") });
  if (!parsed.success) return { error: "Choose valid websites", fieldErrors: fieldErrorsFrom(parsed.error) };
  const db = createAdminClient();
  const { error } = await db.rpc("set_website_alert_muting", parsed.data);
  if (error) return { error: error.message };
  await recordAudit({
    action: "network.alert_muting_updated",
    entityType: "network",
    actorId: user.id,
    details: { ...parsed.data, count: parsed.data.muted_website_ids.length },
  });
  revalidatePath("/network");
  return { ok: true, message: "Website alert settings saved.", mutedIds: parsed.data.muted_website_ids };
}

export async function saveModelPrice(_prev, formData) {
  const user = await requireAdmin();
  const parsed = modelPriceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };
  const db = await createClient();
  const { error } = await db.from("ai_model_prices").upsert({ ...parsed.data, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  await recordAudit({
    action: "network.model_price_updated",
    entityType: "network",
    actorId: user.id,
    details: parsed.data,
  });
  revalidatePath("/network");
  return { ok: true, message: "Estimated model prices saved." };
}
