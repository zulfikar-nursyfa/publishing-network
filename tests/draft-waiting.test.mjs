import assert from "node:assert/strict";
import { test } from "node:test";
import { automationFixture } from "./automation-fixture.mjs";
import { maintainDraftQueue } from "@/lib/automation/drafting/queue-maintenance";
import { loadJobContext } from "@/lib/automation/drafting/context";
import { LostLease } from "@/lib/automation/drafting/errors";

const now = Date.parse("2026-10-19T12:00:00Z");
const website = { id: "site", automation_mode: "review", automation_paused: false, archived_at: null };
const network = { automation_paused: false };
const job = (extra = {}) => ({
  id: "job",
  website_id: "site",
  status: "queued",
  step: "collect",
  state: {},
  updated_at: new Date(now).toISOString(),
  waiting_kind: null,
  waiting_since: null,
  waiting_reason: null,
  story_candidates: { created_at: "2026-10-16T12:00:00Z" },
  ...extra,
});

test("queue maintenance expires before controls and audits only a successful locked cancellation", async () => {
  const db = automationFixture({ jobs: [job()] });
  const audits = [];
  let calls = 0;
  db.rpc = async (name, args) => {
    calls++;
    assert.equal(name, "cancel_draft_job");
    assert.equal(args.discard_story, true);
    assert.equal(args.stale_before, "2026-10-17T12:00:00.000Z");
    return { data: calls === 1, error: null };
  };
  const options = { now, audit: async (entry) => audits.push(entry) };
  await maintainDraftQueue(db, [website], { automation_paused: true }, options);
  await maintainDraftQueue(db, [website], network, options);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "automation.story_stale");
});

test("pause waiting keeps its first timestamp, clears on resume and preserves budget waits", async () => {
  const pending = job({ story_candidates: { created_at: new Date(now).toISOString() } });
  const db = automationFixture({ jobs: [pending] });
  const options = { now, audit: async () => assert.fail("Unexpected stale audit") };
  await maintainDraftQueue(db, [website], { automation_paused: true }, options);
  assert.equal(pending.waiting_kind, "paused");
  const since = pending.waiting_since;
  await maintainDraftQueue(db, [website], { automation_paused: true }, { ...options, now: now + 60_000 });
  assert.equal(pending.waiting_since, since);
  await maintainDraftQueue(db, [website], network, options);
  assert.equal(pending.waiting_kind, null);
  assert.equal(pending.waiting_since, null);
  Object.assign(pending, { waiting_kind: "budget", waiting_reason: "Budget would be exceeded", waiting_since: since });
  await maintainDraftQueue(db, [website], network, options);
  assert.equal(pending.waiting_kind, "budget");
  assert.equal(pending.waiting_since, since);
  pending.last_error = "Budget would be exceeded";
  await maintainDraftQueue(db, [website], { automation_paused: true }, options);
  assert.equal(pending.waiting_kind, "paused");
  await maintainDraftQueue(db, [website], network, options);
  assert.equal(pending.waiting_kind, "budget");
});

test("a cancelled running worker loses its controls even while its original lease is valid", async () => {
  const running = { id: "job", website_id: "site", story_id: "story" };
  const db = automationFixture({
    websites: [website],
    network_settings: [network],
    story_candidates: [{ id: "story", website_id: "site", status: "skipped" }],
    content_sources: [],
    categories: [],
    jobs: [
      {
        ...running,
        status: "cancelled",
        locked_by: "worker",
        locked_until: new Date(Date.now() + 60_000).toISOString(),
      },
    ],
  });
  await assert.rejects(() => loadJobContext(db, running, "worker"), LostLease);
});
