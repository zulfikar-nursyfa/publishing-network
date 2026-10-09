"use server";

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { contentSourceSchema, fieldErrorsFrom } from "@/lib/validation";

export async function addContentSource(websiteId, _prev, formData) {
  const user = await requireAdmin();
  const parsed = contentSourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_sources")
    .insert({ ...parsed.data, website_id: websiteId })
    .select("id")
    .single();
  if (error) return { error: error.code === "23505" ? "That source is already listed" : error.message };

  await recordAudit({
    action: "source.added",
    entityType: "content_source",
    entityId: data.id,
    websiteId,
    actorId: user.id,
    details: { name: parsed.data.name, url: parsed.data.url },
  });
  revalidatePath(`/websites/${websiteId}/settings`);
  return { ok: true, message: "Source added." };
}

/** Edits a website's own source; niche sources are edited on the Niches page. */
export async function updateContentSource(websiteId, sourceId, _prev, formData) {
  const user = await requireAdmin();
  const parsed = contentSourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_sources")
    .update(parsed.data)
    .eq("id", sourceId)
    .eq("website_id", websiteId)
    .is("niche_source_id", null)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.code === "23505" ? "Another source already uses that URL" : error.message };
  if (!data) return { error: "Source not found. Niche sources are edited on the Niches page." };

  await recordAudit({
    action: "source.edited",
    entityType: "content_source",
    entityId: sourceId,
    websiteId,
    actorId: user.id,
    details: { name: parsed.data.name, url: parsed.data.url },
  });
  revalidatePath(`/websites/${websiteId}/settings`);
  return { ok: true, message: "Source saved." };
}

export async function setContentSourceActive(websiteId, sourceId, active) {
  const user = await requireAdmin();
  const supabase = await createClient();
  await supabase.from("content_sources").update({ active }).eq("id", sourceId).eq("website_id", websiteId);
  await recordAudit({
    action: active ? "source.enabled" : "source.disabled",
    entityType: "content_source",
    entityId: sourceId,
    websiteId,
    actorId: user.id,
  });
  revalidatePath(`/websites/${websiteId}/settings`);
}

export async function deleteContentSource(websiteId, sourceId) {
  const user = await requireAdmin();
  const supabase = await createClient();
  // Niche sources are removed from the niche; a site can only disable its copy.
  await supabase
    .from("content_sources")
    .delete()
    .eq("id", sourceId)
    .eq("website_id", websiteId)
    .is("niche_source_id", null);
  await recordAudit({
    action: "source.removed",
    entityType: "content_source",
    entityId: sourceId,
    websiteId,
    actorId: user.id,
  });
  revalidatePath(`/websites/${websiteId}/settings`);
}
