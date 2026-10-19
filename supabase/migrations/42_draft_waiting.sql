-- Waiting metadata is read through the existing website-scoped jobs RLS policy.
alter table public.jobs
  add column waiting_kind text check (waiting_kind in ('budget','paused')),
  add column waiting_reason text,
  add column waiting_since timestamptz,
  add constraint jobs_waiting_state_check check (
    (waiting_kind is null and waiting_reason is null and waiting_since is null)
    or (waiting_kind is not null and waiting_reason is not null and waiting_since is not null)
  );

update public.jobs set
  waiting_kind = case when last_error ~* 'budget' then 'budget' else 'paused' end,
  waiting_reason = last_error, waiting_since = updated_at
where status = 'queued' and last_error ~* 'budget|automation.*paused|automation.*off';

create or replace view public.job_list with (security_invoker = true) as
select j.id, j.website_id, j.story_id, j.status, j.step, j.attempt_count, j.max_attempts,
  j.last_error, j.article_id, j.created_at, j.updated_at, s.title as story_title,
  w.name as website_name, w.timezone, w.text_direction,
  j.waiting_kind, j.waiting_reason, j.waiting_since
from public.jobs j join public.story_candidates s on s.id = j.story_id and s.website_id = j.website_id
join public.websites w on w.id = j.website_id;

-- Serialize with completion's job -> story locks. A running request keeps its lease until
-- its next control check; status fences prevent progress or article creation after this commit.
create function public.cancel_draft_job(target_job uuid, discard_story boolean default false, stale_before timestamptz default null)
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
    when discard_story then 'Removed from drafting' else 'Draft job cancelled' end;
  update public.jobs set status = 'cancelled', last_error = reason,
    waiting_kind = null, waiting_reason = null, waiting_since = null,
    locked_by = case when j.locked_until > now() then j.locked_by else null end,
    locked_until = case when j.locked_until > now() then j.locked_until else null end
    where id = j.id;
  if discard_story then update public.story_candidates set status = 'skipped' where id = s.id; end if;
  return true;
end;
$$;
revoke all on function public.cancel_draft_job(uuid,boolean,timestamptz) from public, anon, authenticated;
grant execute on function public.cancel_draft_job(uuid,boolean,timestamptz) to service_role;
revoke all on public.job_list from public, anon;
grant select on public.job_list to authenticated, service_role;
