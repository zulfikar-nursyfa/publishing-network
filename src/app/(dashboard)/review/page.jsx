import Link from "next/link";
import { ArticleStatusBadge, Badge, EmptyState, PageHeader, Table, Td, Th, formatDateTime } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Review queue" };

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

  return (
    <>
      <PageHeader
        title="Review queue"
        description="Articles waiting for review, oldest first, then approved articles waiting to be published."
      />
      {articles && articles.length > 0 ? (
        <Table>
          <thead>
            <tr>
              <Th>Article</Th>
              <Th>Website</Th>
              <Th>Status</Th>
              <Th>Origin</Th>
              <Th>Submitted</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {articles.map((article) => {
              const site = siteById.get(article.website_id);
              return (
                <tr key={article.id}>
                  <Td>
                    <Link href={`/articles/${article.id}`} dir={site?.text_direction ?? "ltr"} className="font-medium hover:underline">{article.title}</Link>
                  </Td>
                  <Td>{site?.name ?? "—"}</Td>
                  <Td><ArticleStatusBadge status={article.status} /></Td>
                  <Td>{article.origin === "automated" ? <Badge tone="purple">automated</Badge> : <Badge>manual</Badge>}</Td>
                  <Td className="whitespace-nowrap text-gray-600">{formatDateTime(article.submitted_at ?? article.updated_at, site?.timezone)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      ) : (
        <EmptyState>Nothing waiting for review.</EmptyState>
      )}
    </>
  );
}
