import assert from "node:assert/strict";
import test from "node:test";
import { retrySlotLater } from "../src/lib/automation/scheduler.js";

const slotAt = "2026-11-04T20:00:00.000Z";
const at = (minutes) => Date.parse(slotAt) + minutes * 60_000;
const networkFailure = { outcome: "failed", error: "Could not reach WordPress: fetch failed", retryable: true };

test("temporary failures retry while the slot window has room for another lease", () => {
  assert.equal(retrySlotLater(networkFailure, slotAt, at(2)), true);
  assert.equal(retrySlotLater(networkFailure, slotAt, at(19)), true);
  assert.equal(retrySlotLater(networkFailure, slotAt, at(20)), false);
});

test("permanent failures and other outcomes finish the slot", () => {
  assert.equal(retrySlotLater({ ...networkFailure, retryable: false }, slotAt, at(2)), false);
  assert.equal(retrySlotLater({ outcome: "blocked", reason: "Paused" }, slotAt, at(2)), false);
  assert.equal(retrySlotLater({ outcome: "published" }, slotAt, at(2)), false);
});
