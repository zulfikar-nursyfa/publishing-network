"use server";

import { refresh, revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requireAdmin, requireUser, requireWebsite } from "@/lib/auth";
import { isFetchableUrl } from "@/lib/automation/evidence";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFrom, usageReconciliationSchema } from "@/lib/validation";

const URL_ERROR = "Provide at most four full https:// URLs, one per line.";

function supportingUrls(formData) {
  const urls = [
    ...new Set(
      String(formData.get("evidence_urls") ?? "")
        .split(/\s+/)
        .filter(Boolean),
    ),
  ];
  return urls.length <= 4 && urls.every((url) => url.length <= 2000 && isFetchableUrl(url)) ? urls : null;
}

export async function queueStoryDraft(storyId, _prev, formData) {
  const user = await requireUser();
  const db = await createClient();
  const { data: story, error: storyError } = await db
    .from("story_candidates")
    .select("website_id, status")
    .eq("id", storyId)
    .maybeSingle();
  if (storyError || !story) return { error: "Story not found" };
  const { website } = await requireWebsite(story.website_id);
  if (website.archived_at || story.status !== "selected")
    return { error: "Select a story on an active website before queuing a draft." };
  const urls = supportingUrls(formData);
  if (!urls) return { error: URL_ERROR };
  const admin = createAdminClient();
  const { data: jobId, error } = await admin.rpc("queue_story_draft", {
    target_story: storyId,
    requester: user.id,
    evidence_urls: urls,
  });
  if (error) return { error: error.message };
  const { data: job } = await admin.from("jobs").select("status").eq("id", jobId).single();
  if (["failed", "cancelled"].includes(job?.status))
    return { error: `This story already has a ${job.status} draft job. Retry it from Draft jobs.` };
  await recordAudit({
    action: "automation.draft_queued",
    entityType: "job",
    entityId: jobId,
    websiteId: story.website_id,
    actorId: user.id,
    details: { story_id: storyId },
  });
  revalidatePath("/stories");
  revalidatePath("/jobs");
  return { ok: true, message: "Draft queued. Paused websites wait until automation resumes." };
}

export async function reconcileAIUsage(usageId, _prev, formData) {
  const user = await requireAdmin();
  const parsed = usageReconciliationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { error: "Check the charge and reconciliation note", fieldErrors: fieldErrorsFrom(parsed.error) };
  const db = createAdminClient();
  const { data: usage, error: usageError } = await db
    .from("ai_usage")
    .select("website_id, job_id")
    .eq("id", usageId)
    .maybeSingle();
  if (usageError || !usage) return { error: "Usage record not found" };
  const { data, error } = await db.rpc("reconcile_ai_call", { usage_id: usageId, ...parsed.data });
  if (error || !data)
    return { error: error?.message ?? "Only unsettled calls older than ten minutes can be reconciled." };
  await recordAudit({
    action: "automation.usage_reconciled",
    entityType: "job",
    entityId: usage.job_id,
    websiteId: usage.website_id,
    actorId: user.id,
    details: { usage_id: usageId, ...parsed.data },
  });
  revalidatePath("/jobs", "layout");
  revalidatePath("/");
  return { ok: true, message: "Reviewed charge recorded and reservation released." };
}

export async function manageDraftJob(jobId, intent, _prev, formData) {
  const user = await requireAdmin();
  if (!["retry", "cancel"].includes(intent)) return { error: "Invalid job action" };
  const db = createAdminClient();
  const { data: job, error: jobError } = await db.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (jobError || !job) return { error: "Job not found" };
  const eligible = intent === "retry" ? ["failed", "cancelled"] : ["queued", "running", "failed"];
  if (!eligible.includes(job.status)) return { error: "The job changed. Reload and try again." };
  if (intent === "cancel") {
    const { data, error } = await db.rpc("cancel_draft_job", { target_job: jobId });
    if (error || !data) return { error: error?.message ?? "The job changed. Reload and try again." };
    await recordAudit({
      action: "automation.job_cancel",
      entityType: "job",
      entityId: jobId,
      websiteId: job.website_id,
      actorId: user.id,
    });
    revalidateDrafting();
    return { ok: true, message: "Job cancelled. A running request stops at its next control check." };
  }
  let patch;
  if (intent === "retry") {
    if (Date.parse(job.locked_until) > Date.now())
      return { error: "A cancelled request may still be finishing. Wait for its lease to expire before retrying." };
    const { data: story } = await db.from("story_candidates").select("status").eq("id", job.story_id).single();
    if (story?.status !== "selected") return { error: "Select the story again before retrying." };
    const urls = supportingUrls(formData);
    if (!urls) return { error: URL_ERROR };
    const restart = urls.length > 0 || formData.get("restart") === "on";
    patch = {
      status: "queued",
      locked_by: null,
      locked_until: null,
      last_error: null,
      waiting_kind: null,
      waiting_reason: null,
      waiting_since: null,
      attempt_count: 0,
      run_after: new Date().toISOString(),
      ...(restart ? { step: "collect", state: { pending_urls: urls, generation: randomUUID() } } : {}),
    };
  }
  const { data: changed, error } = await db
    .from("jobs")
    .update(patch)
    .eq("id", jobId)
    .eq("status", job.status)
    .eq("updated_at", job.updated_at)
    .select("id")
    .maybeSingle();
  if (error || !changed) return { error: error?.message ?? "The job changed. Reload and try again." };
  await recordAudit({
    action: `automation.job_${intent}`,
    entityType: "job",
    entityId: jobId,
    websiteId: job.website_id,
    actorId: user.id,
  });
  revalidateDrafting();
  return { ok: true, message: intent === "retry" ? "Job queued for retry." : "Job cancelled." };
}

function revalidateDrafting() {
  revalidatePath("/jobs");
  revalidatePath("/jobs/[jobId]", "page");
  revalidatePath("/stories");
  revalidatePath("/");
  refresh();
}

async function discardDrafts(ids) {
  const user = await requireUser();
  const parsed = z.array(z.uuid()).min(1).max(100).safeParse(ids);
  if (!parsed.success) return { error: "Choose between 1 and 100 draft jobs." };
  const unique = [...new Set(parsed.data)];
  const scoped = await createClient();
  const { data: jobs, error } = await scoped.from("jobs").select("id, website_id, story_id").in("id", unique);
  if (error || jobs?.length !== unique.length) return { error: "Some jobs are unavailable. Reload and try again." };
  for (const websiteId of new Set(jobs.map((job) => job.website_id))) await requireWebsite(websiteId);
  const db = createAdminClient();
  let removed = 0;
  for (const job of jobs) {
    const { data, error: cancelError } = await db.rpc("cancel_draft_job", { target_job: job.id, discard_story: true });
    if (cancelError) {
      revalidateDrafting();
      return { error: `${removed} removed. Could not remove the remaining jobs: ${cancelError.message}` };
    }
    if (!data) continue;
    removed++;
    await recordAudit({
      action: "automation.removed_from_drafting",
      entityType: "job",
      entityId: job.id,
      websiteId: job.website_id,
      actorId: user.id,
      details: { story_id: job.story_id },
    });
  }
  revalidateDrafting();
  return {
    ok: true,
    message: removed
      ? `${removed} ${removed === 1 ? "story" : "stories"} removed from drafting and skipped.`
      : "These jobs have already finished or been removed. The list is up to date.",
  };
}

export async function removeFromDrafting(jobId) {
  return discardDrafts([jobId]);
}

export async function bulkRemoveFromDrafting(_prev, formData) {
  return discardDrafts(formData.getAll("job_ids"));
}
