"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { requireAdmin, requireWebsite } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { syncNicheWebsite } from "@/lib/niche-sync";
import { prepareLogo, uploadLogo, removeLogo, LogoUploadError } from "@/lib/storage/logos";
import { assertAllowedWordPressUrl, testConnection } from "@/lib/wordpress/connection";
import { normaliseBaseUrl } from "@/lib/wordpress/client";
import { syncTraffic } from "@/lib/traffic/sync";
import { fieldErrorsFrom, slugify, websiteSettingsSchema } from "@/lib/validation";

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
    auto_select_stories: input.auto_select_stories,
    branding: {
      ...branding,
      tagline: input.brand_tagline,
      primary_color: input.brand_primary_color || null,
    },
    ga4_property_id: input.ga4_property_id,
    search_console_site: input.search_console_site,
    wp_base_url: normaliseBaseUrl(input.wp_base_url),
    wp_username: input.wp_username,
  };
}

/** Admin only: pulls Google Analytics and Search Console now instead of waiting for the daily run. */
export async function syncWebsiteTraffic(websiteId) {
  const user = await requireAdmin();
  await requireWebsite(websiteId);
  try {
    await syncTraffic({ websiteId });
    await recordAudit({
      action: "website.traffic_synced",
      entityType: "website",
      entityId: websiteId,
      websiteId,
      actorId: user.id,
    });
  } catch (error) {
    await createAdminClient()
      .from("websites")
      .update({
        traffic_checked_at: new Date().toISOString(),
        traffic_error: String(error.message ?? error).slice(0, 500),
      })
      .eq("id", websiteId);
    revalidatePath(`/websites/${websiteId}`);
    return { error: String(error.message ?? error) };
  }
  revalidatePath(`/websites/${websiteId}`);
  return { ok: true, message: "Traffic snapshot updated." };
}

/** Stores the encrypted application password. Returns an error message, or null. */
async function saveCredentials(websiteId, appPassword) {
  const { error } = await createAdminClient()
    .from("website_credentials")
    .upsert({ website_id: websiteId, wp_app_password_encrypted: encryptSecret(appPassword) });
  return error?.message ?? null;
}

/** Makes the website's editors exactly `editorIds`. Returns who was added and removed. */
async function replaceEditors(supabase, websiteId, editorIds) {
  const { data: existing } = await supabase.from("website_members").select("user_id").eq("website_id", websiteId);
  const current = new Set((existing ?? []).map((row) => row.user_id));
  const wanted = new Set(editorIds);
  const removed = [...current].filter((id) => !wanted.has(id));
  const added = [...wanted].filter((id) => !current.has(id));
  if (removed.length > 0) {
    await supabase.from("website_members").delete().eq("website_id", websiteId).in("user_id", removed);
  }
  if (added.length > 0) {
    await supabase.from("website_members").insert(added.map((userId) => ({ website_id: websiteId, user_id: userId })));
  }
  return { added, removed };
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
  try {
    logo = await prepareLogo(formData.get("brand_logo"));
  } catch (error) {
    return { error: error.message, fieldErrors: { brand_logo: error.message } };
  }
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
    if (error?.code === "23505")
      return { error: "A website with that slug already exists", fieldErrors: { slug: "Already in use" } };
    return { error: error?.message ?? "Could not create website" };
  }

  const credentialError = await saveCredentials(website.id, input.wp_app_password);
  if (credentialError) {
    await createAdminClient().from("websites").delete().eq("id", website.id);
    return { error: `Could not store credentials: ${credentialError}` };
  }

  let storedLogo;
  if (logo) {
    try {
      storedLogo = await uploadLogo(supabase, website.id, logo);
      const { error: brandingError } = await supabase
        .from("websites")
        .update({ branding: { ...website.branding, ...storedLogo } })
        .eq("id", website.id);
      if (brandingError) throw new LogoUploadError("Could not save the uploaded logo with the website.");
    } catch (error) {
      if (storedLogo) await removeLogo(supabase, website.id, storedLogo.logo_path);
      const { error: rollbackError } = await supabase.from("websites").delete().eq("id", website.id);
      return {
        error: rollbackError
          ? `Website was added, but its logo could not be saved. Open its settings to retry: ${website.id}`
          : error.message,
        fieldErrors: { brand_logo: error.message },
      };
    }
  }

  const editorIds = editorIdsFrom(formData);
  if (editorIds.length > 0) {
    await supabase
      .from("website_members")
      .insert(editorIds.map((userId) => ({ website_id: website.id, user_id: userId })));
  }

  const nicheSyncError = await syncNicheWebsite(supabase, website.id);

  await recordAudit({
    action: "website.created",
    entityType: "website",
    entityId: website.id,
    websiteId: website.id,
    actorId: user.id,
    details: {
      name: website.name,
      domain: website.domain,
      language: website.language,
      editors: editorIds.length,
      logo_uploaded: Boolean(storedLogo),
      auto_select_stories: website.auto_select_stories,
      niche_sync_error: nicheSyncError,
    },
  });

  await testConnection(website);
  redirect(`/websites/${website.id}/settings?created=1${nicheSyncError ? "&niche_sync=failed" : ""}`);
}

export async function updateWebsite(websiteId, _prev, formData) {
  const user = await requireAdmin();
  const parsed = websiteSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };

  const input = parsed.data;
  let logo;
  try {
    logo = await prepareLogo(formData.get("brand_logo"));
  } catch (error) {
    return { error: error.message, fieldErrors: { brand_logo: error.message } };
  }
  const urlProblem = assertAllowedWordPressUrl(input.wp_base_url);
  if (urlProblem) return { error: urlProblem, fieldErrors: { wp_base_url: urlProblem } };

  const { website: previous } = await requireWebsite(websiteId);
  const supabase = await createClient();
  let storedLogo;
  try {
    if (logo) storedLogo = await uploadLogo(supabase, websiteId, logo);
  } catch (error) {
    return { error: error.message, fieldErrors: { brand_logo: error.message } };
  }
  const branding = {
    ...previous.branding,
    ...(storedLogo ?? (input.brand_remove_logo ? { logo_url: null, logo_path: null } : {})),
  };
  const { data: website, error } = await supabase
    .from("websites")
    .update(websiteColumns(input, branding))
    .eq("id", websiteId)
    .eq("updated_at", previous.updated_at)
    .select("*")
    .single();
  if (error || !website) {
    if (storedLogo) await removeLogo(supabase, websiteId, storedLogo.logo_path);
    if (error?.code === "23505")
      return { error: "A website with that slug already exists", fieldErrors: { slug: "Already in use" } };
    return {
      error:
        error?.code === "PGRST116"
          ? "Settings changed while you were saving. Reload and try again."
          : (error?.message ?? "Website not found"),
    };
  }

  let logoCleanupSucceeded = true;
  if (storedLogo || input.brand_remove_logo) {
    logoCleanupSucceeded = await removeLogo(supabase, websiteId, previous.branding?.logo_path);
    await recordAudit({
      action: storedLogo ? "website.logo_uploaded" : "website.logo_removed",
      entityType: "website",
      entityId: websiteId,
      websiteId,
      actorId: user.id,
      details: { old_file_removed: logoCleanupSucceeded },
    });
  }

  const credentialsChanged = Boolean(input.wp_app_password);
  if (credentialsChanged) {
    const credentialError = await saveCredentials(websiteId, input.wp_app_password);
    if (credentialError) return { error: `Could not store credentials: ${credentialError}` };
  }
  const { added: toAdd, removed: toRemove } = await replaceEditors(supabase, websiteId, editorIdsFrom(formData));

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
      auto_select_stories: website.auto_select_stories,
      monthly_ai_budget_usd: website.monthly_ai_budget_usd,
    },
  });

  if (website.niche_id !== previous.niche_id || website.language !== previous.language) {
    const syncError = await syncNicheWebsite(supabase, websiteId);
    if (syncError) return { error: `Settings saved, but niche sources/categories could not be updated: ${syncError}` };
  }
  if (credentialsChanged) await testConnection(website);
  revalidatePath(`/websites/${websiteId}`, "layout");
  return {
    ok: true,
    branding: website.branding,
    message: logoCleanupSucceeded
      ? "Settings saved. If niche categories were added, click Categories → Sync with WordPress."
      : "Settings saved. The previous logo file could not be removed from storage.",
  };
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
  await requireWebsite(websiteId);
  const supabase = await createClient();
  const { error } = await supabase.from("websites").update({ automation_paused: paused }).eq("id", websiteId);
  if (error) return { error: error.message };
  await recordAudit({
    action: paused ? "website.automation_paused" : "website.automation_resumed",
    entityType: "website",
    entityId: websiteId,
    websiteId,
    actorId: user.id,
  });
  revalidatePath(`/websites/${websiteId}`, "layout");
  return { ok: true, message: paused ? "Website automation paused." : "Website automation resumed." };
}

export async function setWebsiteArchived(websiteId, archived) {
  const user = await requireAdmin();
  await requireWebsite(websiteId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("websites")
    .update({
      archived_at: archived ? new Date().toISOString() : null,
      ...(archived ? { automation_paused: true } : {}),
    })
    .eq("id", websiteId);
  if (error) return { error: error.message };
  await recordAudit({
    action: archived ? "website.archived" : "website.restored",
    entityType: "website",
    entityId: websiteId,
    websiteId,
    actorId: user.id,
  });
  revalidatePath("/websites");
  revalidatePath(`/websites/${websiteId}`, "layout");
  return { ok: true, message: archived ? "Website archived." : "Website restored." };
}
