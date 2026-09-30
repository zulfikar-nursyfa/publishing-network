import Link from "next/link";
import { Badge, ButtonLink, ConnectionBadge, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Websites" };

export default async function WebsitesPage({ searchParams }) {
  const user = await requireUser();
  const showArchived = (await searchParams).archived === "1";
  const supabase = await createClient();

  let query = supabase
    .from("websites")
    .select("id, name, domain, language, timezone, daily_quota, automation_paused, wp_connection_status, archived_at")
    .order("name");
  query = showArchived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  const { data: websites } = await query;

  return (
    <>
      <PageHeader
        title="Websites"
        description={`${websites?.length ?? 0} ${showArchived ? "archived" : "active"} website${websites?.length === 1 ? "" : "s"}.`}
        actions={
          <>
            <ButtonLink href={showArchived ? "/websites" : "/websites?archived=1"} variant="secondary">
              {showArchived ? "Show active" : "Show archived"}
            </ButtonLink>
            {user.isAdmin ? <ButtonLink href="/websites/new">Add website</ButtonLink> : null}
          </>
        }
      />
      {websites && websites.length > 0 ? (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Language</Th>
              <Th>Timezone</Th>
              <Th>Automation</Th>
              <Th>WordPress</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {websites.map((site) => (
              <tr key={site.id}>
                <Td>
                  <Link href={`/websites/${site.id}`} className="font-medium hover:underline">{site.name}</Link>
                  <div className="text-xs text-gray-500">{site.domain}</div>
                </Td>
                <Td>{site.language === "ar" ? "Arabic (RTL)" : "English"}</Td>
                <Td>{site.timezone}</Td>
                <Td>{site.automation_paused ? <Badge>paused</Badge> : <Badge tone="green">{site.daily_quota}/day</Badge>}</Td>
                <Td><ConnectionBadge status={site.wp_connection_status} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState>{showArchived ? "No archived websites." : "No websites yet."}</EmptyState>
      )}
    </>
  );
}
