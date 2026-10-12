import { imageCredit, toWordPressContent } from "@/lib/publishing/content";
import { WordPressError } from "@/lib/wordpress/client";

/**
 * @typedef {{id: string, attemptCount: number, maxAttempts: number}} ClaimedPublication
 * @typedef {{status: "pending"|"in_progress"|"succeeded"|"failed", attemptCount: number, maxAttempts: number, wpPostUrl: string|null}} PublicationSnapshot
 * @typedef {Object} PublishContext
 * @property {{id: string, websiteId: string, status: string, title: string, slug: string|null, excerpt: string|null, body: string}} article
 * @property {{id: string, language: "en"|"ar", archived: boolean}} website
 * @property {import("./content").ArticleSourceRef[]} sources
 * @property {{name: string, wpTermId: number|null}|null} category
 * @property {FeaturedImage|null} image
 * @property {import("../wordpress/client").WordPressConnection|null} connection
 *
 * @typedef {{id: string, storagePath: string|null, wpMediaId: number|null, altText: string|null, caption: string|null, credit: string|null, sourceKind: string}} FeaturedImage
 *
 * @typedef {Object} PublishStore
 * @property {(articleId: string, actorId: string|null) => Promise<ClaimedPublication|null>} claim
 * @property {(articleId: string) => Promise<PublicationSnapshot|null>} getPublication
 * @property {(articleId: string) => Promise<PublishContext|null>} loadContext
 * @property {(input: {publicationId: string, articleId: string, post: import("../wordpress/client").WordPressPost}) => Promise<void>} markSucceeded
 * @property {(input: {publicationId: string, error: string}) => Promise<void>} markFailed
 * @property {(image: FeaturedImage) => Promise<{bytes: Buffer, contentType: string, filename: string}>} loadImageFile
 * @property {(imageId: string, wpMediaId: number) => Promise<void>} markImageUploaded
 * @property {(entry: {websiteId: string, actorId: string|null, action: string, articleId: string, details: Record<string, unknown>}) => Promise<void>} audit
 *
 * @typedef {{outcome: "published", post: import("../wordpress/client").WordPressPost, reconciled: boolean}|{outcome: "already_published", url: string|null}|{outcome: "in_progress"}|{outcome: "attempts_exhausted", attempts: number}|{outcome: "blocked", reason: string}|{outcome: "failed", error: string, retryable: boolean}} PublishResult
 */

/**
 * Publishes one approved article to its website's WordPress site.
 *
 * Safe to call repeatedly for the same article (double clicks, retries, overlapping workers):
 *  1. A database lock (claim_publication) ensures only one attempt runs at a time.
 *  2. Controls are re-checked after the lock is taken, immediately before publishing.
 *  3. WordPress is searched for a post already tagged with this article's ID before a new post
 *     is created, so an attempt that died after WordPress saved the post cannot duplicate it.
 *  4. The post is read back from WordPress to confirm it is live before it is recorded.
 *
 * @param {string} articleId
 * @param {string|null} actorId
 * @param {PublishStore} store
 * @param {(connection: import("../wordpress/client").WordPressConnection) => import("../wordpress/client").WordPressClient} wordpressFor
 * @param {{beforeWrite?: () => Promise<string|null>|string|null}} [options] Latest automatic-slot controls, invoked immediately before a WordPress write.
 * @returns {Promise<PublishResult>}
 */

export async function publishArticle(articleId, actorId, store, wordpressFor, options = {}) {
  const claim = await store.claim(articleId, actorId);
  if (!claim) {
    const existing = await store.getPublication(articleId);
    if (existing?.status === "succeeded") {
      return { outcome: "already_published", url: existing.wpPostUrl };
    }
    if (existing && existing.attemptCount >= existing.maxAttempts) {
      return { outcome: "attempts_exhausted", attempts: existing.attemptCount };
    }
    if (existing?.status === "in_progress") return { outcome: "in_progress" };
    return { outcome: "blocked", reason: "Article not found" };
  }

  const context = await store.loadContext(articleId);
  const fail = async (error, retryable) => {
    await store.markFailed({ publicationId: claim.id, error });
    if (context) {
      await store.audit({
        websiteId: context.article.websiteId,
        actorId,
        action: "article.publish_failed",
        articleId,
        details: { error, retryable, attempt: claim.attemptCount },
      });
    }
    return { outcome: "failed", error, retryable };
  };

  if (!context) return fail("Article not found", false);
  const blockReason = checkControls(context);
  if (blockReason) return fail(blockReason, false);

  const wordpress = wordpressFor(context.connection);
  try {
    let post = await wordpress.findPostByArticleId(articleId);
    const reconciled = post !== null;

    if (!post && context.article.status === "published")
      return fail("Published article has no matching WordPress post; review it manually", false);
    if (post?.status === "trash") {
      return fail(
        `WordPress post ${post.id} for this article is in the trash. Restore or permanently delete it in WordPress, then retry.`,
        false,
      );
    }
    if (post?.status !== "publish" && post?.status !== "future") {
      // A new post, or a draft left by unpublishing: either way WordPress gets the approved content.
      const reason = await options.beforeWrite?.();
      if (reason) return fail(reason, false);
      const fields = {
        articleId,
        title: context.article.title,
        content: toWordPressContent(context.article.body, context.sources, context.website.language, context.image),
        excerpt: context.article.excerpt,
        slug: context.article.slug,
        status: "publish",
        categoryIds: context.category ? [context.category.wpTermId] : [],
        featuredMediaId: context.image ? await uploadFeaturedImage(context, store, wordpress) : null,
      };
      post = post ? await wordpress.updatePost(post.id, fields) : await wordpress.createPost(fields);
    }

    const confirmed = await wordpress.getPost(post.id);
    if (confirmed.status !== "publish" && confirmed.status !== "future") {
      return fail(`WordPress reports post ${confirmed.id} as "${confirmed.status}" instead of published`, true);
    }

    await store.markSucceeded({ publicationId: claim.id, articleId, post: confirmed });
    await store.audit({
      websiteId: context.article.websiteId,
      actorId,
      action: "article.published",
      articleId,
      details: { wp_post_id: confirmed.id, url: confirmed.link, reconciled, attempt: claim.attemptCount },
    });
    return { outcome: "published", post: confirmed, reconciled };
  } catch (error) {
    if (error instanceof WordPressError) return fail(error.message, error.retryable);
    return fail(error instanceof Error ? error.message : String(error), true);
  }
}

/** The media id is saved once uploaded, so a retry reuses it instead of uploading a duplicate. */
async function uploadFeaturedImage(context, store, wordpress) {
  const { image, website } = context;
  if (image.wpMediaId) return image.wpMediaId;
  const file = await store.loadImageFile(image);
  const caption = [image.caption, imageCredit(image, website.language)].filter(Boolean).join(" — ");
  const id = await wordpress.uploadMedia({ ...file, altText: image.altText, caption });
  await store.markImageUploaded(image.id, id);
  return id;
}

function checkControls(context) {
  if (!["approved", "published"].includes(context.article.status)) {
    return `Article must be approved before publishing (current status: ${context.article.status})`;
  }
  if (context.website.archived) return "Website is archived";
  if (!context.connection) return "Website has no WordPress credentials";
  if (!context.article.title.trim()) return "Article has no title";
  if (!context.article.body.trim()) return "Article has no body";
  if (context.category && !context.category.wpTermId) {
    return `Category "${context.category.name}" is not linked to WordPress. Use "Sync with WordPress" in the website settings, then retry.`;
  }
  if (context.image && !context.image.wpMediaId && !context.image.storagePath)
    return "Featured image has no stored file";
  return null;
}
