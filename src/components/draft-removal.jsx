"use client";
import { useState } from "react";
import { removeFromDrafting, bulkRemoveFromDrafting } from "@/app/actions/jobs";
import { ActionForm, SubmitButton } from "./form-controls";
import { SelectionActions } from "./selection-actions";

const confirmation =
  "Remove from drafting and skip the story? It will leave the automatic queue. A running AI request may finish and incur a charge; its worker stops at the next control check.";

export function RemoveDraftForm({ jobId, title }) {
  const [removed, setRemoved] = useState(false);
  if (removed) return null;
  return (
    <ActionForm
      action={async () => {
        const result = await removeFromDrafting(jobId);
        if (result.ok) setRemoved(true);
        return result;
      }}
    >
      <SubmitButton
        size="sm"
        variant="danger-outline"
        confirm={title ? `${title}: ${confirmation}` : confirmation}
        confirmLabel="Remove from drafting"
      >
        Remove from drafting
      </SubmitButton>
    </ActionForm>
  );
}

export function BulkDraftRemoval({ selectionKey }) {
  return (
    <SelectionActions key={selectionKey} id="bulk-jobs" name="job_ids" action={bulkRemoveFromDrafting} clearOnSuccess>
      <SubmitButton size="sm" variant="danger-outline" confirm={confirmation} confirmLabel="Remove selected stories">
        Remove from drafting
      </SubmitButton>
    </SelectionActions>
  );
}
