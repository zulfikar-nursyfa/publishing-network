import { createSign } from "node:crypto";

/**
 * Read-only Google Analytics 4 and Search Console access with a service account, without a Google
 * SDK: the key signs a JWT that is exchanged for a one-hour access token. Kept free of Next.js
 * and Supabase imports so it can be unit tested with a fake fetch.
 */

const SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
].join(" ");

export class GoogleError extends Error {}

/** @param {{client_email: string, private_key: string}} key The service account's JSON key. */
export async function googleAccessToken(key, fetchImpl = globalThis.fetch) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const claims = {
    iss: key.client_email,
    scope: SCOPES,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode(claims)}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(key.private_key, "base64url");
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.access_token)
    throw new GoogleError(`Google sign-in failed: ${json.error_description ?? json.error ?? response.status}`);
  return json.access_token;
}

async function post(url, token, body, fetchImpl) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const json = await response.json().catch(() => ({}));
  // 403 usually means the service account was not added to the property.
  if (!response.ok) throw new GoogleError(json.error?.message ?? `Google returned HTTP ${response.status}`);
  return json;
}

/** Daily users, sessions and page views from a GA4 property. Dates are YYYY-MM-DD. */
export async function fetchAnalyticsDays(token, propertyId, startDate, endDate, fetchImpl = globalThis.fetch) {
  const report = await post(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    token,
    {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }],
    },
    fetchImpl,
  );
  return (report.rows ?? []).map((row) => {
    const date = row.dimensionValues[0].value;
    const [users, sessions, pageViews] = row.metricValues.map((metric) => Number(metric.value));
    return {
      day: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
      users,
      sessions,
      page_views: pageViews,
    };
  });
}

/** Users and page views per page path from a GA4 property, most viewed first. */
export async function fetchAnalyticsPages(token, propertyId, startDate, endDate, fetchImpl = globalThis.fetch) {
  const report = await post(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    token,
    {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 250,
    },
    fetchImpl,
  );
  return (report.rows ?? []).map((row) => {
    const [users, pageViews] = row.metricValues.map((metric) => Number(metric.value));
    return { path: row.dimensionValues[0].value, users, page_views: pageViews };
  });
}

/**
 * Search Console rows grouped by `dimensions` (e.g. ["date"], ["page"], ["page", "query"]),
 * most clicked first. `keys` holds one value per dimension.
 */
export async function fetchSearchRows(
  token,
  site,
  startDate,
  endDate,
  dimensions,
  rowLimit,
  fetchImpl = globalThis.fetch,
) {
  const result = await post(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    token,
    { startDate, endDate, dimensions, rowLimit },
    fetchImpl,
  );
  return (result.rows ?? []).map((row) => ({
    keys: row.keys,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: Number(row.ctr.toFixed(4)),
    position: Number(row.position.toFixed(2)),
  }));
}

/** Daily clicks, impressions, CTR and average position from a Search Console property. */
export async function fetchSearchDays(token, site, startDate, endDate, fetchImpl = globalThis.fetch) {
  const rows = await fetchSearchRows(token, site, startDate, endDate, ["date"], 1000, fetchImpl);
  return rows.map(({ keys, ...row }) => ({ day: keys[0], ...row }));
}
