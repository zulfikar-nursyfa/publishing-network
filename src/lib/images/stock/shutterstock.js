import "server-only";
/**
 * Shutterstock API: search with basic auth (consumer key:secret); licensing with a user's OAuth token
 * and the API subscription id. Server-only: the keys and token never leave the server.
 */
const API = "https://api.shutterstock.com/v2/images";
const USER_AGENT = "PublishingNetwork/1.0";
// Medium is about 1000 px wide: enough for a featured image and under the 3 MB article image limit.
export const LICENSE_SIZE = "medium";

export class ShutterstockError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/** Search results reduced to what the picker and licensing need. */
export function mapSearchResponse(body) {
  return (body?.data ?? [])
    .map((item) => ({
      id: String(item.id ?? ""),
      description: item.description ?? "",
      preview: item.assets?.preview?.url ?? item.assets?.huge_thumb?.url,
      large: item.assets?.preview_1000?.url ?? item.assets?.preview?.url ?? item.assets?.huge_thumb?.url,
      url: `https://www.shutterstock.com/image-photo/${item.id}`,
      // Sent back when licensing so Shutterstock can credit the search.
      searchId: body.search_id ?? null,
    }))
    .filter((item) => /^\d+$/.test(item.id) && item.preview);
}

/** The licensed image's download URL from a POST /v2/images/licenses response. */
export function parseLicenseResponse(body, imageId) {
  const result = (body?.data ?? []).find((item) => String(item.image_id) === imageId);
  const url = result?.download?.url;
  if (result?.error || !url || !/^https:\/\//.test(url))
    throw new ShutterstockError(
      `Shutterstock did not license the image: ${result?.error ?? body?.message ?? "no download link"}`,
    );
  return { url, licenseId: result.license_id ?? null };
}

async function send(fetchImpl, url, options, action) {
  let response;
  try {
    response = await fetchImpl(url, {
      ...options,
      headers: { ...options.headers, "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ShutterstockError(`Shutterstock ${action} timed out or could not be reached`);
  }
  // 429: the plan's hourly calls are used up.
  if (!response.ok)
    throw new ShutterstockError(`Shutterstock ${action} returned HTTP ${response.status}`, response.status);
  return response;
}

export function createShutterstockClient({ key, secret, token, subscriptionId, fetch: fetchImpl = globalThis.fetch }) {
  return {
    async search(query, perPage = 15) {
      if (!key || !secret)
        throw new ShutterstockError("Set SHUTTERSTOCK_CONSUMER_KEY and SHUTTERSTOCK_CONSUMER_SECRET");
      const params = new URLSearchParams({
        query,
        image_type: "photo",
        orientation: "horizontal",
        safe: "true",
        per_page: String(perPage),
      });
      const auth = `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;
      const response = await send(fetchImpl, `${API}/search?${params}`, { headers: { authorization: auth } }, "search");
      return mapSearchResponse(await response.json());
    },

    /** Licenses one image and returns its bytes (unchecked) and the license details. */
    async license(image) {
      if (!token || !subscriptionId)
        throw new ShutterstockError("Set SHUTTERSTOCK_API_TOKEN and SHUTTERSTOCK_SUBSCRIPTION_ID");
      const body = {
        images: [
          {
            image_id: image.id,
            subscription_id: subscriptionId,
            size: LICENSE_SIZE,
            ...(image.searchId ? { search_id: image.searchId } : {}),
          },
        ],
      };
      const response = await send(
        fetchImpl,
        `${API}/licenses`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify(body),
        },
        "licensing",
      );
      const license = parseLicenseResponse(await response.json(), image.id);
      // The download link is pre-signed: no auth header.
      const download = await send(fetchImpl, license.url, {}, "download");
      return { ...license, bytes: Buffer.from(await download.arrayBuffer()) };
    },
  };
}
