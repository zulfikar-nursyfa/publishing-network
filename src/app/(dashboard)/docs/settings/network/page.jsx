import { DRAFT_CHECKS } from "@/lib/automation/strict-checks";
import { DocLink, DocPage, List, Note, Path, Section } from "../../doc-parts";

export const metadata = { title: "Network settings" };

export default function NetworkSettingsGuidePage() {
  return (
    <DocPage
      href="/docs/settings/network"
      title="Network settings"
      description="Only administrators can change these shared controls. A change can affect every website."
    >
      <Section title="AI controls">
        <List>
          <li>
            <strong>Default Gemini model</strong>: starts blank, using the service&apos;s default. A website&apos;s own
            AI model overrides it. Leave it blank unless a priced model has been agreed.
          </li>
          <li>
            <strong>Network monthly AI limit (USD)</strong>: starts blank, meaning no additional network limit. Website
            limits still apply. Zero stops new AI calls. Set an agreed network ceiling when one is required.
          </li>
        </List>
        <p>
          Use <strong>Save network settings</strong>. The network-wide pause is controlled separately by{" "}
          <strong>Pause all automation</strong> / <strong>Resume automation</strong> on Overview; it starts unpaused.
        </p>
      </Section>
      <Section title="Draft checks">
        <p>
          All switches under <strong>Block drafts when…</strong> start off. Each checked item stops a job rather than
          leaving that issue as a reviewer warning:
        </p>
        <List>
          {DRAFT_CHECKS.map(({ key, description }) => (
            <li key={key}>{description}</li>
          ))}
        </List>
        <p>
          Use <strong>Save draft checks</strong>. Changes apply from the next job step. Core originality, length and
          language checks always apply. For a cautious rollout, consider blocking a sensitive story without a second
          source and a draft that does not cite the official source, after agreeing the review policy.
        </p>
        <p>
          See <DocLink href="/docs/ai-drafting/messages">Drafting failure messages</DocLink> before changing a check
          just to get a stopped job through.
        </p>
      </Section>
      <Section title="Alerts">
        <List>
          <li>
            <strong>Alert recipients</strong>: starts empty, so email alerts are off. Use Add email, then Save
            recipients. Up to ten distinct addresses are allowed.
          </li>
          <li>
            <strong>Test delivery → Send test email</strong>: sends to saved recipients. Save any recipient changes
            first. Email delivery must also be configured by the person who runs the service.
          </li>
          <li>
            <strong>Muted websites</strong>: starts with every website unmuted. Search by name, tick test sites and use
            Save muted websites. Their problems are not emailed; their spending still counts toward the network budget.
          </li>
        </List>
        <p>
          Muting is not a pause and does not clear a problem. After unmuting, only problems still found by the current
          alert checks are eligible; resolved problems are not replayed.
        </p>
      </Section>
      <Section title="Model price estimates">
        <List>
          <li>
            <strong>Model ID</strong>: the exact model name. New entries start blank; an existing entry&apos;s name
            cannot be changed here.
          </li>
          <li>
            <strong>Input price (USD per 1 million tokens)</strong>: price for the material sent to the model. Tokens
            are the small pieces of text Google counts.
          </li>
          <li>
            <strong>Output price (USD per 1 million tokens)</strong>: price for the model&apos;s answer, including its
            reasoning and image output where applicable.
          </li>
          <li>
            <strong>Web search price (USD per 1,000 searches)</strong>: the search price. New forms suggest 35; this is
            not a guarantee of the provider&apos;s rate. Enter 0 for an image model that does not search.
          </li>
        </List>
        <p>
          Input and output prices have no new-entry default. Copy confirmed rates for the chosen model, then use{" "}
          <strong>Add model pricing</strong> or <strong>Update estimate</strong>. Models need a price entry before they
          can generate content.
        </p>
      </Section>
      <Note title="Budgets are estimates, not invoices">
        Wrong model prices give misleading estimates and spending controls. See{" "}
        <DocLink href="/docs/costs">Costs and budgets</DocLink>. Open <Path>Network settings → Alerts</Path> to manage
        delivery, not the website editing form.
      </Note>
    </DocPage>
  );
}
