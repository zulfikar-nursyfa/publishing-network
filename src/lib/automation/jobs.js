import "server-only";
import { randomUUID } from "node:crypto";
import { GeminiError } from "@/lib/ai/gemini";
import { recordAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { approveIfAllowed } from "./auto-publish";
import { DraftCheckError } from "./draft-checks";
import { collectStep, needsCorroboration, searchStep, startCorroboration } from "./drafting/collect";
import { advance, budgetGuard, loadJobContext, textModelFor } from "./drafting/context";
import { DeferredJob, LostLease, PermanentJob } from "./drafting/errors";
import { illustrateStep } from "./drafting/illustrate";
import { RECHECK_STEPS, syncReviewNote } from "./drafting/recheck";
import { draftStep, needsRedraft, noteRedraft, promptData, researchStep, verifyStep } from "./drafting/write";
import { EvidenceError } from "./evidence";
import { waitingKind } from "./drafting/queue-policy";

export { queueSelectedStories } from "./drafting/queue";

/**
 * Draft job steps, in order:
 * collect (search, then read pages) → research → draft → verify → illustrate → create_article.
 * A finished job can be re-checked after edits (see drafting/recheck.js).
 */
const WRITING_STEPS = {
  research: { run: researchStep, next: "draft" },
  draft: { run: draftStep, next: "verify" },
  verify: { run: verifyStep, next: "illustrate" },
  illustrate: { run: illustrateStep, next: "create_article" },
};

/** Ready for the next tick, with a fresh attempt counter. */
const queuedNow = () => ({
  status: "queued",
  attempt_count: 0,
  last_error: null,
  waiting_kind: null,
  waiting_reason: null,
  waiting_since: null,
  run_after: new Date().toISOString(),
});

/** Creates the article in review from the finished job (see complete_draft_job), then auto-approves it if allowed. */
async function createArticle(db, job, worker, website) {
  const { data: articleId, error } = await db.rpc("complete_draft_job", { target_job: job.id, worker });
  if (error) throw new Error(error.message);
  const { seo_title, meta_description, focus_keyword, tags } = job.state.draft;
  await db
    .from("articles")
    .update({
      seo_title: seo_title || null,
      meta_description: meta_description || null,
      focus_keyword: focus_keyword || null,
      tags: tags ?? [],
    })
    .eq("id", articleId)
    .is("seo_title", null);
  const official = (job.state.sources ?? []).filter((source) => source.official).map((source) => source.url);
  if (official.length)
    await db.from("article_sources").update({ official: true }).eq("article_id", articleId).in("url", official);
  await recordAudit({
    action: "automation.draft_created",
    entityType: "article",
    entityId: articleId,
    websiteId: job.website_id,
    details: { job_id: job.id, story_id: job.story_id },
  });
  if (await approveIfAllowed(db, { job, website, articleId })) {
    await recordAudit({
      action: "article.auto_approved",
      entityType: "article",
      entityId: articleId,
      websiteId: job.website_id,
      details: { job_id: job.id, category_id: job.state.draft?.category_id ?? null },
    });
  }
}

async function runStep(db, job, worker) {
  const context = await loadJobContext(db, job, worker);
  if (job.step === "create_article") return createArticle(db, job, worker, context.website);

  const model = textModelFor(context);
  const assertControls = budgetGuard(db, job, worker);

  if (job.step === "collect") {
    const state = job.state.searched
      ? await collectStep(job, context)
      : await searchStep(db, job, worker, { context, model, assertControls });
    // collectStep can send the job back to search once more (state.searched cleared).
    const step = job.state.searched && state.searched ? "research" : "collect";
    await loadJobContext(db, job, worker);
    return advance(db, job, worker, { state, step, ...queuedNow() });
  }

  const recheck = RECHECK_STEPS[job.step];
  if (recheck) {
    const { state, next } = await recheck(db, job, worker, { context, model, assertControls });
    await loadJobContext(db, job, worker);
    if (next) return advance(db, job, worker, { state, step: next, ...queuedNow() });
    await syncReviewNote(db, job, state.warnings);
    return advance(db, job, worker, { state, step: "create_article", status: "succeeded", last_error: null });
  }

  const writing = WRITING_STEPS[job.step];
  if (!writing) throw new PermanentJob("Unknown drafting step");
  const state = structuredClone(job.state);
  const data = promptData(context, state.evidence ?? []);
  let warnings = [];
  let redraft = false;
  try {
    warnings = await writing.run(db, job, worker, { state, data, context, model, assertControls });
  } catch (error) {
    if (job.step !== "draft" || !needsRedraft(state, error)) throw error;
    noteRedraft(state, error);
    redraft = true;
  }
  // Without an official source or second outlet, research is redone after one more search,
  // so this pass's warnings are dropped. Otherwise warnings go into the review note.
  const corroborate = job.step === "research" && needsCorroboration(state);
  if (corroborate) startCorroboration(state);
  else if (!redraft) state.warnings = [...new Set([...(state.warnings ?? []), ...warnings])];

  await loadJobContext(db, job, worker);
  const step = redraft ? "draft" : corroborate ? "collect" : writing.next;
  return advance(db, job, worker, { state, step, ...queuedNow() });
}

/** Waits for budget or a paused site without using an attempt. */
function isDeferred(error) {
  return error instanceof DeferredJob || /budget.*exceeded|Automation is paused or off/i.test(error.message);
}

/** Retrying cannot fix these; a person has to look at the job. */
function isPermanent(error) {
  return (
    error instanceof PermanentJob ||
    error instanceof DraftCheckError ||
    (error instanceof GeminiError && !error.retryable) ||
    (error instanceof EvidenceError && !error.retryable) ||
    error.name === "ZodError" ||
    /Configure model pricing|already has this headline|already has an article/.test(error.message)
  );
}

/** The first few schema problems, e.g. "claims: Too small: expected array to have >=3 items". */
export const validationIssues = (error) =>
  error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`)
    .join("; ");

/** Records a failed step: wait (deferred), retry with backoff, or fail after the last attempt. */
async function handleFailure(db, job, worker, error) {
  const deferred = isDeferred(error);
  const failed = !deferred && (isPermanent(error) || job.attempt_count >= job.max_attempts);
  // A failed re-check leaves the finished job as it was, with the reason as a reviewer warning.
  const rechecking = Boolean(job.article_id);
  const message =
    error.name === "ZodError"
      ? `AI response failed structured validation (${validationIssues(error)}); review the job before retrying`
      : error.message;
  const retryDelaySeconds = deferred ? 300 : Math.min(3600, 30 * 2 ** job.attempt_count);
  const kind = deferred ? waitingKind(message) : null;

  await advance(db, job, worker, {
    status: failed ? (rechecking ? "succeeded" : "failed") : "queued",
    ...(failed && rechecking
      ? {
          step: "create_article",
          state: { ...job.state, warnings: [...(job.state.warnings ?? []), `Re-check stopped: ${message}`] },
        }
      : {}),
    last_error: message.slice(0, 1000),
    waiting_kind: kind,
    waiting_reason: kind ? message.slice(0, 1000) : null,
    waiting_since: kind
      ? ((job.waiting_kind === kind && job.waiting_reason === message.slice(0, 1000) ? job.waiting_since : null) ??
        new Date().toISOString())
      : null,
    attempt_count: deferred ? Math.max(0, job.attempt_count - 1) : job.attempt_count,
    run_after: new Date(Date.now() + retryDelaySeconds * 1000).toISOString(),
  });
  if (failed) {
    await recordAudit({
      action: rechecking ? "automation.recheck_failed" : "automation.draft_failed",
      entityType: "job",
      entityId: job.id,
      websiteId: job.website_id,
      details: { step: job.step, error: message, attempts: job.attempt_count },
    });
  }
  return { outcome: failed ? "failed" : deferred ? "deferred" : "retry", error: message.slice(0, 1000) };
}

/** Runs exactly one step of one job per tick; every write is fenced by this worker's lease. */
export async function tickDraftJobs() {
  const db = createAdminClient();
  const worker = randomUUID();
  const { data, error } = await db.rpc("claim_draft_job", { worker });
  if (error) throw new Error(error.message);
  const job = data?.[0];
  if (!job) return { processed: 0 };

  try {
    await runStep(db, job, worker);
    return { processed: 1, jobId: job.id, step: job.step };
  } catch (stepError) {
    if (stepError instanceof LostLease) return { processed: 1, jobId: job.id, outcome: "lease_lost" };
    try {
      return { processed: 1, jobId: job.id, ...(await handleFailure(db, job, worker, stepError)) };
    } catch (failureError) {
      if (failureError instanceof LostLease) return { processed: 1, jobId: job.id, outcome: "lease_lost" };
      throw failureError;
    }
  }
}
