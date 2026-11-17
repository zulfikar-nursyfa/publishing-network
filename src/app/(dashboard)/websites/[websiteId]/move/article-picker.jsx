"use client";

import { useState } from "react";
import { ArticleStatusBadge, Field, RowCheckbox, Table, Td, Th, inputClass } from "@/components/ui";

const STATUSES = ["published", "approved", "in_review", "draft", "rejected"];
const SORTS = {
  newest: (a, b) => (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at),
  oldest: (a, b) => (a.published_at ?? a.created_at).localeCompare(b.published_at ?? b.created_at),
  title: (a, b) => a.title.localeCompare(b.title),
  status: (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) || SORTS.newest(a, b),
};

/** Filtered-out rows are hidden, not removed, so their ticks still count for "Only the ticked ones". */
export function ArticlePicker({ articles }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const needle = query.trim().toLowerCase();
  const shows = (article) =>
    (!status || article.status === status) && (!needle || article.title.toLowerCase().includes(needle));
  const rows = articles.toSorted(SORTS[sort]);
  const shown = rows.filter(shows).length;

  return (
    <>
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Field label="Search titles" htmlFor="move_query">
          <input
            id="move_query"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Status" htmlFor="move_status">
          <select
            id="move_status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={inputClass}
          >
            <option value="">Any status</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value.replace("_", " ")}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sort" htmlFor="move_sort">
          <select id="move_sort" value={sort} onChange={(event) => setSort(event.target.value)} className={inputClass}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title A–Z</option>
            <option value="status">Status</option>
          </select>
        </Field>
      </div>
      <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
        Showing {shown} of {articles.length}
      </p>
      <Table>
        <thead>
          <tr>
            <Th className="w-10">
              <span className="sr-only">Move</span>
            </Th>
            <Th>Title</Th>
            <Th>Status</Th>
            <Th>Published</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((article) => (
            <tr key={article.id} hidden={!shows(article)}>
              <Td>
                <RowCheckbox name="article_id" value={article.id} aria-label={`Move ${article.title}`} />
              </Td>
              <Td>{article.title}</Td>
              <Td>
                <ArticleStatusBadge status={article.status} />
              </Td>
              <Td>{article.publishedLabel}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
