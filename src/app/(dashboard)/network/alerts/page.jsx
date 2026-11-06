import Link from "next/link";
import { BellRing, CalendarClock, CircleDollarSign, ListChecks, Send, Settings } from "lucide-react";
import { ButtonLink, PageHeader, cn } from "@/components/ui";
import { ListToolbar } from "@/components/list-controls";
import { ListResults } from "@/components/list-results";
import { RelativeTime } from "@/components/relative-time";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listContext, readList } from "@/lib/lists";
import { alertList } from "@/lib/list-configs";

const KINDS = {
  budget: { label: "AI budget", icon: CircleDollarSign, tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  publication: { label: "Publishing", icon: Send, tone: "bg-red-500/10 text-red-700 dark:text-red-300" },
  slot: {
    label: "Publishing slot",
    icon: CalendarClock,
    tone: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
  job: { label: "Draft job", icon: ListChecks, tone: "bg-purple-500/10 text-purple-700 dark:text-purple-300" },
};
const OTHER = { icon: BellRing, tone: "bg-muted text-muted-foreground" };

export const metadata = { title: "Alert history" };
export default async function AlertsPage({ searchParams }) {
  await requireAdmin();
  const db = await createClient();
  const { state, websites, timezone } = await listContext(db, await searchParams, alertList);
  const result = await readList(() => db.from("alerts").select("*", { count: "exact" }), state, timezone);
  const names = new Map(websites.map((site) => [site.id, site.name]));
  return (
    <>
      <PageHeader
        title="Alert history"
        description={`Every problem that was emailed to the alert recipients. Times use ${timezone}.`}
        actions={
          <ButtonLink href="/network#alerts" variant="secondary">
            <Settings />
            Alert settings
          </ButtonLink>
        }
      />
      <ListToolbar path="/network/alerts" state={state} websites={websites} searchLabel="Search alert messages" />
      <ListResults
        result={result}
        path="/network/alerts"
        state={state}
        title="No alerts yet"
        empty="Set recipients in Network settings to receive alerts."
      >
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {result.data.map((alert) => {
            const kind = KINDS[alert.kind] ?? { ...OTHER, label: alert.kind };
            const Icon = kind.icon;
            return (
              <li key={alert.id} className="flex gap-3 px-4 py-3.5 sm:px-5">
                <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", kind.tone)}>
                  <Icon aria-hidden className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p dir="auto" className="text-sm break-words">
                    {alert.message}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-medium">{kind.label}</span>
                    <span aria-hidden>·</span>
                    {alert.website_id ? (
                      <Link href={`/websites/${alert.website_id}`} className="hover:text-foreground hover:underline">
                        {names.get(alert.website_id) ?? "Website"}
                      </Link>
                    ) : (
                      <span>Network</span>
                    )}
                    <span aria-hidden>·</span>
                    <RelativeTime value={alert.created_at} timezone={timezone} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </ListResults>
    </>
  );
}
