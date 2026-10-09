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
import { storyTime } from "./context";
import { PermanentJob } from "./errors";
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
export async function researchStep(db, job, worker, { state, data, model, assertControls }) {
  const research = await generateForJob(db, job, worker, {
    model,
    operation: "research",
    schema: researchSchema,
    assertControls,
    prompt: researchPrompt(data),
  });
  const checked = checkResearch(research, state.evidence ?? []);
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
    prompt: draftPrompt(data, state.research, context.categories),
  });
  const checked = checkDraft(
    generated,
    state.research,
    state.evidence ?? [],
    context.categories,
    context.website.language,
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

  const key = (title) => title.toLowerCase().replace(/\s+/g, " ").trim();
  const duplicate = articles.some(
    (article) =>
      article.story_fingerprint === context.story.fingerprint || key(article.title) === key(state.draft.title),
  );
  if (duplicate) throw new PermanentJob("This story or headline already has an article");
  return checked.warnings;
}

/** An independent AI fact check of the draft; problems mark it sensitive. Returns warnings. */
export async function verifyStep(db, job, worker, { state, data, model, assertControls }) {
  state.verification = await generateForJob(db, job, worker, {
    model,
    operation: "verify",
    schema: verificationSchema,
    assertControls,
    prompt: verifyPrompt(data, state.draft),
  });
  const warnings = checkVerification(state.verification);
  state.draft.sensitive ||= state.verification.sensitive || warnings.length > 0;
  state.sources = (state.evidence ?? [])
    .filter((page) => state.draft.source_urls.includes(page.url))
    .map(({ url, title, publisher }) => ({ url, title, publisher }));
  return warnings;
}
