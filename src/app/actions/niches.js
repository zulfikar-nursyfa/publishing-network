"use server";

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { syncNicheWebsite } from "@/lib/niche-sync";
import { contentSourceSchema, fieldErrorsFrom, nicheGuideSchema, nicheSchema, slugify } from "@/lib/validation";

/** Brings every website in the niche in step with its source group. Returns an error message or null. */
async function syncNicheWebsites(supabase, nicheId) {
  const { data: websites, error } = await supabase.from("websites").select("id").eq("niche_id", nicheId);
  if (error) return error.message;
  for (const website of websites ?? []) {
    const syncError = await syncNicheWebsite(supabase, website.id);
    if (syncError) return syncError;
  }
  revalidatePath("/websites", "layout");
  return null;
}

export async function addNiche(_prev, formData) {
  const user = await requireAdmin();
  const parsed = nicheSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };
  const slug = slugify(parsed.data.name);
  if (!slug) return { error: "Use a name with Latin letters", fieldErrors: { name: "Use Latin letters" } };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("niches")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: niche, error } = await supabase
    .from("niches")
    .insert({ ...parsed.data, slug, sort_order: (last?.sort_order ?? 0) + 1 })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23503") return { error: "Choose a network", fieldErrors: { network_id: "Choose a network" } };
    return { error: error.code === "23505" ? "That niche already exists" : error.message };
  }

  await recordAudit({
    action: "niche.added",
    entityType: "niche",
    entityId: niche.id,
    actorId: user.id,
    details: { name: parsed.data.name, network_id: parsed.data.network_id },
  });
  revalidatePath("/niches");
  return { ok: true, message: "Niche added." };
}

/** The niche's websites follow the new network's rules from their next research, draft or fact-check step. */
export async function moveNicheToNetwork(nicheId, _prev, formData) {
  const user = await requireAdmin();
  const parsed = nicheSchema.pick({ network_id: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Choose a network", fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("niches")
    .update(parsed.data)
    .eq("id", nicheId)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.code === "23503" ? "That network no longer exists" : error.message };
  if (!data) return { error: "Niche not found" };

  await recordAudit({
    action: "niche.network_changed",
    entityType: "niche",
    entityId: nicheId,
    actorId: user.id,
    details: { network_id: parsed.data.network_id },
  });
  revalidatePath("/niches");
  return { ok: true, message: "Network changed." };
}

/** Writing guides are read by the drafting steps, so they apply from the next research or draft step. */
export async function updateNicheGuides(nicheId, _prev, formData) {
  const user = await requireAdmin();
  const parsed = nicheGuideSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("niches")
    .update(parsed.data)
    .eq("id", nicheId)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Niche not found" };

  const syncError = await syncNicheWebsites(supabase, nicheId);

  await recordAudit({
    action: "niche.guides_edited",
    entityType: "niche",
    entityId: nicheId,
    actorId: user.id,
    details: {
      guide_en: Boolean(parsed.data.guide_en),
      guide_ar: Boolean(parsed.data.guide_ar),
      coverage_window_days: parsed.data.coverage_window_days,
      sync_error: syncError,
    },
  });
  revalidatePath("/niches");
  return syncError
    ? { error: `Writing guides saved, but websites could not be synced: ${syncError}` }
    : { ok: true, message: "Writing guides saved." };
}

export async function addNicheSource(nicheId, _prev, formData) {
  const user = await requireAdmin();
  const parsed = contentSourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { data: source, error } = await supabase
    .from("niche_sources")
    .insert({ ...parsed.data, niche_id: nicheId })
    .select("id")
    .single();
  if (error) return { error: error.code === "23505" ? "That source is already in this niche" : error.message };

  const syncError = await syncNicheWebsites(supabase, nicheId);
  await recordAudit({
    action: "niche_source.added",
    entityType: "niche_source",
    entityId: source.id,
    actorId: user.id,
    details: { niche_id: nicheId, name: parsed.data.name, url: parsed.data.url, sync_error: syncError },
  });
  revalidatePath("/niches");
  return syncError
    ? { error: `Source added to the niche, but not to all its websites: ${syncError}` }
    : { ok: true, message: "Source added to the niche and its websites." };
}

export async function updateNicheSource(nicheId, sourceId, _prev, formData) {
  const user = await requireAdmin();
  const parsed = contentSourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("niche_sources")
    .update(parsed.data)
    .eq("id", sourceId)
    .eq("niche_id", nicheId)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.code === "23505" ? "Another source in this niche uses that URL" : error.message };
  if (!data) return { error: "Source not found" };

  const syncError = await syncNicheWebsites(supabase, nicheId);
  await recordAudit({
    action: "niche_source.edited",
    entityType: "niche_source",
    entityId: sourceId,
    actorId: user.id,
    details: { niche_id: nicheId, name: parsed.data.name, url: parsed.data.url, sync_error: syncError },
  });
  revalidatePath("/niches");
  return syncError
    ? { error: `Source saved, but not every website in the niche was updated: ${syncError}` }
    : { ok: true, message: "Source saved for the niche and its websites." };
}

/** Also removes the source from every website in the niche (their copies cascade). */
export async function removeNicheSource(nicheId, sourceId) {
  const user = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("niche_sources").delete().eq("id", sourceId).eq("niche_id", nicheId);
  if (error) return { error: error.message };
  await recordAudit({
    action: "niche_source.removed",
    entityType: "niche_source",
    entityId: sourceId,
    actorId: user.id,
    details: { niche_id: nicheId },
  });
  revalidatePath("/niches");
  revalidatePath("/websites", "layout");
}
