import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Badge, EmptyState, FilterTabs, PageHeader, Table, Td, Th, formatDateTime } from "@/components/ui";
import { ListChecks } from "lucide-react";

const STATUSES = ["all", "queued", "running", "failed", "succeeded", "cancelled"];
export const metadata = { title: "Draft jobs" };
export default async function JobsPage({ searchParams }) {
  await requireUser();
  const params = await searchParams;
  const status = STATUSES.includes(params.status) ? params.status : "all";
  const db = await createClient();
  let query = db
    .from("jobs")
    .select(
      "id, website_id, status, step, attempt_count, max_attempts, last_error, article_id, updated_at, websites(name, timezone), story_candidates(title)",
    )
    .order("updated_at", { ascending: false })
    .limit(100);
  if (status !== "all") query = query.eq("status", status);
  if (params.website) query = query.eq("website_id", params.website);
  const { data: jobs, error } = await query;
  return (
    <>
      <PageHeader
        title="Draft jobs"
        description="Research, drafting and verification progress. Paused websites wait; failed jobs can be reviewed and retried by an administrator."
      />
      <FilterTabs
        active={status}
        items={STATUSES.map((key) => ({
          key,
          label: key[0].toUpperCase() + key.slice(1),
          href: `/jobs?${new URLSearchParams({ status: key, ...(params.website ? { website: params.website } : {}) })}`,
        }))}
      />
      {error ? (
        <Alert tone="error">Draft jobs are unavailable. Apply the pending automation migrations.</Alert>
      ) : jobs.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Story</Th>
              <Th>Status / step</Th>
              <Th>Attempts</Th>
              <Th>Last update</Th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <Td>
                  <Link href={`/jobs/${job.id}`} className="font-medium hover:underline">
                    {job.story_candidates?.title ?? "Story"}
                  </Link>
                  <div className="text-xs text-muted-foreground">{job.websites?.name}</div>
                  {job.last_error ? <p className="mt-1 max-w-lg text-sm text-red-600">{job.last_error}</p> : null}
                </Td>
                <Td>
                  <Badge tone={job.status === "failed" ? "red" : job.status === "succeeded" ? "green" : "blue"}>
                    {job.status}
                  </Badge>
                  <div className="mt-1 text-xs text-muted-foreground">{job.step.replaceAll("_", " ")}</div>
                </Td>
                <Td>
                  {job.attempt_count}/{job.max_attempts}
                </Td>
                <Td>{formatDateTime(job.updated_at, job.websites?.timezone)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState icon={ListChecks} title="No draft jobs">
          Select stories in the inbox and queue drafts. Automatic queuing fills a two-day review buffer when automation
          is enabled.
        </EmptyState>
      )}
    </>
  );
}
