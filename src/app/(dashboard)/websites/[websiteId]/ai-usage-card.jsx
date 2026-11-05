import { CircleDollarSign } from "lucide-react";
import { Alert, Card } from "@/components/ui";
import { formatUsd, monthStartUtc, summariseAggregatedUsage } from "@/lib/costs";

const STEPS = [
  { key: "search", label: "Web search" },
  { key: "research", label: "Research" },
  { key: "draft", label: "Drafting" },
  { key: "verify", label: "Verification" },
  { key: "illustrate", label: "AI images" },
  { key: "seo", label: "SEO fields (editors)" },
];

/** This month's estimated AI spend for one website, by drafting step and per drafted article. */
export async function AiUsageCard({ supabase, website }) {
  const since = monthStartUtc();
  const [{ data: rows, error }, { count: drafted, error: draftedError }] = await Promise.all([
    supabase.rpc("website_month_usage", { target_website: website.id, target_month: since.slice(0, 10) }),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("website_id", website.id)
      .eq("status", "succeeded")
      .gte("updated_at", since),
  ]);
  if (error || draftedError)
    return (
      <Card title="AI usage this month" className="mb-8">
        <Alert tone="error">
          AI totals could not be loaded. Apply migration 41 or retry. Amounts have not been shown as zero.
        </Alert>
      </Card>
    );
  const usage = summariseAggregatedUsage(rows ?? []);
  const budget = Number(website.monthly_ai_budget_usd);
  const share = budget > 0 ? Math.min(100, (usage.total / budget) * 100) : 0;

  return (
    <Card
      icon={CircleDollarSign}
      title="AI usage this month"
      description="Estimated from token counts and model prices (UTC month). Check provider billing for actual cost."
      className="mb-8"
    >
      <div className="grid gap-6 md:grid-cols-[1fr_1.3fr]">
        <div className="space-y-4">
          <div>
            <div className="text-2xl font-semibold tabular-nums">
              {formatUsd(usage.total)}
              <span className="text-base font-normal text-muted-foreground"> of {formatUsd(budget)}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={share >= 90 ? "h-full bg-red-500" : "h-full bg-primary"} style={{ width: `${share}%` }} />
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Articles drafted</dt>
              <dd className="font-medium tabular-nums">{drafted ?? 0}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Per article</dt>
              <dd className="font-medium tabular-nums">{drafted ? formatUsd(usage.total / drafted) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Searches</dt>
              <dd className="font-medium tabular-nums">{usage.searches}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            Per article divides all spend, failed drafts included, by the articles drafted.
          </p>
        </div>
        <ul className="space-y-2 text-sm">
          {STEPS.map((step) => (
            <li key={step.key} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0">
              <span className="text-muted-foreground">{step.label}</span>
              <span className="tabular-nums">{formatUsd(usage.byOperation[step.key] ?? 0)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
