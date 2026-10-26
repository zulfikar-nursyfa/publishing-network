import "server-only";
import { parseListParams } from "./list-params";

import { allRows } from "./list-query";
export { allRows, readList, applyListQuery } from "./list-query";

export async function listContext(db, input, config) {
  const websites = await allRows(() =>
    db.from("websites").select("id, name, timezone, text_direction, archived_at").order("name").order("id"),
  );
  const state = parseListParams(input, config);
  const website = websites.find((site) => site.id === state.website);
  return { state, websites, website, timezone: website?.timezone ?? "UTC" };
}
