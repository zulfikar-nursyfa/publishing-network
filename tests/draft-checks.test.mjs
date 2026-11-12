import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkDraft,
  checkResearch,
  checkVerification,
  corroboration,
  draftSchema,
  DraftCheckError,
  CopiedPassageError,
  ShortDraftError,
  draftSentences,
  responseSchema,
  verificationSchema,
} from "@/lib/automation/draft-checks";
import { textWarnings, unsourcedFigures } from "@/lib/automation/text-checks";
import { needsRedraft, promptData } from "@/lib/automation/drafting/write";
import {
  draftOutputSchema,
  draftWithUrls,
  researchOutputSchema,
  researchWithNumbers,
  researchWithUrls,
} from "@/lib/automation/drafting/sources";
import { draftPrompt } from "@/lib/automation/drafting/prompts";
import { DRAFT_CHECKS } from "@/lib/automation/strict-checks";
import { strictDraftChecksSchema, nicheCategorySchema } from "@/lib/validation";
import { readFileSync } from "node:fs";
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
  const uncategorised = checkDraft(
    { ...draft([official.url]), category_id: crypto.randomUUID() },
    withPrimary,
    [official],
    [],
    "en",
  );
  assert.equal(uncategorised.draft.category_id, null);
  assert.ok(uncategorised.warnings.some((warning) => /no category/.test(warning)));
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

test("drafts may repeat full formal titles using source casing", () => {
  const title =
    "His Highness Sheikh Mohammed bin Rashid Al Maktoum, Vice President and Prime Minister of the UAE and Ruler of Dubai";
  const page = { ...official, text: title };
  const article = draft([page.url]);
  article.body += ` ${title.toLowerCase()}`;
  assert.doesNotThrow(() => checkDraft(article, research([page.url]), [page], [], "en"));
});

test("protocol phrasing around a full title is not a copied passage", () => {
  const sentence =
    "Saeed Al Hajeri led the delegation on behalf of His Highness Sheikh Mohammed bin Rashid Al Maktoum, Vice President and Prime Minister of the UAE and Ruler of Dubai";
  const page = { ...official, text: sentence };
  const article = draft([page.url]);
  article.body += ` attended on behalf of His Highness Sheikh Mohammed bin Rashid Al Maktoum, Vice President and Prime Minister of the UAE and Ruler of Dubai`;
  assert.doesNotThrow(() => checkDraft(article, research([page.url]), [page], [], "en"));
});

test("official titles and dates do not count towards the five-word similarity limit", () => {
  const titles = Array.from(
    { length: 30 },
    (_, i) => `Council${i} of the Regional${i} Energy${i} and Water${i} Authority${i} in October${i} 2026`,
  );
  const page = { ...official, text: titles.join(" announced ") };
  const article = { ...draft([page.url]), body: titles.join(" reported ") };
  assert.doesNotThrow(() => checkDraft(article, research([page.url]), [page], [], "en"));
});

test("ordinary copied sentences report the source phrase even if the draft capitalises it", () => {
  const phrase = "Officials confirmed that the new regional service will start operating next month";
  const page = { ...official, text: phrase };
  const article = draft([page.url]);
  article.body += ` ${phrase.toUpperCase()}`;
  assert.throws(
    () => checkDraft(article, research([page.url]), [page], [], "en"),
    (error) =>
      error instanceof CopiedPassageError &&
      error instanceof DraftCheckError &&
      error.phrase === phrase &&
      error.message === `Draft contains a long copied passage ("${phrase}"); revise the sourcing and retry`,
  );
});

test("ordinary five-word overlaps still count towards the similarity limit", () => {
  const runs = Array.from({ length: 40 }, (_, i) => `officials confirmed the regional project${i} will open soon`);
  const page = { ...official, text: runs.join(" yesterday ") };
  const article = { ...draft([page.url]), body: runs.join(" today ") };
  assert.throws(() => checkDraft(article, research([page.url]), [page], [], "en"), /too similar/);
});

test("Arabic copied passages still fail with their matched phrase", () => {
  const phrase = "أكد المسؤولون أن المشروع الجديد سوف يدعم تطوير الخدمات المحلية خلال العام المقبل";
  const page = { ...official, text: phrase };
  const article = {
    ...draft([page.url]),
    body: `${"تقرير مستقل يناقش تطورات القطاع وأثرها على المجتمع المحلي. ".repeat(25)} ${phrase}`,
  };
  assert.throws(
    () => checkDraft(article, research([page.url]), [page], [], "ar"),
    (error) => error instanceof CopiedPassageError && error.phrase.startsWith("أكد المسؤولون"),
  );
});

test("copied phrase diagnostics are capped at 200 characters", () => {
  const error = new CopiedPassageError("word ".repeat(100));
  assert.equal(error.phrase.length, 200);
  assert.ok(error.message.includes(error.phrase));
});

test("copied passage rejections request at most two redrafts", () => {
  const error = new CopiedPassageError("source wording");
  assert.equal(needsRedraft({}, error), true);
  assert.equal(needsRedraft({ copied_phrases: ["first"] }, error), true);
  assert.equal(needsRedraft({ copied_phrases: ["first", "second"] }, error), false);
  assert.equal(needsRedraft({}, new DraftCheckError("too similar")), false);
  assert.equal(needsRedraft({}, new ShortDraftError(150)), true);
  assert.equal(needsRedraft({ short_draft_words: 150 }, new ShortDraftError(160)), false);
  assert.equal(needsRedraft({}, new Error("provider failed")), false);
});

test("draft prompts preserve full titles and include copied wording only on a redraft", () => {
  const options = { language: "en", nicheGuide: null };
  const first = draftPrompt("{}", {}, [], options);
  assert.ok(first.includes("Write people's names and official titles in full as the sources give them."));
  assert.equal(first.includes("Your previous draft"), false);
  const retry = draftPrompt("{}", {}, [], { ...options, copiedPhrases: ["First copied wording", "Second wording"] });
  assert.ok(
    retry.includes('Your previous drafts repeated this source wording: "First copied wording"; "Second wording".'),
  );
  assert.ok(retry.includes("Write the whole article in your own words and sentence structure"));
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

test("a claim marked supported needs its quoted support on a source page", () => {
  const claim = { claim: "A new route to Dubai", supported: true, source_urls: [official.url] };
  const check = (source_quote) =>
    checkVerification({ passed: true, issues: [], checked_claims: [{ ...claim, source_quote }] }, [], [official]);
  assert.deepEqual(check(statement), []);
  assert.deepEqual(check("The airline signed direct investment projects worth billions."), [
    "Unsupported claim: A new route to Dubai (its quoted support is not on the source pages)",
  ]);
  assert.equal(check("").length, 1);
});

test("the article is split into numbered sentences, keeping abbreviations whole", () => {
  const sentences = draftSentences({
    title: "Dubai opens a route",
    excerpt: "",
    seo_title: "Dubai route",
    body: "Dr. Herrmann met U.S. officials on 3 Nov. The route opens in May!\nIt has 7 ports.",
  });
  assert.deepEqual(
    sentences.map(({ field, text }) => `${field}: ${text}`),
    [
      "title: Dubai opens a route",
      "seo_title: Dubai route",
      "body: Dr. Herrmann met U.S. officials on 3 Nov.",
      "body: The route opens in May!",
      "body: It has 7 ports.",
    ],
  );
});

test("each sentence needs its own verdict and is reported in the draft's words", () => {
  const sentences = [{ text: "Synopsys began supplying software." }, { text: statement }, { text: "It has 7 ports." }];
  const verdict = (sentence, supported, extra = {}) => ({
    sentence,
    claim: "the verifier's own rewording",
    supported,
    source_urls: [official.url],
    source_quote: statement,
    note: "",
    ...extra,
  });
  const warnings = checkVerification(
    {
      passed: false,
      issues: [],
      checked_claims: [verdict(1, false, { note: "the source says it was set to begin" }), verdict(2, true)],
    },
    [],
    [official],
    sentences,
  );
  assert.deepEqual(warnings, [
    "AI verification did not pass",
    "Unsupported claim: Synopsys began supplying software. (the source says it was set to begin)",
    "Not checked by AI verification: It has 7 ports.",
  ]);
  // Support from two source sentences is quoted with " | "; every part must be on a page.
  const joined = (source_quote) =>
    checkVerification(
      { passed: true, issues: [], checked_claims: [verdict(1, true, { source_quote })] },
      [],
      [official],
      [sentences[1]],
    );
  assert.deepEqual(joined(`${statement} | The company announced`), []);
  assert.equal(joined(`${statement} | Nothing like this appears anywhere`).length, 1);
});

test("array limits above Gemini's 30 are left to Zod", () => {
  const items = responseSchema(verificationSchema).properties.checked_claims;
  assert.equal(items.maxItems, undefined);
  assert.equal(items.minItems, 3);
});

test("each configurable warning keeps its message and becomes a DraftCheckError only when strict", () => {
  const r = research([official.url, outletA.url], { primary_source_url: official.url });
  const dropped = structuredClone(r);
  dropped.claims[0].evidence[0].quote = "Nothing here resembles any of the words in the collected statement.";
  const uncovered = structuredClone(r);
  uncovered.claims[0].source_urls = [outletA.url];
  const scenarios = {
    research_quotes_missing: (keys) => checkResearch(dropped, [official, outletA], keys).warnings,
    sensitive_second_source: (keys) =>
      checkResearch(research([official.url], { sensitive: true, primary_source_url: official.url }), [official], keys)
        .warnings,
    single_unofficial_source: (keys) => checkResearch(research([outletA.url]), [outletA], keys).warnings,
    unresolved_claims: (keys) =>
      checkResearch({ ...r, unresolved: ["Launch date"] }, [official, outletA], keys).warnings,
    uncollected_citations: (keys) =>
      checkDraft(draft(["https://unknown.test/"]), r, [official, outletA], [], "en", keys).warnings,
    official_source_not_cited: (keys) =>
      checkDraft(draft([outletA.url]), r, [official, outletA], [], "en", keys).warnings,
    research_not_cited: (keys) =>
      checkDraft(draft([official.url]), uncovered, [official, outletA], [], "en", keys).warnings,
    verification_failed: (keys) => checkVerification({ passed: false, issues: [], checked_claims: [] }, keys),
    verification_issues: (keys) =>
      checkVerification({ passed: true, issues: ["Wrong date"], checked_claims: [] }, keys),
    unsupported_claims: (keys) =>
      checkVerification(
        { passed: true, issues: [], checked_claims: [{ claim: "Launch in May", supported: false }] },
        keys,
      ),
  };
  assert.deepEqual(Object.keys(scenarios).sort(), DRAFT_CHECKS.map(({ key }) => key).sort());
  for (const [key, run] of Object.entries(scenarios)) {
    const warnings = run([]);
    assert.ok(warnings.length, key);
    assert.throws(
      () => run([key]),
      (error) => error instanceof DraftCheckError && warnings.includes(error.message),
      key,
    );
  }
});

test("strict check validation and SQL allow exactly the advertised stable keys", () => {
  const sql = readFileSync(new URL("../supabase/migrations/40_strict_draft_checks.sql", import.meta.url), "utf8");
  const keys = DRAFT_CHECKS.map(({ key }) => key);
  assert.deepEqual(strictDraftChecksSchema.parse({ strict_draft_checks: keys }).strict_draft_checks, keys);
  assert.equal(strictDraftChecksSchema.safeParse({ strict_draft_checks: ["unknown"] }).success, false);
  for (const key of keys) assert.ok(sql.includes(`'${key}'`));
});

test("Arabic niche category names require an explicit ASCII slug and integer order", () => {
  const input = { language: "ar", name: "أخبار", slug: "news", description: "", sort_order: "2" };
  assert.equal(nicheCategorySchema.parse(input).sort_order, 2);
  assert.equal(nicheCategorySchema.parse(input).archived, false);
  assert.equal(nicheCategorySchema.safeParse({ ...input, slug: "أخبار" }).success, false);
  assert.equal(nicheCategorySchema.safeParse({ ...input, slug: "" }).success, false);
  assert.equal(nicheCategorySchema.safeParse({ ...input, sort_order: "1.5" }).success, false);
});

test("figures missing from every source become one reviewer warning", () => {
  const page = {
    ...official,
    text: "The route calls at Shanghai, Ningbo and Mombasa. Around 8.5 million passengers used the station in 2025, and 1,000 speakers attended. COP28 followed.",
  };
  const article = {
    title: "Seven ports on the new route",
    excerpt: "About 8.5 million passengers used the station.",
    body: "More than 1000 speakers and 33 million viewers in 2025, on 4 November, at COP28 with ١٠٠٠ guests and 12 new berths.",
  };
  assert.deepEqual(unsourcedFigures(article, [page]), ["33", "12"]);
  const figureWarnings = (value) => textWarnings(value, [page]).filter((warning) => warning.startsWith("Figures"));
  assert.deepEqual(figureWarnings(article), ["Figures not found in the sources (check each one): 33, 12"]);
  assert.deepEqual(figureWarnings({ title: "A", excerpt: "", body: "In 2025, 8.5 million." }), []);
});

test("checkDraft makes the slug URL-safe, falling back to the focus keyword", () => {
  const slugFor = (fields) =>
    checkDraft({ ...draft([official.url]), ...fields }, research([official.url]), [official], [], "en").draft.slug;
  assert.equal(slugFor({ slug: "UAE & Bavaria: Trade—2026!" }), "uae-bavaria-trade-2026");
  assert.equal(slugFor({ slug: "الإمارات", focus_keyword: "UAE trade" }), "uae-trade");
  assert.equal(slugFor({ slug: "الإمارات", focus_keyword: "" }), null);
});

test("checkDraft warns about figures the sources do not contain", () => {
  const article = draft([official.url]);
  article.body += " The route will add 450 weekly flights.";
  const checked = checkDraft(
    article,
    research([official.url], { primary_source_url: official.url }),
    [official],
    [],
    "en",
  );
  assert.ok(checked.warnings.some((warning) => warning.includes("450")));
});

test("niches sort by source count; website categories keep their manual order", async () => {
  const { categoryList, nicheList } = await import("@/lib/list-configs");
  assert.deepEqual(
    [nicheList.defaultSort, nicheList.defaultDirection, nicheList.sorts.sources],
    ["sources", "desc", "source_count"],
  );
  assert.equal(nicheList.sorts.order, undefined);
  assert.deepEqual([categoryList.defaultSort, categoryList.sorts.order], ["order", "sort_order"]);
});

test("short drafts report their length, and a copy left after the rewrites becomes a warning", () => {
  const short = { ...draft([official.url]), body: "word ".repeat(150) };
  assert.throws(
    () => checkDraft(short, research([official.url]), [official], [], "en"),
    (error) => error instanceof ShortDraftError && error.words === 150,
  );
  const phrase = "Officials confirmed that the new regional service will start operating next month";
  const page = { ...official, text: phrase };
  const article = draft([page.url]);
  article.body += ` ${phrase}`;
  const checked = checkDraft(article, research([page.url]), [page], [], "en", [], true);
  assert.ok(checked.warnings.some((warning) => warning.includes(phrase)));
});

test("the AI cites pages by number and jobs keep URLs", () => {
  const pages = [official, outletA];
  const data = JSON.parse(promptData({ website: {}, story: { title: "Route" } }, pages));
  assert.deepEqual(
    data.evidence.map((page) => [page.source, page.url]),
    [
      [1, undefined],
      [2, undefined],
    ],
  );
  assert.ok(!JSON.stringify(responseSchema(verificationSchema)).includes("source_urls"));

  const output = researchOutputSchema.parse({
    angle: "What the new route means for regional travellers",
    claims: [1, 2, 9].map((source) => ({
      claim: statement,
      sources: [source],
      evidence: [{ source, quote: statement }],
    })),
    primary_source: 1,
    sensitive: false,
    needs_corroboration: false,
    unresolved: [],
  });
  const withUrls = researchWithUrls(output, pages);
  assert.equal(withUrls.primary_source_url, official.url);
  assert.deepEqual(withUrls.claims[1].evidence, [{ url: outletA.url, quote: statement }]);
  // An unknown page number is dropped like an uncollected URL.
  assert.equal(checkResearch(withUrls, pages).research.claims.length, 2);
  assert.deepEqual(researchWithNumbers(withUrls, pages).claims[1], {
    claim: statement,
    sources: [2],
    evidence: [{ source: 2, quote: statement }],
  });

  const generated = draftOutputSchema.parse({ ...draft([official.url]), sources: [2, 1] });
  assert.deepEqual(draftWithUrls(generated, pages).source_urls, [outletA.url, official.url]);
});
