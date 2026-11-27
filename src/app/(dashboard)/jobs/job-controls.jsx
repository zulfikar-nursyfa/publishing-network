"use client";
import { manageDraftJob, markWarning, queueStoryDraft, reconcileAIUsage } from "@/app/actions/jobs";
import { Badge, CheckboxLabel, Field, inputClass } from "@/components/ui";
import { useActionStateWithNotice, SubmitButton } from "@/components/form-controls";

const VERDICT_LABELS = { false_alarm: "False alarm", real_problem: "Real problem" };

/** A job's reviewer warnings with verdict buttons; `feedback` is warningFeedback's rows. */
export function WarningList({ jobId, warnings, feedback }) {
  const saved = new Map(feedback.map((row) => [row.warning, row]));
  return (
    <ul className="list-disc space-y-4 ps-5 text-sm">
      {warnings.map((warning, i) => (
        <li key={i}>
          <WarningVerdict jobId={jobId} warning={warning} feedback={saved.get(warning)} />
        </li>
      ))}
    </ul>
  );
}

/** One reviewer warning with its verdict buttons; `feedback` is the saved verdict, if any. */
function WarningVerdict({ jobId, warning, feedback }) {
  const [, action] = useActionStateWithNotice(markWarning.bind(null, jobId), {});
  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="warning" value={warning} />
      <p dir="auto">{warning}</p>
      {feedback ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={feedback.verdict === "false_alarm" ? "gray" : "amber"}>
            {`${VERDICT_LABELS[feedback.verdict]}${feedback.author ? ` · ${feedback.author}` : ""}`}
          </Badge>
          {feedback.note ? (
            <span className="text-xs text-muted-foreground" dir="auto">
              {feedback.note}
            </span>
          ) : null}
          <SubmitButton size="sm" variant="ghost" name="verdict" value="clear">
            Undo
          </SubmitButton>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            name="note"
            maxLength={500}
            aria-label="Note for this warning (optional)"
            placeholder="Note (optional)"
            className={`${inputClass} sm:max-w-56`}
          />
          {Object.entries(VERDICT_LABELS).map(([verdict, label]) => (
            <SubmitButton key={verdict} size="sm" variant="secondary" name="verdict" value={verdict}>
              {label}
            </SubmitButton>
          ))}
        </div>
      )}
    </form>
  );
}

export function QueueDraftForm({ storyId }) {
  const [, action] = useActionStateWithNotice(queueStoryDraft.bind(null, storyId), {});
  return (
    <form action={action} className="mt-3 space-y-3">
      <Field
        label="Supporting evidence URLs"
        htmlFor={`evidence-${storyId}`}
        hint="Optional: one per line, up to four. The system also searches the web for coverage; add the official announcement here if you know it."
      >
        <textarea
          id={`evidence-${storyId}`}
          name="evidence_urls"
          rows={2}
          className={inputClass}
          placeholder="https://…"
        />
      </Field>
      <SubmitButton size="sm" variant="secondary">
        Queue AI draft
      </SubmitButton>
    </form>
  );
}

export function UsageReconciliationForm({ usageId }) {
  const [state, action] = useActionStateWithNotice(reconcileAIUsage.bind(null, usageId), {});
  return (
    <form action={action} className="mt-2 space-y-3 rounded-lg border p-3">
      <Field
        label="Reviewed provider charge (USD)"
        htmlFor={`cost-${usageId}`}
        error={state.fieldErrors?.reviewed_cost}
      >
        <input
          id={`cost-${usageId}`}
          name="reviewed_cost"
          type="number"
          min="0"
          max="10000"
          step="0.00000001"
          required
          className={inputClass}
        />
      </Field>
      <Field
        label="Billing reconciliation note"
        htmlFor={`note-${usageId}`}
        error={state.fieldErrors?.explanation}
        hint="Check the provider's usage/billing before releasing this reservation. Available after ten minutes."
      >
        <input
          id={`note-${usageId}`}
          name="explanation"
          minLength={10}
          maxLength={500}
          required
          className={inputClass}
        />
      </Field>
      <SubmitButton size="sm" variant="secondary">
        Record reviewed charge
      </SubmitButton>
    </form>
  );
}

export function JobControls({ jobId, status }) {
  const [, retryAction] = useActionStateWithNotice(manageDraftJob.bind(null, jobId, "retry"), {});
  const [, cancelAction] = useActionStateWithNotice(manageDraftJob.bind(null, jobId, "cancel"), {});
  return (
    <div className="space-y-4">
      {["failed", "cancelled"].includes(status) ? (
        <form action={retryAction} className="space-y-3">
          <Field
            label="Extra supporting URLs"
            htmlFor="retry-evidence"
            hint="Optional, up to four. Adding URLs restarts research with a new web search plus these pages. Leave blank to retry the current step."
          >
            <textarea id="retry-evidence" name="evidence_urls" rows={3} className={inputClass} />
          </Field>
          <CheckboxLabel name="restart">Restart research and generate a fresh draft</CheckboxLabel>
          <SubmitButton>Retry draft job</SubmitButton>
        </form>
      ) : null}
      {["queued", "running", "failed"].includes(status) ? (
        <form action={cancelAction}>
          <SubmitButton
            variant="danger-outline"
            confirm="Cancel this draft job? An AI request already in progress may still incur a charge, but its worker cannot create an article after cancellation."
          >
            Cancel job
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
