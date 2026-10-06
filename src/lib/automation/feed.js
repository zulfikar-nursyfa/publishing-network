import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", textNodeName: "#text" });

const list = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
const text = (value) => (typeof value === "object" && value !== null ? value["#text"] : value)?.toString().trim() || null;

function plain(html, max) {
  const value = html
    ?.replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
  return value ? value.slice(0, max) : null;
}

function imageOf(item) {
  const media = [...list(item["media:content"]), ...list(item["media:thumbnail"]), ...list(item["media:group"]?.["media:content"])];
  const enclosure = list(item.enclosure).find((entry) => String(entry["@type"] ?? "").startsWith("image/"));
  return media.find((entry) => entry["@url"])?.["@url"] ?? enclosure?.["@url"] ?? null;
}

function linkOf(item) {
  if (typeof item.link === "string") return item.link.trim();
  const links = list(item.link);
  const alternate = links.find((link) => !link["@rel"] || link["@rel"] === "alternate");
  return alternate?.["@href"] ?? text(item.guid);
}

function dateOf(value) {
  const time = Date.parse(text(value) ?? "");
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/** Parses an RSS 2.0 or Atom feed into {url, title, summary, imageUrl, publishedAt} items. */
export function parseFeed(xml) {
  const doc = parser.parse(xml);
  const items = doc.rss ? list(doc.rss.channel?.item) : list(doc.feed?.entry);
  return items
    .map((item) => ({
      url: linkOf(item),
      title: plain(text(item.title), 300),
      summary: plain(text(item.description) ?? text(item.summary) ?? text(item.content), 600),
      imageUrl: imageOf(item),
      publishedAt: dateOf(item.pubDate ?? item.published ?? item.updated ?? item["dc:date"]),
    }))
    .filter((item) => item.url && /^https?:\/\//.test(item.url) && item.title);
}

/** Same story, same fingerprint: ignores tracking parameters, fragments, "www." and trailing slashes. */
export function storyFingerprint(url) {
  const parsed = new URL(url);
  for (const key of [...parsed.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|ref$|cmpid)/i.test(key)) parsed.searchParams.delete(key);
  }
  parsed.searchParams.sort();
  const normalised = `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/+$/, "")}${parsed.search}`.toLowerCase();
  return createHash("sha256").update(normalised).digest("hex");
}
