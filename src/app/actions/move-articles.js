"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { moveArticle } from "@/app/actions/articles";
import { recordAudit } from "@/lib/audit";
import { requireWebsite } from "@/lib/auth";
import { zonedTimeToUtc } from "@/lib/schedule";
import { ARTICLE_IMAGE_BUCKET } from "@/lib/storage/article-images";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UNPUBLISHED = ["draft", "in_review", "rejected"];
// Stays under the page's maxDuration; what is left is picked up by running the move again.
const RUN_BUDGET_MS = 240_000;

const inputSchema = z.object({
  website_id: z.uuid({ error: "Choose a website." }),
  category_id: z.uuid({ error: "Choose a category." }),
  scope: z.enum(["all", "selected"]),
  article_ids: z.array(z.uuid()),
  mode: z.enum(["now", "schedule"]),
  start: z.string(),
  interval: z.coerce.number().int().min(1).max(1440),
});

/**
 * Moves a website's articles to another website of the same niche and language. Published articles
 * are copied (copy_article, migration 58): the old post stays live, the copy is approved without
 * review and published at once or on a schedule with its original date. Articles that never reached
 * WordPress move with moveArticle and keep their status. Running it again continues where it stopped.
 */
export async function moveArticles(sourceId, formData) {
  const { user, website: source } = await requireWebsite(sourceId);
  const parsed = inputSchema.safeParse({
    ...Object.fromEntries(formData),
    article_ids: formData.getAll("article_id"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;
  const supabase = await createClient();
  // RLS returns only websites the user is assigned to.
  const { data: target } = await supabase.from("websites").select("*").eq("id", input.website_id).maybeSingle();
  if (!target || target.id === source.id || target.archived_at)
    return { error: "Choose another website you can access." };
  if (target.language !== source.language) return { error: `${target.name} is in another language.` };
  if (target.niche_id !== source.niche_id) return { error: `${target.name} is in another niche.` };
  if (input.scope === "selected" && !input.article_ids.length) return { error: "Tick the articles to move." };

  let next = new Date();
  if (input.mode === "schedule") {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.start)) return { error: "Choose when publishing starts." };
    const [day, time] = input.start.split("T");
    next = zonedTimeToUtc(day, time, target.timezone);
    if (next <= new Date()) return { error: "Choose a start time in the future." };
  }

  const [{ data: articles, error }, { data: copies, error: copiesError }] = await Promise.all([
    supabase
      .from("articles")
      .select("id, status, wp_post_id, published_at")
      .eq("website_id", source.id)
      .in("status", ["published", ...UNPUBLISHED])
      .order("published_at", { nullsFirst: false })
      .order("created_at"),
    supabase
      .from("articles")
      .select("copied_from, scheduled_for")
      .eq("website_id", target.id)
      .not("copied_from", "is", null),
  ]);
  if (error || copiesError) return { error: (error ?? copiesError).message };
  const copied = new Set(copies.map((row) => row.copied_from));
  const picked = new Set(input.article_ids);
  // Published articles are copied; the others move only if they never reached WordPress.
  const todo = articles.filter(
    (article) =>
      !copied.has(article.id) &&
      (input.scope === "all" || picked.has(article.id)) &&
      (article.status === "published") === Boolean(article.wp_post_id),
  );
  if (!todo.length) return { error: "Nothing left to move." };

  // A continued run schedules after the copies an earlier run already queued.
  const interval = input.interval * 60_000;
  const lastQueued = Math.max(0, ...copies.map((row) => Date.parse(row.scheduled_for ?? "") || 0));
  if (input.mode === "schedule" && lastQueued >= next.getTime()) next = new Date(lastQueued + interval);

  const deadline = Date.now() + RUN_BUDGET_MS;
  const moveForm = new FormData();
  moveForm.set("website_id", target.id);
  const result = { copied: 0, moved: 0, failed: [] };
  for (const article of todo) {
    if (Date.now() >= deadline) break;
    if (article.status === "published") {
      const outcome = await copyArticle(article.id, target.id, input.category_id, next, user.id);
      if (outcome.error) result.failed.push(outcome.error);
      else {
        result.copied += 1;
        if (input.mode === "schedule") next = new Date(next.getTime() + interval);
      }
    } else {
      const outcome = await moveArticle(article.id, moveForm);
      if (outcome.error) result.failed.push(outcome.error);
      else result.moved += 1;
    }
  }

  const left = todo.length - result.copied - result.moved - result.failed.length;
  await recordAudit({
    action: "articles.bulk_moved",
    entityType: "website",
    entityId: source.id,
    websiteId: source.id,
    actorId: user.id,
    details: { to_website_id: target.id, to_website: target.name, mode: input.mode, ...result, left },
  });
  revalidatePath(`/websites/${source.id}`);
  revalidatePath(`/websites/${target.id}`);
  const parts = [`${result.copied} published articles copied to ${target.name}`, `${result.moved} drafts moved`];
  if (result.failed.length) parts.push(`${result.failed.length} skipped (first: ${result.failed[0]})`);
  if (left > 0) parts.push(`${left} left: run the move again to continue`);
  return result.copied || result.moved
    ? { ok: true, message: `${parts.join(", ")}.` }
    : { error: `${parts.join(", ")}.` };
}

/** Copies the files first, so a failed copy_article leaves no row pointing at a missing image. */
async function copyArticle(articleId, targetId, categoryId, publishAt, actorId) {
  const admin = createAdminClient();
  const newId = randomUUID();
  const { data: images, error } = await admin
    .from("article_images")
    .select("storage_path")
    .eq("article_id", articleId)
    .in("role", ["featured", "inline"])
    .not("storage_path", "is", null);
  if (error) return { error: error.message };
  const bucket = admin.storage.from(ARTICLE_IMAGE_BUCKET);
  const copied = [];
  const undo = () => (copied.length ? bucket.remove(copied) : null);
  for (const { storage_path: from } of images) {
    const to = `${targetId}/${newId}/${from.split("/").pop()}`;
    const { error: copyError } = await bucket.copy(from, to);
    if (copyError) {
      await undo();
      return { error: `Could not copy an image: ${copyError.message}` };
    }
    copied.push(to);
  }
  const { error: rpcError } = await admin.rpc("copy_article", {
    source_article: articleId,
    target_website: targetId,
    new_article: newId,
    fallback_category: categoryId,
    publish_at: publishAt.toISOString(),
    actor: actorId,
  });
  if (rpcError) {
    await undo();
    return { error: rpcError.message };
  }
  await recordAudit({
    action: "article.copied",
    entityType: "article",
    entityId: newId,
    websiteId: targetId,
    actorId,
    details: { from_article_id: articleId, publish_at: publishAt.toISOString(), images: copied.length },
  });
  return {};
}
