import { z } from "zod";
import { MAX_DAILY_ARTICLES } from "@/lib/schedule";
import { DRAFT_CHECKS } from "@/lib/automation/strict-checks";

/**
 * @typedef {Object} FormState
 * @property {boolean} [ok]
 * @property {string} [message]
 * @property {string} [error]
 * @property {Record<string, string>} [fieldErrors]
 */

/**
 * @typedef {Object} ParsedSource
 * @property {string} url
 * @property {string|null} title
 * @property {string|null} publisher
 */

/** @param {import("zod").ZodError} error */
export function fieldErrorsFrom(error) {
  const result = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .default(null);

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("")])
  .optional()
  .transform((value) => value === "on" || value === "true");

export const TIMEZONES = (() => {
  try {
    return ["UTC", ...Intl.supportedValuesOf("timeZone").filter((zone) => zone !== "UTC")];
  } catch {
    return ["UTC"];
  }
})();

export function slugify(value) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** "8:00, 14:00 20:00" → ["08:00", "14:00", "20:00"]: 24-hour, unique, sorted. */
const publishTimes = z
  .string()
  .default("")
  .transform((value) => [
    ...new Set(
      value
        .split(/[\s,;]+/)
        .filter(Boolean)
        .map((time) => time.padStart(5, "0")),
    ),
  ])
  .refine(
    (times) => times.every((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)),
    "Use 24-hour times such as 08:00, 14:00, 20:00",
  )
  .refine((times) => times.length <= MAX_DAILY_ARTICLES, `At most ${MAX_DAILY_ARTICLES} publishing times per day`)
  .transform((times) => times.sort());

const hexColor = z
  .string()
  .trim()
  .regex(/^(#[0-9a-fA-F]{6})?$/, "Use a hex colour such as #1d4ed8")
  .default("");

export const websiteSettingsSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  slug: z
    .string()
    .trim()
    .max(60)
    .regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, "Lowercase letters, numbers and single hyphens only")
    .default(""),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .transform((value) => value.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .pipe(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Enter a domain such as example.com")),
  language: z.enum(["en", "ar"]),
  niche_id: optionalText(36).refine(
    (value) => value === null || /^[0-9a-f-]{36}$/i.test(value),
    "Choose from the list",
  ),
  topic: optionalText(200),
  audience: optionalText(500),
  timezone: z.string().refine((zone) => TIMEZONES.includes(zone), "Choose a valid timezone"),
  publish_times: publishTimes,
  automation_mode: z.enum(["off", "review", "automatic"]),
  ai_model: optionalText(100).refine(
    (value) => value === null || /^[A-Za-z0-9._:/-]+$/.test(value),
    "Model names use letters, numbers, dots, dashes and slashes",
  ),
  monthly_ai_budget_usd: z.coerce.number().min(0, "Cannot be negative").max(100_000),
  generate_illustrations: checkbox,
  auto_select_stories: checkbox,
  brand_tagline: optionalText(200),
  brand_primary_color: hexColor,
  brand_remove_logo: checkbox,
  ga4_property_id: optionalText(20).refine(
    (value) => value === null || /^[0-9]{5,20}$/.test(value),
    "The numeric property ID from GA4 → Admin → Property details",
  ),
  search_console_site: optionalText(200).refine(
    (value) => value === null || /^(sc-domain:[a-z0-9.-]+|https?:\/\/\S+\/)$/.test(value),
    "sc-domain:example.com, or https://example.com/ with the trailing slash",
  ),
  wp_base_url: z.string().trim().url("Enter the WordPress site URL, for example https://example.com"),
  wp_username: z.string().trim().min(1, "WordPress username is required").max(120),
  wp_app_password: z.string().trim().max(200).default(""),
});

export const articleSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(300),
  slug: z
    .string()
    .trim()
    .max(200)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .default(null),
  excerpt: optionalText(1000),
  body: z.string().max(200_000).default(""),
  sources: z.string().max(20_000).default(""),
  category_id: optionalText(36).refine(
    (value) => value === null || /^[0-9a-f-]{36}$/i.test(value),
    "Choose a category",
  ),
  seo_title: optionalText(70),
  meta_description: optionalText(170),
  focus_keyword: optionalText(80),
  // Comma-separated in the form.
  tags: z
    .string()
    .max(600)
    .default("")
    .transform((value) => [
      ...new Set(
        value
          .split(",")
          .map((tag) => tag.trim().slice(0, 50))
          .filter(Boolean),
      ),
    ])
    .refine((tags) => tags.length <= 10, "At most 10 tags"),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  slug: z
    .string()
    .trim()
    .max(60)
    .regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, "Lowercase letters, numbers and single hyphens only")
    .default(""),
  description: optionalText(300),
});

export const nicheCategorySchema = categorySchema.extend({
  language: z.enum(["en", "ar"]),
  slug: z
    .string()
    .trim()
    .min(1, "An ASCII slug is required")
    .max(60)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers and single hyphens only"),
  sort_order: z.coerce.number().int().min(-2147483648).max(2147483647),
  archived: checkbox,
});

export const strictDraftChecksSchema = z.object({
  strict_draft_checks: z
    .array(z.enum(DRAFT_CHECKS.map((check) => check.key)))
    .max(DRAFT_CHECKS.length)
    .transform((keys) => [...new Set(keys)]),
});

/** Preference order from the brief: owned, licensed, official press assets, then AI illustrations. */
export const IMAGE_SOURCE_KINDS = {
  owned: "Owned",
  licensed: "Licensed",
  press: "Official press/media asset",
  ai_generated: "AI-generated illustration",
};

export const MAX_ARTICLE_IMAGE_BYTES = 3 * 1024 * 1024;

export const articleImageSchema = z
  .object({
    source_kind: z.enum(Object.keys(IMAGE_SOURCE_KINDS)),
    alt_text: z.string().trim().min(1, "Describe the image for screen readers and search").max(300),
    caption: optionalText(500),
    credit: optionalText(200),
    source_url: optionalText(500).refine(
      (value) => value === null || /^https?:\/\/\S+$/.test(value),
      "Enter a full URL",
    ),
    license: optionalText(200),
  })
  .superRefine((image, context) => {
    if (!["licensed", "press"].includes(image.source_kind)) return;
    if (!image.credit)
      context.addIssue({
        code: "custom",
        path: ["credit"],
        message: "Credit is required for licensed and press images",
      });
    if (!image.source_url && !image.license)
      context.addIssue({ code: "custom", path: ["license"], message: "Record the licence or the page granting use" });
  });

/** Parses "url | title | publisher" lines. Returns the sources or a line-specific error. */
export function parseSourceLines(text) {
  const sources = [];
  const seen = new Set();
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const [url, title, publisher] = line.split("|").map((part) => part.trim());
    if (!/^https?:\/\/\S+$/.test(url)) {
      return { error: `Source line ${i + 1} must start with a URL (https://…)` };
    }
    if (seen.has(url)) continue;
    seen.add(url);
    sources.push({ url, title: title || null, publisher: publisher || null });
  }
  return { sources };
}

export function formatSourceLines(sources) {
  return sources
    .map((source) => [source.url, source.title ?? "", source.publisher ?? ""].join(" | ").replace(/( \| )+$/, ""))
    .join("\n");
}

export const SOURCE_KINDS = {
  news: "News outlet",
  newsroom: "Official newsroom",
  government: "Government",
  api: "API",
};

export const contentSourceSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  url: z.string().trim().url("Enter a full URL"),
  kind: z.enum(Object.keys(SOURCE_KINDS)),
  feed_url: optionalText(500).refine(
    (value) => value === null || /^https?:\/\/\S+$/.test(value),
    "Enter a full feed URL",
  ),
  images_reusable: checkbox,
  attribution_note: optionalText(500),
});

export const nicheSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
});

export const nicheGuideSchema = z.object({
  guide_en: optionalText(3000),
  guide_ar: optionalText(3000),
});

export const networkSettingsSchema = z.object({
  default_ai_model: optionalText(100).refine(
    (model) => model === null || /^gemini-[A-Za-z0-9._-]+$/.test(model),
    "Enter a Gemini model ID",
  ),
  monthly_ai_budget_usd: z.preprocess(
    (value) => (value === "" ? null : value),
    z.coerce.number().min(0).max(100000).nullable(),
  ),
});

export const alertEmailsSchema = z.object({
  alert_emails: z.preprocess(
    (value) => [
      ...new Set(
        String(value ?? "")
          .split(/[\s,;]+/)
          .filter(Boolean),
      ),
    ],
    z
      .array(z.string())
      .max(10, "Enter up to 10 addresses")
      .refine((list) => list.every((email) => z.email().safeParse(email).success), "Enter valid email addresses"),
  ),
});

export const costEntrySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a month"),
  website_id: z.preprocess((value) => (value === "" ? null : value), z.uuid().nullable()),
  category: z.enum(["images", "sources", "hosting", "editorial", "other"]),
  amount_usd: z.coerce.number().min(0).max(1000000),
  note: optionalText(300),
});

export const modelPriceSchema = z.object({
  model: z
    .string()
    .trim()
    .regex(/^gemini-[A-Za-z0-9._-]+$/, "Enter a Gemini model ID")
    .max(100),
  input_per_million_usd: z.coerce.number().min(0).max(10000),
  output_per_million_usd: z.coerce.number().min(0).max(10000),
  search_per_thousand_usd: z.coerce.number().min(0).max(10000),
});

export const usageReconciliationSchema = z.object({
  reviewed_cost: z.coerce.number().min(0).max(10000),
  explanation: z.string().trim().min(10, "Record how the provider charge was checked").max(500),
});

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  full_name: optionalText(120),
  role: z.enum(["admin", "editor"]),
});
