import { PageHeader } from "@/components/ui";
import { ArticleTable } from "@/components/article-table";
import { ListToolbar } from "@/components/list-controls";
import { ListResults } from "@/components/list-results";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { allRows, listContext, readList } from "@/lib/lists";
import { ARTICLE_LIST_FIELDS, reviewList } from "@/lib/list-configs";

export const metadata = { title: "Review queue" };
export default async function ReviewPage({ searchParams }) {
  await requireUser();
  const db = await createClient();
  const { state, websites, timezone } = await listContext(db, await searchParams, reviewList);
  const [categories, result] = await Promise.all([
    allRows(() => {
      let query = db.from("categories").select("id, name").order("name").order("id");
      if (state.website !== "all") query = query.eq("website_id", state.website);
      return query;
    }),
    readList(
      () =>
        db.from("article_list").select(ARTICLE_LIST_FIELDS, { count: "exact" }).in("status", ["in_review", "approved"]),
      state,
      timezone,
    ),
  ]);
  return (
    <>
      <PageHeader title="Review queue" description={`Articles in review and ready to publish · ${timezone}`} />
      <ListToolbar
        path="/review"
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
        path="/review"
        state={state}
        title="Inbox zero"
        empty="No articles are waiting for review or publishing."
      >
        <ArticleTable articles={result.data} websites={websites} path="/review" state={state} review />
      </ListResults>
    </>
  );
}
