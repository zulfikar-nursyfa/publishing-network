"use client";

import { useActionState } from "react";
import { ImageIcon, Trash2 } from "lucide-react";
import { removeFeaturedImage, saveFeaturedImage } from "@/app/actions/images";
import { FormAlert, SubmitButton } from "@/components/form-controls";
import { Badge, Card, Field, inputClass } from "@/components/ui";
import { IMAGE_SOURCE_KINDS } from "@/lib/validation";

export function FeaturedImage({ articleId, image, previewUrl, readOnly }) {
  const [state, action] = useActionState(saveFeaturedImage.bind(null, articleId), {});
  const errors = state.fieldErrors ?? {};

  return (
    <Card icon={ImageIcon} title="Featured image"
      description="Prefer owned, then licensed, then official press images. AI illustrations are labelled as such when published."
      actions={image?.wp_media_id ? <Badge tone="green">in WordPress</Badge> : null}>
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage
        <img src={previewUrl} alt={image.alt_text ?? ""} className="mb-5 max-h-72 w-full rounded-lg border object-cover" />
      ) : null}
      {readOnly ? (
        image ? (
          <p className="text-sm text-muted-foreground">
            {IMAGE_SOURCE_KINDS[image.source_kind]}{image.credit ? ` · ${image.credit}` : ""}
          </p>
        ) : <p className="text-sm text-muted-foreground">No featured image.</p>
      ) : (
        <form key={image?.updated_at ?? "new"} action={action} className="space-y-4">
          <FormAlert state={state} />
          <Field label={image ? "Replace image" : "Image"} htmlFor="image-file" error={errors.file} hint="PNG, JPEG or WebP, at most 3 MB.">
            <input id="image-file" name="file" type="file" accept="image/png,image/jpeg,image/webp" className={inputClass} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Source" htmlFor="image-kind" error={errors.source_kind}>
              <select id="image-kind" name="source_kind" defaultValue={image?.source_kind ?? "owned"} className={inputClass}>
                {Object.entries(IMAGE_SOURCE_KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Credit" htmlFor="image-credit" error={errors.credit} hint="e.g. Dubai Media Office. Required for licensed and press images.">
              <input id="image-credit" name="credit" defaultValue={image?.credit ?? ""} className={inputClass} />
            </Field>
          </div>
          <Field label="Alt text" htmlFor="image-alt" error={errors.alt_text}>
            <input id="image-alt" name="alt_text" required defaultValue={image?.alt_text ?? ""} className={inputClass} />
          </Field>
          <Field label="Caption" htmlFor="image-caption" error={errors.caption} hint="Optional.">
            <input id="image-caption" name="caption" defaultValue={image?.caption ?? ""} className={inputClass} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Source page" htmlFor="image-source-url" error={errors.source_url} hint="Where the image or its terms were found.">
              <input id="image-source-url" name="source_url" type="url" dir="ltr" defaultValue={image?.source_url ?? ""} className={inputClass} placeholder="https://…" />
            </Field>
            <Field label="Licence or usage terms" htmlFor="image-license" error={errors.license}>
              <input id="image-license" name="license" defaultValue={image?.license ?? ""} className={inputClass} />
            </Field>
          </div>
          <SubmitButton variant="secondary" pendingLabel="Saving…">Save image</SubmitButton>
        </form>
      )}
      {image && !readOnly ? (
        <form action={removeFeaturedImage.bind(null, articleId)} className="mt-2">
          <SubmitButton variant="danger-outline" confirm="Remove the featured image?" confirmLabel="Remove">
            <Trash2 />
            Remove image
          </SubmitButton>
        </form>
      ) : null}
    </Card>
  );
}
