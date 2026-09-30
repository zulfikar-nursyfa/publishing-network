"use client";

import { useActionState } from "react";
import { publishArticleAction, resetPublicationAttempts, transitionArticle } from "@/app/actions/articles";
import { FormAlert, SubmitButton } from "@/components/form-controls";
import { Card, inputClass } from "@/components/ui";

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
    <Card title="Review and publish">
      <div className="space-y-4">
        <FormAlert state={transitionState} />
        <FormAlert state={publishState} />

        {status === "published" ? (
          <p className="text-sm text-gray-700">This article is live on WordPress.</p>
        ) : null}

        {status === "approved" && !websiteArchived ? (
          <form action={publishAction} className="space-y-2">
            <SubmitButton
              variant="success"
              className="w-full"
              pendingLabel="Publishing to WordPress…"
              confirm="Publish this article to the live WordPress site now?"
            >
              {publication?.status === "failed" ? "Retry publishing" : "Publish to WordPress"}
            </SubmitButton>
            {publication?.status === "failed" ? (
              <p className="text-xs text-gray-500">
                Attempt {publication.attemptCount} of {publication.maxAttempts} failed. Retrying checks WordPress first, so it will not create a duplicate post.
              </p>
            ) : null}
          </form>
        ) : null}

        {publication?.lastError && status !== "published" ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
            <div className="font-semibold">Last publishing error</div>
            <div className="mt-0.5 whitespace-pre-wrap">{publication.lastError}</div>
          </div>
        ) : null}

        {exhausted && isAdmin ? (
          <form action={resetPublicationAttempts.bind(null, articleId)}>
            <SubmitButton variant="secondary" className="w-full" confirm="Reset the retry counter? Do this after fixing the cause of the failures.">
              Reset retry attempts
            </SubmitButton>
          </form>
        ) : null}

        {status !== "published" ? (
          <form action={transitionAction} className="space-y-2 border-t border-gray-100 pt-4">
            {status === "in_review" || status === "approved" || status === "draft" ? (
              <textarea name="note" rows={2} className={inputClass} placeholder="Review note (required to reject)" />
            ) : null}
            <div className="flex flex-wrap gap-2">
              {status === "draft" || status === "rejected" ? (
                <SubmitButton name="transition" value="submit" variant="secondary">Submit for review</SubmitButton>
              ) : null}
              {status === "draft" || status === "in_review" ? (
                <SubmitButton name="transition" value="approve" variant="primary">Approve</SubmitButton>
              ) : null}
              {status === "in_review" || status === "approved" ? (
                <SubmitButton name="transition" value="reject" variant="danger">Reject</SubmitButton>
              ) : null}
              {status === "in_review" || status === "approved" || status === "rejected" ? (
                <SubmitButton name="transition" value="return_to_draft" variant="secondary">Return to draft</SubmitButton>
              ) : null}
            </div>
          </form>
        ) : null}
      </div>
    </Card>
  );
}
