/**
 * Checks of a draft's wording against its evidence pages, done in code because the AI verifier misses
 * them. Each returns reviewer warnings and never blocks a draft: a reviewer decides.
 */

const normalise = (value) => value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
export const words = (value) => normalise(value).match(/[\p{L}\p{N}]+/gu) ?? [];

/** Everything a reader sees, including the SEO fields sent to WordPress. */
const readerText = (article) =>
  [article.title, article.excerpt, article.body, article.seo_title, article.meta_description]
    .filter(Boolean)
    .join("\n");
const sourceText = (evidence) => evidence.map((page) => page.text).join("\n");
const list = (items) => [...new Set(items)].slice(0, 10).join(", ");

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;
/** Arabic digits as Latin ones and thousands separators removed: "1,000" and "١٠٠٠" give "1000". */
function latinDigits(text) {
  return (
    text
      // Both Arabic digit blocks start at a code point ending in 0, so the low four bits are the digit.
      .replace(ARABIC_DIGITS, (digit) => String(digit.charCodeAt(0) & 0xf))
      .replace(/٫/g, ".")
      .replace(/(\d)[,٬](?=\d{3}\b)/g, "$1")
  );
}

// Digits inside a word (COP28, H1) are names, not figures.
const FIGURE = /(?<![\p{L}\d.])\d+(?:\.\d+)?/gu;
const figures = (text) => latinDigits(text).match(FIGURE) ?? [];

/**
 * Figures in the article that appear in none of the evidence pages: invented, converted or
 * calculated numbers. Single digits are skipped (often days of the month or spelled out in sources).
 */
export function unsourcedFigures(article, evidence) {
  const known = new Set(evidence.flatMap((page) => figures(page.text)));
  const used = figures(readerText(article)).filter((figure) => figure.length > 1);
  return [...new Set(used.filter((figure) => !known.has(figure)))];
}

const SCALES = {
  thousand: "thousand",
  ألف: "thousand",
  آلاف: "thousand",
  million: "million",
  mn: "million",
  m: "million",
  مليون: "million",
  ملايين: "million",
  billion: "billion",
  bn: "billion",
  b: "billion",
  مليار: "billion",
  مليارات: "billion",
  بليون: "billion",
  trillion: "trillion",
  tn: "trillion",
  تريليون: "trillion",
};
// A lone m or b only counts written against the number ("15.6bn", "5m"), not "5 m" for metres.
const SCALED =
  /(?<![\p{L}\d.])(\d+(?:\.\d+)?)(?:\s?(thousand|million|billion|trillion|mn|bn|tn|ألف|آلاف|مليون|ملايين|مليارات|مليار|بليون|تريليون)|(m|b))(?!\p{L})/giu;

function scaledFigures(text) {
  return [...latinDigits(text).matchAll(SCALED)].map((match) => ({
    figure: match[1],
    scale: SCALES[(match[2] ?? match[3]).toLowerCase()],
  }));
}

/** "15.6 billion" where every source with 15.6 says million (or another scale). */
export function scaleMismatches(article, evidence) {
  const known = new Map();
  for (const { figure, scale } of scaledFigures(sourceText(evidence))) {
    known.set(figure, new Set([...(known.get(figure) ?? []), scale]));
  }
  return scaledFigures(readerText(article))
    .filter(({ figure, scale }) => known.has(figure) && !known.get(figure).has(scale))
    .map(({ figure, scale }) => `${figure} ${scale} (sources: ${figure} ${[...known.get(figure)].join(" or ")})`);
}

// Families, not ISO codes: the check is whether a currency was introduced, as by a conversion.
// Short codes (SR, Dh) count only before a number, so "QR code" and "Sr." are not riyals.
const CURRENCIES = {
  dollars: [/\$|(?<![A-Z])USD(?![A-Z])/u, /\bdollars?\b|دولار/iu],
  dirhams: [/(?<![A-Z])AED(?![A-Z])|\bDhs?\s?(?=\d)/u, /\bdirhams?\b|درهم|دراهم/iu],
  riyals: [/(?<![A-Z])(?:SAR|QAR|OMR)(?![A-Z])|\b(?:SR|QR)\s?(?=\d)/u, /\briyals?\b|ريال/iu],
  dinars: [/(?<![A-Z])(?:KWD|BHD|JOD)(?![A-Z])|\b(?:KD|BD)\s?(?=\d)/u, /\bdinars?\b|دينار/iu],
  euros: [/€|(?<![A-Z])EUR(?![A-Z])/u, /\beuros?\b|يورو/iu],
  "pounds sterling": [/£|(?<![A-Z])GBP(?![A-Z])/u, /\bsterling\b|إسترليني|استرليني/iu],
  yuan: [/(?<![A-Z])(?:CNY|RMB)(?![A-Z])/u, /\byuan\b|\brenminbi\b|يوان/iu],
  rupees: [/(?<![A-Z])INR(?![A-Z])|\bRs\.?\s?(?=\d)/u, /\brupees?\b|روبية/iu],
};
const mentions = (text, patterns) => patterns.some((pattern) => pattern.test(text));

/** Currencies the article uses that no source mentions, a sign of an AI conversion. */
export function addedCurrencies(article, evidence) {
  const sources = sourceText(evidence);
  const text = readerText(article);
  return Object.keys(CURRENCIES).filter(
    (name) => mentions(text, CURRENCIES[name]) && !mentions(sources, CURRENCIES[name]),
  );
}

// Straight, curly and Arabic (guillemet) quotation marks.
const QUOTED = /["“«„]([^"“”«»„\n]{10,400}?)["”»]/gu;

/** Words in quotation marks (four or more) that no source contains in that order: invented or altered quotes. */
export function unsourcedQuotes(article, evidence) {
  const pages = evidence.map((page) => ` ${words(page.text).join(" ")} `);
  return [...readerText(article).matchAll(QUOTED)]
    .map((match) => match[1].trim())
    .filter((quote) => {
      const quoteWords = words(quote);
      return quoteWords.length >= 4 && !pages.some((page) => page.includes(` ${quoteWords.join(" ")} `));
    });
}

const MONTHS = "january february march april may june july august september october november december".split(" ");
const WEEKDAYS = "sunday monday tuesday wednesday thursday friday saturday".split(" ");
// Words that are capitalised in titles but often written differently in sources ("CEO", "His Highness").
const TITLE_WORDS = new Set(
  [
    ...MONTHS,
    ...WEEKDAYS,
    "chief executive officer chairman chairwoman chair president vice deputy director general managing manager",
    "minister ministry secretary head founder his her highness excellency sheikh sheikha dr mr mrs ms",
  ].flatMap((value) => value.split(" ")),
);

/**
 * Capitalised words (outside sentence starts) that no source uses in any form: misspelt or invented
 * names, places and organisations. English only, and skipped when the sources are mostly in another script.
 */
export function unknownNames(article, evidence, language) {
  const sources = sourceText(evidence);
  const letters = sources.match(/\p{L}/gu)?.length ?? 0;
  const latin = sources.match(/\p{Script=Latin}/gu)?.length ?? 0;
  if (language === "ar" || latin < letters / 2) return [];
  const known = new Set(words(sources));
  return readerText(article)
    .split(/(?<=[.!?:;])\s+|\n+|["“”«»]/u)
    .flatMap((sentence) => (sentence.match(/[\p{L}\p{N}]+/gu) ?? []).slice(1))
    .filter((word) => /^\p{Lu}/u.test(word) && !known.has(normalise(word)) && !TITLE_WORDS.has(normalise(word)));
}

const RELATIVE_DATES = [
  /\b(?:today|tonight|yesterday|tomorrow|last night|(?:(?:earlier|later) )?this (?:morning|afternoon|evening|week|month|year)|(?:last|next) (?:week|month|year))\b/giu,
  /(?<!\p{L})(?:[وفبل]|بال|وال|ال)?(?:أمس|البارحة|غداً|غدا|الليلة)(?!\p{L})/gu,
  /(?:هذا|الأسبوع|الشهر|العام|السنة)\s(?:الأسبوع|الشهر|العام|الماضي|الماضية|المقبل|المقبلة|القادم|القادمة|الجاري|الجارية)(?!\p{L})/gu,
];

/** "Yesterday", "next week" and the like, which go wrong as soon as the article is read on another day. */
export function relativeDates(article) {
  const text = readerText(article);
  return RELATIVE_DATES.flatMap((pattern) => text.match(pattern) ?? []).map((phrase) => phrase.toLowerCase());
}

const AR_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل|إبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];
const AR_WEEKDAYS = ["الأحد", "الاثنين|الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const indexIn = (names, value) => names.findIndex((name) => name.split("|").includes(value));
const DAY = "(\\d{1,2})(?:st|nd|rd|th)?";
const YEAR = "(?:,?\\s+(\\d{4}))?";
const EN_WEEKDAY = `(${WEEKDAYS.join("|")}),?\\s+`;
const EN_MONTH = `(${MONTHS.join("|")})`;
const DATED_WEEKDAYS = [
  // Monday, 3 November 2026
  { pattern: new RegExp(`${EN_WEEKDAY}${DAY}\\s+${EN_MONTH}${YEAR}`, "giu"), order: [1, 2, 3, 4], ar: false },
  // Monday, November 3, 2026
  { pattern: new RegExp(`${EN_WEEKDAY}${EN_MONTH}\\s+${DAY}${YEAR}`, "giu"), order: [1, 3, 2, 4], ar: false },
  // الاثنين 3 نوفمبر 2026 (optionally "الموافق" between)
  {
    pattern: new RegExp(
      `(${AR_WEEKDAYS.join("|")})\\s*،?\\s*(?:الموافق\\s+)?(\\d{1,2})\\s+(${AR_MONTHS.join("|")})(?:\\s+(\\d{4}))?`,
      "gu",
    ),
    order: [1, 2, 3, 4],
    ar: true,
  },
];

/**
 * Dates given with a weekday that falls on another day (a common AI slip), or that do not exist.
 * A date without a year is taken as the one nearest to `today`.
 */
export function wrongWeekdays(article, today = new Date()) {
  const text = latinDigits(readerText(article));
  const found = [];
  for (const { pattern, order, ar } of DATED_WEEKDAYS) {
    for (const match of text.matchAll(pattern)) {
      const [weekdayName, dayText, monthName, yearText] = order.map((group) => match[group]);
      const weekday = ar ? indexIn(AR_WEEKDAYS, weekdayName) : WEEKDAYS.indexOf(weekdayName.toLowerCase());
      const month = ar ? indexIn(AR_MONTHS, monthName) : MONTHS.indexOf(monthName.toLowerCase());
      const day = Number(dayText);
      const years = yearText ? [Number(yearText)] : [-1, 0, 1].map((offset) => today.getUTCFullYear() + offset);
      const date = years
        .map((year) => new Date(Date.UTC(year, month, day)))
        .sort((a, b) => Math.abs(a - today) - Math.abs(b - today))[0];
      if (date.getUTCDate() !== day) found.push(`${match[0]} (no such date)`);
      else if (date.getUTCDay() !== weekday)
        found.push(`${match[0]} (that date is a ${WEEKDAYS[date.getUTCDay()].replace(/^./, (c) => c.toUpperCase())})`);
    }
  }
  return found;
}

const SUPERLATIVES = [
  /\b(?:largest|biggest|highest|fastest|first-ever|record|record-breaking|historic|landmark|unprecedented|milestone|groundbreaking|game-changing|pioneering|world-class)\b/giu,
  // Not الأعلى or رائد: "المجلس الأعلى" (Supreme Council) and "رائد أعمال" (entrepreneur) are common.
  /(?:الأكبر|الأضخم|الأسرع|قياسي|تاريخي|غير مسبوق|الأول من نوعه|نقلة نوعية)/gu,
];

/** Claims of size, records or firsts ("largest", "historic") that no source makes. */
export function addedSuperlatives(article, evidence) {
  const sources = normalise(sourceText(evidence));
  return SUPERLATIVES.flatMap((pattern) => readerText(article).match(pattern) ?? [])
    .map((term) => normalise(term))
    .filter((term) => !sources.includes(term));
}

const AI_TEXT = [
  /\b(?:as an ai|language model|the (?:provided|supplied|given|collected) (?:sources?|evidence|pages?|data|articles?|research)|according to the (?:evidence|research|data provided|sources provided)|lorem ipsum|placeholder|insert [a-z ]{1,30} here|research\.unresolved|DATA\.\w+)\b/giu,
  /\[[^\]]{0,40}\b(?:name|insert|date|number|figure|source|company|tbd|tbc|placeholder)\b[^\]]{0,40}\]|\b(?:TBD|TBC|XX+)\b/gu,
  /(?:المصادر|الأدلة|البيانات|الصفحات) (?:المقدمة|المرفقة|المتاحة|المزودة|المجمعة)|نموذج لغوي|بصفتي (?:ذكاء|نموذج)/gu,
];

/** Wording addressed to us rather than readers ("the provided sources", "[company name]"). */
export function aiLeftovers(article) {
  const text = readerText(article);
  return AI_TEXT.flatMap((pattern) => text.match(pattern) ?? []);
}

/** Prefixes of the warnings below, so a re-check can replace them. */
export const TEXT_WARNINGS = [
  "Figures not found in the sources",
  "Million/billion differs from the sources",
  "Currency not used in the sources",
  "Quotation not found in the sources",
  "Names not found in the sources",
  "Relative dates",
  "Weekday does not match the date",
  "Claims of scale not found in the sources",
  "AI wording or placeholders left in the draft",
];

/** All of the checks above as reviewer warnings. */
export function textWarnings(article, evidence, { language, today } = {}) {
  const checks = [
    [TEXT_WARNINGS[0], "check each one", unsourcedFigures(article, evidence)],
    [TEXT_WARNINGS[1], "check the scale", scaleMismatches(article, evidence)],
    [TEXT_WARNINGS[2], "check for a conversion", addedCurrencies(article, evidence)],
    [TEXT_WARNINGS[3], "reword or use the exact words", unsourcedQuotes(article, evidence).map((q) => `"${q}"`)],
    [TEXT_WARNINGS[4], "check spelling and that they belong", unknownNames(article, evidence, language)],
    [TEXT_WARNINGS[5], "give the calendar date", relativeDates(article)],
    [TEXT_WARNINGS[6], "check the source's date", wrongWeekdays(article, today)],
    [TEXT_WARNINGS[7], "remove unless a source says so", addedSuperlatives(article, evidence)],
    [TEXT_WARNINGS[8], "remove before publishing", aiLeftovers(article)],
  ];
  return checks
    .filter(([, , found]) => found.length)
    .map(([title, hint, found]) => `${title} (${hint}): ${list(found)}`);
}
