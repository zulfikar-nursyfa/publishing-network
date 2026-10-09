import "server-only";
import { randomUUID } from "node:crypto";
import { recordAudit } from "@/lib/audit";
import { publishArticle } from "@/lib/publishing/publish";
import { createSupabasePublishStore } from "@/lib/publishing/supabase-store";
import { localDate, slotsOn } from "@/lib/schedule";
import { createAdminClient } from "@/lib/supabase/admin";
import { createWordPressClient } from "@/lib/wordpress/client";
import { automationBlockReason } from "./policy";

const SLOT_WINDOW_MS = 30 * 60_000;
const MAX_PER_RUN = 10;
const RUN_BUDGET_MS = 210_000;

function failOn(error) {
  if (error) throw new Error(error.message);
}

export function dueSlots(site, now) {
  const days = [localDate(new Date(now.getTime() - 86_400_000), site.timezone), localDate(now, site.timezone)];
  return days
    .flatMap((day) => slotsOn(day, site.publish_times, site.timezone))
    .filter((slot) => slot <= now && now - slot <= SLOT_WINDOW_MS);
}

/**
 * Reloads immediately before a WordPress write, including after reconciliation's network call.
 * The AI budget is not checked: publishing an approved article costs no AI.
 */
async function slotWriteBlock(db, slot, worker) {
  const [
    { data: website, error: siteError },
    { data: network, error: networkError },
    { data: lease, error: leaseError },
    { data: article, error: articleError },
  ] = await Promise.all([
    db.from("websites").select("*").eq("id", slot.website_id).single(),
    db.from("network_settings").select("*").single(),
    db.from("publish_slots").select("status, locked_by, locked_until").eq("id", slot.id).single(),
    db.from("articles").select("status, origin, website_id").eq("id", slot.article_id).single(),
  ]);
  [siteError, networkError, leaseError, articleError].forEach(failOn);
  if (lease.status !== "running" || lease.locked_by !== worker || new Date(lease.locked_until) <= new Date())
    return "Slot lease lost";
  if (Date.now() - Date.parse(slot.slot_at) > SLOT_WINDOW_MS)
    return "Slot expired; only existing posts may be reconciled";
  if (article.website_id !== slot.website_id || article.origin !== "automated" || article.status !== "approved")
    return "Article is no longer eligible for automatic publishing";
  const reason = automationBlockReason(website, network);
  if (reason) return reason;
  if (website.wp_connection_status !== "ok") return "WordPress connection needs attention";
  return null;
}

async function runSlot(db, websiteId, slotAt) {
  const worker = randomUUID();
  const { data, error } = await db.rpc("claim_publish_slot", {
    target_website: websiteId,
    target_slot: slotAt,
    worker,
  });
  failOn(error);
  const slot = data?.[0];
  if (!slot) return null;
  let status = "skipped";
  let note = "No approved automated article was ready";
  if (slot.article_id) {
    const result = await publishArticle(slot.article_id, null, createSupabasePublishStore(), createWordPressClient, {
      beforeWrite: () => slotWriteBlock(db, slot, worker),
    });
    if (result.outcome === "in_progress") return { slotId: slot.id, status: "running" };
    status = ["published", "already_published"].includes(result.outcome) ? "published" : "failed";
    note = status === "published" ? null : (result.error ?? result.reason ?? result.outcome);
  }
  const { data: finished, error: finishError } = await db.rpc("finish_publish_slot", {
    target_slot: slot.id,
    worker,
    outcome: status,
    explanation: note,
  });
  failOn(finishError);
  if (finished && status !== "published")
    await recordAudit({
      action: `automation.slot_${status}`,
      entityType: "website",
      entityId: websiteId,
      websiteId,
      details: { slot_at: slotAt, article_id: slot.article_id, note },
    });
  return { slotId: slot.id, websiteId, slotAt, articleId: slot.article_id, status: finished ? status : "lease_lost" };
}

/** Explicit schedules were chosen by a person and retain the manual-publishing pause exception. */
async function publishScheduled(db, deadline) {
  const { data: due, error } = await db
    .from("articles")
    .select("id, websites!inner(archived_at)")
    .eq("status", "approved")
    .lte("scheduled_for", new Date().toISOString())
    .is("websites.archived_at", null)
    .order("scheduled_for")
    .limit(MAX_PER_RUN);
  failOn(error);
  const { data: failed, error: failedError } = await db
    .from("publications")
    .select("article_id")
    .eq("status", "failed");
  failOn(failedError);
  const failedIds = new Set(failed.map((row) => row.article_id));
  const results = [];
  for (const article of due) {
    if (Date.now() >= deadline) break;
    if (failedIds.has(article.id)) continue;
    const result = await publishArticle(article.id, null, createSupabasePublishStore(), createWordPressClient);
    results.push({ articleId: article.id, outcome: result.outcome });
  }
  return results;
}

export async function runScheduler(now = new Date()) {
  const deadline = Date.now() + RUN_BUDGET_MS;
  const db = createAdminClient();
  const [
    { data: network, error: networkError },
    { data: websites, error: siteError },
    { data: stale, error: staleError },
  ] = await Promise.all([
    db.from("network_settings").select("*").single(),
    db.from("websites").select("*").is("archived_at", null),
    db
      .from("publish_slots")
      .select("website_id, slot_at")
      .eq("status", "running")
      .or(`locked_until.is.null,locked_until.lte.${now.toISOString()}`)
      .order("slot_at")
      .limit(MAX_PER_RUN),
  ]);
  [networkError, siteError, staleError].forEach(failOn);
  // Recovery can confirm an already live post while paused; beforeWrite prevents new writes.
  const work = new Map(stale.map((slot) => [`${slot.website_id}/${new Date(slot.slot_at).toISOString()}`, slot]));
  for (const site of websites) {
    if (automationBlockReason(site, network) || site.wp_connection_status !== "ok") continue;
    for (const slot of dueSlots(site, now)) {
      const slotAt = slot.toISOString();
      work.set(`${site.id}/${slotAt}`, { website_id: site.id, slot_at: slotAt });
    }
  }
  const slots = [];
  for (const slot of [...work.values()].slice(0, MAX_PER_RUN)) {
    if (Date.now() >= deadline) break;
    const result = await runSlot(db, slot.website_id, slot.slot_at);
    if (result) slots.push(result);
  }
  return { slots, scheduled: await publishScheduled(db, deadline) };
}
