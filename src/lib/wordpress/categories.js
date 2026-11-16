import "server-only";
import { createWordPressClient } from "@/lib/wordpress/client";
import { loadConnection } from "@/lib/wordpress/connection";

export const CATEGORY_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** After a language switch renamed niche categories here, gives their WordPress terms the same names. */
export async function pushNicheCategoryNames(supabase, website) {
  if (!website.wp_base_url) return null;
  const connection = await loadConnection(website);
  if (!connection) return "No WordPress credentials are saved for this website.";
  const wordpress = createWordPressClient(connection);
  const { data: local, error } = await supabase
    .from("categories")
    .select("name, slug, description, wp_term_id")
    .eq("website_id", website.id)
    .not("niche_category_id", "is", null)
    .not("wp_term_id", "is", null);
  if (error) return error.message;
  try {
    for (const { wp_term_id, ...category } of local) await wordpress.updateCategory(wp_term_id, category);
    return null;
  } catch (wordpressError) {
    return wordpressError instanceof Error ? wordpressError.message : String(wordpressError);
  }
}

/**
 * Links unlinked categories to the WordPress category with the same slug, creating it when
 * missing, and imports WordPress categories the dashboard does not have yet.
 * Returns an error message, or null. Callers must have checked admin access to the website.
 */
export async function syncCategoriesWithWordPress(supabase, website) {
  if (!website.wp_base_url) return "WordPress is not connected yet.";
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
      (term) =>
        !linked.has(term.id) && !slugs.has(term.slug) && term.slug !== "uncategorized" && CATEGORY_SLUG.test(term.slug),
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
