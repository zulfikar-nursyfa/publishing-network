import "server-only";

export class ImageFileError extends Error {}

const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

/**
 * Reads an uploaded PNG, JPEG or WebP, checking bytes as well as the declared MIME type.
 * Returns null when no file was chosen. Never use the supplied filename as a path.
 */
export async function readImageFile(file, maxBytes, label) {
  if (file === null || file === undefined || file === "") return null;
  // Multipart/RSC decoding can return another File implementation, a Blob, or an empty string.
  // Validate the binary interface instead of comparing constructors across runtimes.
  const binary =
    typeof file === "object" &&
    typeof file.arrayBuffer === "function" &&
    Number.isSafeInteger(file.size) &&
    file.size >= 0 &&
    typeof file.type === "string";
  if (!binary) throw new ImageFileError("Choose a PNG, JPEG or WebP image.");
  if (file.size === 0 && (!file.name || (file.name === "blob" && ["", "application/octet-stream"].includes(file.type))))
    return null;
  if (!IMAGE_MIME_TYPES.includes(file.type)) throw new ImageFileError("Choose a PNG, JPEG or WebP image.");
  const tooBig = `${label} must be a non-empty image, at most ${maxBytes / 1048576} MB.`;
  if (file.size === 0 || file.size > maxBytes) throw new ImageFileError(tooBig);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size || bytes.length > maxBytes) throw new ImageFileError(tooBig);
  const image = sniffImage(bytes);
  if (image?.contentType !== file.type)
    throw new ImageFileError("The file contents do not match a supported image format.");
  return image;
}

/** The image's real type from its first bytes, or null when it is not PNG, JPEG or WebP. */
export function sniffImage(bytes) {
  const png =
    bytes.length >= 24 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.toString("ascii", 12, 16) === "IHDR";
  const jpeg = bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    bytes.length >= 16 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!png && !jpeg && !webp) return null;
  return {
    bytes,
    contentType: png ? "image/png" : jpeg ? "image/jpeg" : "image/webp",
    extension: png ? "png" : jpeg ? "jpg" : "webp",
  };
}
