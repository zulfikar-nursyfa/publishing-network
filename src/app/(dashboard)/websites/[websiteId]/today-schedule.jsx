import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Badge, Card, formatDateTime, linkClass } from "@/components/ui";
import { localDate, slotsOn } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";

const SLOT_TONE = { published: "green", skipped: "amber", failed: "red", running: "purple" };

/** Today's automated publishing slots for a website, and the articles people have scheduled. */
export async function TodaySchedule({ website }) {
  const supabase = await createClient();
  const now = new Date();
  const slots = slotsOn(localDate(now, website.timezone), website.publish_times, website.timezone);

  const [{ data: network }, { data: handled }, { data: scheduled }] = await Promise.all([
    supabase.from("network_settings").select("automation_paused").maybeSingle(),
    slots.length
      ? supabase.from("publish_slots").select("slot_at, status, note, article_id").eq("website_id", website.id).gte("slot_at", slots[0].toISOString())
      : Promise.resolve({ data: [] }),
    supabase
      .from("articles")
      .select("id, title, scheduled_for")
      .eq("website_id", website.id)
      .eq("status", "approved")
      .gte("scheduled_for", now.toISOString())
      .order("scheduled_for")
      .limit(5),
  ]);
  const handledAt = new Map((handled ?? []).map((row) => [new Date(row.slot_at).toISOString(), row]));
  const automationOff = website.automation_paused || website.automation_mode === "off" || network?.automation_paused;

  return (
    <div className="mb-8 grid gap-4 lg:grid-cols-2">
      <Card icon={CalendarClock} title="Today's publishing slots" description={`Times in ${website.timezone}.`}>
        {slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No publishing times are set for this website.</p>
        ) : (
          <>
            {automationOff ? (
              <p className="mb-3 text-sm text-amber-700 dark:text-amber-300">
                Automation is {network?.automation_paused ? "paused for the whole network" : website.automation_mode === "off" ? "off" : "paused"}, so slots do not run. Scheduled articles still publish.
              </p>
            ) : null}
            <ul className="divide-y text-sm">
              {slots.map((slot, index) => {
                const row = handledAt.get(slot.toISOString());
                return (
                  <li key={slot.toISOString()} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                    <span className="w-12 font-mono text-xs tabular-nums">{website.publish_times[index].slice(0, 5)}</span>
                    <div className="min-w-0 flex-1 truncate text-muted-foreground">
                      {row?.article_id ? (
                        <Link href={`/articles/${row.article_id}`} className={linkClass}>View article</Link>
                      ) : (
                        row?.note
                      )}
                    </div>
                    {row ? (
                      <Badge tone={SLOT_TONE[row.status]} dot>{row.status}</Badge>
                    ) : (
                      <Badge dot>{slot > now ? "upcoming" : "not run"}</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      <Card icon={CalendarClock} title="Scheduled articles" description="Approved articles set to publish at a chosen time.">
        {scheduled && scheduled.length > 0 ? (
          <ul className="divide-y text-sm">
            {scheduled.map((article) => (
              <li key={article.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <Link href={`/articles/${article.id}`} dir={website.text_direction} className={`${linkClass} min-w-0 truncate`}>{article.title}</Link>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(article.scheduled_for, website.timezone)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing scheduled. Approved articles without a schedule wait for the next slot.</p>
        )}
      </Card>
    </div>
  );
}
