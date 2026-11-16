// Failed jobs are listed under their own tab, not under Active.
export const ACTIVE_DRAFT_STATUSES = ["queued", "running"];

export function canRemoveDraft(job, storyStatus) {
  if (!job || !["new", "selected"].includes(storyStatus)) return false;
  return ["queued", "running", "failed", "cancelled"].includes(job.status);
}
