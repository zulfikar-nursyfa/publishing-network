"use server";

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFrom, networkSchema, slugify } from "@/lib/validation";

export async function addNetwork(_prev, formData) {
  const user = await requireAdmin();
  const parsed = networkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };
  const slug = slugify(parsed.data.name);
  if (!slug) return { error: "Use a name with Latin letters", fieldErrors: { name: "Use Latin letters" } };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("networks")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: network, error } = await supabase
    .from("networks")
    .insert({ ...parsed.data, slug, sort_order: (last?.sort_order ?? 0) + 1 })
    .select("id")
    .single();
  if (error) return { error: error.code === "23505" ? "That network already exists" : error.message };

  await recordAudit({
    action: "site_network.added",
    entityType: "site_network",
    entityId: network.id,
    actorId: user.id,
    details: { name: parsed.data.name, kind: parsed.data.kind },
  });
  revalidatePath("/niches");
  return { ok: true, message: "Network added." };
}

/** Shared rules are read by the drafting steps, so they apply from the next research, draft or fact-check step. */
export async function updateNetwork(networkId, _prev, formData) {
  const user = await requireAdmin();
  const parsed = networkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("networks")
    .update(parsed.data)
    .eq("id", networkId)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.code === "23505" ? "Another network has that name" : error.message };
  if (!data) return { error: "Network not found" };

  await recordAudit({
    action: "site_network.edited",
    entityType: "site_network",
    entityId: networkId,
    actorId: user.id,
    details: {
      name: parsed.data.name,
      kind: parsed.data.kind,
      rules_en: Boolean(parsed.data.rules_en),
      rules_ar: Boolean(parsed.data.rules_ar),
    },
  });
  revalidatePath("/niches");
  return { ok: true, message: "Network saved." };
}
