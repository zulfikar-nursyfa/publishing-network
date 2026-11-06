"use client";

import { applyNicheCategories, saveNicheCategory } from "@/app/actions/niche-categories";
import { useActionStateWithNotice, SubmitButton } from "@/components/form-controls";
import { Badge, CheckboxLabel, Field, inputClass } from "@/components/ui";

function CategoryForm({ nicheId, language, category }) {
  const [state, action] = useActionStateWithNotice(saveNicheCategory.bind(null, nicheId, category?.id ?? null), {});
  const id = `${nicheId}-${language}-${category?.id ?? "new"}`;
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-3 rounded-lg bg-muted/40 p-4">
      <input type="hidden" name="language" value={language} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor={`${id}-name`} error={errors.name}>
          <input
            id={`${id}-name`}
            name="name"
            dir="auto"
            required
            maxLength={80}
            defaultValue={category?.name ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Slug (ASCII)" htmlFor={`${id}-slug`} error={errors.slug}>
          <input
            id={`${id}-slug`}
            name="slug"
            required
            maxLength={60}
            defaultValue={category?.slug ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Description" htmlFor={`${id}-description`} error={errors.description}>
          <input
            id={`${id}-description`}
            name="description"
            dir="auto"
            maxLength={300}
            defaultValue={category?.description ?? ""}
            className={inputClass}
          />
        </Field>
        <Field
          label="Sort order"
          htmlFor={`${id}-order`}
          error={errors.sort_order}
          hint="Lower numbers appear first. Changes affect new website copies."
        >
          <input
            id={`${id}-order`}
            name="sort_order"
            type="number"
            step="1"
            required
            defaultValue={category?.sort_order ?? 0}
            className={inputClass}
          />
        </Field>
      </div>
      {category ? (
        <CheckboxLabel name="archived" defaultChecked={Boolean(category.archived_at)}>
          Archived (no longer copied to websites)
        </CheckboxLabel>
      ) : null}
      <SubmitButton size="sm" variant="secondary">
        {category ? "Save category" : "Add category"}
      </SubmitButton>
    </form>
  );
}

export function NicheCategories({ nicheId, categories }) {
  const [, action] = useActionStateWithNotice(applyNicheCategories.bind(null, nicheId), {});
  return (
    <section className="space-y-4 border-t pt-5">
      <div className="text-sm font-semibold">Starting categories</div>
      <p className="text-sm text-muted-foreground">
        Copied by website language. Existing website edits and archives are kept. After applying, use Categories → Sync
        with WordPress in each website&apos;s settings.
      </p>
      <form action={action} className="space-y-3">
        <SubmitButton size="sm" variant="secondary">
          Apply to websites
        </SubmitButton>
      </form>
      <div className="grid gap-5 lg:grid-cols-2">
        {[
          ["en", "English"],
          ["ar", "Arabic"],
        ].map(([language, label]) => (
          <div key={language} className="space-y-3">
            <h3 className="text-sm font-medium">{label}</h3>
            <ul className="divide-y rounded-lg border">
              {categories
                .filter((category) => category.language === language)
                .map((category) => (
                  <li key={category.id} className="space-y-2 p-3 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <span dir="auto">{category.name}</span>
                      <span className="text-muted-foreground">
                        {category.sort_order} · {category.slug}
                      </span>
                      {category.archived_at ? <Badge>archived</Badge> : null}
                    </div>
                    <details>
                      <summary className="cursor-pointer text-xs text-primary">
                        Edit / reorder / archive<span className="sr-only"> {category.name}</span>
                      </summary>
                      <div className="mt-2">
                        <CategoryForm nicheId={nicheId} language={language} category={category} />
                      </div>
                    </details>
                  </li>
                ))}
            </ul>
            <details>
              <summary className="cursor-pointer text-sm text-primary">Add {label.toLowerCase()} category</summary>
              <div className="mt-2">
                <CategoryForm nicheId={nicheId} language={language} />
              </div>
            </details>
          </div>
        ))}
      </div>
    </section>
  );
}
