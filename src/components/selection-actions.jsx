"use client";
import { useEffect, useRef, useState } from "react";
import { useActionStateWithNotice } from "./form-controls";
import { checkboxClass } from "./ui";

export function SelectionActions({ id, name, action, children, clearOnSuccess = false }) {
  const [state, submit] = useActionStateWithNotice(action, {});
  const [count, setCount] = useState(0);
  const all = useRef(null);
  useEffect(() => {
    if (clearOnSuccess && state.ok)
      document.querySelectorAll(`input[name="${name}"][form="${id}"]`).forEach((input) => {
        input.checked = false;
      });
    const sync = () => {
      const fields = [...document.querySelectorAll(`input[name="${name}"][form="${id}"]`)];
      const checked = fields.filter((input) => input.checked).length;
      setCount(checked);
      all.current.indeterminate = checked > 0 && checked < fields.length;
      all.current.checked = fields.length > 0 && checked === fields.length;
    };
    sync();
    document.addEventListener("change", sync);
    return () => document.removeEventListener("change", sync);
  }, [id, name, state, clearOnSuccess]);
  return (
    <div className="mb-3 space-y-2">
      <form id={id} action={submit} className="flex min-h-11 flex-wrap items-center gap-3">
        <label className="inline-flex min-h-11 items-center gap-2 text-sm">
          <input
            ref={all}
            type="checkbox"
            className={checkboxClass}
            onChange={(event) => {
              const fields = [...document.querySelectorAll(`input[name="${name}"][form="${id}"]`)];
              fields.forEach((input) => {
                input.checked = event.target.checked;
              });
              setCount(event.target.checked ? fields.length : 0);
              event.target.indeterminate = false;
            }}
          />
          Select page
        </label>
        {count > 0 ? (
          <div
            className="flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2"
            role="group"
            aria-label="Selected rows"
          >
            <span className="mr-2 text-sm font-medium tabular-nums" role="status">
              {count} selected
            </span>
            {children}
          </div>
        ) : null}
      </form>
    </div>
  );
}
