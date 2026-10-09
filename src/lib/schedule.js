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

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type).value;
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`,
    second: value("second"),
  };
}

/** The calendar date ("2026-10-02") of an instant in a timezone. */
export function localDate(date, timeZone) {
  return zonedParts(date, timeZone).date;
}

/** "2026-10-02T08:00" for a datetime-local input showing an instant in a timezone. */
export function toLocalInput(date, timeZone) {
  const { date: day, time } = zonedParts(date, timeZone);
  return `${day}T${time}`;
}

/** The instant at which a timezone's wall clock shows the given date and time (DST-safe). */
export function zonedTimeToUtc(day, time, timeZone) {
  const wall = Date.parse(`${day}T${time.slice(0, 5)}:00Z`);
  let instant = wall;
  for (let i = 0; i < 2; i++) {
    const parts = zonedParts(new Date(instant), timeZone);
    instant += wall - Date.parse(`${parts.date}T${parts.time}:${parts.second}Z`);
  }
  return new Date(instant);
}

/** Publishing slots of a website on a local date, as instants. */
export function slotsOn(day, publishTimes, timeZone) {
  return (publishTimes ?? []).map((time) => zonedTimeToUtc(day, time, timeZone));
}

/** The next slot after `now` not in `taken` (ISO strings), searching a week ahead. */
export function nextFreeSlot(now, publishTimes, timeZone, taken = new Set()) {
  for (let offset = 0; offset < 8; offset++) {
    const day = localDate(new Date(now.getTime() + offset * 86_400_000), timeZone);
    const slot = slotsOn(day, publishTimes, timeZone).find((at) => at > now && !taken.has(at.toISOString()));
    if (slot) return slot;
  }
  return null;
}
