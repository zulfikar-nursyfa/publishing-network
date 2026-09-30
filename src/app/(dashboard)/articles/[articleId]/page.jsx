import Link from "next/link";
import { notFound } from "next/navigation";
import { saveArticle } from "@/app/actions/articles";
import { ArticleStatusBadge, Badge, Card, PageHeader, PublicationStatusBadge, formatDateTime } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatSourceLines } from "@/lib/validation";
import { ArticleForm } from "../article-form";
import { WorkflowPanel } from "./workflow-panel";

// Publishing makes several WordPress calls in one request; allow for a slow host.
export const maxDuration = 60;

export default async function ArticlePage({ params, searchParams }) {
  const { articleId } = await params;
  const user = await requireUser();
  const warning = (await searchParams).warning;
  const supabase = await createClient();

  const { data: article } = await supabase.from("articles").select("*").eq("id", articleId).maybeSingle();
  if (!article) notFound();

  const [{ data: website }, { data: sources }, { data: publication }, { data: history }] = await Promise.all([
    supabase.from("websites").select("id, name, timezone, text_direction, archived_at").eq("id", article.website_id).single(),
    supabase.from("article_sources").select("url, title, publisher").eq("article_id", articleId).order("accessed_at"),
    supabase.from("publications").select("*").eq("article_id", articleId).maybeSingle(),
    supabase
      .from("audit_log")
      .select("id, action, actor_id, details, created_at")
      .eq("entity_type", "article")
      .eq("entity_id", articleId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (!website) notFound();

  const actorIds = [...new Set([article.created_by, article.approved_by, ...(history ?? []).map((entry) => entry.actor_id)].filter((id) => Boolean(id)))];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, email, full_name").in("id", actorIds)
    : { data: [] };
  const actorName = (id) => {
    const actor = actors?.find((row) => row.id === id);
    return actor ? actor.full_name || actor.email : id ? "Unknown user" : "System";
  };

  const editable = ["draft", "in_review", "rejected"].includes(article.status);
  const rtl = website.text_direction === "rtl";

  return (
    <>
      <PageHeader
        title={<span dir={rtl ? "rtl" : "ltr"}>{article.title}</span>}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/websites/${website.id}`} className="underline">{website.name}</Link>
            <ArticleStatusBadge status={article.status} />
            <Badge>{article.origin}</Badge>
            {publication && publication.status !== "succeeded" ? <PublicationStatusBadge status={publication.status} /> : null}
          </span>
        }
      />

      {warning === "sources" ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The article was created but its sources could not be saved. Add them again below.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {!editable ? (
            <p className="mb-3 text-sm text-gray-600">
              {article.status === "published"
                ? "Published articles are managed in WordPress. Edit them there directly."
                : "Approved content is locked so what was approved is what gets published. Return it to draft to edit."}
            </p>
          ) : null}
          <ArticleForm
            key={article.version}
            action={saveArticle.bind(null, articleId)}
            values={{
              title: article.title,
              slug: article.slug,
              excerpt: article.excerpt,
              body: article.body,
              sources: formatSourceLines(sources ?? []),
              version: article.version,
            }}
            rtl={rtl}
            readOnly={!editable}
            submitLabel="Save changes"
          />
        </div>

        <div className="space-y-6">
          <WorkflowPanel
            articleId={articleId}
            status={article.status}
            isAdmin={user.isAdmin}
            websiteArchived={Boolean(website.archived_at)}
            publication={publication ? {
              status: publication.status,
              attemptCount: publication.attempt_count,
              maxAttempts: publication.max_attempts,
              lastError: publication.last_error,
            } : null}
          />

          <Card title="Details">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-gray-500">Created</dt>
              <dd>{formatDateTime(article.created_at, website.timezone)}<br /><span className="text-xs text-gray-500">by {actorName(article.created_by)}</span></dd>
              <dt className="text-gray-500">Approved</dt>
              <dd>{article.approved_at ? <>{formatDateTime(article.approved_at, website.timezone)}<br /><span className="text-xs text-gray-500">by {actorName(article.approved_by)}</span></> : "—"}</dd>
              <dt className="text-gray-500">Published</dt>
              <dd>
                {article.wp_post_url ? (
                  <>
                    {formatDateTime(article.published_at, website.timezone)}
                    <br />
                    <a href={article.wp_post_url} target="_blank" rel="noreferrer" className="text-xs underline">View post #{article.wp_post_id}</a>
                  </>
                ) : "—"}
              </dd>
              {article.review_note ? (
                <>
                  <dt className="text-gray-500">Review note</dt>
                  <dd className="whitespace-pre-wrap">{article.review_note}</dd>
                </>
              ) : null}
            </dl>
          </Card>

          <Card title="History">
            {history && history.length > 0 ? (
              <ol className="space-y-2 text-sm">
                {history.map((entry) => (
                  <li key={entry.id}>
                    <div className="font-medium">{entry.action.replace("article.", "").replace(/_/g, " ")}</div>
                    <div className="text-xs text-gray-500">{actorName(entry.actor_id)} · {formatDateTime(entry.created_at, website.timezone)}</div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-600">No activity yet.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
