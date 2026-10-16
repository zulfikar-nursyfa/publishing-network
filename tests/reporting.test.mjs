import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCostReport, monthParam, shiftMonth } from "@/lib/cost-report";
import { toCsv } from "@/lib/csv";

test("network costs are shared across active websites", () => {
  const { rows, totals } = buildCostReport({
    websites: [
      { id: "a", name: "A", archived_at: null },
      { id: "b", name: "B", archived_at: null },
      { id: "c", name: "C", archived_at: "2026-09-01" },
    ],
    monthCosts: [{ website_id: "a", ai_cost_usd: "3", image_cost_usd: "1", searches: 10, drafted: 4, published: 2 }],
    entries: [
      { website_id: null, amount_usd: "10" },
      { website_id: "a", amount_usd: "1" },
    ],
  });
  assert.deepEqual(
    rows.map((row) => [row.name, row.total, row.perArticle]),
    [
      ["A", 9, 4.5],
      ["B", 5, null],
    ],
  );
  assert.equal(totals.total, 14);
  assert.equal(totals.perArticle, 7);
});

test("months come from the query string or the current UTC month", () => {
  assert.equal(monthParam("2026-10"), "2026-10");
  assert.equal(monthParam("2026-13", new Date("2026-10-17T00:00:00Z")), "2026-10");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
});

test("CSV escapes quotes, commas and spreadsheet formulas", () => {
  const csv = toCsv(
    [
      { key: "title", label: "Title" },
      { key: "cost", label: "Cost" },
    ],
    [
      { title: 'Gulf "IPO", 2026', cost: -1.5 },
      { title: "=HYPERLINK(1)", cost: null },
    ],
  );
  assert.equal(csv, '\uFEFFTitle,Cost\r\n"Gulf ""IPO"", 2026",-1.5\r\n\'=HYPERLINK(1),\r\n');
});
