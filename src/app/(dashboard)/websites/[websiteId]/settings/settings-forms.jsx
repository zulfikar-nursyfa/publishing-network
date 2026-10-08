"use client";

import { useActionState, useId } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { addCategory, syncCategories } from "@/app/actions/categories";
import { testWebsiteConnection } from "@/app/actions/websites";
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

/** `addSource` is a bound server action: a website's own sources or a niche's source group. */
export function AddSourceForm({ addSource }) {
  const [state, action] = useActionState(addSource, {});
  const errors = state.fieldErrors ?? {};
  const id = useId();
  return (
    <form action={action} className="space-y-4 rounded-lg bg-muted/40 p-4">
      <div className="text-sm font-medium">Add a source</div>
      <FormAlert state={state} />
      <div className="grid gap-4 md:grid-cols-[1fr_12rem]">
        <Field label="Name" htmlFor={`${id}-name`} error={errors.name}>
          <input id={`${id}-name`} name="name" required className={inputClass} />
        </Field>
        <Field label="Type" htmlFor={`${id}-kind`} hint="Pages from newsroom and government sources count as official (primary) sources.">
          <select id={`${id}-kind`} name="kind" className={inputClass} defaultValue="news">
            {Object.entries(SOURCE_KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Website URL" htmlFor={`${id}-url`} error={errors.url}>
          <input id={`${id}-url`} name="url" type="url" required className={inputClass} placeholder="https://…" />
        </Field>
        <Field label="RSS or Atom feed URL" htmlFor={`${id}-feed`} error={errors.feed_url} hint="Optional. New stories are read from this feed every 30 minutes.">
          <input id={`${id}-feed`} name="feed_url" type="url" className={inputClass} placeholder="https://…/rss" />
        </Field>
      </div>
      <Field label="Attribution and usage rights note" htmlFor={`${id}-note`} error={errors.attribution_note} hint="Optional, e.g. licence terms or a required credit line.">
        <input id={`${id}-note`} name="attribution_note" className={inputClass} />
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

export function SyncCategoriesButton({ websiteId }) {
  const [state, action] = useActionState(syncCategories.bind(null, websiteId), {});
  return (
    <form action={action} className="space-y-3">
      <FormAlert state={state} />
      <SubmitButton variant="secondary" size="sm" pendingLabel="Syncing…">
        <RefreshCw />
        Sync with WordPress
      </SubmitButton>
    </form>
  );
}

export function AddCategoryForm({ websiteId }) {
  const [state, action] = useActionState(addCategory.bind(null, websiteId), {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4 rounded-lg bg-muted/40 p-4">
      <div className="text-sm font-medium">Add a category</div>
      <FormAlert state={state} />
      <div className="grid gap-4 md:grid-cols-[1fr_14rem]">
        <Field label="Name" htmlFor="category-name" error={errors.name}>
          <input id="category-name" name="name" required className={inputClass} />
        </Field>
        <Field label="Slug" htmlFor="category-slug" error={errors.slug} hint="Optional for Latin names.">
          <input id="category-slug" name="slug" dir="ltr" className={`${inputClass} font-mono text-xs`} placeholder="auto" />
        </Field>
      </div>
      <Field label="Description" htmlFor="category-description" error={errors.description} hint="Helps the AI choose the right category for a story.">
        <input id="category-description" name="description" className={inputClass} />
      </Field>
      <SubmitButton variant="secondary" pendingLabel="Adding…">
        <Plus />
        Add category
      </SubmitButton>
    </form>
  );
}
