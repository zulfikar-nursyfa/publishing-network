import "server-only";
import { serverEnv } from "@/lib/env";

/** The X and Reddit app credentials, or null for a platform that is not set up. */
export function socialApps() {
  const env = serverEnv();
  return {
    x: env.X_API_KEY && env.X_API_SECRET ? { key: env.X_API_KEY, secret: env.X_API_SECRET } : null,
    reddit:
      env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET
        ? { clientId: env.REDDIT_CLIENT_ID, clientSecret: env.REDDIT_CLIENT_SECRET }
        : null,
  };
}

export function socialCallbackUrl(platform) {
  return `${serverEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/api/social/callback/${platform}`;
}

// Holds the pending sign-in (encrypted) between the connect action and the platform's callback.
export const SOCIAL_OAUTH_COOKIE = "pn_social_oauth";

export const PLATFORM_LABELS = { x: "X", reddit: "Reddit" };
