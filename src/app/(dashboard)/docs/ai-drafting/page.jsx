import { DocLink, DocPage, List, Note, Path, Section } from "../doc-parts";

export const metadata = { title: "AI drafting rules and checks" };

export default function DraftingRulesPage() {
  return (
    <DocPage
      href="/docs/ai-drafting"
      title="AI drafting rules and checks"
      description="AI prepares a draft from evidence. These checks help the reviewer; they do not replace reading the sources."
    >
      <Section title="The source rules">
        <List>
          <li>A story should have its original official announcement or support from two independent websites.</li>
          <li>
            A sensitive or consequential story needs two independent websites, even when one is official. This includes
            allegations, health stories, financial forecasts and breaking news.
          </li>
          <li>
            Pages from configured Official newsroom or Government sources count as official. Research can also identify
            the original announcement among the collected pages.
          </li>
          <li>
            Research can find pages beyond the configured source list. Review those publishers too; being found by a
            search does not make a page trustworthy.
          </li>
        </List>
        <p>
          If support is insufficient, the job makes one extra search for other outlets and researches again. If it is
          still short, it produces a reviewer warning or stops when the matching strict check is on.
        </p>
        <p>
          The automatic check counts different websites, not separate pages on the same website. It cannot establish
          that two publishers did their own reporting. Check that the second report adds independent support rather than
          repeating the first.
        </p>
        <p>
          Pages that refuse automated reading, require a login or payment, contain too little text, or are too old for
          the story can be skipped. Their reasons appear under <strong>Source evidence</strong> on the job page. The
          system does not bypass access restrictions.
        </p>
      </Section>
      <Section title="What the article may say">
        <p>
          The AI is told to use only facts supported by the collected pages, leave unconfirmed details out, write an
          original article of 250–650 words and attach the sources separately. It must not invent citations, copy the
          source article or give personal investment, medical or legal advice.
        </p>
        <p>
          English uses clear, neutral news language. Arabic uses Modern Standard Arabic. The website&apos;s topic,
          audience and niche writing guide also guide the writing. Names and official titles should stay in full as the
          sources give them.
        </p>
      </Section>
      <Section title="Checks that always stop a bad draft">
        <List>
          <li>No researched facts can be matched to the collected pages.</li>
          <li>
            A matching passage of 12 consecutive words is copied from a source. English runs made entirely of
            capitalised name/title words, digits and a small set of joining words are exempt, using the source&apos;s
            spelling. Ordinary copied prose is still rejected; Arabic has no case-based exemption.
          </li>
          <li>
            More than 35% of the draft&apos;s distinct five-word groups match source wording. These checks include the
            title, excerpt and body, ignoring punctuation and letter case. The same title exemption applies.
          </li>
          <li>
            The AI-generated body contains web addresses or HTML formatting, is too short for review, or does not match
            the website&apos;s language. Ordinary punctuation is allowed.
          </li>
          <li>A similar automated article already exists for the story or headline.</li>
        </List>
        <p>
          A copied 12-word passage gets up to two automatic rewrites on later runs, with every matched phrase so far
          explained to the AI. A third rejection stops the job. The broader similarity failure does not get this special rewrite.
        </p>
      </Section>
      <Section title="Strict checks and reviewer warnings">
        <p>
          Under <Path>Network settings → Draft checks → Block drafts when…</Path>, administrators can make ten
          additional problems stop jobs. All ten start off. Leaving a switch off means the issue is recorded for the
          reviewer, not that the issue is safe to ignore.
        </p>
        <List>
          <li>
            Research evidence: facts dropped because their quotes were not found, no second source for a sensitive
            story, one unofficial outlet only, or unresolved claims.
          </li>
          <li>
            Article sources: uncollected pages cited, the official source not cited, or researched facts not covered by
            the cited sources.
          </li>
          <li>Verification: the AI check does not pass, reports issues, or finds unsupported claims.</li>
        </List>
        <p>
          An unknown category is cleared rather than stopping the draft. Uncollected citations are removed, with a
          warning unless that strict check stops the job. Check the category and sources before approval.
        </p>
      </Section>
      <Note tone="warning" title="A warning needs a decision">
        Read <strong>Warnings for the reviewer</strong> on the job and the article&apos;s review note. Open the original
        sources and correct or reject unsupported writing. Articles with any reviewer warnings cannot be auto-approved.
      </Note>
      <p>
        For exact error wording and recovery steps, see{" "}
        <DocLink href="/docs/ai-drafting/messages">Drafting failure messages</DocLink>.
      </p>
    </DocPage>
  );
}
