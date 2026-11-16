import { DocLink, DocPage, List, Note, Section } from "../../doc-parts";

export const metadata = { title: "Drafting failure messages" };

const failures = [
  [
    "Draft contains a long copied passage",
    "The message includes the matched source wording: twelve words in a row from a source, with at most two ordinary words around full names and official titles. Up to two automatic rewrites are tried first, each told every phrase copied so far. If the third draft still repeats source wording, the article goes to review with a warning quoting it; reword it there.",
  ],
  [
    "Draft is too similar to the collected source text",
    "Too much wording overlaps with the sources, even without one long passage. Restart research for a fresh draft after checking that the story offers enough facts for an original article.",
  ],
  [
    "None of the researched facts could be matched to the collected pages",
    "The evidence does not support the research. Open Source evidence, then add readable supporting pages and restart.",
  ],
  [
    "Sensitive or consequential story without a second independent source",
    "Find a second independent website covering the facts. Add its page under Extra supporting URLs, then retry. This stops a job only when the corresponding strict check is on.",
  ],
  [
    "No official source and only one outlet supports the story",
    "Add the original official announcement or another independent report. The extra automatic search has already had its chance before this strict check stops the job.",
  ],
  [
    "Draft language does not match the website",
    "Check the website's Language setting and the niche writing guide. Ask an administrator to correct them if needed, then restart for a fresh draft.",
  ],
  [
    "Draft is too short for editorial review",
    "The body has fewer than 180 words in English or 130 in Arabic. The AI is asked for 250–650 words, and a short draft is rewritten once, told its length. If the job still stopped, the story probably has too little to say (a daily price or rate update, for example): check that enough relevant evidence was collected, then restart or remove the job; do not add unsupported detail just to reach a length.",
  ],
  [
    "Draft body must be plain text; sources are attached separately",
    "The AI-generated text included web addresses or HTML formatting in the body. Ordinary punctuation is allowed. Restart for a fresh draft; sources belong in the separate source list.",
  ],
  [
    "This story or headline already has an article",
    "Look for the existing article before spending on another attempt. Remove the unwanted draft job if the story is already covered.",
  ],
  [
    "No readable coverage found",
    "Before stopping, the job searched once more for coverage on other sites. Expand the skipped-page reasons. Add accessible article pages rather than homepages, login pages or blocked reports. A temporary page error may retry automatically; a stopped job needs a person.",
  ],
  [
    "AI response failed structured validation; review the job before retrying",
    "The AI response could not be accepted as a complete article or research result. Ask an administrator to retry the job: every retry asks the AI for a fresh response rather than reusing the one that failed.",
  ],
  [
    "Configure model pricing before generating content",
    "An administrator must add prices for the chosen AI model in Network settings before trying again.",
  ],
  [
    "Story is no longer selected",
    "The story was unselected or skipped. Leave the job stopped unless the team deliberately wants it again. Select the story before an administrator retries its job.",
  ],
];

export default function DraftMessagesPage() {
  return (
    <DocPage
      href="/docs/ai-drafting/messages"
      title="Drafting failure messages"
      description="Read the message on the job first. These are the fixed parts of messages; a phrase, page address or other detail may follow."
    >
      <Section title="Stopped drafts">
        <List>
          {failures.map(([message, advice]) => (
            <li key={message}>
              <strong>{message}</strong>: {advice}
            </li>
          ))}
        </List>
      </Section>
      <Section title="Other strict-check messages">
        <List>
          <li>
            <strong>researched facts were dropped because their quotes were not found on the pages</strong>: check the
            evidence and replace weak supporting pages. The message starts with the number dropped.
          </li>
          <li>
            <strong>Not confirmed by the sources (left out)</strong>: the listed details were not established. Keep them
            out; seek better evidence if they are essential.
          </li>
          <li>
            <strong>The draft cited pages that were not collected; they were removed</strong>: the AI named pages
            outside its evidence. Restart using the pages the article needs.
          </li>
          <li>
            <strong>The draft does not cite the official source</strong>: check that the official announcement supports
            the story and is included in the article&apos;s sources.
          </li>
          <li>
            <strong>Some researched facts are not covered by the draft&apos;s cited sources</strong>: check every
            factual claim against the sources attached to the article.
          </li>
          <li>
            <strong>AI verification did not pass</strong>, <strong>Verification:</strong> or{" "}
            <strong>Unsupported claim:</strong>: read the listed issues and compare them with the original pages. The
            AI checks every sentence of the headline, excerpt, SEO fields and body; a sentence it skipped is listed as{" "}
            <strong>Not checked by AI verification:</strong> and needs checking by hand. Each flagged sentence starts
            with the field it is in, such as <strong>[meta description]</strong>.
            Correct or reject the article, or restart a stopped job with better evidence. After correcting, use{" "}
            <strong>Re-check after edits</strong> on the article so the warnings describe the saved version.
          </li>
          <li>
            <strong>Figures not found in the sources</strong>: these numbers appear in the article (including the SEO
            title and meta description) but on none of the collected pages. They may be invented, converted, rounded or
            calculated (a total, a percentage, a currency conversion). Check each against the original pages; numbers
            written as words in the source also show up here.
          </li>
          <li>
            <strong>Million/billion differs from the sources</strong>: the sources give this number with another scale.
            <strong> Currency not used in the sources</strong>: the article names a currency no source uses, usually an
            AI conversion. Use the source&apos;s own figure and currency.
          </li>
          <li>
            <strong>Quotation not found in the sources</strong>: words in quotation marks that no page contains in that
            order. Use the speaker&apos;s exact words or remove the quotation marks.
          </li>
          <li>
            <strong>Names not found in the sources</strong> (English websites): capitalised words no source uses, such
            as a misspelt name, an invented spokesperson or a wider place (&ldquo;Gulf&rdquo; for the UAE). Some are
            harmless (&ldquo;Emirati&rdquo; for a UAE source); check each.
          </li>
          <li>
            <strong>Relative dates</strong> and <strong>Weekday does not match the date</strong>: replace
            &ldquo;yesterday&rdquo; or &ldquo;next week&rdquo; with the calendar date, and check a weekday against the
            source. <strong>Claims of scale not found in the sources</strong>: words such as &ldquo;largest&rdquo; or
            &ldquo;historic&rdquo; that no source uses. <strong>Causal links not found in the sources</strong>:
            wording such as &ldquo;driven by&rdquo; or &ldquo;supported by&rdquo; that makes one fact the cause of
            another when no source says so. <strong>AI wording or placeholders left in the draft</strong>:
            text such as &ldquo;the provided sources&rdquo; or &ldquo;[company name]&rdquo; that must not be published.
          </li>
          <li>
            <strong>AI image not generated</strong>: often the AI budget could not cover the image. Upload an image, or
            use <strong>Re-check after edits</strong> once the budget allows; it adds an AI image when the article has
            none. <strong>Re-check stopped</strong> and <strong>Re-check could not read</strong> explain a re-check
            that did not finish or a source page it could not open.
          </li>
        </List>
        <p>
          These are reviewer warnings when their strict switches are off. Turning a switch off does not fix the
          underlying writing.
        </p>
      </Section>
      <Section title="Waiting is different from failure">
        <p>
          <strong>Waiting for budget</strong> and <strong>Waiting: automation paused</strong> mean work is waiting for a
          control to change. Budget messages can say <strong>Website AI budget would be exceeded</strong> or{" "}
          <strong>Network AI budget would be exceeded</strong>, even before the current total reaches the limit: the
          next call must fit too.
        </p>
        <p>
          Ask an administrator to check the spending limit or resume automation. Waiting does not use a retry attempt.
          Provider messages can vary; send the full message to the administrator rather than guessing.
        </p>
      </Section>
      <Note title="Where to recover a job">
        The administrator&apos;s <strong>Recovery</strong> card is explained in{" "}
        <DocLink href="/docs/alerts-and-jobs">Alerts and failed jobs</DocLink>. An editor can inspect evidence and
        remove an unwanted job, but cannot use the administrator&apos;s retry controls.
      </Note>
    </DocPage>
  );
}
