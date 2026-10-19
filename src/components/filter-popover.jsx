"use client";
import { Popover } from "radix-ui";
import { SlidersHorizontal, X } from "lucide-react";
import { useRef, useState } from "react";
import { buttonClass } from "./ui";

export function FilterPopover({ count, children }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  const content = useRef(null);
  const restoreFocus = () => requestAnimationFrame(() => trigger.current?.focus());
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) requestAnimationFrame(() => content.current?.querySelector("select, input")?.focus());
      }}
    >
      <Popover.Trigger asChild>
        <button ref={trigger} type="button" className={buttonClass("secondary")}>
          <SlidersHorizontal aria-hidden />
          Filters{count ? <span className="rounded bg-muted px-1.5 tabular-nums">{count}</span> : null}
        </button>
      </Popover.Trigger>
      <Popover.Content
        ref={content}
        forceMount
        align="end"
        sideOffset={8}
        collisionPadding={16}
        aria-label="Filters"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={restoreFocus}
        className="z-40 w-[min(36rem,calc(100vw-3rem))] max-h-[min(75dvh,var(--radix-popover-content-available-height))] overflow-y-auto rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg data-[state=closed]:hidden"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Filters</h2>
          <Popover.Close aria-label="Close filters" onClick={restoreFocus} className={buttonClass("ghost", "", "icon")}>
            <X />
          </Popover.Close>
        </div>
        <div className="grid min-w-0 grid-cols-1 items-end gap-4 sm:grid-cols-2">{children}</div>
        <div className="mt-4 flex justify-end">
          <button type="submit" className={buttonClass("secondary")}>
            Apply filters
          </button>
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}
