import "server-only";
import { generateForJob } from "@/lib/ai/usage";
import {
  checkDraft,
  checkResearch,
  checkVerification,
  draftSchema,
  researchSchema,
  verificationSchema,
} from "../draft-checks";
import { nicheGuideFor, storyTime } from "./context";
import { PermanentJob } from "./errors";
import { sameStory } from "../titles";
import { draftPrompt, researchPrompt, verifyPrompt } from "./prompts";

/** The story, website and evidence every writing prompt is based on. */
export function promptData(context, evidence) {
  return JSON.stringify({
    website: {
      language: context.website.language,
      topic: context.website.topic,
      audience: context.website.audience,
    },
    story: { title: context.story.title, published_at: storyTime(context.story) },
    evidence: evidence.map(({ text, url, title, primary, publisher, published_at }) => ({
      text,
      url,
      title,
      primary,
      publisher,
      published_at,
    })),
  });
}

/** Claims, quotes and the primary source, checked against the collected pages. Returns warnings. */
export async function researchStep(db, job, worker, { state, data, context, model, assertControls }) {
  const research = await generateForJob(db, job, worker, {
    model,
    operation: "research",
    schema: researchSchema,
    assertControls,
    prompt: researchPrompt(data, nicheGuideFor(context.website)),
  });
  // Give the existing second-source search its chance before enforcing corroboration failures.
  const strict = (context.strictChecks ?? []).filter(
    (key) => state.corroboration_searched || !["sensitive_second_source", "single_unofficial_source"].includes(key),
  );
  const checked = checkResearch(research, state.evidence ?? [], strict);
  state.research = checked.research;
  return checked.warnings;
}

/** The article itself, then a duplicate check against this website's automated articles. Returns warnings. */
export async function draftStep(db, job, worker, { state, data, context, model, assertControls }) {
  const generated = await generateForJob(db, job, worker, {
    model,
    operation: "draft",
    schema: draftSchema,
    assertControls,
    prompt: draftPrompt(data, state.research, context.categories, {
      language: context.website.language,
      nicheGuide: nicheGuideFor(context.website),
    }),
  });
  const checked = checkDraft(
    generated,
    state.research,
    state.evidence ?? [],
    context.categories,
    context.website.language,
    context.strictChecks,
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
  return checked.warnings;
}

/** An independent AI fact check of the draft; problems mark it sensitive. Returns warnings. */
export async function verifyStep(db, job, worker, { state, data, context, model, assertControls }) {
  state.verification = await generateForJob(db, job, worker, {
    model,
    operation: "verify",
    schema: verificationSchema,
    assertControls,
    prompt: verifyPrompt(data, state.draft),
  });
  const warnings = checkVerification(state.verification, context.strictChecks);
  state.draft.sensitive ||= state.verification.sensitive || warnings.length > 0;
  state.sources = (state.evidence ?? [])
    .filter((page) => state.draft.source_urls.includes(page.url))
    .map(({ url, title, publisher, primary }) => ({
      url,
      title,
      publisher,
      official: primary || url === state.research.primary_source_url,
    }));
  return warnings;
}
