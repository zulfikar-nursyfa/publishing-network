import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePick } from "@/lib/images/stock/pick";
import { parseQueries } from "@/lib/images/stock/queries";
import { createShutterstockClient, mapSearchResponse, parseLicenseResponse } from "@/lib/images/stock/shutterstock";
import { chooseStockImage } from "@/lib/images/stock/index";
import { stockImage } from "@/lib/automation/drafting/stock";
import { stockThenAi } from "@/lib/automation/drafting/illustrate";
import { LostLease } from "@/lib/automation/drafting/errors";

test("queries are trimmed, cut and deduplicated", () => {
  assert.deepEqual(parseQueries({ queries: [" Solar Farm Desert ", "solar farm desert", "x".repeat(100)] }), [
    "solar farm desert",
    "x".repeat(80),
  ]);
  assert.throws(() => parseQueries({ queries: [] }));
  assert.throws(() => parseQueries({ queries: ["a", "b", "c", "d"] }));
});

test("search results keep previews, links and numeric ids only", () => {
  const body = {
    search_id: "s-1",
    data: [
      {
        id: "123",
        description: "Port cranes",
        assets: { preview: { url: "https://p.test/123.jpg" }, preview_1000: { url: "https://p.test/123-1000.jpg" } },
      },
      { id: "456", assets: { huge_thumb: { url: "https://p.test/456.jpg" } } },
      { id: "789", assets: {} },
      { id: "../x", assets: { preview: { url: "https://p.test/x.jpg" } } },
    ],
  };
  assert.deepEqual(mapSearchResponse(body), [
    {
      id: "123",
      description: "Port cranes",
      preview: "https://p.test/123.jpg",
      large: "https://p.test/123-1000.jpg",
      url: "https://www.shutterstock.com/image-photo/123",
      searchId: "s-1",
    },
    {
      id: "456",
      description: "",
      preview: "https://p.test/456.jpg",
      large: "https://p.test/456.jpg",
      url: "https://www.shutterstock.com/image-photo/456",
      searchId: "s-1",
    },
  ]);
  assert.deepEqual(mapSearchResponse({}), []);
});

test("search sends basic auth, a user agent and photo filters", async () => {
  let sent;
  const client = createShutterstockClient({
    key: "k",
    secret: "s",
    fetch: async (url, options) => {
      sent = { url: new URL(url), headers: options.headers };
      return { ok: true, json: async () => ({ data: [] }) };
    },
  });
  await client.search("solar farm");
  assert.equal(sent.headers.authorization, `Basic ${Buffer.from("k:s").toString("base64")}`);
  assert.ok(sent.headers["user-agent"]);
  const params = Object.fromEntries(sent.url.searchParams);
  assert.deepEqual(params, {
    query: "solar farm",
    image_type: "photo",
    orientation: "horizontal",
    safe: "true",
    per_page: "15",
  });
  const limited = createShutterstockClient({ key: "k", secret: "s", fetch: async () => ({ ok: false, status: 429 }) });
  await assert.rejects(limited.search("x"), /HTTP 429/);
});

test("the pick returns the numbered candidate or none", () => {
  const candidates = [{ id: "1" }, { id: "2" }];
  assert.deepEqual(parsePick({ choice: 2, reason: "Fits" }, candidates), { image: { id: "2" }, reason: "Fits" });
  assert.deepEqual(parsePick({ choice: 0, reason: "All show logos" }, candidates), {
    image: null,
    reason: "All show logos",
  });
  assert.equal(parsePick({ choice: 5, reason: "x" }, candidates).image, null);
  assert.throws(() => parsePick({ choice: -1, reason: "x" }, candidates));
});

const JPEG = Buffer.from([255, 216, 255, 224, 0, 16]);
const ENV = {
  SHUTTERSTOCK_CONSUMER_KEY: "k",
  SHUTTERSTOCK_CONSUMER_SECRET: "s",
  SHUTTERSTOCK_API_TOKEN: "t",
  SHUTTERSTOCK_SUBSCRIPTION_ID: "sub",
};
const DRAFT = { title: "Port volumes rise", excerpt: "Container traffic grew." };
const ARTICLE = { id: "a1", website_id: "w1" };

/** Mocked Shutterstock: search results 1-3, JPEG previews, licensing and download. */
function shutterstock({ searchStatus = 200, licenseBody } = {}) {
  const calls = [];
  const fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("/images/search")) {
      if (searchStatus !== 200) return { ok: false, status: searchStatus };
      const data = ["1", "2", "3"].map((id) => ({ id, assets: { preview: { url: `https://p.test/${id}.jpg` } } }));
      return { ok: true, json: async () => ({ search_id: "s-9", data }) };
    }
    if (String(url).endsWith("/images/licenses"))
      return {
        ok: true,
        json: async () =>
          licenseBody ?? { data: [{ image_id: "3", license_id: "L7", download: { url: "https://dl.test/3.jpg" } }] },
      };
    return { ok: true, arrayBuffer: async () => JPEG };
  };
  return { fetch, calls };
}

/** Mocked database: website_stock_images reads and inserts, storage uploads. */
function fakeDb(used = []) {
  const inserted = [];
  const query = {
    select: () => query,
    eq: () => query,
    in: async (_column, ids) => ({ data: used.filter((id) => ids.includes(id)).map((image_id) => ({ image_id })) }),
    insert: async (row) => {
      inserted.push(row);
      return { error: null };
    },
  };
  return {
    inserted,
    from: () => query,
    storage: { from: () => ({ upload: async () => ({ error: null }) }) },
  };
}

/** Mocked model: three searches, then a pick that records which photos it was shown. */
function model(choice) {
  const shown = [];
  const generateJson = async (contents) => {
    const parts = contents[0].parts;
    if (parts.length === 1) return { queries: ["port cranes", "container ship", "harbour"] };
    shown.push(...parts.filter((part) => part.text?.startsWith("Photo ")).map((part) => part.text));
    return { choice, reason: "Fits" };
  };
  return { generateJson, shown };
}

test("licensing posts the image, subscription and search id, then downloads the file", async () => {
  const { fetch, calls } = shutterstock();
  const client = createShutterstockClient({ token: "t", subscriptionId: "sub", fetch });
  const result = await client.license({ id: "3", searchId: "s-9" });
  const [license, download] = calls;
  assert.equal(license.options.method, "POST");
  assert.equal(license.options.headers.authorization, "Bearer t");
  assert.ok(license.options.headers["user-agent"]);
  assert.deepEqual(JSON.parse(license.options.body), {
    images: [{ image_id: "3", subscription_id: "sub", size: "medium", search_id: "s-9" }],
  });
  assert.equal(download.url, "https://dl.test/3.jpg");
  assert.equal(download.options.headers.authorization, undefined);
  assert.deepEqual(result, { url: "https://dl.test/3.jpg", licenseId: "L7", bytes: JPEG });
  await assert.rejects(createShutterstockClient({ fetch }).license({ id: "3" }), /SHUTTERSTOCK_API_TOKEN/);
});

test("license responses without a download link are errors", () => {
  assert.throws(() => parseLicenseResponse({ data: [{ image_id: "3", error: "No allotment" }] }, "3"), /No allotment/);
  assert.throws(() => parseLicenseResponse({ data: [] }, "3"), /no download link/);
  assert.throws(() => parseLicenseResponse({ data: [{ image_id: 3, download: { url: "http://x.test" } }] }, "3"));
  assert.deepEqual(parseLicenseResponse({ data: [{ image_id: 3, download: { url: "https://x.test/a" } }] }, "3"), {
    url: "https://x.test/a",
    licenseId: null,
  });
});

test("without search keys or licensing settings no request is made", async () => {
  for (const missing of Object.keys(ENV)) {
    const { fetch, calls } = shutterstock();
    const env = { ...ENV, [missing]: "" };
    const generateJson = async () => assert.fail("model called");
    assert.equal(await stockImage(fakeDb(), ARTICLE, DRAFT, { env, generateJson, fetch }), null);
    assert.equal(calls.length, 0);
  }
});

test("photos the website already used are dropped before the pick, and the chosen one is recorded", async () => {
  const { fetch, calls } = shutterstock();
  const db = fakeDb(["1"]);
  const { generateJson, shown } = model(2);
  const image = await stockImage(db, ARTICLE, DRAFT, { env: ENV, generateJson, fetch });
  assert.deepEqual(shown, ["Photo 1:", "Photo 2:"]);
  assert.ok(!calls.some((call) => call.url === "https://p.test/1.jpg"));
  assert.deepEqual(db.inserted, [{ website_id: "w1", image_id: "3", article_id: "a1" }]);
  assert.equal(image.source_kind, "licensed");
  assert.equal(image.credit, "Shutterstock");
  assert.equal(image.source_url, "https://www.shutterstock.com/image-photo/3");
  assert.match(image.license, /image 3, license L7/);
  assert.match(image.storage_path, /^w1\/a1\/.+\.jpg$/);

  const allUsed = await chooseStockImage(DRAFT, {
    stock: createShutterstockClient({ key: "k", secret: "s", fetch }),
    generateJson,
    usedIds: async () => new Set(["1", "2", "3"]),
    fetch,
  });
  assert.deepEqual(allUsed, { image: null, reason: "All results already used" });
});

test("the AI image is used when no photo fits, on HTTP 429, and when stock is off", async () => {
  const ai = async () => ({ source_kind: "ai_generated" });
  const run = async (generateJson, options) => {
    const { fetch } = shutterstock(options);
    const db = fakeDb();
    const result = await stockThenAi(() => stockImage(db, ARTICLE, DRAFT, { env: ENV, generateJson, fetch }), ai);
    return { ...result, inserted: db.inserted };
  };

  const noneFits = await run(model(0).generateJson);
  assert.deepEqual(noneFits, { image: { source_kind: "ai_generated" }, warnings: [], inserted: [] });

  const limited = await run(model(1).generateJson, { searchStatus: 429 });
  assert.equal(limited.image.source_kind, "ai_generated");
  assert.deepEqual(limited.warnings, ["Stock photo not used: Shutterstock search returned HTTP 429"]);

  const off = await stockThenAi(async () => null, ai);
  assert.deepEqual(off, { image: { source_kind: "ai_generated" }, warnings: [] });

  const both = await stockThenAi(
    async () => assert.fail("pick failed"),
    async () => {
      throw new Error("budget");
    },
  );
  assert.deepEqual(both, {
    image: null,
    warnings: ["Stock photo not used: pick failed", "AI image not generated: budget"],
  });

  await assert.rejects(
    stockThenAi(async () => {
      throw new LostLease("Draft lease lost");
    }, ai),
    LostLease,
  );
});
