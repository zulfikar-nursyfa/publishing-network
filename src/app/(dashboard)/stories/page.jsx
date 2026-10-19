import { setStoryStatus } from "@/app/actions/stories";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Badge, FilterTabs, PageHeader, Table, Td, Th, RowCheckbox } from "@/components/ui";
import { BulkStoryActions } from "@/components/bulk-story-actions";
import { ListToolbar, SortTh } from "@/components/list-controls";
import { ListResults } from "@/components/list-results";
import { RelativeTime } from "@/components/relative-time";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { allRows, listContext, readList } from "@/lib/lists";
import { listHref } from "@/lib/list-params";
import { storyList } from "@/lib/list-configs";
import { QueueDraftForm } from "../jobs/job-controls";
import Link from "next/link";
import { RemoveDraftForm } from "@/components/draft-removal";
import { canRemoveDraft } from "@/lib/draft-job-policy";

export const metadata = { title: "Story inbox" };
export default async function StoriesPage({ searchParams }) {
  await requireUser();
  const db = await createClient();
  const { state, websites, timezone } = await listContext(db, await searchParams, storyList);
  const sources = await allRows(() => {
    let query = db.from("content_sources").select("id, name, website_id").order("name").order("id");
    if (state.website !== "all") query = query.eq("website_id", state.website);
    return query;
  });
  const result = await readList(
    () => {
      let query = db.from("story_list").select("*", { count: "exact" });
      if (state.kind === "official") query = query.in("source_kind", ["newsroom", "government"]);
      else if (state.kind !== "all") query = query.eq("source_kind", state.kind);
      return query;
    },
    state,
    timezone,
  );
  const path = "/stories";
  const { data: jobs = [], error: jobsError } = result.data.length
    ? await db
        .from("jobs")
        .select("id, story_id, status")
        .in(
          "story_id",
          result.data.map((story) => story.id),
        )
    : { data: [] };
  const jobsByStory = new Map((jobs ?? []).map((job) => [job.story_id, job]));
  return (
    <>
      <PageHeader title="Story inbox" description={`Stories from approved feeds · ${timezone}`} />
      <FilterTabs
        active={state.status}
        items={["new", "selected", "skipped", "used", "all"].map((key) => ({
          key,
          label: key,
          href: listHref(path, state, { status: key }),
        }))}
      />
      <ListToolbar
        path={path}
        state={state}
        tabFilter="status"
        websites={websites}
        searchLabel="Search story titles"
        choices={{
          source: [
            { value: "all", label: "All sources" },
            ...sources.map((source) => ({ value: source.id, label: source.name })),
          ],
        }}
      />
      <ListResults
        result={result}
        path={path}
        state={state}
        title="No stories yet"
        empty="Add active source feeds in website settings. Discovery will bring their stories here."
      >
        <BulkStoryActions selectionKey={listHref(path, state)} />
        <Table className="story-inbox-table">
          <thead>
            <tr>
              <Th>
                <span className="sr-only">Choose story</span>
              </Th>
              <Th>Story</Th>
              <Th>Website</Th>
              <SortTh path={path} state={state} column="source">
                Source
              </SortTh>
              <SortTh path={path} state={state} column="published">
                Published
              </SortTh>
              <SortTh path={path} state={state} column="discovered">
                Discovered
              </SortTh>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((story) => {
              const job = jobsByStory.get(story.id);
              return (
                <tr key={story.id}>
                  <Td>
                    {story.status !== "used" ? (
                      <RowCheckbox
                        aria-label={`Choose ${story.title}`}
                        type="checkbox"
                        name="story_ids"
                        value={story.id}
                        form="bulk-stories"
                      />
                    ) : null}
                  </Td>
                  <Td className="min-w-56 max-w-md">
                    <a
                      href={story.url}
                      target="_blank"
                      rel="noreferrer"
                      dir="auto"
                      className="font-medium hover:underline"
                    >
                      {story.title}
                    </a>
                    <p dir="auto" className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {story.summary}
                    </p>
                    <div className="mt-1 flex gap-1">
                      <Badge>{story.status}</Badge>
                      {story.selected_automatically ? <Badge tone="green">Auto-selected</Badge> : null}
                    </div>
                    {story.status === "selected" && !job && !jobsError ? <QueueDraftForm storyId={story.id} /> : null}
                    {job ? (
                      <Link href={`/jobs/${job.id}`} className="mt-2 inline-block text-xs underline underline-offset-4">
                        View draft job
                      </Link>
                    ) : null}
                  </Td>
                  <Td>
                    <span className="mb-1 block text-xs text-muted-foreground lg:hidden">Website</span>
                    {story.website_name}
                  </Td>
                  <Td>
                    <span className="mb-1 block text-xs text-muted-foreground lg:hidden">Source</span>
                    {story.source_name ?? "Removed source"}
                    <div className="mt-1">
                      <Badge tone={["newsroom", "government"].includes(story.source_kind) ? "blue" : "gray"}>
                        {story.source_kind ?? "unknown"}
                      </Badge>
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <span className="mb-1 block text-xs text-muted-foreground lg:hidden">Published</span>
                    <RelativeTime value={story.source_published_at} timezone={story.timezone} />
                  </Td>
                  <Td className="whitespace-nowrap">
                    <span className="mb-1 block text-xs text-muted-foreground lg:hidden">Discovered</span>
                    <RelativeTime value={story.created_at} timezone={story.timezone} />
                  </Td>
                  <Td>
                    {story.status !== "used" ? (
                      <div className="flex flex-wrap gap-2">
                        {canRemoveDraft(job, story.status) ? (
                          <RemoveDraftForm jobId={job.id} title={story.title} />
                        ) : null}
                        {story.status !== "selected" ? (
                          <ActionForm action={setStoryStatus.bind(null, story.id, "selected")}>
                            <SubmitButton size="sm" variant="secondary">
                              Select
                            </SubmitButton>
                          </ActionForm>
                        ) : (
                          <ActionForm action={setStoryStatus.bind(null, story.id, "new")}>
                            <SubmitButton
                              size="sm"
                              variant="secondary"
                              confirm="Unselect this story and cancel any queued or running draft?"
                              confirmLabel="Unselect"
                            >
                              Unselect
                            </SubmitButton>
                          </ActionForm>
                        )}
                        {story.status !== "skipped" ? (
                          <ActionForm action={setStoryStatus.bind(null, story.id, "skipped")}>
                            <SubmitButton
                              size="sm"
                              variant="secondary"
                              confirm={
                                story.status === "selected" ? "Skip this story and cancel its draft job?" : undefined
                              }
                              confirmLabel="Skip"
                            >
                              Skip
                            </SubmitButton>
                          </ActionForm>
                        ) : null}
                      </div>
                    ) : null}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </ListResults>
    </>
  );
}
