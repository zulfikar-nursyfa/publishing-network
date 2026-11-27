import assert from "node:assert/strict";
import { test } from "node:test";
import { publishRetry } from "@/lib/publishing/retry";

const website = { automation_paused: false, publish_times: ["09:00", "15:00"], timezone: "UTC" };
const article = { status: "approved", origin: "automated", scheduled_for: null };
const now = new Date("2026-11-27T10:00:00Z");

test("a failed automated article with attempts left retries at the next slot", () => {
  assert.deepEqual(publishRetry({ attempt_count: 2, max_attempts: 5 }, article, website, false, now), {
    auto: true,
    at: new Date("2026-11-27T15:00:00Z"),
  });
});

test("waits for a later scheduled time", () => {
  const scheduled = { ...article, scheduled_for: "2026-11-28T09:00:00Z" };
  const result = publishRetry({ attempt_count: 1, max_attempts: 5 }, scheduled, website, false, now);
  assert.deepEqual(result.at, new Date("2026-11-28T09:00:00Z"));
});

test("needs a person once attempts run out, automation is paused, or the article is manual", () => {
  const cases = [
    [{ attempt_count: 5, max_attempts: 5 }, article, website, false],
    [{ attempt_count: 1, max_attempts: 5 }, article, website, true],
    [{ attempt_count: 1, max_attempts: 5 }, article, { ...website, automation_paused: true }, false],
    [{ attempt_count: 1, max_attempts: 5 }, { ...article, origin: "manual" }, website, false],
    [{ attempt_count: 1, max_attempts: 5 }, article, { ...website, publish_times: [] }, false],
  ];
  for (const [publication, row, site, paused] of cases)
    assert.equal(publishRetry(publication, row, site, paused, now).auto, false);
});
