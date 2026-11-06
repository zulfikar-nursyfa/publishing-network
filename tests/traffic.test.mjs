import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import {
  fetchAnalyticsDays,
  fetchAnalyticsSources,
  fetchContactClicks,
  fetchSearchDays,
  googleAccessToken,
} from "@/lib/traffic/google";
import { contactTotals, fetchTopLists, pagePath } from "@/lib/traffic/top";
import { trafficTotals } from "@/lib/traffic/totals";

const reply =
  (json, status = 200) =>
  async () => ({ ok: status < 400, status, json: async () => json });

test("the service account key signs a JWT and gets a token", async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  let body;
  const token = await googleAccessToken(
    {
      client_email: "pn@project.iam.gserviceaccount.com",
      private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
    },
    async (_url, init) => {
      body = init.body;
      return { ok: true, status: 200, json: async () => ({ access_token: "token" }) };
    },
  );
  assert.equal(token, "token");
  assert.equal(body.get("assertion").split(".").length, 3);
});

test("GA4 and Search Console rows become daily numbers", async () => {
  const analytics = await fetchAnalyticsDays(
    "t",
    "123456",
    "2026-10-01",
    "2026-10-02",
    reply({
      rows: [
        { dimensionValues: [{ value: "20261001" }], metricValues: [{ value: "10" }, { value: "12" }, { value: "30" }] },
      ],
    }),
  );
  assert.deepEqual(analytics, [{ day: "2026-10-01", users: 10, sessions: 12, page_views: 30 }]);
  const search = await fetchSearchDays(
    "t",
    "sc-domain:example.com",
    "2026-10-01",
    "2026-10-02",
    reply({
      rows: [{ keys: ["2026-10-01"], clicks: 3, impressions: 100, ctr: 0.03, position: 12.345 }],
    }),
  );
  assert.deepEqual(search, [{ day: "2026-10-01", clicks: 3, impressions: 100, ctr: 0.03, position: 12.35 }]);
  await assert.rejects(
    fetchSearchDays("t", "sc-domain:x.com", "a", "b", reply({ error: { message: "No access" } }, 403)),
    /No access/,
  );
});

test("average position is weighted by impressions", () => {
  const totals = trafficTotals([
    { clicks: 1, impressions: 100, position: 10 },
    { clicks: 1, impressions: 300, position: 2 },
  ]);
  assert.equal(totals.position, 4);
  assert.equal(totals.ctr, 0.005);
});

test("page paths from GA4, Search Console and WordPress match", () => {
  assert.equal(pagePath("https://www.example.com/%D8%A7%D9%82%D8%AA%D8%B5%D8%A7%D8%AF/?utm=x#top"), "/اقتصاد/");
  assert.equal(pagePath("/اقتصاد"), "/اقتصاد/");
  assert.equal(pagePath("/bad%E0%A4%A/"), "/bad%E0%A4%A/");
});

test("top pages merge GA4 and Search Console rows by path", async () => {
  const fake = async (url, init) => {
    const body = JSON.parse(init.body);
    const json = url.includes("analyticsdata")
      ? { rows: [{ dimensionValues: [{ value: "/story/" }], metricValues: [{ value: "5" }, { value: "9" }] }] }
      : {
          rows: {
            page: [
              { keys: ["https://example.com/story/"], clicks: 2, impressions: 100, ctr: 0.02, position: 10 },
              { keys: ["https://www.example.com/story/?a=1"], clicks: 2, impressions: 300, ctr: 0.0067, position: 2 },
            ],
            query: [{ keys: ["gcc ipo"], clicks: 4, impressions: 50, ctr: 0.08, position: 3 }],
            "page,query": [
              { keys: ["https://example.com/story/", "gcc ipo"], clicks: 4, impressions: 50, ctr: 0.08, position: 3 },
            ],
          }[body.dimensions.join(",")],
        };
    return { ok: true, status: 200, json: async () => json };
  };
  const { pages, queries } = await fetchTopLists(
    "t",
    { ga4_property_id: "123456", search_console_site: "sc-domain:example.com" },
    "2026-10-01",
    "2026-10-28",
    fake,
  );
  assert.deepEqual(pages, [
    { path: "/story/", users: 5, page_views: 9, clicks: 4, impressions: 400, ctr: 0.01, position: 4 },
  ]);
  assert.deepEqual(
    queries.map((row) => [row.path, row.query, row.clicks]),
    [
      ["", "gcc ipo", 4],
      ["/story/", "gcc ipo", 4],
    ],
  );
});

test("GA4 sources and contact-click events are read and totalled", async () => {
  let filter;
  const contacts = await fetchContactClicks("t", "123456", "2026-10-01", "2026-10-28", async (_url, init) => {
    filter = JSON.parse(init.body).dimensionFilter.filter.inListFilter.values;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        rows: [
          ["20261001", "/story/", "contact_phone", "2"],
          ["20261001", "/story?a=1", "contact_whatsapp", "1"],
          ["20261002", "/story/", "contact_phone", "3"],
        ].map(([date, path, event, count]) => ({
          dimensionValues: [{ value: date }, { value: path }, { value: event }],
          metricValues: [{ value: count }],
        })),
      }),
    };
  });
  assert.deepEqual(filter, ["contact_phone", "contact_email", "contact_whatsapp"]);
  const totals = contactTotals(contacts);
  assert.deepEqual(totals.pages, [
    { path: "/story/", channel: "phone", clicks: 5 },
    { path: "/story/", channel: "whatsapp", clicks: 1 },
  ]);
  assert.deepEqual(
    [...totals.days],
    [
      ["2026-10-01", 3],
      ["2026-10-02", 3],
    ],
  );

  const sources = await fetchAnalyticsSources(
    "t",
    "123456",
    "2026-10-01",
    "2026-10-28",
    reply({
      rows: [
        {
          dimensionValues: [{ value: "Organic Search" }, { value: "google" }],
          metricValues: [{ value: "40" }, { value: "30" }],
        },
      ],
    }),
  );
  assert.deepEqual(sources, [{ channel: "Organic Search", source: "google", sessions: 40, users: 30 }]);
});
