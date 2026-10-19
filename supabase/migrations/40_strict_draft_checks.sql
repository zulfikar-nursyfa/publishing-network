-- Keys match DRAFT_CHECKS in src/lib/automation/strict-checks.js. Empty preserves reviewer warnings.
alter table public.network_settings add column strict_draft_checks text[] not null default '{}'
  check (array_position(strict_draft_checks, null) is null and strict_draft_checks <@ array[
    'research_quotes_missing', 'sensitive_second_source', 'single_unofficial_source', 'unresolved_claims',
    'uncollected_citations', 'official_source_not_cited', 'research_not_cited',
    'verification_failed', 'verification_issues', 'unsupported_claims'
  ]::text[]);
