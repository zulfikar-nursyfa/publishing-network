import Link from "next/link";
import { ArrowRight, BellRing, Bot, Calculator, ShieldCheck } from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { allRows } from "@/lib/list-query";
import { DRAFT_CHECKS } from "@/lib/automation/strict-checks";
import { Alert, Badge, Card, PageHeader, Stat } from "@/components/ui";
import { AlertEmailsForm } from "./alerts-form";
import { MutedWebsitesForm } from "./muted-websites-form";
import { ModelPriceRow, NetworkSettingsForm, NewModelPrice } from "./settings-form";
import { StrictChecksForm } from "./strict-checks-form";

export const metadata = { title: "Network settings" };

const SECTIONS = [
  { id: "ai", label: "AI controls", icon: Bot },
  { id: "checks", label: "Draft checks", icon: ShieldCheck },
  { id: "alerts", label: "Alerts", icon: BellRing },
  { id: "prices", label: "Model prices", icon: Calculator },
];

export default async function NetworkPage() {
  await requireAdmin();
  const db = await createClient();
  const [
    { data: settings, error },
    { data: prices, error: priceError },
    { data: alerts },
    { data: websites, error: websiteError },
  ] = await Promise.all([
    db.from("network_settings").select("*").single(),
    db.from("ai_model_prices").select("*").order("model"),
    db.from("alerts").select("id, kind, message, created_at").order("created_at", { ascending: false }).limit(3),
    allRows(() =>
      db.from("websites").select("id, name, alerts_muted").is("archived_at", null).order("name").order("id"),
    ).then(
      (data) => ({ data, error: null }),
      (error) => ({ data: [], error }),
    ),
  ]);

  if (error || priceError)
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title="Network settings" />
        <Alert tone="error">
          Automation settings are unavailable. Apply the pending automation migrations before using this page.
        </Alert>
      </div>
    );

  const blocking = settings.strict_draft_checks?.length ?? 0;
  const recipients = settings.alert_emails?.length ?? 0;
  const muted = websites.filter((site) => site.alerts_muted).length;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Network settings"
        description="Defaults and safety limits that apply to every website in the network."
      />

      <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
        <Stat label="Default model" value={settings.default_ai_model || "Deployment default"} hint="AI controls" />
        <Stat
          label="Network AI limit"
          value={settings.monthly_ai_budget_usd === null ? "No limit" : `$${settings.monthly_ai_budget_usd}`}
          hint="per month, on top of website limits"
        />
        <Stat
          label="Blocking draft checks"
          value={`${blocking} of ${DRAFT_CHECKS.length}`}
          hint={blocking ? "the rest show as warnings" : "all show as warnings only"}
        />
        <Stat
          label="Alert recipients"
          value={recipients || "Off"}
          hint={muted ? `${muted} ${muted === 1 ? "website" : "websites"} muted` : "every website sends alerts"}
          alert={!recipients}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[11rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-6 space-y-0.5 text-sm">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Icon aria-hidden className="size-4" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          <Card
            icon={Bot}
            id="ai"
            title="AI controls"
            description="Which model writes drafts by default and how much the whole network may spend."
          >
            <NetworkSettingsForm settings={settings} />
          </Card>

          <Card
            icon={ShieldCheck}
            id="checks"
            title="Draft checks"
            description="Choose which problems stop an AI draft instead of passing it to review with a warning."
          >
            {settings.strict_draft_checks === undefined ? (
              <Alert tone="warning">Apply migration 40_strict_draft_checks.sql to configure blocking checks.</Alert>
            ) : (
              <StrictChecksForm checks={settings.strict_draft_checks} />
            )}
          </Card>

          <Card
            icon={BellRing}
            id="alerts"
            title="Alerts"
            description="Emails about budget, publishing and draft failures. Checked every 15 minutes; one email per new problem."
            actions={
              <Link
                href="/network/alerts?website=all"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                All alerts
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            }
          >
            {settings.alert_emails === undefined ? (
              <Alert tone="warning">Apply migration 35_alerts.sql to set up alert emails.</Alert>
            ) : (
              <AlertEmailsForm key={settings.alert_emails.join(",")} emails={settings.alert_emails} />
            )}
            <div className="mt-5 space-y-3 border-t pt-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                The weekly report is emailed every Monday at 07:00 UTC and covers the previous Monday to Sunday. Alert
                recipients get it too; add people here who want only the weekly report.
              </p>
              {settings.weekly_report_emails === undefined ? (
                <Alert tone="warning">
                  Apply migration 51_weekly_report_recipients.sql to add weekly-only recipients.
                </Alert>
              ) : (
                <AlertEmailsForm
                  key={settings.weekly_report_emails.join(",")}
                  field="weekly_report_emails"
                  emails={settings.weekly_report_emails}
                />
              )}
            </div>
            {websiteError ? (
              <Alert tone="warning" className="mt-5">
                Website alert settings are unavailable. Check that migration 43_website_alerts_muted.sql is applied.
              </Alert>
            ) : (
              <MutedWebsitesForm key={JSON.stringify(websites)} websites={websites} />
            )}
            {alerts?.length ? (
              <div className="mt-5 border-t pt-4">
                <h3 className="text-sm font-medium">Recently sent</h3>
                <ul className="mt-2 divide-y rounded-lg border">
                  {alerts.map((alert) => (
                    <li key={alert.id} className="flex flex-col gap-1 px-3.5 py-2.5 text-sm sm:flex-row sm:gap-3">
                      <span className="flex shrink-0 items-center gap-2 sm:w-44">
                        <Badge tone="amber">{alert.kind}</Badge>
                        <span className="text-xs text-muted-foreground">
                          <RelativeTime value={alert.created_at} timezone="UTC" />
                        </span>
                      </span>
                      <span className="min-w-0 break-words">{alert.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          <Card
            icon={Calculator}
            id="prices"
            title="Model prices"
            description="Gemini reports how much each call used, not what it cost. These prices turn usage into the cost estimates, monthly limits and cost per article. A model cannot run until it has prices here."
          >
            <div className="divide-y overflow-hidden rounded-lg border">
              {prices.map((price) => (
                <ModelPriceRow key={price.model} price={price} />
              ))}
              <NewModelPrice />
            </div>
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                How the estimate is worked out
              </summary>
              <p className="mt-2 rounded-lg bg-muted/60 p-3 text-muted-foreground">
                Copy the prices from Google&apos;s Gemini API pricing page (paid tier). Example: with input at $0.30 and
                output at $2.50 per million tokens, a call that sends 20,000 tokens and gets 2,000 back costs about
                20,000 × 0.30 / 1,000,000 + 2,000 × 2.50 / 1,000,000 = $0.011. Keep the prices up to date; Google&apos;s
                bill is the real cost.
              </p>
            </details>
          </Card>
        </div>
      </div>
    </div>
  );
}
