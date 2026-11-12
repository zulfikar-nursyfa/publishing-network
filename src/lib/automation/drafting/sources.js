import { z } from "zod";
import { draftSchema, researchSchema } from "../draft-checks";

/*
 * The AI cites collected pages by their DATA.evidence `source` number, not by URL. Arabic source URLs are
 * hundreds of percent-encoded characters each; repeated per claim they were about three quarters of the
 * research and verify output, which pushed verify past its 8k token and 50 s limits. Jobs keep URLs in
 * their state: these helpers convert at the AI boundary only.
 */
// The explicit max matters: Gemini rejects the whole request for z.int()'s default 2^53 maximum.
const sourceNumber = z.int().min(1).max(99);
const sourceNumbers = z.array(sourceNumber).min(1).max(4);
const claimShape = researchSchema.shape.claims.element.shape;

export const researchOutputSchema = researchSchema.omit({ claims: true, primary_source_url: true }).extend({
  claims: z
    .array(
      z.object({
        claim: claimShape.claim,
        sources: sourceNumbers,
        evidence: z
          .array(z.object({ source: sourceNumber, quote: claimShape.evidence.element.shape.quote }))
          .min(1)
          .max(4),
      }),
    )
    .min(3)
    .max(15),
  // The supplied page that is the original company/government/regulator announcement, if any.
  primary_source: sourceNumber.nullable(),
});

export const draftOutputSchema = draftSchema.omit({ source_urls: true }).extend({ sources: sourceNumbers });

/** An unknown number becomes "", which the research and draft checks drop as an uncollected page. */
const urlFor = (evidence) => (number) => evidence[number - 1]?.url ?? "";
const numberFor = (evidence) => (url) => evidence.findIndex((page) => page.url === url) + 1;

export function researchWithUrls({ claims, primary_source, ...research }, evidence) {
  const url = urlFor(evidence);
  return {
    ...research,
    primary_source_url: primary_source ? url(primary_source) || null : null,
    claims: claims.map(({ claim, sources, evidence: refs }) => ({
      claim,
      source_urls: sources.map(url),
      evidence: refs.map(({ source, quote }) => ({ url: url(source), quote })),
    })),
  };
}

/** Checked research as the draft prompt shows it: pages by number. */
export function researchWithNumbers({ claims, primary_source_url, ...research }, evidence) {
  const number = numberFor(evidence);
  return {
    ...research,
    primary_source: primary_source_url ? number(primary_source_url) || null : null,
    claims: claims.map(({ claim, source_urls, evidence: refs }) => ({
      claim,
      sources: source_urls.map(number),
      evidence: refs.map(({ url, quote }) => ({ source: number(url), quote })),
    })),
  };
}

export function draftWithUrls({ sources, ...draft }, evidence) {
  return { ...draft, source_urls: sources.map(urlFor(evidence)) };
}
