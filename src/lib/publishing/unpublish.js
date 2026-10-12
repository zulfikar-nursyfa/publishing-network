/**
 * Takes a published article off its WordPress site. The post becomes a draft rather than being
 * trashed, so it keeps its id and slug: once the article is corrected and approved again,
 * publishArticle() finds the draft by pn_article_id and publishes into it. Safe to repeat.
 *
 * @param {string} articleId
 * @param {string|null} actorId
 * @param {string|null} reason
 * @param {Pick<import("./publish").PublishStore, "loadContext"|"audit"> & {markUnpublished: (input: {articleId: string, reason: string|null}) => Promise<boolean>}} store
 * @param {(connection: import("../wordpress/client").WordPressConnection) => import("../wordpress/client").WordPressClient} wordpressFor
 * @returns {Promise<{outcome: "unpublished", postFound: boolean}|{outcome: "already_unpublished"}|{outcome: "failed", error: string}>}
 */
export async function unpublishArticle(articleId, actorId, reason, store, wordpressFor) {
  const context = await store.loadContext(articleId);
  if (!context) return { outcome: "failed", error: "Article not found" };
  if (context.article.status === "unpublished") return { outcome: "already_unpublished" };
  if (context.article.status !== "published")
    return { outcome: "failed", error: "Only published articles can be unpublished." };
  if (!context.connection) return { outcome: "failed", error: "Website has no WordPress credentials" };

  const audit = (action, details) =>
    store.audit({ websiteId: context.article.websiteId, actorId, action, articleId, details });
  try {
    const wordpress = wordpressFor(context.connection);
    // Null when the post was already deleted or trashed in WordPress: nothing is live any more.
    const post = await wordpress.findPostByArticleId(articleId);
    if (post && post.status !== "draft") {
      const updated = await wordpress.updatePostStatus(post.id, "draft");
      if (updated.status !== "draft") throw new Error(`WordPress reports post ${post.id} as "${updated.status}"`);
    }
    if (!(await store.markUnpublished({ articleId, reason }))) return { outcome: "already_unpublished" };
    await audit("article.unpublished", { wp_post_id: post?.id ?? null, post_found: post !== null, reason });
    return { outcome: "unpublished", postFound: post !== null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await audit("article.unpublish_failed", { error: message });
    return { outcome: "failed", error: message };
  }
}
