import assert from "node:assert/strict";
import { test } from "node:test";
import { publishArticle } from "@/lib/publishing/publish";
import { unpublishArticle } from "@/lib/publishing/unpublish";
import { checkLivePost } from "@/lib/publishing/live-check";
import { automationBlockReason } from "@/lib/automation/policy";
import { reviewReasons } from "@/lib/automation/auto-publish";
import { slotsOn } from "@/lib/schedule";

function setup({ status = "approved", existing = null, postStatus = "publish" } = {}) {
  const calls = { created: 0, updated: 0, confirmed: 0, unpublished: 0 };
  const post = { id: 42, status: postStatus, link: "https://example.test/post" };
  const context = {
    article: { id: "a", websiteId: "s", status, title: "Title", body: "Body" },
    website: { id: "s", language: "en", archived: false },
    sources: [],
    connection: {},
  };
  const store = {
    claim: async () => ({ id: "p", attemptCount: 1, maxAttempts: 5 }),
    loadContext: async () => context,
    markFailed: async () => {},
    markSucceeded: async () => {
      calls.confirmed++;
    },
    markUnpublished: async () => {
      calls.unpublished++;
      return true;
    },
    audit: async () => {},
  };
  const wordpress = {
    findPostByArticleId: async () => existing && post,
    ensureTags: async () => [],
    createPost: async () => {
      calls.created++;
      return post;
    },
    updatePost: async () => {
      calls.updated++;
      return { ...post, status: "publish" };
    },
    getPost: async () => ({ ...post, status: "publish" }),
    updatePostStatus: async (_id, next) => ({ ...post, status: next }),
  };
  const publish = (options) => publishArticle("a", null, store, () => wordpress, options);
  const unpublish = () => unpublishArticle("a", null, null, store, () => wordpress);
  return { calls, publish, unpublish };
}

test("automatic publishing stops when beforeWrite blocks it", async () => {
  const { calls, publish } = setup();
  assert.equal((await publish({ beforeWrite: async () => "Paused" })).outcome, "failed");
  assert.equal(calls.created, 0);
});

test("manual publishing ignores automation controls", async () => {
  const { calls, publish } = setup();
  assert.equal((await publish()).outcome, "published");
  assert.equal(calls.created, 1);
});

test("an existing WordPress post is reconciled, never duplicated", async () => {
  const { calls, publish } = setup({ existing: true });
  assert.equal((await publish({ beforeWrite: () => "Slot expired" })).outcome, "published");
  assert.equal(calls.created, 0);
});

test("republishing after unpublish sends the approved content into the draft", async () => {
  const { calls, publish } = setup({ existing: true, postStatus: "draft" });
  assert.equal((await publish()).outcome, "published");
  assert.deepEqual([calls.created, calls.updated], [0, 1]);
});

test("unpublishing turns the post into a draft and records it", async () => {
  const { calls, unpublish } = setup({ status: "published", existing: true });
  assert.equal((await unpublish()).outcome, "unpublished");
  assert.equal(calls.unpublished, 1);
  assert.equal((await setup({ status: "approved" }).unpublish()).outcome, "failed");
});

test("a published article without its WordPress post needs a person", async () => {
  assert.equal((await setup({ status: "published" }).publish()).outcome, "failed");
});

test("unapproved articles cannot publish", async () => {
  assert.equal((await setup({ status: "draft" }).publish()).outcome, "failed");
});

test("the live check reports noindex, error pages and a foreign canonical", async () => {
  const page =
    (html, status = 200) =>
    async () => ({
      ok: status < 400,
      status,
      url: "https://site.test/post/",
      headers: new Headers(),
      text: async () => html,
    });
  assert.equal(
    (await checkLivePost("https://site.test/post/", page('<link rel="canonical" href="https://site.test/post" />'))).ok,
    true,
  );
  const noindex = await checkLivePost(
    "https://site.test/post/",
    page("<meta name='robots' content='noindex, nofollow' />"),
  );
  assert.match(noindex.problems[0], /noindex/);
  assert.equal((await checkLivePost("https://site.test/post/", page("", 404))).ok, false);
  const moved = await checkLivePost(
    "https://site.test/post/",
    page('<link rel="canonical" href="https://other.test/x" />'),
  );
  assert.match(moved.problems[0], /canonical/);
});

test("automated articles skip review only when every condition holds", () => {
  const clean = {
    draft: { sensitive: false },
    research: { corroboration: { met: true } },
    verification: { passed: true },
    warnings: [],
  };
  const allowed = { website: { automation_mode: "automatic" }, category: { auto_publish_allowed: true }, state: clean };
  assert.deepEqual(reviewReasons(allowed), []);
  assert.equal(reviewReasons({ ...allowed, website: { automation_mode: "review" } }).length, 1);
  assert.equal(reviewReasons({ ...allowed, category: null }).length, 1);
  assert.equal(reviewReasons({ ...allowed, state: { ...clean, draft: { sensitive: true } } }).length, 1);
  assert.equal(reviewReasons({ ...allowed, state: { ...clean, warnings: ["Unsupported claim"] } }).length, 1);
  assert.equal(reviewReasons({ ...allowed, state: {} }).length, 2);
});

test("Cairo slots follow daylight saving", () => {
  assert.equal(slotsOn("2026-01-01", ["08:00"], "Africa/Cairo")[0].toISOString(), "2026-01-01T06:00:00.000Z");
  assert.equal(slotsOn("2026-07-01", ["08:00"], "Africa/Cairo")[0].toISOString(), "2026-07-01T05:00:00.000Z");
});

test("automation controls fail closed", () => {
  const site = { automation_mode: "review" };
  assert.equal(automationBlockReason(site, { automation_paused: false }), null);
  assert.equal(automationBlockReason(site, { automation_paused: true }), "Network automation is paused");
  assert.equal(automationBlockReason({ automation_mode: "off" }, {}), "Website automation is off");
  assert.ok(automationBlockReason(site, null));
});
