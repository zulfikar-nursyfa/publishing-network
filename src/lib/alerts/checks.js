import "server-only";

const DAY = 86_400_000;
// Highest level first: a site that jumps straight past its limit gets one "limit reached" alert.
const BUDGET_LEVELS = [1, 0.8];

const short = (text) => (text ?? "").slice(0, 300);
const usd = (value) => `$${value.toFixed(2)}`;
const when = (value, timeZone) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));

function rows({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

function budgetAlert({ key, websiteId, label, spent, limit, path }) {
  const level = BUDGET_LEVELS.find((share) => limit > 0 && spent >= limit * share);
  if (!level) return [];
  const blocked = level === 1 ? " New AI calls are blocked until next month or a higher limit." : "";
  return [
    {
      key: `${key}:${level * 100}`,
      website_id: websiteId,
      kind: "budget",
      message: `${label}: estimated AI spend ${usd(spent)} of the ${usd(limit)} monthly limit (${Math.round((spent / limit) * 100)}%).${blocked}`,
      path,
    },
  ];
}

/**
 * Problems worth an email: AI spend at 80% or 100% of a monthly limit, skipped or failed
 * publishing slots, articles that failed to publish twice or more, and failed AI drafts.
 * Each has a stable key; only the last 24 hours are checked.
 */
export async function findAlerts(db, now = new Date()) {
  const since = new Date(now.getTime() - DAY).toISOString();
  const month = now.toISOString().slice(0, 7);
  const [sites, network, spend, slots, publications, jobs] = await Promise.all([
    db.from("websites").select("id, name, timezone, monthly_ai_budget_usd").is("archived_at", null),
    db.from("network_settings").select("monthly_ai_budget_usd").single(),
    db.from("website_ai_spend").select("website_id, estimated_cost_usd, reserved_cost_usd"),
    db
      .from("publish_slots")
      .select("id, website_id, slot_at, status, note")
      .in("status", ["skipped", "failed"])
      .gte("updated_at", since),
    db
      .from("publications")
      .select("id, website_id, article_id, attempt_count, max_attempts, last_error")
      .eq("status", "failed")
      .gte("attempt_count", 2)
      .gte("updated_at", since),
    db.from("jobs").select("id, website_id, step, last_error").eq("status", "failed").gte("updated_at", since),
  ]).then((results) => results.map(rows));

  const siteById = new Map(sites.map((site) => [site.id, site]));
  const spendBySite = new Map(
    spend.map((row) => [row.website_id, Number(row.estimated_cost_usd) + Number(row.reserved_cost_usd)]),
  );
  const alerts = [];

  for (const site of sites) {
    alerts.push(
      ...budgetAlert({
        key: `budget:${site.id}:${month}`,
        websiteId: site.id,
        label: site.name,
        spent: spendBySite.get(site.id) ?? 0,
        limit: Number(site.monthly_ai_budget_usd),
        path: `/websites/${site.id}`,
      }),
    );
  }
  if (network.monthly_ai_budget_usd !== null) {
    alerts.push(
      ...budgetAlert({
        key: `budget:network:${month}`,
        websiteId: null,
        label: "Whole network",
        spent: [...spendBySite.values()].reduce((sum, value) => sum + value, 0),
        limit: Number(network.monthly_ai_budget_usd),
        path: "/network",
      }),
    );
  }

  // Archived websites are left out of `sites`, so their problems are not emailed.
  for (const slot of slots) {
    const site = siteById.get(slot.website_id);
    if (!site) continue;
    alerts.push({
      key: `slot:${slot.id}`,
      website_id: site.id,
      kind: "slot",
      message:
        `${site.name}: the ${when(slot.slot_at, site.timezone)} publishing slot was ${slot.status}. ${short(slot.note)}`.trim(),
      path: `/websites/${site.id}`,
    });
  }
  for (const publication of publications) {
    const site = siteById.get(publication.website_id);
    if (!site) continue;
    alerts.push({
      key: `publication:${publication.id}`,
      website_id: site.id,
      kind: "publication",
      message:
        `${site.name}: publishing to WordPress failed ${publication.attempt_count} of ${publication.max_attempts} attempts. ${short(publication.last_error)}`.trim(),
      path: `/articles/${publication.article_id}`,
    });
  }
  for (const job of jobs) {
    const site = siteById.get(job.website_id);
    if (!site) continue;
    alerts.push({
      key: `job:${job.id}`,
      website_id: site.id,
      kind: "job",
      message: `${site.name}: an AI draft failed at the ${job.step} step. ${short(job.last_error)}`.trim(),
      path: `/jobs/${job.id}`,
    });
  }
  return alerts;
}
