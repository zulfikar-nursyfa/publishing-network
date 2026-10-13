/**
 * Loads a published post as a visitor would and reports what would stop it ranking: an error
 * status, a noindex directive, or a canonical link pointing elsewhere. Never throws.
 * @returns {Promise<{ok: boolean, status: number|null, problems: string[], checked_at: string}>}
 */
export async function checkLivePost(url, fetchImpl = globalThis.fetch) {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetchImpl(url, {
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "PublishingNetwork-LiveCheck/1.0" },
    });
    const html = await response.text();
    const robots = `${response.headers.get("x-robots-tag") ?? ""} ${html.match(/<meta[^>]+name=["']robots["'][^>]*>/i)?.[0] ?? ""}`;
    const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] ?? null;
    const problems = [];
    if (!response.ok) problems.push(`The page returned HTTP ${response.status}`);
    if (/noindex/i.test(robots)) problems.push("Search engines are told not to index it (noindex)");
    if (canonical && sameUrl(canonical) !== sameUrl(response.url || url))
      problems.push(`Its canonical link points to ${canonical}`);
    return { ok: problems.length === 0, status: response.status, problems, checked_at: checkedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, status: null, problems: [`Could not load the page: ${message}`], checked_at: checkedAt };
  }
}

const sameUrl = (value) => value.replace(/^https?:\/\//, "").replace(/\/+$/, "");
