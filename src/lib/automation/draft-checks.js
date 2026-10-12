import { z } from "zod";
import { hostOf } from "./evidence";

const sourceUrls = z.array(z.url()).min(1).max(4);
export class DraftCheckError extends Error {}
export const researchSchema = z.object({
  angle: z.string().min(20).max(800),
  claims: z
    .array(
      z.object({
        claim: z.string().min(10).max(700),
        source_urls: sourceUrls,
        evidence: z
          .array(z.object({ url: z.url(), quote: z.string().min(15).max(500) }))
          .min(1)
          .max(4),
      }),
    )
    .min(3)
    .max(15),
  // The collected page that is the original company/government/regulator announcement, if any.
  primary_source_url: z.url().nullable(),
  sensitive: z.boolean(),
  needs_corroboration: z.boolean(),
  // Facts the pages do not confirm. The draft leaves them out and the job page shows them to the reviewer.
  unresolved: z.array(z.string().max(500)).max(10),
});
export const draftSchema = z.object({
  title: z.string().trim().min(15).max(200),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(100),
  excerpt: z.string().trim().min(50).max(500),
  body: z.string().trim().min(800).max(25000),
  category_id: z.uuid().nullable(),
  sensitive: z.boolean(),
  source_urls: sourceUrls,
});
export const verificationSchema = z.object({
  passed: z.boolean(),
  sensitive: z.boolean(),
  issues: z.array(z.string().max(600)).max(20),
  checked_claims: z
    .array(z.object({ claim: z.string().max(700), supported: z.boolean(), source_urls: sourceUrls }))
    .min(3)
    .max(30),
});

const normalise = (value) => value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
const words = (value) => normalise(value).match(/[\p{L}\p{N}]+/gu) ?? [];

const domainCount = (urls) => new Set(urls.map(hostOf)).size;

/** Official pages the research relies on: configured newsroom/government sources or the one research identified. */
function primaryUrls(research, evidence) {
  const cited = new Set(research.claims.flatMap((claim) => claim.source_urls));
  return new Set(
    evidence
      .filter((page) => cited.has(page.url) && (page.primary || page.url === research.primary_source_url))
      .map((page) => page.url),
  );
}

/**
 * Plan §8: a story needs an official source or two independent outlets. Sensitive or
 * consequential stories always need two independent sites, even with an official source.
 */
export function corroboration(research, evidence) {
  const outlets = domainCount(research.claims.flatMap((claim) => claim.source_urls));
  const official = primaryUrls(research, evidence).size > 0;
  const required = research.sensitive || research.needs_corroboration;
  return { required, official, outlets, met: outlets >= 2 || (official && !required) };
}

// Loose match: same words in order ignoring punctuation, or most of the quote's words on the page.
function quoteFound(quote, text) {
  const quoteWords = words(quote);
  const pageWords = words(text);
  if (!quoteWords.length) return false;
  if (` ${pageWords.join(" ")} `.includes(` ${quoteWords.join(" ")} `)) return true;
  const onPage = new Set(pageWords);
  return quoteWords.filter((word) => onPage.has(word)).length / quoteWords.length >= 0.8;
}

/*
 * Checks return warnings for the reviewer instead of failing, except where no usable article
 * could follow. Only copying, HTML, length and language block a draft (Ali's core rules).
 * Tighten individual warnings into errors once the end-to-end flow is proven.
 */
export function checkResearch(research, evidence) {
  const byUrl = new Map(evidence.map((page) => [page.url, page]));
  const warnings = [];
  const claims = research.claims
    .map((claim) => ({ ...claim, source_urls: claim.source_urls.filter((url) => byUrl.has(url)) }))
    .filter(
      (claim) =>
        claim.source_urls.length &&
        claim.evidence.some((ref) => byUrl.has(ref.url) && quoteFound(ref.quote, byUrl.get(ref.url).text)),
    );
  if (!claims.length) throw new DraftCheckError("None of the researched facts could be matched to the collected pages");
  if (claims.length < research.claims.length)
    warnings.push(
      `${research.claims.length - claims.length} researched facts were dropped because their quotes were not found on the pages`,
    );
  const checked = {
    ...research,
    claims,
    primary_source_url: byUrl.has(research.primary_source_url) ? research.primary_source_url : null,
  };
  checked.corroboration = corroboration(checked, evidence);
  if (!checked.corroboration.met)
    warnings.push(
      checked.corroboration.required
        ? "Sensitive or consequential story without a second independent source"
        : "No official source and only one outlet supports the story",
    );
  if (research.unresolved.length)
    warnings.push(`Not confirmed by the sources (left out): ${research.unresolved.join("; ")}`);
  return { research: checked, warnings };
}

export function checkDraft(draft, research, evidence, categories, language) {
  if (/<\/?[A-Za-z][^>]*>|https?:\/\/|javascript:/i.test(draft.body))
    throw new DraftCheckError("Draft body must be plain text; sources are attached separately");
  const count = words(draft.body).length;
  if (count < (language === "ar" ? 130 : 180)) throw new DraftCheckError("Draft is too short for editorial review");
  const letters = draft.body.match(/\p{L}/gu) ?? [];
  const arabic = draft.body.match(/\p{Script=Arabic}/gu) ?? [];
  if (
    !letters.length ||
    (language === "ar" ? arabic.length / letters.length < 0.5 : arabic.length / letters.length > 0.2)
  )
    throw new DraftCheckError("Draft language does not match the website");
  const draftWords = words(`${draft.title} ${draft.excerpt} ${draft.body}`);
  const shingles = (tokens, length) =>
    new Set(
      tokens
        .slice(0, Math.max(0, tokens.length - length + 1))
        .map((_, index) => tokens.slice(index, index + length).join(" ")),
    );
  const phrases = shingles(draftWords, 12);
  for (const page of evidence) {
    if ([...shingles(words(page.text), 12)].some((phrase) => phrases.has(phrase)))
      throw new DraftCheckError("Draft contains a long copied passage; revise the sourcing and retry");
  }
  const shortPhrases = shingles(draftWords, 5);
  const sourcePhrases = new Set(evidence.flatMap((page) => [...shingles(words(page.text), 5)]));
  if ([...shortPhrases].filter((phrase) => sourcePhrases.has(phrase)).length / Math.max(1, shortPhrases.size) > 0.35)
    throw new DraftCheckError("Draft is too similar to the collected source text");

  const warnings = [];
  const collected = new Set(evidence.map((page) => page.url));
  const researched = [...new Set(research.claims.flatMap((claim) => claim.source_urls))];
  let sourceUrls = draft.source_urls.filter((url) => collected.has(url));
  if (sourceUrls.length < draft.source_urls.length)
    warnings.push("The draft cited pages that were not collected; they were removed");
  if (!sourceUrls.length) sourceUrls = researched.slice(0, 4);
  const primary = primaryUrls(research, evidence);
  if (primary.size && !sourceUrls.some((url) => primary.has(url)))
    warnings.push("The draft does not cite the official source");
  if (research.claims.some((claim) => !claim.source_urls.some((url) => sourceUrls.includes(url))))
    warnings.push("Some researched facts are not covered by the draft's cited sources");
  const categoryId = categories.some((category) => category.id === draft.category_id) ? draft.category_id : null;
  return {
    draft: {
      ...draft,
      source_urls: sourceUrls,
      category_id: categoryId,
      sensitive: draft.sensitive || research.sensitive || research.needs_corroboration,
    },
    warnings,
  };
}

export function checkVerification(verification) {
  const unsupported = verification.checked_claims.filter((claim) => !claim.supported).map((claim) => claim.claim);
  return [
    ...(verification.passed ? [] : ["AI verification did not pass"]),
    ...verification.issues.map((issue) => `Verification: ${issue}`),
    ...unsupported.map((claim) => `Unsupported claim: ${claim}`),
  ];
}

/** Google's response schema uses a subset; all tighter constraints are also checked by Zod. */
export function responseSchema(schema) {
  const allowed = new Set([
    "type",
    "format",
    "enum",
    "items",
    "minItems",
    "maxItems",
    "anyOf",
    "properties",
    "required",
    "additionalProperties",
    "minimum",
    "maximum",
  ]);
  const clean = (value, properties = false) => {
    if (Array.isArray(value)) return value.map((item) => clean(item));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => properties || allowed.has(key))
        .map(([key, item]) => [key, clean(item, key === "properties")]),
    );
  };
  return clean(z.toJSONSchema(schema));
}
