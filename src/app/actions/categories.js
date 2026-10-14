"use server";

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { requireAdmin, requireWebsite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createWordPressClient } from "@/lib/wordpress/client";
import { loadConnection } from "@/lib/wordpress/connection";
import { categorySchema, fieldErrorsFrom, slugify } from "@/lib/validation";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Links unlinked categories to the WordPress category with the same slug, creating it when
 * missing, and imports WordPress categories the dashboard does not have yet.
 * Returns an error message, or null.
 */
async function syncWithWordPress(supabase, website) {
  const connection = await loadConnection(website);
  if (!connection) return "No WordPress credentials are saved for this website.";
  const wordpress = createWordPressClient(connection);
  const { data: local, error } = await supabase
    .from("categories")
    .select("id, name, slug, description, wp_term_id")
    .eq("website_id", website.id);
  if (error) return error.message;
  try {
    const remote = await wordpress.listCategories();
    const bySlug = new Map(remote.map((term) => [term.slug, term]));
    const linked = new Set(local.map((category) => category.wp_term_id).filter(Boolean));
    for (const category of local.filter((row) => !row.wp_term_id)) {
      const term = bySlug.get(category.slug) ?? (await wordpress.createCategory(category));
      const { error: linkError } = await supabase
        .from("categories")
        .update({ wp_term_id: term.id })
        .eq("id", category.id);
      if (linkError) return linkError.message;
      linked.add(term.id);
    }
    // Arabic WordPress slugs are percent-encoded; those categories must be added here with a Latin slug.
    const slugs = new Set(local.map((category) => category.slug));
    const imports = remote.filter(
      (term) => !linked.has(term.id) && !slugs.has(term.slug) && term.slug !== "uncategorized" && SLUG.test(term.slug),
    );
    if (imports.length) {
      const { error: importError } = await supabase.from("categories").insert(
        imports.map((term) => ({
          website_id: website.id,
          name: term.name,
          slug: term.slug,
          wp_term_id: term.id,
        })),
      );
      if (importError) return importError.message;
    }
    return null;
  } catch (wordpressError) {
    return wordpressError instanceof Error ? wordpressError.message : String(wordpressError);
  }
}

export async function addCategory(websiteId, _prev, formData) {
  const user = await requireAdmin();
  const { website } = await requireWebsite(websiteId);
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };
  const slug = parsed.data.slug || slugify(parsed.data.name);
  if (!SLUG.test(slug))
    return {
      error: "Enter a slug in Latin letters",
      fieldErrors: { slug: "Required for names without Latin letters" },
    };

  const supabase = await createClient();
  const { data: category, error } = await supabase
    .from("categories")
    .insert({ website_id: websiteId, name: parsed.data.name, slug, description: parsed.data.description })
    .select("id")
    .single();
  if (error) return { error: error.code === "23505" ? "A category with that slug already exists" : error.message };

  const syncError = await syncWithWordPress(supabase, website);
  await recordAudit({
    action: "category.added",
    entityType: "category",
    entityId: category.id,
    websiteId,
    actorId: user.id,
    details: { name: parsed.data.name, slug, wordpress_error: syncError },
  });
  revalidatePath(`/websites/${websiteId}/settings`);
  return syncError
    ? {
        ok: true,
        message: `Category added, but it is not in WordPress yet: ${syncError} Use “Sync with WordPress” to retry.`,
      }
    : { ok: true, message: "Category added and linked to WordPress." };
}

export async function syncCategories(websiteId, _prev) {
  const user = await requireAdmin();
  const { website } = await requireWebsite(websiteId);
  const syncError = await syncWithWordPress(await createClient(), website);
  await recordAudit({
    action: "category.synced",
    entityType: "website",
    entityId: websiteId,
    websiteId,
    actorId: user.id,
    details: { error: syncError },
  });
  revalidatePath(`/websites/${websiteId}/settings`);
  return syncError
    ? { error: `WordPress sync failed: ${syncError}` }
    : { ok: true, message: "Categories match WordPress." };
}

/** Lets automated articles in this category skip review when the website is in automatic mode. */
export async function setCategoryAutoPublish(websiteId, categoryId, allowed) {
  const user = await requireAdmin();
  const supabase = await createClient();
  await supabase
    .from("categories")
    .update({ auto_publish_allowed: allowed })
    .eq("id", categoryId)
    .eq("website_id", websiteId);
  await recordAudit({
    action: allowed ? "category.auto_publish_on" : "category.auto_publish_off",
    entityType: "category",
    entityId: categoryId,
    websiteId,
    actorId: user.id,
  });
  revalidatePath(`/websites/${websiteId}/settings`);
}

/** Archived categories stay on existing articles but are not offered to editors or the AI. */
export async function setCategoryArchived(websiteId, categoryId, archived) {
  const user = await requireAdmin();
  const supabase = await createClient();
  await supabase
    .from("categories")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", categoryId)
    .eq("website_id", websiteId);
  await recordAudit({
    action: archived ? "category.archived" : "category.restored",
    entityType: "category",
    entityId: categoryId,
    websiteId,
    actorId: user.id,
  });
  revalidatePath(`/websites/${websiteId}/settings`);
}
