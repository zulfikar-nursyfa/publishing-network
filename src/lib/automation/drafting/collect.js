import "server-only";
import { groundingResults } from "@/lib/ai/gemini";
import { generateForJob } from "@/lib/ai/usage";
import { collectEvidence, hostOf, isFetchableUrl, SEARCH_REDIRECT_HOST } from "../evidence";
import { storyTime } from "./context";
import { PermanentJob } from "./errors";
import { corroborationPrompt, searchPrompt } from "./prompts";

const MAX_CANDIDATES = 8;
const MAX_PAGES = 5;
const DAY_MS = 86_400_000;

/** Pages published more days than this before the story are background or a different event. */
export const coverageWindowDays = (website) => website?.niche?.coverage_window_days ?? 3;

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
  // A corroboration pass, or a second search after nothing could be read, looks only at other sites.
  const others = known.length > 0 || Boolean(state.coverage_retried);
  const publishedAt = storyTime(context.story);
  const response = await generateForJob(db, job, worker, {
    model,
    operation: "search",
    search: true,
    assertControls,
    prompt: others
      ? corroborationPrompt(context.story, publishedAt, [...known, ...(state.unreadable_hosts ?? [])])
      : searchPrompt(context.story, publishedAt),
  });
  const found = groundingResults(response).urls;
  state.candidate_urls = [...new Set(others ? found : [...(state.pending_urls ?? []), context.story.url, ...found])]
    .filter(isFetchableUrl)
    .slice(0, MAX_CANDIDATES);
  state.searched = true;
  return state;
}

/** Second collect run: reads the found pages in parallel, skipping unreadable or outdated ones. */
export async function collectStep(job, context, { read = collectEvidence } = {}) {
  const state = structuredClone(job.state);
  const robots = new Map();
  const results = await Promise.allSettled(state.candidate_urls.map((url) => read(url, context.sources, { robots })));
  const days = coverageWindowDays(context.website);
  const listed = storyTime(context.story);
  const oldest = Date.parse(listed) - days * DAY_MS;

  // An old story page means the feed promoted an older article again: stop before spending on another search.
  const storyPage = results[state.candidate_urls.indexOf(context.story.url)]?.value;
  if (storyPage?.published_at && Date.parse(storyPage.published_at) < oldest) {
    throw new PermanentJob(
      `The story page was first published on ${storyPage.published_at.slice(0, 10)}, more than ${days} days ` +
        `before the feed listed it on ${listed.slice(0, 10)}. It is an older article promoted again, so it was not drafted.`,
    );
  }
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
    if (!state.coverage_retried) {
      // One more search, away from the sites that blocked or paywalled us, before a person has to add URLs.
      state.coverage_retried = true;
      state.searched = false;
      state.unreadable_hosts = [...new Set(state.candidate_urls.map(hostOf))].filter(
        (host) => host !== SEARCH_REDIRECT_HOST,
      );
      return state;
    }
    throw new PermanentJob(`${summary}. Add supporting URLs and retry.`);
  }
  // Official pages first; the rest keep search order.
  state.evidence = pages.sort((a, b) => Number(b.primary) - Number(a.primary)).slice(0, MAX_PAGES);
  return state;
}
