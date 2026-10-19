"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { syncNicheWebsite } from "@/lib/niche-sync";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFrom, nicheCategorySchema } from "@/lib/validation";

async function applyCategories(db, nicheId) {
  const { data: websites, error } = await db.from("websites").select("id").eq("niche_id", nicheId);
  if (error) return error.message;
  const errors = [];
  for (const website of websites) {
    const syncError = await syncNicheWebsite(db, website.id);
    if (syncError) errors.push(`${website.id}: ${syncError}`);
  }
  revalidatePath("/websites", "layout");
  return errors.length ? errors.join("; ") : null;
}

export async function saveNicheCategory(nicheId, categoryId, _prev, formData) {
  const user = await requireAdmin();
  const parsed = nicheCategorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };
  const db = await createClient();
  const { archived, ...fields } = parsed.data;
  const input = { ...fields, archived_at: archived ? new Date().toISOString() : null };
  const query = categoryId
    ? db.from("niche_categories").update(input).eq("id", categoryId).eq("niche_id", nicheId)
    : db.from("niche_categories").insert({ ...input, niche_id: nicheId });
  const { data, error } = await query.select("id").maybeSingle();
  if (error) return { error: error.code === "23505" ? "That slug is already used for this language" : error.message };
  if (!data) return { error: "Category not found" };
  const syncError = await applyCategories(db, nicheId);
  await recordAudit({
    action: categoryId ? "niche_category.edited" : "niche_category.added",
    entityType: "niche_category",
    entityId: data.id,
    actorId: user.id,
    details: { niche_id: nicheId, ...parsed.data, sync_error: syncError },
  });
  revalidatePath("/niches");
  return syncError
    ? { error: `Category saved, but some websites could not be synced: ${syncError}` }
    : {
        ok: true,
        message:
          "Category saved. On each website, click Categories → Sync with WordPress. Existing website edits are kept.",
      };
}

export async function applyNicheCategories(nicheId, _prev, _formData) {
  const user = await requireAdmin();
  const db = await createClient();
  const syncError = await applyCategories(db, nicheId);
  await recordAudit({
    action: "niche.applied_to_websites",
    entityType: "niche",
    entityId: nicheId,
    actorId: user.id,
    details: { sync_error: syncError },
  });
  revalidatePath("/niches");
  return syncError
    ? { error: syncError }
    : { ok: true, message: "Applied to websites. Open each website's Categories card and click Sync with WordPress." };
}
