-- Every skipped story says why (PM review 19 Nov). Until now only topic screening wrote skip_reason, so a
-- story an editor removed from drafting, skipped by hand, or that went stale while waiting showed under
-- Skipped with its Auto-selected badge and no reason. Same as 42 except that cancel_draft_job records the
-- reason on the story; editors may now set skip_reason with the status (changeStories), and stories
-- skipped before this migration get their cancelled job's reason.

create or replace function public.cancel_draft_job(target_job uuid, discard_story boolean default false, stale_before timestamptz default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare j public.jobs; s public.story_candidates; reason text;
begin
  if not public.is_system_request() then raise exception 'Service only'; end if;
  select * into j from public.jobs where id = target_job for update;
  if j.id is null or j.status not in ('queued','running','failed','cancelled') then return false; end if;
  select * into s from public.story_candidates where id = j.story_id and website_id = j.website_id for update;
  if s.status = 'used' then return false; end if;
  if stale_before is not null and (
    not discard_story or j.status <> 'queued' or j.step <> 'collect'
    or coalesce(j.state->'research','null'::jsonb) <> 'null'::jsonb
    or coalesce(j.state->'draft','null'::jsonb) <> 'null'::jsonb
    or coalesce((j.state->>'corroboration_searched')::boolean,false)
    or exists (select 1 from public.ai_usage u where u.job_id = j.id
      and u.operation in ('research','draft','verify','illustrate'))
    or coalesce(s.source_published_at,s.created_at) > stale_before
  ) then return false; end if;
  if j.status = 'cancelled' and (not discard_story or s.status = 'skipped') then return false; end if;
  reason := case when stale_before is not null then 'Story went stale while waiting'
    when discard_story then 'Removed from drafting by an editor' else 'Draft job cancelled' end;
  update public.jobs set status = 'cancelled', last_error = reason,
    waiting_kind = null, waiting_reason = null, waiting_since = null,
    locked_by = case when j.locked_until > now() then j.locked_by else null end,
    locked_until = case when j.locked_until > now() then j.locked_until else null end
    where id = j.id;
  if discard_story then update public.story_candidates set status = 'skipped', skip_reason = reason where id = s.id; end if;
  return true;
end;
$$;
revoke all on function public.cancel_draft_job(uuid,boolean,timestamptz) from public, anon, authenticated;
grant execute on function public.cancel_draft_job(uuid,boolean,timestamptz) to service_role;

grant update (skip_reason) on public.story_candidates to authenticated;

update public.story_candidates s
set skip_reason = case j.last_error when 'Removed from drafting' then 'Removed from drafting by an editor' else j.last_error end
from public.jobs j
where j.story_id = s.id and j.website_id = s.website_id and s.status = 'skipped' and s.skip_reason is null
  and j.status = 'cancelled' and j.last_error is not null;
