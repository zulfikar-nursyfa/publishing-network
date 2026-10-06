-- One resumable draft per story. Workers persist one bounded step per invocation.
alter table public.story_candidates add constraint story_candidates_id_website_key unique (id, website_id);
-- Avoid two different discovered URLs producing an article with the same automated headline.
create unique index articles_automated_title_key on public.articles
  (website_id, lower(regexp_replace(trim(title), '[[:space:]]+', ' ', 'g'))) where origin = 'automated';
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  story_id uuid not null,
  kind text not null default 'draft' check (kind = 'draft'),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  step text not null default 'collect' check (step in ('collect','research','draft','verify','create_article')),
  state jsonb not null default '{}'::jsonb,
  article_id uuid,
  run_after timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 4 check (max_attempts between 1 and 10),
  locked_by uuid,
  locked_until timestamptz,
  last_error text,
  requested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, story_id),
  unique (id, website_id),
  foreign key (story_id, website_id) references public.story_candidates(id, website_id) on delete cascade,
  foreign key (article_id, website_id) references public.articles(id, website_id)
);
create index jobs_due_idx on public.jobs (run_after, created_at) where status in ('queued','running');
create trigger jobs_updated_at before update on public.jobs for each row execute function public.set_updated_at();
alter table public.jobs enable row level security;
create policy "jobs: members read" on public.jobs for select to authenticated using (public.can_access_website(website_id));
revoke all on public.jobs from anon, authenticated;
grant select on public.jobs to authenticated;
grant all on public.jobs to service_role;

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
    order by j.run_after, j.created_at for update of j skip locked limit 1;
  return query update public.jobs set status = 'running', locked_by = worker,
    locked_until = now() + interval '2 minutes', attempt_count = attempt_count + 1
    where id = chosen returning *;
end;
$$;
revoke all on function public.claim_draft_job(uuid) from public, anon, authenticated;
grant execute on function public.claim_draft_job(uuid) to service_role;

create or replace function public.queue_story_draft(target_story uuid, requester uuid, evidence_urls jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare s public.story_candidates; result uuid; capacity integer; occupied integer;
begin
  if not public.is_system_request() then raise exception 'Service only'; end if;
  select * into s from public.story_candidates where id = target_story for update;
  if s.id is null or s.status <> 'selected' then raise exception 'Select the story before queuing a draft'; end if;
  if not exists (select 1 from public.websites where id = s.website_id and archived_at is null) then raise exception 'Website is archived'; end if;
  perform pg_advisory_xact_lock(hashtextextended(s.website_id::text, 20));
  select id into result from public.jobs where website_id = s.website_id and story_id = s.id;
  if result is not null then return result; end if;
  if requester is null then
    select w.daily_quota * 2 into capacity from public.websites w, public.network_settings n
      where w.id = s.website_id and not w.automation_paused and w.automation_mode <> 'off' and not n.automation_paused;
    if coalesce(capacity,0) = 0 then return null; end if;
    select (select count(*) from public.jobs where website_id = s.website_id and status in ('queued','running'))
      + (select count(*) from public.articles where website_id = s.website_id and origin = 'automated' and status in ('in_review','approved')) into occupied;
    if occupied >= capacity then return null; end if;
  end if;
  insert into public.jobs (website_id, story_id, requested_by, state)
    values (s.website_id, s.id, requester, jsonb_build_object('pending_urls', evidence_urls))
    on conflict (website_id, story_id) do nothing returning id into result;
  if result is null then select id into result from public.jobs where website_id = s.website_id and story_id = s.id; end if;
  return result;
end;
$$;
revoke all on function public.queue_story_draft(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.queue_story_draft(uuid, uuid, jsonb) to service_role;

create or replace function public.complete_draft_job(target_job uuid, worker uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare j public.jobs; s public.story_candidates; draft jsonb; result uuid; ref jsonb;
begin
  if not public.is_system_request() then raise exception 'Service only'; end if;
  select * into j from public.jobs where id = target_job for update;
  if j.status <> 'running' or j.locked_by is distinct from worker or j.locked_until <= now() or j.step <> 'create_article' then
    raise exception 'Draft lease lost';
  end if;
  if not exists (select 1 from public.websites w, public.network_settings n
    where w.id = j.website_id and w.archived_at is null and not w.automation_paused and w.automation_mode <> 'off' and not n.automation_paused) then
    raise exception 'Automation is paused or off';
  end if;
  select * into s from public.story_candidates where id = j.story_id for update;
  if s.status <> 'selected' then raise exception 'Story is no longer selected'; end if;
  draft = j.state->'draft';
  if j.state->'verification'->>'passed' is distinct from 'true' or draft is null then raise exception 'Draft is not verified'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(j.state->'evidence','[]'::jsonb)) e
    where not exists (select 1 from public.content_sources c where c.id = (e->>'source_id')::uuid
      and c.website_id = j.website_id and c.active and c.research_allowed and length(trim(coalesce(c.attribution_note,''))) > 0)) then
    raise exception 'Research permission was removed';
  end if;
  insert into public.articles (website_id, origin, status, title, slug, excerpt, body, story_fingerprint,
    category_id, sensitive, submitted_at, review_note)
  values (j.website_id, 'automated', 'in_review', draft->>'title', draft->>'slug', draft->>'excerpt', draft->>'body', s.fingerprint,
    nullif(draft->>'category_id','')::uuid, coalesce((draft->>'sensitive')::boolean, true), now(),
    'AI checks passed. Human review is required; verify facts, dates, names and sources before approval.')
  on conflict (website_id, story_fingerprint) where story_fingerprint is not null do nothing returning id into result;
  if result is null then
    select id into result from public.articles where website_id = j.website_id and story_fingerprint = s.fingerprint;
  else
    for ref in select value from jsonb_array_elements(j.state->'sources') loop
      insert into public.article_sources (website_id, article_id, url, title, publisher)
        values (j.website_id, result, ref->>'url', ref->>'title', ref->>'publisher') on conflict (article_id,url) do nothing;
    end loop;
  end if;
  update public.story_candidates set status = 'used' where id = s.id;
  update public.jobs set status = 'succeeded', article_id = result, locked_by = null, locked_until = null, last_error = null where id = j.id;
  return result;
end;
$$;
revoke all on function public.complete_draft_job(uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_draft_job(uuid, uuid) to service_role;
