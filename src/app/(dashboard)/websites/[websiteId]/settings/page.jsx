import Link from "next/link";
import {
  deleteContentSource,
  setAutomationPaused,
  setContentSourceActive,
  setWebsiteArchived,
  updateWebsite,
} from "@/app/actions/websites";
import { SubmitButton } from "@/components/form-controls";
import { Badge, Card, ConnectionBadge, PageHeader, formatDateTime } from "@/components/ui";
import { requireWebsite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TIMEZONES } from "@/lib/validation";
import { WebsiteForm } from "../../website-form";
import { AddSourceForm, TestConnectionButton } from "./settings-forms";

export default async function WebsiteSettingsPage({ params, searchParams }) {
  const { websiteId } = await params;
  const { user, website } = await requireWebsite(websiteId);
  const created = (await searchParams).created === "1";
  const supabase = await createClient();

  const [{ data: sources }, { data: members }, { data: editors }] = await Promise.all([
    supabase.from("content_sources").select("*").eq("website_id", websiteId).order("name"),
    supabase.from("website_members").select("user_id").eq("website_id", websiteId),
    user.isAdmin
      ? supabase.from("profiles").select("id, email, full_name").eq("role", "editor").order("email")
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <>
      <PageHeader
        title={`${website.name}: ${user.isAdmin ? "settings" : "details"}`}
        description={<Link href={`/websites/${websiteId}`} className="underline">Back to articles</Link>}
      />

      {created ? (
        <div className="mb-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Website added. Check the connection result below before publishing.
        </div>
      ) : null}

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card title="WordPress connection" actions={<ConnectionBadge status={website.wp_connection_status} />}>
          <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-gray-500">Site</dt>
            <dd className="truncate">{website.wp_base_url}</dd>
            <dt className="text-gray-500">User</dt>
            <dd>{website.wp_username}</dd>
            <dt className="text-gray-500">Connector</dt>
            <dd>{website.wp_plugin_version ?? "unknown"}</dd>
            <dt className="text-gray-500">Last checked</dt>
            <dd>{formatDateTime(website.wp_connection_checked_at, website.timezone)}</dd>
          </dl>
          {website.wp_connection_error ? (
            <p className={`mb-4 rounded-md px-3 py-2 text-sm ${website.wp_connection_status === "failed" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>
              {website.wp_connection_error}
            </p>
          ) : null}
          <TestConnectionButton websiteId={websiteId} />
        </Card>

        <Card title="Automation" actions={website.automation_paused ? <Badge>paused</Badge> : <Badge tone="green">running</Badge>}>
          <p className="mb-4 text-sm text-gray-600">
            {website.daily_quota === 0
              ? "Daily quota is 0, so automation will not create articles even when resumed."
              : `Up to ${website.daily_quota} automated article${website.daily_quota === 1 ? "" : "s"} per day, each reviewed before publishing. Manual publishing is unaffected by pausing.`}
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
                  variant={website.archived_at ? "secondary" : "danger"}
                  confirm={website.archived_at ? undefined : "Archive this website? Automation stops and it is hidden from the active list. Nothing is deleted."}
                >
                  {website.archived_at ? "Restore website" : "Archive website"}
                </SubmitButton>
              </form>
            </div>
          ) : null}
        </Card>
      </div>

      <Card className="mb-6" title="Approved content sources" description="Automation only draws stories from active sources on this list.">
        {sources && sources.length > 0 ? (
          <ul className="mb-4 divide-y divide-gray-100">
            {sources.map((source) => (
              <li key={source.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">
                    {source.name} <Badge>{source.kind}</Badge> {source.active ? null : <Badge tone="amber">disabled</Badge>}
                  </div>
                  <a href={source.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-gray-500 underline">{source.url}</a>
                  {source.attribution_note ? <div className="text-xs text-gray-500">{source.attribution_note}</div> : null}
                </div>
                {user.isAdmin ? (
                  <div className="flex gap-2">
                    <form action={setContentSourceActive.bind(null, websiteId, source.id, !source.active)}>
                      <SubmitButton variant="secondary">{source.active ? "Disable" : "Enable"}</SubmitButton>
                    </form>
                    <form action={deleteContentSource.bind(null, websiteId, source.id)}>
                      <SubmitButton variant="secondary" confirm={`Remove ${source.name}?`}>Remove</SubmitButton>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-gray-600">No sources yet.</p>
        )}
        {user.isAdmin ? <AddSourceForm websiteId={websiteId} /> : null}
      </Card>

      {user.isAdmin ? (
        <WebsiteForm
          action={updateWebsite.bind(null, websiteId)}
          website={website}
          editors={editors ?? []}
          assignedEditorIds={(members ?? []).map((member) => member.user_id)}
          timezones={TIMEZONES}
        />
      ) : null}
    </>
  );
}
