import { z } from "zod";

export const PAGE_SIZES = [25, 50, 100];
const integer = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(1_000_000));
const day = z.iso.date().refine((value) => value >= "1900-01-01" && value <= "9998-12-31");
const parse = (schema, value, fallback) => {
  const result = schema.safeParse(value);
  return result.success ? result.data : fallback;
};
export const options = (...values) => values.map((value) => ({ value, label: value.replaceAll("_", " ") }));
export const uuidFilter = (label, column = "website_id") => ({ label, column, uuid: true, default: "all" });
export const enumFilter = (label, values, column, fallback = "all") => ({
  label,
  options: options(...values),
  column,
  default: fallback,
});

export function parseListParams(input, config) {
  if (config.legacyArchived && input.status === undefined && parse(z.enum(["0", "1"]), input.archived, "0") === "1")
    input = { ...input, status: "archived" };
  const defaults = {
    page: 1,
    size: 25,
    sort: config.defaultSort,
    direction: config.defaultDirection ?? "desc",
    q: "",
    period: "all",
    from: "",
    to: "",
  };
  const values = {
    page: parse(integer, input.page, 1),
    size: parse(z.enum(["25", "50", "100"]).transform(Number), input.size, 25),
    sort: parse(z.enum(Object.keys(config.sorts)), input.sort, defaults.sort),
    direction: parse(z.enum(["asc", "desc"]), input.direction, defaults.direction),
    q: parse(z.string().trim().max(200), input.q, ""),
    period: parse(z.enum(["all", "today", "48h", "7d", "30d", "custom"]), input.period, "all"),
    from: parse(day, input.from, ""),
    to: parse(day, input.to, ""),
  };
  for (const [key, filter] of Object.entries(config.filters ?? {})) {
    defaults[key] = filter.default ?? "all";
    const schema = filter.text
      ? z
          .string()
          .trim()
          .max(filter.max ?? 200)
          .regex(filter.pattern ?? /^[\s\S]*$/)
      : filter.uuid
        ? z.union([z.uuid(), z.literal("all")])
        : z.enum(filter.options.map((item) => item.value));
    values[key] = parse(schema, input[key], defaults[key]);
  }
  if (values.from && values.to && values.from > values.to) values.from = values.to = "";
  if (!config.search?.length) values.q = "";
  if (!config.dateColumn) {
    values.period = "all";
    values.from = values.to = "";
  }
  if (values.period === "custom" && !values.from && !values.to) values.period = "all";
  return {
    ...values,
    defaults,
    config,
    filtered: Boolean(
      values.q ||
      values.period !== "all" ||
      Object.entries(config.filters ?? {}).some(
        ([key]) => !["section", "month", "type"].includes(key) && values[key] !== defaults[key],
      ),
    ),
  };
}

/** Only whitelisted state is preserved. Filter, search, sort and size changes reset pagination. */
export function listHref(path, state, patch = {}) {
  const next = { ...state, ...patch };
  if (Object.keys(patch).some((key) => key !== "page")) next.page = 1;
  const query = new URLSearchParams();
  for (const [key, fallback] of Object.entries(state.defaults)) {
    const value = next[key];
    if (value !== "" && value !== undefined && (value !== fallback || key === "website")) query.set(key, String(value));
  }
  return `${path}${query.size ? `?${query}` : ""}`;
}

/** Clear filters while retaining the current section, reporting month and traffic tab. */
export function clearListHref(path, state) {
  const context = Object.fromEntries(
    ["section", "month", "type"].filter((key) => key in state.defaults).map((key) => [key, state[key]]),
  );
  return listHref(path, state, { ...state.defaults, website: "all", ...context });
}

export const escapeLike = (value) => value.replace(/[\\%_]/g, (character) => `\\${character}`);
export const searchOr = (columns, text) =>
  columns
    .map((column) => `${column}.ilike."%${escapeLike(text).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}%"`)
    .join(",");

const calendarDay = (date, timezone) => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type).value).join("-");
};
const shiftDay = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

/** Find the first instant of a local date, including days when DST skips midnight. */
export function startOfDay(date, timezone) {
  let low = Date.parse(`${date}T00:00:00Z`) - 36 * 3600000;
  let high = low + 72 * 3600000;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (calendarDay(new Date(middle), timezone) < date) low = middle + 1;
    else high = middle;
  }
  return new Date(low).toISOString();
}

export function dateBounds(state, timezone = "UTC", now = new Date()) {
  if (state.period === "all") return {};
  if (state.period === "48h")
    return { from: new Date(now.getTime() - 48 * 3600000).toISOString(), to: now.toISOString() };
  const today = calendarDay(now, timezone);
  const custom = state.period === "custom";
  const from = custom ? state.from : shiftDay(today, state.period === "7d" ? -6 : state.period === "30d" ? -29 : 0);
  const to = custom ? state.to : today;
  return {
    ...(from ? { from: startOfDay(from, timezone) } : {}),
    ...(to ? { to: startOfDay(shiftDay(to, 1), timezone) } : {}),
  };
}

export function sortRows(rows, state) {
  const column = state.config.sorts[state.sort];
  return [...rows].sort((a, b) => {
    const left = a[column],
      right = b[column];
    if (left == null) return right == null ? 0 : 1;
    if (right == null) return -1;
    const result =
      typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right));
    return (
      (state.direction === "asc" ? result : -result) ||
      String(a.id ?? a.name ?? "").localeCompare(String(b.id ?? b.name ?? ""))
    );
  });
}

/** URL choices win; a remembered website is used only while it is still visible to this user. */
export function websitePreference(input, config, websites, remembered) {
  if (Object.hasOwn(input, "website") || !config.filters?.website) return input;
  const preferred = websites.some((site) => site.id === remembered) ? remembered : "all";
  return { ...input, website: preferred };
}
