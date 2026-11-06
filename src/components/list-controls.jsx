import { ListLink as Link } from "./list-link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { EmptyState, Th, buttonClass, inputClass, cn } from "./ui";
import { listHref, clearListHref, PAGE_SIZES } from "@/lib/list-params";
import { FilterPopover } from "./filter-popover";
import { humanLabel, sortLabel, dateLabels } from "@/lib/list-labels";
import { ListForm, DateFilters } from "./list-form";

export function HiddenState({ state, except = [] }) {
  return Object.keys(state.defaults)
    .filter((key) => !except.includes(key) && key !== "page")
    .map((key) => <input key={key} type="hidden" name={key} value={state[key]} />);
}

export function ListToolbar({ path, state, websites = [], choices = {}, searchLabel = "Search", tabFilter }) {
  const fields = Object.entries(state.config.filters ?? {}).filter(
    ([key, filter]) => !filter.hidden && key !== tabFilter,
  );
  const active = fields.filter(([key, filter]) => state[key] !== (filter.default ?? "all"));
  const count = active.length + (state.period !== "all" ? 1 : 0);
  const itemsFor = (key, filter) =>
    key === "website"
      ? [{ value: "all", label: "All websites" }, ...websites.map((site) => ({ value: site.id, label: site.name }))]
      : (choices[key] ?? filter.options ?? [{ value: "all", label: `All ${filter.label.toLowerCase()}s` }]);
  return (
    <div className="mb-4 space-y-2">
      <ListForm key={listHref(path, state)} path={path}>
        <HiddenState
          state={state}
          except={["q", "sort", "direction", "period", "from", "to", ...fields.map(([key]) => key)]}
        />
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {state.config.search?.length ? (
            <label className="min-w-0 basis-full sm:basis-64 sm:flex-1">
              <span className="sr-only">{searchLabel}</span>
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
          {fields.length || state.config.dateColumn ? (
            <FilterPopover count={count}>
              {fields.map(([key, filter]) => (
                <label key={key} className="min-w-0 space-y-1.5 text-sm font-medium">
                  {filter.label}
                  {filter.text ? (
                    <input name={key} defaultValue={state[key]} maxLength={filter.max ?? 200} className={inputClass} />
                  ) : (
                    <select name={key} aria-label={filter.label} defaultValue={state[key]} className={inputClass}>
                      {itemsFor(key, filter).map((item) => (
                        <option key={item.value} value={item.value}>
                          {humanLabel(item.label)}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
              ))}
              {state.config.dateColumn ? <DateFilters period={state.period} from={state.from} to={state.to} /> : null}
            </FilterPopover>
          ) : null}
          <label className="min-w-0 flex-1 sm:max-w-56">
            <span className="sr-only">Sort results</span>
            <select name="ordering" defaultValue={`${state.sort}:${state.direction}`} className={inputClass}>
              {Object.keys(state.config.sorts).flatMap((key) =>
                ["desc", "asc"].map((direction) => (
                  <option key={`${key}:${direction}`} value={`${key}:${direction}`}>
                    {sortLabel(key, direction, state.config.sorts[key])}
                  </option>
                )),
              )}
            </select>
          </label>
          <button type="submit" className="sr-only">
            Search
          </button>
        </div>
      </ListForm>
      {state.q || count || state.filtered ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {state.q ? (
            <Link
              className="filter-chip"
              aria-label={`Remove search: ${state.q}`}
              href={listHref(path, state, { q: "" })}
            >
              Search: {state.q} ×
            </Link>
          ) : null}
          {active.map(([key, filter]) => (
            <Link
              key={key}
              className="filter-chip"
              aria-label={`Remove ${filter.label} filter`}
              href={listHref(path, state, {
                [key]: filter.default ?? "all",
                ...(key === "website" ? { source: "all", category: "all" } : {}),
              })}
            >
              {filter.label}:{" "}
              {humanLabel(itemsFor(key, filter).find((item) => item.value === state[key])?.label ?? state[key])} ×
            </Link>
          ))}
          {state.period !== "all" ? (
            <Link
              className="filter-chip"
              aria-label="Remove date filter"
              href={listHref(path, state, { period: "all", from: "", to: "" })}
            >
              {state.period === "custom"
                ? `${state.from || "Any start"}–${state.to || "Any end"}`
                : dateLabels[state.period]}{" "}
              ×
            </Link>
          ) : null}
          {state.filtered ? (
            <Link
              className="inline-flex min-h-9 items-center px-1 font-medium underline underline-offset-4"
              href={clearListHref(path, state)}
            >
              Clear all
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SortTh({ path, state, column, children, className }) {
  const active = state.sort === column;
  const Icon = active ? (state.direction === "asc" ? ArrowUp : ArrowDown) : null;
  return (
    <Th className={className} aria-sort={active ? (state.direction === "asc" ? "ascending" : "descending") : "none"}>
      <Link
        className="inline-flex items-center gap-1 rounded focus-visible:outline-2 focus-visible:outline-ring"
        href={listHref(path, state, { sort: column, direction: active && state.direction === "asc" ? "desc" : "asc" })}
      >
        {children}
        {Icon ? <Icon aria-hidden className="size-3" /> : null}
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
