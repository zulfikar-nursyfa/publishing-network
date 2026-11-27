/**
 * Reviewer verdicts on draft warnings (warning_feedback). The snapshot keeps what the text checks need to
 * give the warning again, so the regression test (tests/warning-regression.test.mjs) can replay it.
 */
import { TEXT_WARNINGS, textWarnings } from "./text-checks";

export const VERDICTS = ["false_alarm", "real_problem"];
const ARTICLE_FIELDS = ["title", "excerpt", "body", "seo_title", "meta_description"];

/** A job's saved verdicts, for its warning list; author is null for others' marks a non-admin cannot read. */
export async function warningFeedback(db, jobId) {
  const { data } = await db
    .from("warning_feedback")
    .select("warning, verdict, note, profiles:created_by(full_name)")
    .eq("job_id", jobId);
  return (data ?? []).map(({ profiles, ...row }) => ({ ...row, author: profiles?.full_name ?? null }));
}

/** The check a warning came from: a text check's title, or the warning's own label. */
export const warningCheck = (warning) =>
  TEXT_WARNINGS.find((title) => warning.startsWith(title)) ?? warning.split(/[:(]/)[0].trim().slice(0, 200);

/** Whether the deterministic text checks gave this warning, so a regression test can replay it. */
export const isTextWarning = (warning) => TEXT_WARNINGS.some((title) => warning.startsWith(title));

/**
 * The items a text warning lists: "Figures not found in the sources (check each one): 20, 90" gives 20 and 90.
 * shortcut: splits on ", ", so an item that itself has a comma (a quotation) splits too; a fixture's `items`
 * can be edited by hand when that happens.
 */
export function warningItems(warning) {
  const start = warning.indexOf("): ");
  return start < 0 ? [] : warning.slice(start + 3).split(", ");
}

/** Replays the text checks on a snapshot; the warnings they give now. */
export const replayWarnings = ({ article, evidence, language, kind, today }) =>
  textWarnings(article, evidence, { language, kind, today: new Date(today) });

/**
 * `article` as the re-check reads it (body as plain text); `evidence` the pages the last check read.
 * `today` is when the job last ran, for the weekday check.
 */
export function warningSnapshot({ warning, article, evidence, language, kind, today }) {
  const snapshot = {
    article: Object.fromEntries(ARTICLE_FIELDS.map((field) => [field, article[field] ?? ""])),
    evidence: evidence.map(({ url, text }) => ({ url, text })),
    language,
    kind,
    today,
  };
  return { ...snapshot, reproduces: isTextWarning(warning) && replayWarnings(snapshot).includes(warning) };
}
