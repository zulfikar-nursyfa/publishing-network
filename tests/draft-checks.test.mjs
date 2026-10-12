import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkDraft,
  checkResearch,
  checkVerification,
  corroboration,
  draftSchema,
} from "@/lib/automation/draft-checks";
import { summariseUsage } from "@/lib/costs";

const statement = "The company announced a new route to Dubai.";
const pageAt = (url, primary = false) => ({ url, primary, text: `${statement} Further details follow. `.repeat(20) });
const official = pageAt("https://newsroom.example.test/release");
const outletA = pageAt("https://outlet-a.example.test/story");
const outletB = pageAt("https://outlet-b.example.test/story");
const research = (urls, extra = {}) => ({
  angle: "What the new route means for regional travellers",
  claims: [1, 2, 3].map(() => ({
    claim: statement,
    source_urls: urls,
    evidence: [{ url: urls[0], quote: statement }],
  })),
  primary_source_url: null,
  sensitive: false,
  needs_corroboration: false,
  unresolved: [],
  ...extra,
});
const draft = (urls) =>
  draftSchema.parse({
    title: "An original regional business report",
    slug: "regional-business-report",
    excerpt: "An original summary that presents the regional relevance of the verified announcement.",
    body: Array.from({ length: 260 }, (_, i) => `originalword${i}`).join(" "),
    category_id: null,
    sensitive: false,
    source_urls: urls,
  });

test("research with the official source has no warnings", () => {
  const checked = checkResearch(research([official.url], { primary_source_url: official.url }), [official]);
  assert.deepEqual(checked.warnings, []);
  assert.equal(checked.research.claims.length, 3);
});

test("quotes match loosely, ignoring punctuation and small wording differences", () => {
  const r = research([outletA.url, outletB.url]);
  r.claims[0].evidence[0].quote = "the company announced — a new route to Dubai";
  r.claims[1].evidence[0].quote = "The company announced a brand new route to Dubai.";
  assert.equal(checkResearch(r, [outletA, outletB]).research.claims.length, 3);
});

test("facts whose quotes are not on the page are dropped with a warning", () => {
  const r = research([outletA.url, outletB.url]);
  r.claims[0].evidence[0].quote = "A sentence that is not on the page at all, anywhere.";
  const checked = checkResearch(r, [outletA, outletB]);
  assert.equal(checked.research.claims.length, 2);
  assert.match(checked.warnings[0], /1 researched facts were dropped/);
});

test("research fails only when no fact matches the pages", () => {
  const r = research([outletA.url]);
  for (const claim of r.claims) claim.evidence[0].quote = "Nothing like this appears on the collected page.";
  assert.throws(() => checkResearch(r, [outletA]), /None of the researched facts/);
});

test("weak sourcing, sensitivity and unconfirmed details become warnings", () => {
  const checked = checkResearch(research([outletA.url], { sensitive: true, unresolved: ["Launch date"] }), [outletA]);
  assert.equal(checked.warnings.length, 2);
  assert.equal(
    checkResearch(research([official.url], { primary_source_url: "https://elsewhere.example.test/" }), [official])
      .research.primary_source_url,
    null,
  );
});

test("sensitive stories need two independent sites, others an official source or two sites", () => {
  const officialOnly = research([official.url], { primary_source_url: official.url });
  assert.equal(corroboration(officialOnly, [official]).met, true);
  assert.equal(corroboration({ ...officialOnly, needs_corroboration: true }, [official]).met, false);
  assert.equal(corroboration(research([outletA.url, outletB.url], { sensitive: true }), [outletA, outletB]).met, true);
  assert.equal(corroboration(research([outletA.url]), [outletA]).met, false);
});

test("usage totals count open calls at their reservation", () => {
  const usage = summariseUsage([
    {
      operation: "draft",
      status: "completed",
      estimated_cost_usd: "0.01",
      reserved_cost_usd: "0.05",
      search_queries: 0,
    },
    { operation: "search", status: "reserved", estimated_cost_usd: "0", reserved_cost_usd: "0.04", search_queries: 2 },
  ]);
  assert.equal(usage.total.toFixed(2), "0.05");
  assert.equal(usage.searches, 2);
  assert.equal(usage.byOperation.search, 0.04);
});

test("drafts: uncollected citations removed, missing official source warned", () => {
  const withPrimary = research([official.url, outletA.url], { primary_source_url: official.url });
  const checked = checkDraft(
    draft([outletA.url, "https://invented.example.test/"]),
    withPrimary,
    [official, outletA],
    [],
    "en",
  );
  assert.deepEqual(checked.draft.source_urls, [outletA.url]);
  assert.ok(checked.warnings.some((warning) => /official source/.test(warning)));
  assert.equal(
    checkDraft({ ...draft([official.url]), category_id: crypto.randomUUID() }, withPrimary, [official], [], "en").draft
      .category_id,
    null,
  );
});

test("drafts still reject copied passages, HTML and the wrong language", () => {
  const r = research([official.url], { primary_source_url: official.url });
  const copied = draft([official.url]);
  copied.body = `${copied.body} ${official.text}`;
  assert.throws(() => checkDraft(copied, r, [official], [], "en"), /copied passage/);
  assert.throws(
    () =>
      checkDraft({ ...draft([official.url]), body: `<p>${draft([official.url]).body}</p>` }, r, [official], [], "en"),
    /plain text/,
  );
  assert.throws(() => checkDraft(draft([official.url]), r, [official], [], "ar"), /language/);
});

test("verification problems become warnings", () => {
  assert.deepEqual(
    checkVerification({
      passed: true,
      issues: [],
      checked_claims: [{ claim: statement, supported: true, source_urls: [official.url] }],
    }),
    [],
  );
  const warnings = checkVerification({
    passed: false,
    issues: ["Wrong date"],
    checked_claims: [{ claim: "Route starts in May", supported: false, source_urls: [official.url] }],
  });
  assert.deepEqual(warnings, [
    "AI verification did not pass",
    "Verification: Wrong date",
    "Unsupported claim: Route starts in May",
  ]);
});
