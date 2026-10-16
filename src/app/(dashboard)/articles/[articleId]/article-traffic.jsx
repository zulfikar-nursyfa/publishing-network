import { ChartLine } from "lucide-react";
import { Card, DescriptionList } from "@/components/ui";
import { pagePath } from "@/lib/traffic/top";

const number = (value) => (value === null || value === undefined ? "—" : new Intl.NumberFormat("en-GB").format(value));

/** This article's Google Analytics and Search Console numbers and top searches, last 28 days. */
export async function ArticleTraffic({ supabase, article, website }) {
  if (!article.wp_post_url || (!website.ga4_property_id && !website.search_console_site)) return null;
  const path = pagePath(article.wp_post_url);
  const [{ data: page }, { data: queries }] = await Promise.all([
    supabase
      .from("website_traffic_pages")
      .select("users, page_views, clicks, impressions, position")
      .eq("website_id", website.id)
      .eq("path", path)
      .maybeSingle(),
    supabase
      .from("website_search_queries")
      .select("query, clicks, impressions")
      .eq("website_id", website.id)
      .eq("path", path)
      .order("clicks", { ascending: false })
      .order("impressions", { ascending: false })
      .limit(5),
  ]);

  return (
    <Card icon={ChartLine} title="Traffic, last 28 days">
      {page ? (
        <DescriptionList
          items={[
            { label: "Page views", value: number(page.page_views) },
            { label: "Users", value: number(page.users) },
            { label: "Search clicks", value: number(page.clicks) },
            { label: "Impressions", value: number(page.impressions) },
            { label: "Avg. position", value: page.position === null ? "—" : Number(page.position).toFixed(1) },
          ]}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          No Google data for this page yet. Only the site&apos;s top pages are tracked, and Search Console runs 2–3 days
          behind.
        </p>
      )}
      {queries?.length ? (
        <div className="mt-4 border-t pt-4">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Top searches</div>
          <ul className="space-y-1 text-sm">
            {queries.map((row) => (
              <li key={row.query} className="flex justify-between gap-3">
                <span dir="auto" className="truncate">
                  {row.query}
                </span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {number(row.clicks)} / {number(row.impressions)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Clicks / impressions</p>
        </div>
      ) : null}
    </Card>
  );
}
