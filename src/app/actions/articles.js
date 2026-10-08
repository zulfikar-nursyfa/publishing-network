"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { requireAdmin, requireUser, requireWebsite } from "@/lib/auth";

import { publishArticle } from "@/lib/publishing/publish";
import { createSupabasePublishStore } from "@/lib/publishing/supabase-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createWordPressClient } from "@/lib/wordpress/client";
import { zonedTimeToUtc } from "@/lib/schedule";
import { articleSchema, fieldErrorsFrom, parseSourceLines, slugify } from "@/lib/validation";

/** Statuses in which the article's content may be edited. Approved content is frozen. */
const EDITABLE = ["draft", "in_review", "rejected"];

function refresh(article) {
  revalidatePath(`/articles/${article.id}`);
  revalidatePath(`/websites/${article.website_id}`);
  revalidatePath("/review");
  revalidatePath("/");
}

async function loadArticle(articleId) {
  const user = await requireUser();
  const supabase = await createClient();
  // RLS returns nothing for articles on websites the user is not assigned to.
  const { data: article } = await supabase.from("articles").select("*").eq("id", articleId).maybeSingle();
  return { user, supabase, article };
}

async function replaceSources(
  supabase,
  article,
  sources,
) {
  const { error: deleteError } = await supabase.from("article_sources").delete().eq("article_id", article.id);
  if (deleteError) return deleteError.message;
  if (sources.length === 0) return null;
  const { error } = await supabase
    .from("article_sources")
    .insert(sources.map((source) => ({ ...source, article_id: article.id, website_id: article.website_id })));
  return error?.message ?? null;
}

export async function createArticle(websiteId, _prev, formData) {
  const { user } = await requireWebsite(websiteId);
  const parsed = articleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };
  const sources = parseSourceLines(parsed.data.sources);
  if ("error" in sources) return { error: sources.error, fieldErrors: { sources: sources.error } };

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data: article, error } = await supabase
    .from("articles")
    .insert({
      website_id: websiteId,
      origin: "manual",
      status: "draft",
      title: parsed.data.title,
      slug: parsed.data.slug ? slugify(parsed.data.slug) || null : null,
      excerpt: parsed.data.excerpt,
      body: parsed.data.body,
      category_id: parsed.data.category_id,
      created_by: user.id,
      updated_by: user.id,
      human_edited_at: now,
    })
    .select("id, website_id")
    .single();
  if (error || !article) return { error: error?.message ?? "Could not create article" };

  const sourceError = await replaceSources(supabase, article, sources.sources);
  await recordAudit({
    action: "article.created",
    entityType: "article",
    entityId: article.id,
    websiteId,
    actorId: user.id,
    details: { title: parsed.data.title, origin: "manual" },
  });
  refresh(article);
  redirect(`/articles/${article.id}${sourceError ? "?warning=sources" : ""}`);
}

export async function saveArticle(articleId, _prev, formData) {
  const { user, supabase, article } = await loadArticle(articleId);
  if (!article) return { error: "Article not found" };
  if (!EDITABLE.includes(article.status)) {
    return { error: "Approved or published articles cannot be edited. Return it to draft first." };
  }

  const parsed = articleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };
  const sources = parseSourceLines(parsed.data.sources);
  if ("error" in sources) return { error: sources.error, fieldErrors: { sources: sources.error } };

  const expectedVersion = Number(formData.get("version"));
  // Optimistic lock: fails if anyone (a colleague or automation) changed the article since it was loaded.
  const { data: updated, error } = await supabase
    .from("articles")
    .update({
      title: parsed.data.title,
      slug: parsed.data.slug ? slugify(parsed.data.slug) || null : null,
      excerpt: parsed.data.excerpt,
      body: parsed.data.body,
      category_id: parsed.data.category_id,
      updated_by: user.id,
      human_edited_at: new Date().toISOString(),
    })
    .eq("id", articleId)
    .eq("version", expectedVersion)
    .in("status", EDITABLE)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!updated) return { error: "This article was changed by someone else since you opened it. Reload to see the latest version." };

  const sourceError = await replaceSources(supabase, article, sources.sources);
  if (sourceError) return { error: `Article saved, but sources could not be saved: ${sourceError}` };

  await recordAudit({ action: "article.edited", entityType: "article", entityId: articleId, websiteId: article.website_id, actorId: user.id });
  refresh(article);
  return { ok: true, message: "Saved." };
}

const TRANSITIONS = {
  submit: {
    from: ["draft", "rejected"],
    to: "in_review",
    action: "article.submitted",
    extra: () => ({ submitted_at: new Date().toISOString(), review_note: null }),
  },
  approve: {
    from: ["draft", "in_review"],
    to: "approved",
    action: "article.approved",
    extra: (userId, note) => ({ approved_by: userId, approved_at: new Date().toISOString(), review_note: note }),
  },
  reject: {
    from: ["in_review", "approved"],
    to: "rejected",
    action: "article.rejected",
    extra: (_userId, note) => ({ review_note: note, approved_by: null, approved_at: null }),
  },
  return_to_draft: {
    from: ["in_review", "approved", "rejected"],
    to: "draft",
    action: "article.returned_to_draft",
    extra: () => ({ approved_by: null, approved_at: null }),
  },
};

export async function transitionArticle(articleId, _prev, formData) {
  const name = String(formData.get("transition"));
  const transition = TRANSITIONS[name];
  if (!transition) return { error: "Unknown action" };

  const { user, supabase, article } = await loadArticle(articleId);
  if (!article) return { error: "Article not found" };
  if (!transition.from.includes(article.status)) {
    return { error: `Cannot ${name.replace(/_/g, " ")} an article that is ${article.status.replace("_", " ")}` };
  }

  const note = String(formData.get("note") ?? "").trim() || null;
  if (name === "reject" && !note) return { error: "Add a note explaining why the article is rejected" };

  // The status filter makes the transition atomic: a concurrent change makes this update a no-op.
  const { data: updated, error } = await supabase
    .from("articles")
    .update({ status: transition.to, ...(transition.extra?.(user.id, note) ?? {}) })
    .eq("id", articleId)
    .eq("status", article.status)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!updated) return { error: "The article changed while you were working. Reload and try again." };

  await recordAudit({
    action: transition.action,
    entityType: "article",
    entityId: articleId,
    websiteId: article.website_id,
    actorId: user.id,
    details: { from: article.status, to: transition.to, note },
  });
  refresh(article);
  return { ok: true, message: `Article is now ${transition.to.replace("_", " ")}.` };
}

/** Admin only: clears the retry counter after the cause of repeated failures has been fixed. */
export async function resetPublicationAttempts(articleId) {
  const user = await requireAdmin();
  const admin = createAdminClient();
  const { data: publication } = await admin
    .from("publications")
    .update({ attempt_count: 0, status: "failed", locked_until: null })
    .eq("article_id", articleId)
    .neq("status", "succeeded")
    .select("website_id, last_error")
    .maybeSingle();
  if (!publication) return;
  await recordAudit({
    action: "publication.attempts_reset",
    entityType: "article",
    entityId: articleId,
    websiteId: publication.website_id,
    actorId: user.id,
    details: { last_error: publication.last_error },
  });
  refresh({ id: articleId, website_id: publication.website_id });
}

export async function publishArticleAction(articleId, _prev) {
  const { user, article } = await loadArticle(articleId);
  if (!article) return { error: "Article not found" };
  if (article.status === "published") return { ok: true, message: "Already published." };
  if (article.status !== "approved") return { error: "Approve the article before publishing." };

  const result = await publishArticle(article.id, user.id, createSupabasePublishStore(), (connection) =>
    createWordPressClient(connection),
  );
  refresh(article);

  switch (result.outcome) {
    case "published":
      return {
        ok: true,
        message: result.reconciled
          ? "Published. An earlier attempt had already created the post in WordPress, so it was reused rather than duplicated."
          : "Published to WordPress.",
      };
    case "already_published":
      return { ok: true, message: "Already published." };
    case "in_progress":
      return { error: "A publishing attempt is already running for this article. Wait a moment and reload." };
    case "attempts_exhausted":
      return { error: `Publishing failed ${result.attempts} times. An administrator must review the error and reset the attempts.` };
    case "blocked":
      return { error: result.reason };
    case "failed":
      return {
        error: result.retryable
          ? `Publishing failed, you can retry: ${result.error}`
          : `Publishing failed: ${result.error}`,
      };
  }
}

/** Sets or clears the time an approved article is published. The time is in the website's timezone. */
export async function scheduleArticle(articleId, _prev, formData) {
  const { user, supabase, article } = await loadArticle(articleId);
  if (!article) return { error: "Article not found" };
  if (article.status !== "approved") return { error: "Only approved articles can be scheduled." };

  let scheduledFor = null;
  if (formData.get("intent") !== "unschedule") {
    const value = String(formData.get("scheduled_for") ?? "");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return { error: "Choose a date and time." };
    const { data: website } = await supabase.from("websites").select("timezone").eq("id", article.website_id).single();
    const [day, time] = value.split("T");
    scheduledFor = zonedTimeToUtc(day, time, website.timezone);
    if (scheduledFor <= new Date()) return { error: "Choose a time in the future." };
  }

  const { data: updated, error } = await supabase
    .from("articles")
    .update({ scheduled_for: scheduledFor?.toISOString() ?? null })
    .eq("id", articleId)
    .eq("status", "approved")
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!updated) return { error: "The article changed while you were working. Reload and try again." };

  await recordAudit({
    action: scheduledFor ? "article.scheduled" : "article.unscheduled",
    entityType: "article",
    entityId: articleId,
    websiteId: article.website_id,
    actorId: user.id,
    details: { scheduled_for: scheduledFor?.toISOString() ?? null },
  });
  refresh(article);
  return { ok: true, message: scheduledFor ? "Article scheduled." : "Schedule removed." };
}
