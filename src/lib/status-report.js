import { allRows } from "@/lib/list-query";

export const STATUS_COLUMNS = [
  { key: "draft", label: "Draft" },
  { key: "in_review", label: "In review" },
  { key: "approved", label: "Approved, not published" },
  { key: "published", label: "Published" },
  { key: "publishedAutomated", label: "of which automated" },
  { key: "publishedManual", label: "of which manual" },
  { key: "unpublished", label: "Unpublished" },
  { key: "rejected", label: "Rejected" },
  { key: "jobsActive", label: "Draft jobs queued or running" },
  { key: "jobsWaiting", label: "Draft jobs waiting" },
  { key: "jobsFailed", label: "Failed draft jobs" },
  { key: "publicationsFailed", label: "Failed publications" },
];

export const ISSUE_COLUMNS = [
  { key: "type", label: "Type" },
  { key: "website", label: "Website" },
  { key: "item", label: "Item" },
  { key: "since", label: "Since (UTC)" },
  { key: "detail", label: "Detail" },
  { key: "link", label: "Link" },
];

/** Problems first, then work that is waiting on someone. */
export const ISSUE_TYPES = [
  "Failed publication",
  "Failed draft job",
  "Source feed error",
  "Traffic sync error",
  "Waiting draft job",
  "Waiting for review",
  "Approved, not published",
];

/** Turns the long rows of website_status_counts() into one count per column. */
function tally(counts) {
  const row = Object.fromEntries(STATUS_COLUMNS.map(({ key }) => [key, 0]));
  for (const { kind, origin, status, total } of counts) {
    const value = Number(total);
    if (kind === "article") {
      if (status in row) row[status] += value;
      if (status === "published") row[origin === "automated" ? "publishedAutomated" : "publishedManual"] += value;
    } else if (kind === "job") {
      row[status === "failed" ? "jobsFailed" : status === "waiting" ? "jobsWaiting" : "jobsActive"] += value;
    } else if (kind === "publication") row.publicationsFailed += value;
  }
  return row;
}

/**
 * Current counts per active website plus totals, and one line per open problem or waiting item,
 * oldest first within each type. Archived websites are left out of both.
 */
export function buildStatusReport({ websites, counts, articles, jobs, sources }) {
  const active = websites.filter((site) => !site.archived_at);
  const names = new Map(active.map((site) => [site.id, site.name]));
  const rows = active.map((site) => ({
    websiteId: site.id,
    name: site.name,
    ...tally(counts.filter((count) => count.website_id === site.id)),
  }));
  const totals = Object.fromEntries(
    STATUS_COLUMNS.map(({ key }) => [key, rows.reduce((total, row) => total + row[key], 0)]),
  );

  const issue = (type, websiteId, item, since, detail, path) =>
    names.has(websiteId)
      ? [{ type, websiteId, website: names.get(websiteId), item, since: since ?? null, detail: detail ?? null, path }]
      : [];
  const failedPublication = (article) => article.publication_status === "failed";
  const issues = [
    ...articles
      .filter(failedPublication)
      .flatMap((a) =>
        issue("Failed publication", a.website_id, a.title, a.updated_at, a.publication_error, `/articles/${a.id}`),
      ),
    ...jobs
      .filter((job) => job.status === "failed")
      .flatMap((j) =>
        issue("Failed draft job", j.website_id, j.story_title, j.updated_at, j.last_error, `/jobs/${j.id}`),
      ),
    ...sources.flatMap((s) =>
      issue(
        "Source feed error",
        s.website_id,
        s.name,
        s.last_checked_at,
        s.last_error,
        `/sources?errors=errors&website=${s.website_id}`,
      ),
    ),
    ...active
      .filter((site) => site.traffic_error)
      .flatMap((site) =>
        issue(
          "Traffic sync error",
          site.id,
          site.name,
          null,
          site.traffic_error,
          `/websites/${site.id}?section=traffic`,
        ),
      ),
    ...jobs
      .filter((job) => job.status === "queued" && job.waiting_kind)
      .flatMap((j) =>
        issue("Waiting draft job", j.website_id, j.story_title, j.waiting_since, j.waiting_reason, `/jobs/${j.id}`),
      ),
    ...articles
      .filter((article) => article.status === "in_review")
      .flatMap((a) => issue("Waiting for review", a.website_id, a.title, a.updated_at, null, `/articles/${a.id}`)),
    ...articles
      .filter((article) => article.status === "approved" && !failedPublication(article))
      .flatMap((a) =>
        issue(
          "Approved, not published",
          a.website_id,
          a.title,
          a.updated_at,
          a.scheduled_for ? `Scheduled for ${a.scheduled_for}` : null,
          `/articles/${a.id}`,
        ),
      ),
  ];
  const rank = (item) => ISSUE_TYPES.indexOf(item.type);
  issues.sort((a, b) => rank(a) - rank(b) || String(a.since ?? "").localeCompare(String(b.since ?? "")));
  return { rows, totals, issues };
}

/** Reads the current status with the caller's client, so editors only see their websites. */
export async function loadStatusReport(db) {
  const [websites, counts, articles, jobs, sources] = await Promise.all([
    allRows(() => db.from("websites").select("id, name, archived_at, traffic_error").order("name").order("id")),
    allRows(() => db.rpc("website_status_counts").order("website_id").order("kind").order("origin").order("status")),
    allRows(() =>
      db
        .from("article_list")
        .select("id, website_id, title, status, scheduled_for, updated_at, publication_status, publication_error")
        .or("status.in.(in_review,approved),publication_status.eq.failed")
        .order("id"),
    ),
    allRows(() =>
      db
        .from("job_list")
        .select(
          "id, website_id, story_title, status, last_error, updated_at, waiting_kind, waiting_reason, waiting_since",
        )
        .or("status.eq.failed,and(status.eq.queued,waiting_kind.not.is.null)")
        .order("id"),
    ),
    allRows(() =>
      db
        .from("content_sources")
        .select("id, website_id, name, last_error, last_checked_at")
        .not("last_error", "is", null)
        .order("id"),
    ),
  ]);
  return buildStatusReport({ websites, counts, articles, jobs, sources });
}
