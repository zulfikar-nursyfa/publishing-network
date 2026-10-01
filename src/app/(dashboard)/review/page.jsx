import Link from "next/link";
import { Inbox } from "lucide-react";
import { ArticleStatusBadge, Badge, EmptyState, PageHeader, Table, Td, Th, formatDateTime, linkClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Review queue" };

function OriginBadge({ origin }) {
  return origin === "automated" ? <Badge tone="purple">automated</Badge> : <Badge>manual</Badge>;
}

export default async function ReviewPage() {
  await requireUser();
  const supabase = await createClient();

  const [{ data: articles }, { data: websites }] = await Promise.all([
    supabase
      .from("articles")
      .select("id, title, status, origin, website_id, submitted_at, updated_at")
      .in("status", ["in_review", "approved"])
      .order("status", { ascending: false })
      .order("submitted_at", { ascending: true, nullsFirst: false }),
    supabase.from("websites").select("id, name, text_direction, timezone"),
  ]);
  const siteById = new Map((websites ?? []).map((site) => [site.id, site]));
  const inReview = (articles ?? []).filter((article) => article.status === "in_review").length;

  return (
    <>
      <PageHeader
        title="Review queue"
        description="Articles waiting for review, oldest first, then approved articles waiting to be published."
        actions={
          articles && articles.length > 0 ? (
            <div className="flex gap-2">
              <Badge tone="amber" dot>{inReview} in review</Badge>
              <Badge tone="blue" dot>{articles.length - inReview} approved</Badge>
            </div>
          ) : null
        }
      />
      {articles && articles.length > 0 ? (
        <Table>
          <thead>
            <tr>
              <Th>Article</Th>
              <Th className="hidden md:table-cell">Website</Th>
              <Th>Status</Th>
              <Th className="hidden lg:table-cell">Origin</Th>
              <Th className="hidden sm:table-cell">Submitted</Th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => {
              const site = siteById.get(article.website_id);
              return (
                <tr key={article.id}>
                  <Td className="max-w-md">
                    <Link href={`/articles/${article.id}`} dir={site?.text_direction ?? "ltr"} className={`${linkClass} line-clamp-2`}>{article.title}</Link>
                    <div className="mt-0.5 text-xs text-muted-foreground md:hidden">
                      {site?.name ?? "—"}
                      <span className="sm:hidden"> · {formatDateTime(article.submitted_at ?? article.updated_at, site?.timezone)}</span>
                    </div>
                  </Td>
                  <Td className="hidden text-muted-foreground md:table-cell">{site?.name ?? "—"}</Td>
                  <Td><ArticleStatusBadge status={article.status} /></Td>
                  <Td className="hidden lg:table-cell"><OriginBadge origin={article.origin} /></Td>
                  <Td className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">{formatDateTime(article.submitted_at ?? article.updated_at, site?.timezone)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      ) : (
        <EmptyState icon={Inbox} title="Inbox zero">Nothing is waiting for review.</EmptyState>
      )}
    </>
  );
}
