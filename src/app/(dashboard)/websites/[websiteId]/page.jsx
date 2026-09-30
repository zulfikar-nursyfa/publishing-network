import Link from "next/link";
import { ArticleStatusBadge, Badge, ButtonLink, ConnectionBadge, EmptyState, PageHeader, Stat, Table, Td, Th, cn, formatDateTime } from "@/components/ui";
import { requireWebsite } from "@/lib/auth";

import { createClient } from "@/lib/supabase/server";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "in_review", label: "In review" },
  { key: "approved", label: "Approved" },
  { key: "published", label: "Published" },
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

  const [{ data: articles }, { data: stats }] = await Promise.all([
    articlesQuery,
    supabase.from("website_article_stats").select("*").eq("website_id", websiteId).maybeSingle(),
  ]);
  const rtl = website.text_direction === "rtl";

  return (
    <>
      <PageHeader
        title={website.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <a href={`https://${website.domain}`} target="_blank" rel="noreferrer" className="underline">{website.domain}</a>
            <span>·</span>
            <span>{rtl ? "Arabic (RTL)" : "English"}</span>
            <span>·</span>
            <span>{website.timezone}</span>
            <ConnectionBadge status={website.wp_connection_status} />
            {website.automation_paused ? <Badge>automation paused</Badge> : <Badge tone="green">automation {website.daily_quota}/day</Badge>}
            {website.archived_at ? <Badge tone="red">archived</Badge> : null}
          </span>
        }
        actions={
          <>
            <ButtonLink href={`/websites/${websiteId}/settings`} variant="secondary">{user.isAdmin ? "Settings" : "Details"}</ButtonLink>
            {!website.archived_at ? <ButtonLink href={`/websites/${websiteId}/articles/new`}>New article</ButtonLink> : null}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="In review" value={stats?.in_review ?? 0} />
        <Stat label="Approved" value={stats?.approved ?? 0} />
        <Stat label="Published today" value={stats?.published_today ?? 0} />
        <Stat label="Published total" value={stats?.published_total ?? 0} />
        <Stat label="Failed publishing" value={stats?.failed_publications ?? 0} />
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {FILTERS.map((item) => (
          <Link
            key={item.key}
            href={item.key === "all" ? `/websites/${websiteId}` : `/websites/${websiteId}?status=${item.key}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm",
              filter === item.key ? "bg-gray-900 text-white" : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {articles && articles.length > 0 ? (
        <Table>
          <thead>
            <tr>
              <Th>Title</Th>
              <Th>Status</Th>
              <Th>Origin</Th>
              <Th>Updated</Th>
              <Th>Published</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {articles.map((article) => (
              <tr key={article.id}>
                <Td>
                  <Link href={`/articles/${article.id}`} dir={rtl ? "rtl" : "ltr"} className="font-medium hover:underline">{article.title}</Link>
                </Td>
                <Td><ArticleStatusBadge status={article.status} /></Td>
                <Td className="text-gray-600">{article.origin}</Td>
                <Td className="whitespace-nowrap text-gray-600">{formatDateTime(article.updated_at, website.timezone)}</Td>
                <Td className="whitespace-nowrap text-gray-600">
                  {article.wp_post_url ? <a href={article.wp_post_url} target="_blank" rel="noreferrer" className="underline">{formatDateTime(article.published_at, website.timezone)}</a> : "—"}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState>
          No articles{filter !== "all" ? " with this status" : ""}.{" "}
          {!website.archived_at ? <Link href={`/websites/${websiteId}/articles/new`} className="underline">Write one</Link> : null}
        </EmptyState>
      )}
    </>
  );
}
