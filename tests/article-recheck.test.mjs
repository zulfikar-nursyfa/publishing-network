import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { draftReviewNote, recheckedWarnings } from "@/lib/automation/drafting/recheck";

const previous = [
  "No official source and only one outlet supports the story",
  "AI verification did not pass",
  "Verification: Relative date ambiguity",
  "Unsupported claim: Record exhibitors",
  "Re-check could not read https://old.example.test/page: HTTP 403",
  "The draft has no category; choose one before publishing",
  "AI image not generated: Network AI budget would be exceeded",
];

test("a re-check replaces verification warnings and drops problems the edits fixed", () => {
  const fresh = ["Verification: The excerpt overstates the outcome"];
  assert.deepEqual(recheckedWarnings(previous, fresh, { hasCategory: true, hasImage: true }), [
    "No official source and only one outlet supports the story",
    ...fresh,
  ]);
});

test("unfixed category and image problems stay, and a clean re-check clears verification", () => {
  assert.deepEqual(recheckedWarnings(previous, [], { hasCategory: false, hasImage: false }), [
    "No official source and only one outlet supports the story",
    "The draft has no category; choose one before publishing",
    "AI image not generated: Network AI budget would be exceeded",
  ]);
  assert.deepEqual(recheckedWarnings(undefined, [], { hasCategory: false, hasImage: false }), []);
});

test("the rewritten review note matches the one complete_draft_job writes", () => {
  const sql = readFileSync(new URL("../supabase/migrations/30_draft_images.sql", import.meta.url), "utf8");
  const prefix = draftReviewNote([]);
  assert.ok(sql.includes(`'${prefix}'`));
  assert.equal(draftReviewNote(["One", "Two"]), `${prefix}\n\nCheck these warnings:\n- One\n- Two`);
});
