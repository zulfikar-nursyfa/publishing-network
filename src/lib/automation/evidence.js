import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_TEXT = 10_000;
const USER_AGENT = "PublishingNetworkBot/1.0";
// Grounded search results are Google redirect links; the destination is checked on the next hop.
const SEARCH_REDIRECT_HOST = "vertexaisearch.cloud.google.com";
export class EvidenceError extends Error {
  constructor(message, retryable = false) { super(message); this.retryable = retryable; }
}

export const hostOf = (url) => new URL(url).hostname.replace(/^www\./, "");

export function isFetchableUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443");
  } catch { return false; }
}

/** Configured source for a page's domain, used for the publisher name and official (primary) status. */
export function sourceForUrl(value, sources) {
  try {
    const host = hostOf(value);
    return sources.find((source) => source.active && hostOf(source.url) === host) ?? null;
  } catch { return null; }
}

export function isPublicIPv4(address) {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split(".").map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    || (a === 192 && b === 0) || (a === 192 && b === 2) || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113));
}

const pageTooLarge = () => new EvidenceError("Page exceeds the 8 MiB download limit");

export function readResearchResponse(response) {
  return new Promise((resolve, reject) => {
    response.once("error", reject);
    response.once("aborted", () => reject(new EvidenceError("Response was interrupted", true)));
    const rejectOversize = () => {
      const error = pageTooLarge();
      // IncomingMessage.destroy() can emit "aborted" before "error".
      reject(error);
      response.destroy(error);
    };
    if (Number(response.headers["content-length"] ?? 0) > MAX_BYTES) {
      rejectOversize();
      return;
    }
    const chunks = [];
    let size = 0;
    response.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BYTES) rejectOversize();
      else chunks.push(chunk);
    });
    response.once("end", () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString("utf8") }));
  });
}

// Resolve once, validate every address, and pin the request to that answer to prevent DNS rebinding.
async function publicRequest(url, timeoutMs) {
  const signal = AbortSignal.timeout(timeoutMs);
  const addresses = await Promise.race([
    lookup(url.hostname, { all: true, family: 4 }),
    new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("Request timed out")), { once: true })),
  ]);
  if (!addresses.length || addresses.some((entry) => !isPublicIPv4(entry.address))) throw new Error("URL resolves to a private or unsupported address");
  return new Promise((resolve, reject) => {
    const req = request(url, {
      signal,
      lookup: (_hostname, options, callback) => options.all ? callback(null, addresses) : callback(null, addresses[0].address, 4),
      headers: { accept: "text/html,text/plain", "accept-encoding": "identity", "user-agent": USER_AGENT },
    }, (response) => {
      readResearchResponse(response).then(resolve, reject);
    });
    req.on("error", reject);
    req.end();
  });
}

/** robots.txt rules for our bot (or "*"); the longest matching Allow/Disallow path wins. */
export function robotsAllows(robotsTxt, path) {
  const groups = [];
  let current = null;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const [field, ...rest] = raw.replace(/#.*/, "").split(":");
    const key = field.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      if (!current || current.rules.length) groups.push(current = { agents: [], rules: [] });
      current.agents.push(value.toLowerCase());
    } else if (current && (key === "allow" || key === "disallow") && value) current.rules.push({ allow: key === "allow", path: value });
  }
  const ours = groups.filter((group) => group.agents.some((agent) => agent && USER_AGENT.toLowerCase().startsWith(agent)));
  const rules = (ours.length ? ours : groups.filter((group) => group.agents.includes("*"))).flatMap((group) => group.rules);
  const matches = (rule) => new RegExp(`^${rule.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$")}`).test(path);
  const best = rules.filter(matches).sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow))[0];
  return !best || best.allow;
}

async function allowedByRobots(url, requestImpl, cache) {
  if (!cache.has(url.origin)) {
    cache.set(url.origin, requestImpl(new URL("/robots.txt", url.origin), 5_000)
      .then((response) => response.status === 200 ? response.body : "", () => ""));
  }
  return robotsAllows(await cache.get(url.origin), url.pathname + url.search);
}

export function plainEvidence(html) {
  return html.replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
}

/** Publication date from common article metadata, or null when the page does not state one. */
export function publishedAt(html) {
  const found = html.match(/<meta\b[^>]*(?:property|name|itemprop)\s*=\s*["'](?:article:published_time|datePublished|date|pubdate|publish-date|dc\.date)["'][^>]*>/i)?.[0]
    ?.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1]
    ?? html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1]
    ?? html.match(/<time\b[^>]*\bdatetime\s*=\s*["']([^"']+)["']/i)?.[1];
  const time = found ? Date.parse(found) : NaN;
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function restrictedAccess(node) {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some(restrictedAccess);
  return node.isAccessibleForFree === false || String(node.isAccessibleForFree).toLowerCase() === "false"
    || (node.hasPart ? restrictedAccess(node.hasPart) : false);
}

function metadataForPage(node, pageUrl) {
  const identities = [node.url, node["@id"], typeof node.mainEntityOfPage === "string" ? node.mainEntityOfPage : node.mainEntityOfPage?.["@id"]]
    .filter((value) => typeof value === "string");
  if (!identities.length) return true;
  return identities.some((identity) => {
    try {
      const candidate = new URL(identity, pageUrl);
      const current = new URL(pageUrl);
      return candidate.hostname.replace(/^www\./, "") === current.hostname.replace(/^www\./, "")
        && candidate.pathname.replace(/\/$/, "") === current.pathname.replace(/\/$/, "");
    } catch { return false; }
  });
}

export function paywallBlockReason(html, articleHtml, pageUrl) {
  // Access flags belong to article metadata, not unrelated application defaults or recommendations.
  for (const match of html.matchAll(/<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let root;
    try { root = JSON.parse(match[1]); } catch { continue; }
    const pending = [root];
    let inspected = 0;
    while (pending.length && inspected++ < 5000) {
      const node = pending.pop();
      if (!node || typeof node !== "object") continue;
      if (Array.isArray(node)) { pending.push(...node); continue; }
      const types = [node["@type"]].flat().filter((type) => typeof type === "string").map((type) => type.split(/[\/#]/).at(-1));
      if (types.some((type) => /^(?:CreativeWork|WebPage|\w*Article|BlogPosting|Report)$/.test(type))
        && metadataForPage(node, pageUrl) && restrictedAccess(node)) {
        return "Paywalled: this article is marked as restricted.";
      }
      pending.push(...Object.values(node).filter((value) => value && typeof value === "object"));
    }
    if (pending.length) return "Could not verify article access: structured metadata is too complex.";
  }
  const visibleMarkup = articleHtml.replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
  const restrictedClass = /^(?:paywall|subscription-wall|registration-wall)(?:$|[-_](?:gate|overlay|modal|prompt|blocked|restricted|content|container|preview))|(?:Paywall|SubscriptionWall|RegistrationWall)(?:Gate|Overlay|Modal|Prompt|Blocked|Restricted)/i;
  for (const match of visibleMarkup.matchAll(/\bclass\s*=\s*["']([^"']*)["']/gi)) {
    if (match[1].split(/\s+/).some((token) => restrictedClass.test(token))) {
      return "Paywalled: an article access gate is present.";
    }
  }
  if (/<meta\b(?=[^>]*\bitemprop\s*=\s*["']isAccessibleForFree["'])(?=[^>]*\bcontent\s*=\s*["']false["'])[^>]*>/i.test(html)) {
    return "Paywalled: this article is marked as restricted.";
  }
  const visibleText = plainEvidence(visibleMarkup);
  if (/\b(?:subscribe|sign\s*in|log\s*in|register)\s+to\s+(?:continue\s+reading|read\s+(?:this\s+article|the\s+(?:full|rest\s+of\s+the)\s+article)|unlock\s+(?:this|the\s+full)\s+article)\b/i.test(visibleText)) {
    return "Paywalled: reading the article requires a subscription or login.";
  }
  return null;
}

/** Reads one public page: HTTPS only, robots.txt respected, bounded body/time, redirects checked individually. */
export async function collectEvidence(value, sources, { requestImpl = publicRequest, robots = new Map() } = {}) {
  const deadline = Date.now() + 20_000;
  let url = new URL(value);
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (!isFetchableUrl(url.href)) throw new EvidenceError("Only HTTPS pages without credentials or custom ports are read");
    if (url.hostname !== SEARCH_REDIRECT_HOST && !(await allowedByRobots(url, requestImpl, robots))) {
      throw new EvidenceError(`${url.hostname} does not allow automated reading of this page (robots.txt)`);
    }
    const response = await requestImpl(url, Math.max(1, deadline - Date.now()));
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (!response.headers.location) throw new EvidenceError("Redirect has no destination");
      url = new URL(response.headers.location, url);
      continue;
    }
    if (response.status !== 200) throw new EvidenceError(`Page returned HTTP ${response.status}`, response.status === 429 || response.status >= 500);
    if (!/text\/(html|plain)/i.test(response.headers["content-type"] ?? "")) throw new EvidenceError("Page is not HTML or plain text");
    if (Buffer.byteLength(response.body, "utf8") > MAX_BYTES) throw pageTooLarge();
    const articleBody = response.body.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
      ?? response.body.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? response.body;
    const accessBlock = paywallBlockReason(response.body, articleBody, url.href);
    if (accessBlock) throw new EvidenceError(accessBlock);
    const text = plainEvidence(articleBody);
    if (text.length < 300) throw new EvidenceError("Page has too little readable text");
    const source = sourceForUrl(url.href, sources);
    return {
      url: url.href, source_id: source?.id ?? null, publisher: source?.name ?? hostOf(url.href),
      title: plainEvidence(response.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? hostOf(url.href)).slice(0, 250),
      primary: ["newsroom", "government"].includes(source?.kind), published_at: publishedAt(response.body),
      text, accessed_at: new Date().toISOString(),
    };
  }
  throw new EvidenceError("Too many redirects");
}
