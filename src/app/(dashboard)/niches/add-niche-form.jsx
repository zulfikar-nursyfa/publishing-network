"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { addNiche } from "@/app/actions/niches";
import { FormAlert, SubmitButton } from "@/components/form-controls";
import { Field, inputClass } from "@/components/ui";

export function AddNicheForm() {
  const [state, action] = useActionState(addNiche, {});
  return (
    <form action={action} className="space-y-4">
      <FormAlert state={state} />
      <Field label="Name" htmlFor="niche-name" error={state.fieldErrors?.name}>
        <input id="niche-name" name="name" required className={inputClass} placeholder="e.g. Health & Medicine" />
      </Field>
      <SubmitButton variant="secondary" pendingLabel="Adding…">
        <Plus />
        Add niche
      </SubmitButton>
    </form>
  );
}
