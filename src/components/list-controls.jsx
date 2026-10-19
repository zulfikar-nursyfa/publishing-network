import { ListLink as Link } from "./list-link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { EmptyState, Th, buttonClass, inputClass, cn } from "./ui";
import { listHref, clearListHref, PAGE_SIZES } from "@/lib/list-params";
import { ListForm, DateFilters } from "./list-form";

function HiddenState({ state, except = [] }) {
  return Object.keys(state.defaults)
    .filter((key) => !except.includes(key) && key !== "page")
    .map((key) => <input key={key} type="hidden" name={key} value={state[key]} />);
}

export function ListToolbar({ path, state, websites = [], choices = {}, searchLabel = "Search" }) {
  const fields = Object.entries(state.config.filters ?? {}).filter(([, filter]) => !filter.hidden);
  return (
    <div className="mb-5 space-y-3">
      <ListForm
        key={listHref(path, state)}
        path={path}
        website={state.website}
        className="rounded-xl border bg-card p-3 sm:p-4"
      >
        <HiddenState
          state={state}
          except={["q", "sort", "direction", "period", "from", "to", ...fields.map(([key]) => key)]}
        />
        <div className="grid min-w-0 grid-cols-2 items-end gap-3 xl:grid-cols-4">
          {state.config.search?.length ? (
            <label className="col-span-2 min-w-0 space-y-1 text-xs font-medium">
              {searchLabel}
              <input
                type="search"
                name="q"
                defaultValue={state.q}
                maxLength={200}
                placeholder={searchLabel}
                className={inputClass}
              />
            </label>
          ) : null}
          <label className="min-w-0 space-y-1 text-xs font-medium">
            Sort by
            <select name="sort" defaultValue={state.sort} className={inputClass}>
              {Object.keys(state.config.sorts).map((key) => (
                <option key={key} value={key}>
                  {key.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 space-y-1 text-xs font-medium">
            Direction
            <select name="direction" defaultValue={state.direction} className={inputClass}>
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
        </div>
        {fields.length || state.config.dateColumn ? (
          <details
            open={fields.some(([key, filter]) => state[key] !== (filter.default ?? "all")) || state.period !== "all"}
            className="rounded-lg border p-3"
          >
            <summary className="cursor-pointer text-sm font-medium">Filters</summary>
            <div className="mt-3 grid min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {fields.map(([key, filter]) => {
                const items =
                  key === "website"
                    ? [
                        { value: "all", label: "All websites" },
                        ...websites.map((site) => ({ value: site.id, label: site.name })),
                      ]
                    : (choices[key] ?? filter.options ?? [{ value: "all", label: "All" }]);
                return (
                  <label key={key} className="min-w-0 space-y-1 text-xs font-medium">
                    {filter.label}
                    {filter.text ? (
                      <input
                        name={key}
                        defaultValue={state[key]}
                        maxLength={filter.max ?? 200}
                        className={inputClass}
                      />
                    ) : (
                      <select name={key} defaultValue={state[key]} className={inputClass}>
                        {items.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </label>
                );
              })}
              {state.config.dateColumn ? <DateFilters period={state.period} from={state.from} to={state.to} /> : null}
            </div>
          </details>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <p className="text-xs text-muted-foreground">
            Selections apply automatically. Press Enter or Apply to search.
          </p>
          <button type="submit" className={buttonClass("secondary", "w-full sm:w-auto")}>
            Apply
          </button>
        </div>
      </ListForm>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {state.q ? (
          <Link
            className="max-w-full break-words rounded-full border px-2 py-1"
            href={listHref(path, state, { q: "" })}
          >
            Search: {state.q} ×
          </Link>
        ) : null}
        {fields
          .filter(([key, filter]) => state[key] !== (filter.default ?? "all"))
          .map(([key, filter]) => (
            <Link
              key={key}
              className="max-w-full break-words rounded-full border px-2 py-1"
              href={listHref(path, state, { [key]: filter.default ?? "all" })}
            >
              {filter.label}:{" "}
              {(key === "website"
                ? websites.find((site) => site.id === state[key])?.name
                : (choices[key] ?? filter.options)?.find((item) => item.value === state[key])?.label) ??
                state[key]}{" "}
              ×
            </Link>
          ))}
        {state.period !== "all" ? (
          <Link
            className="max-w-full break-words rounded-full border px-2 py-1"
            href={listHref(path, state, { period: "all", from: "", to: "" })}
          >
            Dates: {state.period} {state.period === "custom" ? `${state.from}–${state.to}` : ""} ×
          </Link>
        ) : null}
        {state.filtered ? (
          <Link className="font-medium text-primary underline" href={clearListHref(path, state)}>
            Clear all
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function SortTh({ path, state, column, children, className }) {
  const active = state.sort === column;
  const Icon = active ? (state.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <Th className={className} aria-sort={active ? (state.direction === "asc" ? "ascending" : "descending") : "none"}>
      <Link
        className="inline-flex items-center gap-1 rounded focus-visible:outline-2 focus-visible:outline-ring"
        href={listHref(path, state, { sort: column, direction: active && state.direction === "asc" ? "desc" : "asc" })}
      >
        {children}
        <Icon aria-hidden className="size-3" />
      </Link>
    </Th>
  );
}

export function Pagination({ path, state, count }) {
  const pages = Math.max(1, Math.ceil(count / state.size));
  return (
    <nav
      aria-label="Pagination"
      className="mt-4 grid min-w-0 grid-cols-1 items-center gap-3 text-sm sm:flex sm:flex-wrap sm:justify-between"
    >
      <span className="text-muted-foreground">
        Showing {count ? (state.page - 1) * state.size + 1 : 0}–{Math.min(state.page * state.size, count)} of {count} ·
        Page {state.page} of {pages}
      </span>
      <ListForm
        key={listHref(path, state)}
        path={path}
        className="[&_fieldset]:flex [&_fieldset]:items-center [&_fieldset]:gap-2 [&_fieldset]:space-y-0"
      >
        <HiddenState state={state} except={["size"]} />
        <label className="whitespace-nowrap text-xs text-muted-foreground" htmlFor="list-size">
          Rows per page
        </label>
        <select
          id="list-size"
          name="size"
          defaultValue={state.size}
          className={cn(inputClass, "w-24 min-w-24 shrink-0 pr-9")}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size}>{size}</option>
          ))}
        </select>
      </ListForm>
      <div className="flex items-center justify-between gap-2 sm:justify-start">
        {state.page > 1 ? (
          <Link className={buttonClass("secondary", "", "sm")} href={listHref(path, state, { page: state.page - 1 })}>
            Previous
          </Link>
        ) : (
          <span aria-disabled="true" className="px-3 py-2 text-muted-foreground">
            Previous
          </span>
        )}
        {state.page < pages ? (
          <Link className={buttonClass("secondary", "", "sm")} href={listHref(path, state, { page: state.page + 1 })}>
            Next
          </Link>
        ) : (
          <span aria-disabled="true" className="px-3 py-2 text-muted-foreground">
            Next
          </span>
        )}
      </div>
    </nav>
  );
}

export function ListEmpty({ path, state, title = "Nothing here yet", children }) {
  return (
    <EmptyState
      title={state.filtered ? "No results for these filters" : title}
      action={
        state.filtered ? (
          <Link href={clearListHref(path, state)} className={buttonClass("secondary")}>
            Clear filters
          </Link>
        ) : undefined
      }
    >
      {state.filtered ? "Try a different search or remove a filter." : children}
    </EmptyState>
  );
}
