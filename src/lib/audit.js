import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Records a significant administrative or publishing action. Never throws: a failed audit write
 * is logged but must not undo or block the action it describes.
 */
export async function recordAudit(entry) {
  const { error } = await createAdminClient()
    .from("audit_log")
    .insert({
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      website_id: entry.websiteId ?? null,
      actor_id: entry.actorId ?? null,
      details: (entry.details ?? {}),
    });
  if (error) console.error("audit log write failed", entry.action, error.message);
}
