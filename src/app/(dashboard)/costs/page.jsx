import Link from "next/link";
import { ListLoading } from "@/components/list-loading";
import { z } from "zod";
import { deleteCostEntry } from "@/app/actions/costs";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { ChevronLeft, ChevronRight, Download, ReceiptText } from "lucide-react";
import { Card, PageHeader, Stat, Table, Td, Th, ButtonLink, FilterTabs, buttonClass } from "@/components/ui";
import { ListToolbar, SortTh, Pagination, ListEmpty } from "@/components/list-controls";
import { ListResults } from "@/components/list-results";
import { requireAdmin } from "@/lib/auth";
import { COST_CATEGORIES, buildCostReport, monthParam, shiftMonth } from "@/lib/cost-report";
import { formatUsd } from "@/lib/costs";
import { allRows, readList, listContext } from "@/lib/lists";
import { listHref, sortRows, uuidFilter, enumFilter } from "@/lib/list-params";
import { createClient } from "@/lib/supabase/server";
import { CostEntryForm } from "./cost-entry-form";

export const metadata = { title: "Costs" };
const columns = [
  ["published", "Published"],
  ["drafted", "Drafted"],
  ["ai", "AI (est.)"],
  ["other", "Entered costs"],
  ["networkShare", "Network share"],
  ["total", "Total"],
  ["perArticle", "Per published article"],
];
export default async function CostsPage({ searchParams }) {
  await requireAdmin();
  const input = await searchParams;
  const month = monthParam(input.month);
  const section = z.enum(["report", "entries"]).catch("report").parse(input.section);
  const config =
    section === "report"
      ? {
          sorts: { name: "name", ...Object.fromEntries(columns.map(([key]) => [key, key])) },
          defaultSort: "name",
          defaultDirection: "asc",
          search: ["name"],
          filters: {},
        }
      : {
          sorts: { created: "created_at", amount: "amount_usd", category: "category" },
          defaultSort: "created",
          search: ["note"],
          filters: {
            website: uuidFilter("Website"),
            category: enumFilter("Category", ["all", ...COST_CATEGORIES.map((item) => item.key)], "category"),
          },
        };
  const db = await createClient();
  const { state, websites } = await listContext(
    db,
    { ...input, month },
    {
      ...config,
      filters: {
        ...config.filters,
        month: { label: "Month", text: true, default: month, hidden: true },
        section: {
          label: "Section",
          options: [{ value: "report" }, { value: "entries" }],
          default: "report",
          hidden: true,
        },
      },
    },
  );
  // Keep the chosen month in every sort/filter/page link, including historical months.
  state.defaults.month = "";
  const [monthCosts, amounts] = await Promise.all([
    allRows(() => db.rpc("website_month_costs", { target_month: `${month}-01` }).order("website_id")),
    allRows(() => db.rpc("month_other_costs", { target_month: `${month}-01` }).order("website_id")),
  ]);
  const report = buildCostReport({ websites, monthCosts, entries: amounts });
  const rows =
    section === "report"
      ? sortRows(
          report.rows.filter((row) => !state.q || row.name.toLowerCase().includes(state.q.toLowerCase())),
          state,
        )
      : [];
  if (section === "report") state.page = Math.min(state.page, Math.max(1, Math.ceil(rows.length / state.size)));
  const entries =
    section === "entries"
      ? await readList(
          () =>
            db.from("cost_entries").select("*, website:websites(name)", { count: "exact" }).eq("month", `${month}-01`),
          state,
        )
      : null;
  const display = (row, key) =>
    ["published", "drafted"].includes(key) ? row[key] : row[key] === null ? "—" : formatUsd(row[key]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Costs"
        description="Monthly estimated AI spend and entered costs. Totals include every row; provider bills remain authoritative."
        actions={
          <>
            <ButtonLink href={`/costs/export?type=costs&month=${month}`} variant="secondary">
              <Download />
              Costs CSV
            </ButtonLink>
            <ButtonLink href={`/costs/export?type=articles&month=${month}`} variant="secondary">
              <Download />
              Articles CSV
            </ButtonLink>
          </>
        }
      />
      <nav aria-label="Month" className="flex items-center gap-1">
        <Link
          href={listHref("/costs", state, { month: shiftMonth(month, -1) })}
          aria-label="Previous month"
          className={buttonClass("secondary", null, "icon")}
        >
          <ChevronLeft />
        </Link>
        <span aria-live="polite" className="min-w-40 text-center text-sm font-semibold">
          {new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
            new Date(`${month}-01T00:00:00Z`),
          )}
          <span className="block text-xs font-normal text-muted-foreground">UTC calendar month</span>
        </span>
        <Link
          href={listHref("/costs", state, { month: shiftMonth(month, 1) })}
          aria-label="Next month"
          className={buttonClass("secondary", null, "icon")}
        >
          <ChevronRight />
        </Link>
      </nav>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
        <Stat label="Total this month" value={formatUsd(report.totals.total)} hint="AI estimate plus entered costs" />
        <Stat
          label="AI (estimated)"
          value={formatUsd(report.totals.ai)}
          hint={`${report.totals.searches} web searches`}
        />
        <Stat
          label="Entered costs"
          value={formatUsd((report.totals.other ?? 0) + (report.totals.networkShare ?? 0))}
          hint="including network share"
        />
        <Stat
          label="Per published article"
          value={report.totals.perArticle === null ? "—" : formatUsd(report.totals.perArticle)}
          hint={`${report.totals.published} published · ${report.totals.drafted} drafted`}
        />
      </div>
      <FilterTabs
        active={section}
        items={["report", "entries"].map((key) => ({ key, label: key, href: `/costs?month=${month}&section=${key}` }))}
      />
      <ListToolbar
        path="/costs"
        state={state}
        websites={websites}
        searchLabel={section === "report" ? "Search websites" : "Search cost notes"}
      />
      {section === "report" ? (
        <ListLoading>
          {!rows.length ? (
            <ListEmpty path="/costs" state={state} title="No websites in this report">
              Add a website or enter a cost below.
            </ListEmpty>
          ) : null}
          <Table>
            <thead>
              <tr>
                <SortTh path="/costs" state={state} column="name">
                  Website
                </SortTh>
                {columns.map(([key, label]) => (
                  <SortTh key={key} path="/costs" state={state} column={key} className="text-right">
                    {label}
                  </SortTh>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice((state.page - 1) * state.size, state.page * state.size).map((row) => (
                <tr key={row.websiteId}>
                  <Td>
                    <Link href={`/websites/${row.websiteId}`} className="font-medium hover:underline">
                      {row.name}
                    </Link>
                    {row.archived ? " (archived)" : ""}
                  </Td>
                  {columns.map(([key]) => (
                    <Td key={key} className="text-right tabular-nums">
                      {display(row, key)}
                    </Td>
                  ))}
                </tr>
              ))}
              <tr className="border-t-2 bg-muted/40 font-semibold">
                <Td>All websites (unfiltered total)</Td>
                {columns.map(([key]) => (
                  <Td key={key} className="text-right tabular-nums">
                    {display(report.totals, key)}
                  </Td>
                ))}
              </tr>
            </tbody>
          </Table>
          <Pagination path="/costs" state={state} count={rows.length} />
          <p className="text-xs text-muted-foreground">
            AI images: {formatUsd(report.totals.aiImages)} · Web searches: {report.totals.searches}
          </p>
        </ListLoading>
      ) : (
        <ListResults
          result={entries}
          path="/costs"
          state={state}
          title="No entered costs this month"
          empty="Add costs using the form below."
        >
          <Table>
            <thead>
              <tr>
                <Th>Website</Th>
                <Th>Category</Th>
                <Th className="text-right">Amount</Th>
                <Th>Note</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {entries.data.map((entry) => (
                <tr key={entry.id}>
                  <Td>{entry.website?.name ?? "Whole network"}</Td>
                  <Td>{entry.category}</Td>
                  <Td className="text-right tabular-nums">{formatUsd(entry.amount_usd)}</Td>
                  <Td className="max-w-md">{entry.note}</Td>
                  <Td>
                    <ActionForm action={deleteCostEntry.bind(null, entry.id)}>
                      <SubmitButton
                        size="sm"
                        variant="danger-outline"
                        confirm="Delete this cost entry?"
                        confirmLabel="Delete"
                      >
                        Delete
                      </SubmitButton>
                    </ActionForm>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </ListResults>
      )}
      <Card
        icon={ReceiptText}
        title="Add a cost"
        description="Images, paid sources, extra hosting, editorial time or other costs. Whole-network charges are split among active websites."
      >
        <CostEntryForm month={month} websites={websites} />
      </Card>
    </div>
  );
}
