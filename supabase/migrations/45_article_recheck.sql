-- Re-check after edits. An editor can send a finished draft job (one with an article) back through
-- three more steps: recollect (read the article's current source pages), reverify (AI fact check of
-- the saved article) and reillustrate (an AI image when the article still has none). The job ends
-- as succeeded again; its story stays "used", so these steps are claimed without a selected story.

alter table public.jobs drop constraint jobs_step_check;
alter table public.jobs add constraint jobs_step_check
  check (step in ('collect','research','draft','verify','illustrate','create_article','recollect','reverify','reillustrate'));

-- Same as 27, except that a re-check job (article_id set) runs with a used story and returns to
-- succeeded, not failed, when its recovery attempts run out.
create or replace function public.claim_draft_job(worker uuid)
returns setof public.jobs language plpgsql security definer set search_path = '' as $$
declare chosen uuid;
begin
  if not public.is_system_request() then raise exception 'Service only'; end if;
  update public.jobs set status = case when article_id is null then 'failed' else 'succeeded' end,
    step = case when article_id is null then step else 'create_article' end,
    last_error = 'Worker recovery attempts exhausted', locked_by = null, locked_until = null
    where status = 'running' and locked_until <= now() and attempt_count >= max_attempts;
  select j.id into chosen from public.jobs j join public.websites w on w.id = j.website_id
    join public.story_candidates s on s.id = j.story_id
    where j.run_after <= now() and j.attempt_count < j.max_attempts
      and (j.status = 'queued' or (j.status = 'running' and j.locked_until <= now()))
      and (s.status = 'selected' or j.article_id is not null)
      and w.archived_at is null and not w.automation_paused and w.automation_mode <> 'off'
      and exists (select 1 from public.network_settings n where not n.automation_paused)
    order by j.created_at, j.id for update of j skip locked limit 1;
  return query update public.jobs set status = 'running', locked_by = worker,
    locked_until = now() + interval '2 minutes', attempt_count = attempt_count + 1
    where id = chosen returning *;
end;
$$;
