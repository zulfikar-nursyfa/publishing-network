-- Finish the oldest draft before starting the next. Ordering by run_after sent every job to the back
-- of the line after each step, so ten queued stories each got one step per ten minutes and none
-- finished (and every story paid for a search first). Jobs waiting on a retry delay are still skipped.
create or replace function public.claim_draft_job(worker uuid)
returns setof public.jobs language plpgsql security definer set search_path = '' as $$
declare chosen uuid;
begin
  if not public.is_system_request() then raise exception 'Service only'; end if;
  update public.jobs set status = 'failed', last_error = 'Worker recovery attempts exhausted', locked_by = null, locked_until = null
    where status = 'running' and locked_until <= now() and attempt_count >= max_attempts;
  select j.id into chosen from public.jobs j join public.websites w on w.id = j.website_id
    join public.story_candidates s on s.id = j.story_id
    where j.run_after <= now() and j.attempt_count < j.max_attempts
      and (j.status = 'queued' or (j.status = 'running' and j.locked_until <= now()))
      and s.status = 'selected' and w.archived_at is null and not w.automation_paused and w.automation_mode <> 'off'
      and exists (select 1 from public.network_settings n where not n.automation_paused)
    order by j.created_at, j.id for update of j skip locked limit 1;
  return query update public.jobs set status = 'running', locked_by = worker,
    locked_until = now() + interval '2 minutes', attempt_count = attempt_count + 1
    where id = chosen returning *;
end;
$$;
