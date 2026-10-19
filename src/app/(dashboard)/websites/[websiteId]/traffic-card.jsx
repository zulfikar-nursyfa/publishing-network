import { ChartLine, RefreshCw } from "lucide-react";
import { syncWebsiteTraffic } from "@/app/actions/websites";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Alert, Card, formatDateTime } from "@/components/ui";
import { trafficSince, trafficTotals } from "@/lib/traffic/totals";

const number = (value) => new Intl.NumberFormat("en-GB").format(value);

/** Google Analytics and Search Console for the last 28 days. */
export async function TrafficCard({ supabase, website, isAdmin }) {
  const connected = website.ga4_property_id || website.search_console_site;
  const { data: rows } = connected
    ? await supabase.from("website_traffic_daily").select("*").eq("website_id", website.id).gte("day", trafficSince())
    : { data: [] };
  const totals = trafficTotals(rows ?? []);
  const stats = [
    { label: "Sessions", value: website.ga4_property_id ? number(totals.sessions) : "—" },
    { label: "Page views", value: website.ga4_property_id ? number(totals.pageViews) : "—" },
    { label: "Search clicks", value: website.search_console_site ? number(totals.clicks) : "—" },
    { label: "Impressions", value: website.search_console_site ? number(totals.impressions) : "—" },
    { label: "CTR", value: totals.ctr === null ? "—" : `${(totals.ctr * 100).toFixed(1)}%` },
    { label: "Avg. position", value: totals.position === null ? "—" : totals.position.toFixed(1) },
  ];

  return (
    <Card
      icon={ChartLine}
      title="Traffic and search, last 28 days"
      description="Google Analytics and Search Console, updated daily. Search Console runs 2–3 days behind."
      className="mb-8"
      actions={
        connected && isAdmin ? (
          <ActionForm action={syncWebsiteTraffic.bind(null, website.id)}>
            <SubmitButton variant="secondary" size="sm" pendingLabel="Updating…">
              <RefreshCw />
              Update now
            </SubmitButton>
          </ActionForm>
        ) : null
      }
    >
      {!connected ? (
        <p className="text-sm text-muted-foreground">
          Not connected. Add the GA4 property ID and Search Console property in the website settings.
        </p>
      ) : (
        <>
          {website.traffic_error ? (
            <Alert tone="error" title="Last update failed" className="mb-4">
              <span className="block text-xs">{website.traffic_error}</span>
            </Alert>
          ) : null}
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                <dd className="text-lg font-semibold tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            {website.traffic_checked_at
              ? `Last updated ${formatDateTime(website.traffic_checked_at, website.timezone)}`
              : "Not updated yet"}
          </p>
        </>
      )}
    </Card>
  );
}
