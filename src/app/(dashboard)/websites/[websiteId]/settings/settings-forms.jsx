"use client";

import { useActionState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { addContentSource, testWebsiteConnection } from "@/app/actions/websites";
import { FormAlert, SubmitButton } from "@/components/form-controls";
import { Field, inputClass } from "@/components/ui";

export function TestConnectionButton({ websiteId }) {
  const [state, action] = useActionState(testWebsiteConnection.bind(null, websiteId), {});
  return (
    <form action={action} className="space-y-3">
      <FormAlert state={state} />
      <SubmitButton variant="secondary" pendingLabel="Testing…">
        <RefreshCw />
        Test connection
      </SubmitButton>
    </form>
  );
}

export function AddSourceForm({ websiteId }) {
  const [state, action] = useActionState(addContentSource.bind(null, websiteId), {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4 rounded-lg bg-muted/40 p-4">
      <div className="text-sm font-medium">Add a source</div>
      <FormAlert state={state} />
      <div className="grid gap-4 md:grid-cols-[1fr_2fr_10rem]">
        <Field label="Name" htmlFor="source-name" error={errors.name}>
          <input id="source-name" name="name" required className={inputClass} />
        </Field>
        <Field label="URL" htmlFor="source-url" error={errors.url}>
          <input id="source-url" name="url" type="url" required className={inputClass} placeholder="https://…" />
        </Field>
        <Field label="Type" htmlFor="source-kind">
          <select id="source-kind" name="kind" className={inputClass} defaultValue="rss">
            <option value="rss">RSS feed</option>
            <option value="website">Website</option>
            <option value="api">API</option>
          </select>
        </Field>
      </div>
      <Field label="Attribution and media rights note" htmlFor="source-note" error={errors.attribution_note} hint="e.g. licence terms, required credit line, whether images may be reused.">
        <input id="source-note" name="attribution_note" className={inputClass} />
      </Field>
      <SubmitButton variant="secondary" pendingLabel="Adding…">
        <Plus />
        Add source
      </SubmitButton>
    </form>
  );
}
