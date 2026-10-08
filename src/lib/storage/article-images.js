import "server-only";
import { randomUUID } from "node:crypto";
import { ImageFileError } from "./image-file";

export const ARTICLE_IMAGE_BUCKET = "article-images";

/** Stores an image at "<website id>/<article id>/<uuid>.<ext>" (the path the storage policies expect). */
export async function uploadArticleImage(db, article, image) {
  const path = `${article.website_id}/${article.id}/${randomUUID()}.${image.extension}`;
  const { error } = await db.storage.from(ARTICLE_IMAGE_BUCKET)
    .upload(path, image.bytes, { contentType: image.contentType, upsert: false });
  if (error) throw new ImageFileError(error.message === "Bucket not found"
    ? "Image storage is not set up yet. Apply migration 28 before adding images."
    : `Could not upload the image: ${error.message}`);
  return path;
}

export async function removeArticleImage(db, path) {
  if (!path) return true;
  const { error } = await db.storage.from(ARTICLE_IMAGE_BUCKET).remove([path]);
  return !error;
}

/** Downloads a stored image for publishing. Uses the secret-key client. */
export async function downloadArticleImage(db, path) {
  const { data, error } = await db.storage.from(ARTICLE_IMAGE_BUCKET).download(path);
  if (error || !data) throw new Error(`Could not read the featured image from storage: ${error?.message ?? "missing file"}`);
  return { bytes: Buffer.from(await data.arrayBuffer()), contentType: data.type, filename: path.split("/").pop() };
}
