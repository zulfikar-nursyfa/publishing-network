"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { requireAdmin, requireWebsite } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { PLATFORM_LABELS, SOCIAL_OAUTH_COOKIE, socialApps, socialCallbackUrl } from "@/lib/social/apps";
import { redditAuthorizeUrl, SUBREDDIT_PATTERN } from "@/lib/social/reddit";
import { xAuthorizeUrl, xRequestToken } from "@/lib/social/x";
import { createAdminClient } from "@/lib/supabase/admin";

/** Remembers which website is being connected while the person signs in on X or Reddit. */
async function rememberPending(pending) {
  (await cookies()).set(
    SOCIAL_OAUTH_COOKIE,
    encryptSecret(JSON.stringify({ ...pending, expiresAt: Date.now() + 10 * 60 * 1000 })),
    {
      httpOnly: true,
      secure: socialCallbackUrl("x").startsWith("https:"),
      sameSite: "lax",
      path: "/api/social",
      maxAge: 600,
    },
  );
}

export async function connectX(websiteId) {
  const user = await requireAdmin();
  await requireWebsite(websiteId);
  const app = socialApps().x;
  if (!app) return { error: "X is not set up. Add X_API_KEY and X_API_SECRET to the environment." };
  let request;
  try {
    request = await xRequestToken(app, socialCallbackUrl("x"));
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  await rememberPending({ platform: "x", websiteId, userId: user.id, ...request });
  redirect(xAuthorizeUrl(request.token));
}

export async function connectReddit(websiteId, formData) {
  const user = await requireAdmin();
  await requireWebsite(websiteId);
  const app = socialApps().reddit;
  if (!app) return { error: "Reddit is not set up. Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET to the environment." };
  const subreddit = String(formData.get("subreddit") ?? "")
    .trim()
    .replace(/^\/?r\//i, "");
  if (!SUBREDDIT_PATTERN.test(subreddit)) return { error: "Enter the subreddit's name, e.g. r/ExampleNews." };
  const state = randomBytes(16).toString("hex");
  await rememberPending({ platform: "reddit", websiteId, userId: user.id, state, subreddit });
  redirect(redditAuthorizeUrl(app, state, socialCallbackUrl("reddit")));
}

export async function disconnectSocial(websiteId, platform) {
  const user = await requireAdmin();
  await requireWebsite(websiteId);
  if (!(platform in PLATFORM_LABELS)) return { error: "Unknown platform" };
  const { error } = await createAdminClient()
    .from("social_accounts")
    .delete()
    .eq("website_id", websiteId)
    .eq("platform", platform);
  if (error) return { error: error.message };
  await recordAudit({
    action: "website.social_disconnected",
    entityType: "website",
    entityId: websiteId,
    websiteId,
    actorId: user.id,
    details: { platform },
  });
  revalidatePath(`/websites/${websiteId}/settings`);
  return {
    ok: true,
    message: `${PLATFORM_LABELS[platform]} disconnected. Revoke the app in the account's own settings to remove its access completely.`,
  };
}
