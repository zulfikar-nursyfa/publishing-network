import "server-only";
import { recordAudit } from "@/lib/audit";
import { downloadArticleImage } from "@/lib/storage/article-images";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadConnection } from "@/lib/wordpress/connection";

/**
 * PublishStore backed by Supabase using the secret key. Callers must check permissions first.
 * @returns {import("./publish").PublishStore}
 */
export function createSupabasePublishStore() {
  const db = createAdminClient();

  return {
    async claim(articleId, actorId) {
      const { data, error } = await db.rpc("claim_publication", {
        target_article: articleId,
        requester: actorId,
        lock_seconds: 600,
      });
      if (error) throw new Error(`Could not claim publication: ${error.message}`);
      const row = data?.[0];
      return row ? { id: row.id, attemptCount: row.attempt_count, maxAttempts: row.max_attempts } : null;
    },

    async getPublication(articleId) {
      const { data } = await db
        .from("publications")
        .select("status, attempt_count, max_attempts, wp_post_url")
        .eq("article_id", articleId)
        .maybeSingle();
      if (!data) return null;
      return {
        status: data.status,
        attemptCount: data.attempt_count,
        maxAttempts: data.max_attempts,
        wpPostUrl: data.wp_post_url,
      };
    },

    async loadContext(articleId) {
      const { data: article } = await db.from("articles").select("*").eq("id", articleId).maybeSingle();
      if (!article) return null;
      const [{ data: website }, { data: sources }, { data: category }, { data: image }] = await Promise.all([
        db.from("websites").select("*").eq("id", article.website_id).single(),
        db.from("article_sources").select("url, title, publisher").eq("article_id", articleId).order("accessed_at"),
        article.category_id
          ? db.from("categories").select("name, wp_term_id").eq("id", article.category_id).maybeSingle()
          : Promise.resolve({ data: null }),
        db.from("article_images").select("*").eq("article_id", articleId).eq("role", "featured").maybeSingle(),
      ]);
      if (!website) return null;
      return {
        article: {
          id: article.id,
          websiteId: article.website_id,
          status: article.status,
          title: article.title,
          slug: article.slug,
          excerpt: article.excerpt,
          body: article.body,
        },
        website: { id: website.id, language: website.language, archived: website.archived_at !== null },
        sources: sources ?? [],
        category: category ? { name: category.name, wpTermId: category.wp_term_id } : null,
        image: image
          ? {
              id: image.id,
              storagePath: image.storage_path,
              wpMediaId: image.wp_media_id,
              altText: image.alt_text,
              caption: image.caption,
              credit: image.credit,
              sourceKind: image.source_kind,
            }
          : null,
        connection: await loadConnection(website),
      };
    },

    async markSucceeded({ publicationId, articleId, post }) {
      const now = new Date().toISOString();
      const { error: articleError } = await db
        .from("articles")
        .update({ status: "published", wp_post_id: post.id, wp_post_url: post.link, published_at: now })
        .eq("id", articleId);
      if (articleError) throw new Error(`Post ${post.id} is live but recording it failed: ${articleError.message}`);

      const { error } = await db
        .from("publications")
        .update({
          status: "succeeded",
          wp_post_id: post.id,
          wp_post_url: post.link,
          completed_at: now,
          locked_until: null,
          last_error: null,
        })
        .eq("id", publicationId);
      if (error) throw new Error(`Post ${post.id} is live but recording it failed: ${error.message}`);
    },

    async markFailed({ publicationId, error }) {
      await db
        .from("publications")
        .update({ status: "failed", last_error: error.slice(0, 2000), locked_until: null })
        .eq("id", publicationId);
    },

    async loadImageFile(image) {
      return downloadArticleImage(db, image.storagePath);
    },

    async markImageUploaded(imageId, wpMediaId) {
      const { error } = await db.from("article_images").update({ wp_media_id: wpMediaId }).eq("id", imageId);
      if (error)
        throw new Error(`Image uploaded to WordPress (media ${wpMediaId}) but recording it failed: ${error.message}`);
    },

    async audit({ websiteId, actorId, action, articleId, details }) {
      await recordAudit({ action, entityType: "article", entityId: articleId, websiteId, actorId, details });
    },
  };
}
