"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { requireAdmin, requireWebsite } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { prepareLogo, uploadLogo, removeLogo, LogoUploadError } from "@/lib/storage/logos";
import { assertAllowedWordPressUrl, testConnection } from "@/lib/wordpress/connection";
import { normaliseBaseUrl } from "@/lib/wordpress/client";
import { contentSourceSchema, fieldErrorsFrom, slugify, websiteSettingsSchema } from "@/lib/validation";

function websiteColumns(input, branding = {}) {
  return {
    name: input.name,
    slug: input.slug || slugify(input.name),
    niche_id: input.niche_id,
    domain: input.domain,
    language: input.language,
    topic: input.topic,
    audience: input.audience,
    timezone: input.timezone,
    // daily_quota must equal the number of publishing times (websites_publish_times_match_quota).
    publish_times: input.publish_times,
    daily_quota: input.publish_times.length,
    automation_mode: input.automation_mode,
    ai_model: input.ai_model,
    monthly_ai_budget_usd: input.monthly_ai_budget_usd,
    generate_illustrations: input.generate_illustrations,
    branding: {
      ...branding,
      tagline: input.brand_tagline,
      primary_color: input.brand_primary_color || null,
    },
    wp_base_url: normaliseBaseUrl(input.wp_base_url),
    wp_username: input.wp_username,
  };
}

function editorIdsFrom(formData) {
  return formData.getAll("editor_ids").filter((value) => typeof value === "string" && value !== "");
}

export async function createWebsite(_prev, formData) {
  const user = await requireAdmin();
  const parsed = websiteSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };

  const input = parsed.data;
  let logo;
  try { logo = await prepareLogo(formData.get("brand_logo")); }
  catch (error) { return { error: error.message, fieldErrors: { brand_logo: error.message } }; }
  const urlProblem = assertAllowedWordPressUrl(input.wp_base_url);
  if (urlProblem) return { error: urlProblem, fieldErrors: { wp_base_url: urlProblem } };
  if (!input.wp_app_password) {
    return { error: "An application password is required", fieldErrors: { wp_app_password: "Required" } };
  }

  const supabase = await createClient();
  const { data: website, error } = await supabase
    .from("websites")
    .insert({ ...websiteColumns(input), created_by: user.id })
    .select("*")
    .single();
  if (error || !website) {
    if (error?.code === "23505") return { error: "A website with that slug already exists", fieldErrors: { slug: "Already in use" } };
    return { error: error?.message ?? "Could not create website" };
  }

  const admin = createAdminClient();
  const { error: credentialError } = await admin.from("website_credentials").insert({
    website_id: website.id,
    wp_app_password_encrypted: encryptSecret(input.wp_app_password),
  });
  if (credentialError) {
    await admin.from("websites").delete().eq("id", website.id);
    return { error: `Could not store credentials: ${credentialError.message}` };
  }

  let storedLogo;
  if (logo) {
    try {
      storedLogo = await uploadLogo(supabase, website.id, logo);
      const { error: brandingError } = await supabase.from("websites")
        .update({ branding: { ...website.branding, ...storedLogo } }).eq("id", website.id);
      if (brandingError) throw new LogoUploadError("Could not save the uploaded logo with the website.");
    } catch (error) {
      if (storedLogo) await removeLogo(supabase, website.id, storedLogo.logo_path);
      const { error: rollbackError } = await supabase.from("websites").delete().eq("id", website.id);
      return { error: rollbackError ? `Website was added, but its logo could not be saved. Open its settings to retry: ${website.id}` : error.message,
        fieldErrors: { brand_logo: error.message } };
    }
  }

  const editorIds = editorIdsFrom(formData);
  if (editorIds.length > 0) {
    await supabase.from("website_members").insert(editorIds.map((userId) => ({ website_id: website.id, user_id: userId })));
  }

  await supabase.rpc("sync_niche_sources", { target_website: website.id });

  await recordAudit({
    action: "website.created",
    entityType: "website",
    entityId: website.id,
    websiteId: website.id,
    actorId: user.id,
    details: { name: website.name, domain: website.domain, language: website.language, editors: editorIds.length, logo_uploaded: Boolean(storedLogo) },
  });

  await testConnection(website);
  redirect(`/websites/${website.id}/settings?created=1`);
}

export async function updateWebsite(websiteId, _prev, formData) {
  const user = await requireAdmin();
  const parsed = websiteSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };

  const input = parsed.data;
  let logo;
  try { logo = await prepareLogo(formData.get("brand_logo")); }
  catch (error) { return { error: error.message, fieldErrors: { brand_logo: error.message } }; }
  const urlProblem = assertAllowedWordPressUrl(input.wp_base_url);
  if (urlProblem) return { error: urlProblem, fieldErrors: { wp_base_url: urlProblem } };

  const { website: previous } = await requireWebsite(websiteId);
  const supabase = await createClient();
  let storedLogo;
  try { if (logo) storedLogo = await uploadLogo(supabase, websiteId, logo); }
  catch (error) { return { error: error.message, fieldErrors: { brand_logo: error.message } }; }
  const branding = { ...previous.branding, ...(storedLogo ?? (input.brand_remove_logo ? { logo_url: null, logo_path: null } : {})) };
  const { data: website, error } = await supabase
    .from("websites")
    .update(websiteColumns(input, branding))
    .eq("id", websiteId)
    .eq("updated_at", previous.updated_at)
    .select("*")
    .single();
  if (error || !website) {
    if (storedLogo) await removeLogo(supabase, websiteId, storedLogo.logo_path);
    if (error?.code === "23505") return { error: "A website with that slug already exists", fieldErrors: { slug: "Already in use" } };
    return { error: error?.code === "PGRST116" ? "Settings changed while you were saving. Reload and try again." : error?.message ?? "Website not found" };
  }

  let logoCleanupSucceeded = true;
  if (storedLogo || input.brand_remove_logo) {
    logoCleanupSucceeded = await removeLogo(supabase, websiteId, previous.branding?.logo_path);
    await recordAudit({ action: storedLogo ? "website.logo_uploaded" : "website.logo_removed", entityType: "website",
      entityId: websiteId, websiteId, actorId: user.id, details: { old_file_removed: logoCleanupSucceeded } });
  }

  const credentialsChanged = Boolean(input.wp_app_password);
  if (credentialsChanged) {
    const { error: credentialError } = await createAdminClient()
      .from("website_credentials")
      .upsert({ website_id: websiteId, wp_app_password_encrypted: encryptSecret(input.wp_app_password) });
    if (credentialError) return { error: `Could not store credentials: ${credentialError.message}` };
  }

  // Replace editor assignments with the submitted set.
  const editorIds = editorIdsFrom(formData);
  const { data: existing } = await supabase.from("website_members").select("user_id").eq("website_id", websiteId);
  const current = new Set((existing ?? []).map((row) => row.user_id));
  const wanted = new Set(editorIds);
  const toRemove = [...current].filter((id) => !wanted.has(id));
  const toAdd = [...wanted].filter((id) => !current.has(id));
  if (toRemove.length > 0) {
    await supabase.from("website_members").delete().eq("website_id", websiteId).in("user_id", toRemove);
  }
  if (toAdd.length > 0) {
    await supabase.from("website_members").insert(toAdd.map((userId) => ({ website_id: websiteId, user_id: userId })));
  }

  await recordAudit({
    action: "website.updated",
    entityType: "website",
    entityId: websiteId,
    websiteId,
    actorId: user.id,
    details: {
      credentials_changed: credentialsChanged,
      editors_added: toAdd,
      editors_removed: toRemove,
      daily_quota: website.daily_quota,
      publish_times: website.publish_times,
      automation_mode: website.automation_mode,
      monthly_ai_budget_usd: website.monthly_ai_budget_usd,
    },
  });

  if (website.niche_id !== previous.niche_id) {
    const { error: syncError } = await supabase.rpc("sync_niche_sources", { target_website: websiteId });
    if (syncError) return { error: `Settings saved, but the niche sources could not be updated: ${syncError.message}` };
  }
  if (credentialsChanged) await testConnection(website);
  revalidatePath(`/websites/${websiteId}`, "layout");
  return { ok: true, branding: website.branding, message: logoCleanupSucceeded ? "Settings saved." : "Settings saved. The previous logo file could not be removed from storage." };
}

export async function testWebsiteConnection(websiteId, _prev) {
  const { user, website } = await requireWebsite(websiteId);
  const result = await testConnection(website);
  await recordAudit({
    action: "website.connection_tested",
    entityType: "website",
    entityId: websiteId,
    websiteId,
    actorId: user.id,
    details: result.ok ? { ok: true, warnings: result.warnings } : { ok: false, error: result.error },
  });
  revalidatePath(`/websites/${websiteId}`, "layout");
  if (!result.ok) return { error: result.error };
  const summary = `Connected to "${result.status.site_name}" (WordPress ${result.status.wp_version}) as ${result.status.user.login}.`;
  return { ok: true, message: result.warnings.length ? `${summary} Warnings: ${result.warnings.join(" ")}` : summary };
}

export async function setAutomationPaused(websiteId, paused) {
  const user = await requireAdmin();
  const supabase = await createClient();
  await supabase.from("websites").update({ automation_paused: paused }).eq("id", websiteId);
  await recordAudit({
    action: paused ? "website.automation_paused" : "website.automation_resumed",
    entityType: "website",
    entityId: websiteId,
    websiteId,
    actorId: user.id,
  });
  revalidatePath(`/websites/${websiteId}`, "layout");
}

export async function setWebsiteArchived(websiteId, archived) {
  const user = await requireAdmin();
  const supabase = await createClient();
  await supabase
    .from("websites")
    .update({ archived_at: archived ? new Date().toISOString() : null, ...(archived ? { automation_paused: true } : {}) })
    .eq("id", websiteId);
  await recordAudit({
    action: archived ? "website.archived" : "website.restored",
    entityType: "website",
    entityId: websiteId,
    websiteId,
    actorId: user.id,
  });
  revalidatePath("/websites");
  revalidatePath(`/websites/${websiteId}`, "layout");
}

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
  await supabase.from("content_sources").delete().eq("id", sourceId).eq("website_id", websiteId).is("niche_source_id", null);
  await recordAudit({ action: "source.removed", entityType: "content_source", entityId: sourceId, websiteId, actorId: user.id });
  revalidatePath(`/websites/${websiteId}/settings`);
}
