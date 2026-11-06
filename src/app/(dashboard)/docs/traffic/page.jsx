import { DocLink, DocPage, List, Note, Path, Section } from "../doc-parts";

export const metadata = { title: "Traffic" };

export default function TrafficGuidePage() {
  return (
    <DocPage
      href="/docs/traffic"
      title="Traffic"
      description="The dashboard reads Google's reports. These are stored reporting numbers, not a live count of everyone on the site right now."
    >
      <Section title="Where to find the numbers">
        <p>
          Open a website&apos;s <strong>Traffic</strong> tab. <strong>Traffic and search, last 28 days</strong> shows
          totals, and the top-content lists show pages and Google searches. Published articles can show matching page
          and search information too.
        </p>
        <p>
          The detailed lists have pages and searches views. A blank <strong>Page path (blank = whole site)</strong>{" "}
          shows site-wide search terms; a specific page path narrows searches to that page.
        </p>
      </Section>
      <Section title="What the labels mean">
        <List>
          <li>
            <strong>Sessions</strong>: visits reported by Google Analytics.
          </li>
          <li>
            <strong>Page views</strong>: page loads reported by Google Analytics. One visit may include several views.
          </li>
          <li>
            <strong>Users</strong>: people counted by Google Analytics in a page report.
          </li>
          <li>
            <strong>Search clicks</strong>: clicks from Google search results, reported by Search Console.
          </li>
          <li>
            <strong>Impressions</strong>: appearances in Google search results.
          </li>
          <li>
            <strong>CTR</strong>: clicks as a share of impressions.
          </li>
          <li>
            <strong>Avg. position</strong>: average search-result position, weighted by how often results were shown. A
            smaller position number is nearer the top.
          </li>
        </List>
        <p>
          Traffic includes the website&apos;s reported pages, not just articles created by this dashboard. Top lists are
          limited snapshots, not a complete list of every visit or search. A search position does not guarantee future
          ranking.
        </p>
      </Section>
      <Section title="Traffic sources and contact clicks">
        <p>
          <strong>Traffic sources and contact clicks, last 28 days</strong> needs Google Analytics. Sources show the
          channel (for example Organic Search, Direct, Referral, Organic Social) and the site that sent the visit.
        </p>
        <p>
          Contact clicks count taps on phone (<Path>tel:</Path>), email (<Path>mailto:</Path>) and WhatsApp links. The
          connector plugin 1.3.0 or newer sends them to Google Analytics as <strong>contact_phone</strong>,{" "}
          <strong>contact_email</strong> and <strong>contact_whatsapp</strong>, using the site&apos;s existing Google tag.
          No phone number or email address is sent. A click is not a confirmed call, message or inquiry.
        </p>
        <p>
          Sites that load Google Analytics only through Google Tag Manager need a GTM trigger for these events. In
          Google Analytics you can mark them as key events.
        </p>
      </Section>
      <Section title="Weekly report">
        <p>
          <DocLink href="/weekly">Weekly report</DocLink> shows each website&apos;s published articles (automated and
          manual), AI drafts, failed draft jobs, estimated AI cost, sessions, page views, search clicks and contact
          clicks for Monday to Sunday (UTC), with the change from the week before. Alert recipients get it by email
          every Monday.
        </p>
      </Section>
      <Section title="When the numbers update">
        <p>
          The automatic update runs daily at 04:00 UTC. It requests the 28 days ending yesterday; today&apos;s live
          activity is not included. Search Console can be two to three days behind, so recent days may fill in later.
        </p>
        <p>
          An administrator can use <strong>Update now</strong> instead of waiting. Check <strong>Last updated</strong>{" "}
          and any <strong>Last update failed</strong> message. Updating the dashboard does not make Google&apos;s
          delayed data available sooner.
        </p>
        <p>
          Each update replaces the top-page and search snapshot for the same reporting window. Page addresses are
          matched to published articles where possible.
        </p>
      </Section>
      <Section title="If the page is empty or shows a dash">
        <List>
          <li>
            <strong>Not connected</strong>: an administrator needs to add GA4 property ID or Search Console property in
            website settings.
          </li>
          <li>
            <strong>Not updated yet</strong> or <strong>No traffic snapshot yet</strong>: the connection may be new, an
            update has not completed, or Google has no rows to return.
          </li>
          <li>
            A dash can mean a service is not connected or a value is unavailable. It is not proof that there were no
            readers.
          </li>
          <li>
            If an update fails, ask an administrator to check the exact property and the Google account&apos;s access.
            Old stored figures may remain visible after a failed update.
          </li>
        </List>
      </Section>
      <Note title="Setup is separate from reading the reports">
        The Google tracking and permissions must be ready before useful numbers arrive. Follow{" "}
        <DocLink href="/docs/add-a-website/google">Google Analytics and Search Console</DocLink> and check{" "}
        <Path>Settings → Edit website → Google Analytics and Search Console</Path>. The code cannot confirm that a live
        website&apos;s tracking has been installed correctly.
      </Note>
    </DocPage>
  );
}
