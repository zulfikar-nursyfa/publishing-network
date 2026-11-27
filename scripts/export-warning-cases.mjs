// Turns reviewers' verdicts on draft warnings (warning_feedback) into regression fixtures, one per job,
// in tests/fixtures/warning-cases/, then prints how often each check was a false alarm.
//
//   node --env-file=.env.local --import ./tests/setup.mjs scripts/export-warning-cases.mjs [since YYYY-MM-DD]
//
// Only text-check warnings are exported: AI verification and corroboration warnings cannot be replayed.
// A warning the checks no longer gave for its saved article (edited after its last check) is skipped.
// Commit the fixtures with the checker fix, then `npm test` keeps each verdict true.

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { isTextWarning, warningItems } from "@/lib/automation/warning-feedback";

const since = process.argv[2] ?? "2000-01-01";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret || !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
  console.error(
    "Usage: node --env-file=.env.local --import ./tests/setup.mjs scripts/export-warning-cases.mjs [YYYY-MM-DD]",
  );
  process.exit(1);
}

const db = createClient(url, secret, { auth: { persistSession: false } });
const { data: rows, error } = await db
  .from("warning_feedback")
  .select("job_id, warning, check_name, verdict, note, snapshot, created_at, articles(title)")
  .gte("created_at", since)
  .order("created_at");
if (error) {
  console.error(error.message);
  process.exit(1);
}

const dir = new URL("../tests/fixtures/warning-cases/", import.meta.url);
mkdirSync(dir, { recursive: true });
const byJob = new Map();
const rates = new Map();
let skipped = 0;
for (const row of rows) {
  const rate = rates.get(row.check_name) ?? { false_alarm: 0, real_problem: 0 };
  rate[row.verdict]++;
  rates.set(row.check_name, rate);
  if (!isTextWarning(row.warning)) continue;
  if (!row.snapshot.reproduces) {
    skipped++;
    continue;
  }
  // One fixture per job and article version: marks made after an edit get their own file.
  const snapshot = { ...row.snapshot };
  delete snapshot.reproduces;
  const version = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex").slice(0, 8);
  const key = `${row.job_id}-${version}`;
  const fixture = byJob.get(key) ?? { title: row.articles?.title ?? null, snapshot, cases: [] };
  fixture.cases.push({
    check: row.check_name,
    verdict: row.verdict,
    items: warningItems(row.warning),
    note: row.note,
    warning: row.warning,
  });
  byJob.set(key, fixture);
}
for (const [key, fixture] of byJob) {
  writeFileSync(new URL(`${key}.json`, dir), `${JSON.stringify(fixture, null, 2)}\n`);
}
console.log(`${byJob.size} fixtures written; ${skipped} warnings skipped because the article changed after its check.`);
for (const [check, { false_alarm, real_problem }] of [...rates].sort(([, a], [, b]) => b.false_alarm - a.false_alarm)) {
  console.log(`${check}: ${false_alarm} false alarms, ${real_problem} real problems`);
}
