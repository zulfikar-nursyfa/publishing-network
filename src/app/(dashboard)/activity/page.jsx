import Link from "next/link";
import { EmptyState, PageHeader, Table, Td, Th, formatDateTime } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Activity" };

const PAGE_SIZE = 100;

export default async function ActivityPage({ searchParams }) {
  const user = await requireUser();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const supabase = await createClient();

  // RLS limits editors to entries for their websites; administrators see everything.
  const { data: entries } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const actorIds = [...new Set((entries ?? []).map((entry) => entry.actor_id).filter((id) => Boolean(id)))];
  const websiteIds = [...new Set((entries ?? []).map((entry) => entry.website_id).filter((id) => Boolean(id)))];
  const [{ data: actors }, { data: websites }] = await Promise.all([
    actorIds.length ? supabase.from("profiles").select("id, email, full_name").in("id", actorIds) : Promise.resolve({ data: [] }),
    websiteIds.length ? supabase.from("websites").select("id, name").in("id", websiteIds) : Promise.resolve({ data: [] }),
  ]);
  const actorName = new Map((actors ?? []).map((actor) => [actor.id, actor.full_name || actor.email]));
  const websiteName = new Map((websites ?? []).map((site) => [site.id, site.name]));

  return (
    <>
      <PageHeader
        title="Activity"
        description={user.isAdmin ? "Administrative and publishing actions across the network." : "Actions on your websites."}
      />
      {entries && entries.length > 0 ? (
        <>
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>Action</Th>
                <Th>Website</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <Td className="whitespace-nowrap text-gray-600">{formatDateTime(entry.created_at)}</Td>
                  <Td>{entry.actor_id ? actorName.get(entry.actor_id) ?? "Unknown user" : "System"}</Td>
                  <Td>
                    {entry.entity_type === "article" && entry.entity_id ? (
                      <Link href={`/articles/${entry.entity_id}`} className="font-mono text-xs underline">{entry.action}</Link>
                    ) : (
                      <span className="font-mono text-xs">{entry.action}</span>
                    )}
                  </Td>
                  <Td>{entry.website_id ? websiteName.get(entry.website_id) ?? "—" : "—"}</Td>
                  <Td>
                    <code className="block max-w-md truncate text-xs text-gray-600" title={JSON.stringify(entry.details)}>
                      {JSON.stringify(entry.details)}
                    </code>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-4 flex justify-between text-sm">
            {page > 1 ? <Link href={`/activity?page=${page - 1}`} className="underline">Newer</Link> : <span />}
            {entries.length === PAGE_SIZE ? <Link href={`/activity?page=${page + 1}`} className="underline">Older</Link> : null}
          </div>
        </>
      ) : (
        <EmptyState>No activity recorded yet.</EmptyState>
      )}
    </>
  );
}
