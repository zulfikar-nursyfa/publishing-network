"use client";

import { useActionState } from "react";
import { FormAlert, SubmitButton } from "@/components/form-controls";
import { Card, Field, inputClass } from "@/components/ui";

export function ArticleForm({ action, values, rtl, readOnly = false, submitLabel, categories = [] }) {
  const [state, formAction] = useActionState(action, {});
  const errors = state.fieldErrors ?? {};
  const dir = rtl ? "rtl" : "ltr";

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert state={state} />
      {values?.version !== undefined ? <input type="hidden" name="version" value={values.version} /> : null}
      <Card>
        <fieldset disabled={readOnly} className="min-w-0 space-y-5">
          <Field label="Title" htmlFor="title" error={errors.title}>
            <input
              id="title"
              name="title"
              dir={dir}
              required
              defaultValue={values?.title}
              className={`${inputClass} h-11 text-base font-medium sm:text-lg`}
              placeholder="Article headline"
            />
          </Field>
          <Field
            label="Body"
            htmlFor="body"
            error={errors.body}
            hint="Plain text (blank line = new paragraph) or HTML."
          >
            <textarea
              id="body"
              name="body"
              dir={dir}
              rows={18}
              defaultValue={values?.body}
              className={`${inputClass} py-3 text-[0.95rem] leading-7`}
              placeholder="Write the article…"
            />
          </Field>
          <Field
            label="Excerpt"
            htmlFor="excerpt"
            error={errors.excerpt}
            hint="Optional summary shown in listings and search results."
          >
            <textarea
              id="excerpt"
              name="excerpt"
              dir={dir}
              rows={2}
              defaultValue={values?.excerpt ?? ""}
              className={`${inputClass} leading-relaxed`}
            />
          </Field>
          <div className="grid gap-5 border-t pt-5 md:grid-cols-[1fr_2fr]">
            <div className="space-y-5">
              <Field label="Category" htmlFor="category_id" error={errors.category_id}>
                <select
                  id="category_id"
                  name="category_id"
                  defaultValue={values?.category_id ?? ""}
                  className={inputClass}
                >
                  <option value="">None</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="URL slug"
                htmlFor="slug"
                error={errors.slug}
                hint="Optional. WordPress generates one from the title if empty."
              >
                <input
                  id="slug"
                  name="slug"
                  dir="ltr"
                  defaultValue={values?.slug ?? ""}
                  className={`${inputClass} font-mono text-xs`}
                  placeholder="auto"
                />
              </Field>
            </div>
            <Field
              label="Sources"
              htmlFor="sources"
              error={errors.sources}
              hint="One per line: URL | title | publisher. Listed under the article when published."
            >
              <textarea
                id="sources"
                name="sources"
                dir="ltr"
                rows={3}
                defaultValue={values?.sources}
                className={`${inputClass} font-mono text-xs leading-relaxed`}
                placeholder="https://publisher.example/story | Original headline | Publisher"
              />
            </Field>
          </div>
          <div className="space-y-5 border-t pt-5">
            <div>
              <div className="text-sm font-medium">Search engines (Yoast SEO)</div>
              <p className="text-xs text-muted-foreground">Empty fields fall back to the title and excerpt.</p>
            </div>
            <div className="grid gap-5 md:grid-cols-[2fr_1fr]">
              <Field label="SEO title" htmlFor="seo_title" error={errors.seo_title} hint="Up to about 60 characters.">
                <input
                  id="seo_title"
                  name="seo_title"
                  dir={dir}
                  maxLength={70}
                  defaultValue={values?.seo_title ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field label="Focus keyphrase" htmlFor="focus_keyword" error={errors.focus_keyword}>
                <input
                  id="focus_keyword"
                  name="focus_keyword"
                  dir={dir}
                  maxLength={80}
                  defaultValue={values?.focus_keyword ?? ""}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field
              label="Meta description"
              htmlFor="meta_description"
              error={errors.meta_description}
              hint="120–155 characters shown under the title in search results."
            >
              <textarea
                id="meta_description"
                name="meta_description"
                dir={dir}
                rows={2}
                maxLength={170}
                defaultValue={values?.meta_description ?? ""}
                className={`${inputClass} leading-relaxed`}
              />
            </Field>
            <Field
              label="Tags"
              htmlFor="tags"
              error={errors.tags}
              hint="Comma-separated, up to 10. Created in WordPress when missing."
            >
              <input
                id="tags"
                name="tags"
                dir={dir}
                defaultValue={values?.tags ?? ""}
                className={inputClass}
                placeholder="Emirates, aviation, Dubai"
              />
            </Field>
          </div>
        </fieldset>
      </Card>
      {!readOnly ? (
        <div className="sticky bottom-0 z-10 -mx-4 flex justify-end border-t bg-background px-4 py-3 sm:mx-0 sm:rounded-lg sm:border sm:px-4">
          <SubmitButton className="w-full sm:w-auto" pendingLabel="Saving…">
            {submitLabel}
          </SubmitButton>
        </div>
      ) : null}
    </form>
  );
}
