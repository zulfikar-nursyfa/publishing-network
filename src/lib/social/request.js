/**
 * A failed call to X or Reddit. `notPosted` is true when the platform certainly did not create the
 * post (it refused the request, or the call was not one that posts), so a retry cannot duplicate
 * it. `accountProblem` means the connection itself is broken (revoked or expired login).
 */
export class SocialError extends Error {
  constructor(message, { notPosted, status = null }) {
    super(message);
    this.notPosted = notPosted;
    this.accountProblem = status === 401 || status === 403;
  }
}

/** fetch with a timeout. `posts` marks the call that creates the post: only its failures can be ambiguous. */
export async function send(url, init, stage, { posts = false } = {}) {
  let response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  } catch (error) {
    throw new SocialError(`${stage}: ${error instanceof Error ? error.message : String(error)}`, { notPosted: !posts });
  }
  if (!response.ok) {
    const body = (await response.text()).slice(0, 300);
    // A server error or timeout may come after the post was saved, so it is not safe to retry.
    const refused = response.status < 500 && response.status !== 408;
    throw new SocialError(`${stage} failed (HTTP ${response.status}): ${body}`, {
      notPosted: !posts || refused,
      status: response.status,
    });
  }
  return response;
}
