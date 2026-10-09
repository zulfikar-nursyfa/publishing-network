import { ExternalLink, Rss } from "lucide-react";
import {
  addContentSource,
  deleteContentSource,
  setContentSourceActive,
  updateContentSource,
} from "@/app/actions/sources";
import { SubmitButton } from "@/components/form-controls";
import { Badge, Card, formatDateTime } from "@/components/ui";
import { SOURCE_KINDS } from "@/lib/validation";
import { SourceForm } from "./settings-forms";

function feedStatus(source, timezone) {
  if (!source.feed_url) return "No feed: not used for story discovery";
  if (source.last_error) return `Feed error: ${source.last_error}`;
  if (source.last_checked_at) return `Feed checked ${formatDateTime(source.last_checked_at, timezone)}`;
  return "Feed not checked yet";
}

function SourceBadges({ source }) {
  const primary = source.kind === "newsroom" || source.kind === "government";
  return (
    <>
      <Badge>{SOURCE_KINDS[source.kind] ?? source.kind}</Badge>
      {source.niche_source_id ? <Badge tone="purple">niche</Badge> : null}
      {primary ? <Badge tone="blue">primary</Badge> : null}
      {source.images_reusable ? <Badge tone="green">images reusable</Badge> : null}
      {source.active ? null : <Badge tone="amber">disabled</Badge>}
    </>
  );
}

/** Niche sources come from the Niches page: a website can only disable its copy. */
function SourceItem({ source, website, isAdmin }) {
  const ownSource = !source.niche_source_id;
  return (
    <li className="flex flex-col gap-3 p-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 font-medium">
          {source.name}
          <SourceBadges source={source} />
        </div>
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground hover:text-primary"
        >
          <span className="truncate">{source.url}</span>
          <ExternalLink className="size-3 shrink-0" />
        </a>
        {source.attribution_note ? (
          <div className="mt-1 text-xs text-muted-foreground">{source.attribution_note}</div>
        ) : null}
        <div
          className={`mt-1 text-xs ${source.last_error ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
        >
          {feedStatus(source, website.timezone)}
        </div>
        {isAdmin && ownSource ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-medium text-primary">Edit</summary>
            <div className="mt-2">
              <SourceForm saveSource={updateContentSource.bind(null, website.id, source.id)} source={source} />
            </div>
          </details>
        ) : null}
      </div>

      {isAdmin ? (
        <div className="flex shrink-0 gap-2">
          <form action={setContentSourceActive.bind(null, website.id, source.id, !source.active)}>
            <SubmitButton variant="secondary" size="sm">
              {source.active ? "Disable" : "Enable"}
            </SubmitButton>
          </form>
          {ownSource ? (
            <form action={deleteContentSource.bind(null, website.id, source.id)}>
              <SubmitButton variant="danger-outline" size="sm" confirm={`Remove ${source.name}?`} confirmLabel="Remove">
                Remove
              </SubmitButton>
            </form>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function SourcesCard({ website, sources, niche, isAdmin }) {
  const description = niche
    ? `Sources marked "niche" come from the ${niche.name} source group (Niches page) and can only be disabled here. Automation only draws stories from active sources.`
    : "Automation only draws stories from active sources on this list. Choose a niche below to add its source group.";

  return (
    <Card icon={Rss} className="mb-6" title="Approved content sources" description={description}>
      {sources.length > 0 ? (
        <ul className="mb-5 divide-y rounded-lg border">
          {sources.map((source) => (
            <SourceItem key={source.id} source={source} website={website} isAdmin={isAdmin} />
          ))}
        </ul>
      ) : (
        <p className="mb-5 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No sources yet.
        </p>
      )}
      {isAdmin ? <SourceForm saveSource={addContentSource.bind(null, website.id)} /> : null}
    </Card>
  );
}
