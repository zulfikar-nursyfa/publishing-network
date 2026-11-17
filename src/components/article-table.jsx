import Link from "next/link";
import { ArticleStatusBadge, Badge, Table, Td, Th, linkClass } from "./ui";
import { SortTh } from "./list-controls";
import { RelativeTime } from "./relative-time";

export function ArticleTable({ articles, websites, path, state, review = false }) {
  const sites = new Map(websites.map((site) => [site.id, site]));
  return (
    <Table>
      <thead>
        <tr>
          <SortTh path={path} state={state} column="title">
            Article
          </SortTh>
          <Th>Website</Th>
          <Th>Status</Th>
          <Th>Origin</Th>
          <SortTh path={path} state={state} column={review ? "submitted" : "updated"}>
            {review ? "Waiting since" : "Updated"}
          </SortTh>
          {!review ? (
            <SortTh path={path} state={state} column="published">
              Published
            </SortTh>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {articles.map((article) => {
          const site = sites.get(article.website_id);
          return (
            <tr key={article.id}>
              <Td className="min-w-52 max-w-md">
                <Link
                  href={`/articles/${article.id}${review ? "?from=review" : ""}`}
                  dir="auto"
                  className={`${linkClass} line-clamp-2`}
                >
                  {article.title}
                </Link>
                <div className="mt-1 flex flex-wrap gap-1">
                  {article.sensitive ? <Badge tone="amber">sensitive</Badge> : null}
                  {article.has_warnings ? <Badge tone="amber">reviewer warnings</Badge> : null}
                  {article.publication_status === "failed" ? <Badge tone="red">publishing failed</Badge> : null}
                  {site?.archived_at ? <Badge tone="gray">website archived</Badge> : null}
                </div>
              </Td>
              <Td>{site?.name ?? "—"}</Td>
              <Td>
                <ArticleStatusBadge status={article.status} />
              </Td>
              <Td>
                <Badge tone={article.origin === "automated" ? "purple" : "gray"}>{article.origin}</Badge>
              </Td>
              <Td className="whitespace-nowrap">
                <RelativeTime
                  value={review ? (article.submitted_at ?? article.updated_at) : article.updated_at}
                  timezone={site?.timezone}
                />
              </Td>
              {!review ? (
                <Td className="whitespace-nowrap">
                  <RelativeTime value={article.published_at} timezone={site?.timezone} />
                </Td>
              ) : null}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
