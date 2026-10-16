import { requireAdmin } from "@/lib/auth";
import { buildCostReport, monthParam } from "@/lib/cost-report";
import { toCsv } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";

const round = (value) => (value === null ? null : Number(value.toFixed(4)));

async function costRows(db, month) {
  const [{ data: websites, error }, { data: monthCosts, error: costError }, { data: entries, error: entryError }] =
    await Promise.all([
      db.from("websites").select("id, name, archived_at").order("name"),
      db.rpc("website_month_costs", { target_month: `${month}-01` }),
      db.from("cost_entries").select("website_id, amount_usd").eq("month", `${month}-01`),
    ]);
  const failure = error ?? costError ?? entryError;
  if (failure) throw new Error(failure.message);
  const { rows, totals } = buildCostReport({ websites, monthCosts, entries });
  const columns = [
    { key: "name", label: "Website" },
    { key: "published", label: "Published" },
    { key: "drafted", label: "Drafted" },
    { key: "searches", label: "Web searches" },
    { key: "ai", label: "AI cost estimate (USD)" },
    { key: "aiImages", label: "of which AI images (USD)" },
    { key: "other", label: "Entered costs (USD)" },
    { key: "networkShare", label: "Network share (USD)" },
    { key: "total", label: "Total (USD)" },
    { key: "perArticle", label: "Per published article (USD)" },
  ];
  const data = [...rows, { ...totals, name: "All websites" }].map((row) =>
    Object.fromEntries(columns.map(({ key }) => [key, typeof row[key] === "number" ? round(row[key]) : row[key]])),
  );
  return toCsv(columns, data);
}

async function articleRows(db, month) {
  const rows = [];
  // Read in pages: the API returns at most 1,000 rows per request.
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .rpc("month_article_report", { target_month: `${month}-01` })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return toCsv(
    [
      { key: "website", label: "Website" },
      { key: "title", label: "Title" },
      { key: "status", label: "Status" },
      { key: "origin", label: "Origin" },
      { key: "category", label: "Category" },
      { key: "created_at", label: "Created (UTC)" },
      { key: "published_at", label: "Published (UTC)" },
      { key: "url", label: "URL" },
      { key: "ai_cost_usd", label: "AI cost estimate (USD)" },
      { key: "page_views", label: "Page views (28 days)" },
      { key: "search_clicks", label: "Search clicks (28 days)" },
      { key: "search_impressions", label: "Search impressions (28 days)" },
    ],
    rows,
  );
}

/** CSV download of the monthly cost report (type=costs) or the month's articles (type=articles). */
export async function GET(request) {
  await requireAdmin();
  const params = request.nextUrl.searchParams;
  const type = params.get("type") === "articles" ? "articles" : "costs";
  const month = monthParam(params.get("month"));
  const db = await createClient();
  try {
    const csv = type === "articles" ? await articleRows(db, month) : await costRows(db, month);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${type}-${month}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(`Export failed: ${error.message}`, { status: 500 });
  }
}
