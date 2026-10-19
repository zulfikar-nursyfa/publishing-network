import { RelativeTime } from "@/components/relative-time";
import { z } from "zod";
import { parseListParams, enumFilter } from "@/lib/list-params";
import { readList } from "@/lib/lists";
import { ListToolbar } from "@/components/list-controls";
import { ListResults } from "@/components/list-results";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { JobControls, UsageReconciliationForm } from "../job-controls";

export default async function JobPage({ params, searchParams }) {
  const user = await requireUser();
  const { jobId } = await params;
  if (!z.uuid().safeParse(jobId).success) notFound();
  const db = await createClient();
  const { data: job } = await db
    .from("jobs")
    .select("*, websites(name, timezone), story_candidates(title, url)")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) notFound();
  const state = parseListParams(await searchParams, {
    sorts: { created: "created_at", operation: "operation", model: "model" },
    defaultSort: "created",
    search: ["model"],
    dateColumn: "created_at",
    filters: {
      status: enumFilter(
        "Call status",
        ["all", "reserved", "uncertain", "completed", "failed", "reconciled"],
        "status",
      ),
      operation: enumFilter("Operation", ["all", "search", "research", "draft", "verify", "illustrate"], "operation"),
    },
  });
  const usageResult = await readList(
    () => db.from("ai_usage").select("*", { count: "exact" }).eq("job_id", jobId),
    state,
    job.websites?.timezone ?? "UTC",
  );
  const usage = usageResult.data;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        back={{ href: "/jobs", label: "Draft jobs" }}
        title={job.story_candidates?.title ?? "Draft job"}
        description={`${job.websites?.name} · ${job.step.replaceAll("_", " ")}`}
      />
      <Badge tone={job.status === "failed" ? "red" : job.status === "succeeded" ? "green" : "blue"}>{job.status}</Badge>
      {job.last_error ? <Alert tone="error">{job.last_error}</Alert> : null}
      {job.state.warnings?.length ? (
        <Card
          title="Warnings for the reviewer"
          description="These did not stop the draft. They are copied into the article's review note."
        >
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {job.state.warnings.map((warning, i) => (
              <li key={i} dir="auto">
                {warning}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {job.article_id ? (
        <Alert tone="success">
          <Link className="underline" href={`/articles/${job.article_id}`}>
            Open the article in the review workflow
          </Link>
        </Alert>
      ) : null}
      {user.isAdmin && job.status !== "succeeded" ? (
        <Card title="Recovery">
          <JobControls jobId={job.id} status={job.status} />
        </Card>
      ) : null}
      <Card
        title="Source evidence"
        description="Pages found by web search plus any supporting URLs. Verify the original pages before approving an article."
      >
        <div className="space-y-4">
          {(job.state.evidence ?? []).map((page) => (
            <details key={page.url} className="rounded-lg border p-3">
              <summary className="cursor-pointer font-medium">
                {page.title} {page.primary ? "(primary source)" : ""}
              </summary>
              <a
                href={page.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block break-all text-sm text-primary underline"
              >
                {page.publisher}: {page.url}
              </a>
              <p className="mt-1 text-xs text-muted-foreground">
                {page.published_at ? `Published ${page.published_at.slice(0, 10)}` : "No publication date found"}
              </p>
              <p dir="auto" className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {page.text}
              </p>
            </details>
          ))}
          {!job.state.evidence?.length ? (
            <p className="text-sm text-muted-foreground">No evidence collected yet.</p>
          ) : null}
        </div>
        {job.state.skipped_pages?.length ? (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              {job.state.skipped_pages.length} pages skipped
            </summary>
            <ul className="mt-2 space-y-1">
              {job.state.skipped_pages.map((page) => (
                <li key={page.url} className="break-all text-muted-foreground">
                  {page.reason} · {page.url}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Card>
      {job.state.research ? (
        <Card title="Research claims">
          <p dir="auto" className="mb-3 text-sm">
            {job.state.research.angle}
          </p>
          {job.state.research.corroboration ? (
            <p className="mb-3 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <Badge tone={job.state.research.corroboration.met ? "green" : "amber"}>
                {job.state.research.corroboration.met ? "corroborated" : "needs corroboration"}
              </Badge>
              {job.state.research.corroboration.official ? "Official source" : "No official source"} ·{" "}
              {job.state.research.corroboration.outlets} independent site
              {job.state.research.corroboration.outlets === 1 ? "" : "s"}
              {job.state.research.corroboration.required ? " · sensitive story, two sites required" : ""}
              {job.state.corroboration_searched ? " · extra search done" : ""}
            </p>
          ) : null}
          <ul className="space-y-3">
            {job.state.research.claims.map((claim, index) => (
              <li key={index} className="rounded-lg bg-muted/40 p-3 text-sm">
                <p dir="auto">{claim.claim}</p>
                {claim.evidence.map((ref, i) => (
                  <blockquote key={i} dir="auto" className="mt-2 border-l pl-3 text-muted-foreground">
                    {ref.quote}
                  </blockquote>
                ))}
              </li>
            ))}
          </ul>
          {job.state.research.unresolved?.length ? (
            <div className="mt-4 text-sm">
              <p className="font-medium">Not confirmed by the sources (left out of the draft)</p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {job.state.research.unresolved.map((item, i) => (
                  <li key={i} dir="auto">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : null}
      {job.state.verification ? (
        <Card
          title="AI verification"
          description="This checks evidence consistency; it does not replace editorial fact checking."
        >
          <Badge tone={job.state.verification.passed ? "green" : "red"}>
            {job.state.verification.passed ? "Passed, awaiting human review" : "Needs attention"}
          </Badge>
          {job.state.verification.issues.map((issue, i) => (
            <p key={i} className="mt-2 text-sm">
              {issue}
            </p>
          ))}
        </Card>
      ) : null}
      <Card
        title="AI usage estimates"
        description="Calendar months use UTC. Uncertain calls retain their full reservation until reconciled; provider billing is authoritative."
      >
        <ListToolbar path={`/jobs/${job.id}`} state={state} searchLabel="Search AI model" />
        <ListResults
          result={usageResult}
          path={`/jobs/${job.id}`}
          state={state}
          title="No AI calls yet"
          empty="Calls are recorded when the job runs."
        >
          <ul className="space-y-2 text-sm">
            {(usage ?? []).map((call) => (
              <li key={call.id}>
                <RelativeTime value={call.created_at} timezone={job.websites?.timezone} /> · {call.operation} ·{" "}
                {call.model} · {call.status} · {call.input_tokens} input / {call.output_tokens} output tokens · $
                {Number(
                  ["reserved", "uncertain"].includes(call.status) ? call.reserved_cost_usd : call.estimated_cost_usd,
                ).toFixed(5)}{" "}
                {["reserved", "uncertain"].includes(call.status) ? "reserved" : "estimated"}
                {user.isAdmin && ["reserved", "uncertain"].includes(call.status) ? (
                  <UsageReconciliationForm usageId={call.id} />
                ) : null}
              </li>
            ))}
          </ul>
        </ListResults>
      </Card>
    </div>
  );
}
