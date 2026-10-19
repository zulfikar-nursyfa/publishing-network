import Link from "next/link";
import { FilterTabs, PageHeader, Table, Td, Th, RowCheckbox } from "@/components/ui";
import { BulkDraftRemoval, RemoveDraftForm } from "@/components/draft-removal";
import { DraftJobState } from "@/components/draft-job-state";
import { ListToolbar, SortTh } from "@/components/list-controls";
import { ListResults } from "@/components/list-results";
import { RelativeTime } from "@/components/relative-time";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listContext, readList } from "@/lib/lists";
import { listHref } from "@/lib/list-params";
import { jobList } from "@/lib/list-configs";
import { canRemoveDraft } from "@/lib/draft-job-policy";

export const metadata = { title: "Draft jobs" };
export default async function JobsPage({ searchParams }) {
  await requireUser();
  const db = await createClient();
  const { state, websites, timezone } = await listContext(db, await searchParams, jobList);
  const result = await readList(() => db.from("job_list").select("*", { count: "exact" }), state, timezone);
  const { data: stories = [], error: storyError } = result.data.length
    ? await db
        .from("story_candidates")
        .select("id, status")
        .in(
          "id",
          result.data.map((job) => job.story_id),
        )
    : { data: [] };
  const storyStatuses = new Map((stories ?? []).map((story) => [story.id, story.status]));
  const hasRemovableJobs =
    !storyError && result.data.some((job) => canRemoveDraft(job, storyStatuses.get(job.story_id)));
  const path = "/jobs";
  return (
    <>
      <PageHeader title="Draft jobs" description={`Research, drafting and verification · ${timezone}`} />
      <FilterTabs
        active={state.status}
        items={jobList.filters.status.options.map(({ value, label }) => ({
          key: value,
          label,
          href: listHref(path, state, { status: value }),
        }))}
      />
      <ListToolbar path={path} state={state} websites={websites} searchLabel="Search story titles" tabFilter="status" />
      <ListResults
        result={result}
        path={path}
        state={state}
        title={state.status === "active" ? "No active draft jobs" : "No matching draft jobs"}
        empty={<Link href="/stories">Choose stories in the inbox, or view completed jobs in All or Cancelled.</Link>}
      >
        {hasRemovableJobs ? <BulkDraftRemoval selectionKey={listHref(path, state)} /> : null}
        <Table className="jobs-table">
          <thead>
            <tr>
              <Th>
                <span className="sr-only">Choose job</span>
              </Th>
              <Th>Story / website</Th>
              <Th>Status / step</Th>
              <Th>Attempts</Th>
              <SortTh path={path} state={state} column="created">
                Created
              </SortTh>
              <SortTh path={path} state={state} column="updated">
                Updated
              </SortTh>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((job) => (
              <tr key={job.id}>
                <Td>
                  {!storyError && canRemoveDraft(job, storyStatuses.get(job.story_id)) ? (
                    <RowCheckbox
                      name="job_ids"
                      form="bulk-jobs"
                      value={job.id}
                      aria-label={`Choose ${job.story_title}`}
                    />
                  ) : null}
                </Td>
                <Td className="min-w-56 max-w-lg">
                  <Link href={`/jobs/${job.id}`} dir="auto" className="font-medium hover:underline">
                    {job.story_title}
                  </Link>
                  <div className="text-xs text-muted-foreground">{job.website_name}</div>
                  {job.last_error && !job.waiting_kind ? (
                    <p
                      className={`mt-1 text-xs ${job.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {job.last_error}
                    </p>
                  ) : null}
                </Td>
                <Td>
                  <DraftJobState job={job} timezone={job.timezone} />
                  <div className="mt-1 text-xs text-muted-foreground">{job.step.replaceAll("_", " ")}</div>
                </Td>
                <Td className="text-right tabular-nums">
                  <span className="mb-1 block text-left text-xs text-muted-foreground lg:hidden">Attempts</span>
                  {job.attempt_count}/{job.max_attempts}
                </Td>
                <Td>
                  <span className="mb-1 block text-xs text-muted-foreground lg:hidden">Created</span>
                  <RelativeTime value={job.created_at} timezone={job.timezone} />
                </Td>
                <Td>
                  <span className="mb-1 block text-xs text-muted-foreground lg:hidden">Updated</span>
                  <RelativeTime value={job.updated_at} timezone={job.timezone} />
                </Td>
                <Td className={hasRemovableJobs ? "lg:w-48 lg:max-w-48" : undefined}>
                  {!storyError && canRemoveDraft(job, storyStatuses.get(job.story_id)) ? (
                    <RemoveDraftForm jobId={job.id} title={job.story_title} />
                  ) : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ListResults>
    </>
  );
}
