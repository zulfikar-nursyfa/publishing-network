import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseListParams,
  listHref,
  clearListHref,
  escapeLike,
  searchOr,
  dateBounds,
  startOfDay,
  sortRows,
} from "@/lib/list-params";
import { storyList, websiteList, articleList, activityList, jobList } from "@/lib/list-configs";
import { allRows, applyListQuery, readList } from "@/lib/list-query";

const website = "11111111-1111-4111-8111-111111111111";
const state = (params = {}, config = storyList) => parseListParams(params, config);

test("lists default to 25 rows and accept only whitelisted sorts, enums, UUIDs and valid dates", () => {
  const parsed = state({
    page: "-1",
    size: "1000",
    sort: "title.desc;drop table",
    direction: "sideways",
    website: "private",
    source: [website],
    status: "wrong",
    from: "2026-02-30",
    to: "2026-10-19",
    q: ["ambiguous"],
  });
  assert.equal(parsed.page, 1);
  assert.equal(parsed.size, 25);
  assert.equal(parsed.sort, "published");
  assert.equal(parsed.direction, "desc");
  assert.equal(parsed.website, "all");
  assert.equal(parsed.source, "all");
  assert.equal(parsed.status, "new");
  assert.equal(parsed.from, "");
  assert.equal(parsed.to, "2026-10-19");
  assert.equal(parsed.q, "");
  for (const page of ["1.5", "1e2", "Infinity", "1000001"]) assert.equal(state({ page }).page, 1);
  assert.equal(state({ page: "2", size: "50", website }).page, 2);
  assert.equal(state({ from: "2026-10-20", to: "2026-10-19" }).from, "");
  assert.equal(state({ from: "0000-01-01", to: "9999-12-31" }).from, "");
  assert.equal(state({ to: "9999-12-31" }).to, "");
});

test("pagination keeps search, website and status; changing filters or order resets page one", () => {
  const current = state({ page: "3", size: "50", website, status: "selected", q: "شركة & 100%" });
  const next = new URL(listHref("/stories", current, { page: 4 }), "https://local.test");
  assert.equal(next.searchParams.get("page"), "4");
  assert.equal(next.searchParams.get("website"), website);
  assert.equal(next.searchParams.get("q"), "شركة & 100%");
  assert.equal(next.searchParams.get("status"), "selected");
  for (const patch of [
    { status: "skipped" },
    { sort: "discovered" },
    { direction: "asc" },
    { size: 100 },
    { q: "new" },
  ])
    assert.equal(new URL(listHref("/stories", current, patch), "https://local.test").searchParams.has("page"), false);
  assert.equal(new URL(listHref("/stories", state()), "https://local.test").searchParams.get("website"), "all");
});

test("legacy archived links and article status links remain valid", () => {
  assert.equal(state({ archived: "1" }, websiteList).status, "archived");
  assert.equal(state({ archived: "1", status: "active" }, websiteList).status, "active");
  assert.equal(state({ status: "published" }, articleList).status, "published");
  assert.equal(state({ entity: website }, activityList).entity, website);
});

test("search treats wildcards literally and safely quotes PostgREST OR values", () => {
  assert.equal(escapeLike("50%_off\\today"), "50\\%\\_off\\\\today");
  assert.equal(
    searchOr(["name", "domain"], 'hello,world"'),
    'name.ilike."%hello,world\\"%",domain.ilike."%hello,world\\"%"',
  );
  assert.equal(state({ q: "x".repeat(201) }).q, "");
});

test("date presets use local calendar days and an exclusive end", () => {
  const now = new Date("2026-10-19T20:00:00Z");
  assert.deepEqual(dateBounds(state({ period: "today" }), "Asia/Kolkata", now), {
    from: "2026-10-19T18:30:00.000Z",
    to: "2026-10-20T18:30:00.000Z",
  });
  assert.deepEqual(dateBounds(state({ period: "7d" }), "UTC", now), {
    from: "2026-10-13T00:00:00.000Z",
    to: "2026-10-20T00:00:00.000Z",
  });
  assert.deepEqual(dateBounds(state({ period: "30d" }), "UTC", now), {
    from: "2026-09-20T00:00:00.000Z",
    to: "2026-10-20T00:00:00.000Z",
  });
  assert.deepEqual(dateBounds(state({ period: "48h" }), "Africa/Cairo", now), {
    from: "2026-10-17T20:00:00.000Z",
    to: now.toISOString(),
  });
  assert.deepEqual(dateBounds(state({ period: "custom", from: "2026-10-01", to: "2026-10-02" }), "UTC", now), {
    from: "2026-10-01T00:00:00.000Z",
    to: "2026-10-03T00:00:00.000Z",
  });
});

test("local day boundaries handle Cairo's skipped midnight and 25-hour autumn day", () => {
  assert.equal(startOfDay("2026-04-24", "Africa/Cairo"), "2026-04-23T22:00:00.000Z");
  const bounds = dateBounds(state({ period: "custom", from: "2026-10-29", to: "2026-10-29" }), "Africa/Cairo");
  assert.equal((Date.parse(bounds.to) - Date.parse(bounds.from)) / 3600000, 25);
});

function queryRecorder(count = 70) {
  const calls = [];
  const query = new Proxy(
    {},
    {
      get(_target, key) {
        if (key === "then") return (resolve) => resolve({ data: [], count, error: null });
        return (...args) => {
          calls.push([key, ...args]);
          return query;
        };
      },
    },
  );
  return { query, calls };
}

test("draft jobs default to active work and preserve explicit history filters before pagination", async () => {
  const active = state({}, jobList);
  assert.equal(active.status, "active");
  const { query, calls } = queryRecorder();
  await readList(() => query, active);
  assert.ok(
    calls.some(
      (call) =>
        call[0] === "in" &&
        call[1] === "status" &&
        JSON.stringify(call[2]) === JSON.stringify(["queued", "running", "failed"]),
    ),
  );
  assert.ok(calls.findIndex((call) => call[0] === "in") < calls.findIndex((call) => call[0] === "range"));
  for (const status of ["cancelled", "succeeded"]) {
    const history = queryRecorder();
    applyListQuery(history.query, state({ status }, jobList));
    assert.ok(history.calls.some((call) => call[0] === "eq" && call[1] === "status" && call[2] === status));
    assert.equal(
      new URL(listHref("/jobs", state({ status }, jobList)), "https://local.test").searchParams.get("status"),
      status,
    );
  }
  const all = queryRecorder();
  applyListQuery(all.query, state({ status: "all" }, jobList));
  assert.ok(!all.calls.some((call) => call[1] === "status"));
});

test("server queries narrow filters and stable orders; pagination never uses URL column names", async () => {
  const parsed = state({ website, status: "selected", q: "50%_off", sort: "unknown", size: "50", page: "2" });
  const { query, calls } = queryRecorder();
  await readList(() => query, parsed);
  assert.ok(calls.some((call) => call[0] === "ilike" && call[1] === "title" && call[2] === "%50\\%\\_off%"));
  assert.ok(calls.some((call) => call[0] === "eq" && call[1] === "website_id" && call[2] === website));
  assert.ok(calls.some((call) => call[0] === "order" && call[1] === "source_published_at"));
  assert.deepEqual(calls.at(-1), ["range", 50, 99]);
});

test("out-of-range pages clamp to the last page without an empty fake result", async () => {
  const parsed = state({ page: "999" });
  const { query, calls } = queryRecorder(51);
  await readList(() => query, parsed);
  assert.equal(parsed.page, 3);
  assert.deepEqual(calls.at(-1), ["range", 50, 74]);
  const zero = state({ page: "3" });
  await readList(() => queryRecorder(0).query, zero);
  assert.equal(zero.page, 1);
});

test("configuration and aggregate reads page past 1,000 rows and propagate errors", async () => {
  const rows = Array.from({ length: 1205 }, (_, id) => ({ id }));
  const loaded = await allRows(() => ({
    range: async (from, to) => ({ data: rows.slice(from, to + 1), error: null }),
  }));
  assert.equal(loaded.length, 1205);
  assert.equal(loaded.at(-1).id, 1204);
  await assert.rejects(
    () => allRows(() => ({ range: async () => ({ error: { message: "Unavailable" } }) })),
    /Unavailable/,
  );
});

test("computed cost summaries sort numbers numerically and keep nulls last", () => {
  const parsed = state(
    { sort: "cost", direction: "desc" },
    { sorts: { cost: "amount" }, defaultSort: "cost", filters: {} },
  );
  assert.deepEqual(
    sortRows([{ amount: null }, { amount: 2 }, { amount: 100 }], parsed).map((row) => row.amount),
    [100, 2, null],
  );
  const { query, calls } = queryRecorder();
  applyListQuery(query, state({ automatic: "yes" }));
  assert.ok(calls.some((call) => call[0] === "eq" && call[1] === "selected_automatically" && call[2] === true));
});

test("clearing filters preserves list context and clears remembered website", () => {
  const config = {
    ...storyList,
    filters: {
      ...storyList.filters,
      month: { text: true, default: "" },
      type: { text: true, default: "pages" },
      section: { text: true, default: "overview" },
    },
  };
  const current = state(
    { page: "4", website, q: "filter", month: "2026-09", type: "searches", section: "costs" },
    config,
  );
  const url = new URL(clearListHref("/list", current), "https://local.test");
  assert.equal(url.searchParams.get("month"), "2026-09");
  assert.equal(url.searchParams.get("type"), "searches");
  assert.equal(url.searchParams.get("section"), "costs");
  assert.equal(url.searchParams.get("website"), "all");
  assert.equal(url.searchParams.has("q"), false);
  assert.equal(url.searchParams.has("page"), false);
});
