import "server-only";
import { automationBlockReason } from "../policy";
import { storyRows } from "../story-history";
import { autoSelectStories } from "./auto-select";
import { draftsNeededFor } from "./queue-policy";
import { maintainDraftQueue } from "./queue-maintenance";

/** How many more drafts the website needs to keep two days of articles waiting for review. */
async function draftsNeeded(db, website) {
  const [articles, jobs] = await Promise.all([
    db
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("website_id", website.id)
      .eq("origin", "automated")
      .in("status", ["in_review", "approved"]),
    db
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("website_id", website.id)
      .is("article_id", null)
      .in("status", ["queued", "running"]),
  ]);
  if (articles.error || jobs.error) throw new Error("Could not count review buffer");
  return draftsNeededFor(website.daily_quota, articles.count, jobs.count);
}

/** Selected stories of the website that have no draft job yet, newest first. */
async function storiesWithoutJobs(db, website) {
  const existing = await storyRows(() => db.from("jobs").select("story_id").eq("website_id", website.id).order("id"));
  const stories = await storyRows(() =>
    db
      .from("story_candidates")
      .select("id")
      .eq("website_id", website.id)
      .eq("status", "selected")
      .order("source_published_at", { ascending: false, nullsFirst: false })
      .order("id"),
  );

  const queuedStories = new Set(existing.map((job) => job.story_id));
  return stories.filter((story) => !queuedStories.has(story.id));
}

/** Selected stories fill a two-day review buffer; launch drafts can be queued explicitly. `screen` is for tests. */
export async function queueSelectedStories(db, { screen } = {}) {
  const { data: network, error: networkError } = await db.from("network_settings").select("*").single();
  if (networkError) throw new Error(networkError.message);
  const { data: websites, error } = await db.from("websites").select("*").is("archived_at", null).limit(100);
  if (error) throw new Error(error.message);

  await maintainDraftQueue(db, websites, network);

  const spend = websites.some((website) => website.auto_select_stories)
    ? await storyRows(() =>
        db.from("website_ai_spend").select("website_id, estimated_cost_usd, reserved_cost_usd").order("website_id"),
      )
    : [];

  let queued = 0;
  for (const website of websites) {
    if (automationBlockReason(website, network) || website.daily_quota === 0) continue;
    const needed = await draftsNeeded(db, website);
    if (needed <= 0) continue;
    if (website.auto_select_stories && !automationBlockReason(website, network, spend))
      await autoSelectStories(db, website, needed, { network, screen });

    for (const story of (await storiesWithoutJobs(db, website)).slice(0, needed)) {
      const { data: jobId, error: queueError } = await db.rpc("queue_story_draft", {
        target_story: story.id,
        requester: null,
      });
      if (queueError) throw new Error(queueError.message);
      if (jobId) queued++;
    }
  }
  return queued;
}
