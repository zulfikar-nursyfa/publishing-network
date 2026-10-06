import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { researchUrlBlockReason } from "@/lib/automation/evidence";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { JobControls, UsageReconciliationForm } from "../job-controls";

export default async function JobPage({ params }) {
  const user = await requireUser();
  const { jobId } = await params;
  const db = await createClient();
  const { data: job } = await db.from("jobs").select("*, websites(name), story_candidates(title, url)").eq("id", jobId).maybeSingle();
  if (!job) notFound();
  let collectionBlock = null;
  if (job.status === "failed" && job.step === "collect") {
    const { data: sources, error } = await db.from("content_sources").select("name, url, active, research_allowed, attribution_note")
      .eq("website_id", job.website_id);
    if (!error) collectionBlock = researchUrlBlockReason(job.story_candidates?.url, sources ?? []);
  }
  const { data: usage } = await db.from("ai_usage").select("id, model, operation, status, input_tokens, output_tokens, estimated_cost_usd, reserved_cost_usd").eq("job_id", jobId).order("created_at");
  return <div className="mx-auto max-w-5xl space-y-6">
    <PageHeader back={{ href: "/jobs", label: "Draft jobs" }} title={job.story_candidates?.title ?? "Draft job"} description={`${job.websites?.name} · ${job.step.replaceAll("_", " ")}`} />
    <Badge tone={job.status === "failed" ? "red" : job.status === "succeeded" ? "green" : "blue"}>{job.status}</Badge>
    {job.last_error ? <Alert tone="error">{job.last_error}</Alert> : null}
    {collectionBlock ? <Card title="Current collection setup"><p className="text-sm">{collectionBlock}</p><Link className="mt-3 inline-block text-sm text-primary underline" href={`/websites/${job.website_id}/settings`}>Open this website&apos;s source settings</Link></Card> : null}
    {job.article_id ? <Alert tone="success"><Link className="underline" href={`/articles/${job.article_id}`}>Open the article in the review workflow</Link></Alert> : null}
    {user.isAdmin && job.status !== "succeeded" ? <Card title="Recovery"><JobControls jobId={job.id} status={job.status} /></Card> : null}
    <Card title="Source evidence" description="Collected under each source's research permission. Verify the original pages before approving an article.">
      <div className="space-y-4">{(job.state.evidence ?? []).map((page) => <details key={page.url} className="rounded-lg border p-3">
        <summary className="cursor-pointer font-medium">{page.title} {page.primary ? "(primary source)" : ""}</summary>
        <a href={page.url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-sm text-primary underline">{page.publisher}: {page.url}</a>
        <p dir="auto" className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{page.text}</p>
      </details>)}{!job.state.evidence?.length ? <p className="text-sm text-muted-foreground">No evidence collected yet.</p> : null}</div>
    </Card>
    {job.state.research ? <Card title="Research claims"><p dir="auto" className="mb-3 text-sm">{job.state.research.angle}</p><ul className="space-y-3">{job.state.research.claims.map((claim, index) => <li key={index} className="rounded-lg bg-muted/40 p-3 text-sm"><p dir="auto">{claim.claim}</p>{claim.evidence.map((ref, i) => <blockquote key={i} dir="auto" className="mt-2 border-l pl-3 text-muted-foreground">{ref.quote}</blockquote>)}</li>)}</ul></Card> : null}
    {job.state.verification ? <Card title="AI verification" description="This checks evidence consistency; it does not replace editorial fact checking."><Badge tone={job.state.verification.passed ? "green" : "red"}>{job.state.verification.passed ? "Passed, awaiting human review" : "Needs attention"}</Badge>{job.state.verification.issues.map((issue, i) => <p key={i} className="mt-2 text-sm">{issue}</p>)}</Card> : null}
    <Card title="AI usage estimates" description="Calendar months use UTC. Uncertain calls retain their full reservation until reconciled; provider billing is authoritative.">
      <ul className="space-y-2 text-sm">{(usage ?? []).map((call) => <li key={call.id}>{call.operation} · {call.model} · {call.status} · {call.input_tokens} input / {call.output_tokens} output tokens · ${Number(["reserved", "uncertain"].includes(call.status) ? call.reserved_cost_usd : call.estimated_cost_usd).toFixed(5)} { ["reserved", "uncertain"].includes(call.status) ? "reserved" : "estimated"}{user.isAdmin && ["reserved", "uncertain"].includes(call.status) ? <UsageReconciliationForm usageId={call.id} /> : null}</li>)}</ul>
    </Card>
  </div>;
}
