import { dateBounds, escapeLike, searchOr } from "./list-params";

/** Small configuration lists also page through PostgREST, rather than silently truncating at 1,000. */
export async function allRows(makeQuery) {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await makeQuery().range(from, from + 499);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

export function applyListQuery(query, state, timezone = "UTC") {
  const config = state.config;
  if (state.q && config.search?.length)
    query =
      config.search.length === 1
        ? query.ilike(config.search[0], `%${escapeLike(state.q)}%`)
        : query.or(searchOr(config.search, state.q));
  for (const [key, filter] of Object.entries(config.filters ?? {})) {
    if (!filter.column || state[key] === "all") continue;
    query = query.eq(filter.column, state[key] === "yes" ? true : state[key] === "no" ? false : state[key]);
  }
  if (config.dateColumn) {
    const bounds = dateBounds(state, timezone);
    if (bounds.from) query = query.gte(config.dateColumn, bounds.from);
    if (bounds.to) query = query.lt(config.dateColumn, bounds.to);
  }
  query = query.order(config.sorts[state.sort], { ascending: state.direction === "asc", nullsFirst: false });
  const tie = config.tie ?? "id";
  if (tie !== config.sorts[state.sort]) query = query.order(tie, { ascending: true });
  return query;
}

export async function readList(makeQuery, state, timezone = "UTC") {
  const run = () =>
    applyListQuery(makeQuery(), state, timezone).range((state.page - 1) * state.size, state.page * state.size - 1);
  let result = await run();
  if (!result.error) {
    const last = Math.max(1, Math.ceil((result.count ?? 0) / state.size));
    if (state.page > last) {
      state.page = last;
      result = await run();
    }
  }
  return { ...result, data: result.data ?? [] };
}
