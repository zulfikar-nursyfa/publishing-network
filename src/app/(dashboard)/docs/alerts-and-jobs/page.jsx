import { DocLink, DocPage, List, Note, Path, Section, Step, Steps } from "../doc-parts";

export const metadata = { title: "Alerts and failed jobs" };

export default function AlertsAndJobsGuidePage() {
  return (
    <DocPage
      href="/docs/alerts-and-jobs"
      title="Alerts and failed jobs"
      description="Use the dashboard's current state to decide what to do. An alert email describes a problem found at the time it was sent."
    >
      <Section title="What the alert emails mean">
        <p>
          Alerts are checked every 15 minutes and new problems are grouped into one email. Recipients must be saved and
          email delivery configured. A problem is normally emailed once, not on every check.
        </p>
        <List>
          <li>
            <strong>budget</strong>: estimated AI use plus held allowances reached 80% or 100% of a positive website or
            network limit. Review spending and the next month&apos;s needs.
          </li>
          <li>
            <strong>slot</strong>: a recorded publishing slot was skipped or failed. Check the website&apos;s Schedule
            tab, approved article supply and connection.
          </li>
          <li>
            <strong>publication</strong>: WordPress publishing has failed at least twice. Open the linked article, fix
            Last publishing error and use Retry publishing.
          </li>
          <li>
            <strong>job</strong>: an AI draft job failed. Open the linked job and read its step, error and evidence.
          </li>
        </List>
        <p>
          Failure checks look at problems updated within the last 24 hours; budget checks use the current month.
          Archived and muted websites are left out of website alerts. Muted-site spending still counts toward network
          budget alerts.
        </p>
        <p>
          Administrators manage <Path>Network settings → Alerts</Path>. Search Muted websites to stop a test site&apos;s
          problem emails, then Save muted websites. Muting does not fix or pause the site. Unmuting does not replay
          problems that have disappeared from the current checks.
        </p>
        <p>
          The same recipients get the <DocLink href="/weekly">Weekly report</DocLink> every Monday at 07:00 UTC, covering
          the previous Monday to Sunday for every active website, muted ones included.
        </p>
      </Section>
      <Section title="Read a draft job before retrying">
        <Steps>
          <Step title="Open Draft jobs">
            The initial Active view includes queued, running and failed work. Use other status filters to find cancelled
            or completed jobs.
          </Step>
          <Step title="Read the state and reason">
            <strong>Waiting for budget</strong> or <strong>Waiting: automation paused</strong> includes a reason and
            Since time. These waits do not use attempts. A failed job needs a decision; temporary provider failures can
            retry automatically up to its attempt limit.
          </Step>
          <Step title="Check what was collected">
            Read Source evidence, the skipped-page reasons, Research claims, Warnings for the reviewer and AI
            verification where present. A succeeded job links to its article.
          </Step>
        </Steps>
        <p>
          <DocLink href="/docs/ai-drafting/messages">Drafting failure messages</DocLink> explains the common errors.
          Image problems can leave warnings on an otherwise completed draft; upload a permitted image during review if
          needed.
        </p>
      </Section>
      <Section title="Recovery: administrator controls">
        <List>
          <li>
            <strong>Retry draft job</strong>: available for failed or cancelled jobs. With no extra addresses or restart
            tick, it resumes the current step and may reuse an already saved AI response. It does not always request
            fresh writing. The story must still be selected.
          </li>
          <li>
            <strong>Extra supporting URLs</strong>: up to four full https page addresses, one per line. Adding any
            restarts the search and research with those pages available.
          </li>
          <li>
            <strong>Restart research and generate a fresh draft</strong>: starts again rather than resuming saved
            research. It can incur new AI charges.
          </li>
          <li>
            <strong>Cancel job</strong>: stops queued, running or failed work without skipping its selected story. A
            request already underway may still be charged; retrying may need to wait until it finishes.
          </li>
        </List>
        <p>
          A copied-passage failure gets up to two automatic rewrites on later runs. A manual retry restores both.
          Repeatedly pressing Retry without improving the evidence or fixing the settings is not a solution.
        </p>
      </Section>
      <Section title="When to use Remove from drafting">
        <p>
          Use it when the story is obsolete, duplicated or no longer wanted. Administrators and assigned editors can use
          it on the inbox, job list or job detail, including a selected batch.
        </p>
        <p>
          It cancels the job and skips the story, freeing its place in the waiting supply. It does not delete completed
          articles or undo charges. If the team wants a removed story again, select it deliberately and ask an
          administrator to retry its existing job.
        </p>
        <p>
          Untouched collection jobs may expire automatically at 48 hours with{" "}
          <strong>Story went stale while waiting</strong>. Jobs that have researched or drafted a story are kept for a
          person to judge rather than automatically discarded.
        </p>
      </Section>
      <Note title="Check the dashboard even when email is quiet">
        Missing recipients, muted test sites, delivery problems or the alert time window can all mean no email. Start at{" "}
        <Path>Overview → Needs attention</Path>. For WordPress recovery, see{" "}
        <DocLink href="/docs/publishing">Publishing times and quotas</DocLink>.
      </Note>
    </DocPage>
  );
}
