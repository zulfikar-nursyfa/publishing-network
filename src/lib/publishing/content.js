/**
 * @typedef {Object} ArticleSourceRef
 * @property {string} url
 * @property {string|null} [title]
 * @property {string|null} [publisher]
 *
 * @typedef {{src: string, altText?: string|null, caption?: string|null, credit?: string|null, sourceKind: string, wpMediaId?: number|null}} InlineImage
 */

const BLOCK_TAG = /<(p|h[1-6]|ul|ol|li|blockquote|figure|img|table|div|section|pre|hr|!-- wp:)[\s>/]/i;
// Inline markup kept in plain-text bodies: links from the editor's Link tool, bold and italic.
const INLINE_TAG = /<a href="https?:\/\/[^"<>\s]+">|<\/a>|<\/?(?:strong|em|b|i)>/gi;
// An image placed in the body by the editor's Image tool, on its own line (paragraph).
const IMAGE_MARKER = /(?:<p>\s*)?\[image:([0-9a-f-]{36})\](?:\s*<\/p>)?/gi;

/** Ids of the inline images the body places, in order, without repeats. */
export function inlineImageIds(body) {
  return [...new Set([...body.matchAll(IMAGE_MARKER)].map((match) => match[1].toLowerCase()))];
}

/**
 * Visible credit for a featured image. AI illustrations are always labelled, so they are never
 * presented as photographs of a real event.
 * @param {{sourceKind: string, credit?: string|null}} image
 * @param {"en"|"ar"} language
 */
export function imageCredit(image, language) {
  const ar = language === "ar";
  if (image.sourceKind === "ai_generated")
    return ar ? "رسم توضيحي مُنشأ بالذكاء الاصطناعي" : "AI-generated illustration";
  return image.credit ? `${ar ? "الصورة" : "Image"}: ${image.credit}` : null;
}

/**
 * Turns the dashboard's article body into WordPress post content. Bodies that already contain
 * block-level HTML are passed through; plain text becomes paragraphs (blank line = new
 * paragraph). The image credit and sources are appended so attribution travels with the post.
 * @param {string} body
 * @param {ArticleSourceRef[]} sources
 * @param {"en"|"ar"} language
 * @param {{sourceKind: string, credit?: string|null}|null} [image]
 * @param {Record<string, InlineImage>} [inlineImages] By image id; markers without one are dropped.
 * @returns {string}
 */
export function toWordPressContent(body, sources, language, image = null, inlineImages = {}) {
  const trimmed = body.trim();
  const credit = image ? imageCredit(image, language) : null;
  const main =
    (BLOCK_TAG.test(trimmed) ? trimmed : paragraphs(trimmed)).replace(IMAGE_MARKER, (_marker, id) =>
      figure(inlineImages[id.toLowerCase()], language),
    ) + (credit ? `\n<p class="pn-image-credit">${escapeHtml(credit)}</p>` : "");
  if (sources.length === 0) return main;

  const heading = language === "ar" ? "المصادر" : "Sources";
  const items = sources
    .map((source) => {
      const label = source.title || source.publisher || source.url;
      const suffix = source.title && source.publisher ? ` — ${escapeHtml(source.publisher)}` : "";
      return `<li><a href="${escapeAttribute(source.url)}" rel="nofollow noopener" target="_blank">${escapeHtml(label)}</a>${suffix}</li>`;
    })
    .join("");
  return `${main}\n<h3 class="pn-sources-heading">${heading}</h3>\n<ul class="pn-sources">${items}</ul>`;
}

function paragraphs(text) {
  if (!text) return "";
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${inlineHtml(block).replace(/\r?\n/g, "<br>")}</p>`)
    .join("\n");
}

function inlineHtml(text) {
  let html = "";
  let last = 0;
  for (const match of text.matchAll(INLINE_TAG)) {
    html += escapeHtml(text.slice(last, match.index)) + match[0];
    last = match.index + match[0].length;
  }
  return html + escapeHtml(text.slice(last));
}

/** @param {InlineImage|undefined} image @param {"en"|"ar"} language */
function figure(image, language) {
  if (!image?.src) return "";
  const caption = [image.caption, imageCredit(image, language)].filter(Boolean).join(" — ");
  const mediaClass = image.wpMediaId ? ` class="wp-image-${image.wpMediaId}"` : "";
  return `<figure class="wp-block-image"><img src="${escapeAttribute(image.src)}" alt="${escapeAttribute(image.altText ?? "")}"${mediaClass}>${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure>`;
}

export function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
