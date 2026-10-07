/** Pure control checks shared by workers and isolated validation. Missing settings fail closed. */
export function automationBlockReason(website, network) {
  if (!website || !network) return "Automation settings could not be loaded";
  if (website.archived_at) return "Website is archived";
  if (network.automation_paused) return "Network automation is paused";
  if (website.automation_paused) return "Website automation is paused";
  if (website.automation_mode === "off") return "Website automation is off";
  return null;
}
