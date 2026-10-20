"use client";

import { useId } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { addCategory, syncCategories, updateCategory } from "@/app/actions/categories";
import { testWebsiteConnection } from "@/app/actions/websites";
import { useActionStateWithNotice, SubmitButton } from "@/components/form-controls";
import { CheckboxLabel, Field, inputClass } from "@/components/ui";
import { SOURCE_KINDS } from "@/lib/validation";

export function TestConnectionButton({ websiteId }) {
  const [, action] = useActionStateWithNotice(testWebsiteConnection.bind(null, websiteId), {});
  return (
    <form action={action} className="space-y-3">
      <SubmitButton variant="secondary" pendingLabel="Testing…">
        <RefreshCw />
        Test connection
      </SubmitButton>
    </form>
  );
}

/**
 * Adds a source, or edits `source` when given. `saveSource` is a bound server action for a
 * website's own sources or a niche's source group.
 */
export function SourceForm({ saveSource, source }) {
  const [state, action] = useActionStateWithNotice(saveSource, {});
  const errors = state.fieldErrors ?? {};
  const id = useId();
  return (
    <form action={action} className="space-y-4 rounded-lg bg-muted/40 p-4">
      {source ? null : <div className="text-sm font-medium">Add a source</div>}
      <div className="grid gap-4 md:grid-cols-[1fr_12rem]">
        <Field label="Name" htmlFor={`${id}-name`} error={errors.name}>
          <input id={`${id}-name`} name="name" required defaultValue={source?.name} className={inputClass} />
        </Field>
        <Field
          label="Type"
          htmlFor={`${id}-kind`}
          hint="Pages from newsroom and government sources count as official (primary) sources."
        >
          <select id={`${id}-kind`} name="kind" className={inputClass} defaultValue={source?.kind ?? "news"}>
            {Object.entries(SOURCE_KINDS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Website URL" htmlFor={`${id}-url`} error={errors.url}>
          <input
            id={`${id}-url`}
            name="url"
            type="url"
            required
            defaultValue={source?.url}
            className={inputClass}
            placeholder="https://…"
          />
        </Field>
        <Field
          label="RSS or Atom feed URL"
          htmlFor={`${id}-feed`}
          error={errors.feed_url}
          hint="Optional. New stories are read from this feed every 30 minutes."
        >
          <input
            id={`${id}-feed`}
            name="feed_url"
            type="url"
            defaultValue={source?.feed_url ?? ""}
            className={inputClass}
            placeholder="https://…/rss"
          />
        </Field>
      </div>
      <Field
        label="Attribution and usage rights note"
        htmlFor={`${id}-note`}
        error={errors.attribution_note}
        hint="Optional, e.g. licence terms or a required credit line."
      >
        <input
          id={`${id}-note`}
          name="attribution_note"
          defaultValue={source?.attribution_note ?? ""}
          className={inputClass}
        />
      </Field>
      <CheckboxLabel name="images_reusable" defaultChecked={source?.images_reusable ?? false}>
        Images from this source may be reused{" "}
        <span className="text-muted-foreground">(with credit, per the source&apos;s terms)</span>
      </CheckboxLabel>
      <SubmitButton variant="secondary" pendingLabel={source ? "Saving…" : "Adding…"}>
        {source ? (
          "Save source"
        ) : (
          <>
            <Plus />
            Add source
          </>
        )}
      </SubmitButton>
    </form>
  );
}

export function SyncCategoriesButton({ websiteId }) {
  const [, action] = useActionStateWithNotice(syncCategories.bind(null, websiteId), {});
  return (
    <form action={action} className="space-y-3">
      <SubmitButton variant="secondary" size="sm" pendingLabel="Syncing…">
        <RefreshCw />
        Sync with WordPress
      </SubmitButton>
    </form>
  );
}

/** Adds a category, or edits `category` when given. */
export function CategoryForm({ websiteId, category }) {
  const [state, action] = useActionStateWithNotice(
    category ? updateCategory.bind(null, websiteId, category.id) : addCategory.bind(null, websiteId),
    {},
  );
  const errors = state.fieldErrors ?? {};
  const id = useId();
  return (
    <form action={action} className="space-y-4 rounded-lg bg-muted/40 p-4">
      {category ? null : <div className="text-sm font-medium">Add a category</div>}
      <div className="grid gap-4 md:grid-cols-[1fr_14rem]">
        <Field label="Name" htmlFor={`${id}-name`} error={errors.name}>
          <input id={`${id}-name`} name="name" required defaultValue={category?.name} className={inputClass} />
        </Field>
        <Field
          label="Slug"
          htmlFor={`${id}-slug`}
          error={errors.slug}
          hint={category ? "Changing it changes the category's URL in WordPress." : "Optional for Latin names."}
        >
          <input
            id={`${id}-slug`}
            name="slug"
            dir="ltr"
            defaultValue={category?.slug}
            className={`${inputClass} font-mono text-xs`}
            placeholder="auto"
          />
        </Field>
      </div>
      <Field
        label="Description"
        htmlFor={`${id}-description`}
        error={errors.description}
        hint="Helps the AI choose the right category for a story."
      >
        <input
          id={`${id}-description`}
          name="description"
          defaultValue={category?.description ?? ""}
          className={inputClass}
        />
      </Field>
      <SubmitButton variant="secondary" pendingLabel={category ? "Saving…" : "Adding…"}>
        {category ? null : <Plus />}
        {category ? "Save category" : "Add category"}
      </SubmitButton>
    </form>
  );
}
