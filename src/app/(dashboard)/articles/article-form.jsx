"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Link2, LoaderCircle, Search, Sparkles } from "lucide-react";
import { suggestSeo } from "@/app/actions/articles";
import { showActionNotice } from "@/components/action-notice";
import { useActionStateWithNotice, SubmitButton } from "@/components/form-controls";
import { Card, Field, buttonClass, cn, inputClass } from "@/components/ui";
import { BodyEditor } from "./body-editor";

// Fields whose current text drives the counters and the search preview.
const LIVE = ["title", "slug", "excerpt", "seo_title", "meta_description"];

export function ArticleForm({
  action,
  values,
  rtl,
  readOnly = false,
  submitLabel,
  categories = [],
  websiteId,
  articleId = null,
}) {
  const [state, formAction] = useActionStateWithNotice(action, {});
  const errors = state.fieldErrors ?? {};
  const dir = rtl ? "rtl" : "ltr";
  const formRef = useRef(null);
  const [seoPending, startSeo] = useTransition();
  const [live, setLive] = useState(() => Object.fromEntries(LIVE.map((name) => [name, values?.[name] ?? ""])));

  // Not a form action: React resets a form after its action, which would drop unsaved edits.
  function generateSeo() {
    startSeo(async () => {
      let result;
      try {
        result = await suggestSeo(websiteId, new FormData(formRef.current));
      } catch (error) {
        console.error(error);
        result = { error: "That did not go through. Reload the page and try again." };
      }
      showActionNotice(result);
      for (const [name, value] of Object.entries(result.seo ?? {}))
        formRef.current.elements.namedItem(name).value = value;
      if (result.seo) setLive((current) => ({ ...current, ...pick(result.seo) }));
    });
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onInput={(event) => {
        const { name, value } = event.target;
        if (LIVE.includes(name)) setLive((current) => ({ ...current, [name]: value }));
      }}
      className="space-y-4"
    >
      {values?.version !== undefined ? <input type="hidden" name="version" value={values.version} /> : null}
      <fieldset disabled={readOnly} className="min-w-0 space-y-4">
        <Card className="space-y-5">
          <Field label="Headline" htmlFor="title" error={errors.title}>
            <textarea
              id="title"
              name="title"
              dir={dir}
              required
              rows={2}
              defaultValue={values?.title}
              onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
              className={cn(
                inputClass,
                "resize-none py-2.5 text-xl leading-snug font-semibold tracking-tight sm:text-2xl",
              )}
              placeholder="Article headline"
            />
          </Field>
          <div className="space-y-1.5">
            <div id="body-label" className="text-sm font-medium">
              Body
            </div>
            <BodyEditor
              defaultValue={values?.body ?? ""}
              dir={dir}
              readOnly={readOnly}
              articleId={articleId}
              labelledBy="body-label"
              invalid={Boolean(errors.body)}
            />
            {errors.body ? <p className="text-xs font-medium text-destructive">{errors.body}</p> : null}
          </div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card icon={FileText} title="Summary and placement">
            <div className="space-y-5">
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
                  rows={3}
                  defaultValue={values?.excerpt ?? ""}
                  className={`${inputClass} leading-relaxed`}
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
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
                  hint="Empty: WordPress makes one from the title."
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
            </div>
          </Card>
          <Card icon={Link2} title="Sources" description="Listed under the article when it is published.">
            <Field
              label="Source links"
              htmlFor="sources"
              error={errors.sources}
              hint="One per line: URL | title | publisher. Title and publisher are optional."
            >
              <textarea
                id="sources"
                name="sources"
                dir="ltr"
                rows={6}
                defaultValue={values?.sources}
                className={`${inputClass} font-mono text-xs leading-relaxed`}
                placeholder="https://publisher.example/story | Original headline | Publisher"
              />
            </Field>
          </Card>
        </div>

        <Card
          icon={Search}
          title="Search engines (Yoast SEO)"
          description="Empty fields fall back to the headline and excerpt. Generate fills all four from the headline and body."
          actions={
            readOnly ? null : (
              <button
                type="button"
                onClick={generateSeo}
                disabled={seoPending}
                className={buttonClass("secondary", null, "sm")}
              >
                {seoPending ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                {seoPending ? "Generating…" : "Generate with AI"}
              </button>
            )
          }
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <div className="min-w-0 space-y-5">
              <Field
                label={<Counted label="SEO title" value={live.seo_title} ideal={[30, 60]} />}
                htmlFor="seo_title"
                error={errors.seo_title}
              >
                <input
                  id="seo_title"
                  name="seo_title"
                  dir={dir}
                  maxLength={70}
                  defaultValue={values?.seo_title ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field
                label={<Counted label="Meta description" value={live.meta_description} ideal={[120, 155]} />}
                htmlFor="meta_description"
                error={errors.meta_description}
              >
                <textarea
                  id="meta_description"
                  name="meta_description"
                  dir={dir}
                  rows={3}
                  maxLength={170}
                  defaultValue={values?.meta_description ?? ""}
                  className={`${inputClass} leading-relaxed`}
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
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
                <Field
                  label="Tags"
                  htmlFor="tags"
                  error={errors.tags}
                  hint="Comma-separated. Created in WordPress when missing."
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
            </div>
            <SearchPreview live={live} dir={dir} />
          </div>
        </Card>
      </fieldset>
      {!readOnly ? (
        <div className="sticky bottom-0 z-10 -mx-4 flex justify-end border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-4">
          <SubmitButton className="w-full sm:w-auto" pendingLabel="Saving…">
            {submitLabel}
          </SubmitButton>
        </div>
      ) : null}
    </form>
  );
}

function pick(seo) {
  return Object.fromEntries(Object.entries(seo).filter(([name]) => LIVE.includes(name)));
}

/** Label with a live character count, green inside the range search engines show in full. */
function Counted({ label, value, ideal: [low, high] }) {
  const length = value.length;
  const tone = !length
    ? "text-muted-foreground"
    : length > high
      ? "text-amber-700 dark:text-amber-300"
      : length >= low
        ? "text-emerald-700 dark:text-emerald-300"
        : "text-muted-foreground";
  return (
    <span className="flex items-center justify-between gap-2">
      {label}
      <span className={cn("text-xs font-normal tabular-nums", tone)}>
        {length} / {high}
      </span>
    </span>
  );
}

/** Roughly how the result looks in Google: the SEO fields, or what Yoast falls back to. */
function SearchPreview({ live, dir }) {
  const title = live.seo_title || live.title || "Article headline";
  const description = live.meta_description || live.excerpt || "The meta description or excerpt appears here.";
  const slug = live.slug || "article-url";
  return (
    <div className="min-w-0 self-start rounded-lg border bg-muted/30 p-4">
      <div className="mb-3 text-xs font-medium text-muted-foreground">Search result preview</div>
      <div dir={dir} className="space-y-1">
        <div dir="ltr" className="truncate text-xs text-muted-foreground">
          yoursite.com › {slug}
        </div>
        <div className="line-clamp-2 text-lg leading-snug text-sky-700 dark:text-sky-400">{title}</div>
        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
