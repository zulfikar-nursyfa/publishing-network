export const COST_CATEGORIES = [
  { key: "images", label: "Images" },
  { key: "sources", label: "Paid sources" },
  { key: "hosting", label: "Extra hosting" },
  { key: "editorial", label: "Editorial time" },
  { key: "other", label: "Other" },
];

/** "YYYY-MM" from the query string, or the current UTC month (the budget month). */
export function monthParam(value, now = new Date()) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value ?? "") ? value : now.toISOString().slice(0, 7);
}

export function shiftMonth(month, delta) {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index - 1 + delta, 1)).toISOString().slice(0, 7);
}

/**
 * One row per website for a month: AI cost (estimated), entered costs, an equal share of the
 * network-wide entries for each active website, and the total per published article.
 * Archived websites appear only when they had costs or publications that month.
 */
export function buildCostReport({ websites, monthCosts, entries }) {
  const active = websites.filter((site) => !site.archived_at);
  const networkTotal = entries
    .filter((entry) => !entry.website_id)
    .reduce((sum, entry) => sum + Number(entry.amount_usd), 0);
  const share = active.length ? networkTotal / active.length : 0;
  const costs = new Map(monthCosts.map((row) => [row.website_id, row]));

  const rows = websites
    .map((site) => {
      const month = costs.get(site.id) ?? {};
      const ai = Number(month.ai_cost_usd ?? 0);
      const other = entries
        .filter((entry) => entry.website_id === site.id)
        .reduce((sum, entry) => sum + Number(entry.amount_usd), 0);
      const networkShare = site.archived_at ? 0 : share;
      const total = ai + other + networkShare;
      const published = Number(month.published ?? 0);
      return {
        websiteId: site.id,
        name: site.name,
        archived: Boolean(site.archived_at),
        drafted: Number(month.drafted ?? 0),
        published,
        searches: Number(month.searches ?? 0),
        ai,
        aiImages: Number(month.image_cost_usd ?? 0),
        other,
        networkShare,
        total,
        perArticle: published ? total / published : null,
      };
    })
    .filter((row) => !row.archived || row.total > 0 || row.published > 0);

  const sum = (key) => rows.reduce((total, row) => total + row[key], 0);
  // With no active website, network costs have nobody to share them; count them in the total.
  const total = sum("total") + (active.length ? 0 : networkTotal);
  const published = sum("published");
  return {
    rows,
    networkTotal,
    totals: {
      drafted: sum("drafted"),
      published,
      searches: sum("searches"),
      ai: sum("ai"),
      aiImages: sum("aiImages"),
      other: sum("other"),
      networkShare: networkTotal,
      total,
      perArticle: published ? total / published : null,
    },
  };
}
