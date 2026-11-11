"use server";

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { requireAdmin, requireWebsite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createWordPressClient } from "@/lib/wordpress/client";
import { loadConnection } from "@/lib/wordpress/connection";
import { CATEGORY_SLUG, syncCategoriesWithWordPress } from "@/lib/wordpress/categories";
import { categorySchema, fieldErrorsFrom, slugify } from "@/lib/validation";

export async function addCategory(websiteId, _prev, formData) {
  const user = await requireAdmin();
  const { website } = await requireWebsite(websiteId);
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };
  const slug = parsed.data.slug || slugify(parsed.data.name);
  if (!CATEGORY_SLUG.test(slug))
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

  const syncError = await syncCategoriesWithWordPress(supabase, website);
  await recordAudit({
    action: "category.added",
    entityType: "category",
    entityId: category.id,
    websiteId,
    actorId: user.id,
    details: { name: parsed.data.name, slug, wordpress_error: syncError },
  });
  revalidatePath(`/websites/${websiteId}/settings`);
  if (!website.wp_base_url)
    return { ok: true, message: "Category added. It is created in WordPress when the site is connected." };
  return syncError
    ? {
        ok: true,
        message: `Category added, but it is not in WordPress yet: ${syncError} Use “Sync with WordPress” to retry.`,
      }
    : { ok: true, message: "Category added and linked to WordPress." };
}

/** Saves name, slug and description, then updates the linked WordPress category to match. */
export async function updateCategory(websiteId, categoryId, _prev, formData) {
  const user = await requireAdmin();
  const { website } = await requireWebsite(websiteId);
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("categories")
    .select("slug, wp_term_id")
    .eq("id", categoryId)
    .eq("website_id", websiteId)
    .maybeSingle();
  if (!current) return { error: "Category not found" };
  // An empty slug keeps the current one, so the category's WordPress URL does not change by accident.
  const values = {
    name: parsed.data.name,
    slug: parsed.data.slug || current.slug,
    description: parsed.data.description,
  };
  const { error } = await supabase.from("categories").update(values).eq("id", categoryId).eq("website_id", websiteId);
  if (error) return { error: error.code === "23505" ? "A category with that slug already exists" : error.message };

  let wordpressError = null;
  if (current.wp_term_id) {
    const connection = await loadConnection(website);
    try {
      if (!connection) throw new Error("No WordPress credentials are saved for this website.");
      await createWordPressClient(connection).updateCategory(current.wp_term_id, values);
    } catch (updateError) {
      wordpressError = updateError instanceof Error ? updateError.message : String(updateError);
    }
  } else {
    wordpressError = await syncCategoriesWithWordPress(supabase, website);
  }
  await recordAudit({
    action: "category.edited",
    entityType: "category",
    entityId: categoryId,
    websiteId,
    actorId: user.id,
    details: { ...values, previous_slug: current.slug, wordpress_error: wordpressError },
  });
  revalidatePath(`/websites/${websiteId}/settings`);
  if (!website.wp_base_url)
    return { ok: true, message: "Category saved. It is created in WordPress when the site is connected." };
  return wordpressError
    ? { ok: true, message: `Saved here, but WordPress was not updated: ${wordpressError}` }
    : { ok: true, message: "Category saved and updated in WordPress." };
}

export async function syncCategories(websiteId, _prev) {
  const user = await requireAdmin();
  const { website } = await requireWebsite(websiteId);
  const syncError = await syncCategoriesWithWordPress(await createClient(), website);
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
  const { error } = await supabase
    .from("categories")
    .update({ auto_publish_allowed: allowed })
    .eq("id", categoryId)
    .eq("website_id", websiteId);
  if (error) return { error: error.message };
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
  const { error } = await supabase
    .from("categories")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", categoryId)
    .eq("website_id", websiteId);
  if (error) return { error: error.message };
  await recordAudit({
    action: archived ? "category.archived" : "category.restored",
    entityType: "category",
    entityId: categoryId,
    websiteId,
    actorId: user.id,
  });
  revalidatePath(`/websites/${websiteId}/settings`);
}
