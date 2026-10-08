import "server-only";
import { randomUUID } from "node:crypto";
import { LOGO_BUCKET, MAX_LOGO_BYTES } from "@/lib/website-branding";
import { ImageFileError, readImageFile } from "./image-file";

export { ImageFileError as LogoUploadError };

export const prepareLogo = (file) => readImageFile(file, MAX_LOGO_BYTES, "Logo");

export async function uploadLogo(db, websiteId, logo) {
  const path = `${websiteId}/logo-${randomUUID()}.${logo.extension}`;
  const bucket = db.storage.from(LOGO_BUCKET);
  const { error } = await bucket.upload(path, logo.bytes, { contentType: logo.contentType, cacheControl: "31536000", upsert: false });
  if (error) throw new ImageFileError(error.message === "Bucket not found"
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
