import { RelativeTime } from "@/components/relative-time";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card, PageHeader } from "@/components/ui";
import { AlertEmailsForm } from "./alerts-form";
import { NetworkSettingsForm, ModelPriceForm } from "./settings-form";
import { StrictChecksForm } from "./strict-checks-form";

export const metadata = { title: "Network settings" };
export default async function NetworkPage() {
  await requireAdmin();
  const db = await createClient();
  const [{ data: settings, error }, { data: prices, error: priceError }, { data: alerts }] = await Promise.all([
    db.from("network_settings").select("*").single(),
    db.from("ai_model_prices").select("*").order("model"),
    db.from("alerts").select("id, message, created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Network settings"
        description="AI model defaults, estimated spending limits, model prices and alert emails."
      />
      {error || priceError ? (
        <Alert tone="error">
          Automation settings are unavailable. Apply the pending automation migrations before using this page.
        </Alert>
      ) : (
        <>
          <Card title="AI controls">
            <NetworkSettingsForm settings={settings} />
          </Card>
          <Card title="Draft checks">
            {settings.strict_draft_checks === undefined ? (
              <Alert tone="warning">Apply migration 40_strict_draft_checks.sql to configure blocking checks.</Alert>
            ) : (
              <StrictChecksForm checks={settings.strict_draft_checks} />
            )}
          </Card>
          <Card
            title="Alerts"
            description="Checked every 15 minutes. One email per new problem: AI spend at 80% and 100% of a monthly limit, skipped or failed publishing slots, articles that failed to publish twice, and failed AI drafts."
          >
            {settings.alert_emails === undefined ? (
              <Alert tone="warning">Apply migration 35_alerts.sql to set up alert emails.</Alert>
            ) : (
              <AlertEmailsForm emails={settings.alert_emails} />
            )}
            <Link
              href="/network/alerts?website=all"
              className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
            >
              View all alerts
            </Link>
            {alerts?.length ? (
              <ul className="mt-6 space-y-2 border-t pt-4 text-sm">
                <li className="font-medium">Recently sent</li>
                {alerts.map((alert) => (
                  <li key={alert.id}>
                    <span className="text-muted-foreground">
                      <RelativeTime value={alert.created_at} timezone="UTC" />
                    </span>{" "}
                    {alert.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
          <Card
            title="Model price estimates"
            description="Gemini reports how much each call used, not what it cost. The dashboard multiplies usage by these prices to estimate spending, enforce the monthly limits and record cost per article. A model cannot run until it has prices here."
          >
            <p className="mb-4 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
              Copy the prices from Google&apos;s Gemini API pricing page (paid tier). Example: with input at $0.30 and
              output at $2.50 per million tokens, a call that sends 20,000 tokens and gets 2,000 back costs about 20,000
              × 0.30 / 1,000,000 + 2,000 × 2.50 / 1,000,000 = $0.011. Keep the prices up to date; Google&apos;s bill is
              the real cost.
            </p>
            <div className="space-y-4">
              {prices.map((price) => (
                <ModelPriceForm key={price.model} price={price} />
              ))}
              <ModelPriceForm />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
