"use client";

import { useActionState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { addContentSource, testWebsiteConnection } from "@/app/actions/websites";
import { FormAlert, SubmitButton } from "@/components/form-controls";
import { CheckboxLabel, Field, inputClass } from "@/components/ui";
import { SOURCE_KINDS } from "@/lib/validation";

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
      <div className="grid gap-4 md:grid-cols-[1fr_12rem]">
        <Field label="Name" htmlFor="source-name" error={errors.name}>
          <input id="source-name" name="name" required className={inputClass} />
        </Field>
        <Field label="Type" htmlFor="source-kind" hint="Pages from newsroom and government sources count as official (primary) sources.">
          <select id="source-kind" name="kind" className={inputClass} defaultValue="news">
            {Object.entries(SOURCE_KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Website URL" htmlFor="source-url" error={errors.url}>
          <input id="source-url" name="url" type="url" required className={inputClass} placeholder="https://…" />
        </Field>
        <Field label="RSS or Atom feed URL" htmlFor="source-feed" error={errors.feed_url} hint="Optional. New stories are read from this feed every 30 minutes.">
          <input id="source-feed" name="feed_url" type="url" className={inputClass} placeholder="https://…/rss" />
        </Field>
      </div>
      <Field label="Attribution and usage rights note" htmlFor="source-note" error={errors.attribution_note} hint="Optional, e.g. licence terms or a required credit line.">
        <input id="source-note" name="attribution_note" className={inputClass} />
      </Field>
      <CheckboxLabel name="images_reusable">
        Images from this source may be reused <span className="text-muted-foreground">(with credit, per the source&apos;s terms)</span>
      </CheckboxLabel>
      <SubmitButton variant="secondary" pendingLabel="Adding…">
        <Plus />
        Add source
      </SubmitButton>
    </form>
  );
}
