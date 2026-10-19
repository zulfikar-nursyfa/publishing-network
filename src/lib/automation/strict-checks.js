export const DRAFT_CHECKS = [
  { key: "research_quotes_missing", description: "Researched facts are dropped because their quotes were not found" },
  {
    key: "sensitive_second_source",
    description: "A sensitive or consequential story has no second independent source",
  },
  {
    key: "single_unofficial_source",
    description: "Only one outlet supports the story and no official source was found",
  },
  { key: "unresolved_claims", description: "Research leaves claims unresolved" },
  { key: "uncollected_citations", description: "The draft cites pages that were not collected" },
  { key: "official_source_not_cited", description: "The draft does not cite the official source" },
  { key: "research_not_cited", description: "Researched facts are not covered by the draft's cited sources" },
  { key: "verification_failed", description: "AI verification does not pass" },
  { key: "verification_issues", description: "AI verification reports issues" },
  { key: "unsupported_claims", description: "AI verification finds unsupported claims" },
];
