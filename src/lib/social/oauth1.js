import { createHmac, randomBytes } from "node:crypto";

// RFC 3986 encoding, which OAuth 1.0a requires (encodeURIComponent leaves !'()* alone).
const encode = (value) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * The Authorization header for an OAuth 1.0a (HMAC-SHA1) request. `params` are form-encoded body
 * fields; JSON and multipart bodies are not signed. `oauth` adds oauth_callback or oauth_verifier.
 */
export function oauthHeader({
  method,
  url,
  consumerKey,
  consumerSecret,
  token,
  tokenSecret = "",
  params = {},
  oauth = {},
  nonce = randomBytes(16).toString("hex"),
  timestamp = Math.floor(Date.now() / 1000),
}) {
  const fields = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(timestamp),
    oauth_version: "1.0",
    ...(token ? { oauth_token: token } : {}),
    ...oauth,
  };
  const target = new URL(url);
  const pairs = [...Object.entries({ ...fields, ...params }), ...target.searchParams.entries()]
    .map(([key, value]) => [encode(key), encode(value)])
    .sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : 1) : a < b ? -1 : 1));
  const base = [
    method.toUpperCase(),
    encode(`${target.origin}${target.pathname}`),
    encode(pairs.map(([key, value]) => `${key}=${value}`).join("&")),
  ].join("&");
  const signature = createHmac("sha1", `${encode(consumerSecret)}&${encode(tokenSecret)}`)
    .update(base)
    .digest("base64");
  return `OAuth ${Object.entries({ ...fields, oauth_signature: signature })
    .map(([key, value]) => `${encode(key)}="${encode(value)}"`)
    .join(", ")}`;
}
