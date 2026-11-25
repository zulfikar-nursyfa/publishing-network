import "server-only";
import { sniffImage } from "@/lib/storage/image-file";
import { parsePick, pickPrompt, pickSchema } from "./pick";
import { parseQueries, queryPrompt, querySchema } from "./queries";

/** Previews sent to the picker; about 1k input tokens each. */
const MAX_CANDIDATES = 24;

const text = (prompt) => [{ role: "user", parts: [{ text: prompt }] }];

/**
 * Chooses a stock photo for an article: the text model writes searches, Shutterstock is searched,
 * photos in `usedIds` are dropped, and one multimodal call picks the best watermarked preview.
 * `generateJson(contents, schema)` makes the (recorded and costed) model calls; `usedIds(ids)` resolves
 * to the ids the website already used. Returns { image, reason }; image is null when nothing fits.
 */
export async function chooseStockImage(article, { stock, generateJson, usedIds, fetch: fetchImpl = globalThis.fetch }) {
  const queries = parseQueries(await generateJson(text(queryPrompt(article)), querySchema));
  const seen = new Set();
  const results = (await Promise.all(queries.map((query) => stock.search(query)))).flat().filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  const used = await usedIds(results.map((item) => item.id));
  const fresh = results.filter((item) => !used.has(item.id));

  const candidates = [];
  const parts = [];
  for (const item of fresh.slice(0, MAX_CANDIDATES)) {
    const response = await fetchImpl(item.preview, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
    const file = response?.ok ? sniffImage(Buffer.from(await response.arrayBuffer())) : null;
    if (!file) continue;
    candidates.push(item);
    parts.push(
      { text: `Photo ${candidates.length}:` },
      { inlineData: { mimeType: file.contentType, data: file.bytes.toString("base64") } },
    );
  }
  if (!candidates.length) {
    const reason = fresh.length
      ? "No preview could be read"
      : results.length
        ? "All results already used"
        : "No results";
    return { image: null, reason };
  }

  const contents = [{ role: "user", parts: [{ text: pickPrompt(article, candidates.length) }, ...parts] }];
  return parsePick(await generateJson(contents, pickSchema), candidates);
}
