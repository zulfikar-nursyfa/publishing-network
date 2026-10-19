"use client";
import { bulkStoryStatus } from "@/app/actions/stories";
import { SubmitButton } from "./form-controls";
import { SelectionActions } from "./selection-actions";

export function BulkStoryActions({ selectionKey }) {
  return (
    <SelectionActions key={selectionKey} id="bulk-stories" name="story_ids" action={bulkStoryStatus}>
      <SubmitButton size="sm" name="status" value="selected" variant="secondary">
        Select chosen
      </SubmitButton>
      <SubmitButton
        size="sm"
        name="status"
        value="skipped"
        variant="secondary"
        confirm="Skip the chosen stories and cancel any queued or running draft jobs?"
        confirmLabel="Skip stories"
      >
        Skip chosen
      </SubmitButton>
    </SelectionActions>
  );
}
