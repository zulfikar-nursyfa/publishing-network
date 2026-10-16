import "server-only";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAnalyticsDays, fetchSearchDays, googleAccessToken } from "./google";
import { fetchTopLists, pagePath } from "./top";

const DAYS = 28;

/** The key as pasted into Vercel: the raw JSON file, or the same JSON base64-encoded. */
function serviceAccountKey() {
  const raw = serverEnv().GOOGLE_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) return null;
  return JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
}

const isoDay = (date) => date.toISOString().slice(0, 10);

/** Every published article's path → id, read in pages because a site can have thousands. */
async function articlesByPath(db, websiteId) {
  const result = new Map();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("articles")
      .select("id, wp_post_url")
      .eq("website_id", websiteId)
      .not("wp_post_url", "is", null)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const article of data) result.set(pagePath(article.wp_post_url), article.id);
    if (data.length < 1000) return result;
  }
}

/** Replaces the website's 28-day top pages and search queries. */
async function saveTopLists(db, websiteId, { pages, queries }) {
  const articleIds = await articlesByPath(db, websiteId);
  const updatedAt = new Date().toISOString();
  const tables = [
    ["website_traffic_pages", pages.map((row) => ({ ...row, article_id: articleIds.get(row.path) ?? null }))],
    ["website_search_queries", queries],
  ];
  for (const [table, rows] of tables) {
    const { error: clearError } = await db.from(table).delete().eq("website_id", websiteId);
    if (clearError) throw new Error(clearError.message);
    if (!rows.length) continue;
    const { error } = await db
      .from(table)
      .insert(rows.map((row) => ({ ...row, website_id: websiteId, updated_at: updatedAt })));
    if (error) throw new Error(error.message);
  }
}

/**
 * Pulls the last 28 days from Google Analytics and Search Console for every website that has
 * them configured (or just `websiteId`) and stores one row per day. Search Console data lags by
 * 2-3 days, so recent days fill in on later runs. Top pages and queries for the same window are
 * replaced each run. One website's error does not stop the others.
 */
export async function syncTraffic({ websiteId = null } = {}) {
  const key = serviceAccountKey();
  if (!key) return { skipped: "GOOGLE_SERVICE_ACCOUNT_KEY is not set" };
  const db = createAdminClient();
  let query = db
    .from("websites")
    .select("id, ga4_property_id, search_console_site")
    .is("archived_at", null)
    .or("ga4_property_id.not.is.null,search_console_site.not.is.null");
  if (websiteId) query = query.eq("id", websiteId);
  const { data: websites, error } = await query;
  if (error) throw new Error(error.message);
  if (!websites.length) return { synced: 0 };

  const token = await googleAccessToken(key);
  const end = new Date(Date.now() - 86_400_000);
  const start = new Date(end.getTime() - (DAYS - 1) * 86_400_000);
  const results = [];
  for (const site of websites) {
    let failure = null;
    try {
      const [analytics, search] = await Promise.all([
        site.ga4_property_id ? fetchAnalyticsDays(token, site.ga4_property_id, isoDay(start), isoDay(end)) : [],
        site.search_console_site ? fetchSearchDays(token, site.search_console_site, isoDay(start), isoDay(end)) : [],
      ]);
      const days = new Map();
      for (const row of [...analytics, ...search]) days.set(row.day, { ...days.get(row.day), ...row });
      const rows = [...days.values()].map((row) => ({
        website_id: site.id,
        users: null,
        sessions: null,
        page_views: null,
        clicks: null,
        impressions: null,
        ctr: null,
        position: null,
        ...row,
        updated_at: new Date().toISOString(),
      }));
      if (rows.length) {
        const { error: saveError } = await db
          .from("website_traffic_daily")
          .upsert(rows, { onConflict: "website_id,day" });
        if (saveError) throw new Error(saveError.message);
      }
      await saveTopLists(db, site.id, await fetchTopLists(token, site, isoDay(start), isoDay(end)));
    } catch (syncError) {
      failure = (syncError instanceof Error ? syncError.message : String(syncError)).slice(0, 500);
    }
    await db
      .from("websites")
      .update({ traffic_checked_at: new Date().toISOString(), traffic_error: failure })
      .eq("id", site.id);
    results.push({ websiteId: site.id, error: failure });
  }
  return { synced: results.filter((result) => !result.error).length, results };
}
