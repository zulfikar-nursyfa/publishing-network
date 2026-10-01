import "server-only";
import { recordAudit } from "@/lib/audit";
import { publishArticle } from "@/lib/publishing/publish";
import { createSupabasePublishStore } from "@/lib/publishing/supabase-store";
import { localDate, slotsOn } from "@/lib/schedule";
import { createAdminClient } from "@/lib/supabase/admin";
import { createWordPressClient } from "@/lib/wordpress/client";

// A slot is only run within this window, so a late or repeated cron run cannot publish old slots.
const SLOT_WINDOW_MS = 30 * 60_000;
const MAX_SCHEDULED_PER_RUN = 10;

async function publish(articleId) {
  const result = await publishArticle(articleId, null, createSupabasePublishStore(), (connection) => createWordPressClient(connection));
  if (result.outcome === "published" || result.outcome === "already_published") return null;
  return result.error ?? result.reason ?? result.outcome.replace(/_/g, " ");
}

// Articles whose last attempt failed wait for a person to retry them from the article page.
async function failedArticleIds(db, websiteId) {
  let query = db.from("publications").select("article_id").eq("status", "failed");
  if (websiteId) query = query.eq("website_id", websiteId);
  const { data } = await query;
  return new Set((data ?? []).map((row) => row.article_id));
}

function dueSlots(site, now) {
  const days = [localDate(new Date(now.getTime() - 86_400_000), site.timezone), localDate(now, site.timezone)];
  return days
    .flatMap((day) => slotsOn(day, site.publish_times, site.timezone))
    .filter((slot) => slot <= now && now - slot <= SLOT_WINDOW_MS);
}

/** Article for a slot: one scheduled for exactly this slot, else the oldest approved unscheduled one. */
async function pickArticle(db, websiteId, slotAt) {
  const [{ data: articles }, failed] = await Promise.all([
    db
      .from("articles")
      .select("id")
      .eq("website_id", websiteId)
      .eq("status", "approved")
      .or(`scheduled_for.eq."${slotAt}",scheduled_for.is.null`)
      .order("scheduled_for", { ascending: true, nullsFirst: false })
      .order("approved_at", { ascending: true })
      .limit(20),
    failedArticleIds(db, websiteId),
  ]);
  return (articles ?? []).find((article) => !failed.has(article.id)) ?? null;
}

async function runSlot(db, site, slotAt) {
  const { data: slot, error } = await db
    .from("publish_slots")
    .upsert({ website_id: site.id, slot_at: slotAt }, { onConflict: "website_id,slot_at", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Could not claim slot: ${error.message}`);
  if (!slot) return null;

  const article = await pickArticle(db, site.id, slotAt);
  if (!article) {
    const note = "No approved article was ready";
    await db.from("publish_slots").update({ status: "skipped", note }).eq("id", slot.id);
    await recordAudit({ action: "automation.slot_skipped", entityType: "website", entityId: site.id, websiteId: site.id, details: { slot_at: slotAt, note } });
    return { websiteId: site.id, slotAt, status: "skipped" };
  }

  const failure = await publish(article.id);
  await db
    .from("publish_slots")
    .update({ status: failure ? "failed" : "published", article_id: article.id, note: failure })
    .eq("id", slot.id);
  return { websiteId: site.id, slotAt, status: failure ? "failed" : "published", articleId: article.id };
}

/** Approved articles a person scheduled for a time that has now passed. */
async function publishScheduled(db, now) {
  const [{ data: due }, failed] = await Promise.all([
    db
      .from("articles")
      .select("id, websites!inner(archived_at)")
      .eq("status", "approved")
      .lte("scheduled_for", now.toISOString())
      .is("websites.archived_at", null)
      .order("scheduled_for")
      .limit(MAX_SCHEDULED_PER_RUN),
    failedArticleIds(db, null),
  ]);
  const results = [];
  for (const article of (due ?? []).filter((row) => !failed.has(row.id))) {
    const failure = await publish(article.id);
    results.push({ articleId: article.id, status: failure ? "failed" : "published" });
  }
  return results;
}

/**
 * Runs due publishing slots for websites with automation on, then publishes scheduled articles.
 * Scheduled articles were chosen by a person, so like manual publishing they ignore the pauses.
 * Both paths go through publishArticle(), which prevents duplicate WordPress posts.
 */
export async function runScheduler(now = new Date()) {
  const db = createAdminClient();
  const [{ data: network }, { data: websites, error }] = await Promise.all([
    db.from("network_settings").select("automation_paused").maybeSingle(),
    db
      .from("websites")
      .select("id, timezone, publish_times, automation_mode, automation_paused, wp_connection_status")
      .is("archived_at", null),
  ]);
  if (error) throw new Error(`Could not load websites: ${error.message}`);

  const slots = [];
  if (!network?.automation_paused) {
    for (const site of websites) {
      if (site.automation_paused || site.automation_mode === "off" || site.wp_connection_status !== "ok") continue;
      for (const slot of dueSlots(site, now)) {
        const result = await runSlot(db, site, slot.toISOString());
        if (result) slots.push(result);
      }
    }
  }
  return { slots, scheduled: await publishScheduled(db, now) };
}
