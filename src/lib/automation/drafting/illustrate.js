import "server-only";
import { randomUUID } from "node:crypto";
import { generateForJob } from "@/lib/ai/usage";
import { serverEnv } from "@/lib/env";
import { uploadArticleImage } from "@/lib/storage/article-images";
import { sniffImage } from "@/lib/storage/image-file";
import { MAX_ARTICLE_IMAGE_BYTES } from "@/lib/validation";
import { fetchPublicImage } from "../evidence";
import { DeferredJob, LostLease } from "./errors";
import { imagePrompt } from "./prompts";
import { stockImage } from "./stock";

/** Errors that must stop the job rather than just skip the image. */
export function stopsJob(error) {
  return (
    error instanceof LostLease ||
    /Automation is paused or off|Draft lease lost/.test(error.message) ||
    (error instanceof DeferredJob && !/budget/i.test(error.message))
  );
}

/** The story's own image, when its source allows reuse and the feed included one. */
async function sourceImage(db, article, story, source) {
  const file = sniffImage(await fetchPublicImage(story.image_url));
  if (!file || file.bytes.length > MAX_ARTICLE_IMAGE_BYTES) throw new Error("not a PNG, JPEG or WebP under 3 MB");
  return {
    storage_path: await uploadArticleImage(db, article, file),
    source_kind: "press",
    credit: source.name,
    source_url: story.url,
    license: source.attribution_note ?? "Reuse allowed in the source settings",
    alt_text: story.title.slice(0, 300),
  };
}

export async function aiImage(db, job, worker, article, draft, assertControls) {
  const model = serverEnv().GEMINI_IMAGE_MODEL;
  const prompt = imagePrompt(draft);
  const generated = await generateForJob(db, job, worker, {
    model,
    operation: "illustrate",
    image: true,
    prompt,
    assertControls,
  });
  const file = sniffImage(generated);
  if (!file) throw new Error("unsupported image format");
  return {
    storage_path: await uploadArticleImage(db, article, file),
    source_kind: "ai_generated",
    ai_model: model,
    ai_prompt: prompt,
    alt_text: `Illustration: ${draft.title}`.slice(0, 300),
  };
}

/**
 * Tries `stock` (resolves to an image or null), then `ai`. Problems only add warnings, except
 * errors that stop the job. Returns { image, warnings }; image is null when both failed.
 */
export async function stockThenAi(stock, ai) {
  const warnings = [];
  try {
    const image = await stock();
    if (image) return { image, warnings };
  } catch (error) {
    if (stopsJob(error)) throw error;
    warnings.push(`Stock photo not used: ${error.message}`);
  }
  try {
    return { image: await ai(), warnings };
  } catch (error) {
    if (stopsJob(error)) throw error;
    return { image: null, warnings: [...warnings, `AI image not generated: ${error.message}`] };
  }
}

/** A licensed Shutterstock photo when one fits, otherwise an AI image. Model calls are recorded on the job. */
export function newImage(db, job, worker, article, draft, assertControls) {
  const env = serverEnv();
  const generateJson = (contents, schema) =>
    generateForJob(db, job, worker, {
      model: env.GEMINI_MODEL,
      operation: "illustrate",
      contents,
      schema,
      assertControls,
    });
  return stockThenAi(
    () => stockImage(db, article, draft, { env, generateJson }),
    () => aiImage(db, job, worker, article, draft, assertControls),
  );
}

/**
 * Stores the draft's images before the article exists, under the article id fixed in state:
 * the source's image (when reuse is allowed) and a stock photo or AI illustration (when the website wants one).
 * The first becomes the featured image, the other an option for the editor.
 * Image problems only add a warning; the editor can still upload an image. Returns warnings.
 */
export async function illustrateStep(db, job, worker, { state, context, assertControls }) {
  state.article_id ??= randomUUID();
  const article = { id: state.article_id, website_id: job.website_id };
  const { story, website, sources } = context;
  const source = sources.find((row) => row.id === story.source_id);
  const images = [];
  const warnings = [];

  if (source?.images_reusable && story.image_url) {
    try {
      images.push(await sourceImage(db, article, story, source));
    } catch (error) {
      warnings.push(`Source image not added: ${error.message}`);
    }
  }

  if (website.generate_illustrations) {
    const result = await newImage(db, job, worker, article, state.draft, assertControls);
    if (result.image) images.push(result.image);
    warnings.push(...result.warnings);
  }

  state.images = images.map((image, index) => ({ ...image, role: index === 0 ? "featured" : "option" }));
  return warnings;
}
