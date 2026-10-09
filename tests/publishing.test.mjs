import assert from "node:assert/strict";
import { test } from "node:test";
import { publishArticle } from "@/lib/publishing/publish";
import { automationBlockReason } from "@/lib/automation/policy";
import { slotsOn } from "@/lib/schedule";

function setup({ status = "approved", existing = null } = {}) {
  const calls = { created: 0, confirmed: 0 };
  const post = { id: 42, status: "publish", link: "https://example.test/post" };
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
    audit: async () => {},
  };
  const wordpress = {
    findPostByArticleId: async () => existing && post,
    createPost: async () => {
      calls.created++;
      return post;
    },
    getPost: async () => post,
    updatePostStatus: async () => post,
  };
  const publish = (options) => publishArticle("a", null, store, () => wordpress, options);
  return { calls, publish };
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

test("a published article without its WordPress post needs a person", async () => {
  assert.equal((await setup({ status: "published" }).publish()).outcome, "failed");
});

test("unapproved articles cannot publish", async () => {
  assert.equal((await setup({ status: "draft" }).publish()).outcome, "failed");
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
