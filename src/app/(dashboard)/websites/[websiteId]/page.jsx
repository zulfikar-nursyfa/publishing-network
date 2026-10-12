import Link from "next/link";
import {
  CircleCheck,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Plus,
  Send,
  Settings,
  TriangleAlert,
  Upload,
} from "lucide-react";
import {
  ArticleStatusBadge,
  Badge,
  ButtonLink,
  ConnectionBadge,
  EmptyState,
  FilterTabs,
  PageHeader,
  Stat,
  Table,
  Td,
  Th,
  formatDateTime,
  linkClass,
} from "@/components/ui";
import { requireWebsite } from "@/lib/auth";

import { createClient } from "@/lib/supabase/server";
import { AiUsageCard } from "./ai-usage-card";
import { TodaySchedule } from "./today-schedule";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "in_review", label: "In review" },
  { key: "approved", label: "Approved" },
  { key: "published", label: "Published" },
  { key: "unpublished", label: "Unpublished" },
  { key: "rejected", label: "Rejected" },
];

export default async function WebsitePage({ params, searchParams }) {
  const { websiteId } = await params;
  const { user, website } = await requireWebsite(websiteId);
  const statusParam = (await searchParams).status;
  const filter = FILTERS.find((item) => item.key === statusParam)?.key ?? "all";

  const supabase = await createClient();
  let articlesQuery = supabase
    .from("articles")
    .select("id, title, status, origin, updated_at, published_at, wp_post_url")
    .eq("website_id", websiteId)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (filter !== "all") articlesQuery = articlesQuery.eq("status", filter);

  const [{ data: articles }, { data: stats }, { data: niche }] = await Promise.all([
    articlesQuery,
    supabase.from("website_article_stats").select("*").eq("website_id", websiteId).maybeSingle(),
    website.niche_id
      ? supabase.from("niches").select("name").eq("id", website.niche_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const rtl = website.text_direction === "rtl";

  return (
    <>
      <PageHeader
        back={{ href: "/websites", label: "Websites" }}
        title={website.name}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <a
              href={`https://${website.domain}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              {website.domain}
              <ExternalLink className="size-3" />
            </a>
            <span className="text-border">|</span>
            <span>{rtl ? "Arabic (RTL)" : "English"}</span>
            <span className="text-border">|</span>
            {niche ? (
              <>
                <span>{niche.name}</span>
                <span className="text-border">|</span>
              </>
            ) : null}
            <span>{website.timezone}</span>
            <span className="flex w-full flex-wrap gap-1.5 pt-1 sm:w-auto sm:pt-0">
              <ConnectionBadge status={website.wp_connection_status} />
              {website.automation_paused ? (
                <Badge dot>automation paused</Badge>
              ) : (
                <Badge tone="green" dot>
                  automation {website.daily_quota}/day
                </Badge>
              )}
              {website.archived_at ? <Badge tone="red">archived</Badge> : null}
            </span>
          </span>
        }
        actions={
          <>
            <ButtonLink href={`/websites/${websiteId}/settings`} variant="secondary">
              <Settings />
              {user.isAdmin ? "Settings" : "Details"}
            </ButtonLink>
            {!website.archived_at ? (
              <ButtonLink href={`/websites/${websiteId}/articles/new`}>
                <Plus />
                New article
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="In review" value={stats?.in_review ?? 0} icon={ClipboardCheck} tone="amber" />
        <Stat label="Approved" value={stats?.approved ?? 0} icon={CircleCheck} tone="blue" />
        <Stat label="Published today" value={stats?.published_today ?? 0} icon={Send} tone="green" />
        <Stat label="Published total" value={stats?.published_total ?? 0} icon={Upload} tone="purple" />
        <Stat
          label="Failed publishing"
          value={stats?.failed_publications ?? 0}
          icon={TriangleAlert}
          tone="red"
          alert={Number(stats?.failed_publications ?? 0) > 0}
        />
      </div>

      {!website.archived_at ? <TodaySchedule website={website} /> : null}

      <AiUsageCard supabase={supabase} website={website} />

      <FilterTabs
        active={filter}
        items={FILTERS.map((item) => ({
          key: item.key,
          label: item.label,
          href: item.key === "all" ? `/websites/${websiteId}` : `/websites/${websiteId}?status=${item.key}`,
        }))}
      />

      {articles && articles.length > 0 ? (
        <Table>
          <thead>
            <tr>
              <Th>Title</Th>
              <Th>Status</Th>
              <Th className="hidden lg:table-cell">Origin</Th>
              <Th className="hidden md:table-cell">Updated</Th>
              <Th className="hidden sm:table-cell">Published</Th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => (
              <tr key={article.id}>
                <Td className="max-w-md">
                  <Link
                    href={`/articles/${article.id}`}
                    dir={rtl ? "rtl" : "ltr"}
                    className={`${linkClass} line-clamp-2`}
                  >
                    {article.title}
                  </Link>
                  <div className="mt-0.5 text-xs text-muted-foreground md:hidden">
                    Updated {formatDateTime(article.updated_at, website.timezone)}
                  </div>
                </Td>
                <Td>
                  <ArticleStatusBadge status={article.status} />
                </Td>
                <Td className="hidden capitalize text-muted-foreground lg:table-cell">{article.origin}</Td>
                <Td className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                  {formatDateTime(article.updated_at, website.timezone)}
                </Td>
                <Td className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                  {article.wp_post_url ? (
                    <a
                      href={article.wp_post_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 underline-offset-4 hover:text-primary hover:underline"
                    >
                      {formatDateTime(article.published_at, website.timezone)}
                      <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    "—"
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState
          icon={FileText}
          title={`No articles${filter !== "all" ? " with this status" : " yet"}`}
          action={
            !website.archived_at ? (
              <ButtonLink href={`/websites/${websiteId}/articles/new`} variant="secondary">
                <Plus />
                Write an article
              </ButtonLink>
            ) : null
          }
        >
          {filter !== "all"
            ? "Try another filter, or write a new article."
            : "Articles you write or automation drafts will appear here."}
        </EmptyState>
      )}
    </>
  );
}
