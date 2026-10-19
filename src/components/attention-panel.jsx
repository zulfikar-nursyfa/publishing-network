import Link from "next/link";
import { Alert, Card } from "./ui";
import { allRows } from "@/lib/lists";

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
  const results = await Promise.all(definitions.map(([, , query]) => query));
  const slots = await allRows(() => db.from("slot_attention").select("website_id, total").order("website_id")).catch(
    () => null,
  );
  return (
    <Card title="Needs attention" description="Open a filtered list to review each problem." className="mb-8">
      {results.some((result) => result.error) || !slots ? (
        <Alert tone="warning">
          Some attention counts are unavailable. Apply pending dashboard migrations or retry.
        </Alert>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
            <span>Skipped / failed slots today · view website</span>
            <strong>{slot.total}</strong>
          </Link>
        ))}
      </div>
      {results.every((result) => !result.error && result.count === 0) && slots?.length === 0 ? (
        <p className="text-sm text-muted-foreground">All clear. There are no outstanding problems.</p>
      ) : null}
    </Card>
  );
}
