import { Code, DocPage, List, Note, Path, Section, Step, Steps } from "../../doc-parts";

export const metadata = { title: "Prepare WordPress" };

export default function WordPressStepPage() {
  return (
    <DocPage
      href="/docs/add-a-website/wordpress"
      title="1. Prepare WordPress"
      description="Get the WordPress site ready so the dashboard can publish to it. You need the site's administrator login."
    >
      <Note tone="warning" title="Use a fresh WordPress install for each website">
        English and Arabic sites are separate WordPress installs, even in the same niche. A test site (such as{" "}
        <Code>dev.…</Code>) and the real site are also separate installs and separate websites in the dashboard.
        Copy the theme, plugins and settings from the test site, never its posts.
      </Note>

      <Section title="Before you start: get into WordPress">
        <p>
          You only need a SiteGround login. SiteGround shows whether WordPress is installed and logs you in to it.
        </p>
        <Steps>
          <Step title="Open the site in SiteGround">
            Log in to SiteGround, open <Path>Websites</Path> and click <Path>Site Tools</Path> next to the domain.
          </Step>
          <Step title="Check whether WordPress is installed">
            Go to <Path>WordPress → Install &amp; Manage</Path> and look at the list at the bottom of the page.
            <List>
              <li>
                <strong>The domain is listed:</strong> WordPress is installed. Click the <strong>⋮</strong> menu next to
                it, then <strong>Log in to Admin Panel</strong>. You are now in WordPress as an administrator.
              </li>
              <li>
                <strong>Nothing is listed:</strong> WordPress is not installed yet. If <Code>your-site.com/wp-admin</Code>{" "}
                shows a SiteGround &quot;404 - Not found&quot; page, this is why. Continue with the next step.
              </li>
            </List>
          </Step>
          <Step title="Install WordPress (only if it is missing)">
            On the same page, choose <strong>WordPress</strong>, pick the domain, leave the folder empty, and set an
            administrator username, a strong password and the team email address. Click <strong>Install</strong>. Save
            the login in the team password manager. It takes a few minutes.
          </Step>
          <Step title="Turn on HTTPS">
            Go to <Path>Security → SSL Manager</Path> and check the domain has a Let&apos;s Encrypt certificate (add
            one if not). Then in <Path>Security → HTTPS Enforce</Path>, switch it on. The dashboard needs https.
          </Step>
          <Step title="Log in">
            Use <strong>Log in to Admin Panel</strong> from Install &amp; Manage, or go to{" "}
            <Code>https://your-site.com/wp-admin</Code> and sign in with the administrator login.
          </Step>
        </Steps>
        <Note title="Lost the administrator password?">
          In <Path>WordPress → Install &amp; Manage</Path>, the <strong>Log in to Admin Panel</strong> option logs you
          in without a password. Then change it under <Path>Users → Profile</Path>.
        </Note>
      </Section>

      <Section title="A. Install the connector plugin">
        <p>
          This small plugin lets the dashboard publish safely: it stops the same article from being posted twice and
          powers the Test connection button. It is a &quot;must-use&quot; plugin, so it is uploaded as a file instead of
          from the Plugins screen, and it cannot be switched off by accident.
        </p>
        <Steps>
          <Step title="Open SiteGround's File Manager">
            Log in to SiteGround, open <Path>Websites</Path>, click <Path>Site Tools</Path> next to the site, then go to{" "}
            <Path>Site → File Manager</Path>.
          </Step>
          <Step title="Go to the wp-content folder">
            Open <Code>public_html</Code> (or the folder for this domain), then <Code>wp-content</Code>.
          </Step>
          <Step title="Create the mu-plugins folder if it is missing">
            If there is no folder called <Code>mu-plugins</Code>, create one with exactly that name (lowercase, with
            the dash).
          </Step>
          <Step title="Upload the plugin file">
            Download{" "}
            <a href="/docs/downloads/publishing-network" download="publishing-network.php" className="font-medium text-foreground underline underline-offset-4">
              publishing-network.php
            </a>, then open <Code>mu-plugins</Code> and upload the downloaded file. Do not put it inside another folder.
          </Step>
          <Step title="Check it is active">
            In WordPress, go to <Path>Plugins → Installed Plugins</Path>. A <strong>Must-Use</strong> tab should show{" "}
            <strong>Publishing Network Connector</strong>. The version should be 1.1.0 or newer.
          </Step>
        </Steps>
      </Section>

      <Section title="B. Install Yoast SEO">
        <p>
          The dashboard sends each article&apos;s SEO title, meta description and focus keyphrase to Yoast. Yoast also
          creates the sitemap that Google reads.
        </p>
        <Steps>
          <Step title="Add the plugin">
            In WordPress, go to <Path>Plugins → Add New Plugin</Path>, search for <strong>Yoast SEO</strong>, click{" "}
            <strong>Install Now</strong>, then <strong>Activate</strong>.
          </Step>
          <Step title="Skip or finish the setup wizard">
            The defaults are fine. You can close the first-time configuration.
          </Step>
        </Steps>
      </Section>

      <Section title="C. Create the publishing user">
        <p>
          The dashboard logs in to WordPress as its own user, so every article shows who published it and the access
          can be removed without affecting anyone&apos;s personal account.
        </p>
        <Steps>
          <Step title="Add a new user">
            Go to <Path>Users → Add New User</Path>.
          </Step>
          <Step title="Fill in the details">
            <List>
              <li>
                Username: <Code>pn-publisher</Code>
              </li>
              <li>Email: a team mailbox you can read (each WordPress user needs its own email address)</li>
              <li>Password: any strong password. The dashboard will not use it.</li>
              <li>
                Role: <strong>Editor</strong>. Not Administrator, and not Author.
              </li>
            </List>
          </Step>
          <Step title="Save">
            Click <strong>Add New User</strong>.
          </Step>
        </Steps>
      </Section>

      <Section title="D. Create the application password">
        <p>
          An application password is a separate password just for the dashboard. It can be revoked at any time
          without changing the user&apos;s normal password.
        </p>
        <Steps>
          <Step title="Open the publishing user">
            Go to <Path>Users → All Users</Path> and click <strong>pn-publisher</strong>.
          </Step>
          <Step title="Find Application Passwords">
            Scroll to the bottom of the profile to the <strong>Application Passwords</strong> section.
          </Step>
          <Step title="Create one">
            Type the name <Code>Publishing Network</Code> and click <strong>Add New Application Password</strong>.
          </Step>
          <Step title="Copy it now">
            WordPress shows the password only once, as groups of letters separated by spaces. Copy it into the team
            password manager. You will paste it into the dashboard in the next step. The spaces can stay.
          </Step>
        </Steps>
        <Note tone="warning" title="No Application Passwords section?">
          The site must be on <strong>https://</strong>. In SiteGround, turn on HTTPS under{" "}
          <Path>Security → SSL Manager</Path>. A security plugin can also hide it: check its settings for
          &quot;application passwords&quot; or &quot;REST API&quot; and allow them.
        </Note>
      </Section>

      <Section title="E. Basic WordPress settings">
        <Steps>
          <Step title="Hide the site from Google until launch">
            Go to <Path>Settings → Reading</Path> and tick <strong>Discourage search engines from indexing this site</strong>
            . You will untick it on launch day.
          </Step>
          <Step title="Use readable article addresses">
            Go to <Path>Settings → Permalinks</Path>, choose <strong>Post name</strong> and save. Article addresses then
            look like <Code>/article-title/</Code>, which is better for Google and lets the dashboard match traffic to
            articles.
          </Step>
          <Step title="Set the site title, tagline and time zone">
            Go to <Path>Settings → General</Path>. Set the time zone to the site&apos;s market, for example{" "}
            <strong>Cairo</strong> or <strong>Dubai</strong>.
          </Step>
          <Step title="Set the language (Arabic sites)">
            On the same page, set <strong>Site Language</strong> to العربية so WordPress shows the site right to left.
          </Step>
          <Step title="Theme">
            Install the same theme and theme settings as the other sites in the network.
          </Step>
        </Steps>
        <Note title="Do not create categories by hand">
          The dashboard creates the niche&apos;s categories in WordPress for you in the next step. If some already
          exist with the same name, they are linked instead of duplicated.
        </Note>
      </Section>

      <Section title="What you should have now">
        <List>
          <li>The site address, for example <Code>https://bussinessandinvesment.com</Code></li>
          <li>
            The username <Code>pn-publisher</Code>
          </li>
          <li>The application password, saved in the password manager</li>
        </List>
      </Section>
    </DocPage>
  );
}
