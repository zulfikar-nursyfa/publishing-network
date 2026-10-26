"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { requireAdmin, requireSuperadmin } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { fieldErrorsFrom, inviteSchema } from "@/lib/validation";

export async function inviteUser(_prev, formData) {
  const admin = await requireAdmin();
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };

  const db = createAdminClient();
  const { data, error } = await db.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { full_name: parsed.data.full_name },
    redirectTo: `${serverEnv().NEXT_PUBLIC_APP_URL}/account/password`,
  });
  if (error || !data.user) return { error: error?.message ?? "Could not send the invitation" };

  // The auth trigger creates the profile as an editor; apply the chosen role and name.
  await db
    .from("profiles")
    .upsert({ id: data.user.id, email: parsed.data.email, full_name: parsed.data.full_name, role: parsed.data.role });

  const websiteIds = formData.getAll("website_ids").filter((value) => typeof value === "string" && value !== "");
  if (websiteIds.length > 0) {
    await db
      .from("website_members")
      .upsert(websiteIds.map((websiteId) => ({ website_id: websiteId, user_id: data.user.id })));
  }

  await recordAudit({
    action: "user.invited",
    entityType: "user",
    entityId: data.user.id,
    actorId: admin.id,
    details: { email: parsed.data.email, role: parsed.data.role, websites: websiteIds },
  });
  revalidatePath("/users");
  return { ok: true, message: `Invitation sent to ${parsed.data.email}.` };
}

export async function setUserRole(userId, formData) {
  const admin = await requireSuperadmin();
  const role = formData.get("role");
  if (
    !z.object({ userId: z.uuid(), role: z.enum(["superadmin", "admin", "editor"]) }).safeParse({ userId, role }).success
  )
    return { error: "Invalid user or role" };
  if (userId === admin.id) return { error: "You cannot change your own role" };
  const { error } = await createAdminClient().from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };
  await recordAudit({
    action: "user.role_changed",
    entityType: "user",
    entityId: userId,
    actorId: admin.id,
    details: { role },
  });
  revalidatePath("/users");
}

export async function removeUser(userId) {
  const admin = await requireSuperadmin();
  if (!z.uuid().safeParse(userId).success) return { error: "Invalid user" };
  if (userId === admin.id) return { error: "You cannot remove yourself" };
  const db = createAdminClient();
  const { data: profile } = await db.from("profiles").select("email").eq("id", userId).maybeSingle();
  if (!profile) return { error: "User not found" };
  // Deleting the auth user cascades to the profile and memberships; authored rows keep a null author.
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  await recordAudit({
    action: "user.removed",
    entityType: "user",
    entityId: userId,
    actorId: admin.id,
    details: { email: profile.email },
  });
  revalidatePath("/users");
  return { ok: true, message: `${profile.email} was removed.` };
}

export async function setUserWebsites(userId, formData) {
  const admin = await requireAdmin();
  const db = createAdminClient();
  const parsed = z
    .object({ userId: z.uuid(), ids: z.array(z.uuid()).max(1000) })
    .safeParse({ userId, ids: formData.getAll("website_ids") });
  if (!parsed.success) return { error: "Choose valid websites" };
  const wanted = new Set(parsed.data.ids);
  const { data: existing } = await db.from("website_members").select("website_id").eq("user_id", userId);
  const current = new Set((existing ?? []).map((row) => row.website_id));
  const toRemove = [...current].filter((id) => !wanted.has(id));
  const toAdd = [...wanted].filter((id) => !current.has(id));

  if (toRemove.length > 0) {
    const { error } = await db.from("website_members").delete().eq("user_id", userId).in("website_id", toRemove);
    if (error) return { error: error.message };
  }
  if (toAdd.length > 0) {
    const { error } = await db
      .from("website_members")
      .insert(toAdd.map((websiteId) => ({ website_id: websiteId, user_id: userId })));
    if (error) return { error: error.message };
  }

  await recordAudit({
    action: "user.websites_changed",
    entityType: "user",
    entityId: userId,
    actorId: admin.id,
    details: { added: toAdd, removed: toRemove },
  });
  revalidatePath("/users");
}
