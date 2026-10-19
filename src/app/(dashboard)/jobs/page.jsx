import Link from "next/link";
import { Badge, FilterTabs, PageHeader, Table, Td, Th } from "@/components/ui";
import { ListToolbar, SortTh } from "@/components/list-controls";
import { ListResults } from "@/components/list-results";
import { RelativeTime } from "@/components/relative-time";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listContext, readList } from "@/lib/lists";
import { listHref } from "@/lib/list-params";
import { jobList } from "@/lib/list-configs";

export const metadata = { title: "Draft jobs" };
export default async function JobsPage({ searchParams }) {
  await requireUser();
  const db = await createClient();
  const { state, websites, timezone } = await listContext(db, await searchParams, jobList);
  const result = await readList(() => db.from("job_list").select("*", { count: "exact" }), state, timezone);
  const path = "/jobs";
  return (
    <>
      <PageHeader
        title="Draft jobs"
        description={`Research, drafting and verification progress. Failed jobs can be reviewed and retried. Dates use ${timezone}.`}
      />
      <FilterTabs
        active={state.status}
        items={jobList.filters.status.options.map(({ value, label }) => ({
          key: value,
          label,
          href: listHref(path, state, { status: value }),
        }))}
      />
      <ListToolbar path={path} state={state} websites={websites} searchLabel="Search story titles" />
      <ListResults
        result={result}
        path={path}
        state={state}
        title="No draft jobs yet"
        empty={<Link href="/stories">Select stories in the inbox to start drafting.</Link>}
      >
        <Table>
          <thead>
            <tr>
              <Th>Story / website</Th>
              <Th>Status / step</Th>
              <Th>Attempts</Th>
              <SortTh path={path} state={state} column="created">
                Created
              </SortTh>
              <SortTh path={path} state={state} column="updated">
                Updated
              </SortTh>
            </tr>
          </thead>
          <tbody>
            {result.data.map((job) => (
              <tr key={job.id}>
                <Td className="min-w-56 max-w-lg">
                  <Link href={`/jobs/${job.id}`} dir="auto" className="font-medium hover:underline">
                    {job.story_title}
                  </Link>
                  <div className="text-xs text-muted-foreground">{job.website_name}</div>
                  {job.last_error ? (
                    <p className="mt-1 text-xs text-red-700 dark:text-red-300">{job.last_error}</p>
                  ) : null}
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
                <Td>
                  <RelativeTime value={job.created_at} timezone={job.timezone} />
                </Td>
                <Td>
                  <RelativeTime value={job.updated_at} timezone={job.timezone} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ListResults>
    </>
  );
}
