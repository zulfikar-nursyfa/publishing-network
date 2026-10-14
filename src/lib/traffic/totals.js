/** First day of the 28-day window (yesterday and the 27 days before), as YYYY-MM-DD. */
export function trafficSince(now = Date.now()) {
  return new Date(now - 28 * 86_400_000).toISOString().slice(0, 10);
}

/** Totals for a set of daily rows; position is averaged by impressions, as Search Console does. */
export function trafficTotals(rows) {
  const sum = (key) => rows.reduce((total, row) => total + (row[key] ?? 0), 0);
  const impressions = sum("impressions");
  const weighted = rows.reduce((total, row) => total + (row.position ?? 0) * (row.impressions ?? 0), 0);
  return {
    sessions: sum("sessions"),
    pageViews: sum("page_views"),
    clicks: sum("clicks"),
    impressions,
    ctr: impressions ? sum("clicks") / impressions : null,
    position: impressions ? weighted / impressions : null,
  };
}
