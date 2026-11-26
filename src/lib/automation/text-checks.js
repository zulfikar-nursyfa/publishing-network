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
const CURRENCY_CODES = "AED USD SAR QAR OMR KWD BHD JOD EUR GBP CNY RMB INR Dh Dhs SR QR KD BD Rs".split(" ");
// Sources often write a code against the figure ("AED80,000"), which would otherwise read as one word.
const STUCK_CURRENCY = new RegExp(`(?<!\\p{L})(${CURRENCY_CODES.join("|")})(?=\\d)`, "gu");
/**
 * Arabic digits as Latin ones, thousands separators removed and currency codes split from figures:
 * "1,000", "١٠٠٠" and "AED1,000" all give "1000".
 */
function latinDigits(text) {
  return (
    text
      // Both Arabic digit blocks start at a code point ending in 0, so the low four bits are the digit.
      .replace(ARABIC_DIGITS, (digit) => String(digit.charCodeAt(0) & 0xf))
      .replace(/٫/g, ".")
      .replace(/(\d)[,٬](?=\d{3}\b)/g, "$1")
      .replace(STUCK_CURRENCY, "$1 ")
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
  const text = readerText(article);
  // Any digits in a source count, even inside a word: "Hub71" supports "هوب 71", and Arabic "و26%" means "and 26%".
  const known = new Set([
    ...evidence.flatMap((page) => latinDigits(page.text).match(/\d+(?:\.\d+)?/g) ?? []),
    ...scaledFigures(sourceText(evidence)).map(expanded),
  ]);
  // "650 ألف" where the source says "650,000" (PM review 22 Nov), and the reverse.
  const written = new Set(
    scaledFigures(text)
      .filter((found) => known.has(expanded(found)))
      .map(({ figure }) => figure),
  );
  const used = figures(text).filter((figure) => figure.length > 1 && !written.has(figure));
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

const MULTIPLIERS = { thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 };
// Rounded: 2.3 * 1e6 is 2299999.9999999995 in floating point.
const expanded = ({ figure, scale }) => String(Math.round(Number(figure) * MULTIPLIERS[scale]));

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

const isArabic = (text) => {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  return (text.match(/\p{Script=Arabic}/gu)?.length ?? 0) > letters / 2;
};

/**
 * Words in quotation marks (four or more) that no source in the same script contains in that order:
 * invented or altered quotes. A quote with no source in its script is a translation, such as an English
 * strategy's name in Arabic guillemets, which only the AI verifier can judge (PM review 19 Nov).
 */
export function unsourcedQuotes(article, evidence) {
  const pages = evidence.map((page) => ({ arabic: isArabic(page.text), text: ` ${words(page.text).join(" ")} ` }));
  return [...readerText(article).matchAll(QUOTED)]
    .map((match) => match[1].trim())
    .filter((quote) => {
      const quoteWords = words(quote);
      const sameScript = pages.filter((page) => page.arabic === isArabic(quote));
      return (
        quoteWords.length >= 4 &&
        sameScript.length > 0 &&
        !sameScript.some((page) => page.text.includes(` ${quoteWords.join(" ")} `))
      );
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

/** A headline in title case ("Dubai Expands Tech Ties"), where capitals do not mark names. */
function isTitleCase(line) {
  const long = line.match(/\p{L}{4,}/gu) ?? [];
  return long.length >= 3 && long.filter((word) => /^\p{Lu}/u.test(word)).length >= long.length * 0.8;
}

// A run of capitalised words, which may hold connectors ("Department of Land and Property").
// Hyphenated words stay whole, so "Economic Co-operation" gives the C of OECD.
const CAPITALISED_RUN =
  /\p{Lu}[\p{L}\p{N}]*(?:-[\p{L}\p{N}]+)*(?:(?:\s+(?:of|and|for|the|&))*\s+\p{Lu}[\p{L}\p{N}]*(?:-[\p{L}\p{N}]+)*)+/gu;

/** Words of a spelt-out acronym the sources use ("Multiple Listing Service" where they say "MLS"). */
function expandedAcronyms(text, sources) {
  const acronyms = new Set(
    (sources.match(/(?<![\p{L}\p{N}])\p{Lu}{2,6}(?=s?(?![\p{L}\p{N}]))/gu) ?? []).map(normalise),
  );
  return (text.match(CAPITALISED_RUN) ?? []).flatMap((run) => {
    const capitalised = run.match(/\p{Lu}[\p{L}\p{N}]*/gu);
    return acronyms.has(normalise(capitalised.map((word) => word[0]).join(""))) ? capitalised.map(normalise) : [];
  });
}

/** "Macs" where the sources say "Mac", or "Mac" where they say "Macs". */
const wordForms = (word) => [
  word,
  `${word}s`,
  word.replace(/s$/, ""),
  word.replace(/es$/, ""),
  word.replace(/ies$/, "y"),
  // "Organisation" where the sources say "Organization", and the reverse.
  word.replace(/i([sz])(?=ations?$|e[sd]?$|ing$)/, (_, letter) => (letter === "s" ? "iz" : "is")),
];

/**
 * Capitalised words (outside sentence starts) that no source uses in any form: misspelt or invented
 * names, places and organisations. English only, and skipped when the sources are mostly in another script.
 * Title-case headlines are skipped; their names nearly always recur in the body, where they are checked.
 */
export function unknownNames(article, evidence, language) {
  const sources = sourceText(evidence);
  const letters = sources.match(/\p{L}/gu)?.length ?? 0;
  const latin = sources.match(/\p{Script=Latin}/gu)?.length ?? 0;
  if (language === "ar" || latin < letters / 2) return [];
  // "AED240" splits into the currency and the figure, so it is not read as a name.
  const text = latinDigits(readerText(article));
  const known = new Set([...words(sources), ...expandedAcronyms(text, sources)]);
  return text
    .split("\n")
    .filter((line) => !isTitleCase(line))
    .flatMap((line) => line.split(/(?<=[.!?:;])\s+|["“”«»]/u))
    .flatMap((sentence) => (sentence.match(/[\p{L}\p{N}]+/gu) ?? []).slice(1))
    .filter(
      (word) =>
        /^\p{Lu}/u.test(word) &&
        !wordForms(normalise(word)).some((form) => known.has(form)) &&
        !TITLE_WORDS.has(normalise(word)) &&
        // Currencies are checked by addedCurrencies.
        !CURRENCY_CODES.includes(word),
    );
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
  // Rankings and comparisons, such as an invented "top four financial centres".
  /\b(?:top (?:\d+|two|three|four|five|six|seven|eight|nine|ten|twenty|fifty|hundred)|ranked|ranks|ranking|number one|(?:second|third)-(?:largest|biggest)|foremost|(?:one of|among) the (?:largest|biggest|leading|top|best|most|fastest))\b/giu,
  // Not الأعلى or رائد: "المجلس الأعلى" (Supreme Council) and "رائد أعمال" (entrepreneur) are common.
  /(?:الأكبر|الأضخم|الأسرع|قياسي|تاريخي|غير مسبوق|الأول من نوعه|نقلة نوعية|ضمن أفضل|من بين أكبر|ضمن أكبر|المرتبة)/gu,
];

// Arabic wording in a source that supports an English claim, for English drafts of Arabic sources.
const AR_SUPERLATIVES = [
  [/largest|biggest/, /أكبر|أضخم/],
  [/highest/, /أعلى/],
  [/fastest/, /أسرع/],
  [/first-ever|pioneering|groundbreaking/, /الأول|لأول مرة|رائد/],
  [/record/, /قياسي/],
  [/historic|landmark/, /تاريخي/],
  [/unprecedented/, /غير مسبوق/],
  [/(?:one of|among) the (?:most|leading|top|best)/, /من (?:أكثر|أبرز|أهم|أفضل)|من بين|ضمن/],
  [/top|ranked|ranks|ranking|number one|foremost/, /المرتبة|المركز|أفضل|تصنيف/],
  [/milestone/, /محطة|إنجاز/],
];

/** Claims of size, records, rankings or firsts ("largest", "top four") that no source makes. */
export function addedSuperlatives(article, evidence) {
  const sources = normalise(sourceText(evidence));
  return SUPERLATIVES.flatMap((pattern) => readerText(article).match(pattern) ?? [])
    .map((term) => normalise(term))
    .filter(
      (term) => !sources.includes(term) && !AR_SUPERLATIVES.some(([en, ar]) => en.test(term) && ar.test(sources)),
    );
}

// Wording that makes one fact the cause of another, with the next word's first letter. "<verb> by" counts
// only before a lowercase word: "supported by new completions" is a cause, "supported by Sharjah Islamic Bank" a sponsor.
const CAUSAL =
  /\b((?:driven|fuell?ed|supported|underpinned|boosted|spurred|propelled|lifted|helped|buoyed|powered) by|due to|thanks to|owing to|as a result of|on the back of|because of|led to|resulting in|contributed to)\b(?:\s+(?:the\s+)?(\p{L}))?/giu;
const AR_CAUSAL = /بسبب|نتيجة|بفضل|مدفوع|مدعوم|ساهم|أسهم|أدى|يعود إلى|بدعم من/u;

/** "Growth supported by new project completions" where the sources give the two facts separately. */
export function addedCausalLinks(article, evidence) {
  const causes = (text) =>
    new Set(
      [...text.matchAll(CAUSAL)]
        .filter(([, term, next = ""]) => !/ by$/i.test(term) || !/\p{Lu}/u.test(next))
        .map(([, term]) => normalise(term)),
    );
  const sources = sourceText(evidence);
  if (AR_CAUSAL.test(sources)) return [];
  const known = causes(sources);
  return [...causes(readerText(article))].filter((term) => !known.has(term));
}

// Words that make a figure a capacity, target, estimate or bound rather than a result. Not "may": the month.
const QUALIFIERS = [
  // "Over" and "under" only before a figure: "rose 32.9% over the past year" names a period, not "more than".
  /\b(?:up to|as many as|capacity|capable|able to|aims?|aiming|aimed|targets?|targeting|targeted|goals?|expected|expects?|projected|forecasts?|planned|plans?|proposed|potential|estimated|estimates?|could|might|about|around|approximately|nearly|almost|roughly|more than|at least|less than|fewer than)\b|\b(?:over|under)(?= \d)/u,
  // "حتى" is "up to" only right before the figure: "حتى الحوض 49" is "to Basin 49", "من 6 حتى 16" a range.
  /(?:حتى(?= \d)|نحو|حوالي|قرابة|أكثر من|ما يزيد|أقل من|ما يصل|طاقة|قدرة|استيعاب|يستهدف|تستهدف|هدف|متوقع|يتوقع|مخطط|تقدير|محتمل)/u,
];
// A bound just before the next figure is that figure's: in "100 representing more than 75", "more than" is 75's.
const NEXT_FIGURES_BOUND =
  /\s(?:up to|as many as|about|around|approximately|nearly|almost|roughly|more than|at least|less than|fewer than|over|under|حتى|نحو|حوالي|قرابة|أكثر من|ما يزيد(?: عن| على)?|أقل من|ما يصل إلى)$/u;
const qualifierIn = (context) => QUALIFIERS.map((pattern) => context.match(pattern)?.[0]).find(Boolean);

/**
 * The words around each figure within its clause (years and single digits skipped), keyed by the figure.
 * Another figure ends the context: in "over 50 countries across 11 sections", "over" belongs to 50, not 11.
 */
function figureContexts(text) {
  const contexts = new Map();
  for (const clause of latinDigits(normalise(text)).split(/[;:!?،؛]|[.,](?=\s|$)/u)) {
    const tokens = clause.match(/\d+(?:\.\d+)?|[\p{L}\p{M}]+/gu) ?? [];
    const isFigure = (token) => /^\d/.test(token);
    tokens.forEach((token, index) => {
      if (!isFigure(token) || token.length < 2 || /^(?:19|20)\d\d$/.test(token)) return;
      let start = index;
      while (start > Math.max(0, index - 6) && !isFigure(tokens[start - 1])) start--;
      let end = index + 1;
      while (end < Math.min(tokens.length, index + 5) && !isFigure(tokens[end])) end++;
      let context = tokens.slice(start, end).join(" ");
      if (isFigure(tokens[end] ?? "")) context = context.replace(NEXT_FIGURES_BOUND, "");
      if (isFigure(tokens[start - 1] ?? "")) context = context.replace(/^حتى /u, "");
      contexts.set(token, [...(contexts.get(token) ?? []), context]);
    });
  }
  return contexts;
}

/**
 * "Trained 10,000 learners" where the source says "capacity to train up to 10,000": a target written as a result.
 * shortcut: a figure the sources also give unqualified passes, since the article may mean that mention ("100
 * projects" beside "more than 100 entities"); compare the words after each figure if a real drop slips through.
 */
export function droppedQualifiers(article, evidence) {
  const sources = figureContexts(sourceText(evidence));
  return [...figureContexts(readerText(article))].flatMap(([figure, contexts]) => {
    const qualifiers = (sources.get(figure) ?? []).map(qualifierIn);
    const qualifier = qualifiers.every(Boolean) && qualifiers[0];
    return qualifier && !contexts.some(qualifierIn) ? [`${figure} (sources: "${qualifier}")`] : [];
  });
}

// How a programme or event is delivered. Bare "remote" and "virtual" are left out ("remote areas", "virtual reality").
const DELIVERY_MODES = [
  /\b(?:online|virtual|remote)\s+(?:training|courses?|programmes?|programs?|sessions?|learning|platform|events?|workshops?|classes|modules?|forums?|meetings?|summit|conference|participation|tours?)\b|\b(?:held|delivered|conducted|offered|run|hosted|taught|attended|took place|takes place|taking place)\s+(?:entirely |fully |exclusively )?(?:online|virtually|remotely)\b|\bhybrid\b|\bwebinars?\b|\blive-?stream(?:ed|ing)?\b/giu,
  /عن بُ?عد|افتراضي|افتراضية|عبر الإنترنت|عبر الانترنت|منصة رقمية|منصة إلكترونية/gu,
];
const MODE_WORDS =
  /\bonline\b|\bvirtual(?:ly)?\b|\bremote(?:ly)?\b|\bhybrid\b|\bwebinars?\b|\blive-?stream|\bdigital(?:ly)?\b|عن بُ?عد|افتراضي|الإنترنت|الانترنت|رقمي|إلكتروني/iu;

/** The sources say a programme is online and the article never does, so readers assume people attended in person. */
export function droppedFormat(article, evidence) {
  if (MODE_WORDS.test(readerText(article))) return [];
  const sources = sourceText(evidence);
  return [...new Set(DELIVERY_MODES.flatMap((pattern) => sources.match(pattern) ?? []).map(normalise))];
}

// Words that say something happened, or who did it, flagged in English drafts.
// A family is [flagged words, source words with the same meaning]: "reached financial close" supports
// "completed the financial close", but "reached" itself is too common to flag. The unanchored Arabic
// stems match inside prefixed words (واتفق, بالتوقيع) for English drafts of Arabic sources.
const ACTIONS = [
  [/^sign(?:s|ed|ing)?$|^signator(?:y|ies)$/, /وقع|توقيع/],
  [/^agree(?:s|d|ing|ment|ments)?$/, /اتفق|اتفاق|توافق|وافق/],
  // Property and market reports count sales as "transactions"; "deals" for them is not an added agreement.
  [/^deals?$/, /^transactions?$/, /صفق/],
  [/^contract(?:s|ed)?$/, /عقد/],
  [/^(?:mou|mous|memorandum|memoranda)$/, /مذكر/],
  [
    /^launch(?:es|ed|ing)?$/,
    /^(?:unveil(?:s|ed|ing)?|introduc(?:e|es|ed|ing|tion)|debut(?:s|ed)?|rollout|start(?:s|ed|ing)?|initiat(?:e|es|ed|ing))$/,
    /أطلق|اطلق|إطلاق|اطلاق|دشن|تدشين|طرح|انطلق|انطلاق|بدء|بدأ|إنشاء|انشاء/,
  ],
  [/^complet(?:e|es|ed|ing|ion)$/, /^reach(?:es|ed|ing)?$/, /أكمل|اكمل|استكمال|إتمام|اتمام|أتم|إنجاز|أنجز/],
  [/^finali[sz](?:e|es|ed|ing)$/, /إتمام|اتمام|أتم|نهائي/],
  [/^establish(?:es|ed|ing|ment)?$/, /^forg(?:e|es|ed|ing)$/, /تأسيس|أسس|إنشاء|انشاء|أنشأ/],
  [/^secur(?:e|es|ed|ing)$/, /حصل|حصول|تأمين/],
  [/^approv(?:e|es|ed|ing|al|als)$/, /وافق|موافق|اعتمد|اعتماد|أقر|إقرار|صادق|مصادق/],
  [
    /^award(?:s|ed|ing)?$/,
    /^(?:won|wins?|winners?|winning|prizes?|honou?r(?:s|ed|ing|ees?)?|recipients?|accolades?|grant(?:s|ed|ing)?)$/,
    /منح|ترسية|جائز|فاز|فوز|تكريم|كرم|تتويج/,
  ],
  [/^confirm(?:s|ed|ing|ation)?$/, /أكد|تأكيد/],
  [/^inaugurat(?:e|es|ed|ing|ion)$/, /افتتح|افتتاح|دشن|تدشين/],
  [/^open(?:s|ed|ing)$/, /افتت|فتح/],
  [/^commenc(?:e|es|ed|ing|ement)$/, /بدأ|بدء|انطلق|انطلاق|شرع/],
  [/^partnerships?$/, /شراك/],
  [/^commit(?:s|ted|ting|ment|ments)$/, /لتزم|لتزام/],
  [/^pledg(?:e|es|ed|ing)$/, /تعهد/],
  [/^attend(?:s|ed|ing|ance|ees?)$/, /حضر|حضور|شارك|مشارك/],
  [/^host(?:s|ed|ing)$/, /ضاف|ضيف/],
  [/^(?:led|headed|chaired|presided)$/, /رأس|رئاس|قاد|يقود/],
  [/^tour(?:s|ed|ing)?$/, /جول|تفقد/],
];

// "Its opening cycle" is the first cycle, not something that opened (PM review 22 Nov).
const FIRST_OF =
  /\bopening (?=(?:cycle|round|edition|season|session|phase|stage|batch|cohort|day|week|month|quarter|year|remarks|speech|address|keynote)s?\b)/giu;

/** "Signed", "launched", "attended", "toured": outcomes, roles and presence no source states. */
export function addedActions(article, evidence) {
  const sourceWords = [...new Set(words(sourceText(evidence)))];
  const missing = ACTIONS.filter((family) => !sourceWords.some((word) => family.some((pattern) => pattern.test(word))));
  const text = readerText(article).replace(FIRST_OF, "");
  return [...new Set(words(text))].filter((word) => missing.some(([flagged]) => flagged.test(word)));
}

const MONTH =
  "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?(?!\\p{L})";
const DAYS =
  "(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*(?:-|–|—|to|and|until|through|إلى|الى|و|حتى)\\s*(\\d{1,2})(?:st|nd|rd|th)?)?";
// shortcut: French is the only other Latin-script source language seen so far (Carmila, 17 Nov); add others as they appear.
const FR_MONTHS = [
  "janvier",
  "février|fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août|aout",
  "septembre",
  "octobre",
  "novembre",
  "décembre|decembre",
];
const DATES = [
  { pattern: new RegExp(`(?<!\\d)${DAYS}\\s+(?:of\\s+)?${MONTH}`, "giu"), groups: [1, 2, 3] },
  { pattern: new RegExp(`${MONTH}\\s+${DAYS}(?!\\d)`, "giu"), groups: [2, 3, 1] },
  { pattern: new RegExp(`(?<!\\d)${DAYS}\\s+(${AR_MONTHS.join("|")})`, "gu"), groups: [1, 2, 3], names: AR_MONTHS },
  {
    pattern: new RegExp(`(?<!\\d)${DAYS}\\s+(${FR_MONTHS.join("|")})(?!\\p{L})`, "giu"),
    groups: [1, 2, 3],
    names: FR_MONTHS,
  },
];

const monthIndex = (name, names) =>
  names
    ? indexIn(names, name.toLowerCase())
    : MONTHS.findIndex((month) => month.startsWith(name.toLowerCase().slice(0, 3)));

/** Each day-and-month date in the text with its wording; a range ("10-12 November") gives every day in it. */
export function datesIn(text, everyDay) {
  const found = [];
  for (const { pattern, groups, names } of DATES) {
    for (const match of latinDigits(text).matchAll(pattern)) {
      const [first, last, monthName] = groups.map((group) => match[group]);
      const month = monthIndex(monthName, names);
      const [start, end] = [Number(first), Number(last ?? first)];
      if (start < 1 || end > 31 || end < start) continue;
      const days = everyDay
        ? Array.from({ length: end - start + 1 }, (_, offset) => start + offset)
        : [...new Set([start, end])];
      found.push(...days.map((day) => ({ key: `${month}-${day}`, wording: match[0].replace(/\.$/, "") })));
    }
  }
  return found;
}

/** A page's publication date in the form datesIn keys dates, or null. */
export function publishedKey(page) {
  const date = page.published_at && new Date(page.published_at);
  return date && !Number.isNaN(date.getTime()) ? `${date.getUTCMonth()}-${date.getUTCDate()}` : null;
}

// A month followed by a year, with or without a day between ("June 2026", "November 20, 2026").
const MONTH_YEARS = [
  { pattern: new RegExp(`${MONTH}(?:\\s+${DAYS})?,?\\s+(\\d{4})(?!\\d)`, "giu") },
  { pattern: new RegExp(`(${AR_MONTHS.join("|")})\\s+(\\d{4})(?!\\d)`, "gu"), names: AR_MONTHS },
  { pattern: new RegExp(`(${FR_MONTHS.join("|")})\\s+(\\d{4})(?!\\d)`, "giu"), names: FR_MONTHS },
];
const monthYearsIn = (text) =>
  MONTH_YEARS.flatMap(({ pattern, names }) =>
    [...latinDigits(text).matchAll(pattern)].map((match) => ({
      key: `${monthIndex(match[1], names)}-${match.at(-1)}`,
      wording: match[0],
    })),
  );

/**
 * Event dates in the article that no source gives, such as a summit's dates moved or widened,
 * and years no source gives with that month ("June 2026" where the source says "in June").
 */
export function unsourcedDates(article, evidence) {
  const sources = sourceText(evidence);
  const known = new Set(datesIn(sources, true).map(({ key }) => key));
  for (const page of evidence) if (publishedKey(page)) known.add(publishedKey(page));
  const knownYears = new Set(monthYearsIn(sources).map(({ key }) => key));
  for (const page of evidence) {
    const date = page.published_at && new Date(page.published_at);
    if (date && !Number.isNaN(date.getTime())) knownYears.add(`${date.getUTCMonth()}-${date.getUTCFullYear()}`);
  }
  const text = readerText(article);
  return [
    ...datesIn(text, false).filter(({ key }) => !known.has(key)),
    ...monthYearsIn(text).filter(({ key }) => !knownYears.has(key)),
  ].map(({ wording }) => wording);
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

// Health network: claims of certainty or safety the shared rules forbid without a source and its limits.
const HEALTH_CERTAINTY = [
  /\b(?:scientifically proven|clinically proven|proven to (?:cure|treat|work|prevent)|guaranteed|completely safe|totally safe|100% (?:safe|effective)|risk[- ]free|no side effects|miracle|permanent cure|cures? (?:it )?for good)\b/giu,
  /(?:مثبت(?:ة)? علمي(?:ًا|اً|ا)|(?:نتائج|نتيجة) مضمونة|(?:شفاء|نجاح) مضمون|مضمون(?:ة)? النتائج|آمن(?:ة)? تمام(?:ًا|اً|ا)|بلا مخاطر|دون مخاطر|بدون آثار جانبية|دون آثار جانبية|بلا آثار جانبية|علاج نهائي|العلاج النهائي|علاج سحري|معجزة)/gu,
];

/** "Scientifically proven", "guaranteed", "completely safe" and the like, kept only when a source says the same. */
export function healthCertainty(article, evidence) {
  const sources = normalise(sourceText(evidence));
  return HEALTH_CERTAINTY.flatMap((pattern) => readerText(article).match(pattern) ?? [])
    .map((term) => normalise(term))
    .filter((term) => !sources.includes(term));
}

// A review the team has not documented, or a named reviewer: never added by drafting.
const MEDICAL_REVIEW = [
  /\b(?:medically reviewed|medical(?:ly)? review(?:ed)? by|reviewed by (?:a |our )?(?:doctor|physician|specialist|consultant|pharmacist)|fact[- ]checked by (?:a |our )?(?:doctor|physician))\b/giu,
  /(?:مراج(?:َ)?ع(?:ة)? طبي(?:ًا|اً|ا)|مراجعة طبية|راجع(?:ه|ها)? (?:الطبيب|طبيب|د\.)|بمراجعة (?:الطبيب|طبيب|د\.))/gu,
];

export const medicalReviewClaims = (article) =>
  MEDICAL_REVIEW.flatMap((pattern) => readerText(article).match(pattern) ?? []);

// Telling the reader to start, stop or change a medicine or dose, or a dose with a schedule.
const DOSING = [
  /\b(?:take|start|stop|skip|increase|reduce|lower|double|change|adjust|halve)\s+(?:taking\s+)?(?:your|the|a)?\s*(?:dose|dosage|medication|medicine|prescription|tablets?|pills?|insulin|antibiotics?)\b/giu,
  /\b\d+(?:\.\d+)?\s?(?:mg|mcg|µg|ml|iu|units?)\s+(?:a day|per day|daily|twice|once|three times|every)\b/giu,
  /(?:تناول|توقف عن|توقّف عن|أوقف|ضاعف|خفّض|خفض|زد|غيّر|عدّل)\s+(?:جرعة|الجرعة|جرعتك|الدواء|دواءك|الأدوية|أدويتك|الإنسولين|المضاد الحيوي)/gu,
  /\d+(?:[.,]\d+)?\s?(?:ملغ|ملغم|مغ|ميكروغرام|مل|وحدة)\s+(?:يومي(?:ًا|اً|ا)|في اليوم|مرة|مرتين|كل)/gu,
];

export const dosingInstructions = (article) => DOSING.flatMap((pattern) => readerText(article).match(pattern) ?? []);

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
  "Qualifiers dropped from figures",
  "Online or remote format not stated",
  "Actions not found in the sources",
  "Dates not found in the sources",
  "Causal links not found in the sources",
  "Health claims of certainty or safety",
  "Medical review claimed",
  "Medicine or dose instructions",
];

/** All of the checks above as reviewer warnings; `kind` is the website's network type. */
export function textWarnings(article, evidence, { language, today, kind = "general" } = {}) {
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
    [TEXT_WARNINGS[9], "a capacity, target or estimate is not a result", droppedQualifiers(article, evidence)],
    [TEXT_WARNINGS[10], "say so as the sources do", droppedFormat(article, evidence)],
    [TEXT_WARNINGS[11], "check the sources say this happened and who did it", addedActions(article, evidence)],
    [TEXT_WARNINGS[12], "check the source's dates", unsourcedDates(article, evidence)],
    [TEXT_WARNINGS[13], "keep facts the sources give separately apart", addedCausalLinks(article, evidence)],
    ...(kind === "health"
      ? [
          [TEXT_WARNINGS[14], "remove unless a source says so, with its limits", healthCertainty(article, evidence)],
          [TEXT_WARNINGS[15], "remove: no documented medical review", medicalReviewClaims(article)],
          [
            TEXT_WARNINGS[16],
            "an article must not tell readers to start, stop or change a medicine",
            dosingInstructions(article),
          ],
        ]
      : []),
  ];
  return checks
    .filter(([, , found]) => found.length)
    .map(([title, hint, found]) => `${title} (${hint}): ${list(found)}`);
}
