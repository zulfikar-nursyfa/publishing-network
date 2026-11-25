import { DocLink, DocPage, List, Note, Section } from "../../doc-parts";

export const metadata = { title: "Publishing and automation settings" };

export default function AutomationSettingsGuidePage() {
  return (
    <DocPage
      href="/docs/settings/automation"
      title="Publishing and automation settings"
      description="Start paused, keep human review on and set an agreed spending limit before asking the system to draft."
    >
      <Section title="Publishing and automation in Edit website">
        <List>
          <li>
            <strong>Publishing timezone</strong>: new forms use Africa/Cairo. Choose the website&apos;s market timezone;
            scheduled dates and publishing times use it.
          </li>
          <li>
            <strong>Publishing times</strong>: new forms start at 08:00, 14:00 and 20:00. Each time means one automatic
            article per day, up to 12. No times means a quota of zero. Confirm the times with the team.
          </li>
          <li>
            <strong>Monthly AI spending limit (USD)</strong>: starts at 0, which blocks new AI calls. Set an agreed
            positive amount before drafting. The next call must fit within the remaining allowance too.
          </li>
          <li>
            <strong>Automation mode</strong>: starts at{" "}
            <strong>Review: every automated article is approved first</strong>. This is the safe choice while the team
            checks quality.
          </li>
          <li>
            <strong>Off: no automated articles</strong>: stops automatic drafting and regular publishing slots. It does
            not block manual publishing or an individually chosen schedule.
          </li>
          <li>
            <strong>Automatic: drafts in auto-publish categories skip review when every check passes</strong>: use only
            after the team agrees. The category also needs Allow auto-publish; sensitive, unsupported or flagged work
            still waits for review.
          </li>
          <li>
            <strong>AI model</strong>: starts blank, using the network default, then the service&apos;s default if the
            network has none. Leave it blank unless an administrator is deliberately choosing another priced model.
          </li>
          <li>
            <strong>Automatically select recent stories to fill the review buffer</strong>: starts off. Leave off when
            editors choose every story; enable only when automatic picks are wanted.
          </li>
          <li>
            <strong>Generate AI illustrations for automated articles</strong>: starts off. Enable only when image
            options are wanted. Each draft first gets a Shutterstock photo when one fits (credited
            &ldquo;Shutterstock&rdquo;, never reused on the same website), otherwise a Nano Banana 2.1 AI image.
            Shutterstock is used only when its four <code>SHUTTERSTOCK_*</code> server settings (search keys, an API
            token and the paid plan&apos;s subscription id) are set; until then every draft gets the AI image. Choosing
            the photo and the AI image count toward the AI budget, and published AI images are labelled as
            illustrations.
          </li>
        </List>
        <p>
          The waiting supply aims for two days of AI articles, counting queued and running jobs and articles in review
          or approved. There is no separate setting for its size. With no publishing times, an editor can still use
          Queue AI draft on a selected story; the usual pause, mode and budget controls still apply to running that job.
        </p>
      </Section>
      <Section title="Automation on Settings → Overview">
        <List>
          <li>
            <strong>Resume automation</strong> / <strong>Pause automation</strong>: websites start paused. Resume only
            after checking the connection, sources, categories, editors and budget.
          </li>
          <li>
            <strong>Archive website</strong>: hides the site from the active list and stops its automation. It does not
            delete its articles or other records. New websites are not archived.
          </li>
          <li>
            <strong>Restore website</strong>: brings an archived site back to the active list. Check its pause status
            and settings before expecting new work. Archiving also pauses the site; restoring it does not resume it.
          </li>
        </List>
      </Section>
      <Section title="Controls elsewhere">
        <p>
          <strong>Pause all automation</strong> on Overview is a network-wide control. It starts unpaused for the
          network, while new websites still start paused individually.
        </p>
        <p>
          <strong>Allow auto-publish</strong> is a separate category choice, initially off.{" "}
          <strong>Draft checks</strong> are network-wide and initially all off. Website alert muting also starts off.
          See <DocLink href="/docs/settings/network">Network settings</DocLink>.
        </p>
      </Section>
      <Note tone="warning" title="A pause does not take articles off WordPress">
        Published articles stay live. People can still publish approved articles, and individually scheduled articles
        can still publish. Use <strong>Unschedule</strong> or <strong>Unpublish</strong> for those specific needs. See{" "}
        <DocLink href="/docs/publishing">Publishing times and quotas</DocLink>.
      </Note>
    </DocPage>
  );
}
