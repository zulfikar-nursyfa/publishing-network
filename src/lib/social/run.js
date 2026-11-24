import "server-only";
import { recordAudit } from "@/lib/audit";
import { decryptSecret } from "@/lib/crypto";
import { pickCandidates } from "@/lib/social/candidates";
import { socialApps } from "@/lib/social/apps";
import { postToReddit, redditTitle } from "@/lib/social/reddit";
import { SocialError } from "@/lib/social/request";
import { postToX, xText } from "@/lib/social/x";
import { downloadArticleImage } from "@/lib/storage/article-images";
import { createAdminClient } from "@/lib/supabase/admin";

// Articles published longer ago than this are not posted, so a long outage does not post a backlog.
const MAX_AGE_MS = 48 * 60 * 60 * 1000;

/**
 * Posts newly published manual articles to every connected X account and subreddit. Called by the
 * social cron; each article is claimed in social_posts before it is sent.
 */
export async function runSocialPosts({ now = new Date() } = {}) {
  const db = createAdminClient();
  const apps = socialApps();
  const { data: accounts, error } = await db.from("social_accounts").select("*, websites(archived_at)");
  if (error) throw new Error(`Could not load social accounts: ${error.message}`);
  const summary = { posted: 0, failed: 0, unknown: 0 };
  for (const account of accounts ?? []) {
    if (!apps[account.platform] || account.websites?.archived_at) continue;
    await postForAccount(db, apps[account.platform], account, now, summary);
  }
  return summary;
}

async function postForAccount(db, app, account, now, summary) {
  const since = new Date(Math.max(new Date(account.connected_at).getTime(), now.getTime() - MAX_AGE_MS));
  const { data: articles, error } = await db
    .from("articles")
    .select("id, title, wp_post_url")
    .eq("website_id", account.website_id)
    .eq("status", "published")
    .eq("origin", "manual")
    .not("wp_post_url", "is", null)
    .gte("published_at", since.toISOString())
    .lte("published_at", now.toISOString())
    .order("published_at")
    .limit(50);
  if (error || !articles?.length) return;
  const { data: posts } = await db
    .from("social_posts")
    .select("article_id, status, attempt_count")
    .eq("platform", account.platform)
    .in(
      "article_id",
      articles.map((article) => article.id),
    );
  const credentials = JSON.parse(decryptSecret(account.credentials_encrypted));

  for (const { article, existing } of pickCandidates(articles, posts ?? [])) {
    const claim = await claimPost(db, account, article.id, existing);
    if (!claim) continue;
    try {
      const result =
        account.platform === "x"
          ? await postToX(app, credentials, account.account_name, {
              text: xText(article.title, article.wp_post_url),
              image: await featuredImage(db, article.id),
            })
          : await postToReddit(app, credentials, account.subreddit, {
              title: redditTitle(article.title),
              url: article.wp_post_url,
            });
      await db
        .from("social_posts")
        .update({ status: "posted", external_url: result.url, last_error: null })
        .eq("id", claim.id);
      if (account.last_error) await setAccountError(db, account, null);
      summary.posted += 1;
      await audit(account, article.id, "article.social_posted", { url: result.url, attempt: claim.attempt_count });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      const status = caught instanceof SocialError && caught.notPosted ? "failed" : "unknown";
      await db
        .from("social_posts")
        .update({ status, last_error: message.slice(0, 2000) })
        .eq("id", claim.id);
      summary[status] += 1;
      await audit(account, article.id, "article.social_post_failed", { error: message, status });
      if (caught instanceof SocialError && caught.accountProblem) {
        await setAccountError(db, account, message);
        return;
      }
    }
  }
}

/** Takes the article for this run: a new row, or a refused one whose attempt count has not moved. */
async function claimPost(db, account, articleId, existing) {
  if (!existing) {
    const { data, error } = await db
      .from("social_posts")
      .insert({ website_id: account.website_id, article_id: articleId, platform: account.platform })
      .select("id, attempt_count")
      .single();
    return error ? null : data;
  }
  const { data } = await db
    .from("social_posts")
    .update({ status: "posting", attempt_count: existing.attempt_count + 1 })
    .eq("article_id", articleId)
    .eq("platform", account.platform)
    .eq("status", "failed")
    .eq("attempt_count", existing.attempt_count)
    .select("id, attempt_count")
    .maybeSingle();
  return data;
}

async function featuredImage(db, articleId) {
  const { data } = await db
    .from("article_images")
    .select("storage_path")
    .eq("article_id", articleId)
    .eq("role", "featured")
    .maybeSingle();
  return data?.storage_path ? downloadArticleImage(db, data.storage_path) : null;
}

async function setAccountError(db, account, message) {
  await db
    .from("social_accounts")
    .update({ last_error: message })
    .eq("website_id", account.website_id)
    .eq("platform", account.platform);
}

function audit(account, articleId, action, details) {
  return recordAudit({
    action,
    entityType: "article",
    entityId: articleId,
    websiteId: account.website_id,
    details: { platform: account.platform, ...details },
  });
}
