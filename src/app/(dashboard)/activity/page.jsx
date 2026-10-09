import Link from "next/link";
import { Activity, ChevronLeft, ChevronRight } from "lucide-react";
import { ButtonLink, EmptyState, PageHeader, Table, Td, Th, formatDateTime } from "@/components/ui";
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
    actorIds.length
      ? supabase.from("profiles").select("id, email, full_name").in("id", actorIds)
      : Promise.resolve({ data: [] }),
    websiteIds.length
      ? supabase.from("websites").select("id, name").in("id", websiteIds)
      : Promise.resolve({ data: [] }),
  ]);
  const actorName = new Map((actors ?? []).map((actor) => [actor.id, actor.full_name || actor.email]));
  const websiteName = new Map((websites ?? []).map((site) => [site.id, site.name]));

  return (
    <>
      <PageHeader
        title="Activity"
        description={
          user.isAdmin ? "Administrative and publishing actions across the network." : "Actions on your websites."
        }
      />
      {entries && entries.length > 0 ? (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Action</Th>
                <Th className="hidden sm:table-cell">Who</Th>
                <Th className="hidden md:table-cell">Website</Th>
                <Th className="hidden xl:table-cell">Details</Th>
                <Th className="text-right">When</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const who = entry.actor_id ? (actorName.get(entry.actor_id) ?? "Unknown user") : "System";
                return (
                  <tr key={entry.id}>
                    <Td>
                      {entry.entity_type === "article" && entry.entity_id ? (
                        <Link
                          href={`/articles/${entry.entity_id}`}
                          className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          {entry.action}
                        </Link>
                      ) : (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{entry.action}</span>
                      )}
                      <div className="mt-1 text-xs text-muted-foreground sm:hidden">{who}</div>
                    </Td>
                    <Td className="hidden sm:table-cell">{who}</Td>
                    <Td className="hidden text-muted-foreground md:table-cell">
                      {entry.website_id ? (websiteName.get(entry.website_id) ?? "—") : "—"}
                    </Td>
                    <Td className="hidden xl:table-cell">
                      <code
                        className="block max-w-sm truncate text-xs text-muted-foreground"
                        title={JSON.stringify(entry.details)}
                      >
                        {JSON.stringify(entry.details)}
                      </code>
                    </Td>
                    <Td className="text-right text-xs whitespace-nowrap text-muted-foreground sm:text-sm">
                      {formatDateTime(entry.created_at)}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <div className="mt-4 flex items-center justify-between">
            {page > 1 ? (
              <ButtonLink href={`/activity?page=${page - 1}`} variant="secondary" size="sm">
                <ChevronLeft />
                Newer
              </ButtonLink>
            ) : (
              <span />
            )}
            <span className="text-sm text-muted-foreground">Page {page}</span>
            {entries.length === PAGE_SIZE ? (
              <ButtonLink href={`/activity?page=${page + 1}`} variant="secondary" size="sm">
                Older
                <ChevronRight />
              </ButtonLink>
            ) : (
              <span />
            )}
          </div>
        </>
      ) : (
        <EmptyState icon={Activity}>No activity recorded yet.</EmptyState>
      )}
    </>
  );
}
