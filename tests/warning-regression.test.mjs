// Replays the text checks on every reviewed draft in tests/fixtures/warning-cases (made by
// scripts/export-warning-cases.mjs). A false alarm must not come back; a real problem must still be found.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { replayWarnings, warningCheck, warningItems, warningSnapshot } from "@/lib/automation/warning-feedback";

const dir = new URL("./fixtures/warning-cases/", import.meta.url);
const fixtures = readdirSync(dir)
  .filter((name) => name.endsWith(".json"))
  .map((name) => ({ name, ...JSON.parse(readFileSync(new URL(name, dir), "utf8")) }));

/** The items each check lists for the snapshot now, keyed by the check's title. */
function itemsNow(snapshot) {
  const found = new Map();
  for (const warning of replayWarnings(snapshot)) {
    const check = warning.slice(0, warning.indexOf(" ("));
    found.set(check, new Set(warningItems(warning)));
  }
  return found;
}

test("a verdict's snapshot replays the warning it was given for", () => {
  const warning = "Figures not found in the sources (check each one): 26, 31";
  assert.equal(warningCheck(warning), "Figures not found in the sources");
  assert.equal(warningCheck("AI verification did not pass: sentence 3"), "AI verification did not pass");
  assert.deepEqual(warningItems(warning), ["26", "31"]);
  const snapshot = {
    warning,
    article: { title: "Rents", body: "Rents rose 26% and 31% in Dubai.", extra: "dropped" },
    evidence: [{ url: "https://news.example.test/a", text: "Rents rose sharply.", fetched_at: "dropped" }],
    language: "en",
    kind: "general",
    today: "2026-11-27T10:00:00Z",
  };
  const saved = warningSnapshot(snapshot);
  assert.equal(saved.reproduces, true);
  assert.deepEqual(Object.keys(saved.article), ["title", "excerpt", "body", "seo_title", "meta_description"]);
  assert.deepEqual(saved.evidence, [{ url: "https://news.example.test/a", text: "Rents rose sharply." }]);
  assert.equal(warningSnapshot({ ...snapshot, warning: "AI verification did not pass" }).reproduces, false);
});

test("reviewed warnings: false alarms stay gone, real problems stay found", (t) => {
  const failures = [];
  const score = new Map();
  for (const fixture of fixtures) {
    const now = itemsNow(fixture.snapshot);
    for (const { check, verdict, items } of fixture.cases) {
      const row = score.get(check) ?? { false_alarm: [0, 0], real_problem: [0, 0] };
      for (const item of items) {
        const flagged = now.get(check)?.has(item) ?? false;
        const ok = verdict === "false_alarm" ? !flagged : flagged;
        row[verdict][ok ? 0 : 1]++;
        if (!ok)
          failures.push(`${fixture.name}: ${check}: ${item} is ${flagged ? "flagged again" : "no longer flagged"}`);
      }
      score.set(check, row);
    }
  }
  for (const [check, row] of score) {
    const [gone, back] = row.false_alarm;
    const [kept, lost] = row.real_problem;
    t.diagnostic(`${check}: ${gone}/${gone + back} false alarms gone, ${kept}/${kept + lost} real problems found`);
  }
  assert.deepEqual(failures, []);
});
