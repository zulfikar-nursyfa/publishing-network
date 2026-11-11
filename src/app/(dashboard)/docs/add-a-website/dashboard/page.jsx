import { Code, DocLink, DocPage, List, Note, Path, Section, Step, Steps } from "../../doc-parts";

export const metadata = { title: "Add it to the dashboard" };

export default function DashboardStepPage() {
  return (
    <DocPage
      href="/docs/add-a-website/dashboard"
      title="2. Add it to the dashboard"
      description="Create the website in this dashboard, connect it to WordPress and check its categories and sources. Only administrators can do this."
    >
      <Section title="A. Fill in the website form">
        <p>
          Go to <DocLink href="/websites">Websites</DocLink> and click <strong>Add website</strong>. The form has five
          parts.
        </p>

        <h3 className="font-semibold">Website</h3>
        <List>
          <li>
            <strong>Name</strong>: how the site is shown in the dashboard, for example{" "}
            <Code>Business &amp; Investment (EN)</Code>.
          </li>
          <li>
            <strong>Slug</strong>: leave empty. It is created from the name.
          </li>
          <li>
            <strong>Domain</strong>: the address without <Code>https://</Code>, for example{" "}
            <Code>bussinessandinvesment.com</Code>.
          </li>
          <li>
            <strong>Language</strong>: English or Arabic. Arabic articles are written and shown right to left.
          </li>
          <li>
            <strong>Niche</strong>: the subject group, for example Business &amp; Investment. This gives the site the
            niche&apos;s news sources, starting categories and writing guide. The English and Arabic sites of a niche
            share the same sources.
          </li>
          <li>
            <strong>Topic</strong> and <strong>Audience</strong>: one short sentence each. The AI uses them when
            writing, for example &quot;Business and investment news for the UAE and GCC&quot; and &quot;Investors,
            founders and business professionals in the Gulf&quot;.
          </li>
        </List>

        <h3 className="font-semibold">Branding</h3>
        <p>
          Optional. Store the site&apos;s tagline, primary colour and logo. You can add them later. Saving them here
          does not by itself change the public WordPress theme or add a logo to an AI illustration.
        </p>

        <h3 className="font-semibold">WordPress connection</h3>
        <List>
          <li>
            <strong>WordPress URL</strong>: the full address with https, for example{" "}
            <Code>https://bussinessandinvesment.com</Code>.
          </li>
          <li>
            <strong>WordPress username</strong>: <Code>pn-publisher</Code>.
          </li>
          <li>
            <strong>Application password</strong>: the password you copied in step 1. It is stored encrypted and is
            never shown again.
          </li>
        </List>
        <Note title="No WordPress site yet?">
          Leave all three empty. Stories are found and drafts are written as usual, and nothing is published. When the
          site is ready, fill them in under <Path>Settings → Edit website</Path>: the connection is tested and the
          categories are created in WordPress automatically. They cannot be removed again once added.
        </Note>

        <h3 className="font-semibold">Google Analytics and Search Console</h3>
        <p>
          Leave these empty for now. You will fill them in on the{" "}
          <DocLink href="/docs/add-a-website/google">next page</DocLink>.
        </p>

        <h3 className="font-semibold">Publishing and automation</h3>
        <List>
          <li>
            <strong>Publishing timezone</strong>: the site&apos;s market, for example <Code>Africa/Cairo</Code>.
          </li>
          <li>
            <strong>Publishing times</strong>: one automated article is published at each time. Three times (for example
            08:00, 14:00 and 20:00) means three articles a day.
          </li>
          <li>
            <strong>Monthly AI spending limit (USD)</strong>: drafting stops for the month when the estimated AI cost
            reaches this. <strong>It must be more than 0</strong>, otherwise nothing is drafted. Start with something
            like $30 and adjust once you see real costs.
          </li>
          <li>
            <strong>Automation mode</strong>: choose <strong>Review</strong>. Every AI article then waits for an editor
            to approve it before it is published. (Off creates no AI articles; Automatic lets some low-risk categories
            publish without review and should only be used once agreed.)
          </li>
          <li>
            <strong>AI model</strong>: leave empty to use the network default.
          </li>
          <li>
            <strong>Automatically select recent stories</strong>: tick it if you want the system to choose stories by
            itself. Leave it off if editors will choose every story in the Story inbox.
          </li>
          <li>
            <strong>Generate AI illustrations</strong>: tick it to add an AI image option to each draft. AI images are
            always labelled as illustrations on the site.
          </li>
        </List>

        <h3 className="font-semibold">Editors</h3>
        <p>
          Tick the editors who will review this site. Editors only see the websites they are ticked on. Administrators
          see everything.
        </p>

        <p>
          Click <strong>Add website and test connection</strong>. The website is created, the connection is tested
          straight away and you land on its settings.
        </p>
      </Section>

      <Section title="B. Test the WordPress connection">
        <Steps>
          <Step title="Open the connection card">
            On the website, open <Path>Settings → Overview</Path>. The <strong>WordPress connection</strong> card shows
            the site, user and connector version.
          </Step>
          <Step title="Check it is connected">
            It should be green and show <strong>connected</strong>, with Connector 1.1.0 or newer. Click{" "}
            <strong>Test connection</strong> to check again at any time.
          </Step>
        </Steps>
        <Note tone="warning" title="If the test fails">
          <List>
            <li>
              A login or password error: create a new application password in WordPress and paste it under{" "}
              <Path>Settings → Edit website</Path>.
            </li>
            <li>
              Connector shows &quot;unknown&quot;: the plugin file is missing or in the wrong folder. It must be
              directly inside <Code>wp-content/mu-plugins</Code>.
            </li>
            <li>
              A &quot;forbidden&quot; or blocked request: a security plugin or SiteGround setting is blocking the
              WordPress REST API. Allow it for logged-in users.
            </li>
          </List>
        </Note>
      </Section>

      <Section title="C. Create the categories in WordPress">
        <Steps>
          <Step title="Open the categories">
            Go to <Path>Settings → Categories</Path>. The niche&apos;s starting categories are already listed, in the
            site&apos;s language.
          </Step>
          <Step title="Adjust if needed">
            You can rename, add or archive categories here. For Arabic sites, have the editor check the Arabic names.
          </Step>
          <Step title="Click Sync with WordPress">
            Missing categories are created in WordPress and existing ones are linked. This runs automatically when
            WordPress is first connected; run it again whenever you change categories.
          </Step>
        </Steps>
        <Note title="Allow auto-publish">
          Each category has an <strong>Allow auto-publish</strong> button. Leave it off. It only matters in Automatic
          mode and is switched on only after the team agrees.
        </Note>
      </Section>

      <Section title="D. Check the news sources">
        <Steps>
          <Step title="Open the sources">
            Go to <Path>Settings → Sources</Path>. Sources marked <strong>niche</strong> come from the niche and are
            shared with the niche&apos;s other sites.
          </Step>
          <Step title="Disable any that do not fit this site">
            Niche sources can be disabled for this site only. To change a niche source for every site, use the{" "}
            <DocLink href="/niches">Niches</DocLink> page.
          </Step>
          <Step title="Add site-only sources (optional)">
            Add a source with its feed address and a rights note. Tick &quot;images may be reused&quot; only when the
            source has given written permission.
          </Step>
        </Steps>
      </Section>

      <Note tone="warning" title="Automation starts paused">
        A new website does not draft anything yet. In <DocLink href="/docs/add-a-website/go-live">step 4</DocLink>,
        check Review mode and a positive AI budget, resume automation, then prepare and review a few test drafts. Google
        reporting can be connected separately; it is not required for drafting.
      </Note>
    </DocPage>
  );
}
