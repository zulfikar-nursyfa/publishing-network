import Link from "next/link";
import { PageHeader, Table, Td, Th } from "@/components/ui";
import { ListToolbar, SortTh } from "@/components/list-controls";
import { ListResults } from "@/components/list-results";
import { RelativeTime } from "@/components/relative-time";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { allRows, listContext, readList } from "@/lib/lists";
import { activityList } from "@/lib/list-configs";

export const metadata = { title: "Activity" };
export default async function ActivityPage({ searchParams }) {
  await requireUser();
  const db = await createClient();
  const { state, websites, timezone } = await listContext(db, await searchParams, activityList);
  const actors = await allRows(() => db.from("profiles").select("id, email, full_name").order("id"));
  const result = await readList(
    () => {
      let query = db.from("audit_log").select("*", { count: "exact" });
      if (state.area !== "all") query = query.like("action", `${state.area}%`);
      return query;
    },
    state,
    timezone,
  );
  const actorName = new Map(actors.map((actor) => [actor.id, actor.full_name || actor.email]));
  const websiteName = new Map(websites.map((site) => [site.id, site.name]));
  return (
    <>
      <PageHeader
        title="Activity"
        description={`Administrative and publishing actions you can access. Dates use ${timezone}.`}
      />
      <ListToolbar
        path="/activity"
        state={state}
        websites={websites}
        choices={{
          actor: [
            { value: "all", label: "All actors" },
            ...actors.map((actor) => ({ value: actor.id, label: actor.full_name || actor.email })),
          ],
        }}
      />
      <ListResults
        result={result}
        path="/activity"
        state={state}
        title="No activity recorded yet"
        empty="Administrative and publishing actions appear here."
      >
        <Table>
          <thead>
            <tr>
              <SortTh path="/activity" state={state} column="action">
                Action
              </SortTh>
              <Th>Who</Th>
              <Th>Website</Th>
              <Th>Details</Th>
              <SortTh path="/activity" state={state} column="created">
                When
              </SortTh>
            </tr>
          </thead>
          <tbody>
            {result.data.map((entry) => (
              <tr key={entry.id}>
                <Td>
                  {entry.entity_type === "article" && entry.entity_id ? (
                    <Link href={`/articles/${entry.entity_id}`} className="font-mono text-xs hover:underline">
                      {entry.action}
                    </Link>
                  ) : (
                    <code className="text-xs">{entry.action}</code>
                  )}
                </Td>
                <Td>{entry.actor_id ? (actorName.get(entry.actor_id) ?? "Unknown user") : "System"}</Td>
                <Td>{websiteName.get(entry.website_id) ?? "Network"}</Td>
                <Td>
                  <details className="max-w-sm">
                    <summary className="cursor-pointer text-xs text-primary">Show details</summary>
                    <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all text-xs">
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                  </details>
                </Td>
                <Td className="whitespace-nowrap">
                  <RelativeTime value={entry.created_at} timezone={timezone} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ListResults>
    </>
  );
}
