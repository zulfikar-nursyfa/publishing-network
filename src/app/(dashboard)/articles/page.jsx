import { PageHeader } from "@/components/ui";
import { ArticleTable } from "@/components/article-table";
import { ListToolbar } from "@/components/list-controls";
import { ListResults } from "@/components/list-results";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { allRows, listContext, readList } from "@/lib/lists";
import { ARTICLE_LIST_FIELDS, globalArticleList } from "@/lib/list-configs";

export const metadata = { title: "Articles" };
export default async function ArticlesPage({ searchParams }) {
  await requireUser();
  const db = await createClient();
  const { state, websites, timezone } = await listContext(db, await searchParams, globalArticleList);
  const categories = await allRows(() => {
    let query = db.from("categories").select("id, name").order("id");
    if (state.website !== "all") query = query.eq("website_id", state.website);
    return query;
  });
  const result = await readList(
    () => {
      let query = db.from("article_list").select(ARTICLE_LIST_FIELDS, { count: "exact" });
      if (state.scheduled !== "all")
        query = state.scheduled === "yes" ? query.not("scheduled_for", "is", null) : query.is("scheduled_for", null);
      return query;
    },
    state,
    timezone,
  );
  return (
    <>
      <PageHeader
        title="Articles"
        description={`All articles on your websites, including publishing failures. Dates use ${timezone}.`}
      />
      <ListToolbar
        path="/articles"
        state={state}
        websites={websites}
        choices={{
          category: [
            { value: "all", label: "All categories" },
            ...categories.map((category) => ({ value: category.id, label: category.name })),
          ],
        }}
      />
      <ListResults
        result={result}
        path="/articles"
        state={state}
        title="No articles yet"
        empty="Write an article from a website page or select a story for drafting."
      >
        <ArticleTable articles={result.data} websites={websites} path="/articles" state={state} />
      </ListResults>
    </>
  );
}
