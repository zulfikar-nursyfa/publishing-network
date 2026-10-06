import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card, PageHeader } from "@/components/ui";
import { NetworkSettingsForm, ModelPriceForm } from "./settings-form";

export const metadata = { title: "Network settings" };
export default async function NetworkPage() {
  await requireAdmin();
  const db = await createClient();
  const [{ data: settings, error }, { data: prices, error: priceError }] = await Promise.all([
    db.from("network_settings").select("*").single(), db.from("ai_model_prices").select("*").order("model"),
  ]);
  return <div className="mx-auto max-w-4xl space-y-6">
    <PageHeader title="Network settings" description="AI model defaults, estimated spending limits and model prices." />
    {error || priceError ? <Alert tone="error">Automation settings are unavailable. Apply the pending automation migrations before using this page.</Alert> : <>
      <Card title="AI controls"><NetworkSettingsForm settings={settings} /></Card>
      <Card title="Model price estimates" description="Standard text generation only. Keep these rates current with provider pricing; provider billing is authoritative. A model needs a price entry before it can run.">
        <div className="space-y-4">{prices.map((price) => <ModelPriceForm key={price.model} price={price} />)}<ModelPriceForm /></div>
      </Card>
    </>}
  </div>;
}
