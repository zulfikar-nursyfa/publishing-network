import { Share2 } from "lucide-react";
import { connectReddit, connectX, disconnectSocial } from "@/app/actions/social";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Alert, Badge, Card, formatDateTime, inputClass, linkClass } from "@/components/ui";
import { PLATFORM_LABELS } from "@/lib/social/apps";

const STATUS_TONES = { posted: "green", failed: "red", unknown: "amber", posting: "gray" };

/** X and Reddit connections for one website, and its latest posts. */
export function SocialCard({ website, accounts, posts, configured, isAdmin }) {
  const account = (platform) => accounts.find((row) => row.platform === platform);
  return (
    <Card
      icon={Share2}
      title="Social posting"
      description="Manual articles are posted here once they are live. Automated articles are not posted."
    >
      <div className="space-y-5">
        {["x", "reddit"].map((platform) => (
          <PlatformRow
            key={platform}
            platform={platform}
            website={website}
            account={account(platform)}
            configured={configured[platform]}
            isAdmin={isAdmin}
          />
        ))}
        {posts.length ? (
          <ul className="space-y-1.5 border-t pt-4 text-sm">
            {posts.map((post) => (
              <li key={`${post.platform}-${post.article_id}`} className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONES[post.status]}>{post.status}</Badge>
                <span className="text-muted-foreground">{PLATFORM_LABELS[post.platform]}</span>
                {post.external_url ? (
                  <a href={post.external_url} target="_blank" rel="noreferrer" className={linkClass}>
                    {post.articles?.title ?? "Post"}
                  </a>
                ) : (
                  <span title={post.last_error ?? undefined}>{post.articles?.title ?? "Article"}</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(post.created_at, website.timezone)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  );
}

function PlatformRow({ platform, website, account, configured, isAdmin }) {
  const label = PLATFORM_LABELS[platform];
  if (account) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">
            <span className="font-medium">{label}</span>{" "}
            {platform === "x" ? `@${account.account_name}` : `u/${account.account_name} → r/${account.subreddit}`}
          </p>
          {isAdmin ? (
            <ActionForm action={disconnectSocial.bind(null, website.id, platform)}>
              <SubmitButton
                variant="danger-outline"
                size="sm"
                confirm={`Stop posting this website's articles to ${label}?`}
                confirmLabel="Disconnect"
              >
                Disconnect
              </SubmitButton>
            </ActionForm>
          ) : null}
        </div>
        {account.last_error ? <Alert tone="error">{account.last_error}</Alert> : null}
      </div>
    );
  }
  if (!configured) {
    return (
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{label}</span> is not set up for the dashboard yet.
      </p>
    );
  }
  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{label}</span> not connected.
      </p>
    );
  }
  return platform === "x" ? (
    <ActionForm action={connectX.bind(null, website.id)}>
      <SubmitButton variant="secondary" pendingLabel="Opening X…">
        Connect X account
      </SubmitButton>
    </ActionForm>
  ) : (
    <ActionForm action={connectReddit.bind(null, website.id)} className="flex flex-wrap gap-2">
      <input
        name="subreddit"
        required
        placeholder="Subreddit, e.g. r/ExampleNews"
        aria-label="Subreddit"
        className={`${inputClass} max-w-xs`}
      />
      <SubmitButton variant="secondary" pendingLabel="Opening Reddit…">
        Connect Reddit
      </SubmitButton>
    </ActionForm>
  );
}
