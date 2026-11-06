import { fetchAnalyticsPages, fetchSearchRows } from "./google";

/** URL or GA4 page path → decoded path with a trailing slash, so all three sources match. */
export function pagePath(value) {
  let path;
  try {
    path = new URL(value, "https://placeholder.invalid").pathname;
  } catch {
    return null;
  }
  try {
    path = decodeURI(path);
  } catch {
    // Keep the encoded form when it is not valid percent-encoding.
  }
  return path.endsWith("/") ? path : `${path}/`;
}

/** Adds Search Console numbers to `target`, keeping position weighted by impressions. */
function addSearch(target, row) {
  const impressions = (target.impressions ?? 0) + row.impressions;
  const clicks = (target.clicks ?? 0) + row.clicks;
  const weighted = (target.position ?? 0) * (target.impressions ?? 0) + row.position * row.impressions;
  target.position = impressions ? Number((weighted / impressions).toFixed(2)) : row.position;
  target.ctr = impressions ? Number((clicks / impressions).toFixed(4)) : 0;
  target.clicks = clicks;
  target.impressions = impressions;
}

/**
 * Top pages (GA4 views + Search Console clicks, merged by path), the site's top search queries
 * (path "") and the top queries per page. URLs that differ only by host, query string or
 * encoding are combined.
 */
export async function fetchTopLists(token, site, startDate, endDate, fetchImpl = globalThis.fetch) {
  const searchSite = site.search_console_site;
  const search = (dimensions, limit) =>
    searchSite ? fetchSearchRows(token, searchSite, startDate, endDate, dimensions, limit, fetchImpl) : [];
  const [analytics, searchPages, siteQueries, pageQueries] = await Promise.all([
    site.ga4_property_id ? fetchAnalyticsPages(token, site.ga4_property_id, startDate, endDate, fetchImpl) : [],
    search(["page"], 250),
    search(["query"], 100),
    search(["page", "query"], 1000),
  ]);

  const pages = new Map();
  const page = (path) => {
    if (!pages.has(path))
      pages.set(path, {
        path,
        users: null,
        page_views: null,
        clicks: null,
        impressions: null,
        ctr: null,
        position: null,
      });
    return pages.get(path);
  };
  for (const row of analytics) {
    const path = pagePath(row.path);
    if (!path) continue;
    const target = page(path);
    target.users = (target.users ?? 0) + row.users;
    target.page_views = (target.page_views ?? 0) + row.page_views;
  }
  for (const row of searchPages) {
    const path = pagePath(row.keys[0]);
    if (path) addSearch(page(path), row);
  }

  const queries = new Map();
  const addQuery = (path, query, row) => {
    const key = `${path}\n${query}`;
    if (!queries.has(key)) queries.set(key, { path, query });
    addSearch(queries.get(key), row);
  };
  for (const row of siteQueries) addQuery("", row.keys[0], row);
  for (const row of pageQueries) {
    const path = pagePath(row.keys[0]);
    if (path) addQuery(path, row.keys[1], row);
  }
  return { pages: [...pages.values()], queries: [...queries.values()] };
}

/**
 * Contact clicks per page and channel over the whole window, and the total per day.
 * shortcut: GA4 returns at most 10,000 day/page/event rows; page through if a site exceeds that.
 */
export function contactTotals(rows) {
  const pages = new Map();
  const days = new Map();
  for (const row of rows) {
    days.set(row.day, (days.get(row.day) ?? 0) + row.clicks);
    const path = pagePath(row.path);
    if (!path) continue;
    const key = `${path}\n${row.channel}`;
    if (!pages.has(key)) pages.set(key, { path, channel: row.channel, clicks: 0 });
    pages.get(key).clicks += row.clicks;
  }
  return { pages: [...pages.values()], days };
}
