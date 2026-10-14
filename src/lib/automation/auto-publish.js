/**
 * Why an automated article must still go to a person. Empty means it may skip review: the site is
 * in automatic mode, its category allows auto-publish, and the draft is not sensitive, is
 * corroborated, passed AI verification and has no reviewer warnings. Everything else is reviewed.
 */
export function reviewReasons({ website, category, state }) {
  const reasons = [];
  if (website.automation_mode !== "automatic") reasons.push("the website is in review mode");
  if (!category?.auto_publish_allowed) reasons.push("its category does not allow auto-publish");
  if (state.draft?.sensitive) reasons.push("it is marked sensitive or consequential");
  if (!state.research?.corroboration?.met) reasons.push("it is not corroborated");
  if (!state.verification?.passed) reasons.push("AI verification did not pass");
  if (state.warnings?.length) reasons.push("it has reviewer warnings");
  return reasons;
}

/**
 * Approves a new automated article when nothing requires review, so the next publishing slot
 * picks it up. Returns true when approved.
 */
export async function approveIfAllowed(db, { job, website, articleId }) {
  const categoryId = job.state.draft?.category_id;
  const { data: category } = categoryId
    ? await db
        .from("categories")
        .select("auto_publish_allowed")
        .eq("id", categoryId)
        .is("archived_at", null)
        .maybeSingle()
    : { data: null };
  if (reviewReasons({ website, category, state: job.state }).length) return false;

  const { data, error } = await db
    .from("articles")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      review_note: "Auto-approved: the category allows auto-publish and every automated check passed.",
    })
    .eq("id", articleId)
    .eq("status", "in_review")
    .select("id")
    .maybeSingle();
  // The article already exists, so a failure here leaves it in review rather than failing the job.
  return !error && Boolean(data);
}
