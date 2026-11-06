"use client";

import { Suspense, use, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { CornerDownLeft, FilePlus2, Globe, Search, Settings2 } from "lucide-react";
import { cn } from "@/components/ui";

/** Matches every word of the query against the item's label and keywords. */
export function matches(item, query) {
  const text = `${item.label} ${item.group} ${item.keywords ?? ""}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
}

function isTyping(target) {
  return (
    target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

/** Opens with Ctrl/⌘ + K, or "/" outside a text field. */
export function useCommandShortcut(setOpen) {
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((open) => !open);
      } else if (event.key === "/" && !event.metaKey && !event.ctrlKey && !isTyping(event.target)) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
}

/**
 * Jump to any page, website or action by typing. `pages` are {href, label, icon, group};
 * `websites` is a promise of {id, name} so the list never delays the page.
 */
export function CommandMenu({ open, onOpenChange, pages, actions, websites }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-[12vh] left-1/2 z-50 flex max-h-[70vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl data-[state=open]:animate-zoom-in"
        >
          <Dialog.Title className="sr-only">Go to a page or action</Dialog.Title>
          <Suspense
            fallback={<Palette pages={pages} actions={actions} sites={[]} onDone={() => onOpenChange(false)} />}
          >
            <WithWebsites pages={pages} actions={actions} websites={websites} onDone={() => onOpenChange(false)} />
          </Suspense>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function WithWebsites({ websites, ...props }) {
  return <Palette {...props} sites={use(websites)} />;
}

function Palette({ pages, actions, sites, onDone }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef(null);

  const items = useMemo(
    () => [
      ...pages,
      ...actions,
      ...sites.flatMap((site) => [
        { href: `/websites/${site.id}`, label: site.name, group: "Websites", icon: Globe, keywords: "site" },
        {
          href: `/websites/${site.id}/settings`,
          label: `${site.name} settings`,
          group: "Websites",
          icon: Settings2,
          keywords: "sources categories connection",
        },
        {
          href: `/websites/${site.id}/articles/new`,
          label: `New article on ${site.name}`,
          group: "Websites",
          icon: FilePlus2,
          keywords: "write create draft manual",
        },
      ]),
    ],
    [pages, actions, sites],
  );
  // Without a query: pages, actions and website names; guide pages and per-website shortcuts need a search.
  const visible = query.trim()
    ? items.filter((item) => matches(item, query)).slice(0, 50)
    : items
        .filter((item) => item.group !== "Guide" && !(item.group === "Websites" && /\/(settings|new)$/.test(item.href)))
        .slice(0, 50);
  const current = Math.min(active, Math.max(visible.length - 1, 0));

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  function choose(item) {
    if (!item) return;
    onDone();
    if (item.run) item.run();
    else router.push(item.href);
  }

  function onKeyDown(event) {
    const last = visible.length - 1;
    const moves = {
      ArrowDown: current + 1,
      ArrowUp: current - 1,
      Home: 0,
      End: last,
      PageDown: current + 8,
      PageUp: current - 8,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActive(Math.max(0, Math.min(last, moves[event.key])));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(visible[current]);
    }
  }

  let lastGroup = null;
  return (
    <>
      <div className="flex items-center gap-3 border-b px-4">
        <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={visible.length ? `${listId}-${current}` : undefined}
          aria-label="Search pages, websites and actions"
          placeholder="Search pages, websites and actions…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="h-13 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
        />
        <kbd className="hidden rounded border px-1.5 py-0.5 text-[0.7rem] text-muted-foreground sm:block">Esc</kbd>
      </div>
      <ul ref={listRef} id={listId} role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto p-2">
        {visible.map((item, index) => {
          const heading = item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          const Icon = item.icon;
          return (
            <li key={`${item.group}-${item.href ?? item.label}`} role="presentation">
              {heading ? (
                <div role="presentation" className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                  {heading}
                </div>
              ) : null}
              <div
                id={`${listId}-${index}`}
                data-index={index}
                role="option"
                aria-selected={index === current}
                onMouseMove={() => setActive(index)}
                onClick={() => choose(item)}
                className={cn(
                  "flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2.5 text-sm",
                  index === current && "bg-muted text-foreground",
                )}
              >
                {Icon ? <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" /> : null}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {index === current ? <CornerDownLeft aria-hidden className="size-3.5 text-muted-foreground" /> : null}
              </div>
            </li>
          );
        })}
        {visible.length === 0 ? (
          <li role="presentation" className="px-3 py-8 text-center text-sm text-muted-foreground">
            Nothing matches “{query}”.
          </li>
        ) : null}
      </ul>
      <div className="hidden items-center gap-4 border-t px-4 py-2 text-xs text-muted-foreground sm:flex">
        <span>
          <kbd className="font-sans">↑ ↓</kbd> to move
        </span>
        <span>
          <kbd className="font-sans">Enter</kbd> to open
        </span>
        <span className="ml-auto">
          Open anywhere with <kbd className="font-sans">Ctrl/⌘ K</kbd> or <kbd className="font-sans">/</kbd>
        </span>
      </div>
    </>
  );
}
