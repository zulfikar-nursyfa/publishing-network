import assert from "node:assert/strict";
import { test } from "node:test";
import { discoverStories } from "@/lib/automation/discover";
import { queueSelectedStories } from "@/lib/automation/drafting/queue";
import { automationFixture } from "./automation-fixture.mjs";

const source = (id, website_id, kind = "news") => ({
  id,
  website_id,
  kind,
  active: true,
  url: `https://${id}.test`,
  feed_url: `https://${id}.test/feed`,
  websites: { archived_at: null },
});
const candidate = (id, website_id, source_id, title, extra = {}) => ({
  id,
  website_id,
  source_id,
  title,
  fingerprint: id,
  status: "new",
  created_at: new Date().toISOString(),
  ...extra,
});
const fitsAll = async (_db, _website, _network, stories) =>
  new Map(stories.map((story) => [story.id, { fits: true, reason: "On topic" }]));
const fixture = (auto = false) =>
  automationFixture({
    network_settings: [{ automation_paused: false, monthly_ai_budget_usd: null }],
    websites: [
      {
        id: "one",
        archived_at: null,
        automation_mode: "review",
        automation_paused: false,
        auto_select_stories: auto,
        daily_quota: 1,
        monthly_ai_budget_usd: 10,
      },
    ],
    website_ai_spend: [],
    articles: [],
    jobs: [],
    story_candidates: [candidate("a", "one", "news", "Bank increases interest rates for savers")],
    content_sources: [source("news", "one")],
  });

test("discovery suppresses cross-feed titles, recent legacy rows and automated articles per website", async () => {
  const db = fixture();
  db.tables.content_sources = [source("news", "one"), source("official", "one", "government"), source("second", "two")];
  db.tables.story_candidates = [
    candidate("legacy", "one", "news", "Aviation company launches flights to regional airports", {
      title_fingerprint: null,
      reporting_source_ids: [],
    }),
  ];
  db.tables.articles = [
    {
      website_id: "one",
      origin: "automated",
      title: "Major energy supplier announces new oil production targets",
      created_at: new Date().toISOString(),
    },
  ];
  const calls = [];
  const feed = (items) =>
    `<rss><channel>${items.map(([title, url]) => `<item><title>${title}</title><link>${url}</link></item>`).join("")}</channel></rss>`;
  const rows = [
    ["Dubai bank announces regional investment plan - Reuters", "https://news.google.com/rss/articles/redirect-one"],
    [
      "Aviation company launches flights to regional airports - Google Publisher",
      "https://news.google.com/rss/articles/legacy",
    ],
    ["Major energy supplier announces new oil production targets", "https://news.test/already-drafted"],
  ];
  const result = await discoverStories({
    db,
    fetchImpl: async (url) => {
      calls.push(url);
      return new Response(
        feed(
          url.includes("official")
            ? [
                ["Dubai bank announces new regional investment plan", "https://official.test/announcement"],
                ["Dubai bank announces regional investment plan", "https://official.test/another-url"],
              ]
            : rows,
        ),
      );
    },
  });
  assert.equal(result.failed, 0);
  assert.equal(result.newStories, 4); // One on website one; all three belong independently to website two.
  assert.equal(db.tables.story_candidates.filter((row) => row.website_id === "one").length, 2);
  const story = db.tables.story_candidates.find((row) => row.website_id === "one" && row.id !== "legacy");
  assert.deepEqual(story.reporting_source_ids, ["news", "official"]);
  assert.equal(story.title_fingerprint, "dubai bank announces regional investment plan");
  assert.deepEqual([...calls].sort(), db.tables.content_sources.map((row) => row.feed_url).sort());
  assert.equal(
    calls.some((url) => url.includes("news.google.com")),
    false,
  );
});

test("automatic selection is off by default and manual selections still queue", async () => {
  const db = fixture();
  assert.equal(await queueSelectedStories(db, { screen: fitsAll }), 0);
  assert.deepEqual(db.rpcCalls, []);
  db.tables.story_candidates[0].status = "selected";
  assert.equal(await queueSelectedStories(db, { screen: fitsAll }), 1);
  assert.equal(db.rpcCalls[0].name, "queue_story_draft");
});

test("enabled selection fills only the remaining review buffer and reuses the queue RPC", async () => {
  const db = fixture(true);
  db.tables.articles.push({
    website_id: "one",
    origin: "automated",
    status: "in_review",
    title: "Unrelated aviation report",
  });
  assert.equal(await queueSelectedStories(db, { screen: fitsAll }), 1);
  assert.deepEqual(
    db.rpcCalls.map((call) => call.name),
    ["auto_select_stories", "queue_story_draft"],
  );
  assert.equal(db.tables.story_candidates[0].selected_automatically, true);
  assert.equal(await queueSelectedStories(db, { screen: fitsAll }), 0);
});

test("automatic selection leaves existing selected stories first and skips blocked websites", async () => {
  const db = fixture(true);
  db.tables.story_candidates[0].status = "selected";
  db.tables.websites[0].daily_quota = 1;
  db.tables.articles.push({ website_id: "one", origin: "automated", status: "approved", title: "Different report" });
  await queueSelectedStories(db, { screen: fitsAll });
  assert.deepEqual(
    db.rpcCalls.map((call) => call.name),
    ["queue_story_draft"],
  );
  for (const patch of [{ automation_paused: true }, { automation_mode: "off" }, { monthly_ai_budget_usd: 0 }]) {
    const blocked = fixture(true);
    Object.assign(blocked.tables.websites[0], patch);
    assert.equal(await queueSelectedStories(blocked, { screen: fitsAll }), 0);
    assert.deepEqual(blocked.rpcCalls, []);
  }
  const networkPaused = fixture(true);
  networkPaused.tables.network_settings[0].automation_paused = true;
  assert.equal(await queueSelectedStories(networkPaused, { screen: fitsAll }), 0);
});

test("selection checks article history beyond the first database page", async () => {
  const db = fixture(true);
  db.tables.articles = Array.from({ length: 501 }, (_, index) => ({
    website_id: "one",
    id: `article-${index}`,
    title: `Earlier unrelated article ${index}`,
    status: "draft",
    origin: "manual",
  }));
  db.tables.articles[500].title = db.tables.story_candidates[0].title;
  assert.equal(await queueSelectedStories(db, { screen: fitsAll }), 0);
  assert.deepEqual(db.rpcCalls, []);
});

test("with selection off, the existing manually selected queue behavior remains unchanged at budget zero", async () => {
  const db = fixture(false);
  db.tables.websites[0].monthly_ai_budget_usd = 0;
  db.tables.story_candidates[0].status = "selected";
  assert.equal(await queueSelectedStories(db, { screen: fitsAll }), 1);
  assert.deepEqual(
    db.rpcCalls.map((call) => call.name),
    ["queue_story_draft"],
  );
});

test("automatic selection skips off-topic stories with the AI's reason and screens each story once", async () => {
  const db = fixture(true);
  db.tables.story_candidates.push(candidate("oil", "one", "news", "Oil prices rise after prisoner exchange deal"));
  const screened = [];
  const screen = async (_db, _website, _network, stories) => {
    screened.push(...stories.map((story) => story.id));
    return new Map([
      ["a", { fits: true, reason: "Savings rates" }],
      ["oil", { fits: false, reason: "An oil price update, not housing." }],
    ]);
  };
  assert.equal(await queueSelectedStories(db, { screen }), 1);
  const [savings, oil] = db.tables.story_candidates;
  assert.equal(savings.status, "selected");
  assert.equal(oil.status, "skipped");
  assert.equal(oil.skip_reason, "Outside the website's topic: An oil price update, not housing.");
  assert.ok(savings.topic_checked_at && oil.topic_checked_at);
  await queueSelectedStories(db, { screen });
  assert.deepEqual(screened.sort(), ["a", "oil"]);
});

test("a failed screening call selects nothing rather than unscreened stories", async () => {
  const db = fixture(true);
  const failing = async () => {
    throw new Error("Gemini unavailable");
  };
  const error = console.error;
  console.error = () => {};
  try {
    assert.equal(await queueSelectedStories(db, { screen: failing }), 0);
  } finally {
    console.error = error;
  }
  assert.equal(db.tables.story_candidates[0].status, "new");
  assert.equal(db.rpcCalls.length, 0);
});
