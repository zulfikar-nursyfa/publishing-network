import { setUserRole, setUserWebsites } from "@/app/actions/users";
import { SubmitButton } from "@/components/form-controls";
import { Badge, Card, PageHeader, Table, Td, Th, formatDateTime } from "@/components/ui";
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

      <Card className="mb-6" title="Invite a user" description="They receive an email with a link to choose their password.">
        <InviteForm websites={websites ?? []} />
      </Card>

      <Table>
        <thead>
          <tr>
            <Th>User</Th>
            <Th>Role</Th>
            <Th>Websites</Th>
            <Th>Joined</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {(profiles ?? []).map((profile) => {
            const assigned = websitesByUser.get(profile.id) ?? new Set();
            const isSelf = profile.id === currentUser.id;
            return (
              <tr key={profile.id}>
                <Td>
                  <div className="font-medium">{profile.full_name || profile.email}</div>
                  {profile.full_name ? <div className="text-xs text-gray-500">{profile.email}</div> : null}
                </Td>
                <Td>
                  <div className="flex flex-col items-start gap-2">
                    <Badge tone={profile.role === "admin" ? "purple" : "gray"}>{profile.role}</Badge>
                    {!isSelf ? (
                      <form action={setUserRole.bind(null, profile.id, profile.role === "admin" ? "editor" : "admin")}>
                        <SubmitButton
                          variant="secondary"
                          className="px-2 py-1 text-xs"
                          confirm={profile.role === "admin" ? "Remove administrator access?" : "Make this user an administrator with access to every website?"}
                        >
                          {profile.role === "admin" ? "Make editor" : "Make admin"}
                        </SubmitButton>
                      </form>
                    ) : null}
                  </div>
                </Td>
                <Td>
                  {profile.role === "admin" ? (
                    <span className="text-gray-500">All websites</span>
                  ) : (
                    <form action={setUserWebsites.bind(null, profile.id)} className="space-y-2">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {(websites ?? []).map((site) => (
                          <label key={site.id} className="flex items-center gap-1.5">
                            <input type="checkbox" name="website_ids" value={site.id} defaultChecked={assigned.has(site.id)} className="h-4 w-4" />
                            {site.name}
                          </label>
                        ))}
                      </div>
                      {(websites ?? []).length > 0 ? (
                        <SubmitButton variant="secondary" className="px-2 py-1 text-xs">Save websites</SubmitButton>
                      ) : (
                        <span className="text-gray-500">No websites yet</span>
                      )}
                    </form>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-gray-600">{formatDateTime(profile.created_at)}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}
