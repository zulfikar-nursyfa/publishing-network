import { DocLink, DocPage, List, Note, Path, Section } from "../doc-parts";

export const metadata = { title: "Website settings" };

export default function WebsiteSettingsGuidePage() {
  return (
    <DocPage
      href="/docs/settings"
      title="Website settings"
      description="Administrators change these under Settings → Edit website. Editors can view website details, but cannot change these settings."
    >
      <Section title="Website">
        <List>
          <li>
            <strong>Name</strong>: the dashboard name. Required; use a name that clearly identifies the site and
            language.
          </li>
          <li>
            <strong>Slug</strong>: a short identifier using Latin letters, numbers and hyphens. Initially blank; it is
            made from the name if left empty. Keep an existing value unless there is a reason to change it.
          </li>
          <li>
            <strong>Domain</strong>: the public website address. Required; enter the correct site, without a page
            address.
          </li>
          <li>
            <strong>Language</strong>: starts as English. Choose Arabic (right to left) for an Arabic website. This
            controls AI writing and reading direction, not automatic translation from another site.
          </li>
          <li>
            <strong>Niche</strong>: starts as None. Choose the right subject group to receive its sources, starting
            categories and language-specific writing guide.
          </li>
          <li>
            <strong>Topic</strong>: initially blank. Describe what the site covers; the AI uses this when writing.
          </li>
          <li>
            <strong>Audience</strong>: initially blank. Describe who the site is for; the AI uses this too.
          </li>
        </List>
      </Section>
      <Section title="Branding">
        <List>
          <li>
            <strong>Tagline</strong>: optional short description. Starts blank.
          </li>
          <li>
            <strong>Primary colour</strong>: optional brand colour. Starts unset; choose the agreed brand colour rather
            than changing it for individual articles.
          </li>
          <li>
            <strong>Logo</strong>: optional image. Starts empty. Use the site&apos;s approved logo; removing it does not
            remove the website.
          </li>
        </List>
        <p>
          These fields store the website&apos;s branding. Changing them here does not by itself install or redesign a
          WordPress theme.
        </p>
      </Section>
      <Section title="WordPress connection">
        <List>
          <li>
            <strong>WordPress URL</strong>: the full address of the WordPress site. Required; check that it is the
            intended live or test site.
          </li>
          <li>
            <strong>WordPress username</strong>: required publishing user, prepared in WordPress.
          </li>
          <li>
            <strong>Application password</strong>: required when adding a website. Stored privately and not shown again.
            When editing, leave it empty to keep the saved password.
          </li>
        </List>
        <p>
          Use <Path>Settings → Overview → Test connection</Path> to check access. It reports the connection and
          connector version. See <DocLink href="/docs/add-a-website/wordpress">Prepare WordPress</DocLink> for the setup
          steps.
        </p>
      </Section>
      <Section title="Google Analytics and Search Console">
        <List>
          <li>
            <strong>GA4 property ID</strong>: optional, starts blank. Enter the numeric property ID only after the
            Google account and access are ready.
          </li>
          <li>
            <strong>Search Console property</strong>: optional, starts blank. Enter the exact property the dashboard has
            permission to read.
          </li>
        </List>
        <p>
          Either service can be connected on its own. Empty fields mean its numbers are not available. See{" "}
          <DocLink href="/docs/traffic">Traffic</DocLink> and the existing{" "}
          <DocLink href="/docs/add-a-website/google">Google setup guide</DocLink>.
        </p>
      </Section>
      <Section title="Editors and saving">
        <p>
          <strong>Editors</strong> starts with no selections on a new website. Tick the people who should work on this
          site. Unticked editors cannot see it; administrators see every website without being assigned.
        </p>
        <p>
          Use <strong>Save settings</strong> after changes. If settings changed while you were saving, reload before
          trying again so you do not replace another person&apos;s work.
        </p>
      </Section>
      <Note title="Automation has its own controls">
        The same form contains <strong>Publishing and automation</strong>. Their defaults and effects are covered on{" "}
        <DocLink href="/docs/settings/automation">Publishing and automation settings</DocLink>. Alert muting is managed
        in Network settings, not in the website form.
      </Note>
    </DocPage>
  );
}
