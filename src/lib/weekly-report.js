import { formatUsd } from "@/lib/costs";
import { allRows } from "@/lib/list-query";

const DAY = 86_400_000;
const isoDay = (time) => new Date(time).toISOString().slice(0, 10);

/** Monday (UTC) of the week in ?week=YYYY-MM-DD, or of the last completed week. */
export function weekParam(value, now = new Date()) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? Date.parse(`${value}T00:00:00Z`) : NaN;
  const base = Number.isNaN(parsed) ? now.getTime() - 7 * DAY : parsed;
  const day = new Date(base);
  return isoDay(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() - ((day.getUTCDay() + 6) % 7)));
}

export const shiftWeek = (week, delta) => isoDay(Date.parse(`${week}T00:00:00Z`) + delta * 7 * DAY);

/** "2 Nov – 8 Nov 2026" for the Monday-to-Sunday week. */
export function weekLabel(week) {
  const format = (time, options) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(time);
  const start = Date.parse(`${week}T00:00:00Z`);
  return `${format(start, { day: "numeric", month: "short" })} – ${format(start + 6 * DAY, { dateStyle: "medium" })}`;
}

export const WEEKLY_METRICS = [
  { key: "published", label: "Published" },
  { key: "automated", label: "of which automated" },
  { key: "manual", label: "of which manual" },
  { key: "drafted", label: "AI drafts" },
  { key: "failedJobs", label: "Failed draft jobs" },
  { key: "ai", label: "AI cost (est.)", usd: true },
  { key: "sessions", label: "Sessions" },
  { key: "pageViews", label: "Page views" },
  { key: "searchClicks", label: "Search clicks" },
  { key: "contactClicks", label: "Contact clicks" },
];

const nullable = (value) => (value === null || value === undefined ? null : Number(value));

function metrics(row = {}) {
  const automated = Number(row.published_automated ?? 0);
  const manual = Number(row.published_manual ?? 0);
  return {
    published: automated + manual,
    automated,
    manual,
    drafted: Number(row.drafted ?? 0),
    failedJobs: Number(row.failed_jobs ?? 0),
    ai: Number(row.ai_cost_usd ?? 0),
    sessions: nullable(row.sessions),
    pageViews: nullable(row.page_views),
    searchClicks: nullable(row.search_clicks),
    contactClicks: nullable(row.contact_clicks),
  };
}

function sum(list) {
  return Object.fromEntries(
    WEEKLY_METRICS.map(({ key }) => {
      const values = list.map((item) => item[key]).filter((value) => value !== null);
      return [key, values.length ? values.reduce((total, value) => total + value, 0) : null];
    }),
  );
}

/**
 * One row per active website with the week's numbers, the previous week's and the current queue
 * (in review, failed publications), plus totals. Traffic is null where nothing was synced.
 */
export function buildWeeklyReport({ websites, current, previous, stats }) {
  const byId = (rows) => new Map(rows.map((row) => [row.website_id, row]));
  const [now, before, queue] = [byId(current), byId(previous), byId(stats)];
  const rows = websites
    .filter((site) => !site.archived_at)
    .map((site) => ({
      websiteId: site.id,
      name: site.name,
      week: metrics(now.get(site.id)),
      previous: metrics(before.get(site.id)),
      inReview: Number(queue.get(site.id)?.in_review ?? 0),
      failedPublications: Number(queue.get(site.id)?.failed_publications ?? 0),
    }));
  return {
    rows,
    totals: {
      week: sum(rows.map((row) => row.week)),
      previous: sum(rows.map((row) => row.previous)),
      inReview: rows.reduce((total, row) => total + row.inReview, 0),
      failedPublications: rows.reduce((total, row) => total + row.failedPublications, 0),
    },
  };
}

/** "+25%", "−10%", "new" (from zero) or null when there is nothing to compare. */
export function weekChange(value, before) {
  if (value === null || before === null || value === before) return null;
  if (!before) return "new";
  const percent = Math.round(((value - before) / before) * 100);
  return percent === 0 ? null : `${percent > 0 ? "+" : "−"}${Math.abs(percent)}%`;
}

/** Reads the week (Monday `week`, UTC) and the week before with the caller's client. */
export async function loadWeeklyReport(db, week) {
  const period = (monday) => ({
    period_start: `${monday}T00:00:00Z`,
    period_end: `${shiftWeek(monday, 1)}T00:00:00Z`,
  });
  const [websites, current, previous, stats] = await Promise.all([
    allRows(() => db.from("websites").select("id, name, archived_at").order("name").order("id")),
    allRows(() => db.rpc("website_period_report", period(week)).order("website_id")),
    allRows(() => db.rpc("website_period_report", period(shiftWeek(week, -1))).order("website_id")),
    allRows(() =>
      db.from("website_article_stats").select("website_id, in_review, failed_publications").order("website_id"),
    ),
  ]);
  return buildWeeklyReport({ websites, current, previous, stats });
}

/** Plain-text email of the report, one block per website. */
export function weeklyEmail(report, week, appUrl) {
  const line = (values) =>
    WEEKLY_METRICS.filter(({ key }) => values.week[key] !== null)
      .map(({ key, label, usd: money }) => {
        const change = weekChange(values.week[key], values.previous[key]);
        return `  ${label}: ${money ? formatUsd(values.week[key]) : values.week[key]}${change ? ` (${change})` : ""}`;
      })
      .concat(`  Waiting now: ${values.inReview} in review, ${values.failedPublications} failed publications`)
      .join("\n");
  const blocks = [`All websites\n${line(report.totals)}`, ...report.rows.map((row) => `${row.name}\n${line(row)}`)];
  return {
    subject: `Publishing Network weekly report: ${weekLabel(week)}`,
    text: `Week ${weekLabel(week)} (UTC), compared with the week before.\n\n${blocks.join("\n\n")}\n\nFull report: ${appUrl}/weekly?week=${week}\nWhat is failing or waiting right now: ${appUrl}/status\nSearch Console runs 2–3 days behind, so recent search clicks may still rise. AI costs are estimates.\n\nYou receive this because you are an alert or weekly report recipient in Network settings.`,
  };
}
