import { Code, DocLink, DocPage, List, Note, Path, Section, Step, Steps } from "../../doc-parts";

export const metadata = { title: "Google Analytics and Search Console" };

export default function GoogleStepPage() {
  return (
    <DocPage
      href="/docs/add-a-website/google"
      title="3. Google Analytics and Search Console"
      description="Count visitors and Google searches for the new site, and let the dashboard read the numbers. Use the Cosmos Google account for everything on this page."
    >
      <Section title="What these two tools do">
        <List>
          <li>
            <strong>Google Analytics (GA4)</strong> counts visitors, sessions and page views on the site.
          </li>
          <li>
            <strong>Google Search Console</strong> shows how the site appears in Google: searches, clicks, impressions
            and position. It is also where you tell Google about the sitemap.
          </li>
        </List>
        <p>
          Each day the dashboard reads both and shows the last 28 days on the website&apos;s <strong>Traffic</strong>{" "}
          tab and on each published article.
        </p>
      </Section>

      <Section title="A. Create the Google Analytics property">
        <Steps>
          <Step title="Open Google Analytics">
            Go to <DocLink href="https://analytics.google.com">analytics.google.com</DocLink> and sign in with the
            Cosmos Google account.
          </Step>
          <Step title="Create a property">
            Click <Path>Admin</Path> (the gear at the bottom left), choose the Cosmos account, then{" "}
            <Path>Create → Property</Path>. Name it after the site, for example{" "}
            <Code>Business &amp; Investment (EN)</Code>. Set the reporting time zone and currency, then follow the
            questions to the end.
          </Step>
          <Step title="Add a web data stream">
            When asked for a platform, choose <strong>Web</strong>. Enter the site address (
            <Code>bussinessandinvesment.com</Code>) and a stream name, then click <strong>Create stream</strong>.
          </Step>
          <Step title="Note the property ID">
            Go to <Path>Admin → Property details</Path> (or Property settings). Copy the <strong>Property ID</strong>.
            It is only numbers, for example <Code>456789123</Code>.
          </Step>
        </Steps>
        <Note tone="warning" title="Property ID, not Measurement ID">
          The dashboard needs the number-only <strong>Property ID</strong>. The <Code>G-XXXXXXX</Code> code is the
          Measurement ID. It is used for the tracking tag, not in the dashboard.
        </Note>
      </Section>

      <Section title="B. Put the tracking on the site and verify Search Console">
        <p>
          The easiest way is Google&apos;s own WordPress plugin, <strong>Site Kit by Google</strong>. It adds the
          Analytics tag and verifies Search Console in one go, without editing any code.
        </p>
        <Steps>
          <Step title="Install Site Kit">
            In WordPress, go to <Path>Plugins → Add New Plugin</Path>, search for <strong>Site Kit by Google</strong>,
            install and activate it.
          </Step>
          <Step title="Run the setup">
            Click <strong>Start setup</strong> and sign in with the Cosmos Google account. Allow the permissions it asks
            for. Site Kit verifies that you own the site and connects Search Console.
          </Step>
          <Step title="Connect Analytics">
            When asked, choose <strong>Connect Google Analytics</strong> and pick the property and web stream you
            created in part A. Make sure the tag is set to be placed on the site.
          </Step>
          <Step title="Check it works">
            Open the site in another browser tab. In Google Analytics, open <Path>Reports → Realtime</Path>. Within a
            minute you should see one visitor.
          </Step>
        </Steps>
        <Note title="Without Site Kit">
          You can also verify Search Console yourself. At{" "}
          <DocLink href="https://search.google.com/search-console">search.google.com/search-console</DocLink>, click{" "}
          <Path>Add property</Path>, choose <strong>Domain</strong>, enter the domain, and copy the TXT record it shows.
          In SiteGround, add it under <Path>Site Tools → Domain → DNS Zone Editor → TXT</Path>, then click{" "}
          <strong>Verify</strong>. It can take up to a few hours.
        </Note>
      </Section>

      <Section title="C. Give the dashboard read access">
        <p>
          The dashboard reads Google through its own Google robot account (a &quot;service account&quot;). The same one
          is used for every website, so you only need to add its email address to each new site.
        </p>
        <p>
          Ask an administrator for the email address of the Google account configured for the dashboard&apos;s reports.
          Use that exact address below; it is separate from your own Google login.
        </p>
        <h3 className="font-semibold">In Google Analytics</h3>
        <Steps>
          <Step title="Open property access">
            Go to <Path>Admin</Path>. Check the property selector at the top shows the new site, then open{" "}
            <Path>Property access management</Path>.
          </Step>
          <Step title="Add the dashboard">
            Click <strong>+</strong> → <strong>Add users</strong>. Paste the confirmed dashboard email address, untick
            &quot;Notify new users by email&quot;, choose the role <strong>Viewer</strong> and click{" "}
            <strong>Add</strong>.
          </Step>
        </Steps>
        <h3 className="font-semibold">In Search Console</h3>
        <Steps>
          <Step title="Open users">
            At <DocLink href="https://search.google.com/search-console">Search Console</DocLink>, pick the site from the
            property list at the top left, then go to <Path>Settings → Users and permissions</Path>.
          </Step>
          <Step title="Add the dashboard">
            Click <strong>Add user</strong>, paste the email address, choose <strong>Restricted</strong> and click{" "}
            <strong>Add</strong>.
          </Step>
          <Step title="Note the property name">
            Look at the property list at the top left:
            <List>
              <li>
                If it shows just the domain (a <strong>Domain</strong> property), you will enter{" "}
                <Code>sc-domain:bussinessandinvesment.com</Code>.
              </li>
              <li>
                If it shows a full address starting with https (a <strong>URL prefix</strong> property), you will enter
                it exactly, ending with a slash: <Code>https://bussinessandinvesment.com/</Code>.
              </li>
            </List>
          </Step>
        </Steps>
      </Section>

      <Section title="D. Enter the details in the dashboard">
        <Steps>
          <Step title="Open the website form">
            In the dashboard, open the website, then <Path>Settings → Edit website</Path>.
          </Step>
          <Step title="Fill in the Google fields">
            Under <strong>Google Analytics and Search Console</strong>, enter the <strong>GA4 property ID</strong> (the
            numbers) and the <strong>Search Console property</strong> (from the step above). Click{" "}
            <strong>Save settings</strong>.
          </Step>
          <Step title="Pull the numbers now">
            Open the website&apos;s <Path>Traffic</Path> tab and click <strong>Update now</strong>. You do not have to
            wait for the daily update.
          </Step>
        </Steps>
        <Note title="Numbers start small">
          A new site shows zeros until people visit it. Search Console numbers arrive two to three days late, and only
          once Google starts showing the site in search results.
        </Note>
        <Note tone="warning" title="If the Traffic card shows an error">
          <List>
            <li>
              &quot;Does not have sufficient permissions&quot;: the dashboard email was not added in part C, was added
              to a different property, or the Property ID is wrong. Fix it and click Update now again after a few
              minutes.
            </li>
            <li>An error mentioning Search Console: check the user was added there and the property name is exact.</li>
          </List>
        </Note>
      </Section>
    </DocPage>
  );
}
