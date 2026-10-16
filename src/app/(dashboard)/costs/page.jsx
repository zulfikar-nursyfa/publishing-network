import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Receipt } from "lucide-react";
import { deleteCostEntry } from "@/app/actions/costs";
import { SubmitButton } from "@/components/form-controls";
import { Alert, Card, PageHeader, Table, Td, Th, buttonClass, linkClass } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { COST_CATEGORIES, buildCostReport, monthParam, shiftMonth } from "@/lib/cost-report";
import { formatUsd } from "@/lib/costs";
import { createClient } from "@/lib/supabase/server";
import { CostEntryForm } from "./cost-entry-form";

export const metadata = { title: "Costs" };

const categoryLabel = Object.fromEntries(COST_CATEGORIES.map((category) => [category.key, category.label]));
const monthLabel = (month) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );

export default async function CostsPage({ searchParams }) {
  await requireAdmin();
  const month = monthParam((await searchParams).month);
  const db = await createClient();
  const [{ data: websites }, { data: monthCosts, error }, { data: entries }] = await Promise.all([
    db.from("websites").select("id, name, archived_at").order("name"),
    db.rpc("website_month_costs", { target_month: `${month}-01` }),
    db
      .from("cost_entries")
      .select("id, website_id, category, amount_usd, note, website:websites(name)")
      .eq("month", `${month}-01`)
      .order("created_at"),
  ]);
  const report = error ? null : buildCostReport({ websites: websites ?? [], monthCosts, entries: entries ?? [] });
  const columns = [
    ["Published", (row) => row.published],
    ["Drafted", (row) => row.drafted],
    ["AI (est.)", (row) => formatUsd(row.ai)],
    ["Entered costs", (row) => formatUsd(row.other)],
    ["Network share", (row) => formatUsd(row.networkShare)],
    ["Total", (row) => formatUsd(row.total)],
    ["Per published article", (row) => (row.perArticle === null ? "—" : formatUsd(row.perArticle))],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Costs"
        description="Estimated AI spend plus the other costs entered here, per website and per published article. AI amounts are estimates; provider bills are the real cost. Existing Vercel Pro, Supabase Pro and SiteGround plans are not included."
        actions={
          <div className="flex flex-wrap gap-2">
            <a href={`/costs/export?type=costs&month=${month}`} download className={buttonClass("secondary")}>
              <Download />
              Costs CSV
            </a>
            <a href={`/costs/export?type=articles&month=${month}`} download className={buttonClass("secondary")}>
              <Download />
              Articles CSV
            </a>
          </div>
        }
      />

      <div className="flex items-center gap-2">
        <Link href={`/costs?month=${shiftMonth(month, -1)}`} className={buttonClass("secondary", null, "sm")}>
          <ChevronLeft />
          Previous
        </Link>
        <span className="px-2 text-sm font-medium">{monthLabel(month)} (UTC)</span>
        <Link href={`/costs?month=${shiftMonth(month, 1)}`} className={buttonClass("secondary", null, "sm")}>
          Next
          <ChevronRight />
        </Link>
      </div>

      {!report ? (
        <Alert tone="error">The cost report is unavailable. Apply migration 37_cost_report.sql.</Alert>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Website</Th>
                {columns.map(([label]) => (
                  <Th key={label} className="text-right">
                    {label}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.websiteId}>
                  <Td>
                    <Link href={`/websites/${row.websiteId}`} className={linkClass}>
                      {row.name}
                    </Link>
                    {row.archived ? <span className="ml-1 text-xs text-muted-foreground">(archived)</span> : null}
                  </Td>
                  {columns.map(([label, value]) => (
                    <Td key={label} className="text-right tabular-nums">
                      {value(row)}
                    </Td>
                  ))}
                </tr>
              ))}
              <tr className="font-semibold">
                <Td>All websites</Td>
                {columns.map(([label, value]) => (
                  <Td key={label} className="text-right tabular-nums">
                    {value(report.totals)}
                  </Td>
                ))}
              </tr>
            </tbody>
          </Table>
          <p className="text-xs text-muted-foreground">
            AI images this month: {formatUsd(report.totals.aiImages)} of the AI total. Web searches:{" "}
            {report.totals.searches}. Drafted counts automated articles created this month.
          </p>

          <Card
            icon={Receipt}
            title={`Other costs for ${monthLabel(month)}`}
            description="Charges that are not AI calls: stock images, paid sources, extra hosting, editorial time. Whole-network costs are split evenly across the active websites."
          >
            {entries?.length ? (
              <ul className="mb-6 divide-y rounded-lg border text-sm">
                {entries.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <span className="font-medium tabular-nums">{formatUsd(Number(entry.amount_usd))}</span>
                    <span>{categoryLabel[entry.category]}</span>
                    <span className="text-muted-foreground">{entry.website?.name ?? "Whole network"}</span>
                    {entry.note ? <span className="text-muted-foreground">· {entry.note}</span> : null}
                    <form action={deleteCostEntry.bind(null, entry.id)} className="ml-auto">
                      <SubmitButton
                        variant="danger-outline"
                        size="sm"
                        confirm="Delete this cost?"
                        confirmLabel="Delete"
                      >
                        Delete
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            ) : null}
            <CostEntryForm month={month} websites={(websites ?? []).filter((site) => !site.archived_at)} />
          </Card>
        </>
      )}
    </div>
  );
}
