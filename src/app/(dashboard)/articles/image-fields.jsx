import { Field, inputClass } from "@/components/ui";
import { IMAGE_SOURCE_KINDS } from "@/lib/validation";

/** Source, credit, alt text, caption and usage terms of an article image (featured or in the body). */
export function ImageFields({ errors, image = null, idPrefix }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Source" htmlFor={`${idPrefix}-kind`} error={errors.source_kind}>
          <select
            id={`${idPrefix}-kind`}
            name="source_kind"
            defaultValue={image?.source_kind ?? "owned"}
            className={inputClass}
          >
            {Object.entries(IMAGE_SOURCE_KINDS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Credit"
          htmlFor={`${idPrefix}-credit`}
          error={errors.credit}
          hint="e.g. Dubai Media Office. Required for licensed and press images."
        >
          <input id={`${idPrefix}-credit`} name="credit" defaultValue={image?.credit ?? ""} className={inputClass} />
        </Field>
      </div>
      <Field label="Alt text" htmlFor={`${idPrefix}-alt`} error={errors.alt_text}>
        <input
          id={`${idPrefix}-alt`}
          name="alt_text"
          required
          defaultValue={image?.alt_text ?? ""}
          className={inputClass}
        />
      </Field>
      <Field label="Caption" htmlFor={`${idPrefix}-caption`} error={errors.caption} hint="Optional.">
        <input id={`${idPrefix}-caption`} name="caption" defaultValue={image?.caption ?? ""} className={inputClass} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Source page"
          htmlFor={`${idPrefix}-source-url`}
          error={errors.source_url}
          hint="Where the image or its terms were found."
        >
          <input
            id={`${idPrefix}-source-url`}
            name="source_url"
            type="url"
            dir="ltr"
            defaultValue={image?.source_url ?? ""}
            className={inputClass}
            placeholder="https://…"
          />
        </Field>
        <Field label="Licence or usage terms" htmlFor={`${idPrefix}-license`} error={errors.license}>
          <input id={`${idPrefix}-license`} name="license" defaultValue={image?.license ?? ""} className={inputClass} />
        </Field>
      </div>
    </>
  );
}
