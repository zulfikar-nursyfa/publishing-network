/** Readable text, publication date and paywall detection for fetched HTML pages. */

const MAX_TEXT = 10_000;
// Typographic entities news sites use; accented letters usually arrive as numeric entities.
const NAMED_ENTITIES = {
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  hellip: "…",
  euro: "€",
  pound: "£",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  ccedil: "ç",
};

export function plainEvidence(html) {
  return (
    html
      // Asides hold related stories and promotions, whose facts belong to other events.
      .replace(/<(script|style|nav|header|footer|aside|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&(\w+);/g, (entity, name) => NAMED_ENTITIES[name] ?? entity)
      // "valoris&#233;" on French pages: an undecoded accent splits words and hides dates and quotes.
      .replace(/&#(x[0-9a-f]+|\d+);/gi, (entity, code) => {
        const point = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code);
        return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
      })
      .replace(/&amp;/gi, "&")
      // Postgres jsonb rejects \u0000, and other control characters are never useful evidence.
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_TEXT)
  );
}

// Bot checks and CAPTCHAs: drafting from one wrote an article about its arithmetic question (PM review 22 Nov).
const BOT_CHECK_TITLE =
  /captcha|human or (?:a )?bot|are you (?:a )?(?:human|robot)|just a moment|attention required|security check/i;
const BOT_CHECK_TEXT =
  /(?:confirm|verify|prove) (?:that )?you(?:'re| are) (?:a )?human|not a robot|solve this simple math problem|complete the security check|enable javascript and cookies to continue/i;

/** A reason to skip a bot check or CAPTCHA page, which stands in for the article, or null. */
export function botCheckReason(pageUrl, title, text) {
  return /captcha|bot-?challenge/i.test(new URL(pageUrl).pathname) ||
    BOT_CHECK_TITLE.test(title) ||
    BOT_CHECK_TEXT.test(text.slice(0, 2000))
    ? "Bot check or CAPTCHA page instead of the article"
    : null;
}

/** Publication date from common article metadata, or null when the page does not state one. */
export function publishedAt(html) {
  const found =
    html
      .match(
        /<meta\b[^>]*(?:property|name|itemprop)\s*=\s*["'](?:article:published_time|datePublished|date|pubdate|publish-date|dc\.date)["'][^>]*>/i,
      )?.[0]
      ?.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1] ??
    html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1] ??
    html.match(/<time\b[^>]*\bdatetime\s*=\s*["']([^"']+)["']/i)?.[1];
  const time = found ? Date.parse(found) : NaN;
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function restrictedAccess(node) {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some(restrictedAccess);
  return (
    node.isAccessibleForFree === false ||
    String(node.isAccessibleForFree).toLowerCase() === "false" ||
    (node.hasPart ? restrictedAccess(node.hasPart) : false)
  );
}

function metadataForPage(node, pageUrl) {
  const identities = [
    node.url,
    node["@id"],
    typeof node.mainEntityOfPage === "string" ? node.mainEntityOfPage : node.mainEntityOfPage?.["@id"],
  ].filter((value) => typeof value === "string");
  if (!identities.length) return true;
  return identities.some((identity) => {
    try {
      const candidate = new URL(identity, pageUrl);
      const current = new URL(pageUrl);
      return (
        candidate.hostname.replace(/^www\./, "") === current.hostname.replace(/^www\./, "") &&
        candidate.pathname.replace(/\/$/, "") === current.pathname.replace(/\/$/, "")
      );
    } catch {
      return false;
    }
  });
}

export function paywallBlockReason(html, articleHtml, pageUrl) {
  // Access flags belong to article metadata, not unrelated application defaults or recommendations.
  for (const match of html.matchAll(
    /<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    let root;
    try {
      root = JSON.parse(match[1]);
    } catch {
      continue;
    }
    const pending = [root];
    let inspected = 0;
    while (pending.length && inspected++ < 5000) {
      const node = pending.pop();
      if (!node || typeof node !== "object") continue;
      if (Array.isArray(node)) {
        pending.push(...node);
        continue;
      }
      const types = [node["@type"]]
        .flat()
        .filter((type) => typeof type === "string")
        .map((type) => type.split(/[\/#]/).at(-1));
      if (
        types.some((type) => /^(?:CreativeWork|WebPage|\w*Article|BlogPosting|Report)$/.test(type)) &&
        metadataForPage(node, pageUrl) &&
        restrictedAccess(node)
      ) {
        return "Paywalled: this article is marked as restricted.";
      }
      pending.push(...Object.values(node).filter((value) => value && typeof value === "object"));
    }
    if (pending.length) return "Could not verify article access: structured metadata is too complex.";
  }
  const visibleMarkup = articleHtml
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const restrictedClass =
    /^(?:paywall|subscription-wall|registration-wall)(?:$|[-_](?:gate|overlay|modal|prompt|blocked|restricted|content|container|preview))|(?:Paywall|SubscriptionWall|RegistrationWall)(?:Gate|Overlay|Modal|Prompt|Blocked|Restricted)/i;
  for (const match of visibleMarkup.matchAll(/\bclass\s*=\s*["']([^"']*)["']/gi)) {
    if (match[1].split(/\s+/).some((token) => restrictedClass.test(token))) {
      return "Paywalled: an article access gate is present.";
    }
  }
  if (
    /<meta\b(?=[^>]*\bitemprop\s*=\s*["']isAccessibleForFree["'])(?=[^>]*\bcontent\s*=\s*["']false["'])[^>]*>/i.test(
      html,
    )
  ) {
    return "Paywalled: this article is marked as restricted.";
  }
  const visibleText = plainEvidence(visibleMarkup);
  if (
    /\b(?:subscribe|sign\s*in|log\s*in|register)\s+to\s+(?:continue\s+reading|read\s+(?:this\s+article|the\s+(?:full|rest\s+of\s+the)\s+article)|unlock\s+(?:this|the\s+full)\s+article)\b/i.test(
      visibleText,
    )
  ) {
    return "Paywalled: reading the article requires a subscription or login.";
  }
  return null;
}
