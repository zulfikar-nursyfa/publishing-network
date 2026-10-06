"use client";

import { useActionState, useState } from "react";
import { CalendarClock, Globe, Palette, Plug, Rss, Users } from "lucide-react";
import { FormAlert, SubmitButton } from "@/components/form-controls";
import { Card, CheckboxLabel, Field, inputClass } from "@/components/ui";
import { DEFAULT_PUBLISH_TIMES, DEFAULT_TIMEZONE, formatPublishTimes } from "@/lib/schedule";

export function WebsiteForm({
  action,
  website,
  editors,
  assignedEditorIds = [],
  timezones,
}) {
  const [state, formAction] = useActionState(action, {});
  const [language, setLanguage] = useState(website?.language ?? "en");
  const [color, setColor] = useState(website?.branding?.primary_color ?? "");
  const errors = state.fieldErrors ?? {};
  const branding = (website?.branding ?? {});
  const isNew = !website;
  const validColor = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color);

  return (
    <form action={formAction} className="space-y-6">
      <FormAlert state={state} />

      <Card icon={Globe} title="Website" description="How the site is identified in the dashboard.">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Name" htmlFor="name" error={errors.name}>
            <input id="name" name="name" required defaultValue={website?.name} className={inputClass} />
          </Field>
          <Field label="Slug" htmlFor="slug" error={errors.slug} hint="Short identifier. Left empty, it is generated from the name.">
            <input id="slug" name="slug" defaultValue={website?.slug} className={`${inputClass} font-mono`} placeholder="auto" />
          </Field>
          <Field label="Domain" htmlFor="domain" error={errors.domain}>
            <input id="domain" name="domain" required defaultValue={website?.domain} className={inputClass} placeholder="example.com" />
          </Field>
          <Field label="Language" htmlFor="language" error={errors.language} hint={language === "ar" ? "Articles are written and displayed right to left." : undefined}>
            <select id="language" name="language" value={language} onChange={(event) => setLanguage(event.target.value)} className={inputClass}>
              <option value="en">English</option>
              <option value="ar">Arabic (right to left)</option>
            </select>
          </Field>
          <Field label="Topic" htmlFor="topic" error={errors.topic}>
            <input id="topic" name="topic" defaultValue={website?.topic ?? ""} className={inputClass} placeholder="e.g. Gulf business news" />
          </Field>
          <Field label="Audience" htmlFor="audience" error={errors.audience}>
            <input id="audience" name="audience" defaultValue={website?.audience ?? ""} className={inputClass} placeholder="Who the site is written for" />
          </Field>
        </div>
      </Card>

      <Card icon={Palette} title="Branding" description="Used by the site templates and article illustrations.">
        <div className="grid gap-5 md:grid-cols-3">
          <Field label="Tagline" htmlFor="brand_tagline" error={errors.brand_tagline}>
            <input id="brand_tagline" name="brand_tagline" dir={language === "ar" ? "rtl" : "ltr"} defaultValue={branding.tagline ?? ""} className={inputClass} />
          </Field>
          <Field label="Primary colour" htmlFor="brand_primary_color" error={errors.brand_primary_color}>
            <div className="relative">
              <span
                aria-hidden
                className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 rounded border"
                style={{ background: validColor ? color : "transparent" }}
              />
              <input
                id="brand_primary_color"
                name="brand_primary_color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className={`${inputClass} pl-9 font-mono`}
                placeholder="#1d4ed8"
              />
            </div>
          </Field>
          <Field label="Logo URL" htmlFor="brand_logo_url" error={errors.brand_logo_url}>
            <input id="brand_logo_url" name="brand_logo_url" defaultValue={branding.logo_url ?? ""} className={inputClass} placeholder="https://…" />
          </Field>
        </div>
      </Card>

      <Card
        icon={Plug}
        title="WordPress connection"
        description="Create an application password in WordPress under Users → Profile → Application Passwords, for a user with the Editor role."
      >
        <div className="grid gap-5 md:grid-cols-3">
          <Field label="WordPress URL" htmlFor="wp_base_url" error={errors.wp_base_url}>
            <input id="wp_base_url" name="wp_base_url" type="url" required defaultValue={website?.wp_base_url} className={inputClass} placeholder="https://example.com" />
          </Field>
          <Field label="WordPress username" htmlFor="wp_username" error={errors.wp_username}>
            <input id="wp_username" name="wp_username" required autoComplete="off" defaultValue={website?.wp_username} className={inputClass} />
          </Field>
          <Field
            label="Application password"
            htmlFor="wp_app_password"
            error={errors.wp_app_password}
            hint={isNew ? "Stored encrypted and never shown again." : "Leave empty to keep the saved password."}
          >
            <input id="wp_app_password" name="wp_app_password" type="password" autoComplete="new-password" required={isNew} className={`${inputClass} font-mono`} placeholder={isNew ? "xxxx xxxx xxxx xxxx xxxx xxxx" : "••••••••"} />
          </Field>
        </div>
      </Card>

      <Card icon={CalendarClock} title="Publishing and automation" description="Automation starts paused. Manual articles are never limited by these settings.">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Publishing timezone" htmlFor="timezone" error={errors.timezone}>
            <select id="timezone" name="timezone" defaultValue={website?.timezone ?? DEFAULT_TIMEZONE} className={inputClass}>
              {timezones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
            </select>
          </Field>
          <Field
            label="Publishing times"
            htmlFor="publish_times"
            error={errors.publish_times}
            hint="One automated article at each time, in the website's timezone. Leave empty for none. Manual articles are additional."
          >
            <input
              id="publish_times"
              name="publish_times"
              defaultValue={website ? formatPublishTimes(website.publish_times) : DEFAULT_PUBLISH_TIMES.join(", ")}
              className={`${inputClass} font-mono`}
              placeholder="08:00, 14:00, 20:00"
            />
          </Field>
          <Field label="Monthly AI spending limit (USD)" htmlFor="monthly_ai_budget_usd" error={errors.monthly_ai_budget_usd} hint="Automation stops when the estimate reaches this.">
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <input id="monthly_ai_budget_usd" name="monthly_ai_budget_usd" type="number" min="0" step="0.01" defaultValue={website?.monthly_ai_budget_usd ?? 0} className={`${inputClass} pl-7 tabular-nums`} />
            </div>
          </Field>
          <Field label="Automation mode" htmlFor="automation_mode" error={errors.automation_mode} className="md:col-span-2">
            <select id="automation_mode" name="automation_mode" defaultValue={website?.automation_mode ?? "review"} className={inputClass}>
              <option value="review">Review: every automated article is approved first</option>
              <option value="off">Off: no automated articles</option>
              <option value="automatic" disabled={website?.automation_mode !== "automatic"}>
                Automatic: allowed categories skip review (after the testing period)
              </option>
            </select>
          </Field>
          <Field label="AI model" htmlFor="ai_model" error={errors.ai_model} hint="Leave empty to use the network default.">
            <input id="ai_model" name="ai_model" defaultValue={website?.ai_model ?? ""} className={`${inputClass} font-mono`} placeholder="Network default" />
          </Field>
        </div>
        <div className="mt-5">
          <CheckboxLabel name="generate_illustrations" defaultChecked={website?.generate_illustrations ?? false}>
            Generate AI illustrations for automated articles <span className="text-muted-foreground">(each needs approval)</span>
          </CheckboxLabel>
        </div>
      </Card>

      <Card icon={Users} title="Editors" description="Editors only see the websites they are assigned to. Administrators see every website.">
        {editors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No editors yet. Invite them from the Users page.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {editors.map((editor) => (
              <CheckboxLabel key={editor.id} name="editor_ids" value={editor.id} defaultChecked={assignedEditorIds.includes(editor.id)}>
                <span className="block truncate font-medium">{editor.full_name || editor.email}</span>
                {editor.full_name ? <span className="block truncate text-xs text-muted-foreground">{editor.email}</span> : null}
              </CheckboxLabel>
            ))}
          </div>
        )}
      </Card>

      {isNew ? (
        <Card icon={Rss} title="Approved content sources" description="Optional. One per line as: Name | RSS feed URL. Set the type, image rights and other details later in the website settings.">
          <textarea name="initial_sources" rows={4} className={`${inputClass} font-mono text-xs leading-relaxed`} placeholder={"Reuters Business | https://example.com/rss\nOfficial press office | https://example.gov/news/rss"} />
        </Card>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-4 flex justify-end border-t bg-background/85 px-4 py-3 backdrop-blur-lg sm:mx-0 sm:rounded-xl sm:border sm:px-4">
        <SubmitButton className="w-full sm:w-auto" pendingLabel={isNew ? "Adding website…" : "Saving…"}>{isNew ? "Add website and test connection" : "Save settings"}</SubmitButton>
      </div>
    </form>
  );
}
