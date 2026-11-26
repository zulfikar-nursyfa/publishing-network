import "server-only";
import { serverEnv } from "@/lib/env";
import { bodyText } from "@/lib/publishing/content";
import { automationBlockReason } from "../policy";
import { DeferredJob, LostLease, PermanentJob } from "./errors";

/** When the story happened: the feed's publication time, or when we found it. */
export const storyTime = (story) => story.source_published_at ?? story.created_at;

/** The website's model, else the network default, else the deployment default. */
export function textModelFor({ website, network }) {
  return website.ai_model ?? network.default_ai_model ?? serverEnv().GEMINI_MODEL;
}

/** Admin-written HTML as plain text for prompts; list items keep a "- " so rules stay separate. */
const promptText = (html) => (html ? bodyText(html.replace(/<li[^>]*>/gi, "$&- ")) : null);

/** The niche's writing guide for the website's language, or null. */
export const nicheGuideFor = (website) => promptText(website.niche?.[`guide_${website.language}`]);

/** The rules shared by the niche's network, for the website's language, or null. */
export const networkRulesFor = (website) => promptText(website.niche?.network?.[`rules_${website.language}`]);

/**
 * Loads everything a step needs and re-checks the controls: this worker still holds the job,
 * automation is running for the website, and the story is still selected (unless re-checking).
 */
export async function loadJobContext(db, job, worker) {
  const results = await Promise.all([
    db.from("websites").select("*, niche:niches(*, network:networks(*))").eq("id", job.website_id).single(),
    db.from("network_settings").select("*").single(),
    db.from("story_candidates").select("*").eq("id", job.story_id).eq("website_id", job.website_id).single(),
    db.from("content_sources").select("*").eq("website_id", job.website_id).eq("active", true),
    db.from("categories").select("id, name, description").eq("website_id", job.website_id).is("archived_at", null),
    db.from("jobs").select("status, locked_by, locked_until").eq("id", job.id).single(),
  ]);
  for (const result of results) {
    if (result.error) throw new Error(`Could not load draft controls: ${result.error.message}`);
  }
  const [website, network, story, sources, categories, lease] = results.map((result) => result.data);

  if (lease.status !== "running" || lease.locked_by !== worker || new Date(lease.locked_until) <= new Date()) {
    throw new LostLease("Draft lease lost");
  }
  const reason = automationBlockReason(website, network);
  if (reason) throw new DeferredJob(reason);
  // A re-check runs on a finished job, whose story is already used.
  if (story.status !== "selected" && !job.article_id) throw new PermanentJob("Story is no longer selected");

  return { website, network, story, sources, categories, strictChecks: network.strict_draft_checks ?? [] };
}

/** Saves the job's next state, but only while this worker still holds it. */
export async function advance(db, job, worker, patch) {
  const { data, error } = await db
    .from("jobs")
    .update({ ...patch, locked_by: null, locked_until: null })
    .eq("id", job.id)
    .eq("status", "running")
    .eq("locked_by", worker)
    .gt("locked_until", new Date().toISOString())
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Could not persist draft step: ${error.message}`);
  if (!data) throw new LostLease("Draft lease lost");
}

/**
 * Check run before each AI call: the controls above, plus the spending limits in case they were
 * lowered while the job was running. Equal is allowed because the call is already reserved;
 * reserve_ai_call rejects any new call that would go over the limit.
 */
export function budgetGuard(db, job, worker) {
  return async () => {
    const { website, network } = await loadJobContext(db, job, worker);
    const { data: spend, error } = await db
      .from("website_ai_spend")
      .select("website_id, estimated_cost_usd, reserved_cost_usd");
    if (error) throw new Error("Could not reload AI spending controls");

    const cost = (row) => Number(row.estimated_cost_usd) + Number(row.reserved_cost_usd);
    const siteSpend = spend.filter((row) => row.website_id === job.website_id).reduce((sum, row) => sum + cost(row), 0);
    const networkSpend = spend.reduce((sum, row) => sum + cost(row), 0);
    const overSite = siteSpend > Number(website.monthly_ai_budget_usd);
    const overNetwork = network.monthly_ai_budget_usd !== null && networkSpend > Number(network.monthly_ai_budget_usd);
    if (overSite || overNetwork) throw new DeferredJob("AI budget was lowered below current spending and reservations");
  };
}
