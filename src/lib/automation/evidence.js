import { allowedByRobots } from "./robots";
import { paywallBlockReason, plainEvidence, publishedAt } from "./page-text";
import { EvidenceError, isFetchableUrl, MAX_BYTES, pageTooLarge, publicRequest } from "./public-fetch";

export { robotsAllows } from "./robots";
export { paywallBlockReason, plainEvidence, publishedAt } from "./page-text";
export { EvidenceError, fetchPublicImage, isFetchableUrl, isPublicIPv4, readResearchResponse } from "./public-fetch";

// Grounded search results are Google redirect links; the destination is checked on the next hop.
export const SEARCH_REDIRECT_HOST = "vertexaisearch.cloud.google.com";

export const hostOf = (url) => new URL(url).hostname.replace(/^www\./, "");

/** Configured source for a page's domain, used for the publisher name and official (primary) status. */
export function sourceForUrl(value, sources) {
  try {
    const host = hostOf(value);
    return sources.find((source) => source.active && hostOf(source.url) === host) ?? null;
  } catch {
    return null;
  }
}

const REDIRECT_STATUSES = [301, 302, 303, 307, 308];
const MAX_REDIRECTS = 3;
const MIN_TEXT_LENGTH = 300;

/** The article part of a page: the <article> with most text (others are teaser cards), else <main>, else the body. */
function articleHtml(html) {
  const article = [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)]
    .map((match) => match[1])
    .sort((a, b) => plainEvidence(b).length - plainEvidence(a).length)[0];
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  return article ?? main ?? html;
}

/** Reads one public page: HTTPS only, robots.txt respected, bounded body/time, redirects checked individually. */
export async function collectEvidence(value, sources, { requestImpl = publicRequest, robots = new Map() } = {}) {
  const deadline = Date.now() + 20_000;
  let url = new URL(value);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    if (!isFetchableUrl(url.href)) {
      throw new EvidenceError("Only HTTPS pages without credentials or custom ports are read");
    }
    if (url.hostname !== SEARCH_REDIRECT_HOST && !(await allowedByRobots(url, requestImpl, robots))) {
      throw new EvidenceError(`${url.hostname} does not allow automated reading of this page (robots.txt)`);
    }

    const response = await requestImpl(url, Math.max(1, deadline - Date.now()));
    if (REDIRECT_STATUSES.includes(response.status)) {
      if (!response.headers.location) throw new EvidenceError("Redirect has no destination");
      url = new URL(response.headers.location, url);
      continue;
    }
    if (response.status !== 200) {
      const retryable = response.status === 429 || response.status >= 500;
      throw new EvidenceError(`Page returned HTTP ${response.status}`, retryable);
    }
    if (!/text\/(html|plain)/i.test(response.headers["content-type"] ?? "")) {
      throw new EvidenceError("Page is not HTML or plain text");
    }
    if (Buffer.byteLength(response.body, "utf8") > MAX_BYTES) throw pageTooLarge();

    const article = articleHtml(response.body);
    const accessBlock = paywallBlockReason(response.body, article, url.href);
    if (accessBlock) throw new EvidenceError(accessBlock);
    const text = plainEvidence(article);
    if (text.length < MIN_TEXT_LENGTH) throw new EvidenceError("Page has too little readable text");

    const source = sourceForUrl(url.href, sources);
    const pageTitle = response.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? hostOf(url.href);
    return {
      url: url.href,
      source_id: source?.id ?? null,
      publisher: source?.name ?? hostOf(url.href),
      title: plainEvidence(pageTitle).slice(0, 250),
      primary: ["newsroom", "government"].includes(source?.kind),
      published_at: publishedAt(response.body),
      text,
      accessed_at: new Date().toISOString(),
    };
  }
  throw new EvidenceError("Too many redirects");
}
