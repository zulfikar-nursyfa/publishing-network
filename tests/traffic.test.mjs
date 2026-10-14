import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import { fetchAnalyticsDays, fetchSearchDays, googleAccessToken } from "@/lib/traffic/google";
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
