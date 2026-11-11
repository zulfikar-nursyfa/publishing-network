import Link from "next/link";
import { ListToolbar } from "@/components/list-controls";
import { ListResults } from "@/components/list-results";
import { RelativeTime } from "@/components/relative-time";
import { allRows, readList } from "@/lib/lists";
import { parseListParams, listHref } from "@/lib/list-params";
import { websiteList } from "@/lib/list-configs";
import { Archive, ArrowRight, Globe, Plus } from "lucide-react";
import { Badge, ButtonLink, ConnectionBadge, EmptyState, FilterTabs, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Websites" };

export default async function WebsitesPage({ searchParams }) {
  const user = await requireUser();
  const state = parseListParams(await searchParams, websiteList);
  const showArchived = state.status === "archived";
  const supabase = await createClient();

  const [niches, result] = await Promise.all([
    allRows(() => supabase.from("niches").select("id, name").order("name").order("id")),
    readList(() => {
      let query = supabase.from("website_list").select("*", { count: "exact" });
      if (state.status === "archived") query = query.not("archived_at", "is", null);
      else if (state.status === "active") query = query.is("archived_at", null);
      if (state.problem === "budget") query = query.eq("near_budget", true);
      if (state.problem === "traffic") query = query.not("traffic_error", "is", null);
      return query;
    }, state),
  ]);
  const websites = result.data;

  return (
    <>
      <PageHeader
        title="Websites"
        description={`${result.count ?? 0} ${showArchived ? "archived" : "active"} website${websites?.length === 1 ? "" : "s"} in the network.`}
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
        active={state.status}
        items={["active", "archived", "all"].map((key) => ({
          key,
          label: key,
          href: listHref("/websites", state, { status: key }),
        }))}
      />
      <ListToolbar
        path="/websites"
        state={state}
        searchLabel="Search name or domain"
        tabFilter="status"
        choices={{
          niche: [
            { value: "all", label: "All niches" },
            ...niches.map((niche) => ({ value: niche.id, label: niche.name })),
          ],
        }}
      />
      <ListResults
        result={result}
        path="/websites"
        state={state}
        title="No websites yet"
        empty={
          user.isAdmin ? (
            <Link href="/websites/new">Connect a WordPress website to start publishing.</Link>
          ) : (
            "Ask an administrator to assign a website."
          )
        }
      >
        {websites && websites.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-4">
            {websites.map((site) => (
              <Link
                key={site.id}
                href={`/websites/${site.id}`}
                className="group flex min-w-0 flex-col rounded-lg bg-card p-5 outline-none transition-colors hover:ring-1 hover:ring-input focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
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
                  <ConnectionBadge website={site} />
                  {site.automation_paused ? (
                    <Badge dot>paused</Badge>
                  ) : (
                    <Badge tone="green" dot>
                      {site.daily_quota}/day
                    </Badge>
                  )}
                  {site.archived_at ? <Badge tone="red">archived</Badge> : null}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Last published: <RelativeTime value={site.last_published_at} timezone={site.timezone} />
                </div>
                <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
                  <span className="truncate">
                    {site.language === "ar" ? "Arabic (RTL)" : "English"}
                    {site.niche_name ? ` · ${site.niche_name}` : ""}
                  </span>
                  <span className="shrink-0 truncate">{site.timezone}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={showArchived ? Archive : Globe}
            title={showArchived ? "No archived websites" : "No websites yet"}
            action={
              !showArchived && user.isAdmin ? (
                <ButtonLink href="/websites/new">
                  <Plus />
                  Add website
                </ButtonLink>
              ) : null
            }
          >
            {showArchived
              ? "Archived websites appear here. Nothing is deleted when a site is archived."
              : "Connect a WordPress site to start publishing."}
          </EmptyState>
        )}
      </ListResults>
    </>
  );
}
