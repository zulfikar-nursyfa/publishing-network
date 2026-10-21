import { DocLink, DocPage, List, Note, Path, Section, Step, Steps } from "../doc-parts";

export const metadata = { title: "Publishing times and quotas" };

export default function PublishingPage() {
  return (
    <DocPage
      href="/docs/publishing"
      title="Publishing times and quotas"
      description="Automatic publishing times and a schedule chosen for one article are two different ways to publish."
    >
      <Section title="The website's daily publishing times">
        <p>
          An administrator sets <strong>Publishing timezone</strong> and <strong>Publishing times</strong> under{" "}
          <Path>Settings → Edit website</Path>. Each time allows one approved AI article. Three times means a daily
          quota of three; there is no separate quota box.
        </p>
        <p>
          New website forms start at 08:00, 14:00 and 20:00 in Africa/Cairo. Times use the selected timezone, including
          its clock changes. Up to 12 times are allowed. Removing every time makes the quota zero and stops the regular
          automatic drafting supply and slots.
        </p>
        <p>
          The publishing check runs every five minutes. An approved AI article scheduled for that exact slot gets
          priority. Otherwise the slot chooses the AI article that has been approved longest and has no separate
          schedule. It does not take manual articles, unapproved drafts or articles with a recorded publishing failure.
        </p>
      </Section>
      <Section title="Schedule one article, or publish now">
        <Steps>
          <Step title="Approve the saved article">
            Open its <strong>Review and publish</strong> card.
          </Step>
          <Step title="Choose a publishing method">
            <strong>Publish to WordPress</strong> publishes now. <strong>Schedule</strong> accepts a future date and
            time in the website&apos;s timezone. The suggested value is the next free publishing time.
          </Step>
          <Step title="Change your plan if needed">
            <strong>Unschedule</strong> removes the chosen date. An unscheduled approved AI article can then be picked
            by an automatic slot; a manual article still needs its own schedule or a person to publish it.
          </Step>
        </Steps>
        <p>
          Manual articles and individually scheduled articles can add to the day&apos;s total. An AI article scheduled
          exactly at an automatic publishing time can fill that slot instead of being an additional article. An
          individually scheduled article can still publish when automatic slots are paused.
        </p>
      </Section>
      <Section title="What happens when a slot is missed">
        <List>
          <li>
            <strong>No approved automated article was ready</strong>: the slot is skipped. Review articles ahead of the
            next time, or schedule one explicitly.
          </li>
          <li>
            Slots are considered only within 30 minutes of their time. There is no automatic catch-up for older unused
            times.
          </li>
          <li>
            A website or network pause, Off mode, an archive, or a WordPress connection needing attention can prevent
            automatic slots.
          </li>
          <li>
            An AI spending limit does not block publication of an already approved article: publishing it uses no new AI
            call.
          </li>
        </List>
        <p>
          Do not assume every missed time will produce a slot entry or email. Check Overview and the website&apos;s
          publishing history as well.
        </p>
      </Section>
      <Note tone="warning" title="Pausing does not cancel a person's schedule">
        Manual publishing and individually scheduled articles continue during an automation pause. Use{" "}
        <strong>Unschedule</strong> on an approved article if it must not publish. Archived websites cannot publish.
      </Note>
      <Section title="If publishing fails">
        <p>
          Open <strong>Last publishing error</strong> on the article. Fix the connection, category or image issue, then
          use <strong>Retry publishing</strong>. Retrying checks for the existing WordPress post before creating one.
          After five attempts, an administrator must use <strong>Reset retry attempts</strong> after fixing the cause.
        </p>
        <p>
          An individually scheduled article with a recorded publishing failure needs attention; it is not repeatedly
          retried by its schedule. If an attempt is still running, wait and reload rather than creating another article.
        </p>
      </Section>
      <Section title="Take an article down and correct it">
        <p>
          Choose <strong>Unpublish</strong> on the published article and optionally give a reason. The WordPress post
          becomes a draft. Then <strong>Return to draft</strong>, correct and save it, approve it again and publish or
          schedule it. Republishing reuses that WordPress post.
        </p>
        <p>
          <strong>Live check</strong> can report a public-page error, blocked search indexing or an address pointing to
          another page. These findings do not undo publication. Ask an administrator to check them; test sites may
          intentionally block indexing.
        </p>
      </Section>
      <p>
        For image and editorial checks before approval, see{" "}
        <DocLink href="/docs/reviewing">Reviewing and approving articles</DocLink>.
      </p>
    </DocPage>
  );
}
