import assert from "node:assert/strict";
import { test } from "node:test";
import { buildWeeklyReport, shiftWeek, weekChange, weekParam, weeklyEmail } from "@/lib/weekly-report";

test("weeks start on Monday (UTC) and default to the last completed week", () => {
  const thursday = new Date("2026-11-05T12:00:00Z");
  assert.equal(weekParam(undefined, thursday), "2026-10-26");
  assert.equal(weekParam("2026-11-08", thursday), "2026-11-02"); // a Sunday snaps to its Monday
  assert.equal(weekParam("2026-13-40", thursday), "2026-10-26");
  assert.equal(shiftWeek("2026-11-02", -1), "2026-10-26");
});

test("changes compare with the previous week", () => {
  assert.equal(weekChange(15, 10), "+50%");
  assert.equal(weekChange(5, 10), "−50%");
  assert.equal(weekChange(3, 0), "new");
  assert.equal(weekChange(4, 4), null);
  assert.equal(weekChange(null, 4), null);
});

test("the report joins both weeks per active website and keeps unknown traffic as null", () => {
  const report = buildWeeklyReport({
    websites: [
      { id: "a", name: "Alpha", archived_at: null },
      { id: "b", name: "Beta", archived_at: null },
      { id: "c", name: "Old", archived_at: "2026-01-01" },
    ],
    current: [
      {
        website_id: "a",
        published_automated: 3,
        published_manual: 1,
        ai_cost_usd: "1.5",
        sessions: 100,
        contact_clicks: 4,
      },
      { website_id: "b", published_automated: 0, published_manual: 2, sessions: null },
    ],
    previous: [{ website_id: "a", published_automated: 2, published_manual: 0, sessions: 80, contact_clicks: 0 }],
    stats: [{ website_id: "a", in_review: 5, failed_publications: 1 }],
  });
  assert.deepEqual(
    report.rows.map((row) => row.name),
    ["Alpha", "Beta"],
  );
  assert.equal(report.rows[0].week.published, 4);
  assert.equal(report.rows[0].week.ai, 1.5);
  assert.equal(report.rows[1].week.sessions, null);
  assert.equal(report.totals.week.published, 6);
  assert.equal(report.totals.week.sessions, 100);
  assert.equal(report.totals.week.searchClicks, null);
  assert.equal(report.totals.inReview, 5);

  const email = weeklyEmail(report, "2026-11-02", "https://pn.example");
  assert.match(email.subject, /2 Nov – 8 Nov 2026/);
  assert.match(email.text, /Alpha\n {2}Published: 4 \(\+100%\)/);
  assert.match(email.text, /Contact clicks: 4 \(new\)/);
  assert.doesNotMatch(email.text, /Search clicks/);
  assert.match(email.text, /https:\/\/pn\.example\/weekly\?week=2026-11-02/);
});
