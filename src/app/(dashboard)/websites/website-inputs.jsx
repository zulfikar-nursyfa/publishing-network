"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import { buttonClass, Field, inputClass } from "@/components/ui";
import { MAX_DAILY_ARTICLES } from "@/lib/schedule";
import { LOGO_MIME_TYPES, MAX_LOGO_BYTES } from "@/lib/website-branding";

export function PublishingTimesPicker({ initialTimes, error }) {
  const nextId = useRef(initialTimes.length);
  const [times, setTimes] = useState(() => initialTimes.map((value, id) => ({ id, value: value.slice(0, 5) })));
  return <fieldset className="min-w-0 space-y-2">
    <legend className="text-sm font-medium">Publishing times</legend>
    <input type="hidden" name="publish_times" value={times.map((time) => time.value).join(", ")} />
    <div className="space-y-2">{times.map((time, index) => {
      const duplicate = time.value && times.some((other) => other.id !== time.id && other.value === time.value);
      return <div key={time.id} className="flex items-center gap-2">
        <span aria-hidden className="w-4 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
        <input type="time" required step="60" aria-label={`Publishing time ${index + 1}`} aria-invalid={Boolean(duplicate || error)}
          aria-describedby="publish-times-hint" value={time.value} className={`${inputClass} tabular-nums`}
          ref={(node) => node?.setCustomValidity(duplicate ? "Choose a different time; each publishing slot must be unique." : "")}
          onChange={(event) => setTimes(times.map((item) => item.id === time.id ? { ...item, value: event.target.value } : item))} />
        <button type="button" className={buttonClass("ghost", "shrink-0", "icon")} aria-label={`Remove publishing time ${index + 1}`}
          onClick={() => setTimes(times.filter((item) => item.id !== time.id))}><X /></button>
      </div>;
    })}</div>
    <button type="button" className={buttonClass("secondary", "w-full", "sm")} disabled={times.length >= MAX_DAILY_ARTICLES}
      onClick={() => setTimes([...times, { id: nextId.current++, value: "" }])}><Plus />Add time</button>
    <p id="publish-times-hint" className="text-xs leading-relaxed text-muted-foreground">
      {times.length ? `${times.length} automated ${times.length === 1 ? "article" : "articles"} per day, in the selected timezone.` : "No automatic publishing slots."} Manual articles are additional. Up to {MAX_DAILY_ARTICLES} times.
    </p>
    {error || times.some((time) => time.value && times.some((other) => other.id !== time.id && other.value === time.value))
      ? <p role="alert" className="text-xs text-destructive">{error ?? "Each publishing time must be unique."}</p> : null}
  </fieldset>;
}

export function BrandColourPicker({ value, onChange, error }) {
  const valid = /^#[0-9a-f]{6}$/i.test(value);
  return <Field label="Primary colour" htmlFor="brand_primary_color" error={error} hint="Click the colour box to open the picker, or enter a hex value.">
    <div className="flex gap-2">
      <input type="color" aria-label="Choose a custom primary colour" value={valid ? value : "#1d4ed8"} onChange={(event) => onChange(event.target.value)}
        className="h-9 w-11 shrink-0 cursor-pointer rounded-md border border-input bg-card p-1" />
      <input id="brand_primary_color" name="brand_primary_color" value={value} onChange={(event) => onChange(event.target.value)}
        maxLength={7} className={`${inputClass} font-mono`} placeholder="#1d4ed8" />
      {value ? <button type="button" className={buttonClass("ghost", "", "icon")} aria-label="Clear primary colour" onClick={() => onChange("")}><X /></button> : null}
    </div>
  </Field>;
}

export function LogoUpload({ currentUrl, removed, onFileChange, onRemove, error }) {
  const input = useRef(null);
  const [preview, setPreview] = useState(null);
  const [filename, setFilename] = useState("");
  const [fileError, setFileError] = useState(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const shownUrl = removed ? null : preview ?? currentUrl;
  function selectFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!LOGO_MIME_TYPES.includes(file.type) || file.size > MAX_LOGO_BYTES || !file.size) {
      setFileError("Choose a PNG, JPEG or WebP image up to 2 MB.");
      event.target.setCustomValidity("Choose a PNG, JPEG or WebP image up to 2 MB.");
      event.target.value = "";
      onFileChange(null); setPreview(null); setFilename("");
      return;
    }
    event.target.setCustomValidity("");
    setFileError(null); setPreview(URL.createObjectURL(file)); setFilename(file.name);
    onFileChange(file); onRemove(false);
  }
  return <Field label="Logo" htmlFor="brand_logo" error={fileError ?? error} hint="PNG, JPEG or WebP, up to 2 MB. Uploads are saved when you save this form.">
    <div className="flex items-center gap-3 rounded-lg border bg-muted/25 p-3">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white">
        {shownUrl ? <Image src={shownUrl} alt="Website logo preview" width={64} height={64} unoptimized className="size-full object-contain p-1" />
          : <ImagePlus aria-hidden className="size-6 text-slate-400" />}
      </div>
      <div className="min-w-0 space-y-1"><p className="truncate text-xs font-medium">{filename || (shownUrl ? "Current logo" : removed ? "Logo will be removed" : "No logo selected")}</p>
        {shownUrl ? <button type="button" className="inline-flex items-center gap-1 text-xs text-destructive hover:underline" onClick={() => {
          input.current.value = ""; input.current.setCustomValidity(""); setPreview(null); setFilename(""); setFileError(null); onFileChange(null); onRemove(true);
        }}><Trash2 className="size-3" />Remove logo</button> : removed && currentUrl
          ? <button type="button" className="text-xs text-primary hover:underline" onClick={() => onRemove(false)}>Keep current logo</button> : null}
      </div>
    </div>
    <input ref={input} id="brand_logo" name="brand_logo" type="file" accept={LOGO_MIME_TYPES.join(",")} onChange={selectFile}
      className={`${inputClass} cursor-pointer px-2 py-1.5 text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:font-medium file:text-foreground`} />
  </Field>;
}
