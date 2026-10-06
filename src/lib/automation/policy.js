/** Pure control checks shared by workers and isolated validation. Missing settings fail closed. */
export function automationBlockReason(website, network) {
  if (!website || !network) return "Automation settings could not be loaded";
  if (website.archived_at) return "Website is archived";
  if (network.automation_paused) return "Network automation is paused";
  if (website.automation_paused) return "Website automation is paused";
  if (website.automation_mode === "off") return "Website automation is off";
  return null;
}

export function budgetBlockReason(website, network, siteSpend, networkSpend) {
  if (siteSpend >= Number(website.monthly_ai_budget_usd)) return "Website AI spending limit has been reached";
  if (network.monthly_ai_budget_usd !== null && networkSpend >= Number(network.monthly_ai_budget_usd)) return "Network AI spending limit has been reached";
  return null;
}
