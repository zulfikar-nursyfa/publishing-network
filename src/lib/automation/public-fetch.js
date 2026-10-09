import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";

export const MAX_BYTES = 8 * 1024 * 1024;
export const USER_AGENT = "PublishingNetworkBot/1.0";

export class EvidenceError extends Error {
  constructor(message, retryable = false) {
    super(message);
    this.retryable = retryable;
  }
}

export function isFetchableUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443");
  } catch {
    return false;
  }
}

export function isPublicIPv4(address) {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  );
}

export const pageTooLarge = () => new EvidenceError("Page exceeds the 8 MiB download limit");

export function readResearchResponse(response) {
  return new Promise((resolve, reject) => {
    response.once("error", reject);
    response.once("aborted", () => reject(new EvidenceError("Response was interrupted", true)));
    const rejectOversize = () => {
      const error = pageTooLarge();
      // IncomingMessage.destroy() can emit "aborted" before "error".
      reject(error);
      response.destroy(error);
    };
    if (Number(response.headers["content-length"] ?? 0) > MAX_BYTES) {
      rejectOversize();
      return;
    }
    const chunks = [];
    let size = 0;
    response.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BYTES) rejectOversize();
      else chunks.push(chunk);
    });
    response.once("end", () => {
      const raw = Buffer.concat(chunks);
      resolve({ status: response.statusCode, headers: response.headers, raw, body: raw.toString("utf8") });
    });
  });
}

// Resolve once, validate every address, and pin the request to that answer to prevent DNS rebinding.
export async function publicRequest(url, timeoutMs, accept = "text/html,text/plain") {
  const signal = AbortSignal.timeout(timeoutMs);
  const addresses = await Promise.race([
    lookup(url.hostname, { all: true, family: 4 }),
    new Promise((_, reject) =>
      signal.addEventListener("abort", () => reject(new Error("Request timed out")), { once: true }),
    ),
  ]);
  if (!addresses.length || addresses.some((entry) => !isPublicIPv4(entry.address)))
    throw new Error("URL resolves to a private or unsupported address");
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        signal,
        lookup: (_hostname, options, callback) =>
          options.all ? callback(null, addresses) : callback(null, addresses[0].address, 4),
        headers: { accept, "accept-encoding": "identity", "user-agent": USER_AGENT },
      },
      (response) => {
        readResearchResponse(response).then(resolve, reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

/** Downloads a public HTTPS image with the same address checks as evidence pages. Redirects are not followed. */
export async function fetchPublicImage(value) {
  if (!isFetchableUrl(value)) throw new EvidenceError("Image URL is not a public HTTPS address");
  const response = await publicRequest(new URL(value), 15_000, "image/png,image/jpeg,image/webp");
  if (response.status !== 200) throw new EvidenceError(`Image returned HTTP ${response.status}`);
  return response.raw;
}
