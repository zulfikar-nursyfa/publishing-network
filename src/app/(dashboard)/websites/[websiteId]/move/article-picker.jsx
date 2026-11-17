"use client";

import { useEffect, useState } from "react";
import { ArticleStatusBadge, Field, RowCheckbox, Table, Td, Th, checkboxClass, inputClass } from "@/components/ui";
import { MOVE_SCOPES } from "@/lib/move-scopes";

const STATUSES = ["published", "approved", "in_review", "draft", "rejected"];
const SORTS = {
  newest: (a, b) => (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at),
  oldest: (a, b) => (a.published_at ?? a.created_at).localeCompare(b.published_at ?? b.created_at),
  title: (a, b) => a.title.localeCompare(b.title),
  status: (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) || SORTS.newest(a, b),
};

/**
 * The scope and the ticks go together: ticking a row switches to "Only the ticked ones", choosing another
 * scope clears the ticks. Filtered-out rows are hidden, not removed, so their ticks still count.
 */
export function ArticlePicker({ articles, targets }) {
  const [scope, setScope] = useState("all");
  const [ticked, setTicked] = useState(() => new Set());
  const [targetId, setTargetId] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");

  // The website select lives in another card of the same form.
  useEffect(() => {
    const select = document.getElementById("website_id");
    if (!select) return;
    const update = () => setTargetId(select.value);
    update();
    select.addEventListener("change", update);
    return () => select.removeEventListener("change", update);
  }, []);

  const target = targets.find((item) => item.id === targetId);
  const alreadyThere = (article) => article.copiedTo.includes(targetId);
  const needle = query.trim().toLowerCase();
  const shows = (article) =>
    (!status || article.status === status) && (!needle || article.title.toLowerCase().includes(needle));
  const rows = articles.toSorted(SORTS[sort]);
  const shown = rows.filter(shows);
  const tickable = shown.filter((article) => !alreadyThere(article));
  const allTicked = tickable.length > 0 && tickable.every((article) => ticked.has(article.id));
  const moving = articles.filter(
    (article) => !alreadyThere(article) && MOVE_SCOPES[scope].includes(article, ticked),
  ).length;

  const tick = (ids, on) => {
    setTicked((current) => {
      const next = new Set(current);
      for (const id of ids) on ? next.add(id) : next.delete(id);
      return next;
    });
    if (on) setScope("selected");
  };

  return (
    <>
      <Field label="Which articles" htmlFor="scope" className="mb-4 max-w-xs">
        <select
          id="scope"
          name="scope"
          value={scope}
          onChange={(event) => {
            setScope(event.target.value);
            if (event.target.value !== "selected") setTicked(new Set());
          }}
          className={inputClass}
        >
          {Object.entries(MOVE_SCOPES).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
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
        Showing {shown.length} of {articles.length}.{" "}
        {target ? (
          <span className="font-medium text-foreground">
            {moving} will move to {target.name}.
          </span>
        ) : (
          "Choose a website above to see what will move."
        )}
      </p>
      <Table>
        <thead>
          <tr>
            <Th className="w-10">
              <input
                type="checkbox"
                aria-label="Tick all shown articles"
                className={checkboxClass}
                checked={allTicked}
                disabled={!tickable.length}
                onChange={(event) =>
                  tick(
                    tickable.map((article) => article.id),
                    event.target.checked,
                  )
                }
              />
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
                <RowCheckbox
                  name="article_id"
                  value={article.id}
                  aria-label={`Move ${article.title}`}
                  checked={ticked.has(article.id)}
                  disabled={alreadyThere(article)}
                  onChange={(event) => tick([article.id], event.target.checked)}
                />
              </Td>
              <Td>
                {article.title}
                {alreadyThere(article) ? (
                  <span className="block text-xs text-muted-foreground">Already on {target.name}</span>
                ) : null}
              </Td>
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
