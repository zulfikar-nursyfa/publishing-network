import { Code, DocLink, DocPage, List, Note, Path, Section, Step, Steps } from "../doc-parts";

export const metadata = { title: "WordPress connector plugin" };

export default function ConnectorPage() {
  return (
    <DocPage
      href="/docs/connector"
      title="WordPress connector plugin"
      description="The small plugin every WordPress site needs, how it keeps itself up to date and how to move an older site to the self-updating version."
    >
      <Section title="What it does">
        <p>The Publishing Network Connector is installed on every WordPress site. It:</p>
        <List>
          <li>marks each post with its dashboard article, so a retried publish never creates a duplicate;</li>
          <li>lets the dashboard set the Yoast SEO title, meta description and focus keyphrase;</li>
          <li>embeds X and Instagram links pasted on their own line;</li>
          <li>reports clicks on phone, email and WhatsApp links to Google Analytics;</li>
          <li>answers the Test connection button.</li>
        </List>
      </Section>

      <Section title="How it updates itself">
        <p>
          From version 2.0.0 the connector is a normal plugin that checks this dashboard for a new version about twice
          a day and installs it automatically. Nobody needs to log in to each site. The Plugins screen shows it with{" "}
          <strong>Auto-updates enabled</strong>.
        </p>
        <p>
          To see which version a site runs, open the website&apos;s settings in the dashboard and click{" "}
          <strong>Test connection</strong>. The Connector card shows the version, and a warning appears when it is
          older than the dashboard expects.
        </p>
        <Note title="Updates can take a day">
          WordPress checks for updates when the site gets visitors. A quiet site may take up to a day to update. In a
          hurry, go to <Path>Dashboard → Updates</Path> in WordPress and click <strong>Check again</strong>.
        </Note>
      </Section>

      <Section title="New websites">
        <p>
          Follow <DocLink href="/docs/add-a-website/wordpress">1. Prepare WordPress</DocLink>: download the zip from
          there and upload it under <Path>Plugins → Add New Plugin → Upload Plugin</Path>. That is the only manual
          step; later versions arrive on their own.
        </p>
      </Section>

      <Section title="Moving an existing site to version 2.0.0 (once per site)">
        <p>
          Sites set up before 2.0.0 have the old connector, a single file in <Code>wp-content/mu-plugins</Code> that
          cannot update itself. Test connection warns on these sites until they are moved. Moving takes about two
          minutes per site and does not affect published articles.
        </p>
        <Steps>
          <Step title="Download the new plugin">
            Download{" "}
            <a
              href="/api/connector/download"
              download="publishing-network.zip"
              className="font-medium text-foreground underline underline-offset-4"
            >
              publishing-network.zip
            </a>{" "}
            once; the same file works for every site.
          </Step>
          <Step title="Delete the old file">
            In SiteGround open <Path>Site Tools → Site → File Manager</Path>, go to{" "}
            <Code>public_html/wp-content/mu-plugins</Code> and delete <Code>publishing-network.php</Code>. Delete only
            that file.
          </Step>
          <Step title="Install the new plugin">
            In WordPress go to <Path>Plugins → Add New Plugin → Upload Plugin</Path>, choose the zip, click{" "}
            <strong>Install Now</strong>, then <strong>Activate Plugin</strong>.
          </Step>
          <Step title="Check it">
            In the dashboard, open the website&apos;s settings and click <strong>Test connection</strong>. The Connector
            card should show 2.0.0 or newer with no warning.
          </Step>
        </Steps>
        <Note tone="warning" title="Do the two steps together">
          Between deleting the old file and activating the new plugin, publishing to that site fails and is retried
          later, and the duplicate check is off. Pause the website&apos;s automation first, or move it at a quiet time.
        </Note>
      </Section>

      <Section title="Releasing a new version (developers)">
        <Steps>
          <Step title="Change the plugin">
            Edit <Code>wordpress/plugins/publishing-network/publishing-network.php</Code> and raise the version in both
            the <Code>Version:</Code> header and <Code>PN_CONNECTOR_VERSION</Code>. <Code>npm test</Code> fails if they
            differ.
          </Step>
          <Step title="Test it on a staging site">
            Deploy to staging, then on a test WordPress site use <Path>Dashboard → Updates → Check again</Path> and
            update. Publish one article and run Test connection.
          </Step>
          <Step title="Deploy to production">
            Every site picks up the new version within about a day. Raise <Code>REQUIRED_PLUGIN_VERSION</Code> in{" "}
            <Code>src/lib/wordpress/client.js</Code> only when the dashboard depends on the new version.
          </Step>
        </Steps>
        <Note tone="warning" title="A broken release reaches every site">
          Sites install new versions without anyone checking them. Always test on a staging site first. To undo a bad
          release, deploy a fixed version with a higher number; WordPress never installs a lower one.
        </Note>
      </Section>

      <Section title="Troubleshooting">
        <List>
          <li>
            <strong>Test connection still shows 1.x after installing 2.0.0:</strong> the old file in{" "}
            <Code>mu-plugins</Code> is still there. While it exists the new plugin stays idle. Delete it.
          </li>
          <li>
            <strong>Connector shows &quot;unknown&quot;:</strong> the plugin is not installed or was deactivated.
            Activate it under <Path>Plugins → Installed Plugins</Path>.
          </li>
          <li>
            <strong>A site never updates:</strong> check <Path>Dashboard → Updates</Path> for errors. A security plugin
            or the host may block automatic updates or outgoing requests to the dashboard.
          </li>
        </List>
      </Section>
    </DocPage>
  );
}
