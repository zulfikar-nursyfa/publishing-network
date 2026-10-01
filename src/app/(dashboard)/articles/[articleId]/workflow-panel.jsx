"use client";

import { useActionState } from "react";
import { Check, CircleCheck, RotateCcw, Send, Undo2, Workflow, X } from "lucide-react";
import { publishArticleAction, resetPublicationAttempts, transitionArticle } from "@/app/actions/articles";
import { FormAlert, SubmitButton } from "@/components/form-controls";
import { Alert, Card, cn, inputClass } from "@/components/ui";

const STEPS = [
  { key: "draft", label: "Draft" },
  { key: "in_review", label: "Review" },
  { key: "approved", label: "Approved" },
  { key: "published", label: "Live" },
];

function Stepper({ status }) {
  const offTrack = status === "rejected" || status === "unpublished";
  const current = STEPS.findIndex((step) => step.key === status);
  return (
    <ol className="mb-5 grid grid-cols-4 gap-1.5">
      {STEPS.map((step, index) => {
        const done = !offTrack && index < current;
        const active = !offTrack && index === current;
        return (
          <li key={step.key} className="space-y-1.5">
            <div className={cn("h-1.5 rounded-full", done || active ? "bg-primary" : "bg-muted", active && step.key === "published" && "bg-emerald-500")} />
            <div className={cn("text-[0.7rem] font-medium", active ? "text-foreground" : "text-muted-foreground")}>{step.label}</div>
          </li>
        );
      })}
    </ol>
  );
}

export function WorkflowPanel({
  articleId,
  status,
  isAdmin,
  websiteArchived,
  publication,
}) {
  const [transitionState, transitionAction] = useActionState(transitionArticle.bind(null, articleId), {});
  const [publishState, publishAction] = useActionState(publishArticleAction.bind(null, articleId), {});
  const exhausted = publication !== null && publication.status !== "succeeded" && publication.attemptCount >= publication.maxAttempts;

  return (
    <Card icon={Workflow} title="Review and publish">
      <Stepper status={status} />
      <div className="space-y-4">
        <FormAlert state={transitionState} />
        <FormAlert state={publishState} />

        {status === "rejected" ? <Alert tone="error">This article was rejected. Submit it for review again once it has been revised.</Alert> : null}
        {status === "unpublished" ? <Alert tone="info">This article was removed from WordPress.</Alert> : null}

        {status === "published" ? (
          <div className="flex items-center gap-2.5 rounded-lg bg-emerald-500/10 px-3 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <CircleCheck className="size-4" />
            This article is live on WordPress.
          </div>
        ) : null}

        {status === "approved" && !websiteArchived ? (
          <form action={publishAction} className="space-y-2">
            <SubmitButton
              variant="success"
              size="lg"
              className="w-full"
              pendingLabel="Publishing to WordPress…"
              confirm="Publish this article to the live WordPress site now?"
              confirmLabel="Publish now"
            >
              <Send />
              {publication?.status === "failed" ? "Retry publishing" : "Publish to WordPress"}
            </SubmitButton>
            {publication?.status === "failed" ? (
              <p className="text-xs text-muted-foreground">
                Attempt {publication.attemptCount} of {publication.maxAttempts} failed. Retrying checks WordPress first, so it will not create a duplicate post.
              </p>
            ) : null}
          </form>
        ) : null}

        {publication?.lastError && status !== "published" ? (
          <Alert tone="error" title="Last publishing error">
            <span className="block text-xs whitespace-pre-wrap">{publication.lastError}</span>
          </Alert>
        ) : null}

        {exhausted && isAdmin ? (
          <form action={resetPublicationAttempts.bind(null, articleId)}>
            <SubmitButton
              variant="secondary"
              className="w-full"
              confirm="Reset the retry counter? Do this after fixing the cause of the failures."
              confirmLabel="Reset attempts"
            >
              <RotateCcw />
              Reset retry attempts
            </SubmitButton>
          </form>
        ) : null}

        {status !== "published" ? (
          <form action={transitionAction} className="space-y-3 border-t pt-4">
            {status === "in_review" || status === "approved" || status === "draft" ? (
              <textarea name="note" rows={2} className={inputClass} placeholder="Review note (required to reject)" />
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              {status === "draft" || status === "rejected" ? (
                <SubmitButton name="transition" value="submit" variant="secondary" className="col-span-2">
                  <Send />
                  Submit for review
                </SubmitButton>
              ) : null}
              {status === "draft" || status === "in_review" ? (
                <SubmitButton name="transition" value="approve" variant="primary" className={status === "draft" ? "col-span-2" : undefined}>
                  <Check />
                  Approve
                </SubmitButton>
              ) : null}
              {status === "in_review" || status === "approved" ? (
                <SubmitButton name="transition" value="reject" variant="danger-outline" className={status === "approved" ? "col-span-2" : undefined}>
                  <X />
                  Reject
                </SubmitButton>
              ) : null}
              {status === "in_review" || status === "approved" || status === "rejected" ? (
                <SubmitButton name="transition" value="return_to_draft" variant="ghost" className="col-span-2">
                  <Undo2 />
                  Return to draft
                </SubmitButton>
              ) : null}
            </div>
          </form>
        ) : null}
      </div>
    </Card>
  );
}
