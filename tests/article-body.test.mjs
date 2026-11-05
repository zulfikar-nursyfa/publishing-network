import assert from "node:assert/strict";
import { test } from "node:test";
import { asBlock, embedUrl, linkUrl } from "@/lib/body-tools";
import { inlineImageIds, toWordPressContent } from "@/lib/publishing/content";
import { publishArticle } from "@/lib/publishing/publish";

const ID = "3f2b8c1e-5d4a-4b6f-9e7d-1a2b3c4d5e6f";

test("plain-text bodies keep editor links and formatting but escape everything else", () => {
  const html = toWordPressContent(
    'Read <a href="https://example.com/a?b=1&c=2">the report</a> & <strong>act</strong>.\n\n<script>x</script> <a href="javascript:x">bad</a>',
    [],
    "en",
  );
  assert.equal(
    html,
    '<p>Read <a href="https://example.com/a?b=1&c=2">the report</a> &amp; <strong>act</strong>.</p>\n' +
      "<p>&lt;script&gt;x&lt;/script&gt; &lt;a href=&quot;javascript:x&quot;&gt;bad</a></p>",
  );
});

test("image lines become figures with caption and credit, in plain text and HTML bodies", () => {
  const image = { src: "https://site.test/a.jpg?x=1&y=2", altText: 'A "quoted" view', caption: "Dubai", credit: "WAM" };
  const figure =
    '<figure class="wp-block-image"><img src="https://site.test/a.jpg?x=1&amp;y=2" alt="A &quot;quoted&quot; view" class="wp-image-9">' +
    "<figcaption>Dubai — Image: WAM</figcaption></figure>";
  const images = { [ID]: { ...image, sourceKind: "owned", wpMediaId: 9 } };
  assert.equal(
    toWordPressContent(`One.\n\n[image:${ID}]\n\nTwo.`, [], "en", null, images),
    `<p>One.</p>\n${figure}\n<p>Two.</p>`,
  );
  assert.equal(
    toWordPressContent(`<p>One.</p>\n[image:${ID.toUpperCase()}]`, [], "en", null, images),
    `<p>One.</p>\n${figure}`,
  );
  assert.equal(toWordPressContent(`One.\n\n[image:${ID}]`, [], "en"), "<p>One.</p>\n");
  assert.deepEqual(inlineImageIds(`[image:${ID}]\n\n[image:${ID}]`), [ID]);
});

test("embed links are normalised for YouTube, X and Instagram only", () => {
  assert.equal(embedUrl("https://youtu.be/dQw4w9WgXcQ?si=abc"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(
    embedUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30"),
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
  assert.equal(embedUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(
    embedUrl("https://x.com/DXBMediaOffice/status/1850000000000000000?s=20"),
    "https://twitter.com/DXBMediaOffice/status/1850000000000000000",
  );
  assert.equal(
    embedUrl("https://www.instagram.com/reel/C9abc_DEF-1/?igsh=xyz"),
    "https://www.instagram.com/reel/C9abc_DEF-1/",
  );
  assert.equal(embedUrl("https://www.instagram.com/dubai/p/C9abc/"), "https://www.instagram.com/p/C9abc/");
  for (const bad of ["https://example.com/video", "javascript:alert(1)", "https://x.com/home", "not a url"])
    assert.equal(embedUrl(bad), null);
});

test("links must be full http(s) addresses and blocks get their own paragraph", () => {
  assert.equal(linkUrl(' https://example.com/a"b '), "https://example.com/a%22b");
  assert.equal(linkUrl("javascript:alert(1)"), null);
  assert.equal(linkUrl("example.com"), null);
  assert.equal(asBlock("First paragraph", "X", " rest"), "\n\nX\n\n");
  assert.equal(asBlock("First\n\n", "X", "\nNext"), "X\n");
  assert.equal(asBlock("", "X", ""), "X");
});

function publishSetup({ body, inlineImages }) {
  const calls = { uploads: 0, marked: [], content: null };
  const context = {
    article: { id: "a", websiteId: "s", status: "approved", title: "Title", body },
    website: { id: "s", language: "en", archived: false },
    sources: [],
    connection: {},
    category: { name: "News", wpTermId: 7 },
    image: null,
    inlineImages,
  };
  const post = { id: 42, status: "publish", link: "https://example.test/post" };
  const store = {
    claim: async () => ({ id: "p", attemptCount: 1, maxAttempts: 5 }),
    loadContext: async () => context,
    loadImageFile: async () => ({ bytes: Buffer.from("x"), contentType: "image/png", filename: "a.png" }),
    markImageUploaded: async (id, mediaId) => calls.marked.push([id, mediaId]),
    markFailed: async () => {},
    markSucceeded: async () => {},
    audit: async () => {},
  };
  const wordpress = {
    findPostByArticleId: async () => null,
    ensureTags: async () => [],
    uploadMedia: async () => {
      calls.uploads++;
      return 77;
    },
    mediaUrl: async (id) => `https://example.test/uploads/${id}.png`,
    createPost: async (fields) => {
      calls.content = fields.content;
      return post;
    },
    getPost: async () => post,
  };
  return { calls, publish: () => publishArticle("a", null, store, () => wordpress) };
}

test("publishing uploads each body image once and points the figure at WordPress", async () => {
  const image = { id: ID, storagePath: "s/a/x.png", wpMediaId: null, altText: "Alt", sourceKind: "owned" };
  const { calls, publish } = publishSetup({ body: `Intro.\n\n[image:${ID}]`, inlineImages: [image] });
  assert.equal((await publish()).outcome, "published");
  assert.equal(calls.uploads, 1);
  assert.deepEqual(calls.marked, [[ID, 77]]);
  assert.match(calls.content, /<img src="https:\/\/example\.test\/uploads\/77\.png" alt="Alt" class="wp-image-77">/);
});

test("a body image that no longer exists stops publishing", async () => {
  const { calls, publish } = publishSetup({ body: `Intro.\n\n[image:${ID}]`, inlineImages: [] });
  const result = await publish();
  assert.equal(result.outcome, "failed");
  assert.match(result.error, /image that no longer exists/);
  assert.equal(calls.content, null);
});
