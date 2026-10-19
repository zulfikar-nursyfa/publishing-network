export const STALE_STORY_HOURS = 48;
export const STALE_STORY_MS = STALE_STORY_HOURS * 60 * 60 * 1000;
export const STALE_STORY_REASON = "Story went stale while waiting";
export const MAX_QUEUED_PER_RUN = 12;

export function draftsNeededFor(dailyQuota, articles, jobs) {
  return Math.max(0, Math.min(MAX_QUEUED_PER_RUN, dailyQuota * 2 - articles - jobs));
}

export function staleQueuedStory(job, story, now = Date.now()) {
  const time = Date.parse(story?.source_published_at ?? story?.created_at);
  return (
    job.status === "queued" &&
    job.step === "collect" &&
    !job.state?.research &&
    !job.state?.draft &&
    !job.state?.corroboration_searched &&
    Number.isFinite(time) &&
    time <= now - STALE_STORY_MS
  );
}

export function waitingKind(message = "") {
  if (/budget/i.test(message)) return "budget";
  if (/automation.*paused|automation.*off|website is archived/i.test(message)) return "paused";
  return null;
}

export const waitingLabel = (kind) => (kind === "budget" ? "Waiting for budget" : "Waiting: automation paused");
