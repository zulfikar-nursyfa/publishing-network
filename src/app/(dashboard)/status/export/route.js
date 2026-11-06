import { requireUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { ISSUE_COLUMNS, STATUS_COLUMNS, loadStatusReport } from "@/lib/status-report";
import { createClient } from "@/lib/supabase/server";

/** CSV download of the status report: counts per website (type=counts) or open items (type=issues). */
export async function GET(request) {
  await requireUser();
  const type = request.nextUrl.searchParams.get("type") === "issues" ? "issues" : "counts";
  try {
    const { rows, totals, issues } = await loadStatusReport(await createClient());
    const csv =
      type === "issues"
        ? toCsv(
            ISSUE_COLUMNS,
            issues.map((issue) => ({ ...issue, link: `${request.nextUrl.origin}${issue.path}` })),
          )
        : toCsv([{ key: "name", label: "Website" }, ...STATUS_COLUMNS], [...rows, { ...totals, name: "All websites" }]);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="status-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(`Export failed: ${error.message}`, { status: 500 });
  }
}
