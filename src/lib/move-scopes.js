// "Which articles" on the move page; shared by the page (live count) and moveArticles (what moves).

const UNPUBLISHED = ["draft", "in_review", "rejected"];

export const MOVE_SCOPES = {
  all: { label: "All articles", includes: () => true },
  published: { label: "Only published", includes: (article) => article.status === "published" },
  approved: { label: "Only approved", includes: (article) => article.status === "approved" },
  published_approved: {
    label: "Published and approved",
    includes: (article) => ["published", "approved"].includes(article.status),
  },
  other: { label: "Only drafts, in review and rejected", includes: (article) => UNPUBLISHED.includes(article.status) },
  selected: { label: "Only the ticked ones", includes: (article, ticked) => ticked.has(article.id) },
};

export const MOVABLE_STATUSES = ["published", "approved", ...UNPUBLISHED];

/** Published articles are copied; the others move only if they never reached WordPress. */
export function canMove(article) {
  return (article.status === "published") === Boolean(article.wp_post_id);
}
