import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { draftReviewNote, outletCount, recheckedWarnings } from "@/lib/automation/drafting/recheck";
import { copiedPassages, copiedWarning } from "@/lib/automation/draft-checks";

const previous = [
  "No official source and only one outlet supports the story",
  "AI verification did not pass",
  "Verification: Relative date ambiguity",
  "Unsupported claim: Record exhibitors",
  "Re-check could not read https://old.example.test/page: HTTP 403",
  "Figures not found in the sources (check each one): 33",
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

test("a re-check reading two outlets clears the single-source warning (PM review 19 Nov)", () => {
  const warnings = ["Sensitive or consequential story without a second independent source"];
  const pages = [{ url: "https://www.thenationalnews.com/a" }, { url: "https://wam.ae/b" }];
  assert.equal(outletCount(pages), 2);
  assert.deepEqual(recheckedWarnings(warnings, [], { hasCategory: true, hasImage: true, outlets: 2 }), []);
  assert.deepEqual(recheckedWarnings(warnings, [], { hasCategory: true, hasImage: true, outlets: 1 }), warnings);
});

test("a re-check replaces the copied-wording warning with the current draft's (PM review 19 Nov)", () => {
  const page = {
    url: "https://news.example.test/dxb",
    text: "India led the traffic, followed by Saudi Arabia with 1.4 million and the UK with 1.1 million passengers.",
  };
  const old = {
    title: "DXB traffic",
    excerpt: "",
    body: `India led, followed by Saudi Arabia with 1.4 million and the UK with 1.1 million.`,
  };
  const edited = { ...old, body: "India was the largest market. Saudi Arabia and the UK came next." };
  const copied = copiedPassages(old, [page]);
  assert.equal(copied.length, 1);
  assert.deepEqual(copiedPassages(edited, [page]), []);
  assert.deepEqual(recheckedWarnings([copiedWarning(copied)], [], { hasCategory: true, hasImage: true }), []);
});

test("every copied passage is reported in one warning, overlapping runs merged (PM review 23 Nov)", () => {
  const first = "DP World said the new corridor would cut shipping times between the Gulf and Latin American ports";
  const second = "Dominican Republic President Luis Abinader said his country wants to strengthen its role as a bridge";
  const page = { url: "https://news.example.test/dialogue", text: `${first}. Other news follows here. ${second}.` };
  const article = { title: "Dialogue", excerpt: "", body: `${first}, officials said. Separately, ${second}.` };
  const copied = copiedPassages(article, [page]);
  assert.deepEqual(copied, [first, second]);
  assert.equal(copiedWarning(copied), `The draft still repeats source wording ("${first}"; "${second}"); reword it`);
});
