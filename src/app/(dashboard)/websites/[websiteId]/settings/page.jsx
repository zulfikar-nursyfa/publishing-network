import { updateWebsite } from "@/app/actions/websites";
import { Alert, PageHeader } from "@/components/ui";
import { requireWebsite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TIMEZONES } from "@/lib/validation";
import { WebsiteForm } from "../../website-form";
import { CategoriesCard } from "./categories-card";
import { SourcesCard } from "./sources-card";
import { AutomationCard, ConnectionCard } from "./status-cards";

export default async function WebsiteSettingsPage({ params, searchParams }) {
  const { websiteId } = await params;
  const { user, website } = await requireWebsite(websiteId);
  const query = await searchParams;
  const created = query.created === "1";
  const supabase = await createClient();

  const [sources, categories, members, editors, niches] = await Promise.all([
    supabase.from("content_sources").select("*").eq("website_id", websiteId).order("name"),
    supabase.from("categories").select("*").eq("website_id", websiteId).order("sort_order").order("name"),
    supabase.from("website_members").select("user_id").eq("website_id", websiteId),
    user.isAdmin
      ? supabase.from("profiles").select("id, email, full_name").eq("role", "editor").order("email")
      : Promise.resolve({ data: [] }),
    supabase.from("niches").select("id, name").order("sort_order"),
  ]);
  const niche = niches.data?.find((row) => row.id === website.niche_id);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        back={{ href: `/websites/${websiteId}`, label: website.name }}
        title={user.isAdmin ? "Website settings" : "Website details"}
        description={`Connection, automation and sources for ${website.name}.`}
      />

      {created ? (
        <Alert tone="success" title="Website added" className="mb-6">
          Check the connection result below before publishing. In Categories, click Sync with WordPress to create any
          niche categories.
        </Alert>
      ) : null}
      {query.niche_sync === "failed" ? (
        <Alert tone="error" className="mb-6">
          Website added, but niche sources/categories could not be copied. Apply the pending migrations, then use Niches
          → Apply to websites.
        </Alert>
      ) : null}

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <ConnectionCard website={website} />
        <AutomationCard website={website} isAdmin={user.isAdmin} />
      </div>

      <SourcesCard website={website} sources={sources.data ?? []} niche={niche} isAdmin={user.isAdmin} />
      <CategoriesCard websiteId={websiteId} categories={categories.data ?? []} isAdmin={user.isAdmin} />

      {user.isAdmin ? (
        <>
          <h2 className="mt-10 mb-4 text-lg font-semibold tracking-tight">Edit website</h2>
          <WebsiteForm
            action={updateWebsite.bind(null, websiteId)}
            website={website}
            editors={editors.data ?? []}
            assignedEditorIds={(members.data ?? []).map((member) => member.user_id)}
            timezones={TIMEZONES}
            niches={niches.data ?? []}
          />
        </>
      ) : null}
    </div>
  );
}
