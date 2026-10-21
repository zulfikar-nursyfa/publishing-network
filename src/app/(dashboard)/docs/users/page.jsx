import { DocLink, DocPage, List, Note, Path, Section, Step, Steps } from "../doc-parts";

export const metadata = { title: "Users and permissions" };

export default function UsersGuidePage() {
  return (
    <DocPage
      href="/docs/users"
      title="Users and permissions"
      description="There are two dashboard roles: Administrator and Editor. Website assignments decide which sites an editor can work on."
    >
      <Section title="What an editor can do">
        <List>
          <li>See assigned websites, their articles, stories, draft jobs, traffic and permitted activity history.</li>
          <li>
            Select or skip stories, queue a selected story for an AI draft, and inspect the job&apos;s evidence and
            warnings.
          </li>
          <li>
            Create and edit articles, choose images, submit for review, approve, reject, schedule, publish and unpublish
            articles on assigned sites.
          </li>
          <li>Use Remove from drafting on unwanted jobs for assigned websites.</li>
          <li>Read this Guide, view website details and use Test connection on an assigned website.</li>
        </List>
        <p>
          Editor is not a read-only role. Approval and publishing are not restricted to administrators or to someone
          other than the author.
        </p>
      </Section>
      <Section title="What only an administrator can do">
        <List>
          <li>See and manage every website, regardless of assignments.</li>
          <li>Add or edit websites, connections, branding, sources, categories, niches and writing guides.</li>
          <li>Change automation, budgets, network settings, model prices, alert recipients and muted websites.</li>
          <li>Invite people, change roles and assign websites.</li>
          <li>
            Use the job&apos;s Recovery card to retry or cancel work, review uncertain AI charges, and reset exhausted
            publishing attempts.
          </li>
          <li>Enter other costs, open the network Costs report and its exports, or use Update now for traffic.</li>
        </List>
      </Section>
      <Section title="Invite a team member">
        <Steps>
          <Step title="Open Users → Invite a user">Enter Email and, optionally, Full name.</Step>
          <Step title="Choose Role">
            It starts as Editor. Choose Administrator only for someone who should manage the whole network. There is no
            separate client or viewer role.
          </Step>
          <Step title="Choose Websites for an editor">
            Tick only the sites they need. With no assigned websites, an editor has no website work to view.
          </Step>
          <Step title="Send invitation">
            The email contains a link to choose a password. If it does not arrive, check the email address and ask the
            administrator responsible for email delivery to investigate.
          </Step>
        </Steps>
      </Section>
      <Section title="Change access later">
        <p>
          On <DocLink href="/users">Users</DocLink>, change the person&apos;s role or website selections. Website
          assignments can also be changed under <Path>Settings → Edit website → Editors</Path>.
        </p>
        <p>
          An administrator cannot remove their own administrator access. The dashboard and database both enforce website
          access; knowing an article&apos;s address does not grant access to another site.
        </p>
      </Section>
      <Note title="Client access needs a deliberate choice">
        Choose Editor with the necessary websites if a client should be able to work on content. That also allows
        approval and publishing. The code does not offer a role that only reads reports without those editorial powers.
      </Note>
    </DocPage>
  );
}
