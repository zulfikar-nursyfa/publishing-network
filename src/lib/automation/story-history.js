import "server-only";

const PAGE_SIZE = 500;

/** Avoid silently ignoring older duplicates when a website grows past Supabase's row limit. */
export async function storyRows(query) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await query().range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not load story history: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}
