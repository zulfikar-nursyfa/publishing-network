import assert from "node:assert/strict";
import test from "node:test";
import { pickCandidates } from "../src/lib/social/candidates.js";
import { oauthHeader } from "../src/lib/social/oauth1.js";
import { redditTitle } from "../src/lib/social/reddit.js";
import { send } from "../src/lib/social/request.js";
import { xText } from "../src/lib/social/x.js";

test("OAuth 1.0a signature matches X's documented example", () => {
  const header = oauthHeader({
    method: "POST",
    url: "https://api.twitter.com/1.1/statuses/update.json?include_entities=true",
    consumerKey: "xvz1evFS4wEEPTGEFPHBog",
    consumerSecret: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw",
    token: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
    tokenSecret: "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE",
    params: { status: "Hello Ladies + Gentlemen, a signed OAuth request!" },
    nonce: "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
    timestamp: 1318622958,
  });
  assert.match(header, /oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D"/);
});

test("X text is the title and link, with long titles shortened", () => {
  assert.equal(xText(" عنوان الخبر ", "https://a.example/x"), "عنوان الخبر\n\nhttps://a.example/x");
  const long = xText("a".repeat(400), "https://a.example/x");
  assert.equal(Array.from(long.split("\n\n")[0]).length, 250);
  assert.ok(long.split("\n\n")[0].endsWith("…"));
  assert.equal(Array.from(redditTitle("b".repeat(400))).length, 300);
});

test("only new or refused articles are posted, oldest first, five per run", () => {
  const articles = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => ({ id }));
  const posts = [
    { article_id: "a", status: "posted", attempt_count: 1 },
    { article_id: "b", status: "unknown", attempt_count: 1 },
    { article_id: "c", status: "posting", attempt_count: 1 },
    { article_id: "d", status: "failed", attempt_count: 3 },
    { article_id: "e", status: "failed", attempt_count: 2 },
  ];
  assert.deepEqual(
    pickCandidates(articles, posts).map(({ article, existing }) => [article.id, existing?.attempt_count ?? 0]),
    [
      ["e", 2],
      ["f", 0],
      ["g", 0],
      ["h", 0],
    ],
  );
});

test("a server error on the posting call is ambiguous, a refusal is not", async (t) => {
  const reply = (status) => t.mock.method(globalThis, "fetch", async () => new Response("no", { status }));
  reply(503);
  await assert.rejects(send("https://x.test", {}, "X post", { posts: true }), { notPosted: false });
  reply(503);
  await assert.rejects(send("https://x.test", {}, "X image upload"), { notPosted: true });
  reply(401);
  await assert.rejects(send("https://x.test", {}, "X post", { posts: true }), {
    notPosted: true,
    accountProblem: true,
  });
});
