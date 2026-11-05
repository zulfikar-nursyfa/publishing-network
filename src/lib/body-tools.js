const YOUTUBE_ID = /^[\w-]{11}$/;

/**
 * The canonical link for a YouTube video, X post or Instagram post, or null for anything else.
 * On its own line in the body, WordPress turns the link into the embedded player or post (X and
 * Instagram need connector plugin 1.2.0). Tracking parameters are dropped.
 * @param {string} input
 */
export function embedUrl(input) {
  let url;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol)) return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
  const path = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be" || host === "youtube.com") {
    const id =
      host === "youtu.be"
        ? path[0]
        : (url.searchParams.get("v") ?? (["shorts", "embed", "live"].includes(path[0]) ? path[1] : null));
    return id && YOUTUBE_ID.test(id) ? `https://www.youtube.com/watch?v=${id}` : null;
  }
  if (host === "x.com" || host === "twitter.com") {
    const [user, kind, id] = path;
    return /^\w{1,15}$/.test(user ?? "") && kind === "status" && /^\d+$/.test(id ?? "")
      ? `https://twitter.com/${user}/status/${id}`
      : null;
  }
  if (host === "instagram.com") {
    const at = path.findIndex((part) => ["p", "reel", "tv"].includes(part));
    const code = at >= 0 ? path[at + 1] : null;
    return code && /^[\w-]+$/.test(code) ? `https://www.instagram.com/${path[at]}/${code}/` : null;
  }
  return null;
}

/** A link's address for <a href="…">, or null unless it is a full http(s) URL. Quotes come back percent-encoded. */
export function linkUrl(input) {
  try {
    const url = new URL(String(input).trim());
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/** Blank lines around `text` so it is a paragraph of its own between `before` and `after`. */
export function asBlock(before, text, after) {
  const lead = !before.trim() || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const trail = !after.trim() || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  return lead + text + trail;
}
