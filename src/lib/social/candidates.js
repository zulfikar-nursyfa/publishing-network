export const MAX_SOCIAL_ATTEMPTS = 3;
export const POSTS_PER_RUN = 5;

/**
 * Which published articles to post now: those with no post yet, and refused posts with attempts
 * left. "posting", "posted" and "unknown" rows are never picked, so nothing is posted twice.
 * @param {{id: string}[]} articles oldest first
 * @param {{article_id: string, status: string, attempt_count: number}[]} posts
 */
export function pickCandidates(articles, posts) {
  const byArticle = new Map(posts.map((post) => [post.article_id, post]));
  return articles
    .map((article) => ({ article, existing: byArticle.get(article.id) ?? null }))
    .filter(
      ({ existing }) => !existing || (existing.status === "failed" && existing.attempt_count < MAX_SOCIAL_ATTEMPTS),
    )
    .slice(0, POSTS_PER_RUN);
}
