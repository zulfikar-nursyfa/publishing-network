import "server-only";
import { selectStories, SELECTION_MAX_AGE_MS } from "../selection";
import { storyRows } from "../story-history";

export async function autoSelectStories(db, website, needed) {
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
  const ranked = selectStories({
    candidates,
    sources,
    existing: [
      ...articles,
      ...selected,
      ...jobs.flatMap((job) => [{ ...job.story, id: job.story_id }, ...(job.state?.draft ? [job.state.draft] : [])]),
    ],
    limit: needed - waiting,
  });
  if (!ranked.length) return;
  const { error } = await db.rpc("auto_select_stories", {
    target_website: website.id,
    ranked_stories: ranked.map((story) => story.id),
  });
  if (error) throw new Error(`Could not automatically select stories: ${error.message}`);
}
