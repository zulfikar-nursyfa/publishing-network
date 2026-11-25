import { Suspense } from "react";
import { z } from "zod";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRightLeft, ExternalLink, Eye, History, Info, Lock, Trash2 } from "lucide-react";
import { deletePrivateDraft, moveArticle, saveArticle } from "@/app/actions/articles";
import { RedirectNotice } from "@/components/action-notice";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import {
  Alert,
  ArticleStatusBadge,
  Badge,
  Card,
  CardSkeleton,
  DescriptionList,
  PageHeader,
  PublicationStatusBadge,
  buttonClass,
  formatDateTime,
  inputClass,
} from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatUsd, summariseAggregatedUsage } from "@/lib/costs";
import { ARTICLE_IMAGE_BUCKET } from "@/lib/storage/article-images";
import { createClient } from "@/lib/supabase/server";
import { nextFreeSlot, toLocalInput } from "@/lib/schedule";
import { formatSourceLines } from "@/lib/validation";
import { ArticleForm } from "../article-form";
import { ArticleTraffic } from "./article-traffic";
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
  if (!z.uuid().safeParse(articleId).success) notFound();
  const user = await requireUser();
  const { warning, from } = await searchParams;
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
      .select(
        "id, name, language, timezone, publish_times, text_direction, archived_at, wp_base_url, ga4_property_id, search_console_site",
      )
      .eq("id", article.website_id)
      .single(),
    supabase
      .from("article_sources")
      .select("url, title, publisher, official")
      .eq("article_id", articleId)
      .order("accessed_at"),
    supabase.from("publications").select("*").eq("article_id", articleId).maybeSingle(),
    supabase
      .from("audit_log")
      .select("id, action, actor_id, details, created_at")
      .eq("entity_type", "article")
      .eq("entity_id", articleId)
      .order("created_at", { ascending: false })
      .limit(20),
    article.origin === "automated"
      ? supabase.from("jobs").select("id, status").eq("article_id", articleId).maybeSingle()
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
  const actorIds = [
    ...new Set(
      [article.created_by, article.approved_by, ...(history ?? []).map((entry) => entry.actor_id)].filter((id) =>
        Boolean(id),
      ),
    ),
  ];
  const editable = ["draft", "in_review", "rejected"].includes(article.status);
  // Only an article that never reached WordPress moves (migration 57); RLS lists the user's websites.
  const movable = editable && !article.wp_post_id && !publication;
  const [{ data: usage }, { data: signed }, { data: actors }, schedule, { data: moveTargets }] = await Promise.all([
    draftJob ? supabase.rpc("job_usage_summary", { target_job: draftJob.id }) : { data: null },
    paths.length ? supabase.storage.from(ARTICLE_IMAGE_BUCKET).createSignedUrls(paths, 3600) : { data: [] },
    actorIds.length ? supabase.from("profiles").select("id, email, full_name").in("id", actorIds) : { data: [] },
    article.status === "approved" ? scheduleFor(supabase, article, website) : null,
    movable
      ? supabase
          .from("websites")
          .select("id, name")
          .eq("language", website.language)
          .is("archived_at", null)
          .neq("id", website.id)
          .order("name")
      : { data: [] },
  ]);
  const withPreview = (images ?? []).map((row) => ({
    ...row,
    previewUrl: signed?.find((entry) => entry.path === row.storage_path)?.signedUrl ?? row.url,
  }));

  const actorName = (id) => {
    const actor = actors?.find((row) => row.id === id);
    return actor ? actor.full_name || actor.email : id ? "Unknown user" : "System";
  };

  const officialSource = sources?.find((source) => source.official);
  const rtl = website.text_direction === "rtl";

  return (
    <>
      <PageHeader
        back={
          from === "review"
            ? { href: "/review", label: "Review queue" }
            : { href: `/websites/${website.id}`, label: website.name }
        }
        title={
          <span dir={rtl ? "rtl" : "ltr"} className="block">
            {article.title}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <ArticleStatusBadge status={article.status} />
            <Badge tone={article.origin === "automated" ? "purple" : "gray"}>{article.origin}</Badge>
            {article.private ? (
              <span title="Only you can see this draft until you submit it for review or approve it">
                <Badge tone="gray">private</Badge>
              </span>
            ) : null}
            {publication && publication.status !== "succeeded" ? (
              <PublicationStatusBadge status={publication.status} />
            ) : null}
          </span>
        }
        actions={
          <a
            href={`/articles/${articleId}/preview`}
            target="_blank"
            rel="noreferrer"
            title="Shows the last saved version"
            className={buttonClass("secondary")}
          >
            <Eye />
            Preview
          </a>
        }
      />

      {warning === "sources" ? (
        <RedirectNotice
          params={["warning"]}
          result={{ error: "The article was created but its sources could not be saved. Add them again below." }}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:gap-8">
        <div className="min-w-0 space-y-4">
          {draftJob ? (
            <Alert tone="info" title="AI draft requires editorial fact checking">
              <Link href={`/jobs/${draftJob.id}`} className="underline">
                Review the collected source evidence and AI checks
              </Link>{" "}
              before approving this article.
              {draftJob.status === "succeeded" ? (
                editable ? (
                  <span className="mt-2 block">
                    After editing, use <strong>Save and re-check</strong> below to fact-check the saved article again.
                  </span>
                ) : null
              ) : (
                <span className="mt-2 block font-medium">
                  Re-check in progress. Reload in a few minutes to see the updated warnings.
                </span>
              )}
            </Alert>
          ) : null}
          {!editable ? (
            <Alert tone="info" title={article.status === "approved" ? "Locked for publishing" : "Locked"}>
              {article.status === "published"
                ? "Live articles are locked. To correct one, unpublish it, return it to draft and publish it again after review."
                : article.status === "unpublished"
                  ? "Return the article to draft to edit it."
                  : "Approved content is locked so what was approved is what gets published. Return it to draft to edit."}
            </Alert>
          ) : null}
          <ArticleForm
            key={article.version}
            action={saveArticle.bind(null, articleId)}
            websiteId={website.id}
            articleId={articleId}
            values={{
              title: article.title,
              slug: article.slug,
              excerpt: article.excerpt,
              body: article.body,
              sources: formatSourceLines(sources ?? []),
              version: article.version,
              category_id: article.category_id,
              seo_title: article.seo_title,
              meta_description: article.meta_description,
              focus_keyword: article.focus_keyword,
              tags: (article.tags ?? []).join(", "),
            }}
            categories={(categories ?? []).filter(
              (category) => !category.archived_at || category.id === article.category_id,
            )}
            rtl={rtl}
            readOnly={!editable}
            canRecheck={editable && draftJob?.status === "succeeded"}
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
            websiteArchived={Boolean(website.archived_at)}
            wordpressConnected={Boolean(website.wp_base_url)}
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

          {article.private && article.created_by === user.id && article.status === "draft" ? (
            <ActionForm action={deletePrivateDraft.bind(null, articleId)}>
              <SubmitButton
                variant="danger-outline"
                className="w-full"
                pendingLabel="Deleting…"
                confirm="Delete this private draft with its sources and images? This cannot be undone."
                confirmLabel="Delete draft"
              >
                <Trash2 />
                Delete draft
              </SubmitButton>
            </ActionForm>
          ) : null}

          {moveTargets?.length ? (
            <Card icon={ArrowRightLeft} title="Move to another website">
              <ActionForm action={moveArticle.bind(null, articleId)} className="space-y-3">
                <select name="website_id" aria-label="Website" required defaultValue="" className={inputClass}>
                  <option value="" disabled>
                    Choose a website
                  </option>
                  {moveTargets.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.name}
                    </option>
                  ))}
                </select>
                <SubmitButton
                  variant="secondary"
                  size="sm"
                  pendingLabel="Moving…"
                  confirm="Move this article with its edits, SEO fields, sources and images? Save your edits first. Its category is kept only if the other website has one with the same slug."
                  confirmLabel="Move"
                >
                  <ArrowRightLeft />
                  Move article
                </SubmitButton>
              </ActionForm>
            </Card>
          ) : null}

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
                ...(publication?.live_check && article.status === "published"
                  ? [
                      {
                        label: "Live check",
                        value: publication.live_check.ok ? (
                          "Loads and can be indexed"
                        ) : (
                          <span className="block text-amber-700 dark:text-amber-300">
                            {publication.live_check.problems.join("; ")}
                          </span>
                        ),
                      },
                    ]
                  : []),
                {
                  label: "Official source",
                  value: officialSource ? (
                    <a href={officialSource.url} target="_blank" rel="noreferrer" className="hover:underline">
                      {officialSource.publisher || officialSource.title || officialSource.url}
                    </a>
                  ) : (
                    "None"
                  ),
                },
                ...(usage
                  ? [
                      {
                        label: "AI cost (est.)",
                        value: (
                          <Link href={`/jobs/${draftJob.id}`} className="hover:underline">
                            {formatUsd(summariseAggregatedUsage(usage).total)}
                          </Link>
                        ),
                      },
                    ]
                  : []),
                ...(article.unpublished_at
                  ? [{ label: "Unpublished", value: formatDateTime(article.unpublished_at, website.timezone) }]
                  : []),
              ]}
            />
            {article.review_note ? (
              <div className="mt-4 rounded-lg bg-muted/60 p-3 text-sm">
                <div className="mb-1 text-xs font-medium text-muted-foreground">Review note</div>
                <div className="whitespace-pre-wrap">{article.review_note}</div>
              </div>
            ) : null}
          </Card>

          <Suspense fallback={<CardSkeleton className="mb-0 h-40" />}>
            <ArticleTraffic supabase={supabase} article={article} website={website} />
          </Suspense>

          <Card icon={History} title="History">
            <Link
              href={`/activity?entity=${article.id}&website=${article.website_id}`}
              className="mb-3 inline-block text-sm font-medium text-primary"
            >
              View all article activity
            </Link>
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
