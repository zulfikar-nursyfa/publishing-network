"use server";

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { costEntrySchema, fieldErrorsFrom } from "@/lib/validation";

export async function addCostEntry(_prev, formData) {
  const user = await requireAdmin();
  const parsed = costEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };
  const { month, ...entry } = parsed.data;
  const db = await createClient();
  const { data, error } = await db
    .from("cost_entries")
    .insert({ ...entry, month: `${month}-01`, created_by: user.id })
    .select("id")
    .single();
  if (error) return { error: error.message };
  await recordAudit({
    action: "costs.entry_added",
    entityType: "cost_entry",
    entityId: data.id,
    websiteId: entry.website_id,
    actorId: user.id,
    details: { month, category: entry.category, amount_usd: entry.amount_usd },
  });
  revalidatePath("/costs");
  return { ok: true, message: "Cost added." };
}

export async function deleteCostEntry(entryId) {
  const user = await requireAdmin();
  const db = await createClient();
  const { data } = await db
    .from("cost_entries")
    .delete()
    .eq("id", entryId)
    .select("website_id, month, category, amount_usd");
  if (data?.length) {
    await recordAudit({
      action: "costs.entry_deleted",
      entityType: "cost_entry",
      entityId: entryId,
      websiteId: data[0].website_id,
      actorId: user.id,
      details: data[0],
    });
  }
  revalidatePath("/costs");
}
