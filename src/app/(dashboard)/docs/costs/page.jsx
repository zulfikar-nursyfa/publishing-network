import { DocLink, DocPage, List, Note, Path, Section } from "../doc-parts";

export const metadata = { title: "Costs and budgets" };

export default function CostsGuidePage() {
  return (
    <DocPage
      href="/docs/costs"
      title="Costs and budgets"
      description="The dashboard estimates AI spending so the team can control work. The provider's bill is the final record of what was charged."
    >
      <Section title="Where the estimates come from">
        <p>
          Each AI call records its model and use: search, research, draft, verify or illustrate. The dashboard applies
          the model prices saved in Network settings to the amount used, including search and AI images.
        </p>
        <p>
          Before a call, an allowance is held for its possible cost. After a completed response, that allowance is
          replaced by the estimate from actual usage. Open or uncertain calls keep their allowance, so the available
          budget can be smaller than completed spending alone suggests.
        </p>
        <p>
          Failed attempts and extra research or rewriting can cost money. Removing or cancelling a job does not erase
          usage already incurred.
        </p>
      </Section>
      <Section title="What the spending limits do">
        <List>
          <li>
            <strong>Monthly AI spending limit (USD)</strong> applies to one website. It starts at 0, so an administrator
            must set an agreed positive amount before drafting.
          </li>
          <li>
            <strong>Network monthly AI limit (USD)</strong> adds a whole-network ceiling. Blank means no additional
            network ceiling; zero blocks new AI calls.
          </li>
          <li>
            Completed estimates plus held allowances count against both limits. The next call&apos;s allowance must fit
            too, so a job can wait before the displayed total reaches 100%.
          </li>
          <li>
            Budget months follow UTC, not the website&apos;s publishing timezone. A new month or an increased limit can
            allow work to continue.
          </li>
          <li>
            Budgets stop new AI calls and can stop fresh automatic story picks. They do not prevent publishing an
            approved article, editing content or manually writing an article.
          </li>
        </List>
        <p>
          Pause switches and Off mode can also hold work independently of the budget. Check the reason shown on the job
          before changing a limit.
        </p>
      </Section>
      <Section title="Where to look">
        <List>
          <li>
            The website&apos;s <strong>Costs</strong> tab shows its monthly AI usage and estimated cost per drafted
            article, including spending on failed work.
          </li>
          <li>
            A draft job&apos;s <strong>AI usage estimates</strong> lists its individual calls, models and held
            allowances.
          </li>
          <li>An article&apos;s cost information connects its AI usage to the saved article.</li>
          <li>
            <DocLink href="/costs">Costs</DocLink> is the administrator&apos;s monthly report across websites, with AI
            estimates, entered costs and the cost per published article.
          </li>
        </List>
      </Section>
      <Section title="Add costs and export the month">
        <p>
          On Costs, choose the month with Previous month or Next month. Enter other costs using <strong>Website</strong>
          , <strong>Category</strong>, <strong>Amount (USD)</strong> and <strong>Note</strong>, then{" "}
          <strong>Add cost</strong>.
        </p>
        <p>
          Categories are Images, Paid sources, Extra hosting, Editorial time and Other. For editorial time, enter hours
          multiplied by the agreed hourly rate. These entries do not use the AI budget.
        </p>
        <p>
          <strong>Whole network (split across active websites)</strong> divides that entry equally across active
          websites in the report. A website-specific entry belongs only to that site.
        </p>
        <p>
          Use <strong>Costs CSV</strong> for the month&apos;s website report or <strong>Articles CSV</strong> for its
          article export. The selected month, rather than the current search or visible page, determines the export.
        </p>
      </Section>
      <Note tone="warning" title="Do not release an uncertain charge by guessing">
        An administrator can review calls held for more than ten minutes using{" "}
        <strong>Reviewed provider charge (USD)</strong> and <strong>Billing reconciliation note</strong> on the job.
        Check the provider&apos;s usage first, then <strong>Record reviewed charge</strong>. See{" "}
        <Path>Draft jobs → AI usage estimates</Path>.
      </Note>
    </DocPage>
  );
}
