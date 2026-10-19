"use client";

import { useActionState } from "react";
import { updateStrictDraftChecks } from "@/app/actions/network";
import { FormAlert, SubmitButton } from "@/components/form-controls";
import { CheckboxLabel } from "@/components/ui";
import { DRAFT_CHECKS } from "@/lib/automation/strict-checks";

export function StrictChecksForm({ checks }) {
  const [state, action] = useActionState(updateStrictDraftChecks, {});
  return (
    <form action={action} className="space-y-4">
      <FormAlert state={state} />
      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium">Block drafts when…</legend>
        {DRAFT_CHECKS.map(({ key, description }) => (
          <CheckboxLabel key={key} name="strict_draft_checks" value={key} defaultChecked={checks.includes(key)}>
            {description}
          </CheckboxLabel>
        ))}
      </fieldset>
      <p className="text-sm text-muted-foreground">
        All are off initially; unchecked checks remain reviewer warnings. Suggested first choices: sensitive story
        without a second source, and draft does not cite the official source. A blocked job waits for a person to retry
        it.
      </p>
      <SubmitButton variant="secondary">Save draft checks</SubmitButton>
    </form>
  );
}
