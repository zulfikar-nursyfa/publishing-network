import { Badge } from "./ui";
import { RelativeTime } from "./relative-time";
import { waitingLabel } from "@/lib/automation/drafting/queue-policy";

export function DraftJobState({ job, timezone }) {
  const waiting = ["queued", "running"].includes(job.status) && job.waiting_kind;
  return (
    <div className="space-y-1.5">
      <Badge tone={waiting ? "amber" : job.status === "failed" ? "red" : job.status === "succeeded" ? "green" : "gray"}>
        {waiting ? waitingLabel(job.waiting_kind) : job.status}
      </Badge>
      {waiting ? (
        <>
          <p className="max-w-sm text-xs text-muted-foreground">{job.waiting_reason}</p>
          <p className="text-xs text-muted-foreground">
            Since <RelativeTime value={job.waiting_since} timezone={timezone} />
          </p>
        </>
      ) : null}
    </div>
  );
}
