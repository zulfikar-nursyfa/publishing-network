import Link from "next/link";
import { Archive, ArrowRight, Globe, Plus } from "lucide-react";
import { Badge, ButtonLink, ConnectionBadge, EmptyState, FilterTabs, PageHeader } from "@/components/ui";
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
        description={`${websites?.length ?? 0} ${showArchived ? "archived" : "active"} website${websites?.length === 1 ? "" : "s"} in the network.`}
        actions={
          user.isAdmin ? (
            <ButtonLink href="/websites/new">
              <Plus />
              Add website
            </ButtonLink>
          ) : null
        }
      />

      <FilterTabs
        active={showArchived ? "archived" : "active"}
        items={[
          { key: "active", label: "Active", href: "/websites" },
          { key: "archived", label: "Archived", href: "/websites?archived=1" },
        ]}
      />

      {websites && websites.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {websites.map((site) => (
            <Link
              key={site.id}
              href={`/websites/${site.id}`}
              className="group flex flex-col rounded-xl border bg-card p-5 shadow-xs transition-all hover:-translate-y-px hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
                    {site.language}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold group-hover:text-primary">{site.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{site.domain}</div>
                  </div>
                </div>
                <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
              <div className="mt-5 flex flex-wrap gap-1.5">
                <ConnectionBadge status={site.wp_connection_status} />
                {site.automation_paused ? <Badge dot>paused</Badge> : <Badge tone="green" dot>{site.daily_quota}/day</Badge>}
                {site.archived_at ? <Badge tone="red">archived</Badge> : null}
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                <span>{site.language === "ar" ? "Arabic (RTL)" : "English"}</span>
                <span className="truncate">{site.timezone}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={showArchived ? Archive : Globe}
          title={showArchived ? "No archived websites" : "No websites yet"}
          action={!showArchived && user.isAdmin ? <ButtonLink href="/websites/new"><Plus />Add website</ButtonLink> : null}
        >
          {showArchived ? "Archived websites appear here. Nothing is deleted when a site is archived." : "Connect a WordPress site to start publishing."}
        </EmptyState>
      )}
    </>
  );
}
