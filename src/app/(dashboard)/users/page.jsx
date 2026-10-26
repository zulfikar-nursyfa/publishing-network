import { ListToolbar } from "@/components/list-controls";
import { ListResults } from "@/components/list-results";
import { allRows, listContext, readList } from "@/lib/lists";
import { userList } from "@/lib/list-configs";
import { ShieldCheck, UserPlus } from "lucide-react";
import { removeUser, setUserRole, setUserWebsites } from "@/app/actions/users";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import {
  Avatar,
  Badge,
  Card,
  PageHeader,
  SectionHeading,
  checkboxClass,
  cn,
  formatDateTime,
  inputClass,
} from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./invite-form";

export const metadata = { title: "Users" };

export default async function UsersPage({ searchParams }) {
  const currentUser = await requireAdmin();
  const supabase = await createClient();

  const { state, websites } = await listContext(supabase, await searchParams, userList);
  const result = await readList(
    () =>
      supabase
        .from("profiles")
        .select(state.website !== "all" ? "*, website_members!inner(website_id)" : "*", { count: "exact" }),
    state,
  );
  const profiles = result.data;
  const members = profiles.length
    ? await allRows(() =>
        supabase
          .from("website_members")
          .select("user_id, website_id")
          .in(
            "user_id",
            profiles.map((profile) => profile.id),
          )
          .order("user_id")
          .order("website_id"),
      )
    : [];

  const websitesByUser = new Map();
  for (const member of members ?? []) {
    if (!websitesByUser.has(member.user_id)) websitesByUser.set(member.user_id, new Set());
    websitesByUser.get(member.user_id).add(member.website_id);
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Super administrators can also change roles and remove users. Administrators manage every website. Editors only see the websites assigned to them."
      />

      <Card
        icon={UserPlus}
        className="mb-10"
        title="Invite a user"
        description="They receive an email with a link to choose their password."
      >
        <InviteForm websites={websites ?? []} />
      </Card>

      <ListToolbar path="/users" state={state} websites={websites} searchLabel="Search name or email" />
      <SectionHeading title="Team" description={`${result.count ?? 0} member${profiles?.length === 1 ? "" : "s"}`} />
      <ListResults
        result={result}
        path="/users"
        state={state}
        title="No team members"
        empty="Invite a user using the form above."
      >
        <ul className="divide-y overflow-hidden rounded-lg bg-card">
          {(profiles ?? []).map((profile) => {
            const assigned = websitesByUser.get(profile.id) ?? new Set();
            const isSelf = profile.id === currentUser.id;
            const name = profile.full_name || profile.email;
            const isAdmin = profile.role === "admin" || profile.role === "superadmin";
            return (
              <li
                key={profile.id}
                className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:gap-8"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={name} className="size-10 text-sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate font-medium">{name}</span>
                      {isSelf ? <Badge>you</Badge> : null}
                    </div>
                    {profile.full_name ? (
                      <div className="truncate text-sm text-muted-foreground">{profile.email}</div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone={isAdmin ? "purple" : "gray"}>
                        {isAdmin ? <ShieldCheck className="size-3" /> : null}
                        {profile.role}
                      </Badge>
                      <span className="text-xs text-muted-foreground">Joined {formatDateTime(profile.created_at)}</span>
                    </div>
                    {currentUser.isSuperadmin && !isSelf ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <ActionForm action={setUserRole.bind(null, profile.id)} className="flex items-center gap-2">
                          <select
                            name="role"
                            aria-label={`Role for ${name}`}
                            defaultValue={profile.role}
                            className={cn(inputClass, "w-36")}
                          >
                            <option value="editor">Editor</option>
                            <option value="admin">Administrator</option>
                            <option value="superadmin">Super administrator</option>
                          </select>
                          <SubmitButton
                            variant="secondary"
                            size="sm"
                            confirm={`Change the role of ${name}?`}
                            confirmLabel="Change role"
                          >
                            Save role
                          </SubmitButton>
                        </ActionForm>
                        <ActionForm action={removeUser.bind(null, profile.id)}>
                          <SubmitButton
                            variant="danger-outline"
                            size="sm"
                            confirm={`Remove ${name}? They lose access immediately. This cannot be undone.`}
                            confirmLabel="Remove user"
                          >
                            Remove
                          </SubmitButton>
                        </ActionForm>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">Websites</div>
                  {isAdmin ? (
                    <p className="text-sm text-muted-foreground">Administrators have access to all websites.</p>
                  ) : (websites ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No websites yet.</p>
                  ) : (
                    <ActionForm action={setUserWebsites.bind(null, profile.id)} className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {(websites ?? []).map((site) => (
                          <label
                            key={site.id}
                            className="flex cursor-pointer items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm transition-colors hover:bg-muted has-checked:border-primary/40 has-checked:bg-accent has-checked:text-accent-foreground"
                          >
                            <input
                              type="checkbox"
                              name="website_ids"
                              value={site.id}
                              defaultChecked={assigned.has(site.id)}
                              className={checkboxClass}
                            />
                            {site.name}
                          </label>
                        ))}
                      </div>
                      <SubmitButton
                        variant="secondary"
                        size="sm"
                        pendingLabel="Saving…"
                        confirm="Save website assignments? Unchecked websites will be removed from this editor’s access."
                        confirmLabel="Save assignments"
                      >
                        Save websites
                      </SubmitButton>
                    </ActionForm>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </ListResults>
    </>
  );
}
