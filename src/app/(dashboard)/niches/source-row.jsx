"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { buttonClass, cn } from "@/components/ui";

/** A source's details and actions on one line; the edit form opens full width underneath. */
export function SourceRow({ details, actions, children }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="p-3 text-sm sm:px-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">{details}</div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className={buttonClass("secondary", "gap-1", "sm")}
          >
            {open ? "Close" : "Edit"}
            <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", open && "rotate-180")} />
          </button>
          {actions}
        </div>
      </div>
      {open ? <div className="mt-3">{children}</div> : null}
    </li>
  );
}
