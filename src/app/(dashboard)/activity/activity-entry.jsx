import Link from "next/link";
import {
  Bot,
  ChevronRight,
  FileText,
  Globe,
  KeyRound,
  Layers,
  Receipt,
  Rss,
  Send,
  Settings,
  Tag,
  UserRound,
} from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import { Avatar, cn } from "@/components/ui";
import { humanLabel } from "@/lib/list-labels";

const AREAS = {
  article: { label: "Article", icon: FileText, tone: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  publication: { label: "Publishing", icon: Send, tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  automation: { label: "Automation", icon: Bot, tone: "bg-purple-500/10 text-purple-700 dark:text-purple-300" },
  story: { label: "Story", icon: Rss, tone: "bg-orange-500/10 text-orange-700 dark:text-orange-300" },
  source: { label: "Source", icon: Rss, tone: "bg-orange-500/10 text-orange-700 dark:text-orange-300" },
  niche_source: { label: "Niche source", icon: Rss, tone: "bg-orange-500/10 text-orange-700 dark:text-orange-300" },
  niche: { label: "Niche", icon: Layers, tone: "bg-teal-500/10 text-teal-700 dark:text-teal-300" },
  category: { label: "Category", icon: Tag, tone: "bg-teal-500/10 text-teal-700 dark:text-teal-300" },
  website: { label: "Website", icon: Globe, tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  network: { label: "Network", icon: Settings, tone: "bg-muted text-muted-foreground" },
  costs: { label: "Costs", icon: Receipt, tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  user: { label: "User", icon: UserRound, tone: "bg-pink-500/10 text-pink-700 dark:text-pink-300" },
  auth: { label: "Account", icon: KeyRound, tone: "bg-muted text-muted-foreground" },
};

/** "article.returned_to_draft" → area Article, "Returned to draft". */
export function describeAction(action) {
  const [area, ...rest] = String(action).split(".");
  const verb = rest.join(" ").replaceAll("_", " ").trim();
  return {
    area: AREAS[area] ?? { label: humanLabel(area), icon: Settings, tone: "bg-muted text-muted-foreground" },
    verb: verb ? humanLabel(verb) : humanLabel(area),
  };
}

function DetailValue({ value }) {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value) && value.every((item) => typeof item !== "object")) return value.join(", ") || "—";
  if (typeof value === "object")
    return <pre className="whitespace-pre-wrap break-all font-mono text-xs">{JSON.stringify(value, null, 2)}</pre>;
  return <span className="break-words">{String(value)}</span>;
}

export function ActivityEntry({ entry, actor, website, timezone }) {
  const { area, verb } = describeAction(entry.action);
  const Icon = area.icon;
  const details = Object.entries(entry.details ?? {}).filter(([key]) => key !== "title");
  const title = entry.details?.title;
  const subject =
    entry.entity_type === "article" && entry.entity_id ? (
      <Link href={`/articles/${entry.entity_id}`} className="font-medium hover:underline">
        {title ? `“${title}”` : "Open article"}
      </Link>
    ) : title ? (
      <span className="font-medium">“{title}”</span>
    ) : null;

  return (
    <li className="flex gap-3 px-4 py-3.5 sm:px-5">
      <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", area.tone)}>
        <Icon aria-hidden className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
          <span className="font-semibold">{verb}</span>
          <span className="text-xs text-muted-foreground">{area.label}</span>
          {subject ? (
            <span dir="auto" className="min-w-0 break-words">
              {subject}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            {actor ? (
              <Avatar name={actor} className="size-5 text-[0.6rem]" />
            ) : (
              <Bot aria-hidden className="size-3.5" />
            )}
            {actor ?? "System"}
          </span>
          <span aria-hidden>·</span>
          <span>{website ?? "Network"}</span>
          <span aria-hidden>·</span>
          <RelativeTime value={entry.created_at} timezone={timezone} />
        </div>
        {details.length ? (
          <details className="group mt-2">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
              <ChevronRight aria-hidden className="size-3.5 transition-transform group-open:rotate-90" />
              Details
            </summary>
            <dl className="mt-2 grid max-w-2xl gap-x-4 gap-y-1.5 rounded-md bg-muted/50 p-3 text-xs sm:grid-cols-[10rem_minmax(0,1fr)]">
              {details.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="font-medium text-muted-foreground">{humanLabel(key)}</dt>
                  <dd className="min-w-0">
                    <DetailValue value={value} />
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        ) : null}
      </div>
    </li>
  );
}
