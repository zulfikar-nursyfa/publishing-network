import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireUser } from "@/lib/auth";

export async function GET() {
  await requireUser();
  const plugin = await readFile(path.join(process.cwd(), "wordpress/mu-plugins/publishing-network.php"));
  return new Response(plugin, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="publishing-network.php"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
