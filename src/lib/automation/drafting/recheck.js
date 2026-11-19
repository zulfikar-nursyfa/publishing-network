import "server-only";
import { generateForJob } from "@/lib/ai/usage";
import {
  checkVerification,
  COPIED_WARNING,
  copiedPassage,
  copiedWarning,
  draftSentences,
  verificationSchema,
} from "../draft-checks";
import { collectEvidence } from "../evidence";
import { TEXT_WARNINGS, textWarnings } from "../text-checks";
import { nicheGuideFor } from "./context";
import { PermanentJob } from "./errors";
import { aiImage, stopsJob } from "./illustrate";
import { bodyText } from "@/lib/publishing/content";
import { verifyPrompt } from "./prompts";
import { promptData } from "./write";

/**
 * Re-check after edits, run on a finished draft job: recollect → reverify → (reillustrate).
 * Each step returns the new state and the next step, or null when the job is finished again.
 */

const MAX_PAGES = 7;
const EDITABLE = ["draft", "in_review", "rejected"];
const REPLACED = [
  "AI verification did not pass",
  "Verification: ",
  "Unsupported claim: ",
  "Not checked by AI verification: ",
  "Re-check ",
  COPIED_WARNING,
  ...TEXT_WARNINGS,
];
const IMAGE_WARNING = /^(AI image not generated|Source image not added): /;
const NO_CATEGORY = "The draft has no category";
// checkResearch's corroboration warnings; two outlets meet the rule even for a sensitive story.
const SINGLE_SOURCE = [
  "Sensitive or consequential story without a second independent source",
  "No official source and only one outlet supports the story",
];

/** Distinct sites among the pages a re-check read. */
export const outletCount = (pages) =>
  new Set(pages.map((page) => new URL(page.url).hostname.replace(/^www\./, ""))).size;

/** Warnings after a re-check: the old verification results give way to the new ones; fixed problems go. */
export function recheckedWarnings(previous, fresh, { hasCategory, hasImage, outlets = 0 }) {
  const kept = (previous ?? []).filter(
    (warning) =>
      !REPLACED.some((prefix) => warning.startsWith(prefix)) &&
      !(hasCategory && warning.startsWith(NO_CATEGORY)) &&
      !(hasImage && IMAGE_WARNING.test(warning)) &&
      !(outlets >= 2 && SINGLE_SOURCE.includes(warning)),
  );
  return [...new Set([...kept, ...fresh])];
}

/** The review note complete_draft_job writes, with the current warnings. */
export function draftReviewNote(warnings) {
  const note = "AI draft. Human review is required; verify facts, dates, names and sources before approval.";
  return (warnings.length ? `${note}\n\nCheck these warnings:\n- ${warnings.join("\n- ")}` : note).slice(0, 4000);
}

async function loadArticle(db, job) {
  const [article, featured] = await Promise.all([
    db
      .from("articles")
      .select("id, website_id, title, excerpt, body, seo_title, meta_description, category_id, status")
      .eq("id", job.article_id)
      .eq("website_id", job.website_id)
      .single(),
    db
      .from("article_images")
      .select("id", { count: "exact", head: true })
      .eq("article_id", job.article_id)
      .eq("role", "featured"),
  ]);
  if (article.error || featured.error) throw new Error("Could not load the article to re-check");
  // Editor bodies are HTML; the verifier and text checks compare words, not markup.
  return { ...article.data, body: bodyText(article.data.body), hasImage: featured.count > 0 };
}

/** Reads the article's current sources, reusing pages the draft already collected. */
async function recollectStep(db, job, worker, { context }) {
  const state = structuredClone(job.state);
  const { data: sources, error } = await db.from("article_sources").select("url").eq("article_id", job.article_id);
  if (error) throw new Error("Could not load the article's sources");
  const collected = new Map((state.evidence ?? []).map((page) => [page.url, page]));
  const urls = sources.map((source) => source.url).slice(0, MAX_PAGES);
  const robots = new Map();
  const results = await Promise.allSettled(
    urls.map((url) => collected.get(url) ?? collectEvidence(url, context.sources, { robots })),
  );
  state.recheck_evidence = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
  state.recheck_skipped = results.flatMap((result, index) =>
    result.status === "rejected" ? [`Re-check could not read ${urls[index]}: ${result.reason.message}`] : [],
  );
  if (!state.recheck_evidence.length)
    throw new PermanentJob("Re-check found no readable source pages; add accessible article pages as sources");
  return { state, next: "reverify" };
}

/** An independent AI fact check of the article as saved now, against its current sources. */
async function reverifyStep(db, job, worker, { context, model, assertControls }) {
  const state = structuredClone(job.state);
  const article = await loadArticle(db, job);
  const sentences = draftSentences(article);
  state.verification = await generateForJob(db, job, worker, {
    model,
    operation: "verify",
    schema: verificationSchema,
    assertControls,
    prompt: verifyPrompt(promptData(context, state.recheck_evidence), sentences, nicheGuideFor(context.website)),
  });
  const copied = copiedPassage(article, state.recheck_evidence);
  state.warnings = recheckedWarnings(
    state.warnings,
    [
      ...(state.recheck_skipped ?? []),
      ...(copied ? [copiedWarning(copied)] : []),
      ...checkVerification(state.verification, [], state.recheck_evidence, sentences),
      ...textWarnings(article, state.recheck_evidence, { language: context.website.language }),
    ],
    {
      hasCategory: Boolean(article.category_id),
      hasImage: article.hasImage,
      outlets: outletCount(state.recheck_evidence),
    },
  );
  delete state.recheck_evidence;
  delete state.recheck_skipped;
  const imageNeeded = context.website.generate_illustrations && !article.hasImage && EDITABLE.includes(article.status);
  return { state, next: imageNeeded ? "reillustrate" : null };
}

/** An AI image for an article that still has none; a failure only leaves a warning. */
async function reillustrateStep(db, job, worker, { assertControls }) {
  const state = structuredClone(job.state);
  const article = await loadArticle(db, job);
  if (article.hasImage || !EDITABLE.includes(article.status)) return { state, next: null };
  let warning;
  try {
    const image = await aiImage(db, job, worker, article, article, assertControls);
    const { error } = await db
      .from("article_images")
      .insert({ ...image, article_id: article.id, website_id: article.website_id, role: "featured" });
    if (error) throw new Error(`Could not save the image: ${error.message}`);
  } catch (error) {
    if (stopsJob(error)) throw error;
    warning = `AI image not generated: ${error.message}`;
  }
  const others = (state.warnings ?? []).filter((existing) => !IMAGE_WARNING.test(existing));
  state.warnings = warning ? [...others, warning] : others;
  return { state, next: null };
}

export const RECHECK_STEPS = { recollect: recollectStep, reverify: reverifyStep, reillustrate: reillustrateStep };

/** Rewrites the automatic review note with the re-checked warnings; a note an editor replaced is kept. */
export async function syncReviewNote(db, job, warnings) {
  const { error } = await db
    .from("articles")
    .update({ review_note: draftReviewNote(warnings) })
    .eq("id", job.article_id)
    .like("review_note", "AI draft. Human review is required%");
  if (error) throw new Error(`Could not update the review note: ${error.message}`);
}
