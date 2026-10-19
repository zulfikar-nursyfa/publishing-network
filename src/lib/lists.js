import "server-only";
import { cookies } from "next/headers";
import { parseListParams, websitePreference } from "./list-params";

import { allRows } from "./list-query";
export { allRows, readList, applyListQuery } from "./list-query";

export const WEBSITE_COOKIE = "pn-list-website";

export async function listContext(db, input, config) {
  const websites = await allRows(() =>
    db.from("websites").select("id, name, timezone, text_direction, archived_at").order("name").order("id"),
  );
  const remembered = (await cookies()).get(WEBSITE_COOKIE)?.value;
  const state = parseListParams(websitePreference(input, config, websites, remembered), config);
  const website = websites.find((site) => site.id === state.website);
  return { state, websites, website, timezone: website?.timezone ?? "UTC" };
}
