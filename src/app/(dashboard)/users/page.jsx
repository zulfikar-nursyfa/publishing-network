import { ShieldCheck, UserPlus } from "lucide-react";
import { setUserRole, setUserWebsites } from "@/app/actions/users";
import { SubmitButton } from "@/components/form-controls";
import { Avatar, Badge, Card, PageHeader, SectionHeading, checkboxClass, formatDateTime } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./invite-form";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const currentUser = await requireAdmin();
  const supabase = await createClient();

  const [{ data: profiles }, { data: websites }, { data: members }] = await Promise.all([
    supabase.from("profiles").select("*").order("role").order("email"),
    supabase.from("websites").select("id, name").is("archived_at", null).order("name"),
    supabase.from("website_members").select("user_id, website_id"),
  ]);

  const websitesByUser = new Map();
  for (const member of members ?? []) {
    if (!websitesByUser.has(member.user_id)) websitesByUser.set(member.user_id, new Set());
    websitesByUser.get(member.user_id).add(member.website_id);
  }

  return (
    <>
      <PageHeader title="Users" description="Administrators manage every website. Editors only see the websites assigned to them." />

      <Card icon={UserPlus} className="mb-10" title="Invite a user" description="They receive an email with a link to choose their password.">
        <InviteForm websites={websites ?? []} />
      </Card>

      <SectionHeading title="Team" description={`${profiles?.length ?? 0} member${profiles?.length === 1 ? "" : "s"}`} />
      <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
        {(profiles ?? []).map((profile) => {
          const assigned = websitesByUser.get(profile.id) ?? new Set();
          const isSelf = profile.id === currentUser.id;
          const name = profile.full_name || profile.email;
          return (
            <li key={profile.id} className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:gap-8">
              <div className="flex items-start gap-3">
                <Avatar name={name} className="size-10 text-sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-medium">{name}</span>
                    {isSelf ? <Badge>you</Badge> : null}
                  </div>
                  {profile.full_name ? <div className="truncate text-sm text-muted-foreground">{profile.email}</div> : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone={profile.role === "admin" ? "purple" : "gray"}>
                      {profile.role === "admin" ? <ShieldCheck className="size-3" /> : null}
                      {profile.role}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Joined {formatDateTime(profile.created_at)}</span>
                  </div>
                  {!isSelf ? (
                    <form action={setUserRole.bind(null, profile.id, profile.role === "admin" ? "editor" : "admin")} className="mt-3">
                      <SubmitButton
                        variant="secondary"
                        size="sm"
                        confirm={profile.role === "admin" ? "Remove administrator access?" : "Make this user an administrator with access to every website?"}
                        confirmLabel={profile.role === "admin" ? "Make editor" : "Make admin"}
                      >
                        {profile.role === "admin" ? "Make editor" : "Make admin"}
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>
              </div>

              <div className="min-w-0">
                <div className="mb-2 text-xs font-medium text-muted-foreground">Websites</div>
                {profile.role === "admin" ? (
                  <p className="text-sm text-muted-foreground">Administrators have access to all websites.</p>
                ) : (websites ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No websites yet.</p>
                ) : (
                  <form action={setUserWebsites.bind(null, profile.id)} className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {(websites ?? []).map((site) => (
                        <label
                          key={site.id}
                          className="flex cursor-pointer items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm transition-colors hover:bg-muted has-checked:border-primary/40 has-checked:bg-accent has-checked:text-accent-foreground"
                        >
                          <input type="checkbox" name="website_ids" value={site.id} defaultChecked={assigned.has(site.id)} className={checkboxClass} />
                          {site.name}
                        </label>
                      ))}
                    </div>
                    <SubmitButton variant="secondary" size="sm" pendingLabel="Saving…">Save websites</SubmitButton>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
