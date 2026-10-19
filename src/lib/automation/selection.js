import { sameStory } from "./titles";

export const SELECTION_MAX_AGE_MS = 48 * 60 * 60 * 1000;
export const MAX_STORIES_PER_SOURCE = 2;
export const OFFICIAL_SOURCE_SCORE = 40;
export const RECENCY_SCORE = 30;
export const ADDITIONAL_SOURCE_SCORE = 15;
export const MAX_REPORTING_BONUS_SOURCES = 3;

const timeOf = (story) => Date.parse(story.source_published_at ?? story.created_at);
const hostOf = (source) => {
  try {
    return new URL(source.url).hostname.replace(/^www\./, "");
  } catch {
    return source.id;
  }
};

export function scoreStory(story, stories, sources, now) {
  const byId = new Map(sources.filter((source) => source.active).map((source) => [source.id, source]));
  const source = byId.get(story.source_id);
  const reports = new Set();
  let official = ["newsroom", "government"].includes(source?.kind);
  for (const other of stories.filter((other) => sameStory(story, other))) {
    for (const id of [other.source_id, ...(other.reporting_source_ids ?? [])]) {
      if (byId.has(id)) {
        const reportingSource = byId.get(id);
        reports.add(hostOf(reportingSource));
        official ||= ["newsroom", "government"].includes(reportingSource.kind);
      }
    }
  }
  return (
    (official ? OFFICIAL_SOURCE_SCORE : 0) +
    RECENCY_SCORE * Math.max(0, 1 - (now - timeOf(story)) / SELECTION_MAX_AGE_MS) +
    Math.min(MAX_REPORTING_BONUS_SOURCES, Math.max(0, reports.size - 1)) * ADDITIONAL_SOURCE_SCORE
  );
}

/** All inputs belong to one website. Existing covers articles, job stories, and selected stories. */
export function selectStories({ candidates, existing, sources, limit, now = Date.now() }) {
  const active = new Map(sources.filter((source) => source.active).map((source) => [source.id, source]));
  const recent = candidates.filter(
    (story) => active.has(story.source_id) && timeOf(story) >= now - SELECTION_MAX_AGE_MS && timeOf(story) <= now,
  );
  const ranked = recent
    .filter((story) => story.status === "new" && !story.selected_automatically)
    .map((story) => ({ story, score: scoreStory(story, recent, sources, now) }))
    .sort((a, b) => b.score - a.score || timeOf(b.story) - timeOf(a.story) || a.story.id.localeCompare(b.story.id));
  const selected = [];
  const counts = new Map();
  for (const { story } of ranked) {
    if (selected.length >= limit) break;
    const source = hostOf(active.get(story.source_id));
    if (
      (counts.get(source) ?? 0) >= MAX_STORIES_PER_SOURCE ||
      [...existing, ...selected].some((other) => other.id === story.id || sameStory(story, other))
    )
      continue;
    selected.push(story);
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  return selected;
}
