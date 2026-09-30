"use client";

import { useActionState, useState } from "react";
import { FormAlert, SubmitButton } from "@/components/form-controls";
import { Card, Field, inputClass } from "@/components/ui";

export function WebsiteForm({
  action,
  website,
  editors,
  assignedEditorIds = [],
  timezones,
}) {
  const [state, formAction] = useActionState(action, {});
  const [language, setLanguage] = useState(website?.language ?? "en");
  const errors = state.fieldErrors ?? {};
  const branding = (website?.branding ?? {});
  const isNew = !website;

  return (
    <form action={formAction} className="space-y-6">
      <FormAlert state={state} />

      <Card title="Website" description="How the site is identified in the dashboard.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name" htmlFor="name" error={errors.name}>
            <input id="name" name="name" required defaultValue={website?.name} className={inputClass} />
          </Field>
          <Field label="Slug" htmlFor="slug" error={errors.slug} hint="Short identifier. Left empty, it is generated from the name.">
            <input id="slug" name="slug" defaultValue={website?.slug} className={inputClass} placeholder="auto" />
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

      <Card title="Branding" description="Used by the site templates and article illustrations.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Tagline" htmlFor="brand_tagline" error={errors.brand_tagline}>
            <input id="brand_tagline" name="brand_tagline" dir={language === "ar" ? "rtl" : "ltr"} defaultValue={branding.tagline ?? ""} className={inputClass} />
          </Field>
          <Field label="Primary colour" htmlFor="brand_primary_color" error={errors.brand_primary_color}>
            <input id="brand_primary_color" name="brand_primary_color" defaultValue={branding.primary_color ?? ""} className={inputClass} placeholder="#1d4ed8" />
          </Field>
          <Field label="Logo URL" htmlFor="brand_logo_url" error={errors.brand_logo_url}>
            <input id="brand_logo_url" name="brand_logo_url" defaultValue={branding.logo_url ?? ""} className={inputClass} placeholder="https://…" />
          </Field>
        </div>
      </Card>

      <Card
        title="WordPress connection"
        description="Create an application password in WordPress under Users → Profile → Application Passwords, for a user with the Editor role."
      >
        <div className="grid gap-4 md:grid-cols-3">
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
            <input id="wp_app_password" name="wp_app_password" type="password" autoComplete="new-password" required={isNew} className={inputClass} placeholder={isNew ? "xxxx xxxx xxxx xxxx xxxx xxxx" : "••••••••"} />
          </Field>
        </div>
      </Card>

      <Card title="Publishing and automation" description="Automation starts paused. Manual articles are never limited by these settings.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Publishing timezone" htmlFor="timezone" error={errors.timezone}>
            <select id="timezone" name="timezone" defaultValue={website?.timezone ?? "UTC"} className={inputClass}>
              {timezones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
            </select>
          </Field>
          <Field label="Automated articles per day" htmlFor="daily_quota" error={errors.daily_quota} hint="Manual articles are additional.">
            <select id="daily_quota" name="daily_quota" defaultValue={String(website?.daily_quota ?? 0)} className={inputClass}>
              <option value="0">0 (automation off)</option>
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </Field>
          <Field label="Monthly AI spending limit (USD)" htmlFor="monthly_ai_budget_usd" error={errors.monthly_ai_budget_usd} hint="Automation stops when the estimate reaches this.">
            <input id="monthly_ai_budget_usd" name="monthly_ai_budget_usd" type="number" min="0" step="0.01" defaultValue={website?.monthly_ai_budget_usd ?? 0} className={inputClass} />
          </Field>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked disabled className="h-4 w-4" />
            <span>Automated articles require editorial approval <span className="text-gray-500">(required at launch)</span></span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="generate_illustrations" defaultChecked={website?.generate_illustrations ?? false} className="h-4 w-4" />
            <span>Generate AI illustrations for automated articles <span className="text-gray-500">(each needs approval)</span></span>
          </label>
        </div>
      </Card>

      <Card title="Editors" description="Editors only see the websites they are assigned to. Administrators see every website.">
        {editors.length === 0 ? (
          <p className="text-sm text-gray-600">No editors yet. Invite them from the Users page.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {editors.map((editor) => (
              <label key={editor.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="editor_ids" value={editor.id} defaultChecked={assignedEditorIds.includes(editor.id)} className="h-4 w-4" />
                <span>{editor.full_name || editor.email}{editor.full_name ? <span className="text-gray-500"> · {editor.email}</span> : null}</span>
              </label>
            ))}
          </div>
        )}
      </Card>

      {isNew ? (
        <Card title="Approved content sources" description="Optional. One per line as: Name | URL. You can manage sources later.">
          <textarea name="initial_sources" rows={4} className={`${inputClass} font-mono`} placeholder={"Reuters Business | https://example.com/rss\nOfficial press office | https://example.gov/news"} />
        </Card>
      ) : null}

      <div className="flex justify-end">
        <SubmitButton pendingLabel={isNew ? "Adding website…" : "Saving…"}>{isNew ? "Add website and test connection" : "Save settings"}</SubmitButton>
      </div>
    </form>
  );
}
