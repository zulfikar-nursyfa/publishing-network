import Link from "next/link";
import { Alert, Card } from "./ui";
import { allRows } from "@/lib/lists";
import { DraftJobState } from "./draft-job-state";

export async function AttentionPanel({ db }) {
  const definitions = [
    [
      "Articles waiting for review",
      "/review?status=in_review&website=all",
      db.from("articles").select("id", { count: "exact", head: true }).eq("status", "in_review"),
    ],
    [
      "Failed draft jobs",
      "/jobs?status=failed&website=all",
      db.from("jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
    ],
    [
      "Failed publications",
      "/articles?publication=failed&website=all",
      db.from("publications").select("article_id", { count: "exact", head: true }).eq("status", "failed"),
    ],
    [
      "Websites near their AI limit",
      "/websites?problem=budget",
      db
        .from("website_list")
        .select("id", { count: "exact", head: true })
        .eq("near_budget", true)
        .is("archived_at", null),
    ],
    [
      "Source feeds with errors",
      "/sources?errors=errors&website=all",
      db.from("content_sources").select("id", { count: "exact", head: true }).not("last_error", "is", null),
    ],
    [
      "Traffic sync errors",
      "/websites?problem=traffic",
      db
        .from("websites")
        .select("id", { count: "exact", head: true })
        .not("traffic_error", "is", null)
        .is("archived_at", null),
    ],
  ];
  const [results, { data: waiting = [], error: waitingError, count: waitingCount }, slots] = await Promise.all([
    Promise.all(definitions.map(([, , query]) => query)),
    db
      .from("job_list")
      .select("*", { count: "exact" })
      .eq("status", "queued")
      .not("waiting_kind", "is", null)
      .order("waiting_since")
      .limit(3),
    allRows(() => db.from("slot_attention").select("website_id, total").order("website_id")).catch(() => null),
  ]);
  return (
    <Card title="Needs attention" className="mb-6">
      {results.some((result) => result.error) || !slots || waitingError ? (
        <Alert tone="warning">
          Some attention counts are unavailable. Apply pending dashboard migrations or retry.
        </Alert>
      ) : null}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-2">
        {definitions.map(([label, href], index) =>
          results[index].count > 0 ? (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm hover:bg-muted"
            >
              <span>{label}</span>
              <strong className="tabular-nums">{results[index].count}</strong>
            </Link>
          ) : null,
        )}
        {slots?.map((slot) => (
          <Link
            key={slot.website_id}
            href={`/websites/${slot.website_id}?section=schedule&period=today&status=problems`}
            className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm hover:bg-muted"
          >
            <span>Publishing slot problems today</span>
            <strong className="tabular-nums">{slot.total}</strong>
          </Link>
        ))}
      </div>
      {waiting?.length ? (
        <div className="mt-4 space-y-3 border-t pt-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <h3 className="font-medium">Waiting drafts · {waitingCount}</h3>
            <Link href="/jobs?status=queued&website=all" className="underline underline-offset-4">
              View draft jobs
            </Link>
          </div>
          {waiting.map((job) => (
            <div key={job.id} className="grid gap-2 sm:grid-cols-2">
              <div>
                <Link href={`/jobs/${job.id}`} className="text-sm font-medium hover:underline" dir="auto">
                  {job.story_title}
                </Link>
                <p className="text-xs text-muted-foreground">{job.website_name}</p>
              </div>
              <DraftJobState job={job} timezone={job.timezone} />
            </div>
          ))}
        </div>
      ) : null}
      {results.every((result) => !result.error && result.count === 0) &&
      slots?.length === 0 &&
      !waitingCount &&
      !waitingError ? (
        <p className="text-sm text-muted-foreground">All clear. There are no outstanding problems.</p>
      ) : null}
    </Card>
  );
}
