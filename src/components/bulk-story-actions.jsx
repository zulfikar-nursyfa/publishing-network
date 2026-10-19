"use client";

import { useActionState } from "react";
import { bulkStoryStatus } from "@/app/actions/stories";
import { FormAlert, SubmitButton } from "./form-controls";
import { checkboxClass } from "./ui";

export function BulkStoryActions() {
  const [state, action] = useActionState(bulkStoryStatus, {});
  return (
    <div className="mb-3 space-y-2">
      <FormAlert state={state} />
      <form id="bulk-stories" action={action} className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className={checkboxClass}
            onChange={(event) => {
              for (const input of document.querySelectorAll('input[name="story_ids"][form="bulk-stories"]'))
                input.checked = event.target.checked;
            }}
          />
          Select page
        </label>
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
      </form>
    </div>
  );
}
