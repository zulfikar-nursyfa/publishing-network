import assert from "node:assert/strict";
import test from "node:test";
import { createWordPressClient } from "../src/lib/wordpress/client.js";

test("network errors include the underlying cause", async () => {
  const cause = Object.assign(new Error("getaddrinfo ENOTFOUND wp.example"), { code: "ENOTFOUND" });
  const client = createWordPressClient(
    { baseUrl: "https://wp.example", username: "u", appPassword: "p" },
    { fetch: async () => Promise.reject(new TypeError("fetch failed", { cause })) },
  );
  await assert.rejects(client.getStatus(), {
    message: "Could not reach WordPress: fetch failed (ENOTFOUND: getaddrinfo ENOTFOUND wp.example)",
  });
});

test("a copied article's original date is sent as UTC", async () => {
  const sent = [];
  const client = createWordPressClient(
    { baseUrl: "https://wp.example", username: "u", appPassword: "p" },
    {
      fetch: async (_url, init) => {
        sent.push(JSON.parse(init.body));
        return new Response(JSON.stringify({ id: 1, status: "publish", link: "https://wp.example/p", slug: "p" }));
      },
    },
  );
  await client.createPost({
    articleId: "a",
    title: "T",
    content: "C",
    status: "publish",
    date: "2024-03-05T12:00:00+02:00",
  });
  await client.createPost({ articleId: "a", title: "T", content: "C", status: "publish" });
  assert.deepEqual(
    sent.map((body) => body.date_gmt),
    ["2024-03-05T10:00:00", undefined],
  );
});

test("finding a post refuses posts that are not marked with the article", async () => {
  const respond = (posts) =>
    createWordPressClient(
      { baseUrl: "https://wp.example", username: "u", appPassword: "p" },
      { fetch: async () => new Response(JSON.stringify(posts)) },
    );
  const marked = { id: 7, status: "publish", link: "l", slug: "s", meta: { pn_article_id: "a" } };
  assert.deepEqual(await respond([marked]).findPostByArticleId("a"), {
    id: 7,
    status: "publish",
    link: "l",
    slug: "s",
  });
  assert.equal(await respond([]).findPostByArticleId("a"), null);
  // Connector inactive: WordPress ignores the filter and returns the latest posts.
  await assert.rejects(respond([{ id: 9, status: "publish", meta: {} }]).findPostByArticleId("a"), {
    name: "WordPressError",
    retryable: true,
  });
});
