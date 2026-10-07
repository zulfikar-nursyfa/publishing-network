"use client";
import { useActionState } from "react";
import { manageDraftJob, queueStoryDraft, reconcileAIUsage } from "@/app/actions/jobs";
import { CheckboxLabel, Field, inputClass } from "@/components/ui";
import { FormAlert, SubmitButton } from "@/components/form-controls";

export function QueueDraftForm({ storyId }) {
  const [state, action] = useActionState(queueStoryDraft.bind(null, storyId), {});
  return <form action={action} className="mt-3 space-y-3">
    <FormAlert state={state} />
    <Field label="Supporting evidence URLs" htmlFor={`evidence-${storyId}`} hint="Optional: one per line, up to four. The system also searches the web for coverage; add the official announcement here if you know it.">
      <textarea id={`evidence-${storyId}`} name="evidence_urls" rows={2} className={inputClass} placeholder="https://…" />
    </Field>
    <SubmitButton size="sm" variant="secondary">Queue AI draft</SubmitButton>
  </form>;
}

export function UsageReconciliationForm({ usageId }) {
  const [state, action] = useActionState(reconcileAIUsage.bind(null, usageId), {});
  return <form action={action} className="mt-2 space-y-3 rounded-lg border p-3">
    <FormAlert state={state} />
    <Field label="Reviewed provider charge (USD)" htmlFor={`cost-${usageId}`} error={state.fieldErrors?.reviewed_cost}>
      <input id={`cost-${usageId}`} name="reviewed_cost" type="number" min="0" max="10000" step="0.00000001" required className={inputClass} />
    </Field>
    <Field label="Billing reconciliation note" htmlFor={`note-${usageId}`} error={state.fieldErrors?.explanation} hint="Check the provider's usage/billing before releasing this reservation. Available after ten minutes.">
      <input id={`note-${usageId}`} name="explanation" minLength={10} maxLength={500} required className={inputClass} />
    </Field>
    <SubmitButton size="sm" variant="secondary">Record reviewed charge</SubmitButton>
  </form>;
}

export function JobControls({ jobId, status }) {
  const [retryState, retryAction] = useActionState(manageDraftJob.bind(null, jobId, "retry"), {});
  const [cancelState, cancelAction] = useActionState(manageDraftJob.bind(null, jobId, "cancel"), {});
  return <div className="space-y-4">
    {["failed", "cancelled"].includes(status) ? <form action={retryAction} className="space-y-3">
      <FormAlert state={retryState} />
      <Field label="Extra supporting URLs" htmlFor="retry-evidence" hint="Optional, up to four. Adding URLs restarts research with a new web search plus these pages. Leave blank to retry the current step.">
        <textarea id="retry-evidence" name="evidence_urls" rows={3} className={inputClass} />
      </Field>
      <CheckboxLabel name="restart">Restart research and generate a fresh draft</CheckboxLabel>
      <SubmitButton>Retry draft job</SubmitButton>
    </form> : null}
    {["queued", "running", "failed"].includes(status) ? <form action={cancelAction}>
      <FormAlert state={cancelState} />
      <SubmitButton variant="danger-outline" confirm="Cancel this draft job? An AI request already in progress may still incur a charge, but its worker cannot create an article after cancellation.">Cancel job</SubmitButton>
    </form> : null}
  </div>;
}
