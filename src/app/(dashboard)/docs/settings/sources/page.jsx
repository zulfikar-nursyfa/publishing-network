import { DocLink, DocPage, List, Note, Path, Section } from "../../doc-parts";

export const metadata = { title: "Niches, sources and categories" };

export default function SourceSettingsGuidePage() {
  return (
    <DocPage
      href="/docs/settings/sources"
      title="Niches, sources and categories"
      description="Administrators manage the shared source groups and writing guides. A website can also have its own sources and category choices."
    >
      <Section title="Niches and writing guides">
        <p>
          A niche groups websites covering the same subject. Use <DocLink href="/niches">Niches</DocLink> to add a niche
          by <strong>Name</strong>, manage its source group and edit its writing guides. A new niche&apos;s name must
          include Latin letters.
        </p>
        <p>
          The guide fields are <strong>English websites</strong> and <strong>Arabic websites</strong>. They guide
          research and drafting for that language. Existing niches may already contain guidance; a new guide can be
          blank. Use clear editorial instructions, with neutral language and no permission to invent facts or copy
          sources. Use <strong>Save guides</strong>; changes apply from the next research or draft step.
        </p>
        <p>
          Starting categories are grouped by language. Name and Slug (ASCII) are required; Description starts blank.
          Sort order starts at 0, with lower numbers appearing first on new website copies. Archived (no longer copied
          to websites) starts off. Use the correct language and a short Latin-letter slug, even when the category&apos;s
          name is Arabic.
        </p>
        <p>
          <strong>Apply to websites</strong> copies the niche&apos;s sources and missing starting categories to its
          websites. It does not overwrite local category names, order or publishing choices. Then use each
          website&apos;s <strong>Sync with WordPress</strong>.
        </p>
        <p>
          Saving a niche source or starting category already applies it to the niche&apos;s websites. Source details are
          shared, but a website&apos;s enabled or disabled choice is kept. Archiving a starting category only stops
          future copying; archive an existing website category separately if it should no longer be offered there.
        </p>
      </Section>
      <Section title="Source fields">
        <p>
          Use <Path>Settings → Sources</Path> for one website. Edit shared niche sources on Niches; disable their copies
          locally when they do not suit a particular site.
        </p>
        <List>
          <li>
            <strong>Name</strong>: required publisher name. Use the real organisation or outlet.
          </li>
          <li>
            <strong>Type</strong>: starts as News outlet. Choose Official newsroom, Government or API only when that
            describes the source. Official newsroom and Government pages count as official evidence.
          </li>
          <li>
            <strong>Website URL</strong>: required full source address. Check that it belongs to the intended publisher.
          </li>
          <li>
            <strong>RSS or Atom feed URL</strong>: optional story-feed address, initially empty. Without a feed, the
            source supplies no inbox stories, but its pages can still be recognised during research.
          </li>
          <li>
            <strong>Attribution and usage rights note</strong>: optional, initially blank. Record credit requirements
            and reuse terms.
          </li>
          <li>
            <strong>Images from this source may be reused</strong>: starts off. Turn it on only after confirming
            permission under the source&apos;s terms; a public page or feed alone is not image permission.
          </li>
        </List>
        <p>
          Added sources start enabled. <strong>Disable</strong> stops that source supplying new stories for the site;{" "}
          <strong>Enable</strong> turns it back on. Check feed error messages when a source stops supplying stories.
          Removing a site-only source is different from disabling a shared one.
        </p>
      </Section>
      <Section title="Website categories">
        <List>
          <li>
            <strong>Name</strong>: required section name readers see.
          </li>
          <li>
            <strong>Slug</strong>: the short name used in its WordPress address. It can be made from a Latin-letter name
            on creation; Arabic names need a Latin-letter slug. Changing an existing slug changes the category address.
          </li>
          <li>
            <strong>Description</strong>: optional, initially blank. Explain the category so the AI can choose it
            sensibly.
          </li>
          <li>
            <strong>Allow auto-publish</strong>: starts off. Leave it off while every article needs a person. It takes
            effect only in Automatic mode and only when all safeguards pass. Use <strong>Require review</strong> to turn
            it off again.
          </li>
          <li>
            <strong>Archive</strong> / <strong>Restore</strong>: retire or bring back a category. New categories start
            unarchived; archived categories are not offered for new AI drafts.
          </li>
        </List>
        <p>
          Use <Path>Settings → Categories → Sync with WordPress</Path> to link matching categories and create missing
          ones. Eligible existing WordPress categories can be imported too. Check any error before publishing an article
          in an unlinked category.
        </p>
      </Section>
      <Note title="Sources and categories do different jobs">
        Sources provide possible stories and evidence. Categories organise finished articles. Neither makes an article
        accurate by itself. See <DocLink href="/docs/ai-drafting">AI drafting rules and checks</DocLink>.
      </Note>
    </DocPage>
  );
}
