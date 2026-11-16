import { ArrowRightLeft } from "lucide-react";
import { moveArticles } from "@/app/actions/move-articles";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import {
  Alert,
  ArticleStatusBadge,
  Card,
  Field,
  PageHeader,
  RowCheckbox,
  Table,
  Td,
  Th,
  formatDateTime,
  inputClass,
} from "@/components/ui";
import { requireWebsite } from "@/lib/auth";
import { toLocalInput } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";

// Server actions on this page get the same time; moveArticles stops at 240s and can be run again.
export const maxDuration = 300;

function inAnHour(timeZone) {
  return toLocalInput(new Date(Date.now() + 3_600_000), timeZone);
}

export default async function MoveArticlesPage({ params }) {
  const { websiteId } = await params;
  const { website } = await requireWebsite(websiteId);
  const db = await createClient();
  // RLS lists only the user's websites; the same niche and language rule is checked again on submit.
  let targetQuery = db
    .from("websites")
    .select("id, name, timezone")
    .neq("id", websiteId)
    .eq("language", website.language)
    .is("archived_at", null)
    .order("name");
  targetQuery = website.niche_id ? targetQuery.eq("niche_id", website.niche_id) : targetQuery.is("niche_id", null);
  const [{ data: targets }, { data: articles }] = await Promise.all([
    targetQuery,
    db
      .from("articles")
      .select("id, title, status, wp_post_id, published_at, created_at")
      .eq("website_id", websiteId)
      .in("status", ["published", "draft", "in_review", "rejected"])
      .order("published_at", { nullsFirst: false })
      .order("created_at"),
  ]);
  const { data: categories } = targets?.length
    ? await db
        .from("categories")
        .select("id, name, website_id")
        .in(
          "website_id",
          targets.map((target) => target.id),
        )
        .is("archived_at", null)
        .order("sort_order")
        .order("name")
    : { data: [] };
  const movable = (articles ?? []).filter(
    (article) => (article.status === "published") === Boolean(article.wp_post_id),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        back={{ href: `/websites/${websiteId}`, label: website.name }}
        title="Move articles"
        description={`Move ${website.name}'s articles to another website in the same niche and language.`}
      />
      {!targets?.length ? (
        <Alert tone="warning" title="No website to move to">
          Add a website with the same niche and language as {website.name} first.
        </Alert>
      ) : (
        <ActionForm action={moveArticles.bind(null, websiteId)} className="space-y-6">
          <Alert title="How it works">
            Published articles are copied and approved without review. Their posts stay live on {website.name}, and the
            copies are published with their original date, images, sources and SEO fields. Drafts, articles in review
            and rejected articles that never reached WordPress move with their status and still need review.
          </Alert>

          <Card icon={ArrowRightLeft} title="Where to">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Website" htmlFor="website_id">
                <select id="website_id" name="website_id" required defaultValue="" className={inputClass}>
                  <option value="" disabled>
                    Choose a website
                  </option>
                  {targets.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Category"
                htmlFor="category_id"
                hint="Used when the other website has no category with the same slug."
              >
                <select id="category_id" name="category_id" required defaultValue="" className={inputClass}>
                  <option value="" disabled>
                    Choose a category
                  </option>
                  {targets.map((target) => (
                    <optgroup key={target.id} label={target.name}>
                      {categories
                        .filter((category) => category.website_id === target.id)
                        .map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
            </div>
          </Card>

          <Card title="Publishing the copies">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="When" htmlFor="mode">
                <select id="mode" name="mode" defaultValue="now" className={inputClass}>
                  <option value="now">At once, one by one</option>
                  <option value="schedule">On a schedule</option>
                </select>
              </Field>
              <Field label="Schedule starts" htmlFor="start" hint="In the other website's timezone.">
                <input
                  id="start"
                  name="start"
                  type="datetime-local"
                  defaultValue={inAnHour(targets[0].timezone)}
                  className={inputClass}
                />
              </Field>
              <Field label="Minutes between posts" htmlFor="interval" hint="Only for a schedule.">
                <input
                  id="interval"
                  name="interval"
                  type="number"
                  min="1"
                  max="1440"
                  defaultValue="60"
                  required
                  className={inputClass}
                />
              </Field>
            </div>
          </Card>

          <Card title={`Articles (${movable.length})`}>
            <Field label="Which articles" htmlFor="scope" className="mb-4 max-w-xs">
              <select id="scope" name="scope" defaultValue="all" className={inputClass}>
                <option value="all">All articles</option>
                <option value="selected">Only the ticked ones</option>
              </select>
            </Field>
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
                {movable.map((article) => (
                  <tr key={article.id}>
                    <Td>
                      <RowCheckbox name="article_id" value={article.id} aria-label={`Move ${article.title}`} />
                    </Td>
                    <Td>{article.title}</Td>
                    <Td>
                      <ArticleStatusBadge status={article.status} />
                    </Td>
                    <Td>{article.published_at ? formatDateTime(article.published_at, website.timezone) : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <SubmitButton
            pendingLabel="Moving…"
            confirm="Move these articles? Published ones are copied and published without review; their old posts stay live."
            confirmLabel="Move articles"
          >
            <ArrowRightLeft />
            Move articles
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
