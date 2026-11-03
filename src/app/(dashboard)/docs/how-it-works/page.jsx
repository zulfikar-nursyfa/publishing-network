import { DocLink, DocPage, List, Note, Path, Section, Step, Steps } from "../doc-parts";

export const metadata = { title: "How it works" };

export default function HowItWorksPage() {
  return (
    <DocPage
      href="/docs/how-it-works"
      title="How it works"
      description="The dashboard prepares articles. People check them. WordPress is the public website readers visit."
    >
      <Section title="From a story to a live article">
        <Steps>
          <Step title="Discover stories">
            The Story inbox receives new stories from enabled source feeds every 30 minutes. Each website has its own
            inbox, language and sources.
          </Step>
          <Step title="Select the stories worth covering">
            An editor chooses stories in the <DocLink href="/stories">Story inbox</DocLink>. An administrator can also
            turn on automatic selection. Selecting a story asks for a draft; it does not approve publication.
          </Step>
          <Step title="Prepare an AI draft">
            The system searches for coverage, reads the source pages, researches supported facts, writes an original
            article and checks it. It then prepares available image options. Follow this work on{" "}
            <DocLink href="/jobs">Draft jobs</DocLink>.
          </Step>
          <Step title="Review the article">
            Finished drafts normally enter the <DocLink href="/review">Review queue</DocLink>. Read the article and
            sources, resolve warnings, choose its category and image, then approve it.
          </Step>
          <Step title="Publish to WordPress">
            An approved AI article without its own schedule can fill the next automatic publishing slot. A person can
            also choose Schedule or Publish to WordPress on an approved article.{" "}
            <DocLink href="/docs/publishing">Publishing times and quotas</DocLink> explains the difference.
          </Step>
          <Step title="Read the results">
            The website&apos;s Traffic tab shows stored Google Analytics and Search Console numbers.{" "}
            <DocLink href="/docs/costs">Costs and budgets</DocLink> explains the spending estimates.
          </Step>
        </Steps>
      </Section>
      <Section title="What happens inside a draft job">
        <List>
          <li>
            <strong>collect</strong>: search for coverage, then read the pages that can be accessed.
          </li>
          <li>
            <strong>research</strong>: match facts to evidence and look for an official announcement or independent
            coverage.
          </li>
          <li>
            <strong>draft</strong>: write in the website&apos;s language, using its topic, audience and niche writing
            guide.
          </li>
          <li>
            <strong>verify</strong>: check the article against the collected pages.
          </li>
          <li>
            <strong>illustrate</strong>: prepare permitted source images and, if enabled, an AI illustration.
          </li>
          <li>
            <strong>create article</strong>: save the article, its sources, images and reviewer warnings.
          </li>
        </List>
        <p>
          Work advances in short steps, with one job step handled each minute. Busy queues, extra source searches and
          retries can make a draft take longer. Refresh Draft jobs to see its current state.
        </p>
        <p>
          <strong>Re-check after edits</strong> sends a finished job through three more steps: <strong>recollect</strong>{" "}
          (read the article&apos;s current sources), <strong>reverify</strong> (fact-check the saved article) and, when
          the article has no image and AI illustrations are on, <strong>reillustrate</strong>. The usual pause and budget
          controls apply.
        </p>
      </Section>
      <Note title="Human review is the safe starting point">
        Review mode sends every completed AI article to a person. Automatic mode can skip review only for an allowed
        category when every safeguard passes. An AI check is never a guarantee that an article is correct.
      </Note>
      <Section title="A daily routine">
        <List>
          <li>
            Start at <Path>Overview → Needs attention</Path>. Check failed work, waiting jobs and upcoming review needs.
          </li>
          <li>Select useful stories and review enough articles for the next publishing times.</li>
          <li>Check newly published articles on WordPress, including the image, credit and sources.</li>
          <li>Watch spending and traffic. Ask an administrator to fix settings or recover failed jobs.</li>
        </List>
      </Section>
    </DocPage>
  );
}
