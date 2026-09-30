import Link from "next/link";
import { ArticleStatusBadge, Badge, ButtonLink, ConnectionBadge, EmptyState, PageHeader, Stat, Table, Td, Th, formatDateTime } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function OverviewPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: websites }, { data: stats }, { data: recent }, { data: failures }] = await Promise.all([
    supabase.from("websites").select("id, name, domain, language, daily_quota, automation_paused, wp_connection_status, archived_at").is("archived_at", null).order("name"),
    supabase.from("website_article_stats").select("*"),
    supabase
      .from("articles")
      .select("id, title, status, website_id, published_at, updated_at, wp_post_url")
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase
      .from("publications")
      .select("article_id, website_id, last_error, attempt_count, max_attempts, updated_at")
      .eq("status", "failed")
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);

  const statsBySite = new Map((stats ?? []).map((row) => [row.website_id, row]));
  const siteName = new Map((websites ?? []).map((site) => [site.id, site.name]));
  const totals = (stats ?? []).reduce(
    (sum, row) => ({
      inReview: sum.inReview + Number(row.in_review),
      approved: sum.approved + Number(row.approved),
      today: sum.today + Number(row.published_today),
      week: sum.week + Number(row.published_7d),
      failed: sum.failed + Number(row.failed_publications),
    }),
    { inReview: 0, approved: 0, today: 0, week: 0, failed: 0 },
  );

  return (
    <>
      <PageHeader
        title="Overview"
        description={user.isAdmin ? "All websites in the network." : "Websites you are assigned to."}
        actions={user.isAdmin ? <ButtonLink href="/websites/new">Add website</ButtonLink> : null}
      />

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Pending review" value={totals.inReview} href="/review" />
        <Stat label="Ready to publish" value={totals.approved} />
        <Stat label="Published today" value={totals.today} hint="In each site's timezone" />
        <Stat label="Published 7 days" value={totals.week} />
        <Stat label="Failed publishing" value={totals.failed} />
        <Stat label="AI spend (est.)" value="—" hint="Starts when automation is enabled" />
      </div>

      <h2 className="mb-3 text-lg font-semibold">Websites</h2>
      {websites && websites.length > 0 ? (
        <div className="mb-8">
          <Table>
            <thead>
              <tr>
                <Th>Website</Th>
                <Th>Connection</Th>
                <Th>Automation</Th>
                <Th className="text-right">In review</Th>
                <Th className="text-right">Approved</Th>
                <Th className="text-right">Published today</Th>
                <Th className="text-right">Failed</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {websites.map((site) => {
                const row = statsBySite.get(site.id);
                return (
                  <tr key={site.id}>
                    <Td>
                      <Link href={`/websites/${site.id}`} className="font-medium hover:underline">{site.name}</Link>
                      <div className="text-xs text-gray-500">{site.domain} · {site.language === "ar" ? "Arabic" : "English"}</div>
                    </Td>
                    <Td><ConnectionBadge status={site.wp_connection_status} /></Td>
                    <Td>{site.automation_paused ? <Badge>paused</Badge> : <Badge tone="green">{site.daily_quota}/day</Badge>}</Td>
                    <Td className="text-right tabular-nums">{row?.in_review ?? 0}</Td>
                    <Td className="text-right tabular-nums">{row?.approved ?? 0}</Td>
                    <Td className="text-right tabular-nums">{row?.published_today ?? 0}</Td>
                    <Td className="text-right tabular-nums">{Number(row?.failed_publications ?? 0) > 0 ? <span className="font-semibold text-red-600">{row?.failed_publications}</span> : 0}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      ) : (
        <div className="mb-8">
          <EmptyState>
            {user.isAdmin ? (
              <>No websites yet. <Link href="/websites/new" className="underline">Add the first website</Link>.</>
            ) : (
              "You are not assigned to any websites yet. Ask an administrator to add you."
            )}
          </EmptyState>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold">Recent articles</h2>
          {recent && recent.length > 0 ? (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
              {recent.map((article) => (
                <li key={article.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/articles/${article.id}`} className="block truncate font-medium hover:underline">{article.title}</Link>
                    <div className="text-xs text-gray-500">{siteName.get(article.website_id) ?? "Archived website"} · {formatDateTime(article.updated_at)}</div>
                  </div>
                  <ArticleStatusBadge status={article.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No articles yet.</EmptyState>
          )}
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold">Publishing failures</h2>
          {failures && failures.length > 0 ? (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
              {failures.map((failure) => (
                <li key={failure.article_id} className="px-4 py-3">
                  <Link href={`/articles/${failure.article_id}`} className="font-medium hover:underline">
                    {siteName.get(failure.website_id) ?? "Website"}: attempt {failure.attempt_count} of {failure.max_attempts}
                  </Link>
                  <p className="mt-0.5 line-clamp-2 text-xs text-red-700">{failure.last_error}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No failed publishing attempts.</EmptyState>
          )}
        </div>
      </div>
    </>
  );
}
