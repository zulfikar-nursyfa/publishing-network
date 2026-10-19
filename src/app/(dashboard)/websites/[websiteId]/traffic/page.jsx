import Link from "next/link";
import { z } from "zod";
import { PageHeader, Table, Td, FilterTabs } from "@/components/ui";
import { WebsiteNav } from "@/components/website-nav";
import { ListToolbar, SortTh } from "@/components/list-controls";
import { ListResults } from "@/components/list-results";
import { requireWebsite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readList } from "@/lib/lists";
import { parseListParams, listHref } from "@/lib/list-params";
import { pageTrafficList, searchTrafficList } from "@/lib/list-configs";

export default async function TrafficListPage({ params, searchParams }) {
  const { websiteId } = await params;
  const { website } = await requireWebsite(websiteId);
  const input = await searchParams;
  const type = z.enum(["pages", "searches"]).catch("pages").parse(input.type);
  const state = parseListParams(input, {
    ...(type === "searches" ? searchTrafficList : pageTrafficList),
    filters: {
      ...(type === "searches"
        ? {
            path: {
              label: "Page path (blank = whole site)",
              text: true,
              max: 2000,
              pattern: /^(?:\/.*)?$/u,
              default: "",
            },
          }
        : {}),
      type: { label: "Type", options: [{ value: "pages" }, { value: "searches" }], default: "pages", hidden: true },
    },
  });
  const db = await createClient();
  const path = `/websites/${websiteId}/traffic`;
  const result = await readList(() => {
    let query = db
      .from(type === "searches" ? "website_search_queries" : "website_traffic_pages")
      .select(type === "searches" ? "*" : "*, article:articles(id, title)", { count: "exact" })
      .eq("website_id", websiteId);
    if (type === "searches") query = query.eq("path", state.path);
    return query;
  }, state);
  const columns =
    type === "searches" ? ["clicks", "impressions", "position", "ctr"] : ["views", "clicks", "impressions", "users"];
  const key = {
    views: "page_views",
    clicks: "clicks",
    impressions: "impressions",
    users: "users",
    position: "position",
    ctr: "ctr",
  };
  return (
    <>
      <PageHeader
        title={`${website.name}: traffic`}
        back={{ href: `/websites/${websiteId}?section=traffic`, label: website.name }}
        description="Stored top pages and Google searches for the last 28 days. A traffic sync replaces this snapshot."
      />
      <WebsiteNav websiteId={websiteId} active="traffic" />
      <FilterTabs
        active={type}
        items={["pages", "searches"].map((value) => ({
          key: value,
          label: value,
          href: listHref(path, state, { type: value, sort: value === "pages" ? "views" : "clicks", q: "", path: "" }),
        }))}
      />
      <ListToolbar
        path={path}
        state={state}
        searchLabel={type === "searches" ? "Search Google queries" : "Search URL paths"}
      />
      <ListResults
        result={result}
        path={path}
        state={state}
        title="No traffic snapshot yet"
        empty="Connect Google Analytics / Search Console in website settings and run a traffic update."
      >
        <Table>
          <thead>
            <tr>
              <SortTh path={path} state={state} column={type === "searches" ? "query" : "path"}>
                {type === "searches" ? "Search" : "Page"}
              </SortTh>
              {columns.map((column) => (
                <SortTh key={column} path={path} state={state} column={column}>
                  {column}
                </SortTh>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.data.map((row) => (
              <tr key={row.query ?? row.path}>
                <Td className="min-w-52 max-w-lg">
                  <span dir="auto">
                    {row.article ? (
                      <Link href={`/articles/${row.article.id}`} className="hover:underline">
                        {row.article.title}
                      </Link>
                    ) : (
                      (row.query ?? row.path)
                    )}
                  </span>
                </Td>
                {columns.map((column) => (
                  <Td key={column} className="tabular-nums">
                    {row[key[column]] ?? "—"}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </ListResults>
    </>
  );
}
