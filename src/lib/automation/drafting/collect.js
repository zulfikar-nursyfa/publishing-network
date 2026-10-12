import "server-only";
import { groundingResults } from "@/lib/ai/gemini";
import { generateForJob } from "@/lib/ai/usage";
import { collectEvidence, hostOf, isFetchableUrl } from "../evidence";
import { storyTime } from "./context";
import { PermanentJob } from "./errors";
import { corroborationPrompt, searchPrompt } from "./prompts";

const MAX_CANDIDATES = 8;
const MAX_PAGES = 5;
// Pages published well before the story are background or a different event.
const OLDEST_BEFORE_STORY_MS = 3 * 86_400_000;

/** True once research found no official source or second outlet (see corroboration()); asked once per job. */
export function needsCorroboration(state) {
  return state.research?.corroboration?.met === false && !state.corroboration_searched;
}

/** Sends the job back to collect for one search of other outlets; the evidence so far is kept. */
export function startCorroboration(state) {
  state.corroboration_searched = true;
  state.searched = false;
}

/** First collect run: a grounded web search for coverage and the official announcement. */
export async function searchStep(db, job, worker, { context, model, assertControls }) {
  const state = structuredClone(job.state);
  const known = [...new Set((state.evidence ?? []).map((page) => hostOf(page.url)))];
  const publishedAt = storyTime(context.story);
  const response = await generateForJob(db, job, worker, {
    model,
    operation: "search",
    search: true,
    assertControls,
    prompt: known.length
      ? corroborationPrompt(context.story, publishedAt, known)
      : searchPrompt(context.story, publishedAt),
  });
  const found = groundingResults(response).urls;
  state.candidate_urls = [
    ...new Set(known.length ? found : [...(state.pending_urls ?? []), context.story.url, ...found]),
  ]
    .filter(isFetchableUrl)
    .slice(0, MAX_CANDIDATES);
  state.searched = true;
  return state;
}

/** Second collect run: reads the found pages in parallel, skipping unreadable or outdated ones. */
export async function collectStep(job, context) {
  const state = structuredClone(job.state);
  const robots = new Map();
  const results = await Promise.allSettled(
    state.candidate_urls.map((url) => collectEvidence(url, context.sources, { robots })),
  );
  const oldest = Date.parse(storyTime(context.story)) - OLDEST_BEFORE_STORY_MS;
  // On a corroboration pass, only sites not already in the evidence count.
  const known = state.evidence ?? [];
  const knownHosts = new Set(known.map((page) => hostOf(page.url)));
  const pages = [];
  const skipped = [];

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const { message, retryable } = result.reason;
      skipped.push({ url: state.candidate_urls[index], reason: message, retryable });
      return;
    }
    const page = result.value;
    if (pages.some((existing) => existing.url === page.url)) return;
    if (knownHosts.has(hostOf(page.url))) {
      skipped.push({ url: page.url, reason: "Same site as the evidence already collected" });
      return;
    }
    if (page.published_at && Date.parse(page.published_at) < oldest) {
      skipped.push({ url: page.url, reason: `Published ${page.published_at.slice(0, 10)}, before this story` });
      return;
    }
    pages.push(page);
  });

  state.skipped_pages = [...(state.skipped_pages ?? []), ...skipped.map(({ url, reason }) => ({ url, reason }))];
  if (known.length) {
    state.evidence = [...known, ...pages].slice(0, MAX_PAGES + 2);
    return state;
  }
  if (!pages.length) {
    const reasons = skipped
      .map((page) => page.reason)
      .slice(0, 3)
      .join("; ");
    const summary = `No readable coverage found (${reasons})`;
    if (skipped.some((page) => page.retryable)) throw new Error(summary);
    throw new PermanentJob(`${summary}. Add supporting URLs and retry.`);
  }
  // Official pages first; the rest keep search order.
  state.evidence = pages.sort((a, b) => Number(b.primary) - Number(a.primary)).slice(0, MAX_PAGES);
  return state;
}
