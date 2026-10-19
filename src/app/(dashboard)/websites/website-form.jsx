"use client";

import { useActionState, useState } from "react";
import { CalendarClock, ChartLine, Globe, Palette, Plug, Users } from "lucide-react";
import { FormAlert, SubmitButton } from "@/components/form-controls";
import { Card, CheckboxLabel, Field, inputClass } from "@/components/ui";
import { DEFAULT_PUBLISH_TIMES, DEFAULT_TIMEZONE } from "@/lib/schedule";
import { BrandColourPicker, LogoUpload, PublishingTimesPicker } from "./website-inputs";

export function WebsiteForm({ action, website, editors, assignedEditorIds = [], timezones, niches = [] }) {
  const [branding, setBranding] = useState(website?.branding ?? {});
  const [logoFile, setLogoFile] = useState(null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [logoInputKey, setLogoInputKey] = useState(0);
  const [state, formAction] = useActionState(async (previous, formData) => {
    if (logoFile) formData.set("brand_logo", logoFile);
    else formData.delete("brand_logo");
    formData.set("brand_remove_logo", logoRemoved ? "on" : "");
    const result = await action(previous, formData);
    if (result.ok) {
      setBranding(result.branding);
      setLogoFile(null);
      setLogoRemoved(false);
      setLogoInputKey((key) => key + 1);
    }
    return result;
  }, {});
  const [language, setLanguage] = useState(website?.language ?? "en");
  const [color, setColor] = useState(website?.branding?.primary_color ?? "");
  const errors = state.fieldErrors ?? {};
  const isNew = !website;

  return (
    <form action={formAction} className="space-y-6">
      <FormAlert state={state} />

      <Card icon={Globe} title="Website" description="How the site is identified in the dashboard.">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Name" htmlFor="name" error={errors.name}>
            <input id="name" name="name" required defaultValue={website?.name} className={inputClass} />
          </Field>
          <Field
            label="Slug"
            htmlFor="slug"
            error={errors.slug}
            hint="Short identifier. Left empty, it is generated from the name."
          >
            <input
              id="slug"
              name="slug"
              defaultValue={website?.slug}
              className={`${inputClass} font-mono`}
              placeholder="auto"
            />
          </Field>
          <Field label="Domain" htmlFor="domain" error={errors.domain}>
            <input
              id="domain"
              name="domain"
              required
              defaultValue={website?.domain}
              className={inputClass}
              placeholder="example.com"
            />
          </Field>
          <Field
            label="Language"
            htmlFor="language"
            error={errors.language}
            hint={language === "ar" ? "Articles are written and displayed right to left." : undefined}
          >
            <select
              id="language"
              name="language"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className={inputClass}
            >
              <option value="en">English</option>
              <option value="ar">Arabic (right to left)</option>
            </select>
          </Field>
          <Field
            label="Niche"
            htmlFor="niche_id"
            error={errors.niche_id}
            hint="The site gets this niche's source group. English and Arabic sites of a niche share it."
          >
            <select id="niche_id" name="niche_id" defaultValue={website?.niche_id ?? ""} className={inputClass}>
              <option value="">None</option>
              {niches.map((niche) => (
                <option key={niche.id} value={niche.id}>
                  {niche.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Topic" htmlFor="topic" error={errors.topic}>
            <input
              id="topic"
              name="topic"
              defaultValue={website?.topic ?? ""}
              className={inputClass}
              placeholder="e.g. Gulf business news"
            />
          </Field>
          <Field label="Audience" htmlFor="audience" error={errors.audience}>
            <input
              id="audience"
              name="audience"
              defaultValue={website?.audience ?? ""}
              className={inputClass}
              placeholder="Who the site is written for"
            />
          </Field>
        </div>
      </Card>

      <Card icon={Palette} title="Branding" description="Used by the site templates and article illustrations.">
        <div className="grid gap-5 md:grid-cols-3">
          <Field label="Tagline" htmlFor="brand_tagline" error={errors.brand_tagline}>
            <input
              id="brand_tagline"
              name="brand_tagline"
              dir={language === "ar" ? "rtl" : "ltr"}
              defaultValue={branding.tagline ?? ""}
              className={inputClass}
            />
          </Field>
          <BrandColourPicker value={color} onChange={setColor} error={errors.brand_primary_color} />
          <LogoUpload
            key={logoInputKey}
            currentUrl={branding.logo_url}
            removed={logoRemoved}
            onFileChange={setLogoFile}
            onRemove={setLogoRemoved}
            error={errors.brand_logo}
          />
        </div>
      </Card>

      <Card
        icon={Plug}
        title="WordPress connection"
        description="Create an application password in WordPress under Users → Profile → Application Passwords, for a user with the Editor role."
      >
        <div className="grid gap-5 md:grid-cols-3">
          <Field label="WordPress URL" htmlFor="wp_base_url" error={errors.wp_base_url}>
            <input
              id="wp_base_url"
              name="wp_base_url"
              type="url"
              required
              defaultValue={website?.wp_base_url}
              className={inputClass}
              placeholder="https://example.com"
            />
          </Field>
          <Field label="WordPress username" htmlFor="wp_username" error={errors.wp_username}>
            <input
              id="wp_username"
              name="wp_username"
              required
              autoComplete="off"
              defaultValue={website?.wp_username}
              className={inputClass}
            />
          </Field>
          <Field
            label="Application password"
            htmlFor="wp_app_password"
            error={errors.wp_app_password}
            hint={isNew ? "Stored encrypted and never shown again." : "Leave empty to keep the saved password."}
          >
            <input
              id="wp_app_password"
              name="wp_app_password"
              type="password"
              autoComplete="new-password"
              required={isNew}
              className={`${inputClass} font-mono`}
              placeholder={isNew ? "xxxx xxxx xxxx xxxx xxxx xxxx" : "••••••••"}
            />
          </Field>
        </div>
      </Card>

      <Card
        icon={ChartLine}
        title="Google Analytics and Search Console"
        description="Optional. Add the service account's email as a Viewer on the GA4 property and as a user on the Search Console property."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="GA4 property ID"
            htmlFor="ga4_property_id"
            error={errors.ga4_property_id}
            hint="Numbers only: GA4 → Admin → Property details."
          >
            <input
              id="ga4_property_id"
              name="ga4_property_id"
              inputMode="numeric"
              defaultValue={website?.ga4_property_id ?? ""}
              className={`${inputClass} font-mono`}
              placeholder="412345678"
            />
          </Field>
          <Field
            label="Search Console property"
            htmlFor="search_console_site"
            error={errors.search_console_site}
            hint="sc-domain:example.com for a domain property, or https://example.com/ for a URL prefix."
          >
            <input
              id="search_console_site"
              name="search_console_site"
              dir="ltr"
              defaultValue={website?.search_console_site ?? ""}
              className={`${inputClass} font-mono`}
              placeholder="sc-domain:example.com"
            />
          </Field>
        </div>
      </Card>

      <Card
        icon={CalendarClock}
        title="Publishing and automation"
        description="Automation starts paused. Manual articles are never limited by these settings."
      >
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Publishing timezone" htmlFor="timezone" error={errors.timezone}>
            <select
              id="timezone"
              name="timezone"
              defaultValue={website?.timezone ?? DEFAULT_TIMEZONE}
              className={inputClass}
            >
              {timezones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </Field>
          <PublishingTimesPicker
            initialTimes={website ? website.publish_times : DEFAULT_PUBLISH_TIMES}
            error={errors.publish_times}
          />
          <Field
            label="Monthly AI spending limit (USD)"
            htmlFor="monthly_ai_budget_usd"
            error={errors.monthly_ai_budget_usd}
            hint="Automation stops when the estimate reaches this."
          >
            <div className="relative">
              <span
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
              >
                $
              </span>
              <input
                id="monthly_ai_budget_usd"
                name="monthly_ai_budget_usd"
                type="number"
                min="0"
                step="0.01"
                defaultValue={website?.monthly_ai_budget_usd ?? 0}
                className={`${inputClass} pl-7 tabular-nums`}
              />
            </div>
          </Field>
          <Field
            label="Automation mode"
            htmlFor="automation_mode"
            error={errors.automation_mode}
            className="md:col-span-2"
          >
            <select
              id="automation_mode"
              name="automation_mode"
              defaultValue={website?.automation_mode ?? "review"}
              className={inputClass}
            >
              <option value="review">Review: every automated article is approved first</option>
              <option value="off">Off: no automated articles</option>
              <option value="automatic">
                Automatic: drafts in auto-publish categories skip review when every check passes
              </option>
            </select>
          </Field>
          <Field
            label="AI model"
            htmlFor="ai_model"
            error={errors.ai_model}
            hint="Leave empty to use the network default."
          >
            <input
              id="ai_model"
              name="ai_model"
              defaultValue={website?.ai_model ?? ""}
              className={`${inputClass} font-mono`}
              placeholder="Network default"
            />
          </Field>
        </div>
        <div className="mt-5">
          <CheckboxLabel name="auto_select_stories" defaultChecked={website?.auto_select_stories ?? false}>
            Automatically select recent stories to fill the review buffer
          </CheckboxLabel>
          <p className="mt-1 mb-4 text-xs text-muted-foreground">
            Off by default. Prefers official, recent and widely reported stories, avoids duplicates and limits each
            source to two stories per run. Unselecting cancels its job and prevents automatic reselection.
          </p>
          <CheckboxLabel name="generate_illustrations" defaultChecked={website?.generate_illustrations ?? false}>
            Generate AI illustrations for automated articles{" "}
            <span className="text-muted-foreground">(each needs approval)</span>
          </CheckboxLabel>
        </div>
      </Card>

      <Card
        icon={Users}
        title="Editors"
        description="Editors only see the websites they are assigned to. Administrators see every website."
      >
        {editors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No editors yet. Invite them from the Users page.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {editors.map((editor) => (
              <CheckboxLabel
                key={editor.id}
                name="editor_ids"
                value={editor.id}
                defaultChecked={assignedEditorIds.includes(editor.id)}
              >
                <span className="block truncate font-medium">{editor.full_name || editor.email}</span>
                {editor.full_name ? (
                  <span className="block truncate text-xs text-muted-foreground">{editor.email}</span>
                ) : null}
              </CheckboxLabel>
            ))}
          </div>
        )}
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex justify-end border-t bg-background/85 px-4 py-3 backdrop-blur-lg sm:mx-0 sm:rounded-xl sm:border sm:px-4">
        <SubmitButton className="w-full sm:w-auto" pendingLabel={isNew ? "Adding website…" : "Saving…"}>
          {isNew ? "Add website and test connection" : "Save settings"}
        </SubmitButton>
      </div>
    </form>
  );
}
