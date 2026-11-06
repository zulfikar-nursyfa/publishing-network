import Link from "next/link";
import { ButtonLink, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatUsd } from "@/lib/costs";
import { createClient } from "@/lib/supabase/server";
import { WEEKLY_METRICS, loadWeeklyReport, shiftWeek, weekChange, weekLabel, weekParam } from "@/lib/weekly-report";

export const metadata = { title: "Weekly report" };

function Value({ metric, values }) {
  const value = values.week[metric.key];
  const change = weekChange(value, values.previous[metric.key]);
  return (
    <Td className="whitespace-nowrap text-right tabular-nums">
      {value === null ? "—" : metric.usd ? formatUsd(value) : value}
      {change ? <span className="block text-xs text-muted-foreground">{change}</span> : null}
    </Td>
  );
}

function Row({ values }) {
  return (
    <>
      {WEEKLY_METRICS.map((metric) => (
        <Value key={metric.key} metric={metric} values={values} />
      ))}
      <Td className="text-right tabular-nums">{values.inReview}</Td>
      <Td className="text-right tabular-nums">{values.failedPublications}</Td>
    </>
  );
}

export default async function WeeklyReportPage({ searchParams }) {
  await requireUser();
  const week = weekParam((await searchParams).week);
  const report = await loadWeeklyReport(await createClient(), week);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly report"
        description="Output, failures, AI cost and traffic for one week (Monday to Sunday, UTC), with the change from the week before."
      />
      <div className="flex flex-wrap items-center gap-3">
        <ButtonLink href={`/weekly?week=${shiftWeek(week, -1)}`} variant="secondary" size="sm">
          Previous week
        </ButtonLink>
        <span className="text-sm font-medium">{weekLabel(week)}</span>
        <ButtonLink href={`/weekly?week=${shiftWeek(week, 1)}`} variant="secondary" size="sm">
          Next week
        </ButtonLink>
      </div>
      {report.rows.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Website</Th>
              {WEEKLY_METRICS.map((metric) => (
                <Th key={metric.key} className="text-right">
                  {metric.label}
                </Th>
              ))}
              <Th className="text-right">In review now</Th>
              <Th className="text-right">Failed publications now</Th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.websiteId}>
                <Td>
                  <Link href={`/websites/${row.websiteId}?section=traffic`} className="font-medium hover:underline">
                    {row.name}
                  </Link>
                </Td>
                <Row values={row} />
              </tr>
            ))}
            <tr className="font-semibold">
              <Td>All websites</Td>
              <Row values={report.totals} />
            </tr>
          </tbody>
        </Table>
      ) : (
        <EmptyState title="No websites yet">Add a website to see its weekly numbers.</EmptyState>
      )}
      <p className="text-xs text-muted-foreground">
        A dash means Google Analytics or Search Console is not connected or has no data for that week. Search Console
        runs 2–3 days behind, so recent search clicks may still rise. Contact clicks start counting once the connector
        plugin 1.3.0 is installed. AI costs are estimates; the provider&apos;s bill is final.
      </p>
    </div>
  );
}
