const BASE = "http://same.origin";

/**
 * A `next` redirect target limited to this site. Parsing like a browser does catches "//host",
 * "/\host" and tab or newline tricks that a prefix check misses.
 */
export function safeNext(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  const url = new URL(value, BASE);
  return url.origin === BASE ? `${url.pathname}${url.search}${url.hash}` : "/";
}
