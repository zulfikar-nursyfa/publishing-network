import { serverEnv } from "@/lib/env";
import { connectorSource, connectorVersion } from "@/lib/wordpress/connector-package";

// Public: every connected WordPress site polls this (about twice a day) to find connector updates.
export async function GET() {
  const appUrl = serverEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  const version = connectorVersion(await connectorSource(appUrl));
  return Response.json(
    { version, package: `${appUrl}/api/connector/download?v=${version}` },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
