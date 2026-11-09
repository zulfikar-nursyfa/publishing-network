import assert from "node:assert/strict";
import { test } from "node:test";
import { draftSchema, researchSchema, verificationSchema } from "@/lib/automation/draft-checks";
import { fitEvidence } from "@/lib/automation/drafting/write";
import { collectEvidence } from "@/lib/automation/evidence";
import {
  addedActions,
  addedCurrencies,
  addedSuperlatives,
  droppedFormat,
  droppedQualifiers,
  aiLeftovers,
  relativeDates,
  scaleMismatches,
  textWarnings,
  unknownNames,
  unsourcedDates,
  unsourcedQuotes,
  wrongWeekdays,
} from "@/lib/automation/text-checks";

const source = (text) => ({ url: "https://news.example.test/a", text });
const body = (text) => ({ title: "Trade report", excerpt: "", body: text });

test("a figure given a different scale than every source is flagged", () => {
  const evidence = [source("Trade reached $15.6 billion. Visitors rose to 2.5m and 40 مليار درهم was invested.")];
  assert.deepEqual(scaleMismatches(body("Trade reached $15.6 million and 2.5 million visitors came."), evidence), [
    "15.6 million (sources: 15.6 billion)",
  ]);
  assert.deepEqual(scaleMismatches(body("استثمار 40 مليار درهم بقيمة 15.6bn، على بعد 5 m"), evidence), []);
});

test("a currency no source uses is flagged as a possible conversion", () => {
  const evidence = [source("The deal is worth AED 3.67 billion, scanned by QR code. Sr. Vice President spoke.")];
  assert.deepEqual(addedCurrencies(body("The deal is worth $1 billion (AED 3.67 billion)."), evidence), ["dollars"]);
  assert.deepEqual(addedCurrencies(body("Dh3.67 billion, paid by QR code in Abu Dhabi."), evidence), []);
  assert.deepEqual(addedCurrencies(body("بقيمة 3.67 مليار ريال"), evidence), ["riyals"]);
});

test("quotations must appear word for word in a source", () => {
  const evidence = [source('He said: "We are proud to open the new station today," at the ceremony.')];
  const article = body(
    'He said, "we are proud to open the new station." Officials called it «a turning point for the region».',
  );
  assert.deepEqual(unsourcedQuotes(article, evidence), ["a turning point for the region"]);
});

test("capitalised words no source uses are flagged, but not sentence starts or titles", () => {
  const evidence = [source("Hypermedia and AMIT Retail signed the contract with the RTA in Dubai on COP28 day.")];
  const article = body(
    "Hypermedia signed with the RTA in Dubai. Meanwhile, Garmin Chief Executive Officer said Emirati firms joined COP28.",
  );
  assert.deepEqual(unknownNames(article, evidence, "en"), ["Garmin", "Emirati"]);
  assert.deepEqual(unknownNames(article, evidence, "ar"), []);
  assert.deepEqual(unknownNames(article, [source("وقعت الهيئة عقدا مع شركة هايبرميديا في دبي")], "en"), []);
});

test("title-case headlines are not read as names, but the body still is", () => {
  const evidence = [source("Hypermedia signed the contract with the RTA in Dubai.")];
  const article = {
    title: "Dubai Expands Tech Ties as Hypermedia Explores Upskilling Launch Across the Region",
    seo_title: "Hypermedia Expands Tech Ties: Upskilling Launch",
    excerpt: "",
    body: "Hypermedia signed with the RTA in Dubai, and Garmin joined.",
  };
  assert.deepEqual(unknownNames(article, evidence, "en"), ["Garmin"]);
});

test("relative dates are flagged in English and Arabic", () => {
  assert.deepEqual(relativeDates(body("Talks ended yesterday and resume next week. Today's figures follow.")), [
    "yesterday",
    "next week",
    "today",
  ]);
  assert.deepEqual(relativeDates(body("انتهت المحادثات أمس وتستأنف الأسبوع المقبل بعد وجبة الغداء.")), [
    "أمس",
    "الأسبوع المقبل",
  ]);
});

test("a weekday that does not match its date is flagged", () => {
  const today = new Date("2026-11-04T00:00:00Z");
  const article = body(
    "On Tuesday, 3 November 2026 and Monday, November 3 the talks began; Wednesday 4 November followed, then Friday, 31 April.",
  );
  assert.deepEqual(wrongWeekdays(article, today), [
    "Friday, 31 April (no such date)",
    "Monday, November 3 (that date is a Tuesday)",
  ]);
  assert.deepEqual(wrongWeekdays(body("عقد الاجتماع يوم الاثنين ٣ نوفمبر ٢٠٢٦ في دبي، والثلاثاء 3 نوفمبر"), today), [
    "الاثنين 3 نوفمبر 2026 (that date is a Tuesday)",
  ]);
});

test("claims of scale must come from a source", () => {
  const evidence = [source("It is the largest port in the region, said the minister.")];
  assert.deepEqual(addedSuperlatives(body("The largest port signed a historic, landmark deal."), evidence), [
    "historic",
    "landmark",
  ]);
  assert.deepEqual(addedSuperlatives(body("وقع المجلس الأعلى اتفاقا تاريخيا"), evidence), ["تاريخي"]);
  assert.deepEqual(addedSuperlatives(body("Dubai is among the top four financial centres."), evidence), [
    "among the top",
  ]);
  const ranked = [source("Dubai ranks among the top four financial centres.")];
  assert.deepEqual(addedSuperlatives(body("Dubai is among the top four financial centres."), ranked), []);
});

test("a capacity, target or estimate written as a result is flagged", () => {
  const evidence = [source("The programme has the capacity to train up to 10,000 learners. About 500 joined in 2025.")];
  assert.deepEqual(
    droppedQualifiers(body("The programme trained 10,000 learners; about 500 joined in 2025."), evidence),
    ['10000 (sources: "capacity")'],
  );
  assert.deepEqual(droppedQualifiers(body("It can train up to 10,000 learners and nearly 500 joined."), evidence), []);
  assert.deepEqual(droppedQualifiers(body("البرنامج درّب 10,000 متعلم"), [source("بقدرة تصل إلى ١٠٠٠٠ متعلم")]), [
    '10000 (sources: "قدرة")',
  ]);
});

test("an online programme described without saying so is flagged", () => {
  const evidence = [source("The academy will offer young people online training sessions across the region.")];
  assert.deepEqual(droppedFormat(body("Young people in Dubai will join the academy's sessions."), evidence), [
    "online training",
  ]);
  assert.deepEqual(droppedFormat(body("The sessions are held online for young people."), evidence), []);
  assert.deepEqual(droppedFormat(body("Sessions run in Dubai."), [source("Remote areas and virtual reality.")]), []);
});

test("outcomes, roles and presence no source states are flagged", () => {
  const evidence = [
    source("The delegation discussed tangible investment opportunities and was briefed on the hospital."),
  ];
  const article = body("The delegation signed deals, toured the hospital and launched direct investment projects.");
  assert.deepEqual(addedActions(article, evidence), ["signed", "deals", "toured", "launched"]);
  const signed = [source("Both sides signed a memorandum and toured the projects they launched.")];
  assert.deepEqual(addedActions(body("They signed an MoU, toured projects and launched a fund."), signed), []);
});

test("a source word with the same meaning supports an action, and is not flagged itself", () => {
  const evidence = [source("TA'ZIZ reached financial close, and the venue helps leaders forge partnerships.")];
  const article = body("TA'ZIZ completed the financial close, and the venue helps leaders establish partnerships.");
  assert.deepEqual(addedActions(article, evidence), []);
  assert.deepEqual(
    addedActions(body("Visitors reached 5 million and the project completed."), [source("Visitors rose.")]),
    ["completed"],
  );
});

test("a currency code written against a figure is not a name and does not hide the figure", () => {
  const evidence = [source("The winner received AED80,000, and TA'ZIZ closed on AED5.1 billion.")];
  const article = body("The winner received AED 80,000, and TA'ZIZ closed on AED 5.1 billion, with AED 90,000 more.");
  assert.deepEqual(textWarnings(article, evidence, { language: "en" }), [
    "Figures not found in the sources (check each one): 90000",
  ]);
});

test("dates no source gives are flagged; ranges in the sources cover every day in them", () => {
  const evidence = [
    {
      ...source("Dubai Future Finance Week runs from 10 to 12 November, with the summit on Nov. 11."),
      published_at: "2026-11-04T08:00:00Z",
    },
  ];
  const article = body("The week runs 10-12 November and the summit on 11 November was announced on 4 November.");
  assert.deepEqual(unsourcedDates(article, evidence), []);
  assert.deepEqual(
    unsourcedDates(body("The summit runs from 9 to 12 November, and from November 11 to 13."), evidence),
    ["9 to 12 November", "November 11 to 13"],
  );
  assert.deepEqual(unsourcedDates(body("تنطلق القمة في 9 نوفمبر"), evidence), ["9 نوفمبر"]);
});

test("wording meant for us, not readers, is flagged", () => {
  const article = body("According to the provided sources, [company name] will invest XX million. The deal is TBD.");
  assert.deepEqual(aiLeftovers(article), ["the provided sources", "[company name]", "XX", "TBD"]);
  assert.deepEqual(aiLeftovers(body("Data from the Abu Dhabi port [ADNOC] was released in Q3.")), []);
});

test("text warnings are short, titled and include the SEO fields", () => {
  const evidence = [source("Trade grew to AED 10 billion in 2025, officials said on Monday in Dubai.")];
  const article = {
    ...body("Trade grew to AED 10 billion in 2025, officials said in Dubai."),
    seo_title: "Trade hits 12",
  };
  assert.deepEqual(textWarnings(article, evidence, { language: "en" }), [
    "Figures not found in the sources (check each one): 12",
  ]);
});

test("long evidence is cut to fit the prompt: short pages stay whole, long ones share the rest", () => {
  const pages = [5, 50, 100].map((length) => source("x".repeat(length)));
  assert.deepEqual(
    fitEvidence(pages, 95).map((page) => page.text.length),
    [5, 45, 45],
  );
  assert.equal(fitEvidence(pages, 1000)[2], pages[2]);
});

test("over-long AI notes are cut instead of failing the job, and slugs are made URL-safe", () => {
  const long = "x".repeat(900);
  const verification = verificationSchema.parse({
    passed: true,
    sensitive: false,
    issues: [long],
    checked_claims: [1, 2, 3].map(() => ({ claim: long, supported: true, source_urls: ["https://a.example.test/"] })),
  });
  assert.equal(verification.issues[0].length, 600);
  assert.equal(verification.checked_claims[0].claim.length, 700);
  const claim = {
    claim: long,
    source_urls: ["https://a.example.test/"],
    evidence: [{ url: "https://a.example.test/", quote: long }],
  };
  const research = researchSchema.parse({
    angle: long,
    claims: [claim, claim, claim],
    primary_source_url: null,
    sensitive: false,
    needs_corroboration: false,
    unresolved: [long],
  });
  assert.equal(research.claims[0].evidence[0].quote.length, 500);
  assert.equal(draftSchema.shape.slug.parse("الإمارات"), "الإمارات");
});

test("the article with most text is read, not a teaser card, and asides are dropped", async () => {
  const story = "The port authority signed a new agreement covering seven terminals and three new berths. ".repeat(6);
  const html = `<html><article><a>Related: other story</a></article><article>${story}<aside>Read more: an unrelated record deal</aside></article></html>`;
  const page = await collectEvidence("https://outlet.example.test/story", [], {
    requestImpl: async (url) =>
      url.pathname === "/robots.txt"
        ? { status: 404, headers: {}, body: "" }
        : { status: 200, headers: { "content-type": "text/html" }, body: html },
  });
  assert.ok(page.text.startsWith("The port authority"));
  assert.ok(!page.text.includes("unrelated"));
});
