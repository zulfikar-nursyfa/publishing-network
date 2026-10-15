"use client";

import { useActionState } from "react";
import { updateNicheGuides } from "@/app/actions/niches";
import { FormAlert, SubmitButton } from "@/components/form-controls";
import { Field, inputClass } from "@/components/ui";

/** Editorial instructions added to the AI research and draft prompts of the niche's websites. */
export function NicheGuideForm({ niche }) {
  const [state, action] = useActionState(updateNicheGuides.bind(null, niche.id), {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4 rounded-lg bg-muted/40 p-4">
      <div className="text-sm font-medium">Writing guides</div>
      <FormAlert state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="English websites"
          htmlFor={`${niche.id}-guide-en`}
          error={errors.guide_en}
          hint="Readers, angle, tone and what to avoid."
        >
          <textarea
            id={`${niche.id}-guide-en`}
            name="guide_en"
            rows={6}
            maxLength={3000}
            defaultValue={niche.guide_en ?? ""}
            className={`${inputClass} leading-relaxed`}
          />
        </Field>
        <Field
          label="Arabic websites"
          htmlFor={`${niche.id}-guide-ar`}
          error={errors.guide_ar}
          hint="Arabic or English; the article is always written in Arabic."
        >
          <textarea
            id={`${niche.id}-guide-ar`}
            name="guide_ar"
            dir="auto"
            rows={6}
            maxLength={3000}
            defaultValue={niche.guide_ar ?? ""}
            className={`${inputClass} leading-relaxed`}
          />
        </Field>
      </div>
      <SubmitButton variant="secondary" size="sm" pendingLabel="Saving…">
        Save guides
      </SubmitButton>
    </form>
  );
}
