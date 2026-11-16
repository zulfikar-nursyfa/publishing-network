import { serverEnv } from "@/lib/env";
import { connectorSource, connectorZip } from "@/lib/wordpress/connector-package";

// Public: WordPress downloads updates without a dashboard login. The plugin holds no secrets.
export async function GET() {
  const zip = connectorZip(await connectorSource(serverEnv().NEXT_PUBLIC_APP_URL));
  return new Response(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="publishing-network.zip"',
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
