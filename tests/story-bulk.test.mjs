import assert from "node:assert/strict";
import { test } from "node:test";
import { changeStories } from "@/lib/story-bulk";
import { automationFixture } from "./automation-fixture.mjs";
import { summariseAggregatedUsage } from "@/lib/costs";

const a = "10000000-0000-4000-8000-000000000001";
const b = "10000000-0000-4000-8000-000000000002";
function setup() {
  const db = automationFixture({
    story_candidates: [
      { id: a, website_id: "one", status: "new" },
      { id: b, website_id: "two", status: "selected" },
    ],
  });
  const allowed = [],
    audits = [],
    cancelled = [];
  const options = {
    db,
    ids: [a, b],
    status: "skipped",
    authorize: async (id) => allowed.push(id),
    audit: async (entry) => audits.push(entry),
    cancelJobs: async (ids) => {
      cancelled.push(...ids);
      return { error: null };
    },
  };
  return { db, options, allowed, audits, cancelled };
}

test("bulk changes authorize every website, audit per website and cancel only the changed stories", async () => {
  const { db, options, allowed, audits, cancelled } = setup();
  assert.equal((await changeStories(options)).ok, true);
  assert.deepEqual(allowed, ["one", "two"]);
  assert.deepEqual(
    audits.map((entry) => entry.storyIds),
    [[a], [b]],
  );
  assert.deepEqual(cancelled, [a, b]);
  assert.ok(db.tables.story_candidates.every((row) => row.status === "skipped"));
});

test("a denied website prevents all writes and cancellations, including earlier authorized websites", async () => {
  const { db, options, audits, cancelled } = setup();
  options.authorize = async (id) => {
    if (id === "two") throw new Error("Access denied");
  };
  await assert.rejects(() => changeStories(options), /Access denied/);
  assert.deepEqual(
    db.tables.story_candidates.map((row) => row.status),
    ["new", "selected"],
  );
  assert.deepEqual(audits, []);
  assert.deepEqual(cancelled, []);
});

test("bulk actions reject missing/inaccessible IDs and invalid payloads before mutation", async () => {
  for (const patch of [
    { ids: [] },
    { ids: ["invalid"] },
    { status: "published" },
    { ids: [a, "10000000-0000-4000-8000-000000000003"] },
  ]) {
    const { db, options, audits } = setup();
    assert.ok((await changeStories({ ...options, ...patch })).error);
    assert.deepEqual(
      db.tables.story_candidates.map((row) => row.status),
      ["new", "selected"],
    );
    assert.deepEqual(audits, []);
  }
});

test("used stories remain unchanged and selecting never creates an admin cancellation", async () => {
  const { db, options, audits, cancelled } = setup();
  db.tables.story_candidates[0].status = "used";
  assert.equal((await changeStories({ ...options, ids: [a, b, b], status: "selected" })).ok, true);
  assert.equal(db.tables.story_candidates[0].status, "used");
  assert.deepEqual(
    audits.map((entry) => entry.storyIds),
    [[b]],
  );
  assert.deepEqual(cancelled, []);
});

test("a cancellation failure is reported after the successful story change has been audited", async () => {
  const { options, audits } = setup();
  options.cancelJobs = async () => ({ error: { message: "Database unavailable" } });
  assert.match((await changeStories(options)).error, /could not be cancelled/);
  assert.equal(audits.length, 2);
});

test("SQL aggregate rows keep true call counts and numeric totals", () => {
  const summary = summariseAggregatedUsage([
    { operation: "draft", cost_usd: "12.5", searches: "0", calls: "1100" },
    { operation: "search", cost_usd: "2", searches: "40", calls: "105" },
  ]);
  assert.equal(summary.total, 14.5);
  assert.equal(summary.calls, 1205);
  assert.equal(summary.searches, 40);
  assert.deepEqual(summary.byOperation, { draft: 12.5, search: 2 });
});
