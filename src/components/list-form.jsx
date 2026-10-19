"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rememberWebsite } from "@/app/actions/list-preferences";
import { inputClass } from "./ui";

export function ListForm({ path, website, children, className }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <form
      data-list-form
      action={path}
      method="get"
      className={className}
      aria-busy={pending}
      onChange={(event) => {
        const field = event.target;
        if (field.name === "website") {
          for (const name of ["category", "source"]) {
            const dependent = event.currentTarget.elements.namedItem(name);
            if (dependent) dependent.value = "all";
          }
        }
        if (field.tagName === "SELECT" && !(field.name === "period" && field.value === "custom"))
          event.currentTarget.requestSubmit();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        // Snapshot before the cookie action can refresh/remount this form.
        const params = new URLSearchParams(new FormData(event.currentTarget));
        params.delete("page");
        startTransition(async () => {
          const selected = params.get("website");
          if (website !== undefined && selected && selected !== website) {
            try {
              await rememberWebsite(selected);
            } catch {
              // A preference failure must not block URL filtering; server permissions still apply.
            }
          }
          startTransition(() => router.push(`${path}?${params}`, { scroll: false }));
        });
      }}
    >
      <fieldset disabled={pending} className="min-w-0 space-y-3 disabled:opacity-60">
        {children}
      </fieldset>
      <span role="status" className="sr-only">
        {pending ? "Updating results…" : ""}
      </span>
    </form>
  );
}

export function DateFilters({ period, from, to }) {
  const [value, setValue] = useState(period);
  return (
    <>
      <label className="min-w-0 space-y-1 text-xs font-medium">
        Date range
        <select name="period" value={value} onChange={(event) => setValue(event.target.value)} className={inputClass}>
          {[
            ["all", "All dates"],
            ["today", "Today"],
            ["48h", "Last 48 hours"],
            ["7d", "Last 7 days"],
            ["30d", "Last 30 days"],
            ["custom", "Custom dates"],
          ].map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {value === "custom" ? (
        <>
          <label className="min-w-0 space-y-1 text-xs font-medium">
            From
            <input
              type="date"
              name="from"
              defaultValue={from}
              min="1900-01-01"
              max="9998-12-31"
              className={inputClass}
            />
          </label>
          <label className="min-w-0 space-y-1 text-xs font-medium">
            To
            <input type="date" name="to" defaultValue={to} min="1900-01-01" max="9998-12-31" className={inputClass} />
          </label>
        </>
      ) : null}
    </>
  );
}
