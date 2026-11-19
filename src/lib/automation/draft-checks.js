import { z } from "zod";
import { datesIn, publishedKey, textWarnings, words } from "./text-checks";

const sourceUrls = z.array(z.url()).min(1).max(4);
// Gemini does not enforce string lengths, so over-long notes are cut rather than failing the job.
const clipped = (max, min = 0) =>
  z
    .string()
    .min(min)
    .overwrite((value) => value.slice(0, max));
export class DraftCheckError extends Error {}
export class CopiedPassageError extends DraftCheckError {
  constructor(phrase) {
    const wording = phrase.slice(0, 200);
    super(`Draft contains a long copied passage ("${wording}"); revise the sourcing and retry`);
    this.phrase = wording;
  }
}
export class ShortDraftError extends DraftCheckError {
  constructor(count) {
    super("Draft is too short for editorial review");
    this.words = count;
  }
}
export const researchSchema = z.object({
  angle: clipped(800, 20),
  claims: z
    .array(
      z.object({
        claim: clipped(700, 10),
        source_urls: sourceUrls,
        evidence: z
          .array(z.object({ url: z.url(), quote: clipped(500, 15) }))
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
  unresolved: z.array(clipped(500)).max(10),
});
export const draftSchema = z.object({
  title: z.string().trim().min(15).max(200),
  // Made URL-safe in checkDraft: an Arabic or capitalised slug must not fail the draft.
  slug: z.string().trim().default(""),
  excerpt: z.string().trim().min(50).max(500),
  // No minimum here: checkDraft counts words, so a short draft is rewritten once instead of failing validation.
  body: z.string().trim().max(25000),
  category_id: z.uuid().nullable(),
  sensitive: z.boolean(),
  source_urls: sourceUrls,
  // Lengths are trimmed in checkDraft rather than rejected, so a long SEO title never fails a draft.
  seo_title: z.string().trim().default(""),
  meta_description: z.string().trim().default(""),
  focus_keyword: z.string().trim().default(""),
  tags: z.array(z.string().trim()).default([]),
});
export const seoSchema = draftSchema.pick({ seo_title: true, meta_description: true, focus_keyword: true, tags: true });

/** AI search engine fields cut to the article columns' limits. */
export function seoColumns(seo) {
  return {
    seo_title: seo.seo_title.slice(0, 70),
    meta_description: seo.meta_description.slice(0, 170),
    focus_keyword: seo.focus_keyword.slice(0, 80),
    tags: [...new Set(seo.tags.map((tag) => tag.slice(0, 50)).filter(Boolean))].slice(0, 6),
  };
}
export const verificationSchema = z.object({
  passed: z.boolean(),
  sensitive: z.boolean(),
  issues: z.array(clipped(600)).max(20),
  checked_claims: z
    .array(
      z.object({
        // The number of the draft sentence this checks (see draftSentences); 0 in older results.
        sentence: z.number().int().min(0).max(200).default(0),
        claim: clipped(700),
        supported: z.boolean(),
        // The source sentences the claim rests on, joined by " | ", so code can confirm the support exists.
        source_quote: clipped(1000).default(""),
        // Why a sentence is unsupported, shown to the reviewer.
        note: clipped(300).default(""),
      }),
    )
    .min(3)
    .max(80),
});

const TITLE_CONNECTORS = new Set("of the and bin bint al el for at to from by on in".split(" "));

/**
 * Keep source casing for official titles; ordinary prose still counts as overlap. A 12-word run may
 * hold two ordinary words ("on behalf of His Highness…") because protocol titles alone fill it.
 */
function sourceShingles(text, length) {
  const tokens = text.normalize("NFKC").match(/[\p{L}\p{N}]+/gu) ?? [];
  const phrases = new Map();
  const allowedProse = Math.floor(length / 6);
  for (let index = 0; index <= tokens.length - length; index++) {
    const run = tokens.slice(index, index + length);
    const prose = run.filter((word) => !/^\p{Lu}|\p{N}/u.test(word) && !TITLE_CONNECTORS.has(word.toLowerCase()));
    if (prose.length <= allowedProse) continue;
    phrases.set(words(run.join(" ")).join(" "), run.join(" "));
  }
  return phrases;
}

const hostOf = (url) => new URL(url).hostname.replace(/^www\./, "");
const domainCount = (urls) => new Set(urls.map(hostOf)).size;

function warnOrBlock(warnings, strictChecks) {
  return (key, message) => {
    if (strictChecks.includes(key)) throw new DraftCheckError(message);
    warnings.push(message);
  };
}

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

/** Empty strict checks preserve reviewer warnings. Core originality and validity checks always block. */
export function checkResearch(research, evidence, strictChecks = []) {
  const byUrl = new Map(evidence.map((page) => [page.url, page]));
  const warnings = [];
  const warn = warnOrBlock(warnings, strictChecks);
  const claims = research.claims
    .map((claim) => ({ ...claim, source_urls: claim.source_urls.filter((url) => byUrl.has(url)) }))
    .filter(
      (claim) =>
        claim.source_urls.length &&
        claim.evidence.some((ref) => byUrl.has(ref.url) && quoteFound(ref.quote, byUrl.get(ref.url).text)),
    );
  if (!claims.length) throw new DraftCheckError("None of the researched facts could be matched to the collected pages");
  if (claims.length < research.claims.length)
    warn(
      "research_quotes_missing",
      `${research.claims.length - claims.length} researched facts were dropped because their quotes were not found on the pages`,
    );
  const checked = {
    ...research,
    claims,
    primary_source_url: byUrl.has(research.primary_source_url) ? research.primary_source_url : null,
  };
  checked.corroboration = corroboration(checked, evidence);
  if (!checked.corroboration.met)
    warn(
      checked.corroboration.required ? "sensitive_second_source" : "single_unofficial_source",
      checked.corroboration.required
        ? "Sensitive or consequential story without a second independent source"
        : "No official source and only one outlet supports the story",
    );
  if (research.unresolved.length)
    warn("unresolved_claims", `Not confirmed by the sources (left out): ${research.unresolved.join("; ")}`);
  return { research: checked, warnings };
}

/** Lowercase ASCII words joined by hyphens; accents dropped, other scripts removed. */
const slugify = (value) =>
  value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 100)
    .replace(/^-+|-+$/g, "");

const shingles = (tokens, length) =>
  new Set(
    tokens
      .slice(0, Math.max(0, tokens.length - length + 1))
      .map((_, index) => tokens.slice(index, index + length).join(" ")),
  );
const draftWords = (draft) => words(`${draft.title} ${draft.excerpt ?? ""} ${draft.body}`);

/** The first 12-word source passage the draft repeats, in the source's wording, or undefined. */
export function copiedPassage(draft, evidence) {
  const phrases = shingles(draftWords(draft), 12);
  return evidence.flatMap((page) => [...sourceShingles(page.text, 12)]).find(([phrase]) => phrases.has(phrase))?.[1];
}

export const COPIED_WARNING = "The draft still repeats source wording";
export const copiedWarning = (copied) => `${COPIED_WARNING} ("${copied.slice(0, 200)}"); reword it`;

/** `copiedAllowed`: after the automatic rewrites, a copied passage becomes a reviewer warning instead of failing the job. */
export function checkDraft(draft, research, evidence, categories, language, strictChecks = [], copiedAllowed = false) {
  if (/<\/?[A-Za-z][^>]*>|https?:\/\/|javascript:/i.test(draft.body))
    throw new DraftCheckError("Draft body must be plain text; sources are attached separately");
  const count = words(draft.body).length;
  if (count < (language === "ar" ? 130 : 180)) throw new ShortDraftError(count);
  const letters = draft.body.match(/\p{L}/gu) ?? [];
  const arabic = draft.body.match(/\p{Script=Arabic}/gu) ?? [];
  if (
    !letters.length ||
    (language === "ar" ? arabic.length / letters.length < 0.5 : arabic.length / letters.length > 0.2)
  )
    throw new DraftCheckError("Draft language does not match the website");
  const copied = copiedPassage(draft, evidence);
  if (copied && !copiedAllowed) throw new CopiedPassageError(copied);
  const shortPhrases = shingles(draftWords(draft), 5);
  const sourcePhrases = new Set(evidence.flatMap((page) => [...sourceShingles(page.text, 5).keys()]));
  if ([...shortPhrases].filter((phrase) => sourcePhrases.has(phrase)).length / Math.max(1, shortPhrases.size) > 0.35)
    throw new DraftCheckError("Draft is too similar to the collected source text");

  const warnings = copied ? [copiedWarning(copied)] : [];
  const warn = warnOrBlock(warnings, strictChecks);
  const collected = new Set(evidence.map((page) => page.url));
  const researched = [...new Set(research.claims.flatMap((claim) => claim.source_urls))];
  let sourceUrls = draft.source_urls.filter((url) => collected.has(url));
  if (sourceUrls.length < draft.source_urls.length)
    warn("uncollected_citations", "The draft cited pages that were not collected; they were removed");
  if (!sourceUrls.length) sourceUrls = researched.slice(0, 4);
  const primary = primaryUrls(research, evidence);
  if (primary.size && !sourceUrls.some((url) => primary.has(url)))
    warn("official_source_not_cited", "The draft does not cite the official source");
  if (research.claims.some((claim) => !claim.source_urls.some((url) => sourceUrls.includes(url))))
    warn("research_not_cited", "Some researched facts are not covered by the draft's cited sources");
  const categoryId = categories.some((category) => category.id === draft.category_id) ? draft.category_id : null;
  if (!categoryId) warn("no_category", "The draft has no category; choose one before publishing");
  warnings.push(...textWarnings(draft, evidence, { language }));
  return {
    draft: {
      ...draft,
      slug: slugify(draft.slug) || slugify(draft.focus_keyword) || null,
      source_urls: sourceUrls,
      category_id: categoryId,
      sensitive: draft.sensitive || research.sensitive || research.needs_corroboration,
      ...seoColumns(draft),
    },
    warnings,
  };
}

// Not after an abbreviation ("Dr. Herrmann") or before a lowercase word ("U.S. officials").
const SENTENCE_END = /(?<!\b(?:Dr|Mr|Mrs|Ms|St|No|Co|Inc|Ltd|Jr|Sr|vs|U\.S|U\.K|e\.g|i\.e)\.)(?<=[.!?؟])\s+(?!\p{Ll})/u;

export const FIELD_LABELS = {
  title: "headline",
  excerpt: "excerpt",
  seo_title: "SEO title",
  meta_description: "meta description",
  body: "body",
};

const openQuote = (text) =>
  (text.match(/"/g)?.length ?? 0) % 2 === 1 || (text.match(/[“«]/g)?.length ?? 0) > (text.match(/[”»]/g)?.length ?? 0);

/** A line's sentences; full stops inside a quotation ("Salaries. Housing. Prices.") do not end one. */
function lineSentences(line) {
  const sentences = [];
  for (const part of line.split(SENTENCE_END)) {
    if (sentences.length && openQuote(sentences.at(-1))) sentences[sentences.length - 1] += ` ${part}`;
    else sentences.push(part);
  }
  return sentences;
}

/** Every sentence a reader sees, in order: headline, excerpt, SEO fields, then each body sentence. */
export function draftSentences(draft) {
  return Object.keys(FIELD_LABELS).flatMap((field) =>
    (draft[field] ?? "")
      .split(/\n+/)
      .flatMap(lineSentences)
      .map((text) => text.trim())
      .filter((text) => /\p{L}{2}/u.test(text))
      .map((text) => ({ field, text })),
  );
}

/** The verifier's "sentence 5" as the field and wording a reviewer can find: 'the meta description "…"'. */
function sentenceNames(text, sentences) {
  if (!sentences) return text;
  return text.replace(/\bsentences?\s+(\d+(?:\s*(?:,|&|and)\s*\d+)*)/gi, (match, numbers) =>
    numbers
      .match(/\d+/g)
      .map((number) => {
        const sentence = sentences[Number(number) - 1];
        if (!sentence) return `sentence ${number}`;
        const wording = sentence.text.length > 100 ? `${sentence.text.slice(0, 100)}…` : sentence.text;
        return `${sentence.field ? `the ${FIELD_LABELS[sentence.field]} ` : ""}"${wording}"`;
      })
      .join(" and "),
  );
}

/**
 * Verifier results as warnings. With the evidence, a claim marked supported whose quote is on no page
 * counts as unsupported: the verifier has to show its support, not only assert it. With the draft's
 * sentences, each one needs its own verdict and is reported in the draft's words, never the verifier's.
 */
export function checkVerification(verification, strictChecks = [], evidence, sentences) {
  const quoteParts = (claim) =>
    (claim.source_quote ?? "")
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);
  const quoted = (claim) => {
    const parts = quoteParts(claim);
    return (
      !evidence || (parts.length > 0 && parts.every((part) => evidence.some((page) => quoteFound(part, page.text))))
    );
  };
  // A date a quoted source sentence states covers the claim, even when another source gives its figure
  // (PM review 19 Nov). A page's publication date dates only its own part: a roundup must not give
  // several announcements one source's date (PM review 14 Nov).
  const undated = (claim, text) => {
    const dates = datesIn(text, false).map(({ key }) => key);
    if (!evidence || !dates.length) return false;
    const parts = quoteParts(claim);
    const stated = new Set(parts.flatMap((part) => datesIn(part, true).map(({ key }) => key)));
    return dates.some(
      (key) =>
        !stated.has(key) &&
        parts.some((part) => !evidence.some((page) => quoteFound(part, page.text) && publishedKey(page) === key)),
    );
  };
  const warnings = [];
  const warn = warnOrBlock(warnings, strictChecks);
  if (!verification.passed) warn("verification_failed", "AI verification did not pass");
  for (const issue of verification.issues)
    warn("verification_issues", `Verification: ${sentenceNames(issue, sentences)}`);
  const checks = sentences
    ? sentences.map(({ field, text }, index) => ({
        text: field ? `[${FIELD_LABELS[field]}] ${text}` : text,
        claim: verification.checked_claims.find((claim) => claim.sentence === index + 1),
      }))
    : verification.checked_claims.map((claim) => ({ text: claim.claim, claim }));
  for (const { text, claim } of checks) {
    const note = claim?.note ? ` (${sentenceNames(claim.note, sentences)})` : "";
    if (!claim) warn("unsupported_claims", `Not checked by AI verification: ${text}`);
    else if (!claim.supported) warn("unsupported_claims", `Unsupported claim: ${text}${note}`);
    else if (!quoted(claim))
      warn("unsupported_claims", `Unsupported claim: ${text} (its quoted support is not on the source pages)`);
    else if (undated(claim, text))
      warn("unsupported_claims", `Unsupported claim: ${text} (the source it rests on does not give this date for it)`);
  }
  return warnings;
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
        // Gemini rejects the whole request for maxItems above 30 (tested November 2026).
        .filter(([key, item]) => properties || (allowed.has(key) && !(key === "maxItems" && item > 30)))
        .map(([key, item]) => [key, clean(item, key === "properties")]),
    );
  };
  return clean(z.toJSONSchema(schema));
}
