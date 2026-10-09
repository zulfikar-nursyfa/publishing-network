/** Readable text, publication date and paywall detection for fetched HTML pages. */

const MAX_TEXT = 10_000;

export function plainEvidence(html) {
  return (
    html
      .replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      // Postgres jsonb rejects \u0000, and other control characters are never useful evidence.
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_TEXT)
  );
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
