-- Writing guides are edited in a rich text editor and saved as HTML, so headings and lists add
-- markup to the length. The AI prompts receive the guide as plain text (nicheGuideFor).
alter table public.niches
  drop constraint niches_guide_en_check,
  drop constraint niches_guide_ar_check,
  add constraint niches_guide_en_check check (char_length(guide_en) <= 8000),
  add constraint niches_guide_ar_check check (char_length(guide_ar) <= 8000);

-- A computed field, so the Niches list can sort by it (PostgREST: order=source_count).
-- Security invoker: niche_sources RLS still applies to the count.
create function public.source_count(public.niches)
returns bigint
language sql
stable
set search_path = ''
as $$
  select count(*) from public.niche_sources s where s.niche_id = $1.id;
$$;

revoke execute on function public.source_count(public.niches) from public, anon;
grant execute on function public.source_count(public.niches) to authenticated;
