import { DocLink, DocPage, List, Note, Path, Section, Step, Steps } from "../doc-parts";

export const metadata = { title: "Reviewing and approving articles" };

export default function ReviewingPage() {
  return (
    <DocPage
      href="/docs/reviewing"
      title="Reviewing and approving articles"
      description="Approval means the saved article is ready for readers. Read the evidence, not just the AI's verdict."
    >
      <Section title="Work through the Review queue">
        <Steps>
          <Step title="Choose the website and article">
            Open the <DocLink href="/review">Review queue</DocLink>. Use its filters to focus on a website, sensitive
            stories or reviewer warnings.
          </Step>
          <Step title="Read the article and original sources">
            Check names, official titles, dates, figures, attribution and whether the headline fairly reflects the
            story. The mistakes the AI makes most often: giving an action to the wrong organisation, placing someone at
            a session the source does not mention, a figure for a wider or narrower group than the source (a whole
            country vs one region), counting a repeated item twice in a total, stronger wording than the source,
            describing a planned event as finished, million for billion, a converted currency, a quotation the source
            does not contain and a weekday that does not match the date. Follow the draft job link when you need its Source evidence, Research claims or AI verification.
          </Step>
          <Step title="Resolve warnings">
            Read the article&apos;s review note and <strong>Warnings for the reviewer</strong> on its job. Remove
            unsupported detail, correct mistakes or reject the article. A warning stays useful even when it did not stop
            drafting. Warnings describe the AI draft, not your edits: after saving corrections or adding sources, use{" "}
            <strong>Re-check after edits</strong> on the article. It reads the article&apos;s current sources, fact-checks
            the saved text, replaces the old AI verification warnings and adds an AI image if the article still has
            none.
          </Step>
          <Step title="Save the finished version">
            Check Headline, Body, Excerpt, Category and Sources. Body is a text editor with headings, bold, italic,
            lists and quotes. Its toolbar also adds a <strong>Link</strong> to
            the selected words, an <strong>Image</strong> inside the article (saved articles only; same source and
            credit rules as the featured image) and an <strong>Embed</strong> of a YouTube video, X post or Instagram
            post (X and Instagram need connector plugin 1.2.0). Check <strong>Search engines (Yoast SEO)</strong>: SEO
            title, Meta description, Focus keyphrase and Tags. <strong>Generate with AI</strong> fills all four from
            the title and body and counts against the website&apos;s AI budget. Save edits before using{" "}
            <strong>Preview</strong>, which shows the last saved article.
          </Step>
          <Step title="Choose and check the image">
            Choose <strong>Use this image</strong> for an existing option, or upload a PNG, JPEG or WebP of at most 3
            MB. Check Source, Credit, Alt text, Caption, Source page and Licence or usage terms. Alt text is required;
            licensed and press images also require a credit and either usage terms or a source page recording
            permission. Use <strong>Save image</strong> after editing those fields. AI images must be presented as
            illustrations, not photographs of a real event.
          </Step>
          <Step title="Approve or explain a rejection">
            Use <Path>Review and publish → Approve</Path> when it is ready. <strong>Reject</strong> requires a Review
            note explaining why.
          </Step>
        </Steps>
      </Section>
      <Section title="What each state means">
        <List>
          <li>
            <strong>Draft</strong>: editable work. Use Submit for review when it is ready for a reviewer, or Approve
            after checking it.
          </li>
          <li>
            <strong>In review</strong>: editable and waiting for a decision.
          </li>
          <li>
            <strong>Approved</strong>: the text and image are locked. Use Return to draft before changing them.
          </li>
          <li>
            <strong>Rejected</strong>: revise it, save, then Submit for review again.
          </li>
          <li>
            <strong>Published</strong>: live content is locked. Use Unpublish before correcting it through the
            dashboard.
          </li>
          <li>
            <strong>Unpublished</strong>: off the live site, with its WordPress post kept as a draft. Return to draft to
            edit it.
          </li>
        </List>
        <p>
          If a save says{" "}
          <strong>
            This article was changed by someone else since you opened it. Reload to see the latest version.
          </strong>
          , reload and compare the latest text before making your changes again.
        </p>
      </Section>
      <Section title="When an article can be auto-approved">
        <p>This exists, but Review is the safe starting mode. Automatic approval requires all of these:</p>
        <List>
          <li>The website is in Automatic mode and its category has Allow auto-publish enabled.</li>
          <li>The draft is not sensitive or consequential.</li>
          <li>The research has the required independent support.</li>
          <li>AI verification passed and there are no reviewer warnings, including image warnings.</li>
        </List>
        <p>Otherwise it stays in review. Passing AI verification alone does not make an article eligible.</p>
      </Section>
      <Note title="Approval is separate from publication">
        Approved AI articles can be used by automatic slots. Manual articles need <strong>Schedule</strong> or{" "}
        <strong>Publish to WordPress</strong>. See{" "}
        <DocLink href="/docs/publishing">Publishing times and quotas</DocLink>.
      </Note>
    </DocPage>
  );
}
