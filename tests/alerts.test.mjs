import assert from "node:assert/strict";
import { test } from "node:test";
import { findAlerts } from "@/lib/alerts/checks";
import { alertMutingSchema } from "@/lib/validation";
import { automationFixture } from "./automation-fixture.mjs";

const now = new Date("2026-10-22T12:00:00Z");

function fixture() {
  const sites = [
    { id: "live", alerts_muted: false, archived_at: null },
    { id: "test", alerts_muted: true, archived_at: null },
    { id: "archived", alerts_muted: false, archived_at: now.toISOString() },
  ];
  const problems = sites.map((site) => ({
    id: site.id,
    website_id: site.id,
    status: "failed",
    updated_at: now.toISOString(),
    slot_at: now.toISOString(),
    step: "draft",
    article_id: `article-${site.id}`,
    attempt_count: 2,
    max_attempts: 3,
    last_error: "Test failure",
  }));
  return automationFixture({
    websites: sites.map((site) => ({ ...site, name: site.id, timezone: "UTC", monthly_ai_budget_usd: 10 })),
    network_settings: [{ monthly_ai_budget_usd: 20 }],
    website_ai_spend: [
      { website_id: "live", estimated_cost_usd: 9, reserved_cost_usd: 0 },
      { website_id: "test", estimated_cost_usd: 10, reserved_cost_usd: 1 },
    ],
    publish_slots: structuredClone(problems),
    publications: structuredClone(problems),
    jobs: structuredClone(problems),
  });
}

test("muted and archived websites produce no alerts while live websites and network budgets still do", async () => {
  const alerts = await findAlerts(fixture(), now);
  assert.equal(
    alerts.some((alert) => ["test", "archived"].includes(alert.website_id)),
    false,
  );
  assert.deepEqual(
    alerts
      .filter((alert) => alert.website_id === "live")
      .map((alert) => alert.kind)
      .sort(),
    ["budget", "job", "publication", "slot"],
  );
  const network = alerts.find((alert) => alert.website_id === null);
  assert.equal(network.key, "budget:network:2026-10:100");
  assert.match(network.message, /\$20\.00 of the \$20\.00/);
});

test("unmuting recomputes current problems without replaying resolved or expired failures", async () => {
  const db = fixture();
  assert.equal(
    (await findAlerts(db, now)).some((alert) => alert.website_id === "test"),
    false,
  );
  db.tables.websites.find((site) => site.id === "test").alerts_muted = false;
  db.tables.jobs.find((job) => job.website_id === "test").status = "succeeded";
  db.tables.publish_slots.find((slot) => slot.website_id === "test").updated_at = "2026-10-20T12:00:00Z";
  const alerts = await findAlerts(db, now);
  assert.deepEqual(
    alerts
      .filter((alert) => alert.website_id === "test")
      .map((alert) => alert.kind)
      .sort(),
    ["budget", "publication"],
  );
});

test("alert muting validates UUID arrays, deduplicates selections and accepts unmuting every site", () => {
  const id = "10000000-0000-4000-8000-000000000001";
  assert.deepEqual(alertMutingSchema.parse({ muted_website_ids: [id, id] }).muted_website_ids, [id]);
  assert.deepEqual(alertMutingSchema.parse({ muted_website_ids: [] }).muted_website_ids, []);
  for (const ids of [["invalid"], [null], "all", Array(1001).fill(id)]) {
    assert.equal(alertMutingSchema.safeParse({ muted_website_ids: ids }).success, false);
  }
});
