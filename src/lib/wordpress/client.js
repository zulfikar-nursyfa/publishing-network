/**
 * Minimal WordPress REST API client. Authenticates with an application password (HTTP Basic),
 * which WordPress only accepts over HTTPS unless the site is a local development install.
 *
 * Kept free of Next.js and Supabase imports so it can be unit tested with a fake fetch.
 */

export const REQUIRED_PLUGIN_VERSION = "1.0.0";

/**
 * @typedef {{baseUrl: string, username: string, appPassword: string}} WordPressConnection
 * @typedef {"publish"|"future"|"draft"|"pending"|"private"|"trash"} WordPressPostStatus
 * @typedef {{id: number, status: WordPressPostStatus, link: string, slug: string}} WordPressPost
 * @typedef {{articleId: string, title: string, content: string, excerpt?: string|null, slug?: string|null, status: "publish"|"draft", categoryIds?: number[], featuredMediaId?: number|null}} NewPost
 * @typedef {{id: number, name: string, slug: string}} WordPressCategory
 * @typedef {ReturnType<typeof createWordPressClient>} WordPressClient
 */

export class WordPressError extends Error {
  /** @param {string} message @param {{status?: number, code?: string, retryable: boolean}} options */
  constructor(message, options) {
    super(message);
    this.options = options;
    this.name = "WordPressError";
  }

  get retryable() {
    return this.options.retryable;
  }
}

/**
 * @param {WordPressConnection} connection
 * @param {{fetch?: typeof globalThis.fetch, timeoutMs?: number}} [options]
 */
export function createWordPressClient(connection, options = {}) {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const root = normaliseBaseUrl(connection.baseUrl);
  // WordPress shows application passwords in groups of four; the spaces are optional.
  const password = connection.appPassword.replace(/\s+/g, "");
  const authorization = `Basic ${Buffer.from(`${connection.username}:${password}`).toString("base64")}`;

  /** `file` sends raw bytes (media uploads) instead of a JSON body. */
  async function request(method, path, body, file) {
    let response;
    try {
      response = await fetchImpl(`${root}/wp-json${path}`, {
        method,
        headers: {
          Authorization: authorization,
          Accept: "application/json",
          ...(file
            ? { "Content-Type": file.contentType, "Content-Disposition": `attachment; filename="${file.filename}"` }
            : body === undefined
              ? {}
              : { "Content-Type": "application/json" }),
        },
        body: file ? file.bytes : body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      throw new WordPressError(
        timedOut
          ? `WordPress did not respond within ${timeoutMs / 1000}s`
          : `Could not reach WordPress: ${error instanceof Error ? error.message : String(error)}`,
        { retryable: true, code: timedOut ? "timeout" : "network_error" },
      );
    }

    const text = await response.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // Security plugins and web application firewalls answer blocked API calls with an HTML
      // page, which is the most common failure on managed hosting.
      throw new WordPressError(
        `WordPress returned a non-JSON response (HTTP ${response.status}). A security plugin, firewall or caching layer may be blocking the REST API.`,
        { status: response.status, code: "non_json_response", retryable: response.status >= 500 },
      );
    }

    if (!response.ok) {
      const error = json ?? {};
      throw new WordPressError(describeError(response.status, error), {
        status: response.status,
        code: error.code,
        retryable: response.status >= 500 || response.status === 429 || response.status === 408,
      });
    }

    return json;
  }

  return {
    async getStatus() {
      return request("GET", "/publishing-network/v1/status");
    },

    async findPostByArticleId(articleId) {
      const query = new URLSearchParams({
        pn_article_id: articleId,
        status: "publish,future,draft,pending,private",
        context: "edit",
        _fields: "id,status,link,slug",
        per_page: "2",
      });
      const posts = await request("GET", `/wp/v2/posts?${query}`);
      if (!Array.isArray(posts) || posts.length === 0) return null;
      return posts[0];
    },

    async createPost(post) {
      return request("POST", "/wp/v2/posts?_fields=id,status,link,slug", postBody(post));
    },

    /** Replaces an existing post's content, e.g. republishing a corrected article into its draft. */
    async updatePost(id, post) {
      return request("POST", `/wp/v2/posts/${id}?_fields=id,status,link,slug`, postBody(post));
    },

    /** @returns {Promise<WordPressCategory[]>} The first 100 categories, enough for one site's sections. */
    async listCategories() {
      return request("GET", "/wp/v2/categories?per_page=100&_fields=id,name,slug");
    },

    /** @param {{name: string, slug: string, description?: string|null}} category @returns {Promise<WordPressCategory>} */
    async createCategory(category) {
      return request("POST", "/wp/v2/categories?_fields=id,name,slug", {
        name: category.name,
        slug: category.slug,
        description: category.description ?? "",
      });
    },

    /** @param {number} id @param {{name: string, slug: string, description?: string|null}} category @returns {Promise<WordPressCategory>} */
    async updateCategory(id, category) {
      return request("POST", `/wp/v2/categories/${id}?_fields=id,name,slug`, {
        name: category.name,
        slug: category.slug,
        description: category.description ?? "",
      });
    },

    /**
     * Uploads an image to the media library, then sets its alt text and caption.
     * @param {{bytes: Buffer, filename: string, contentType: string, altText?: string|null, caption?: string|null}} media
     * @returns {Promise<number>} The attachment id.
     */
    async uploadMedia(media) {
      const created = await request("POST", "/wp/v2/media?_fields=id", undefined, media);
      await request("POST", `/wp/v2/media/${created.id}?_fields=id`, {
        alt_text: media.altText ?? "",
        caption: media.caption ?? "",
      });
      return created.id;
    },

    async updatePostStatus(id, status) {
      return request("POST", `/wp/v2/posts/${id}?_fields=id,status,link,slug`, {
        status,
      });
    },

    async getPost(id) {
      return request("GET", `/wp/v2/posts/${id}?context=edit&_fields=id,status,link,slug`);
    },
  };
}

/** @param {NewPost} post */
function postBody(post) {
  return {
    title: post.title,
    content: post.content,
    excerpt: post.excerpt ?? "",
    slug: post.slug || undefined,
    status: post.status,
    categories: post.categoryIds?.length ? post.categoryIds : undefined,
    featured_media: post.featuredMediaId ?? 0,
    meta: { pn_article_id: post.articleId },
  };
}

export function normaliseBaseUrl(url) {
  return url
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/wp-json$/, "");
}

function describeError(status, error) {
  const detail = error.message ? `: ${stripTags(error.message)}` : "";
  switch (error.code) {
    case "rest_not_logged_in":
    case "incorrect_password":
    case "invalid_username":
    case "invalid_email":
      return `WordPress rejected the credentials (${error.code}). Check the username and application password. If they are correct, the host may be stripping the Authorization header.`;
    case "application_passwords_disabled":
      return "Application passwords are disabled on this WordPress site (they require HTTPS).";
    case "rest_no_route":
      return `WordPress does not recognise this API route (${status}). Check that the Publishing Network connector is installed in wp-content/mu-plugins.`;
    case "rest_forbidden":
    case "rest_cannot_create":
    case "rest_cannot_edit":
      return `The WordPress user is not allowed to do this (${error.code}). Give it the Editor role.`;
    default:
      return `WordPress request failed with HTTP ${status}${error.code ? ` (${error.code})` : ""}${detail}`;
  }
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, "");
}
