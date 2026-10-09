import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink, History, Info, Lock } from "lucide-react";
import { saveArticle } from "@/app/actions/articles";
import {
  Alert,
  ArticleStatusBadge,
  Badge,
  Card,
  DescriptionList,
  PageHeader,
  PublicationStatusBadge,
  formatDateTime,
} from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ARTICLE_IMAGE_BUCKET } from "@/lib/storage/article-images";
import { createClient } from "@/lib/supabase/server";
import { nextFreeSlot, toLocalInput } from "@/lib/schedule";
import { formatSourceLines } from "@/lib/validation";
import { ArticleForm } from "../article-form";
import { FeaturedImage } from "./featured-image";
import { WorkflowPanel } from "./workflow-panel";

// Publishing makes several WordPress calls in one request; allow for a slow host.
export const maxDuration = 60;

function Person({ when, who }) {
  return (
    <span className="block">
      {when}
      <span className="block text-xs text-muted-foreground">by {who}</span>
    </span>
  );
}

/** Schedule panel data: the current schedule, or the next slot not already taken by another article. */
async function scheduleFor(supabase, article, website) {
  const { data: scheduled } = await supabase
    .from("articles")
    .select("scheduled_for")
    .eq("website_id", website.id)
    .eq("status", "approved")
    .not("scheduled_for", "is", null);
  const now = new Date();
  const taken = new Set((scheduled ?? []).map((row) => new Date(row.scheduled_for).toISOString()));
  const next =
    nextFreeSlot(now, website.publish_times, website.timezone, taken) ??
    new Date(Math.ceil(now / 3_600_000) * 3_600_000 + 3_600_000);
  return {
    timezone: website.timezone,
    label: article.scheduled_for ? formatDateTime(article.scheduled_for, website.timezone) : null,
    defaultValue: toLocalInput(next, website.timezone),
  };
}

export default async function ArticlePage({ params, searchParams }) {
  const { articleId } = await params;
  const user = await requireUser();
  const warning = (await searchParams).warning;
  const supabase = await createClient();

  const { data: article } = await supabase.from("articles").select("*").eq("id", articleId).maybeSingle();
  if (!article) notFound();

  const [
    { data: website },
    { data: sources },
    { data: publication },
    { data: history },
    { data: draftJob },
    { data: categories },
    { data: images },
  ] = await Promise.all([
    supabase
      .from("websites")
      .select("id, name, timezone, publish_times, text_direction, archived_at")
      .eq("id", article.website_id)
      .single(),
    supabase.from("article_sources").select("url, title, publisher").eq("article_id", articleId).order("accessed_at"),
    supabase.from("publications").select("*").eq("article_id", articleId).maybeSingle(),
    supabase
      .from("audit_log")
      .select("id, action, actor_id, details, created_at")
      .eq("entity_type", "article")
      .eq("entity_id", articleId)
      .order("created_at", { ascending: false })
      .limit(20),
    article.origin === "automated"
      ? supabase.from("jobs").select("id").eq("article_id", articleId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("categories")
      .select("id, name, archived_at")
      .eq("website_id", article.website_id)
      .order("sort_order")
      .order("name"),
    supabase
      .from("article_images")
      .select("*")
      .eq("article_id", articleId)
      .in("role", ["featured", "option"])
      .order("created_at"),
  ]);
  if (!website) notFound();
  const paths = (images ?? []).map((row) => row.storage_path).filter(Boolean);
  const { data: signed } = paths.length
    ? await supabase.storage.from(ARTICLE_IMAGE_BUCKET).createSignedUrls(paths, 3600)
    : { data: [] };
  const withPreview = (images ?? []).map((row) => ({
    ...row,
    previewUrl: signed?.find((entry) => entry.path === row.storage_path)?.signedUrl ?? row.url,
  }));

  const actorIds = [
    ...new Set(
      [article.created_by, article.approved_by, ...(history ?? []).map((entry) => entry.actor_id)].filter((id) =>
        Boolean(id),
      ),
    ),
  ];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, email, full_name").in("id", actorIds)
    : { data: [] };
  const actorName = (id) => {
    const actor = actors?.find((row) => row.id === id);
    return actor ? actor.full_name || actor.email : id ? "Unknown user" : "System";
  };

  const schedule = article.status === "approved" ? await scheduleFor(supabase, article, website) : null;
  const editable = ["draft", "in_review", "rejected"].includes(article.status);
  const rtl = website.text_direction === "rtl";

  return (
    <>
      <PageHeader
        back={{ href: `/websites/${website.id}`, label: website.name }}
        title={
          <span dir={rtl ? "rtl" : "ltr"} className="block">
            {article.title}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <ArticleStatusBadge status={article.status} />
            <Badge tone={article.origin === "automated" ? "purple" : "gray"}>{article.origin}</Badge>
            {publication && publication.status !== "succeeded" ? (
              <PublicationStatusBadge status={publication.status} />
            ) : null}
          </span>
        }
      />

      {warning === "sources" ? (
        <Alert tone="warning" className="mb-6">
          The article was created but its sources could not be saved. Add them again below.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:gap-8">
        <div className="min-w-0 space-y-4">
          {draftJob ? (
            <Alert tone="info" title="AI draft requires editorial fact checking">
              <Link href={`/jobs/${draftJob.id}`} className="underline">
                Review the collected source evidence and AI checks
              </Link>{" "}
              before approving this article.
            </Alert>
          ) : null}
          {!editable ? (
            <Alert tone="info" title={article.status === "published" ? "Published" : "Locked for publishing"}>
              {article.status === "published"
                ? "Published articles are managed in WordPress. Edit them there directly."
                : "Approved content is locked so what was approved is what gets published. Return it to draft to edit."}
            </Alert>
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
              category_id: article.category_id,
            }}
            categories={(categories ?? []).filter(
              (category) => !category.archived_at || category.id === article.category_id,
            )}
            rtl={rtl}
            readOnly={!editable}
            submitLabel="Save changes"
          />
          <FeaturedImage
            articleId={articleId}
            image={withPreview.find((row) => row.role === "featured") ?? null}
            options={withPreview.filter((row) => row.role === "option")}
            readOnly={!editable}
          />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <WorkflowPanel
            articleId={articleId}
            status={article.status}
            isAdmin={user.isAdmin}
            websiteArchived={Boolean(website.archived_at)}
            publication={
              publication
                ? {
                    status: publication.status,
                    attemptCount: publication.attempt_count,
                    maxAttempts: publication.max_attempts,
                    lastError: publication.last_error,
                  }
                : null
            }
            schedule={schedule}
          />

          <Card icon={Info} title="Details">
            <DescriptionList
              items={[
                {
                  label: "Created",
                  value: (
                    <Person
                      when={formatDateTime(article.created_at, website.timezone)}
                      who={actorName(article.created_by)}
                    />
                  ),
                },
                {
                  label: "Approved",
                  value: article.approved_at ? (
                    <Person
                      when={formatDateTime(article.approved_at, website.timezone)}
                      who={actorName(article.approved_by)}
                    />
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "Published",
                  value: article.wp_post_url ? (
                    <span className="block">
                      {formatDateTime(article.published_at, website.timezone)}
                      <a
                        href={article.wp_post_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 flex items-center gap-1 text-xs font-medium text-primary hover:underline sm:justify-end"
                      >
                        View post #{article.wp_post_id}
                        <ExternalLink className="size-3" />
                      </a>
                    </span>
                  ) : (
                    "—"
                  ),
                },
              ]}
            />
            {article.review_note ? (
              <div className="mt-4 rounded-lg bg-muted/60 p-3 text-sm">
                <div className="mb-1 text-xs font-medium text-muted-foreground">Review note</div>
                <div className="whitespace-pre-wrap">{article.review_note}</div>
              </div>
            ) : null}
          </Card>

          <Card icon={History} title="History">
            {history && history.length > 0 ? (
              <ol className="relative space-y-4 border-l pl-5">
                {history.map((entry, index) => (
                  <li key={entry.id} className="relative">
                    <span
                      className={`absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full ring-4 ring-card ${index === 0 ? "bg-primary" : "bg-muted-foreground/40"}`}
                    />
                    <div className="text-sm font-medium capitalize">
                      {entry.action.replace("article.", "").replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {actorName(entry.actor_id)} · {formatDateTime(entry.created_at, website.timezone)}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="size-3.5" />
                No activity yet.
              </p>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
