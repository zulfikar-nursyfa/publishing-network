import { nextFreeSlot } from "@/lib/schedule";

/**
 * Whether the publishing slots will retry a failed publication by themselves and when, or why a person
 * must use Retry publishing. Mirrors the slot candidate rule in migration 65: an approved automated
 * article with attempts left, picked before other articles, once its scheduled time (if any) has come.
 *
 * @param {{attempt_count: number, max_attempts: number}} publication
 * @param {{status: string, origin: string, scheduled_for?: string|null}} article
 * @param {{automation_paused: boolean, publish_times: string[]|null, timezone: string}} website
 * @returns {{auto: true, at: Date} | {auto: false, reason: string}}
 */
export function publishRetry(publication, article, website, networkPaused, now = new Date()) {
  if (publication.attempt_count >= publication.max_attempts)
    return { auto: false, reason: `All ${publication.max_attempts} automatic attempts used` };
  if (article.status !== "approved") return { auto: false, reason: "Article is no longer approved" };
  if (article.origin !== "automated") return { auto: false, reason: "Only automated articles retry by themselves" };
  if (networkPaused || website.automation_paused) return { auto: false, reason: "Automation is paused" };
  const from = article.scheduled_for ? new Date(Math.max(now, Date.parse(article.scheduled_for) - 1)) : now;
  const at = nextFreeSlot(from, website.publish_times, website.timezone);
  return at ? { auto: true, at } : { auto: false, reason: "The website has no publishing slots" };
}
