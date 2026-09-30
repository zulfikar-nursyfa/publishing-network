"use server";

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
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

export async function setUserRole(userId, role) {
  const admin = await requireAdmin();
  if (userId === admin.id && role !== "admin") return; // Administrators cannot demote themselves.
  await createAdminClient().from("profiles").update({ role }).eq("id", userId);
  await recordAudit({ action: "user.role_changed", entityType: "user", entityId: userId, actorId: admin.id, details: { role } });
  revalidatePath("/users");
}

export async function setUserWebsites(userId, formData) {
  const admin = await requireAdmin();
  const db = createAdminClient();
  const wanted = new Set(
    formData.getAll("website_ids").filter((value) => typeof value === "string" && value !== ""),
  );
  const { data: existing } = await db.from("website_members").select("website_id").eq("user_id", userId);
  const current = new Set((existing ?? []).map((row) => row.website_id));
  const toRemove = [...current].filter((id) => !wanted.has(id));
  const toAdd = [...wanted].filter((id) => !current.has(id));

  if (toRemove.length > 0) await db.from("website_members").delete().eq("user_id", userId).in("website_id", toRemove);
  if (toAdd.length > 0) await db.from("website_members").insert(toAdd.map((websiteId) => ({ website_id: websiteId, user_id: userId })));

  await recordAudit({
    action: "user.websites_changed",
    entityType: "user",
    entityId: userId,
    actorId: admin.id,
    details: { added: toAdd, removed: toRemove },
  });
  revalidatePath("/users");
}
