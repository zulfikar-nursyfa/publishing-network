import { z } from "zod";

const sourceUrls = z.array(z.url()).min(1).max(4);
export class DraftCheckError extends Error {}
export const researchSchema = z.object({
  angle: z.string().min(20).max(800),
  claims: z.array(z.object({
    claim: z.string().min(10).max(700),
    source_urls: sourceUrls,
    evidence: z.array(z.object({ url: z.url(), quote: z.string().min(15).max(500) })).min(1).max(4),
  })).min(3).max(15),
  sensitive: z.boolean(),
  needs_corroboration: z.boolean(),
  unresolved: z.array(z.string().max(500)).max(10),
});
export const draftSchema = z.object({
  title: z.string().trim().min(15).max(200),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(100),
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
  checked_claims: z.array(z.object({ claim: z.string().max(700), supported: z.boolean(), source_urls: sourceUrls })).min(3).max(30),
});

const normalise = (value) => value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
const words = (value) => normalise(value).match(/[\p{L}\p{N}]+/gu) ?? [];

export function checkResearch(research, evidence) {
  if (!evidence.some((item) => item.primary)) throw new DraftCheckError("A permitted primary source is required");
  if (research.unresolved.length) throw new DraftCheckError(`Research needs editorial attention: ${research.unresolved.join("; ")}`);
  const byUrl = new Map(evidence.map((item) => [item.url, item]));
  for (const claim of research.claims) {
    if (claim.source_urls.some((url) => !byUrl.has(url))) throw new DraftCheckError("Research cites a source that was not collected");
    for (const ref of claim.evidence) {
      const page = byUrl.get(ref.url);
      if (!page || !claim.source_urls.includes(ref.url) || !normalise(page.text).includes(normalise(ref.quote))) throw new DraftCheckError("Research evidence quote could not be verified against the collected page");
    }
  }
  if (!research.claims.some((claim) => claim.source_urls.some((url) => byUrl.get(url)?.primary))) throw new DraftCheckError("Research claims must cite primary evidence");
  if ((research.sensitive || research.needs_corroboration) && new Set(evidence.map((page) => new URL(page.url).hostname.replace(/^www\./, ""))).size < 2) {
    throw new DraftCheckError("Sensitive or consequential stories need a second independent permitted source");
  }
}

export function checkDraft(draft, research, evidence, categories, language) {
  if (/<\/?[A-Za-z][^>]*>|https?:\/\/|javascript:/i.test(draft.body)) throw new DraftCheckError("Draft body must be plain text; sources are attached separately");
  const count = words(draft.body).length;
  if (count < (language === "ar" ? 130 : 180)) throw new DraftCheckError("Draft is too short for editorial review");
  const letters = draft.body.match(/\p{L}/gu) ?? [];
  const arabic = draft.body.match(/\p{Script=Arabic}/gu) ?? [];
  if (!letters.length || (language === "ar" ? arabic.length / letters.length < 0.5 : arabic.length / letters.length > 0.2)) throw new DraftCheckError("Draft language does not match the website");
  if (draft.category_id && !categories.some((category) => category.id === draft.category_id)) throw new DraftCheckError("Draft selected a category outside this website");
  const byUrl = new Map(evidence.map((page) => [page.url, page]));
  if (draft.source_urls.some((url) => !byUrl.has(url)) || !draft.source_urls.some((url) => byUrl.get(url)?.primary)) throw new DraftCheckError("Draft must cite collected sources including the primary source");
  if (research.claims.some((claim) => !claim.source_urls.some((url) => draft.source_urls.includes(url)))) throw new DraftCheckError("Draft omitted a source needed to support the research");
  const draftWords = words(`${draft.title} ${draft.excerpt} ${draft.body}`);
  const shingles = (tokens, length) => new Set(tokens.slice(0, Math.max(0, tokens.length - length + 1)).map((_, index) => tokens.slice(index, index + length).join(" ")));
  const phrases = shingles(draftWords, 12);
  for (const page of evidence) {
    if ([...shingles(words(page.text), 12)].some((phrase) => phrases.has(phrase))) throw new DraftCheckError("Draft contains a long copied passage; revise the sourcing and retry");
  }
  const shortPhrases = shingles(draftWords, 5);
  const sourcePhrases = new Set(evidence.flatMap((page) => [...shingles(words(page.text), 5)]));
  if ([...shortPhrases].filter((phrase) => sourcePhrases.has(phrase)).length / Math.max(1, shortPhrases.size) > 0.35) throw new DraftCheckError("Draft is too similar to the collected source text");
  return { ...draft, sensitive: draft.sensitive || research.sensitive || research.needs_corroboration };
}

export function checkVerification(verification, draft, evidence) {
  const allowed = new Set(evidence.map((page) => page.url));
  if (!verification.passed || verification.issues.length || verification.checked_claims.some((claim) => !claim.supported)) {
    throw new DraftCheckError(`Verification failed: ${verification.issues.join("; ") || "unsupported claims"}`);
  }
  if (verification.checked_claims.some((claim) => claim.source_urls.some((url) => !allowed.has(url) || !draft.source_urls.includes(url)))) throw new DraftCheckError("Verification cites an uncollected or omitted source");
}

/** Google's response schema uses a subset; all tighter constraints are also checked by Zod. */
export function responseSchema(schema) {
  const allowed = new Set(["type", "format", "enum", "items", "minItems", "maxItems", "anyOf", "properties", "required", "additionalProperties", "minimum", "maximum"]);
  const clean = (value, properties = false) => {
    if (Array.isArray(value)) return value.map((item) => clean(item));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => properties || allowed.has(key))
      .map(([key, item]) => [key, clean(item, key === "properties")]));
  };
  return clean(z.toJSONSchema(schema));
}
