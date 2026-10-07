import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import { collectEvidence, isFetchableUrl, isPublicIPv4, publishedAt, readResearchResponse, robotsAllows } from "@/lib/automation/evidence";

const text = "A publicly available statement about the announcement. ".repeat(10);
const page = (body, headers = {}) => ({ status: 200, headers: { "content-type": "text/html", ...headers }, body });
const robotsMissing = { status: 404, headers: {}, body: "" };
// Fake network: robots.txt plus a map of page URLs to responses.
const fakeRequest = (pages, robots = robotsMissing) => async (url) => url.pathname === "/robots.txt" ? robots : pages[url.href] ?? { status: 404, headers: {}, body: "" };
const sources = [{ id: "src", name: "Official Newsroom", url: "https://news.example.test/", kind: "newsroom", active: true }];

test("only plain HTTPS URLs and public addresses are fetched", () => {
  assert.ok(isFetchableUrl("https://example.test/a"));
  assert.ok(!isFetchableUrl("http://example.test/a"));
  assert.ok(!isFetchableUrl("https://user:pass@example.test/"));
  assert.ok(!isFetchableUrl("https://example.test:8443/"));
  assert.ok(isPublicIPv4("8.8.8.8"));
  for (const address of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "192.168.1.1", "172.16.0.1"]) assert.ok(!isPublicIPv4(address));
});

test("robots.txt: our group wins over *, longest rule wins", () => {
  const robots = "User-agent: *\nDisallow: /\n\nUser-agent: PublishingNetworkBot\nDisallow: /private\nAllow: /private/press";
  assert.ok(robotsAllows(robots, "/news/story"));
  assert.ok(!robotsAllows(robots, "/private/x"));
  assert.ok(robotsAllows(robots, "/private/press/release"));
  assert.ok(!robotsAllows("User-agent: *\nDisallow: /", "/anything"));
  assert.ok(robotsAllows("User-agent: GPTBot\nDisallow: /", "/anything"));
  assert.ok(!robotsAllows("User-agent: *\nDisallow: /*.pdf$", "/file.pdf"));
});

test("publication dates are read from article metadata", () => {
  assert.equal(publishedAt('<meta property="article:published_time" content="2026-10-06T09:00:00Z">'), "2026-10-06T09:00:00.000Z");
  assert.equal(publishedAt('<script type="application/ld+json">{"datePublished":"2026-10-05T10:00:00Z"}</script>'), "2026-10-05T10:00:00.000Z");
  assert.equal(publishedAt('<time datetime="2026-10-04">'), "2026-10-04T00:00:00.000Z");
  assert.equal(publishedAt("<p>no date</p>"), null);
});

test("a configured newsroom page is collected as an official source", async () => {
  const url = "https://news.example.test/release";
  const result = await collectEvidence(url, sources, { requestImpl: fakeRequest({ [url]: page(`<title>Release</title><script>ignore</script><article>${text}</article>`) }) });
  assert.equal(result.primary, true);
  assert.equal(result.publisher, "Official Newsroom");
  assert.ok(!result.text.includes("ignore"));
});

test("any public news page can be read; unknown sites are not official", async () => {
  const url = "https://outlet.example.test/story";
  const result = await collectEvidence(url, sources, { requestImpl: fakeRequest({ [url]: page(`<article>${text}</article>`) }) });
  assert.equal(result.primary, false);
  assert.equal(result.publisher, "outlet.example.test");
});

test("search redirect links are followed to the real page, each hop checked", async () => {
  const redirect = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc";
  const target = "https://outlet.example.test/story";
  const request = fakeRequest({ [redirect]: { status: 302, headers: { location: target }, body: "" }, [target]: page(`<article>${text}</article>`) });
  assert.equal((await collectEvidence(redirect, [], { requestImpl: request })).url, target);
  const toPrivate = fakeRequest({ [redirect]: { status: 302, headers: { location: "http://127.0.0.1/" }, body: "" } });
  await assert.rejects(collectEvidence(redirect, [], { requestImpl: toPrivate }), /Only HTTPS/);
});

test("robots.txt refusals, paywalls and thin pages are skipped", async () => {
  const url = "https://outlet.example.test/story";
  const blocked = { status: 200, headers: {}, body: "User-agent: *\nDisallow: /" };
  await assert.rejects(collectEvidence(url, [], { requestImpl: fakeRequest({ [url]: page(`<article>${text}</article>`) }, blocked) }), /robots\.txt/);
  const paywalled = `<script type="application/ld+json">${JSON.stringify({ "@type": "NewsArticle", isAccessibleForFree: false })}</script><article>${text}</article>`;
  await assert.rejects(collectEvidence(url, [], { requestImpl: fakeRequest({ [url]: page(paywalled) }) }), /Paywalled/);
  await assert.rejects(collectEvidence(url, [], { requestImpl: fakeRequest({ [url]: page("<article>short</article>") }) }), /too little/);
});

test("downloads over 8 MiB are rejected without being treated as retryable", async () => {
  const response = (chunks, headers = {}) => Object.assign(Readable.from(chunks), { statusCode: 200, headers: { "content-type": "text/html", ...headers } });
  const oversize = (error) => !error.retryable && /8 MiB/.test(error.message);
  await assert.rejects(readResearchResponse(response([], { "content-length": String(9 * 1024 * 1024) })), oversize);
  await assert.rejects(readResearchResponse(response(Array.from({ length: 9 }, () => Buffer.alloc(1024 * 1024)))), oversize);
});
