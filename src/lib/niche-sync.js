import "server-only";

/** Both RPCs run with the admin user's RLS permissions, preserving per-website category edits. */
export async function syncNicheWebsite(db, websiteId) {
  for (const name of ["sync_niche_sources", "sync_niche_categories"]) {
    const { error } = await db.rpc(name, { target_website: websiteId });
    if (error) return `${name}: ${error.message}`;
  }
  return null;
}
