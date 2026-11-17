import { ArrowRightLeft } from "lucide-react";
import { moveArticles } from "@/app/actions/move-articles";
import { ActionForm, SubmitButton } from "@/components/form-controls";
import { Alert, Card, Field, PageHeader, formatDateTime, inputClass } from "@/components/ui";
import { requireWebsite } from "@/lib/auth";
import { MOVABLE_STATUSES, canMove } from "@/lib/move-scopes";
import { toLocalInput } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { ArticlePicker } from "./article-picker";

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
      .in("status", MOVABLE_STATUSES)
      .order("published_at", { nullsFirst: false })
      .order("created_at"),
  ]);
  const targetIds = (targets ?? []).map((target) => target.id);
  const [{ data: categories }, { data: copies }] = targetIds.length
    ? await Promise.all([
        db
          .from("categories")
          .select("id, name, website_id")
          .in("website_id", targetIds)
          .is("archived_at", null)
          .order("sort_order")
          .order("name"),
        db
          .from("articles")
          .select("copied_from, website_id")
          .in("website_id", targetIds)
          .not("copied_from", "is", null),
      ])
    : [{ data: [] }, { data: [] }];
  const movable = (articles ?? []).filter(canMove).map((article) => ({
    ...article,
    publishedLabel: article.published_at ? formatDateTime(article.published_at, website.timezone) : "—",
    // Websites that already have a copy; moveArticles skips it for those.
    copiedTo: (copies ?? []).filter((copy) => copy.copied_from === article.id).map((copy) => copy.website_id),
  }));

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
            and rejected articles that never reached WordPress move with their status and still need review; approved
            ones move and stay approved, or are published like the copies if you choose that below. Each article keeps
            its category: categories the other website lacks are added there and linked to WordPress.
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
                hint="Only for articles without a category. When an admin moves, missing categories are created."
              >
                <select id="category_id" name="category_id" defaultValue="" className={inputClass}>
                  <option value="">Keep each article&apos;s category</option>
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
            <div className="grid gap-4 sm:grid-cols-2">
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
              <Field
                label="Approved articles"
                htmlFor="approved"
                hint="Automated ones can still take the other website's publishing slots."
              >
                <select id="approved" name="approved" defaultValue="keep" className={inputClass}>
                  <option value="keep">Stay approved, not scheduled</option>
                  <option value="publish">Publish with the copies</option>
                </select>
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
            <ArticlePicker articles={movable} targets={targets} />
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
