/** Pure control checks shared by workers and isolated validation. Missing settings fail closed. */
export function automationBlockReason(website, network, spend) {
  if (!website || !network) return "Automation settings could not be loaded";
  if (website.archived_at) return "Website is archived";
  if (network.automation_paused) return "Network automation is paused";
  if (website.automation_paused) return "Website automation is paused";
  if (website.automation_mode === "off") return "Website automation is off";
  if (spend) {
    const cost = (row) => Number(row.estimated_cost_usd) + Number(row.reserved_cost_usd);
    const site = spend.filter((row) => row.website_id === website.id).reduce((sum, row) => sum + cost(row), 0);
    const total = spend.reduce((sum, row) => sum + cost(row), 0);
    if (site >= Number(website.monthly_ai_budget_usd)) return "Website AI budget is exhausted";
    if (network.monthly_ai_budget_usd !== null && total >= Number(network.monthly_ai_budget_usd))
      return "Network AI budget is exhausted";
  }
  return null;
}
