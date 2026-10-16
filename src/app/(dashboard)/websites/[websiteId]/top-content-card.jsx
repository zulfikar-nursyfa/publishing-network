import Link from "next/link";
import { FileText } from "lucide-react";
import { Card, Table, Td, Th, linkClass } from "@/components/ui";

const number = (value) => (value === null ? "—" : new Intl.NumberFormat("en-GB").format(value));

/** The 10 most viewed (or most clicked) pages and the top Google searches, last 28 days. */
export async function TopContentCard({ supabase, website }) {
  if (!website.ga4_property_id && !website.search_console_site) return null;
  const sortBy = website.ga4_property_id ? "page_views" : "clicks";
  const [{ data: pages }, { data: queries }] = await Promise.all([
    supabase
      .from("website_traffic_pages")
      .select("path, users, page_views, clicks, article:articles(id, title)")
      .eq("website_id", website.id)
      .order(sortBy, { ascending: false, nullsFirst: false })
      .limit(10),
    website.search_console_site
      ? supabase
          .from("website_search_queries")
          .select("query, clicks, impressions, position")
          .eq("website_id", website.id)
          .eq("path", "")
          .order("clicks", { ascending: false })
          .order("impressions", { ascending: false })
          .limit(10)
      : { data: [] },
  ]);
  const rtl = website.text_direction === "rtl";

  return (
    <Card
      icon={FileText}
      title="Top pages and searches, last 28 days"
      description="Pages matched to an article link to it. Searches are what people typed in Google before seeing the site."
      className="mb-8"
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <Table>
          <thead>
            <tr>
              <Th>Page</Th>
              <Th className="text-right">Views</Th>
              <Th className="text-right">Clicks</Th>
            </tr>
          </thead>
          <tbody>
            {pages?.length ? (
              pages.map((page) => (
                <tr key={page.path}>
                  <Td>
                    {page.article ? (
                      <Link
                        href={`/articles/${page.article.id}`}
                        dir={rtl ? "rtl" : undefined}
                        className={`${linkClass} block max-w-xs truncate`}
                      >
                        {page.article.title}
                      </Link>
                    ) : (
                      <span dir="auto" className="block max-w-xs truncate text-muted-foreground">
                        {page.path}
                      </span>
                    )}
                  </Td>
                  <Td className="text-right tabular-nums">{number(page.page_views)}</Td>
                  <Td className="text-right tabular-nums">{number(page.clicks)}</Td>
                </tr>
              ))
            ) : (
              <tr>
                <Td className="text-muted-foreground">No data yet.</Td>
              </tr>
            )}
          </tbody>
        </Table>
        {website.search_console_site ? (
          <Table>
            <thead>
              <tr>
                <Th>Search</Th>
                <Th className="text-right">Clicks</Th>
                <Th className="text-right">Impressions</Th>
                <Th className="text-right">Position</Th>
              </tr>
            </thead>
            <tbody>
              {queries?.length ? (
                queries.map((row) => (
                  <tr key={row.query}>
                    <Td>
                      <span dir="auto" className="block max-w-xs truncate">
                        {row.query}
                      </span>
                    </Td>
                    <Td className="text-right tabular-nums">{number(row.clicks)}</Td>
                    <Td className="text-right tabular-nums">{number(row.impressions)}</Td>
                    <Td className="text-right tabular-nums">{Number(row.position).toFixed(1)}</Td>
                  </tr>
                ))
              ) : (
                <tr>
                  <Td className="text-muted-foreground">No data yet.</Td>
                </tr>
              )}
            </tbody>
          </Table>
        ) : null}
      </div>
    </Card>
  );
}
