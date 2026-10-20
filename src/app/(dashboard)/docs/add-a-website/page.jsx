import { Code, DocLink, DocPage, List, Note, Path, Section } from "../doc-parts";

export const metadata = { title: "Adding a new website" };

export default function AddWebsiteOverviewPage() {
  return (
    <DocPage
      href="/docs/add-a-website"
      title="Adding a new website"
      description="The full path from an empty WordPress site to articles publishing automatically. Plan for about an hour, plus waiting time for Google."
    >
      <Section title="How it fits together">
        <p>Every website in the network is made of three parts that talk to each other:</p>
        <List>
          <li>
            <strong>WordPress</strong> is the public website readers visit. It is hosted on SiteGround.
          </li>
          <li>
            <strong>This dashboard</strong> finds stories, writes drafts with AI, lets editors review them and sends
            approved articles to WordPress at set times.
          </li>
          <li>
            <strong>Google Analytics and Search Console</strong> count visitors and Google searches. The dashboard
            reads their numbers every night and shows them on each website and article.
          </li>
        </List>
        <p>Set them up in that order. Each step below has its own page.</p>
      </Section>

      <Section title="The four steps">
        <List>
          <li>
            <DocLink href="/docs/add-a-website/wordpress">1. Prepare WordPress</DocLink>: install two plugins, create
            a publishing user and an application password, set the basic settings.
          </li>
          <li>
            <DocLink href="/docs/add-a-website/dashboard">2. Add it to the dashboard</DocLink>: fill in the website
            form, test the connection, sync categories and check the sources.
          </li>
          <li>
            <DocLink href="/docs/add-a-website/google">3. Google Analytics and Search Console</DocLink>: create the
            tracking, give the dashboard access, submit the sitemap.
          </li>
          <li>
            <DocLink href="/docs/add-a-website/go-live">4. Start automation and go live</DocLink>: test with a few
            drafts, turn automation on, then open the site to search engines.
          </li>
        </List>
      </Section>

      <Section title="Before you start, have these ready">
        <List>
          <li>
            The site&apos;s <strong>domain</strong> (for example <Code>bussinessandinvesment.com</Code>) with
            WordPress installed on SiteGround.
          </li>
          <li>
            An <strong>administrator login</strong> for that WordPress site.
          </li>
          <li>
            The <strong>connector plugin file</strong>: download{" "}
            <a href="/docs/downloads/publishing-network" download="publishing-network.php" className="font-medium text-foreground underline underline-offset-4">
              publishing-network.php
            </a>.
          </li>
          <li>
            Access to the <strong>Cosmos Google account</strong> that owns Google Analytics and Search Console.
          </li>
          <li>
            An <strong>administrator account in this dashboard</strong>. Editors cannot add websites.
          </li>
          <li>
            Decisions for the site: its <strong>niche</strong> (for example Business &amp; Investment), its{" "}
            <strong>language</strong> (English or Arabic), publishing times, monthly AI budget and which editors will
            review it.
          </li>
        </List>
      </Section>

      <Note title="Adding a website never needs a developer">
        Everything on these pages is done in WordPress, Google and this dashboard. Nothing in the code changes when a
        site is added. The only one-time technical setup (the Google service account key) is already done for the
        whole network.
      </Note>

      <Section title="Quick checklist">
        <p>Tick these off as you go. Each one is explained on the following pages.</p>
        <List>
          <li>WordPress: connector plugin installed and Yoast SEO active</li>
          <li>
            WordPress: user <Code>pn-publisher</Code> with the Editor role and an application password
          </li>
          <li>
            WordPress: <Path>Settings → Reading → Discourage search engines</Path> turned on until launch
          </li>
          <li>Dashboard: website added, Test connection shows connected</li>
          <li>Dashboard: categories synced, sources checked, editors assigned, AI limit set</li>
          <li>Google: GA4 property created and the tracking tag on the site</li>
          <li>Google: Search Console property verified</li>
          <li>Google: dashboard email added to both, IDs entered on the website, Update now shows numbers</li>
          <li>Launch: test drafts reviewed, automation resumed, search engines allowed, sitemap submitted</li>
        </List>
      </Section>
    </DocPage>
  );
}
