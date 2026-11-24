import { send, SocialError } from "@/lib/social/request";

// Reddit refuses requests without a descriptive User-Agent.
const USER_AGENT = "web:publishing-network:1.0";

export const SUBREDDIT_PATTERN = /^[A-Za-z0-9_]{3,21}$/;

/** Reddit titles are limited to 300 characters. */
export function redditTitle(title) {
  const chars = Array.from(title.trim());
  return chars.length > 300 ? `${chars.slice(0, 299).join("").trimEnd()}…` : chars.join("");
}

export function redditAuthorizeUrl(app, state, redirectUri) {
  const query = new URLSearchParams({
    client_id: app.clientId,
    response_type: "code",
    state,
    redirect_uri: redirectUri,
    duration: "permanent",
    scope: "identity submit",
  });
  return `https://www.reddit.com/api/v1/authorize?${query}`;
}

async function token(app, fields) {
  const response = await send(
    "https://www.reddit.com/api/v1/access_token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${app.clientId}:${app.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: new URLSearchParams(fields),
    },
    "Reddit sign-in",
  );
  const result = await response.json();
  // Reddit answers 200 with {error} for a revoked or wrong refresh token.
  if (result.error) throw new SocialError(`Reddit sign-in failed: ${result.error}`, { notPosted: true, status: 401 });
  return result;
}

/** Swaps the code from the authorize page for a refresh token and the account's name. */
export async function redditConnect(app, code, redirectUri) {
  const result = await token(app, { grant_type: "authorization_code", code, redirect_uri: redirectUri });
  const me = await send(
    "https://oauth.reddit.com/api/v1/me",
    { headers: { Authorization: `Bearer ${result.access_token}`, "User-Agent": USER_AGENT } },
    "Reddit account",
  );
  return { credentials: { refreshToken: result.refresh_token }, accountName: (await me.json()).name };
}

/** Submits a link post. Reddit refuses a link already posted to the subreddit (ALREADY_SUB). */
export async function postToReddit(app, credentials, subreddit, { title, url }) {
  const { access_token: accessToken } = await token(app, {
    grant_type: "refresh_token",
    refresh_token: credentials.refreshToken,
  });
  const response = await send(
    "https://oauth.reddit.com/api/submit",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: new URLSearchParams({ sr: subreddit, kind: "link", title, url, api_type: "json", resubmit: "false" }),
    },
    "Reddit post",
    { posts: true },
  );
  const { json } = await response.json();
  if (json?.errors?.length) {
    throw new SocialError(`Reddit refused the post: ${json.errors.map((error) => error.join(" ")).join("; ")}`, {
      notPosted: true,
    });
  }
  return { url: json?.data?.url ?? null };
}
