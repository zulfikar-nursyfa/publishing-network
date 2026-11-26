import "server-only";
import { generateForJob } from "@/lib/ai/usage";
import {
  checkDraft,
  checkResearch,
  checkVerification,
  CopiedPassageError,
  draftSentences,
  quotedPages,
  ShortDraftError,
  verificationSchema,
} from "../draft-checks";
import { networkRulesFor, nicheGuideFor, storyTime } from "./context";
import { PermanentJob } from "./errors";
import { sameStory } from "../titles";
import { draftPrompt, researchPrompt, verifyPrompt } from "./prompts";
import {
  draftOutputSchema,
  draftWithUrls,
  researchOutputSchema,
  researchWithNumbers,
  researchWithUrls,
} from "./sources";

// About 12k tokens of English and more of Arabic, leaving room in the 32k input limit for the research.
const MAX_EVIDENCE_CHARS = 40_000;

/** Pages cut to share the character limit: short pages stay whole, long ones get an equal share of the rest. */
export function fitEvidence(evidence, limit = MAX_EVIDENCE_CHARS) {
  const lengths = evidence.map((page) => page.text.length).sort((a, b) => a - b);
  let left = limit;
  let share = limit;
  for (const [index, length] of lengths.entries()) {
    share = Math.floor(left / (lengths.length - index));
    if (length > share) break;
    left -= length;
  }
  return evidence.map((page) => (page.text.length > share ? { ...page, text: page.text.slice(0, share) } : page));
}

/** The story, website and evidence every writing prompt is based on. */
export function promptData(context, evidence) {
  return JSON.stringify({
    // Lets the AI tell whether an event in a pre-event report has happened yet.
    today: new Date().toISOString().slice(0, 10),
    website: {
      language: context.website.language,
      topic: context.website.topic,
      audience: context.website.audience,
    },
    story: { title: context.story.title, published_at: storyTime(context.story) },
    // Pages are cited by this number (see ./sources.js).
    evidence: fitEvidence(evidence).map(({ text, title, primary, publisher, published_at }, index) => ({
      source: index + 1,
      text,
      title,
      primary,
      publisher,
      published_at,
    })),
  });
}

/** Claims, quotes and the primary source, checked against the collected pages. Returns warnings. */
export async function researchStep(db, job, worker, { state, data, context, model, assertControls }) {
  const output = await generateForJob(db, job, worker, {
    model,
    operation: "research",
    schema: researchOutputSchema,
    assertControls,
    prompt: researchPrompt(data, nicheGuideFor(context.website), networkRulesFor(context.website)),
  });
  // Give the existing second-source search its chance before enforcing corroboration failures.
  const strict = (context.strictChecks ?? []).filter(
    (key) => state.corroboration_searched || !["sensitive_second_source", "single_unofficial_source"].includes(key),
  );
  const checked = checkResearch(researchWithUrls(output, state.evidence ?? []), state.evidence ?? [], strict);
  state.research = checked.research;
  return checked.warnings;
}

const MAX_REDRAFTS = 2;

/**
 * A copied passage gets up to two fresh drafts on later ticks, each told every phrase copied so far;
 * after that the copy is a reviewer warning. A short draft gets one more try told its length.
 */
export function needsRedraft(state, error) {
  if (error instanceof CopiedPassageError) return (state.copied_phrases?.length ?? 0) < MAX_REDRAFTS;
  return error instanceof ShortDraftError && !state.short_draft_words;
}

/** Records what the next draft must avoid. */
export function noteRedraft(state, error) {
  if (error instanceof ShortDraftError) state.short_draft_words = error.words;
  else state.copied_phrases = [...(state.copied_phrases ?? []), error.phrase];
}

/** The article itself, then a duplicate check against this website's automated articles. Returns warnings. */
export async function draftStep(db, job, worker, { state, data, context, model, assertControls }) {
  const evidence = state.evidence ?? [];
  const generated = await generateForJob(db, job, worker, {
    model,
    operation: "draft",
    schema: draftOutputSchema,
    assertControls,
    prompt: draftPrompt(data, researchWithNumbers(state.research, evidence), context.categories, {
      language: context.website.language,
      nicheGuide: nicheGuideFor(context.website),
      networkRules: networkRulesFor(context.website),
      copiedPhrases: state.copied_phrases,
      shortWords: state.short_draft_words,
    }),
  });
  const checked = checkDraft(
    draftWithUrls(generated, evidence),
    state.research,
    evidence,
    context.categories,
    context.website.language,
    context.strictChecks,
    (state.copied_phrases?.length ?? 0) >= MAX_REDRAFTS,
  );
  state.draft = checked.draft;

  const { data: articles, error } = await db
    .from("articles")
    .select("id, title, story_fingerprint")
    .eq("website_id", job.website_id)
    .eq("origin", "automated")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error("Could not check for duplicate articles");

  const duplicate = articles.some((article) => sameStory(context.story, article) || sameStory(state.draft, article));
  if (duplicate) throw new PermanentJob("This story or headline already has an article");
  delete state.copied_phrases;
  delete state.short_draft_words;
  return checked.warnings;
}

/** An independent AI fact check of the draft; problems mark it sensitive. Returns warnings. */
export async function verifyStep(db, job, worker, { state, data, context, model, assertControls }) {
  const sentences = draftSentences(state.draft);
  state.verification = await generateForJob(db, job, worker, {
    model,
    operation: "verify",
    schema: verificationSchema,
    assertControls,
    prompt: verifyPrompt(data, sentences, nicheGuideFor(context.website), networkRulesFor(context.website)),
  });
  const warnings = checkVerification(state.verification, context.strictChecks, state.evidence ?? [], sentences);
  state.draft.sensitive ||= state.verification.sensitive || warnings.length > 0;
  const cited = new Set([...state.draft.source_urls, ...quotedPages(state.verification, state.evidence ?? [])]);
  state.sources = (state.evidence ?? [])
    .filter((page) => cited.has(page.url))
    .map(({ url, title, publisher, primary }) => ({
      url,
      title,
      publisher,
      official: primary || url === state.research.primary_source_url,
    }));
  return warnings;
}
