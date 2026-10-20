import { RedirectNotice } from "@/components/action-notice";
import { z } from "zod";
import { updateWebsite } from "@/app/actions/websites";
import { Alert, PageHeader, FilterTabs } from "@/components/ui";
import { ListToolbar, Pagination, ListEmpty } from "@/components/list-controls";
import { WebsiteNav } from "@/components/website-nav";
import { requireWebsite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { allRows, readList } from "@/lib/lists";
import { parseListParams } from "@/lib/list-params";
import { sourceList, categoryList } from "@/lib/list-configs";
import { TIMEZONES } from "@/lib/validation";
import { WebsiteForm } from "../../website-form";
import { CategoriesCard } from "./categories-card";
import { SourcesCard } from "./sources-card";
import { AutomationCard, ConnectionCard } from "./status-cards";

const sections = ["overview", "sources", "categories", "website"];
export default async function WebsiteSettingsPage({ params, searchParams }) {
  const { websiteId } = await params;
  const { user, website } = await requireWebsite(websiteId);
  const input = await searchParams;
  const section = z.enum(sections).catch("overview").parse(input.section);
  const db = await createClient();
  const path = `/websites/${websiteId}/settings`;
  const { data: niche } = website.niche_id
    ? await db.from("niches").select("id, name").eq("id", website.niche_id).maybeSingle()
    : { data: null };
  const config = section === "categories" ? categoryList : sourceList;
  const state = parseListParams(input, {
    ...config,
    filters: {
      ...config.filters,
      section: {
        label: "Section",
        options: sections.map((value) => ({ value, label: value })),
        default: "overview",
        hidden: true,
      },
    },
  });
  const result = ["sources", "categories"].includes(section)
    ? await readList(
        () => {
          let query = db
            .from(section === "sources" ? "content_sources" : "categories")
            .select("*", { count: "exact" })
            .eq("website_id", websiteId);
          if (section === "sources" && state.errors === "errors") query = query.not("last_error", "is", null);
          if (section === "categories" && state.archived !== "all")
            query = state.archived === "yes" ? query.not("archived_at", "is", null) : query.is("archived_at", null);
          return query;
        },
        state,
        website.timezone,
      )
    : { data: [], count: 0 };
  const [editors, members, niches] =
    section === "website" && user.isAdmin
      ? await Promise.all([
          allRows(() => db.from("profiles").select("id, email, full_name").eq("role", "editor").order("id")),
          allRows(() => db.from("website_members").select("user_id").eq("website_id", websiteId).order("user_id")),
          allRows(() => db.from("niches").select("id, name").order("sort_order").order("id")),
        ])
      : [[], [], []];
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        back={{ href: `/websites/${websiteId}`, label: website.name }}
        title={user.isAdmin ? "Website settings" : "Website details"}
        description={`Connection, automation and sources for ${website.name}.`}
      />
      <WebsiteNav websiteId={websiteId} active="settings" />
      <FilterTabs
        active={section}
        items={sections
          .filter((key) => key !== "website" || user.isAdmin)
          .map((key) => ({ key, label: key === "website" ? "Edit website" : key, href: `${path}?section=${key}` }))}
      />
      {input.created === "1" ? (
        <RedirectNotice
          params={["created", "niche_sync"]}
          result={
            input.niche_sync === "failed"
              ? {
                  error:
                    "Website added, but niche sources/categories could not be copied. Apply pending migrations, then use Niches → Apply to websites.",
                }
              : {
                  ok: true,
                  message: "Website added. Check its connection, then open Categories and Sync with WordPress.",
                }
          }
        />
      ) : input.niche_sync === "failed" ? (
        <RedirectNotice
          params={["niche_sync"]}
          result={{
            error:
              "Niche sources/categories could not be copied. Apply pending migrations, then use Niches → Apply to websites.",
          }}
        />
      ) : null}
      {section === "overview" ? (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <ConnectionCard website={website} />
          <AutomationCard website={website} isAdmin={user.isAdmin} />
        </div>
      ) : null}
      {["sources", "categories"].includes(section) ? (
        <>
          <ListToolbar path={path} state={state} searchLabel={`Search ${section}`} />
          {result.error ? (
            <Alert tone="error">
              Could not load {section}: {result.error.message}
            </Alert>
          ) : (
            <>
              {!result.data.length && state.filtered ? <ListEmpty path={path} state={state} /> : null}
              {section === "sources" ? (
                <SourcesCard
                  website={website}
                  sources={result.data}
                  filtered={state.filtered}
                  niche={niche}
                  isAdmin={user.isAdmin}
                />
              ) : (
                <CategoriesCard
                  websiteId={websiteId}
                  categories={result.data}
                  filtered={state.filtered}
                  isAdmin={user.isAdmin}
                />
              )}
              <Pagination path={path} state={state} count={result.count ?? 0} />
            </>
          )}
        </>
      ) : null}
      {section === "website" && user.isAdmin ? (
        <WebsiteForm
          action={updateWebsite.bind(null, websiteId)}
          website={website}
          editors={editors}
          assignedEditorIds={members.map((member) => member.user_id)}
          timezones={TIMEZONES}
          niches={niches}
        />
      ) : null}
    </div>
  );
}
