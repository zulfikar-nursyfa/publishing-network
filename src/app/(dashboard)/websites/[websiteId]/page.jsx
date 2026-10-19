import { z } from "zod";
import { ArticleTable } from "@/components/article-table";
import { ListToolbar } from "@/components/list-controls";
import { ListResults } from "@/components/list-results";
import { WebsiteNav } from "@/components/website-nav";
import { allRows, readList } from "@/lib/lists";
import { parseListParams, listHref } from "@/lib/list-params";
import { ARTICLE_LIST_FIELDS, articleList, slotList, articleStatuses } from "@/lib/list-configs";
import Link from "next/link";
import { CircleCheck, ClipboardCheck, ExternalLink, Plus, Send, Settings, TriangleAlert, Upload } from "lucide-react";
import {
  Badge,
  ButtonLink,
  ConnectionBadge,
  FilterTabs,
  PageHeader,
  Stat,
  Table,
  Td,
  Th,
  formatDateTime,
  linkClass,
} from "@/components/ui";
import { requireWebsite } from "@/lib/auth";

import { createClient } from "@/lib/supabase/server";
import { AiUsageCard } from "./ai-usage-card";
import { TrafficCard } from "./traffic-card";
import { TodaySchedule } from "./today-schedule";
import { TopContentCard } from "./top-content-card";

const sections = ["articles", "overview", "schedule", "traffic", "costs"];
const sectionFilter = {
  label: "Section",
  options: sections.map((value) => ({ value, label: value })),
  default: "articles",
  hidden: true,
};

export default async function WebsitePage({ params, searchParams }) {
  const { websiteId } = await params;
  const { user, website } = await requireWebsite(websiteId);
  const input = await searchParams;
  const section = z.enum(sections).catch("articles").parse(input.section);
  const config = section === "schedule" ? slotList : articleList;
  const state = parseListParams(input, { ...config, filters: { ...config.filters, section: sectionFilter } });
  const path = `/websites/${websiteId}`;

  const supabase = await createClient();
  const [result, { data: stats }, { data: niche }, categories] = await Promise.all([
    ["articles", "schedule"].includes(section)
      ? readList(
          () => {
            let query = supabase
              .from(section === "schedule" ? "publish_slots" : "article_list")
              .select(section === "schedule" ? "*" : ARTICLE_LIST_FIELDS, { count: "exact" })
              .eq("website_id", websiteId);
            if (section === "schedule" && state.status !== "all")
              query =
                state.status === "problems"
                  ? query.in("status", ["skipped", "failed"])
                  : query.eq("status", state.status);
            if (section === "articles" && state.scheduled !== "all")
              query =
                state.scheduled === "yes" ? query.not("scheduled_for", "is", null) : query.is("scheduled_for", null);
            return query;
          },
          state,
          website.timezone,
        )
      : Promise.resolve({ data: [], count: 0 }),
    supabase.from("website_article_stats").select("*").eq("website_id", websiteId).maybeSingle(),
    website.niche_id
      ? supabase.from("niches").select("name").eq("id", website.niche_id).maybeSingle()
      : Promise.resolve({ data: null }),
    allRows(() =>
      supabase.from("categories").select("id, name").eq("website_id", websiteId).order("sort_order").order("id"),
    ),
  ]);
  const rtl = website.text_direction === "rtl";

  return (
    <>
      <PageHeader
        back={{ href: "/websites", label: "Websites" }}
        title={website.name}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <a
              href={`https://${website.domain}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              {website.domain}
              <ExternalLink className="size-3" />
            </a>
            <span className="text-border">|</span>
            <span>{rtl ? "Arabic (RTL)" : "English"}</span>
            <span className="text-border">|</span>
            {niche ? (
              <>
                <span>{niche.name}</span>
                <span className="text-border">|</span>
              </>
            ) : null}
            <span>{website.timezone}</span>
            <span className="flex w-full flex-wrap gap-1.5 pt-1 sm:w-auto sm:pt-0">
              <ConnectionBadge status={website.wp_connection_status} />
              {website.automation_paused ? (
                <Badge dot>automation paused</Badge>
              ) : (
                <Badge tone="green" dot>
                  automation {website.daily_quota}/day
                </Badge>
              )}
              {website.archived_at ? <Badge tone="red">archived</Badge> : null}
            </span>
          </span>
        }
        actions={
          <>
            <ButtonLink href={`/websites/${websiteId}/settings`} variant="secondary">
              <Settings />
              {user.isAdmin ? "Settings" : "Details"}
            </ButtonLink>
            {!website.archived_at ? (
              <ButtonLink href={`/websites/${websiteId}/articles/new`}>
                <Plus />
                New article
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <WebsiteNav websiteId={websiteId} active={section} />
      <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="In review" value={stats?.in_review ?? 0} icon={ClipboardCheck} tone="amber" />
        <Stat label="Approved" value={stats?.approved ?? 0} icon={CircleCheck} tone="blue" />
        <Stat label="Published today" value={stats?.published_today ?? 0} icon={Send} tone="green" />
        <Stat label="Published total" value={stats?.published_total ?? 0} icon={Upload} tone="purple" />
        <Stat
          label="Failed publishing"
          value={stats?.failed_publications ?? 0}
          icon={TriangleAlert}
          tone="red"
          alert={Number(stats?.failed_publications ?? 0) > 0}
        />
      </div>

      {section === "overview" || section === "schedule" ? <TodaySchedule website={website} /> : null}
      {section === "traffic" ? (
        <>
          <TrafficCard supabase={supabase} website={website} isAdmin={user.isAdmin} />
          <TopContentCard supabase={supabase} website={website} />
        </>
      ) : null}
      {section === "costs" ? <AiUsageCard supabase={supabase} website={website} /> : null}
      {section === "articles" ? (
        <>
          <FilterTabs
            active={state.status}
            items={articleStatuses.map((key) => ({
              key,
              label: key.replaceAll("_", " "),
              href: listHref(path, state, { status: key }),
            }))}
          />
          <ListToolbar
            path={path}
            state={state}
            searchLabel="Search article titles"
            choices={{
              category: [
                { value: "all", label: "All categories" },
                ...categories.map((category) => ({ value: category.id, label: category.name })),
              ],
            }}
          />
          <ListResults
            result={result}
            path={path}
            state={state}
            title="No articles yet"
            empty={<Link href={`${path}/articles/new`}>Write an article, or choose a story for drafting.</Link>}
          >
            <ArticleTable articles={result.data} websites={[website]} path={path} state={state} />
          </ListResults>
        </>
      ) : null}
      {section === "schedule" ? (
        <>
          <h2 className="mb-3 text-lg font-semibold">Publishing slot history</h2>
          <ListToolbar path={path} state={state} />
          <ListResults
            result={result}
            path={path}
            state={state}
            title="No publishing slots yet"
            empty="Handled automatic publishing slots appear here."
          >
            <Table>
              <thead>
                <tr>
                  <Th>Time ({website.timezone})</Th>
                  <Th>Status</Th>
                  <Th>Article / note</Th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((slot) => (
                  <tr key={slot.id}>
                    <Td>{formatDateTime(slot.slot_at, website.timezone)}</Td>
                    <Td>
                      <Badge tone={slot.status === "failed" ? "red" : slot.status === "published" ? "green" : "amber"}>
                        {slot.status}
                      </Badge>
                    </Td>
                    <Td>
                      {slot.article_id ? (
                        <Link href={`/articles/${slot.article_id}`} className={linkClass}>
                          View article
                        </Link>
                      ) : (
                        slot.note
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </ListResults>
        </>
      ) : null}
    </>
  );
}
