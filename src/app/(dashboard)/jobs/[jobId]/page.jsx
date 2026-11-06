import { RelativeTime } from "@/components/relative-time";
import { z } from "zod";
import { parseListParams, enumFilter } from "@/lib/list-params";
import { readList } from "@/lib/lists";
import { ListToolbar } from "@/components/list-controls";
import { ListResults } from "@/components/list-results";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  Activity,
  ChevronRight,
  ExternalLink,
  FileSearch,
  FileText,
  ListChecks,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { Alert, Badge, ButtonLink, Card, PageHeader, Table, Td, Th } from "@/components/ui";
import { JobControls, UsageReconciliationForm } from "../job-controls";
import { RemoveDraftForm } from "@/components/draft-removal";
import { DraftJobState } from "@/components/draft-job-state";
import { canRemoveDraft } from "@/lib/draft-job-policy";

export default async function JobPage({ params, searchParams }) {
  const user = await requireUser();
  const { jobId } = await params;
  if (!z.uuid().safeParse(jobId).success) notFound();
  const db = await createClient();
  const { data: job } = await db
    .from("jobs")
    .select("*, websites(name, timezone), story_candidates(title, url, status)")
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
  const evidence = job.state.evidence ?? [];
  const research = job.state.research;
  const verification = job.state.verification;
  const reserved = (call) => ["reserved", "uncertain"].includes(call.status);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        back={{ href: "/jobs", label: "Draft jobs" }}
        title={job.story_candidates?.title ?? "Draft job"}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{job.websites?.name}</span>
            <span aria-hidden>·</span>
            <span>Step: {job.step.replaceAll("_", " ")}</span>
            {job.story_candidates?.url ? (
              <>
                <span aria-hidden>·</span>
                <a
                  href={job.story_candidates.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                >
                  Original story <ExternalLink aria-hidden className="size-3" />
                </a>
              </>
            ) : null}
          </span>
        }
        actions={
          canRemoveDraft(job, job.story_candidates?.status) ? (
            <RemoveDraftForm jobId={job.id} title={job.story_candidates?.title} />
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <Card
            icon={FileSearch}
            title={`Source evidence (${evidence.length})`}
            description="Pages found by web search plus any supporting URLs. Verify the original pages before approving an article."
          >
            {evidence.length ? (
              <ul className="divide-y overflow-hidden rounded-lg border">
                {evidence.map((page) => (
                  <li key={page.url}>
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                        <ChevronRight
                          aria-hidden
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                        />
                        <span className="min-w-0 flex-1">
                          <span dir="auto" className="block font-medium">
                            {page.title || page.url}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span>{page.publisher}</span>
                            <span aria-hidden>·</span>
                            <span>
                              {page.published_at ? `Published ${page.published_at.slice(0, 10)}` : "No date found"}
                            </span>
                            {page.primary ? <Badge tone="blue">primary source</Badge> : null}
                          </span>
                        </span>
                      </summary>
                      <div className="border-t bg-muted/20 px-4 py-3 pl-11">
                        <a
                          href={page.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 break-all text-sm font-medium text-primary hover:underline"
                        >
                          {page.url}
                          <ExternalLink aria-hidden className="size-3 shrink-0" />
                        </a>
                        <p
                          dir="auto"
                          className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground"
                        >
                          {page.text}
                        </p>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">No evidence collected yet.</p>
            )}
            {job.state.skipped_pages?.length ? (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  {job.state.skipped_pages.length} pages skipped
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {job.state.skipped_pages.map((page) => (
                    <li key={page.url} className="break-all text-xs text-muted-foreground">
                      <Badge className="mr-1.5">{page.reason}</Badge>
                      {page.url}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Card>

          {research ? (
            <Card icon={ListChecks} title="Research claims" description={<span dir="auto">{research.angle}</span>}>
              {research.corroboration ? (
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  <Badge tone={research.corroboration.met ? "green" : "amber"} dot>
                    {research.corroboration.met ? "corroborated" : "needs corroboration"}
                  </Badge>
                  <span>{research.corroboration.official ? "Official source" : "No official source"}</span>
                  <span aria-hidden>·</span>
                  <span>
                    {research.corroboration.outlets} independent site
                    {research.corroboration.outlets === 1 ? "" : "s"}
                  </span>
                  {research.corroboration.required ? <span>· sensitive story, two sites required</span> : null}
                  {job.state.corroboration_searched ? <span>· extra search done</span> : null}
                </div>
              ) : null}
              <ol className="space-y-3">
                {research.claims.map((claim, index) => (
                  <li key={index} className="flex gap-3 rounded-lg border p-3 text-sm">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p dir="auto" className="font-medium">
                        {claim.claim}
                      </p>
                      {claim.evidence.map((ref, i) => (
                        <blockquote key={i} dir="auto" className="mt-2 border-s-2 ps-3 text-muted-foreground italic">
                          {ref.quote}
                        </blockquote>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
              {research.unresolved?.length ? (
                <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                  <p className="font-medium">Not confirmed by the sources (left out of the draft)</p>
                  <ul className="mt-1.5 list-disc space-y-1 ps-5 text-muted-foreground">
                    {research.unresolved.map((item, i) => (
                      <li key={i} dir="auto">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>
          ) : null}

          <Card
            icon={Receipt}
            title="AI usage estimates"
            description="Calendar months use UTC. Uncertain calls keep their full reservation until reconciled; Google's bill is the real cost."
          >
            <ListToolbar path={`/jobs/${job.id}`} state={state} searchLabel="Search AI model" />
            <ListResults
              result={usageResult}
              path={`/jobs/${job.id}`}
              state={state}
              title="No AI calls yet"
              empty="Calls are recorded when the job runs."
            >
              <Table>
                <thead>
                  <tr>
                    <Th>Step</Th>
                    <Th>Model</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Tokens in / out</Th>
                    <Th className="text-right">Cost</Th>
                    <Th>When</Th>
                  </tr>
                </thead>
                <tbody>
                  {(usage ?? []).map((call) => (
                    <tr key={call.id}>
                      <Td className="capitalize">{call.operation}</Td>
                      <Td className="font-mono text-xs">{call.model}</Td>
                      <Td>
                        <Badge tone={call.status === "failed" ? "red" : reserved(call) ? "amber" : "green"}>
                          {call.status}
                        </Badge>
                        {user.isAdmin && reserved(call) ? <UsageReconciliationForm usageId={call.id} /> : null}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {Number(call.input_tokens ?? 0).toLocaleString()} /{" "}
                        {Number(call.output_tokens ?? 0).toLocaleString()}
                      </Td>
                      <Td className="text-right tabular-nums">
                        ${Number(reserved(call) ? call.reserved_cost_usd : call.estimated_cost_usd).toFixed(5)}
                        <span className="block text-xs text-muted-foreground">
                          {reserved(call) ? "reserved" : "estimated"}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <RelativeTime value={call.created_at} timezone={job.websites?.timezone} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </ListResults>
          </Card>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Card icon={Activity} title="Status">
            <DraftJobState job={job} timezone={job.websites?.timezone} />
            {job.last_error && !job.waiting_kind ? (
              <Alert tone={job.status === "failed" ? "error" : "info"} className="mt-4">
                {job.last_error}
              </Alert>
            ) : null}
            {job.article_id ? (
              <ButtonLink href={`/articles/${job.article_id}`} variant="secondary" className="mt-4 w-full">
                <FileText />
                Open the article
              </ButtonLink>
            ) : null}
          </Card>
          {verification ? (
            <Card
              icon={verification.passed ? ShieldCheck : ShieldAlert}
              title="AI verification"
              description="Checks the draft against the evidence. It does not replace editorial fact checking."
            >
              <Badge tone={verification.passed ? "green" : "red"} dot>
                {verification.passed ? "Passed, awaiting human review" : "Needs attention"}
              </Badge>
              {verification.issues.length ? (
                <ul className="mt-3 list-disc space-y-1.5 ps-5 text-sm">
                  {verification.issues.map((issue, i) => (
                    <li key={i} dir="auto">
                      {issue}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ) : null}
          {job.state.warnings?.length ? (
            <Card
              icon={TriangleAlert}
              title={`Warnings for the reviewer (${job.state.warnings.length})`}
              description="These did not stop the draft. They are copied into the article's review note."
            >
              <ul className="list-disc space-y-1.5 ps-5 text-sm">
                {job.state.warnings.map((warning, i) => (
                  <li key={i} dir="auto">
                    {warning}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {user.isAdmin && job.status !== "succeeded" ? (
            <Card icon={Wrench} title="Recovery">
              <JobControls jobId={job.id} status={job.status} />
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
