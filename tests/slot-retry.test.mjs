import assert from "node:assert/strict";
import test from "node:test";
import { movesOn, retrySlotLater } from "../src/lib/automation/scheduler.js";

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

test("a publishing failure moves the slot on to its next article; a block ends the slot", () => {
  assert.equal(movesOn({ outcome: "failed", error: "Category is not linked to WordPress" }), true);
  assert.equal(movesOn({ outcome: "attempts_exhausted", attempts: 4 }), true);
  assert.equal(movesOn({ outcome: "blocked", reason: "WordPress connection needs attention" }), false);
  assert.equal(movesOn({ outcome: "published" }), false);
});
