import { z } from "zod";

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
  topic: optionalText(200),
  audience: optionalText(500),
  timezone: z.string().refine((zone) => TIMEZONES.includes(zone), "Choose a valid timezone"),
  daily_quota: z.coerce.number().int().min(0).max(2),
  monthly_ai_budget_usd: z.coerce.number().min(0, "Cannot be negative").max(100_000),
  generate_illustrations: checkbox,
  brand_tagline: optionalText(200),
  brand_primary_color: hexColor,
  brand_logo_url: z
    .string()
    .trim()
    .refine((value) => value === "" || /^https:\/\//.test(value), "Logo URL must start with https://")
    .default(""),
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

export const contentSourceSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  url: z.string().trim().url("Enter a full URL"),
  kind: z.enum(["rss", "website", "api"]),
  attribution_note: optionalText(500),
});

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  full_name: optionalText(120),
  role: z.enum(["admin", "editor"]),
});
