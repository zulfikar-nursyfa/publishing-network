/** Cost as the budget counts it: settled calls at their estimate, open calls at their reservation. */
export function usageCost(row) {
  return Number(["reserved", "uncertain"].includes(row.status) ? row.reserved_cost_usd : row.estimated_cost_usd);
}

/** Totals for a set of ai_usage rows, split by drafting step. */
export function summariseUsage(rows) {
  const byOperation = {};
  let total = 0;
  let searches = 0;
  for (const row of rows) {
    const cost = usageCost(row);
    total += cost;
    searches += row.search_queries ?? 0;
    byOperation[row.operation] = (byOperation[row.operation] ?? 0) + cost;
  }
  return { total, searches, calls: rows.length, byOperation };
}

/** Start of the current UTC month, the period the AI budgets use. */
export function monthStartUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function formatUsd(value) {
  return `$${Number(value).toFixed(value > 0 && value < 1 ? 3 : 2)}`;
}
