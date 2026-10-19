import assert from "node:assert/strict";
import { test } from "node:test";
import { draftsNeededFor, staleQueuedStory, STALE_STORY_MS, waitingKind } from "@/lib/automation/drafting/queue-policy";
import { alertEmailsSchema } from "@/lib/validation";

const now = Date.parse("2026-10-19T12:00:00Z");
const queued = { status: "queued", step: "collect", state: {} };
const story = (age) => ({
  source_published_at: new Date(now - age).toISOString(),
  created_at: new Date(now).toISOString(),
});

test("stale collection jobs expire at 48 hours using publication time, then discovery time", () => {
  assert.equal(staleQueuedStory(queued, story(STALE_STORY_MS - 1), now), false);
  assert.equal(staleQueuedStory(queued, story(STALE_STORY_MS), now), true);
  assert.equal(
    staleQueuedStory(queued, { source_published_at: null, created_at: story(STALE_STORY_MS).source_published_at }, now),
    true,
  );
  assert.equal(staleQueuedStory(queued, { created_at: "invalid" }, now), false);
  assert.equal(staleQueuedStory(queued, story(-1000), now), false);
});

test("stale cleanup protects running, completed, failed and researched jobs including corroboration", () => {
  const old = story(STALE_STORY_MS * 2);
  for (const status of ["running", "failed", "succeeded", "cancelled"])
    assert.equal(staleQueuedStory({ ...queued, status }, old, now), false);
  for (const step of ["research", "draft", "verify", "illustrate", "create_article"])
    assert.equal(staleQueuedStory({ ...queued, step }, old, now), false);
  for (const state of [{ research: {} }, { draft: {} }, { corroboration_searched: true }])
    assert.equal(staleQueuedStory({ ...queued, state }, old, now), false);
});

test("the buffer counts waiting work until removed, clamps overfull sites and caps each run", () => {
  assert.equal(draftsNeededFor(3, 1, 5), 0);
  assert.equal(draftsNeededFor(3, 1, 4), 1);
  assert.equal(draftsNeededFor(3, 1, 0), 5);
  assert.equal(draftsNeededFor(0, 0, 0), 0);
  assert.equal(draftsNeededFor(1, 4, 5), 0);
  assert.equal(draftsNeededFor(50, 0, 0), 12);
});

test("waiting labels distinguish budget, paused/off and ordinary retry errors", () => {
  for (const error of ["Network AI budget exceeded", "AI budget was lowered below current spending and reservations"])
    assert.equal(waitingKind(error), "budget");
  for (const error of ["Network automation is paused", "Website automation is off"])
    assert.equal(waitingKind(error), "paused");
  assert.equal(waitingKind("Provider unavailable"), null);
});

test("recipient writes validate, normalize case, deduplicate and enforce ten unique addresses", () => {
  assert.deepEqual(
    alertEmailsSchema.parse({ alert_emails: " Editor@Example.com;editor@example.com\nnews@example.com " }).alert_emails,
    ["editor@example.com", "news@example.com"],
  );
  assert.deepEqual(alertEmailsSchema.parse({ alert_emails: "" }).alert_emails, []);
  assert.equal(alertEmailsSchema.safeParse({ alert_emails: "invalid" }).success, false);
  assert.equal(
    alertEmailsSchema.safeParse({
      alert_emails: Array.from({ length: 11 }, (_, i) => `editor${i}@example.com`).join("\n"),
    }).success,
    false,
  );
});
