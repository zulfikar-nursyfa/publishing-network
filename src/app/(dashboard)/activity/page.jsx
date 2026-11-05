import { PageHeader } from "@/components/ui";
import { ListToolbar } from "@/components/list-controls";
import { ListResults } from "@/components/list-results";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { allRows, listContext, readList } from "@/lib/lists";
import { activityList } from "@/lib/list-configs";
import { ActivityEntry } from "./activity-entry";

/** Splits a newest-or-oldest-first page into days in the user's time zone; one unlabelled group otherwise. */
function groups(entries, timezone) {
  if (!timezone) return [{ key: "all", label: null, entries }];
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const label = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const today = day.format(new Date());
  const yesterday = day.format(new Date(Date.now() - 86_400_000));
  const result = [];
  for (const entry of entries) {
    const key = day.format(new Date(entry.created_at));
    if (result.at(-1)?.key !== key)
      result.push({
        key,
        label: key === today ? "Today" : key === yesterday ? "Yesterday" : label.format(new Date(entry.created_at)),
        entries: [],
      });
    result.at(-1).entries.push(entry);
  }
  return result;
}

export const metadata = { title: "Activity" };
export default async function ActivityPage({ searchParams }) {
  await requireUser();
  const db = await createClient();
  const { state, websites, timezone } = await listContext(db, await searchParams, activityList);
  const [actors, result] = await Promise.all([
    allRows(() => db.from("profiles").select("id, email, full_name").order("id")),
    readList(
      () => {
        let query = db.from("audit_log").select("*", { count: "exact" });
        if (state.area !== "all") query = query.like("action", `${state.area}%`);
        return query;
      },
      state,
      timezone,
    ),
  ]);
  const actorName = new Map(actors.map((actor) => [actor.id, actor.full_name || actor.email]));
  const websiteName = new Map(websites.map((site) => [site.id, site.name]));
  return (
    <>
      <PageHeader
        title="Activity"
        description={`Who did what across the websites you can access. Times use ${timezone}.`}
      />
      <ListToolbar
        path="/activity"
        state={state}
        websites={websites}
        choices={{
          actor: [
            { value: "all", label: "All actors" },
            ...actors.map((actor) => ({ value: actor.id, label: actor.full_name || actor.email })),
          ],
        }}
      />
      <ListResults
        result={result}
        path="/activity"
        state={state}
        title="No activity recorded yet"
        empty="Administrative and publishing actions appear here."
      >
        <div className="overflow-hidden rounded-lg border bg-card">
          {groups(result.data, state.sort === "created" ? timezone : null).map((group) => (
            <section key={group.key} aria-label={group.label ?? undefined}>
              {group.label ? (
                <h2 className="sticky top-0 z-10 border-b bg-muted/80 px-4 py-2 text-xs font-semibold text-muted-foreground backdrop-blur sm:px-5">
                  {group.label}
                </h2>
              ) : null}
              <ul className="divide-y">
                {group.entries.map((entry) => (
                  <ActivityEntry
                    key={entry.id}
                    entry={entry}
                    actor={entry.actor_id ? (actorName.get(entry.actor_id) ?? "Unknown user") : null}
                    website={websiteName.get(entry.website_id)}
                    timezone={timezone}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </ListResults>
    </>
  );
}
