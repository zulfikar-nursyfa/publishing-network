import "server-only";
import { recordAudit } from "@/lib/audit";
import { automationBlockReason } from "../policy";
import { storyRows } from "../story-history";
import { staleQueuedStory, STALE_STORY_MS, STALE_STORY_REASON, waitingKind } from "./queue-policy";

/** Recheck age in the RPC under the job lock; a worker may have claimed it since this read. */
export async function maintainDraftQueue(db, websites, network, { now = Date.now(), audit = recordAudit } = {}) {
  const jobs = await storyRows(() =>
    db
      .from("jobs")
      .select(
        "id, website_id, status, step, state, updated_at, last_error, waiting_kind, waiting_reason, waiting_since, story_candidates(source_published_at, created_at)",
      )
      .eq("status", "queued")
      .order("id"),
  );
  const byId = new Map(websites.map((website) => [website.id, website]));
  for (const job of jobs) {
    if (staleQueuedStory(job, job.story_candidates, now)) {
      const { data, error } = await db.rpc("cancel_draft_job", {
        target_job: job.id,
        discard_story: true,
        stale_before: new Date(now - STALE_STORY_MS).toISOString(),
      });
      if (error) throw new Error(`Could not expire waiting draft: ${error.message}`);
      if (data) {
        await audit({
          action: "automation.story_stale",
          entityType: "job",
          entityId: job.id,
          websiteId: job.website_id,
          details: { reason: STALE_STORY_REASON },
        });
        continue;
      }
    }
    const website = byId.get(job.website_id);
    if (!website) continue;
    const blocked = automationBlockReason(website, network);
    const priorBudget = waitingKind(job.last_error) === "budget" ? job.last_error : null;
    const reason = blocked ?? (job.waiting_kind === "paused" ? priorBudget : (job.waiting_reason ?? null));
    const kind = waitingKind(reason ?? "");
    if ((kind ?? null) === (job.waiting_kind ?? null) && reason === (job.waiting_reason ?? null)) continue;
    const { error } = await db
      .from("jobs")
      .update({
        waiting_kind: kind ?? null,
        waiting_reason: reason,
        waiting_since: kind ? new Date(now).toISOString() : null,
      })
      .eq("id", job.id)
      .eq("status", "queued")
      .eq("updated_at", job.updated_at);
    if (error) throw new Error(`Could not update draft waiting state: ${error.message}`);
  }
}
