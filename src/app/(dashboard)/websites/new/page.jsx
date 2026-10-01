import { createWebsite } from "@/app/actions/websites";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TIMEZONES } from "@/lib/validation";
import { WebsiteForm } from "../website-form";

export const metadata = { title: "Add website" };

export default async function NewWebsitePage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: editors } = await supabase.from("profiles").select("id, email, full_name").eq("role", "editor").order("email");

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={{ href: "/websites", label: "Websites" }}
        title="Add website"
        description="Connect a WordPress site that is already installed. Install the Publishing Network connector plugin on it first (see docs/wordpress-setup.md)."
      />
      <WebsiteForm action={createWebsite} editors={editors ?? []} timezones={TIMEZONES} />
    </div>
  );
}
