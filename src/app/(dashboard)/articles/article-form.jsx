"use client";

import { useActionState } from "react";
import { FormAlert, SubmitButton } from "@/components/form-controls";
import { Card, Field, inputClass } from "@/components/ui";

export function ArticleForm({
  action,
  values,
  rtl,
  readOnly = false,
  submitLabel,
}) {
  const [state, formAction] = useActionState(action, {});
  const errors = state.fieldErrors ?? {};
  const dir = rtl ? "rtl" : "ltr";

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert state={state} />
      {values?.version !== undefined ? <input type="hidden" name="version" value={values.version} /> : null}
      <Card>
        <fieldset disabled={readOnly} className="space-y-4">
          <Field label="Title" htmlFor="title" error={errors.title}>
            <input id="title" name="title" dir={dir} required defaultValue={values?.title} className={`${inputClass} text-lg font-medium`} />
          </Field>
          <Field label="Body" htmlFor="body" error={errors.body} hint="Plain text (blank line = new paragraph) or HTML.">
            <textarea id="body" name="body" dir={dir} rows={18} defaultValue={values?.body} className={`${inputClass} leading-relaxed`} />
          </Field>
          <Field label="Excerpt" htmlFor="excerpt" error={errors.excerpt} hint="Optional summary shown in listings and search results.">
            <textarea id="excerpt" name="excerpt" dir={dir} rows={2} defaultValue={values?.excerpt ?? ""} className={inputClass} />
          </Field>
          <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
            <Field label="URL slug" htmlFor="slug" error={errors.slug} hint="Optional. WordPress generates one from the title if empty.">
              <input id="slug" name="slug" dir="ltr" defaultValue={values?.slug ?? ""} className={`${inputClass} font-mono`} />
            </Field>
            <Field label="Sources" htmlFor="sources" error={errors.sources} hint="One per line: URL | title | publisher. Listed under the article when published.">
              <textarea id="sources" name="sources" dir="ltr" rows={3} defaultValue={values?.sources} className={`${inputClass} font-mono text-xs`} placeholder="https://example.com/story | Original headline | Publisher" />
            </Field>
          </div>
        </fieldset>
      </Card>
      {!readOnly ? (
        <div className="flex justify-end">
          <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
        </div>
      ) : null}
    </form>
  );
}
