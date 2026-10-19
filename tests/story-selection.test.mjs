import assert from "node:assert/strict";
import { test } from "node:test";
import { normaliseTitle, titleFingerprint, titleSimilarity, sameStory } from "@/lib/automation/titles";
import { scoreStory, selectStories, MAX_STORIES_PER_SOURCE, SELECTION_MAX_AGE_MS } from "@/lib/automation/selection";
import { automationBlockReason } from "@/lib/automation/policy";

const now = Date.parse("2026-10-19T12:00:00Z");
const sources = [
  { id: "official", kind: "government", active: true, url: "https://official.test" },
  { id: "news", kind: "news", active: true, url: "https://news.test" },
  { id: "other", kind: "news", active: true, url: "https://other.test" },
  { id: "disabled", kind: "government", active: false, url: "https://disabled.test" },
];
const story = (id, title, source_id = "news", hours = 1) => ({
  id,
  title,
  source_id,
  status: "new",
  created_at: new Date(now - hours * 3600000).toISOString(),
});
const choose = (candidates, existing = [], limit = 12) => selectStories({ candidates, existing, sources, limit, now });

test("title normalization matches Google News publisher suffixes and punctuation", () => {
  assert.equal(
    normaliseTitle("  Dubai firm ANNOUNCES $5bn expansion! - Reuters"),
    "dubai firm announces 5bn expansion",
  );
  assert.equal(
    titleFingerprint("Dubai firm announces $5bn expansion"),
    titleFingerprint("Dubai firm announces $5bn expansion - Gulf News"),
  );
  assert.equal(normaliseTitle("Dubai company - expansion details - Publisher"), "dubai company expansion details");
  assert.equal(normaliseTitle("Tech-AI business grows"), "tech ai business grows");
});

test("Arabic title normalization removes marks, tatweel and letter variants", () => {
  assert.equal(
    normaliseTitle("أَخْبَار إِقْتِصَادِيَّة: آفاق الشـركة فى دبي - وام"),
    "اخبار اقتصاديه افاق الشركه في دبي",
  );
  assert.equal(
    titleFingerprint("شركة تعلن زيادة الاستثمار في أبوظبي"),
    titleFingerprint("شَرِكَة تعلن زيادة الاستثمار في ابوظبي - وكالة الأنباء"),
  );
});

test("title similarity uses token Jaccard, handles empty and different stories", () => {
  assert.equal(
    titleSimilarity(
      "Dubai company announces regional investment plan",
      "Dubai company announces new regional investment plan",
    ),
    6 / 7,
  );
  assert.equal(titleSimilarity("", ""), 0);
  assert.equal(
    sameStory(
      { title: "Dubai company announces regional investment plan" },
      { title: "Dubai company announces new regional investment plan - Reuters" },
    ),
    true,
  );
  assert.equal(
    sameStory(
      { title: "Oil prices fall on global markets" },
      { title: "Technology company unveils artificial intelligence product" },
    ),
    false,
  );
  assert.equal(
    sameStory(
      { fingerprint: "url", title: "Earlier title" },
      { story_fingerprint: "url", title: "Rewritten headline" },
    ),
    true,
  );
});

test("selection prefers official sources, recent stories and independent reports", () => {
  const old = story("old", "Central bank announces updated lending regulations", "news", 35);
  const recent = story("recent", "Dubai airline launches additional passenger routes", "news");
  const official = story("official", "Ministry releases regional economic growth figures", "official", 10);
  assert.equal(choose([old, recent, official], [], 1)[0].id, "official");
  assert.ok(scoreStory(recent, [recent], sources, now) > scoreStory(old, [old], sources, now));
  const reported = { ...recent, reporting_source_ids: ["news", "other", "other", "disabled"] };
  assert.equal(scoreStory(reported, [reported], sources, now) - scoreStory(recent, [recent], sources, now), 15);
  const sameOutlet = [...sources, { id: "alias", kind: "news", active: true, url: "https://www.news.test" }];
  assert.equal(
    scoreStory({ ...recent, reporting_source_ids: ["alias"] }, [recent], sameOutlet, now),
    scoreStory(recent, [recent], sources, now),
  );
});

test("selection excludes old, future, disabled, skipped and previously unselected automatic picks", () => {
  const candidates = [
    story("old", "Old report", "news", 49),
    story("future", "Future report", "news", -1),
    story("disabled", "Disabled source report", "disabled"),
    { ...story("skipped", "Skipped report"), status: "skipped" },
    { ...story("unselected", "Editor returned automatic pick to new"), selected_automatically: true },
  ];
  assert.deepEqual(choose(candidates), []);
  assert.equal(
    choose([
      { ...story("boundary", "At the time boundary"), created_at: new Date(now - SELECTION_MAX_AGE_MS).toISOString() },
    ]).length,
    1,
  );
});

test("selection skips existing article/job/selected titles and duplicates within its own picks", () => {
  const candidate = story("new", "Dubai company announces regional investment plan");
  const existing = [{ title: "Dubai company announces new regional investment plan - Reuters" }];
  assert.deepEqual(choose([candidate], existing), []);
  assert.deepEqual(
    choose([{ ...candidate, fingerprint: "same" }], [{ story_fingerprint: "same", title: "Changed headline" }]),
    [],
  );
  assert.equal(choose([candidate, { ...candidate, id: "duplicate", source_id: "other" }]).length, 1);
});

test("selection caps stories by outlet and fills remaining slots from other sources", () => {
  const candidates = [
    story("1", "Airline adds passenger routes across Asia"),
    story("2", "Energy prices decline amid weak demand"),
    story("3", "Bank raises interest rates on deposits"),
    story("4", "Software startup launches payment service", "other"),
  ];
  const chosen = choose(candidates);
  assert.equal(chosen.filter((item) => item.source_id === "news").length, MAX_STORIES_PER_SOURCE);
  assert.ok(chosen.some((item) => item.source_id === "other"));
  assert.deepEqual(choose(candidates, [], 0), []);
});

test("automation policy blocks paused, archived, off and exhausted site/network budgets", () => {
  const website = { id: "site", automation_mode: "review", monthly_ai_budget_usd: 10 };
  const network = { monthly_ai_budget_usd: 20 };
  const spend = [{ website_id: "site", estimated_cost_usd: "8", reserved_cost_usd: "2" }];
  assert.match(automationBlockReason(website, network, spend), /Website AI budget/);
  assert.match(
    automationBlockReason({ ...website, monthly_ai_budget_usd: 30 }, { monthly_ai_budget_usd: 10 }, spend),
    /Network AI budget/,
  );
  assert.equal(automationBlockReason(website, network, []), null);
  for (const patch of [{ archived_at: "2026-10-19" }, { automation_paused: true }, { automation_mode: "off" }])
    assert.ok(automationBlockReason({ ...website, ...patch }, network, []));
  assert.match(automationBlockReason(website, { ...network, automation_paused: true }, []), /Network automation/);
});
