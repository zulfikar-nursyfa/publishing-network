import "server-only";
import { selectStories, SELECTION_MAX_AGE_MS } from "../selection";
import { storyRows } from "../story-history";
import { SCREEN_BATCH, screenStories } from "./screen";

/**
 * Off-topic stories among the best-ranked unscreened ones are skipped with the AI's reason; the rest are
 * marked screened. A failed screening call selects nothing new this run rather than unscreened stories.
 */
async function screenTopStories(db, website, network, rank, screen) {
  const unscreened = rank(SCREEN_BATCH).filter((story) => !story.topic_checked_at);
  if (!unscreened.length) return;
  let verdicts;
  try {
    verdicts = await screen(db, website, network, unscreened);
  } catch (error) {
    console.error(`Story screening failed for website ${website.id}: ${error.message}`);
    return;
  }
  const checkedAt = new Date().toISOString();
  for (const story of unscreened) {
    const verdict = verdicts.get(story.id);
    if (!verdict) continue;
    const patch = verdict.fits
      ? { topic_checked_at: checkedAt }
      : {
          topic_checked_at: checkedAt,
          status: "skipped",
          skip_reason: `Outside the website's topic: ${verdict.reason}`.slice(0, 500),
        };
    const { error } = await db
      .from("story_candidates")
      .update(patch)
      .eq("website_id", website.id)
      .eq("id", story.id)
      .eq("status", "new");
    if (error) throw new Error(`Could not record story screening: ${error.message}`);
    Object.assign(story, patch);
  }
}

export async function autoSelectStories(db, website, needed, { network, screen = screenStories } = {}) {
  const [candidates, sources, articles, jobs] = await Promise.all([
    storyRows(() =>
      db
        .from("story_candidates")
        .select("*")
        .eq("website_id", website.id)
        .or(`status.eq.selected,created_at.gte.${new Date(Date.now() - SELECTION_MAX_AGE_MS).toISOString()}`)
        .order("id"),
    ),
    storyRows(() =>
      db.from("content_sources").select("id, url, kind, active").eq("website_id", website.id).order("id"),
    ),
    storyRows(() =>
      db.from("articles").select("id, title, story_fingerprint").eq("website_id", website.id).order("id"),
    ),
    storyRows(() =>
      db
        .from("jobs")
        .select("story_id, state, story:story_candidates(title, fingerprint, title_fingerprint)")
        .eq("website_id", website.id)
        .order("id"),
    ),
  ]);
  const jobIds = new Set(jobs.map((job) => job.story_id));
  const selected = candidates.filter((story) => story.status === "selected");
  const waiting = selected.filter((story) => !jobIds.has(story.id)).length;
  if (waiting >= needed) return;
  const existing = [
    ...articles,
    ...selected,
    ...jobs.flatMap((job) => [{ ...job.story, id: job.story_id }, ...(job.state?.draft ? [job.state.draft] : [])]),
  ];
  const rank = (limit) => selectStories({ candidates, sources, existing, limit });
  await screenTopStories(db, website, network, rank, screen);
  const ranked = rank(needed - waiting).filter((story) => story.topic_checked_at);
  if (!ranked.length) return;
  const { error } = await db.rpc("auto_select_stories", {
    target_website: website.id,
    ranked_stories: ranked.map((story) => story.id),
  });
  if (error) throw new Error(`Could not automatically select stories: ${error.message}`);
}
