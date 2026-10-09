import { Bot, Plug } from "lucide-react";
import { setAutomationPaused, setWebsiteArchived } from "@/app/actions/websites";
import { SubmitButton } from "@/components/form-controls";
import { Alert, Badge, Card, ConnectionBadge, DescriptionList, formatDateTime } from "@/components/ui";
import { formatPublishTimes } from "@/lib/schedule";
import { TestConnectionButton } from "./settings-forms";

export function ConnectionCard({ website }) {
  return (
    <Card icon={Plug} title="WordPress connection" actions={<ConnectionBadge status={website.wp_connection_status} />}>
      <DescriptionList
        className="mb-5"
        items={[
          { label: "Site", value: <span className="font-mono text-xs">{website.wp_base_url}</span> },
          { label: "User", value: website.wp_username },
          { label: "Connector", value: website.wp_plugin_version ?? "unknown" },
          { label: "Last checked", value: formatDateTime(website.wp_connection_checked_at, website.timezone) },
        ]}
      />
      {website.wp_connection_error ? (
        <Alert tone={website.wp_connection_status === "failed" ? "error" : "warning"} className="mb-4">
          {website.wp_connection_error}
        </Alert>
      ) : null}
      <TestConnectionButton websiteId={website.id} />
    </Card>
  );
}

function automationSummary(website) {
  if (website.automation_mode === "off" || website.daily_quota === 0) {
    return "Automation is off or has no publishing times, so it will not create articles even when resumed.";
  }
  const articles = `${website.daily_quota} automated article${website.daily_quota === 1 ? "" : "s"}`;
  const times = `${formatPublishTimes(website.publish_times)} (${website.timezone})`;
  return `${articles} per day at ${times}, each reviewed before publishing during the initial rollout. Manual publishing is unaffected by pausing.`;
}

export function AutomationCard({ website, isAdmin }) {
  const paused = website.automation_paused;
  const archived = Boolean(website.archived_at);
  const status = paused ? (
    <Badge dot>paused</Badge>
  ) : (
    <Badge tone="green" dot>
      running
    </Badge>
  );

  return (
    <Card icon={Bot} title="Automation" actions={status}>
      <p className="mb-5 text-sm leading-relaxed text-muted-foreground">{automationSummary(website)}</p>
      {isAdmin ? (
        <div className="flex flex-wrap gap-2">
          <form action={setAutomationPaused.bind(null, website.id, !paused)}>
            <SubmitButton variant={paused ? "success" : "secondary"}>
              {paused ? "Resume automation" : "Pause automation"}
            </SubmitButton>
          </form>
          <form action={setWebsiteArchived.bind(null, website.id, !archived)}>
            <SubmitButton
              variant={archived ? "secondary" : "danger-outline"}
              confirm={
                archived
                  ? undefined
                  : "Archive this website? Automation stops and it is hidden from the active list. Nothing is deleted."
              }
              confirmLabel="Archive website"
            >
              {archived ? "Restore website" : "Archive website"}
            </SubmitButton>
          </form>
        </div>
      ) : null}
    </Card>
  );
}
