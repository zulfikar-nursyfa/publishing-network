import { requireUser } from "@/lib/auth";
import { escapeHtml, inlineImageIds, toWordPressContent } from "@/lib/publishing/content";
import { ARTICLE_IMAGE_BUCKET } from "@/lib/storage/article-images";
import { createClient } from "@/lib/supabase/server";

// The body may contain HTML from editors or AI drafts, so the page runs sandboxed with no scripts.
const CSP =
  "sandbox allow-popups allow-popups-to-escape-sandbox; default-src 'none'; img-src https: data:; style-src 'unsafe-inline'";

/** The article as WordPress will receive it: same title, image, content, credit line and sources. */
export async function GET(_request, { params }) {
  const { articleId } = await params;
  await requireUser();
  const supabase = await createClient();
  const { data: article } = await supabase.from("articles").select("*").eq("id", articleId).maybeSingle();
  if (!article) return new Response("Not found", { status: 404 });

  const placedIds = inlineImageIds(article.body);
  const [{ data: website }, { data: sources }, { data: image }, { data: category }, { data: placed }] =
    await Promise.all([
      supabase
        .from("websites")
        .select("name, language, text_direction, timezone")
        .eq("id", article.website_id)
        .single(),
      supabase.from("article_sources").select("url, title, publisher").eq("article_id", articleId).order("accessed_at"),
      supabase.from("article_images").select("*").eq("article_id", articleId).eq("role", "featured").maybeSingle(),
      article.category_id
        ? supabase.from("categories").select("name").eq("id", article.category_id).maybeSingle()
        : Promise.resolve({ data: null }),
      placedIds.length
        ? supabase.from("article_images").select("*").eq("article_id", articleId).in("id", placedIds)
        : Promise.resolve({ data: [] }),
    ]);
  if (!website) return new Response("Not found", { status: 404 });

  let imageUrl = image?.url ?? null;
  if (image?.storage_path) {
    const { data } = await supabase.storage.from(ARTICLE_IMAGE_BUCKET).createSignedUrl(image.storage_path, 3600);
    imageUrl = data?.signedUrl ?? imageUrl;
  }
  const credit = image ? { sourceKind: image.source_kind, credit: image.credit } : null;
  const paths = (placed ?? []).map((row) => row.storage_path).filter(Boolean);
  const { data: signed } = paths.length
    ? await supabase.storage.from(ARTICLE_IMAGE_BUCKET).createSignedUrls(paths, 3600)
    : { data: [] };
  const inlineImages = Object.fromEntries(
    (placed ?? []).map((row) => [
      row.id,
      {
        src: signed?.find((entry) => entry.path === row.storage_path)?.signedUrl ?? row.url,
        altText: row.alt_text,
        caption: row.caption,
        credit: row.credit,
        sourceKind: row.source_kind,
      },
    ]),
  );
  const content = toWordPressContent(article.body, sources ?? [], website.language, credit, inlineImages);
  const date = article.published_at
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: website.timezone }).format(
        new Date(article.published_at),
      )
    : "Not published";

  const html = `<!doctype html>
<html lang="${website.language}" dir="${website.text_direction === "rtl" ? "rtl" : "ltr"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Preview: ${escapeHtml(article.title)}</title>
<style>
body{margin:0;font:18px/1.7 system-ui,sans-serif;color:#1a1a1a;background:#fff}
.bar{direction:ltr;font-size:13px;padding:10px 16px;background:#fef3c7;border-bottom:1px solid #f59e0b}
main{max-width:720px;margin:0 auto;padding:32px 16px 64px}
h1{font-size:2rem;line-height:1.25;margin:.25em 0}.meta,.excerpt,figcaption{color:#555}.meta{font-size:14px}
img{max-width:100%;height:auto}figure{margin:24px 0}figcaption{font-size:14px}a{color:#1d4ed8}
.pn-image-credit{font-size:14px;color:#666;font-style:italic}
</style></head>
<body>
<div class="bar">Preview of the last saved version (${escapeHtml(article.status.replace("_", " "))}) for ${escapeHtml(website.name)}. The WordPress theme sets the final layout and fonts.</div>
<main>
<div class="meta">${escapeHtml([category?.name, date].filter(Boolean).join(" · "))}</div>
<h1>${escapeHtml(article.title)}</h1>
${article.excerpt ? `<p class="excerpt">${escapeHtml(article.excerpt)}</p>` : ""}
${imageUrl ? `<figure><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(image.alt_text ?? "")}">${image.caption ? `<figcaption>${escapeHtml(image.caption)}</figcaption>` : ""}</figure>` : ""}
${content}
</main>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": CSP,
      "Cache-Control": "no-store",
    },
  });
}
