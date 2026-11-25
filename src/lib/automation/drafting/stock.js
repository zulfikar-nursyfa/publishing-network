import "server-only";
import { chooseStockImage } from "@/lib/images/stock/index";
import { createShutterstockClient } from "@/lib/images/stock/shutterstock";
import { uploadArticleImage } from "@/lib/storage/article-images";
import { sniffImage } from "@/lib/storage/image-file";
import { MAX_ARTICLE_IMAGE_BYTES } from "@/lib/validation";

/** Search keys and licensing settings; without all four, drafting goes straight to the AI image. */
export function stockConfigured(env) {
  return Boolean(
    env.SHUTTERSTOCK_CONSUMER_KEY &&
    env.SHUTTERSTOCK_CONSUMER_SECRET &&
    env.SHUTTERSTOCK_API_TOKEN &&
    env.SHUTTERSTOCK_SUBSCRIPTION_ID,
  );
}

/**
 * A licensed Shutterstock photo for the article, stored like other article images, or null when
 * Shutterstock is not configured or no photo fits. Search, pick or licensing problems throw.
 * `generateJson(contents, schema)` makes the recorded, costed model calls.
 */
export async function stockImage(db, article, draft, { env, generateJson, fetch: fetchImpl = globalThis.fetch }) {
  if (!stockConfigured(env)) return null;
  const stock = createShutterstockClient({
    key: env.SHUTTERSTOCK_CONSUMER_KEY,
    secret: env.SHUTTERSTOCK_CONSUMER_SECRET,
    token: env.SHUTTERSTOCK_API_TOKEN,
    subscriptionId: env.SHUTTERSTOCK_SUBSCRIPTION_ID,
    fetch: fetchImpl,
  });
  const usedIds = async (ids) => {
    if (!ids.length) return new Set();
    const { data, error } = await db
      .from("website_stock_images")
      .select("image_id")
      .eq("website_id", article.website_id)
      .in("image_id", ids);
    if (error) throw new Error(`Could not read used stock photos: ${error.message}`);
    return new Set(data.map((row) => row.image_id));
  };
  const { image } = await chooseStockImage(draft, { stock, generateJson, usedIds, fetch: fetchImpl });
  if (!image) return null;

  // Claimed before licensing so two jobs cannot license one photo for the same website. A crash after this
  // leaves the photo marked used, and a retried step picks another.
  const { error } = await db
    .from("website_stock_images")
    .insert({ website_id: article.website_id, image_id: image.id, article_id: article.id });
  if (error) throw new Error(`Could not reserve the stock photo: ${error.message}`);

  const licensed = await stock.license(image);
  const file = sniffImage(licensed.bytes);
  if (!file || file.bytes.length > MAX_ARTICLE_IMAGE_BYTES)
    throw new Error("the licensed file is not a PNG, JPEG or WebP under 3 MB");
  return {
    storage_path: await uploadArticleImage(db, article, file),
    source_kind: "licensed",
    credit: "Shutterstock",
    source_url: image.url,
    license: `Shutterstock API license, image ${image.id}${licensed.licenseId ? `, license ${licensed.licenseId}` : ""}`,
    alt_text: draft.title.slice(0, 300),
  };
}
