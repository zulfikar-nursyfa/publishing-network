"use client";

import { useState } from "react";
import { updateAlertMuting } from "@/app/actions/network";
import { Field, inputClass, checkboxClass } from "@/components/ui";
import { useActionStateWithNotice, SubmitButton } from "@/components/form-controls";

export function MutedWebsitesForm({ websites }) {
  const [state, action, pending] = useActionStateWithNotice(updateAlertMuting, {});
  const initial = websites.filter((site) => site.alerts_muted).map((site) => site.id);
  const [muted, setMuted] = useState(initial);
  const [search, setSearch] = useState("");
  const saved = state.mutedIds ?? initial;
  const dirty = muted.length !== saved.length || muted.some((id) => !saved.includes(id));
  const visible = websites.filter((site) => site.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <section className="mt-5 min-w-0 space-y-3 border-t pt-4" aria-labelledby="muted-websites-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <h3 id="muted-websites-heading" className="font-medium">
          Muted websites
        </h3>
        <span className="text-xs text-muted-foreground" role="status">
          {muted.length} {muted.length === 1 ? "website" : "websites"} muted{dirty ? " · Unsaved" : ""}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        All websites send alerts. Mute test sites so their problems are not emailed.
      </p>
      <Field label="Search websites" htmlFor="muted-website-search">
        <input
          id="muted-website-search"
          type="search"
          className={inputClass}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name"
        />
      </Field>
      <form action={action} onReset={(event) => event.preventDefault()} className="space-y-3">
        {muted.map((id) => (
          <input key={id} type="hidden" name="muted_website_ids" value={id} />
        ))}
        <fieldset disabled={pending} aria-label="Website alert muting">
          {visible.length ? (
            <ul className="max-h-64 divide-y overflow-y-auto rounded-lg bg-muted/40 px-3">
              {visible.map((site) => (
                <li key={site.id}>
                  <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5 py-2 text-sm">
                    <input
                      type="checkbox"
                      className={checkboxClass}
                      checked={muted.includes(site.id)}
                      aria-label={`Mute alerts for ${site.name}`}
                      onChange={(event) =>
                        setMuted(event.target.checked ? [...muted, site.id] : muted.filter((id) => id !== site.id))
                      }
                    />
                    <span className="min-w-0 break-words">{site.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
              {websites.length ? "No websites match your search." : "No non-archived websites."}
            </p>
          )}
        </fieldset>
        <SubmitButton disabled={!dirty}>Save muted websites</SubmitButton>
      </form>
    </section>
  );
}
