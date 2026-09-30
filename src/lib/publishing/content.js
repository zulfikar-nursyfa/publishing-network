/**
 * @typedef {Object} ArticleSourceRef
 * @property {string} url
 * @property {string|null} [title]
 * @property {string|null} [publisher]
 */

const BLOCK_TAG = /<(p|h[1-6]|ul|ol|li|blockquote|figure|img|table|div|section|pre|hr|!-- wp:)[\s>/]/i;

/**
 * Turns the dashboard's article body into WordPress post content. Bodies that already contain
 * block-level HTML are passed through; plain text becomes paragraphs (blank line = new
 * paragraph). Sources are appended so attribution travels with the published article.
 * @param {string} body
 * @param {ArticleSourceRef[]} sources
 * @param {"en"|"ar"} language
 * @returns {string}
 */
export function toWordPressContent(
  body,
  sources,
  language,
) {
  const trimmed = body.trim();
  const main = BLOCK_TAG.test(trimmed) ? trimmed : paragraphs(trimmed);
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
    .map((block) => `<p>${escapeHtml(block).replace(/\r?\n/g, "<br>")}</p>`)
    .join("\n");
}

export function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
