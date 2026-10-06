"use server";

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFrom, modelPriceSchema, networkSettingsSchema } from "@/lib/validation";

/** Network kill switch: stops automation on every website. Manual and scheduled publishing continue. */
export async function setNetworkPaused(paused) {
  const user = await requireAdmin();
  const supabase = await createClient();
  await supabase.from("network_settings").update({ automation_paused: paused, updated_by: user.id }).eq("id", true);
  await recordAudit({
    action: paused ? "network.automation_paused" : "network.automation_resumed",
    entityType: "network",
    actorId: user.id,
  });
  revalidatePath("/", "layout");
}

export async function updateNetworkSettings(_prev, formData) {
  const user = await requireAdmin();
  const parsed = networkSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };
  const db = await createClient();
  const { error } = await db.from("network_settings").update({ ...parsed.data, updated_by: user.id }).eq("id", true);
  if (error) return { error: error.message };
  await recordAudit({ action: "network.settings_updated", entityType: "network", actorId: user.id, details: parsed.data });
  revalidatePath("/", "layout");
  return { ok: true, message: "Network settings saved." };
}

export async function saveModelPrice(_prev, formData) {
  const user = await requireAdmin();
  const parsed = modelPriceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };
  const db = await createClient();
  const { error } = await db.from("ai_model_prices").upsert({ ...parsed.data, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  await recordAudit({ action: "network.model_price_updated", entityType: "network", actorId: user.id, details: parsed.data });
  revalidatePath("/network");
  return { ok: true, message: "Estimated model prices saved." };
}
