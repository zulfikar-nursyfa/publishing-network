import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStatusReport } from "@/lib/status-report";
import { weeklyReportEmailsSchema } from "@/lib/validation";

const websites = [
  { id: "a", name: "Alpha", archived_at: null, traffic_error: "Permission denied" },
  { id: "b", name: "Beta", archived_at: null, traffic_error: null },
  { id: "c", name: "Old", archived_at: "2026-01-01", traffic_error: "Gone" },
];

test("counts split publishing by origin and group draft jobs, per active website", () => {
  const { rows, totals } = buildStatusReport({
    websites,
    counts: [
      { website_id: "a", kind: "article", origin: "automated", status: "published", total: "3" },
      { website_id: "a", kind: "article", origin: "manual", status: "published", total: 1 },
      { website_id: "a", kind: "article", origin: "automated", status: "in_review", total: 2 },
      { website_id: "a", kind: "job", origin: null, status: "running", total: 1 },
      { website_id: "a", kind: "job", origin: null, status: "queued", total: 2 },
      { website_id: "a", kind: "job", origin: null, status: "waiting", total: 1 },
      { website_id: "b", kind: "job", origin: null, status: "failed", total: 4 },
      { website_id: "b", kind: "publication", origin: null, status: "failed", total: 1 },
      { website_id: "c", kind: "article", origin: "manual", status: "published", total: 9 },
    ],
    articles: [],
    jobs: [],
    sources: [],
  });
  assert.deepEqual(
    rows.map((row) => row.name),
    ["Alpha", "Beta"],
  );
  assert.equal(rows[0].published, 4);
  assert.equal(rows[0].publishedAutomated, 3);
  assert.equal(rows[0].publishedManual, 1);
  assert.equal(rows[0].in_review, 2);
  assert.equal(rows[0].jobsActive, 3);
  assert.equal(rows[0].jobsWaiting, 1);
  assert.equal(rows[1].jobsFailed, 4);
  assert.equal(rows[1].publicationsFailed, 1);
  assert.equal(totals.published, 4); // the archived website's 9 are left out
});

test("open items list problems before waiting work, oldest first, without double counting", () => {
  const { issues } = buildStatusReport({
    websites,
    counts: [],
    articles: [
      { id: "r2", website_id: "a", title: "Newer review", status: "in_review", updated_at: "2026-11-05T10:00:00Z" },
      { id: "r1", website_id: "b", title: "Older review", status: "in_review", updated_at: "2026-11-01T10:00:00Z" },
      {
        id: "f1",
        website_id: "a",
        title: "Broken",
        status: "approved",
        updated_at: "2026-11-04T00:00:00Z",
        publication_status: "failed",
        publication_error: "WordPress returned 500",
      },
      { id: "x", website_id: "c", title: "Archived site", status: "in_review", updated_at: "2026-10-01T00:00:00Z" },
    ],
    jobs: [
      { id: "j1", website_id: "b", story_title: "Story", status: "failed", last_error: "Timeout" },
      {
        id: "j2",
        website_id: "a",
        story_title: "Paused",
        status: "queued",
        waiting_kind: "budget",
        waiting_reason: "Budget reached",
      },
    ],
    sources: [{ id: "s1", website_id: "b", name: "Feed", last_error: "404" }],
  });
  assert.deepEqual(
    issues.map((issue) => [issue.type, issue.item]),
    [
      ["Failed publication", "Broken"],
      ["Failed draft job", "Story"],
      ["Source feed error", "Feed"],
      ["Traffic sync error", "Alpha"],
      ["Waiting draft job", "Paused"],
      ["Waiting for review", "Older review"],
      ["Waiting for review", "Newer review"],
    ],
  );
  assert.equal(issues[0].detail, "WordPress returned 500");
  assert.equal(issues[0].path, "/articles/f1");
});

test("weekly-only recipients use the alert recipient rules", () => {
  assert.deepEqual(
    weeklyReportEmailsSchema.parse({ weekly_report_emails: "Me@Example.com; me@example.com" }).weekly_report_emails,
    ["me@example.com"],
  );
  assert.equal(weeklyReportEmailsSchema.safeParse({ weekly_report_emails: "nope" }).success, false);
});
