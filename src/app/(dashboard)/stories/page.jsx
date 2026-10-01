import { Check, ExternalLink, Rss, Undo2, X } from "lucide-react";
import { setStoryStatus } from "@/app/actions/stories";
import { SubmitButton } from "@/components/form-controls";
import { Badge, EmptyState, FilterTabs, PageHeader, formatDateTime } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Story inbox" };

const STATUSES = [
  { key: "new", label: "New" },
  { key: "selected", label: "Selected" },
  { key: "skipped", label: "Skipped" },
];

export default async function StoriesPage({ searchParams }) {
  await requireUser();
  const params = await searchParams;
  const status = STATUSES.find((item) => item.key === params.status)?.key ?? "new";
  const supabase = await createClient();

  const { data: websites } = await supabase.from("websites").select("id, name, timezone").is("archived_at", null).order("name");
  const website = websites?.find((site) => site.id === params.website) ?? null;
  const siteById = new Map((websites ?? []).map((site) => [site.id, site]));

  let query = supabase
    .from("story_candidates")
    .select("id, website_id, url, title, summary, image_url, source_published_at, created_at, content_sources(name, kind)")
    .eq("status", status)
    .order("source_published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (website) query = query.eq("website_id", website.id);
  const { data: stories } = await query;

  const href = ({ status: nextStatus = status, website: nextWebsite = website?.id ?? "all" }) => {
    const search = new URLSearchParams({ status: nextStatus });
    if (nextWebsite !== "all") search.set("website", nextWebsite);
    return `/stories?${search}`;
  };

  return (
    <>
      <PageHeader
        title="Story inbox"
        description="New stories found in each website's approved source feeds, checked every 30 minutes. Select the ones worth covering."
      />

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs active={status} items={STATUSES.map((item) => ({ ...item, href: href({ status: item.key }) }))} />
        {websites && websites.length > 1 ? (
          <FilterTabs
            active={website?.id ?? "all"}
            items={[{ key: "all", label: "All websites" }, ...websites.map((site) => ({ key: site.id, label: site.name }))].map((item) => ({
              ...item,
              href: href({ website: item.key }),
            }))}
          />
        ) : null}
      </div>

      {stories && stories.length > 0 ? (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
          {stories.map((story) => {
            const site = siteById.get(story.website_id);
            const primary = ["newsroom", "government"].includes(story.content_sources?.kind);
            return (
              <li key={story.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
                {story.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote feed images, shown as-is
                  <img src={story.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-video w-full shrink-0 rounded-lg border bg-muted object-cover sm:w-40" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{story.content_sources?.name ?? "Removed source"}</span>
                    {primary ? <Badge tone="blue">primary</Badge> : null}
                    <span>·</span>
                    <span>{formatDateTime(story.source_published_at ?? story.created_at, site?.timezone)}</span>
                    {!website && websites && websites.length > 1 ? <><span>·</span><span>{site?.name}</span></> : null}
                  </div>
                  <a href={story.url} target="_blank" rel="noreferrer" className="group inline-flex items-start gap-1.5 font-medium underline-offset-4 hover:text-primary hover:underline">
                    <span dir="auto">{story.title}</span>
                    <ExternalLink className="mt-1 size-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                  </a>
                  {story.summary ? <p dir="auto" className="mt-1 line-clamp-2 text-sm text-muted-foreground">{story.summary}</p> : null}
                </div>
                <div className="flex shrink-0 gap-2 sm:flex-col">
                  {status === "new" ? (
                    <>
                      <form action={setStoryStatus.bind(null, story.id, "selected")}>
                        <SubmitButton size="sm" className="w-full"><Check />Select</SubmitButton>
                      </form>
                      <form action={setStoryStatus.bind(null, story.id, "skipped")}>
                        <SubmitButton size="sm" variant="secondary" className="w-full"><X />Skip</SubmitButton>
                      </form>
                    </>
                  ) : (
                    <form action={setStoryStatus.bind(null, story.id, "new")}>
                      <SubmitButton size="sm" variant="ghost" className="w-full"><Undo2 />Back to new</SubmitButton>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={Rss} title={status === "new" ? "No new stories" : `No ${status} stories`}>
          {status === "new"
            ? "New stories appear here once a website has active sources with a feed URL."
            : "Stories you mark appear here."}
        </EmptyState>
      )}
    </>
  );
}
