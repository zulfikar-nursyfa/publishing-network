import "server-only";
import { randomUUID } from "node:crypto";
import { LOGO_BUCKET, LOGO_MIME_TYPES, MAX_LOGO_BYTES } from "@/lib/website-branding";

export class LogoUploadError extends Error {}

/** Check bytes as well as the declared MIME type; never use the supplied filename as a path. */
export async function prepareLogo(file) {
  if (file === null || file === undefined || file === "") return null;
  // Multipart/RSC decoding can return another File implementation, a Blob, or an empty string.
  // Validate the binary interface instead of comparing constructors across runtimes.
  const binary = typeof file === "object" && typeof file.arrayBuffer === "function"
    && Number.isSafeInteger(file.size) && file.size >= 0 && typeof file.type === "string";
  if (!binary) throw new LogoUploadError("Choose a PNG, JPEG or WebP image.");
  if (file.size === 0 && (!file.name || (file.name === "blob" && ["", "application/octet-stream"].includes(file.type)))) return null;
  if (!LOGO_MIME_TYPES.includes(file.type)) throw new LogoUploadError("Choose a PNG, JPEG or WebP image.");
  if (file.size === 0 || file.size > MAX_LOGO_BYTES) throw new LogoUploadError("Logo must be a non-empty image, at most 2 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size || bytes.length > MAX_LOGO_BYTES) throw new LogoUploadError("Logo must be a non-empty image, at most 2 MB.");
  const png = bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString("ascii", 12, 16) === "IHDR";
  const jpeg = bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.length >= 16 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  const actualType = png ? "image/png" : jpeg ? "image/jpeg" : webp ? "image/webp" : null;
  if (actualType !== file.type) throw new LogoUploadError("The file contents do not match a supported image format.");
  return { bytes, contentType: actualType, extension: png ? "png" : jpeg ? "jpg" : "webp" };
}

export async function uploadLogo(db, websiteId, logo) {
  const path = `${websiteId}/logo-${randomUUID()}.${logo.extension}`;
  const bucket = db.storage.from(LOGO_BUCKET);
  const { error } = await bucket.upload(path, logo.bytes, { contentType: logo.contentType, cacheControl: "31536000", upsert: false });
  if (error) throw new LogoUploadError(error.message === "Bucket not found"
    ? "Logo storage is not set up yet. Apply migration 23 before uploading a logo."
    : "Could not upload the logo. Check the website logo bucket and its upload permissions.");
  const { data } = bucket.getPublicUrl(path);
  return { logo_path: path, logo_url: data.publicUrl };
}

/** Only files generated for this website may be cleaned up, never external/other-site logos. */
export async function removeLogo(db, websiteId, path) {
  if (!path || !path.startsWith(`${websiteId}/`) || !/^logo-[0-9a-f-]{36}\.(png|jpg|webp)$/.test(path.slice(websiteId.length + 1))) return true;
  const { error } = await db.storage.from(LOGO_BUCKET).remove([path]);
  return !error;
}
