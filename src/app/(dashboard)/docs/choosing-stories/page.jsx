import { DocLink, DocPage, List, Note, Path, Section, Step, Steps } from "../doc-parts";

export const metadata = { title: "How stories are chosen" };

export default function ChoosingStoriesPage() {
  return (
    <DocPage
      href="/docs/choosing-stories"
      title="How stories are chosen"
      description="The inbox is a list of possibilities. Choose stories that suit the website and have enough trustworthy evidence."
    >
      <Section title="Where stories come from">
        <p>
          A niche is a subject group shared by related websites. Each website gets copies of its niche&apos;s sources
          and starting categories. Administrators manage shared sources on Niches and site-only sources under{" "}
          <Path>Settings → Sources</Path>.
        </p>
        <p>
          Enabled sources with a feed supply inbox stories every 30 minutes. Discovery leaves out dated items more than
          three days old and suppresses repeated addresses and similar recent headlines on the same website. Pausing
          drafting does not stop this discovery.
        </p>
        <p>
          A category is where the finished article belongs, such as a section of the website. It does not decide which
          feed stories arrive.
        </p>
      </Section>
      <Section title="Choose stories yourself">
        <Steps>
          <Step title="Open the Story inbox">
            Filter by website, source or status. Read the headline and open the original story before deciding.
          </Step>
          <Step title="Select or skip">
            Use <strong>Select</strong> for a story worth covering and <strong>Skip</strong> for one you do not want.
            You can also select several rows and use <strong>Select chosen</strong> or <strong>Skip chosen</strong>.
          </Step>
          <Step title="Wait for a job, or queue one explicitly">
            Selected stories fill a waiting supply of roughly two days of AI articles, counting work already underway.
            Use <strong>Queue AI draft</strong> when you want to queue a selected story directly.{" "}
            <strong>Supporting evidence URLs</strong> accepts up to four full https page addresses, one per line.
          </Step>
        </Steps>
        <p>
          A full waiting supply can leave selected stories waiting without a new job. A job also waits while automation
          is paused or its budget cannot cover the next call.
        </p>
      </Section>
      <Section title="If automatic selection is enabled">
        <p>
          <strong>Automatically select recent stories to fill the review buffer</strong> is off initially. An
          administrator can enable it under <Path>Settings → Edit website</Path>.
        </p>
        <List>
          <li>Only new stories from enabled sources, no more than 48 hours old, are eligible.</li>
          <li>Official sources, recent stories and reporting by several independent sources receive preference.</li>
          <li>No more than two stories from the same outlet are picked per run.</li>
          <li>Already selected stories, existing draft jobs and similar existing articles are avoided.</li>
          <li>
            Selection stops when the waiting supply is full, the site has no publishing times, automation is paused or
            off, or spending limits are exhausted.
          </li>
        </List>
      </Section>
      <Section title="Why a story is skipped or disappears from new results">
        <List>
          <li>
            An editor skipped it, or used <strong>Remove from drafting</strong> to cancel its job and skip the story.
          </li>
          <li>
            Automatic selection judged it outside the website&apos;s topic. Before choosing stories, the AI reads each
            new story&apos;s headline and summary once against the website&apos;s topic, categories and niche guide.
            Off-topic stories are skipped with the reason shown under the story; an editor can still select one.
          </li>
          <li>
            An untouched job still waiting to collect sources reached 48 hours from the story&apos;s publication time,
            or discovery time when no publication date is known. It is cancelled with{" "}
            <strong>Story went stale while waiting</strong>.
          </li>
          <li>A completed draft used the story. Used stories cannot be selected again.</li>
          <li>A duplicate was suppressed during discovery, so a second inbox entry was not created.</li>
        </List>
      </Section>
      <Note title="Unselecting stops the job">
        Unselecting or skipping a story cancels its queued or running job. An automatic pick that you unselect is not
        automatically chosen again. You may select it manually later; an existing cancelled job needs an administrator
        to retry it.
      </Note>
      <p>
        For source settings, see <DocLink href="/docs/settings/sources">Niches, sources and categories</DocLink>. For
        jobs that already researched a story, see <DocLink href="/docs/alerts-and-jobs">Alerts and failed jobs</DocLink>
        .
      </p>
    </DocPage>
  );
}
