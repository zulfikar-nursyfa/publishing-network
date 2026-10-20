import { Code, DocLink, DocPage, List, Note, Path, Section, Step, Steps } from "../../doc-parts";

export const metadata = { title: "Start automation and go live" };

export default function GoLiveStepPage() {
  return (
    <DocPage
      href="/docs/add-a-website/go-live"
      title="4. Start automation and go live"
      description="Try a few drafts, turn automation on, build up the first articles, then open the site to Google."
    >
      <Section title="A. Turn on automation">
        <Steps>
          <Step title="Resume automation">
            Open the website, then <Path>Settings → Overview</Path>. In the <strong>Automation</strong> card, click{" "}
            <strong>Resume automation</strong>. The card shows how many articles a day will be published and when.
          </Step>
          <Step title="Wait for stories">
            New stories from the site&apos;s sources arrive in the <DocLink href="/stories">Story inbox</DocLink> every
            30 minutes.
          </Step>
        </Steps>
      </Section>

      <Section title="B. Make the first test drafts">
        <Steps>
          <Step title="Pick two or three stories">
            In the <DocLink href="/stories">Story inbox</DocLink>, filter by the new website and <strong>Select</strong>{" "}
            two or three stories that suit it. If &quot;Automatically select recent stories&quot; is on, the system also
            picks some by itself.
          </Step>
          <Step title="Watch them being written">
            Each selected story becomes a draft job on <DocLink href="/jobs">Draft jobs</DocLink>. The AI researches,
            writes, checks and adds an image. This usually takes a few minutes.
          </Step>
          <Step title="Review them">
            Finished drafts appear in the <DocLink href="/review">Review queue</DocLink>. Read each one, fix anything,
            choose the featured image and category, and check the SEO fields. Use <strong>Preview</strong> to see it as
            it will look on the site.
          </Step>
          <Step title="Approve">
            Approved articles publish at the next publishing time. You can also schedule or publish one straight away
            from the article.
          </Step>
          <Step title="Check it on WordPress">
            Open the published article on the site. Check the title, image and image credit, category and layout.
          </Step>
        </Steps>
        <Note title="Not happy with the writing style?">
          The AI follows the niche&apos;s writing guide. An administrator can change it on the{" "}
          <DocLink href="/niches">Niches</DocLink> page, separately for English and Arabic.
        </Note>
      </Section>

      <Section title="C. Build the launch library">
        <p>
          Keep the site hidden from Google while it fills up. The plan is to have <strong>20 to 30 reviewed
          articles</strong> live before the public launch. With three publishing times a day this takes about one to
          two weeks.
        </p>
        <p>During this time, keep an eye on:</p>
        <List>
          <li>
            <DocLink href="/">Overview → Needs attention</DocLink> for failed drafts or publishing problems
          </li>
          <li>
            The website&apos;s <strong>Costs</strong> tab for the AI cost per article
          </li>
          <li>Alert emails, if they are set up in Network settings → Alerts</li>
        </List>
      </Section>

      <Section title="D. Launch day">
        <Steps>
          <Step title="Open the site to search engines">
            In WordPress, go to <Path>Settings → Reading</Path>, <strong>untick</strong> &quot;Discourage search engines
            from indexing this site&quot; and save.
          </Step>
          <Step title="Find the sitemap">
            The sitemap is the list of all article addresses that Google reads. With Yoast it is at{" "}
            <Code>https://your-site.com/sitemap_index.xml</Code>. Open it in a private browser window to check it
            loads. (Without Yoast, WordPress&apos;s own sitemap is at <Code>/wp-sitemap.xml</Code>.)
          </Step>
          <Step title="Submit it to Google">
            In <DocLink href="https://search.google.com/search-console">Search Console</DocLink>, pick the site, go to{" "}
            <Path>Indexing → Sitemaps</Path>, enter <Code>sitemap_index.xml</Code> and click <strong>Submit</strong>.
          </Step>
          <Step title="Check the result">
            Within a day the status should say <strong>Success</strong> with the number of addresses found. You only
            submit it once: Google re-reads it automatically as new articles are published.
          </Step>
        </Steps>
        <Note tone="warning" title="If the sitemap shows &quot;Couldn't fetch&quot;">
          Check that the sitemap opens in a private window and that &quot;Discourage search engines&quot; is unticked.
          Then submit it again.
        </Note>
      </Section>

      <Section title="Done">
        <p>
          The site is live. Articles are drafted, reviewed by the assigned editors and published at the set times, and
          the Traffic tab fills up as visitors and Google searches arrive.
        </p>
      </Section>
    </DocPage>
  );
}
