"use client";
import { useActionState } from "react";
import { addCostEntry } from "@/app/actions/costs";
import { Field, inputClass } from "@/components/ui";
import { FormAlert, SubmitButton } from "@/components/form-controls";
import { COST_CATEGORIES } from "@/lib/cost-report";

export function CostEntryForm({ month, websites }) {
  const [state, action] = useActionState(addCostEntry, {});
  return (
    <form action={action} className="space-y-4">
      <FormAlert state={state} />
      <input type="hidden" name="month" value={month} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Website" htmlFor="cost-website" error={state.fieldErrors?.website_id}>
          <select id="cost-website" name="website_id" defaultValue="" className={inputClass}>
            <option value="">Whole network (split across active websites)</option>
            {websites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Category" htmlFor="cost-category" error={state.fieldErrors?.category}>
          <select id="cost-category" name="category" defaultValue="images" className={inputClass}>
            {COST_CATEGORIES.map((category) => (
              <option key={category.key} value={category.key}>
                {category.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Amount (USD)"
          htmlFor="cost-amount"
          error={state.fieldErrors?.amount_usd}
          hint="Editorial time: hours × hourly rate."
        >
          <input
            id="cost-amount"
            name="amount_usd"
            type="number"
            min="0"
            max="1000000"
            step="0.01"
            required
            className={inputClass}
          />
        </Field>
        <Field label="Note" htmlFor="cost-note" error={state.fieldErrors?.note}>
          <input
            id="cost-note"
            name="note"
            maxLength={300}
            className={inputClass}
            placeholder="e.g. Shutterstock plan, 12 h review"
          />
        </Field>
      </div>
      <SubmitButton>Add cost</SubmitButton>
    </form>
  );
}
