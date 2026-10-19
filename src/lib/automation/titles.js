export const TITLE_SIMILARITY_THRESHOLD = 0.8;
export const RECENT_STORY_DAYS = 7;

/** Feed publisher suffixes are separated by a spaced dash; punctuation within names is retained until tokenizing. */
export function normaliseTitle(title) {
  return String(title ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/^(.*)\s+[-–—]\s+.+$/u, "$1")
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/gu, "")
    .replace(/[أإآ]/gu, "ا")
    .replace(/ى/gu, "ي")
    .replace(/ة/gu, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// The normalized text is itself a deterministic fingerprint, usable in both Node and the browser.
export const titleFingerprint = normaliseTitle;

export function titleSimilarity(left, right) {
  const a = new Set(normaliseTitle(left).split(" ").filter(Boolean));
  const b = new Set(normaliseTitle(right).split(" ").filter(Boolean));
  if (!a.size || !b.size) return 0;
  const shared = [...a].filter((token) => b.has(token)).length;
  return shared / (a.size + b.size - shared);
}

export function sameStory(left, right) {
  if (left.fingerprint && left.fingerprint === (right.fingerprint ?? right.story_fingerprint)) return true;
  const key = left.title_fingerprint || titleFingerprint(left.title);
  return (
    Boolean(key) &&
    (key === (right.title_fingerprint || titleFingerprint(right.title)) ||
      titleSimilarity(left.title, right.title) >= TITLE_SIMILARITY_THRESHOLD)
  );
}
