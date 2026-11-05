"use server";

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { removeArticleImage, uploadArticleImage } from "@/lib/storage/article-images";
import { readImageFile } from "@/lib/storage/image-file";
import { createClient } from "@/lib/supabase/server";
import { MAX_ARTICLE_IMAGE_BYTES, articleImageSchema, fieldErrorsFrom } from "@/lib/validation";

/** Same rule as article content: images are frozen once approved. */
const EDITABLE = ["draft", "in_review", "rejected"];

async function loadEditableArticle(articleId) {
  const user = await requireUser();
  const supabase = await createClient();
  // RLS returns nothing for articles on websites the user is not assigned to.
  const { data: article } = await supabase
    .from("articles")
    .select("id, website_id, status")
    .eq("id", articleId)
    .maybeSingle();
  if (!article) return { error: "Article not found" };
  if (!EDITABLE.includes(article.status))
    return { error: "Approved or published articles cannot be changed. Return it to draft first." };
  const { data: current } = await supabase
    .from("article_images")
    .select("id, storage_path")
    .eq("article_id", articleId)
    .eq("role", "featured")
    .maybeSingle();
  return { user, supabase, article, current };
}

export async function saveFeaturedImage(articleId, _prev, formData) {
  const { error: loadError, user, supabase, article, current } = await loadEditableArticle(articleId);
  if (loadError) return { error: loadError };
  const parsed = articleImageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };

  let path = null;
  try {
    const file = await readImageFile(formData.get("file"), MAX_ARTICLE_IMAGE_BYTES, "Image");
    if (!file && !current) return { error: "Choose an image", fieldErrors: { file: "Required" } };
    if (file) path = await uploadArticleImage(supabase, article, file);
  } catch (error) {
    return { error: error.message, fieldErrors: { file: error.message } };
  }

  // Any change forgets an earlier WordPress upload, so publishing sends the current version.
  const columns = { ...parsed.data, ...(path ? { storage_path: path, url: null } : {}), wp_media_id: null };
  const { error } = current
    ? await supabase.from("article_images").update(columns).eq("id", current.id)
    : await supabase.from("article_images").insert({
        ...columns,
        article_id: articleId,
        website_id: article.website_id,
        role: "featured",
        created_by: user.id,
      });
  if (error) {
    await removeArticleImage(supabase, path);
    return { error: error.message };
  }
  if (path && current) await removeArticleImage(supabase, current.storage_path);

  await recordAudit({
    action: path ? "article.image_uploaded" : "article.image_edited",
    entityType: "article",
    entityId: articleId,
    websiteId: article.website_id,
    actorId: user.id,
    details: { source_kind: parsed.data.source_kind, credit: parsed.data.credit },
  });
  revalidatePath(`/articles/${articleId}`);
  return { ok: true, message: "Featured image saved." };
}

/** Makes another stored image (e.g. the AI illustration instead of the source photo) the featured one. */
export async function chooseFeaturedImage(articleId, imageId) {
  const { error: loadError, user, supabase, article, current } = await loadEditableArticle(articleId);
  if (loadError) return { error: loadError };
  // One featured image per article: step the current one down first.
  if (current) {
    const { error } = await supabase
      .from("article_images")
      .update({ role: "option", wp_media_id: null })
      .eq("id", current.id);
    if (error) return { error: error.message };
  }
  const { data: chosen, error: chooseError } = await supabase
    .from("article_images")
    .update({ role: "featured", wp_media_id: null })
    .eq("id", imageId)
    .eq("article_id", articleId)
    .eq("role", "option")
    .select("id")
    .maybeSingle();
  if (!chosen) {
    if (current) await supabase.from("article_images").update({ role: "featured" }).eq("id", current.id);
    return { error: chooseError?.message ?? "That image is unavailable. Reload and try again." };
  }
  await recordAudit({
    action: "article.image_chosen",
    entityType: "article",
    entityId: articleId,
    websiteId: article.website_id,
    actorId: user.id,
    details: { image_id: imageId },
  });
  revalidatePath(`/articles/${articleId}`);
  return { ok: true, message: "Featured image changed." };
}

export async function removeFeaturedImage(articleId) {
  const { error: loadError, user, supabase, article, current } = await loadEditableArticle(articleId);
  if (loadError) return { error: loadError };
  if (!current) return { error: "There is no featured image to remove." };
  const { error } = await supabase.from("article_images").delete().eq("id", current.id);
  if (error) return { error: error.message };
  await removeArticleImage(supabase, current.storage_path);
  await recordAudit({
    action: "article.image_removed",
    entityType: "article",
    entityId: articleId,
    websiteId: article.website_id,
    actorId: user.id,
  });
  revalidatePath(`/articles/${articleId}`);
  return { ok: true, message: "Featured image removed." };
}

/**
 * Stores an image for the article body and returns the [image:<id>] line that places it. The body
 * keeps it only once the article is saved; publishing uploads it to WordPress with its credit.
 */
export async function addInlineImage(articleId, _prev, formData) {
  const { error: loadError, user, supabase, article } = await loadEditableArticle(articleId);
  if (loadError) return { error: loadError };
  const parsed = articleImageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };

  let path;
  try {
    const file = await readImageFile(formData.get("file"), MAX_ARTICLE_IMAGE_BYTES, "Image");
    if (!file) return { error: "Choose an image", fieldErrors: { file: "Required" } };
    path = await uploadArticleImage(supabase, article, file);
  } catch (error) {
    return { error: error.message, fieldErrors: { file: error.message } };
  }

  const { data: image, error } = await supabase
    .from("article_images")
    .insert({
      ...parsed.data,
      storage_path: path,
      article_id: articleId,
      website_id: article.website_id,
      role: "inline",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) {
    await removeArticleImage(supabase, path);
    return { error: error.message };
  }
  await recordAudit({
    action: "article.inline_image_added",
    entityType: "article",
    entityId: articleId,
    websiteId: article.website_id,
    actorId: user.id,
    details: { image_id: image.id, source_kind: parsed.data.source_kind, credit: parsed.data.credit },
  });
  return { ok: true, message: "Image added to the body. Save the article to keep it.", marker: `[image:${image.id}]` };
}
