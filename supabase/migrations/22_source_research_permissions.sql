-- Discovery access does not imply permission to collect full-page evidence.
alter table public.content_sources add column research_allowed boolean not null default false;
alter table public.content_sources add constraint content_sources_research_rights_check
  check (not research_allowed or length(trim(coalesce(attribution_note,''))) > 0);
