"use server";

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Network kill switch: stops automation on every website. Manual and scheduled publishing continue. */
export async function setNetworkPaused(paused) {
  const user = await requireAdmin();
  const supabase = await createClient();
  await supabase.from("network_settings").update({ automation_paused: paused, updated_by: user.id }).eq("id", true);
  await recordAudit({
    action: paused ? "network.automation_paused" : "network.automation_resumed",
    entityType: "network",
    actorId: user.id,
  });
  revalidatePath("/", "layout");
}
