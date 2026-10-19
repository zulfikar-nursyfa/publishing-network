import Link from "next/link";
import { Badge, PageHeader, Table, Td, Th } from "@/components/ui";
import { ListToolbar, SortTh } from "@/components/list-controls";
import { ListResults } from "@/components/list-results";
import { RelativeTime } from "@/components/relative-time";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listContext, readList } from "@/lib/lists";
import { sourceList } from "@/lib/list-configs";
import { uuidFilter } from "@/lib/list-params";
export default async function SourcesPage({ searchParams }) {
  await requireUser();
  const db = await createClient();
  const { state, websites } = await listContext(db, await searchParams, {
    ...sourceList,
    filters: { website: uuidFilter("Website"), ...sourceList.filters },
  });
  const names = new Map(websites.map((site) => [site.id, site.name]));
  const result = await readList(() => {
    let query = db.from("content_sources").select("*", { count: "exact" });
    if (state.errors === "errors") query = query.not("last_error", "is", null);
    return query;
  }, state);
  return (
    <>
      <PageHeader
        title="Source feeds"
        back={{ href: "/", label: "Overview" }}
        description="Check feed errors across your websites. Edit a source in its website settings."
      />
      <ListToolbar path="/sources" state={state} websites={websites} />
      <ListResults
        result={result}
        path="/sources"
        state={state}
        title="No sources yet"
        empty="Add approved sources in website settings."
      >
        <Table>
          <thead>
            <tr>
              <SortTh path="/sources" state={state} column="name">
                Source
              </SortTh>
              <Th>Website</Th>
              <Th>Kind / status</Th>
              <Th>Feed error</Th>
              <SortTh path="/sources" state={state} column="checked">
                Checked
              </SortTh>
            </tr>
          </thead>
          <tbody>
            {result.data.map((source) => (
              <tr key={source.id}>
                <Td>
                  <Link
                    className="font-medium hover:underline"
                    href={`/websites/${source.website_id}/settings?section=sources&q=${encodeURIComponent(source.name)}`}
                  >
                    {source.name}
                  </Link>
                </Td>
                <Td>{names.get(source.website_id)}</Td>
                <Td>
                  <Badge>{source.kind}</Badge>
                  <Badge tone={source.active ? "green" : "gray"}>{source.active ? "enabled" : "disabled"}</Badge>
                </Td>
                <Td className="min-w-52 max-w-md text-red-700 dark:text-red-300">{source.last_error ?? "—"}</Td>
                <Td>
                  <RelativeTime
                    value={source.last_checked_at}
                    timezone={websites.find((site) => site.id === source.website_id)?.timezone}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ListResults>
    </>
  );
}
