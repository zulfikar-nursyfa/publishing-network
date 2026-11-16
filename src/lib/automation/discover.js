import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseFeed, storyFingerprint } from "./feed";
import { storyRows } from "./story-history";
import { RECENT_STORY_DAYS, sameStory, titleFingerprint } from "./titles";

const MAX_AGE_MS = 3 * 86_400_000;
const MAX_ITEMS_PER_SOURCE = 30;
const BATCH_SIZE = 5;

async function fetchFeed(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; PublishingNetworkBot/1.0)",
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}`);
  return response.text();
}

function toRow(source, item) {
  try {
    return {
      website_id: source.website_id,
      source_id: source.id,
      url: item.url,
      title: item.title,
      summary: item.summary,
      image_url: item.imageUrl,
      source_published_at: item.publishedAt,
      fingerprint: storyFingerprint(item.url),
      title_fingerprint: titleFingerprint(item.title),
      reporting_source_ids: [source.id],
    };
  } catch {
    return null;
  }
}

async function checkSource(db, source, history, fetchImpl) {
  const cutoff = Date.now() - MAX_AGE_MS;
  try {
    const rows = parseFeed(await fetchFeed(source.feed_url, fetchImpl))
      .filter((item) => !item.publishedAt || Date.parse(item.publishedAt) >= cutoff)
      .slice(0, MAX_ITEMS_PER_SOURCE)
      .map((item) => toRow(source, item))
      .filter(Boolean);
    let inserted = 0;
    for (const row of rows) {
      const duplicate = history.find((other) => sameStory(row, other));
      if (duplicate) {
        if (duplicate.reporting_source_ids && !duplicate.reporting_source_ids.includes(source.id)) {
          const reporting = [
            ...new Set([duplicate.source_id, ...duplicate.reporting_source_ids, source.id].filter(Boolean)),
          ];
          const { error } = await db
            .from("story_candidates")
            .update({ reporting_source_ids: reporting })
            .eq("website_id", source.website_id)
            .eq("id", duplicate.id);
          if (error) throw new Error(error.message);
          duplicate.reporting_source_ids = reporting;
        }
        continue;
      }
      const { data, error } = await db
        .from("story_candidates")
        .upsert(row, { onConflict: "website_id,fingerprint", ignoreDuplicates: true })
        .select("id");
      if (error) throw new Error(error.message);
      if (data.length) {
        history.push({ ...row, id: data[0].id });
        inserted++;
      }
    }
    await db
      .from("content_sources")
      .update({ last_checked_at: new Date().toISOString(), last_error: null })
      .eq("id", source.id);
    return inserted;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .from("content_sources")
      .update({ last_checked_at: new Date().toISOString(), last_error: message.slice(0, 500) })
      .eq("id", source.id);
    return null;
  }
}

/** Reads every active source feed of every active, unpaused website and stores stories not seen before. */
export async function discoverStories({ db = createAdminClient(), fetchImpl = fetch } = {}) {
  const { data: network, error: networkError } = await db.from("network_settings").select("automation_paused").single();
  if (networkError) throw new Error(`Could not load network settings: ${networkError.message}`);
  if (network.automation_paused) return { sources: 0, failed: 0, newStories: 0, paused: true };
  const { data: activeSources, error } = await db
    .from("content_sources")
    .select("id, website_id, feed_url, websites!inner(archived_at, automation_paused)")
    .eq("active", true)
    .not("feed_url", "is", null)
    .is("websites.archived_at", null);
  if (error) throw new Error(`Could not load sources: ${error.message}`);
  const sources = activeSources.filter((source) => !source.websites.automation_paused);

  const results = [];
  const websiteIds = [...new Set(sources.map((source) => source.website_id))];
  const since = new Date(Date.now() - RECENT_STORY_DAYS * 86_400_000).toISOString();
  const checkWebsite = async (websiteId) => {
    const [stories, articles] = await Promise.all([
      storyRows(() =>
        db
          .from("story_candidates")
          .select("id, source_id, title, fingerprint, title_fingerprint, reporting_source_ids")
          .eq("website_id", websiteId)
          .gte("created_at", since)
          .order("id"),
      ),
      storyRows(() =>
        db
          .from("articles")
          .select("title, story_fingerprint")
          .eq("website_id", websiteId)
          .eq("origin", "automated")
          .gte("created_at", since)
          .order("id"),
      ),
    ]);
    const history = [...stories, ...articles];
    // Sources for a website share one history and run in order, including matches in this run.
    for (const source of sources.filter((source) => source.website_id === websiteId))
      results.push(await checkSource(db, source, history, fetchImpl));
  };
  for (let i = 0; i < websiteIds.length; i += BATCH_SIZE) {
    await Promise.all(websiteIds.slice(i, i + BATCH_SIZE).map(checkWebsite));
  }
  return {
    sources: sources.length,
    failed: results.filter((count) => count === null).length,
    newStories: results.reduce((sum, count) => sum + (count ?? 0), 0),
  };
}
