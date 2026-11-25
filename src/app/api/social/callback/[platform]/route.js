import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { serverEnv } from "@/lib/env";
import { SOCIAL_OAUTH_COOKIE, socialApps, socialCallbackUrl } from "@/lib/social/apps";
import { redditConnect } from "@/lib/social/reddit";
import { xAccessToken } from "@/lib/social/x";
import { createAdminClient } from "@/lib/supabase/admin";

// X and Reddit send the person back here after they approve (or cancel) the connection.
export async function GET(request, { params }) {
  const { platform } = await params;
  const query = new URL(request.url).searchParams;
  const store = await cookies();
  const raw = store.get(SOCIAL_OAUTH_COOKIE)?.value;
  store.delete({ name: SOCIAL_OAUTH_COOKIE, path: "/api/social" });

  let pending = null;
  try {
    pending = raw ? JSON.parse(decryptSecret(raw)) : null;
  } catch {
    pending = null;
  }
  if (!pending || pending.platform !== platform || pending.expiresAt < Date.now()) {
    return back(null, "expired");
  }
  const user = await requireUser();
  if (!user.isAdmin || user.id !== pending.userId) return back(pending.websiteId, "other_user");

  const app = socialApps()[platform];
  let connected;
  try {
    if (platform === "x") {
      if (query.get("denied") || query.get("oauth_token") !== pending.token)
        return back(pending.websiteId, "cancelled");
      connected = await xAccessToken(app, pending, query.get("oauth_verifier") ?? "");
    } else {
      if (query.get("error") || query.get("state") !== pending.state) return back(pending.websiteId, "cancelled");
      connected = await redditConnect(app, query.get("code") ?? "", socialCallbackUrl("reddit"));
    }
  } catch (error) {
    return failed(pending, user, error instanceof Error ? error.message : String(error));
  }

  const { error } = await createAdminClient()
    .from("social_accounts")
    .upsert({
      website_id: pending.websiteId,
      platform,
      account_name: connected.accountName,
      subreddit: platform === "reddit" ? pending.subreddit : null,
      credentials_encrypted: encryptSecret(JSON.stringify(connected.credentials)),
      last_error: null,
      connected_by: user.id,
      connected_at: new Date().toISOString(),
    });
  if (error) return failed(pending, user, `Could not save the connection: ${error.message}`);
  await recordAudit({
    action: "website.social_connected",
    entityType: "website",
    entityId: pending.websiteId,
    websiteId: pending.websiteId,
    actorId: user.id,
    details: { platform, account: connected.accountName, subreddit: pending.subreddit ?? null },
  });
  return back(pending.websiteId, "connected");
}

// The settings page shows a fixed message per code, so a crafted link cannot show arbitrary text.
function back(websiteId, code) {
  const url = new URL(websiteId ? `/websites/${websiteId}/settings` : "/websites", serverEnv().NEXT_PUBLIC_APP_URL);
  url.searchParams.set("social", code);
  return NextResponse.redirect(url, 303);
}

/** The platform's error goes to the activity log, where administrators can read it. */
async function failed(pending, user, error) {
  await recordAudit({
    action: "website.social_connect_failed",
    entityType: "website",
    entityId: pending.websiteId,
    websiteId: pending.websiteId,
    actorId: user.id,
    details: { platform: pending.platform, error },
  });
  return back(pending.websiteId, "failed");
}
