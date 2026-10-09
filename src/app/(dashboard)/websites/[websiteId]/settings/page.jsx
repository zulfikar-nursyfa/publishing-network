import { Bot, ExternalLink, Plug, Rss, Tags } from "lucide-react";
import { setCategoryArchived } from "@/app/actions/categories";
import {
  addContentSource,
  deleteContentSource,
  setAutomationPaused,
  setContentSourceActive,
  setWebsiteArchived,
  updateContentSource,
  updateWebsite,
} from "@/app/actions/websites";
import { SubmitButton } from "@/components/form-controls";
import { Alert, Badge, Card, ConnectionBadge, DescriptionList, PageHeader, formatDateTime } from "@/components/ui";
import { requireWebsite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPublishTimes } from "@/lib/schedule";
import { SOURCE_KINDS, TIMEZONES } from "@/lib/validation";
import { WebsiteForm } from "../../website-form";
import { AddCategoryForm, SourceForm, SyncCategoriesButton, TestConnectionButton } from "./settings-forms";

export default async function WebsiteSettingsPage({ params, searchParams }) {
  const { websiteId } = await params;
  const { user, website } = await requireWebsite(websiteId);
  const created = (await searchParams).created === "1";
  const supabase = await createClient();

  const [{ data: sources }, { data: categories }, { data: members }, { data: editors }, { data: niches }] = await Promise.all([
    supabase.from("content_sources").select("*").eq("website_id", websiteId).order("name"),
    supabase.from("categories").select("*").eq("website_id", websiteId).order("sort_order").order("name"),
    supabase.from("website_members").select("user_id").eq("website_id", websiteId),
    user.isAdmin
      ? supabase.from("profiles").select("id, email, full_name").eq("role", "editor").order("email")
      : Promise.resolve({ data: [] }),
    supabase.from("niches").select("id, name").order("sort_order"),
  ]);
  const niche = niches?.find((row) => row.id === website.niche_id);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        back={{ href: `/websites/${websiteId}`, label: website.name }}
        title={user.isAdmin ? "Website settings" : "Website details"}
        description={`Connection, automation and sources for ${website.name}.`}
      />

      {created ? (
        <Alert tone="success" title="Website added" className="mb-6">
          Check the connection result below before publishing.
        </Alert>
      ) : null}

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card icon={Plug} title="WordPress connection" actions={<ConnectionBadge status={website.wp_connection_status} />}>
          <DescriptionList
            className="mb-5"
            items={[
              { label: "Site", value: <span className="font-mono text-xs">{website.wp_base_url}</span> },
              { label: "User", value: website.wp_username },
              { label: "Connector", value: website.wp_plugin_version ?? "unknown" },
              { label: "Last checked", value: formatDateTime(website.wp_connection_checked_at, website.timezone) },
            ]}
          />
          {website.wp_connection_error ? (
            <Alert tone={website.wp_connection_status === "failed" ? "error" : "warning"} className="mb-4">
              {website.wp_connection_error}
            </Alert>
          ) : null}
          <TestConnectionButton websiteId={websiteId} />
        </Card>

        <Card icon={Bot} title="Automation" actions={website.automation_paused ? <Badge dot>paused</Badge> : <Badge tone="green" dot>running</Badge>}>
          <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
            {website.automation_mode === "off" || website.daily_quota === 0
              ? "Automation is off or has no publishing times, so it will not create articles even when resumed."
              : `${website.daily_quota} automated article${website.daily_quota === 1 ? "" : "s"} per day at ${formatPublishTimes(website.publish_times)} (${website.timezone}), ${
                  "each reviewed before publishing during the initial rollout"
                }. Manual publishing is unaffected by pausing.`}
          </p>
          {user.isAdmin ? (
            <div className="flex flex-wrap gap-2">
              <form action={setAutomationPaused.bind(null, websiteId, !website.automation_paused)}>
                <SubmitButton variant={website.automation_paused ? "success" : "secondary"}>
                  {website.automation_paused ? "Resume automation" : "Pause automation"}
                </SubmitButton>
              </form>
              <form action={setWebsiteArchived.bind(null, websiteId, !website.archived_at)}>
                <SubmitButton
                  variant={website.archived_at ? "secondary" : "danger-outline"}
                  confirm={website.archived_at ? undefined : "Archive this website? Automation stops and it is hidden from the active list. Nothing is deleted."}
                  confirmLabel="Archive website"
                >
                  {website.archived_at ? "Restore website" : "Archive website"}
                </SubmitButton>
              </form>
            </div>
          ) : null}
        </Card>
      </div>

      <Card icon={Rss} className="mb-6" title="Approved content sources"
        description={niche
          ? `Sources marked "niche" come from the ${niche.name} source group (Niches page) and can only be disabled here. Automation only draws stories from active sources.`
          : "Automation only draws stories from active sources on this list. Choose a niche below to add its source group."}>
        {sources && sources.length > 0 ? (
          <ul className="mb-5 divide-y rounded-lg border">
            {sources.map((source) => (
              <li key={source.id} className="flex flex-col gap-3 p-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 font-medium">
                    {source.name}
                    <Badge>{SOURCE_KINDS[source.kind] ?? source.kind}</Badge>
                    {source.niche_source_id ? <Badge tone="purple">niche</Badge> : null}
                    {source.kind === "newsroom" || source.kind === "government" ? <Badge tone="blue">primary</Badge> : null}
                    {source.images_reusable ? <Badge tone="green">images reusable</Badge> : null}
                    {source.active ? null : <Badge tone="amber">disabled</Badge>}
                  </div>
                  <a href={source.url} target="_blank" rel="noreferrer" className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                    <span className="truncate">{source.url}</span>
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                  {source.attribution_note ? <div className="mt-1 text-xs text-muted-foreground">{source.attribution_note}</div> : null}
                  {user.isAdmin && !source.niche_source_id ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-primary">Edit</summary>
                      <div className="mt-2"><SourceForm saveSource={updateContentSource.bind(null, websiteId, source.id)} source={source} /></div>
                    </details>
                  ) : null}
                  <div className={`mt-1 text-xs ${source.last_error ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                    {!source.feed_url
                      ? "No feed: not used for story discovery"
                      : source.last_error
                        ? `Feed error: ${source.last_error}`
                        : source.last_checked_at
                          ? `Feed checked ${formatDateTime(source.last_checked_at, website.timezone)}`
                          : "Feed not checked yet"}
                  </div>
                </div>
                {user.isAdmin ? (
                  <div className="flex shrink-0 gap-2">
                    <form action={setContentSourceActive.bind(null, websiteId, source.id, !source.active)}>
                      <SubmitButton variant="secondary" size="sm">{source.active ? "Disable" : "Enable"}</SubmitButton>
                    </form>
                    {source.niche_source_id ? null : (
                      <form action={deleteContentSource.bind(null, websiteId, source.id)}>
                        <SubmitButton variant="danger-outline" size="sm" confirm={`Remove ${source.name}?`} confirmLabel="Remove">Remove</SubmitButton>
                      </form>
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-5 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No sources yet.</p>
        )}
        {user.isAdmin ? <SourceForm saveSource={addContentSource.bind(null, websiteId)} /> : null}
      </Card>

      <Card icon={Tags} className="mb-6" title="Categories" description="Editors and the AI choose from active categories. Each one is linked to a WordPress category of the same slug.">
        {categories && categories.length > 0 ? (
          <ul className="mb-5 divide-y rounded-lg border">
            {categories.map((category) => (
              <li key={category.id} className="flex flex-col gap-3 p-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 font-medium">
                    {category.name}
                    <span className="font-mono text-xs font-normal text-muted-foreground">{category.slug}</span>
                    {category.wp_term_id ? null : <Badge tone="amber">not in WordPress</Badge>}
                    {category.archived_at ? <Badge>archived</Badge> : null}
                  </div>
                  {category.description ? <div className="mt-0.5 text-xs text-muted-foreground">{category.description}</div> : null}
                </div>
                {user.isAdmin ? (
                  <form action={setCategoryArchived.bind(null, websiteId, category.id, !category.archived_at)} className="shrink-0">
                    <SubmitButton variant="secondary" size="sm">{category.archived_at ? "Restore" : "Archive"}</SubmitButton>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-5 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No categories yet. Add them here or sync to import the WordPress site&apos;s categories.</p>
        )}
        {user.isAdmin ? (
          <div className="space-y-5">
            <SyncCategoriesButton websiteId={websiteId} />
            <AddCategoryForm websiteId={websiteId} />
          </div>
        ) : null}
      </Card>

      {user.isAdmin ? (
        <>
          <h2 className="mt-10 mb-4 text-lg font-semibold tracking-tight">Edit website</h2>
          <WebsiteForm
            action={updateWebsite.bind(null, websiteId)}
            website={website}
            editors={editors ?? []}
            assignedEditorIds={(members ?? []).map((member) => member.user_id)}
            timezones={TIMEZONES}
            niches={niches ?? []}
          />
        </>
      ) : null}
    </div>
  );
}
