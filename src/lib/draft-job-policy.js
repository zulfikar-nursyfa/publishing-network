export const ACTIVE_DRAFT_STATUSES = ["queued", "running", "failed"];

export function canRemoveDraft(job, storyStatus) {
  if (!job || !["new", "selected"].includes(storyStatus)) return false;
  return ACTIVE_DRAFT_STATUSES.includes(job.status) || (job.status === "cancelled" && Boolean(storyStatus));
}
