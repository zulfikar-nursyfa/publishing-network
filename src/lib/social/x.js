import { oauthHeader } from "@/lib/social/oauth1";
import { send, SocialError } from "@/lib/social/request";

const API = "https://api.x.com";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Post text: the title, a blank line and the link. X counts every link as 23 characters.
 * shortcut: counts code points, so a title full of emoji (which X counts twice) can still be too long; X then refuses it and the post is marked failed.
 */
export function xText(title, url) {
  const chars = Array.from(title.trim());
  const shown = chars.length > 250 ? `${chars.slice(0, 249).join("").trimEnd()}…` : chars.join("");
  return `${shown}\n\n${url}`;
}

function signed(app, method, url, extra = {}) {
  return oauthHeader({ method, url, consumerKey: app.key, consumerSecret: app.secret, ...extra });
}

/** Step 1 of "Sign in with X": a temporary token that the authorize page is opened with. */
export async function xRequestToken(app, callbackUrl) {
  const url = `${API}/oauth/request_token`;
  const response = await send(
    url,
    {
      method: "POST",
      headers: { Authorization: signed(app, "POST", url, { oauth: { oauth_callback: callbackUrl } }) },
    },
    "X sign-in",
  );
  const result = new URLSearchParams(await response.text());
  if (result.get("oauth_callback_confirmed") !== "true") {
    throw new SocialError("X did not accept the callback URL. Add it to the X app's callback URLs.", {
      notPosted: true,
    });
  }
  return { token: result.get("oauth_token"), tokenSecret: result.get("oauth_token_secret") };
}

export const xAuthorizeUrl = (token) => `${API}/oauth/authorize?oauth_token=${encodeURIComponent(token)}`;

/** Step 3: the account's own token, which does not expire until the account revokes the app. */
export async function xAccessToken(app, { token, tokenSecret }, verifier) {
  const url = `${API}/oauth/access_token`;
  const response = await send(
    url,
    {
      method: "POST",
      headers: { Authorization: signed(app, "POST", url, { token, tokenSecret, oauth: { oauth_verifier: verifier } }) },
    },
    "X sign-in",
  );
  const result = new URLSearchParams(await response.text());
  return {
    credentials: { token: result.get("oauth_token"), tokenSecret: result.get("oauth_token_secret") },
    accountName: result.get("screen_name"),
  };
}

/** Posts the text with the image attached (when given and small enough) and returns the post's URL. */
export async function postToX(app, credentials, accountName, { text, image }) {
  const auth = { token: credentials.token, tokenSecret: credentials.tokenSecret };
  let mediaIds = [];
  if (image && image.bytes.length <= MAX_IMAGE_BYTES) {
    const url = `${API}/2/media/upload`;
    const form = new FormData();
    form.append("media", new Blob([image.bytes], { type: image.contentType }), image.filename);
    form.append("media_category", "tweet_image");
    const response = await send(
      url,
      { method: "POST", headers: { Authorization: signed(app, "POST", url, auth) }, body: form },
      "X image upload",
    );
    mediaIds = [(await response.json()).data.id];
  }
  const url = `${API}/2/tweets`;
  const response = await send(
    url,
    {
      method: "POST",
      headers: { Authorization: signed(app, "POST", url, auth), "Content-Type": "application/json" },
      body: JSON.stringify({ text, ...(mediaIds.length ? { media: { media_ids: mediaIds } } : {}) }),
    },
    "X post",
    { posts: true },
  );
  const id = (await response.json()).data?.id;
  return { url: `https://x.com/${accountName}/status/${id}` };
}
