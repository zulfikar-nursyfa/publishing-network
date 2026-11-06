import Link from "next/link";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { RelativeTime } from "@/components/relative-time";
import { requireUser } from "@/lib/auth";
import { ISSUE_TYPES, STATUS_COLUMNS, loadStatusReport } from "@/lib/status-report";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Status report" };

// shortcut: the page lists the first 200 open items; the CSV has all of them.
const SHOWN_ISSUES = 200;
const PROBLEMS = new Set(ISSUE_TYPES.slice(0, 4));

function Counts({ values }) {
  return STATUS_COLUMNS.map(({ key }) => (
    <Td key={key} className="text-right tabular-nums">
      {values[key]}
    </Td>
  ));
}

export default async function StatusReportPage() {
  await requireUser();
  const { rows, totals, issues } = await loadStatusReport(await createClient());
  const byType = ISSUE_TYPES.map((type) => [type, issues.filter((issue) => issue.type === type).length]).filter(
    ([, count]) => count,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Status report"
        description="Articles by status, automated and manual publishing, and everything that is failing or waiting, as of now."
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/status/export?type=counts" variant="secondary">
              Export counts
            </ButtonLink>
            <ButtonLink href="/status/export?type=issues" variant="secondary">
              Export open items
            </ButtonLink>
          </div>
        }
      />
      {rows.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Website</Th>
              {STATUS_COLUMNS.map(({ key, label }) => (
                <Th key={key} className="text-right">
                  {label}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.websiteId}>
                <Td>
                  <Link href={`/websites/${row.websiteId}`} className="font-medium hover:underline">
                    {row.name}
                  </Link>
                </Td>
                <Counts values={row} />
              </tr>
            ))}
            <tr className="font-semibold">
              <Td>All websites</Td>
              <Counts values={totals} />
            </tr>
          </tbody>
        </Table>
      ) : (
        <EmptyState title="No websites yet">Add a website to see its status.</EmptyState>
      )}

      <Card
        title={`Open items · ${issues.length}`}
        description={byType.map(([type, count]) => `${type}: ${count}`).join(" · ") || undefined}
      >
        {issues.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Type</Th>
                <Th>Website</Th>
                <Th>Item</Th>
                <Th>Since</Th>
                <Th>Detail</Th>
              </tr>
            </thead>
            <tbody>
              {issues.slice(0, SHOWN_ISSUES).map((issue, index) => (
                <tr key={`${issue.path}-${issue.type}-${index}`}>
                  <Td>
                    <Badge tone={PROBLEMS.has(issue.type) ? "red" : "amber"}>{issue.type}</Badge>
                  </Td>
                  <Td>{issue.website}</Td>
                  <Td>
                    <Link href={issue.path} className="font-medium hover:underline" dir="auto">
                      {issue.item}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap">{issue.since ? <RelativeTime value={issue.since} /> : "—"}</Td>
                  <Td className="max-w-md break-words text-muted-foreground">{issue.detail ?? ""}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing is failing or waiting. All clear.</p>
        )}
        {issues.length > SHOWN_ISSUES ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Showing the first {SHOWN_ISSUES} of {issues.length}. Export open items for the full list.
          </p>
        ) : null}
      </Card>
      <p className="text-xs text-muted-foreground">
        Archived websites are left out. Monthly costs are on the Costs page; week-by-week output and traffic are in the
        Weekly report.
      </p>
    </div>
  );
}
