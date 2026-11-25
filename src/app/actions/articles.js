"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requireUser, requireWebsite } from "@/lib/auth";

import { generateForEditor } from "@/lib/ai/editor";
import { GeminiError } from "@/lib/ai/gemini";
import { seoColumns, seoSchema } from "@/lib/automation/draft-checks";
import { textModelFor } from "@/lib/automation/drafting/context";
import { seoPrompt } from "@/lib/automation/drafting/prompts";
import { bodyText } from "@/lib/publishing/content";
import { publishArticle } from "@/lib/publishing/publish";
import { createSupabasePublishStore } from "@/lib/publishing/supabase-store";
import { unpublishArticle } from "@/lib/publishing/unpublish";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ARTICLE_IMAGE_BUCKET } from "@/lib/storage/article-images";
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

function seoFields(data) {
  return {
    seo_title: data.seo_title,
    meta_description: data.meta_description,
    focus_keyword: data.focus_keyword,
    tags: data.tags,
  };
}

async function replaceSources(supabase, article, sources) {
  // Official flags come from the draft pipeline; keep them for URLs the editor did not remove.
  const { data: previous } = await supabase
    .from("article_sources")
    .select("url")
    .eq("article_id", article.id)
    .eq("official", true);
  const official = new Set((previous ?? []).map((source) => source.url));
  const { error: deleteError } = await supabase.from("article_sources").delete().eq("article_id", article.id);
  if (deleteError) return deleteError.message;
  if (sources.length === 0) return null;
  const { error } = await supabase.from("article_sources").insert(
    sources.map((source) => ({
      ...source,
      official: official.has(source.url),
      article_id: article.id,
      website_id: article.website_id,
    })),
  );
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
      // Only the author sees it until they submit or approve it (see migration 47).
      private: true,
      title: parsed.data.title,
      slug: parsed.data.slug ? slugify(parsed.data.slug) || null : null,
      excerpt: parsed.data.excerpt,
      body: parsed.data.body,
      category_id: parsed.data.category_id,
      ...seoFields(parsed.data),
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
    // No title: website members can read the activity log, and the draft is private.
    details: { origin: "manual", private: true },
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
      ...seoFields(parsed.data),
      updated_by: user.id,
      human_edited_at: new Date().toISOString(),
    })
    .eq("id", articleId)
    .eq("version", expectedVersion)
    .in("status", EDITABLE)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!updated)
    return { error: "This article was changed by someone else since you opened it. Reload to see the latest version." };

  const sourceError = await replaceSources(supabase, article, sources.sources);
  if (sourceError) return { error: `Article saved, but sources could not be saved: ${sourceError}` };

  await recordAudit({
    action: "article.edited",
    entityType: "article",
    entityId: articleId,
    websiteId: article.website_id,
    actorId: user.id,
  });
  refresh(article);
  // "Save and re-check": the re-check reads the saved article and sources, so it runs only after a save.
  if (formData.get("intent") === "recheck") {
    const recheck = await recheckArticle(articleId);
    return recheck.error ? { error: `Saved, but not re-checked: ${recheck.error}` } : recheck;
  }
  return { ok: true, message: "Saved." };
}

/** Deletes the caller's own private draft with its sources, images and stored files. */
export async function deletePrivateDraft(articleId) {
  const { user, supabase, article } = await loadArticle(articleId);
  if (!article) return { error: "Article not found" };
  if (!article.private || article.created_by !== user.id || article.status !== "draft") {
    return { error: "Only your own private drafts can be deleted." };
  }
  // Files first: the storage policy needs the article row to authorise the removal.
  const { data: images } = await supabase.from("article_images").select("storage_path").eq("article_id", articleId);
  const paths = (images ?? []).map((image) => image.storage_path).filter(Boolean);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(ARTICLE_IMAGE_BUCKET).remove(paths);
    if (storageError) return { error: `Could not remove the draft's images: ${storageError.message}` };
  }
  const { data: deleted, error } = await supabase
    .from("articles")
    .delete()
    .eq("id", articleId)
    .eq("private", true)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!deleted) return { error: "The draft changed while you were working. Reload and try again." };

  await recordAudit({
    action: "article.deleted",
    entityType: "article",
    entityId: articleId,
    websiteId: article.website_id,
    actorId: user.id,
    details: { origin: article.origin, private: true },
  });
  refresh(article);
  redirect(`/websites/${article.website_id}`);
}

/**
 * Moves an article that never reached WordPress to another website the user can access, keeping its
 * text, SEO fields, sources and images (migrations 57 and 59). Image files are copied to the new website's
 * folder before the move and the old ones removed after it, so a failure never loses an image.
 */
export async function moveArticle(articleId, formData) {
  const { user, supabase, article } = await loadArticle(articleId);
  if (!article) return { error: "Article not found" };
  if (![...EDITABLE, "approved"].includes(article.status) || article.wp_post_id) {
    return { error: "Only articles that were never published can be moved." };
  }
  const targetId = String(formData.get("website_id") ?? "");
  // RLS returns only websites the user is assigned to.
  const { data: target } = z.uuid().safeParse(targetId).success
    ? await supabase.from("websites").select("id, name").eq("id", targetId).maybeSingle()
    : { data: null };
  if (!target) return { error: "Choose a website you can access." };

  const admin = createAdminClient();
  const { data: images, error: imageError } = await admin
    .from("article_images")
    .select("storage_path")
    .eq("article_id", articleId)
    .not("storage_path", "is", null);
  if (imageError) return { error: imageError.message };
  const files = images.map(({ storage_path: from }) => ({ from, to: from.replace(/^[^/]+\//, `${target.id}/`) }));
  const bucket = admin.storage.from(ARTICLE_IMAGE_BUCKET);
  const copied = [];
  for (const { from, to } of files) {
    const { error } = await bucket.copy(from, to);
    if (error) {
      if (copied.length) await bucket.remove(copied);
      return { error: `Could not copy the article's images: ${error.message}` };
    }
    copied.push(to);
  }
  const { error } = await admin.rpc("move_article", {
    target_article: articleId,
    target_website: target.id,
    expected_version: article.version,
    actor: user.id,
  });
  if (error) {
    if (copied.length) await bucket.remove(copied);
    return { error: error.message };
  }
  // Left-over old files are harmless, so a failed removal does not fail the move.
  if (files.length) await bucket.remove(files.map(({ from }) => from));

  const { data: moved } = await supabase.from("articles").select("category_id").eq("id", articleId).maybeSingle();
  await recordAudit({
    action: "article.moved",
    entityType: "article",
    entityId: articleId,
    websiteId: article.website_id,
    actorId: user.id,
    details: { to_website_id: target.id, to_website: target.name, images: files.length },
  });
  refresh(article);
  revalidatePath(`/websites/${target.id}`);
  return {
    ok: true,
    message:
      article.category_id && !moved?.category_id
        ? `Moved to ${target.name}. Choose a category from that website before publishing.`
        : `Moved to ${target.name}.`,
  };
}

/**
 * AI-written SEO title, meta description, focus keyphrase and tags from the form's (unsaved) title
 * and body. Nothing is saved: the form shows them for the editor to check and save.
 */
export async function suggestSeo(websiteId, formData) {
  const { user, website } = await requireWebsite(websiteId);
  if (website.archived_at) return { error: "This website is archived." };
  const title = String(formData.get("title") ?? "").trim();
  const body = bodyText(String(formData.get("body") ?? ""));
  if (!title || body.length < 200) return { error: "Write the title and at least a paragraph of the body first." };

  const admin = createAdminClient();
  const { data: network } = await admin.from("network_settings").select("default_ai_model").single();
  try {
    const seo = await generateForEditor(admin, websiteId, {
      model: textModelFor({ website, network: network ?? {} }),
      operation: "seo",
      prompt: seoPrompt({ title, body: body.slice(0, 30_000) }, website.language),
      schema: seoSchema,
    });
    await recordAudit({
      action: "article.seo_generated",
      entityType: "website",
      entityId: websiteId,
      websiteId,
      actorId: user.id,
      details: { title },
    });
    const columns = seoColumns(seo);
    return {
      ok: true,
      message: "SEO fields filled in. Check them, then save.",
      seo: { ...columns, tags: columns.tags.join(", ") },
    };
  } catch (error) {
    if (error instanceof GeminiError) return { error: `Could not generate the SEO fields: ${error.message}` };
    throw error;
  }
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
    from: ["in_review", "approved", "rejected", "unpublished"],
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

  // Re-approval is a fresh decision: give a failed publication its automatic slot retries back.
  let warning = "";
  if (name === "approve") {
    const { error: resetError } = await createAdminClient()
      .from("publications")
      .update({ attempt_count: 0 })
      .eq("article_id", articleId)
      .eq("status", "failed");
    if (resetError)
      warning = ` Its publishing retries could not be reset (${resetError.message}); use Retry publishing.`;
  }

  await recordAudit({
    action: transition.action,
    entityType: "article",
    entityId: articleId,
    websiteId: article.website_id,
    actorId: user.id,
    details: { from: article.status, to: transition.to, note },
  });
  refresh(article);
  return { ok: true, message: `Article is now ${transition.to.replace("_", " ")}.${warning}` };
}

/**
 * Sends the article's finished draft job through the re-check steps (see drafting/recheck.js):
 * its current sources are read again and the saved text is fact-checked, replacing the old
 * verification warnings. Costs one AI call, plus an image when the article still has none.
 */
export async function recheckArticle(articleId) {
  const { user, article } = await loadArticle(articleId);
  if (!article) return { error: "Article not found" };
  if (!EDITABLE.includes(article.status)) return { error: "Return the article to draft before re-checking it." };
  const admin = createAdminClient();
  const { data: job, error } = await admin
    .from("jobs")
    .update({
      step: "recollect",
      status: "queued",
      attempt_count: 0,
      last_error: null,
      waiting_kind: null,
      waiting_reason: null,
      waiting_since: null,
      run_after: new Date().toISOString(),
    })
    .eq("article_id", articleId)
    .eq("website_id", article.website_id)
    .eq("status", "succeeded")
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!job) return { error: "A re-check is already running, or this article has no AI draft job." };
  await recordAudit({
    action: "article.recheck_queued",
    entityType: "article",
    entityId: articleId,
    websiteId: article.website_id,
    actorId: user.id,
    details: { job_id: job.id, version: article.version },
  });
  refresh(article);
  return { ok: true, message: "Re-check queued. It usually finishes within a few minutes; reload to see the result." };
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
      return {
        error: `Publishing failed ${result.attempts} times. Fix the error, then use Retry publishing.`,
      };
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

/** Takes a live article down (its WordPress post becomes a draft). Any website member may do this. */
export async function unpublishArticleAction(articleId, _prev, formData) {
  const { user, article } = await loadArticle(articleId);
  if (!article) return { error: "Article not found" };
  const reason = String(formData.get("reason") ?? "").trim() || null;

  const result = await unpublishArticle(article.id, user.id, reason, createSupabasePublishStore(), (connection) =>
    createWordPressClient(connection),
  );
  refresh(article);
  if (result.outcome === "failed") return { error: `Could not unpublish: ${result.error}` };
  if (result.outcome === "already_unpublished") return { ok: true, message: "Already unpublished." };
  return {
    ok: true,
    message: result.postFound
      ? "Unpublished. The WordPress post is now a draft."
      : "Unpublished. No live WordPress post was found, it had already been removed there.",
  };
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
