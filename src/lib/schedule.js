// Publishing schedule helpers shared by server code and the website form (no server-only imports).

/** Matches websites_daily_quota_check in 11_website_publishing.sql. */
export const MAX_DAILY_ARTICLES = 12;

/** Default schedule for new websites: 08:00, 14:00 and 20:00 in the website's timezone. */
export const DEFAULT_PUBLISH_TIMES = ["08:00", "14:00", "20:00"];

/** Default timezone for new websites; matches the column default. */
export const DEFAULT_TIMEZONE = "Africa/Cairo";

/** Formats a time[] column value ("08:00:00") as "08:00, 14:00". */
export function formatPublishTimes(times) {
  return (times ?? []).map((time) => time.slice(0, 5)).join(", ");
}
