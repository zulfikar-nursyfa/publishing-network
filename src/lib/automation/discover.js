import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseFeed, storyFingerprint } from "./feed";

const MAX_AGE_MS = 3 * 86_400_000;
const MAX_ITEMS_PER_SOURCE = 30;
const BATCH_SIZE = 5;

async function fetchFeed(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; PublishingNetworkBot/1.0)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
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
    };
  } catch {
    return null;
  }
}

async function checkSource(db, source) {
  const cutoff = Date.now() - MAX_AGE_MS;
  try {
    const rows = parseFeed(await fetchFeed(source.feed_url))
      .filter((item) => !item.publishedAt || Date.parse(item.publishedAt) >= cutoff)
      .slice(0, MAX_ITEMS_PER_SOURCE)
      .map((item) => toRow(source, item))
      .filter(Boolean);
    const { data, error } = rows.length
      ? await db.from("story_candidates").upsert(rows, { onConflict: "website_id,fingerprint", ignoreDuplicates: true }).select("id")
      : { data: [], error: null };
    if (error) throw new Error(error.message);
    await db.from("content_sources").update({ last_checked_at: new Date().toISOString(), last_error: null }).eq("id", source.id);
    return data.length;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.from("content_sources").update({ last_checked_at: new Date().toISOString(), last_error: message.slice(0, 500) }).eq("id", source.id);
    return null;
  }
}

/** Reads every active source feed of every active website and stores stories not seen before. */
export async function discoverStories() {
  const db = createAdminClient();
  const { data: sources, error } = await db
    .from("content_sources")
    .select("id, website_id, feed_url, websites!inner(archived_at)")
    .eq("active", true)
    .not("feed_url", "is", null)
    .is("websites.archived_at", null);
  if (error) throw new Error(`Could not load sources: ${error.message}`);

  const results = [];
  for (let i = 0; i < sources.length; i += BATCH_SIZE) {
    results.push(...(await Promise.all(sources.slice(i, i + BATCH_SIZE).map((source) => checkSource(db, source)))));
  }
  return {
    sources: sources.length,
    failed: results.filter((count) => count === null).length,
    newStories: results.reduce((sum, count) => sum + (count ?? 0), 0),
  };
}
