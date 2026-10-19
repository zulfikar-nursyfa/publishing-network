alter table public.websites add column auto_select_stories boolean not null default false;
alter table public.story_candidates
  add column title_fingerprint text,
  add column selected_automatically boolean not null default false,
  -- Remember suppressed feed matches so title dedupe does not erase the multi-source signal.
  add column reporting_source_ids uuid[] not null default '{}';
create index story_candidates_title_idx on public.story_candidates (website_id, title_fingerprint);

-- Ranked ids come from the pure selector. Serialize selection with queue_story_draft's lock.
create function public.auto_select_stories(target_website uuid, ranked_stories uuid[])
returns integer language plpgsql security definer set search_path = '' as $$
declare w public.websites; n public.network_settings; capacity integer; occupied integer;
  chosen uuid; selected_count integer := 0; site_spend numeric; network_spend numeric;
begin
  if not public.is_system_request() then raise exception 'Service only'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_website::text, 20));
  select * into w from public.websites where id = target_website for share;
  select * into n from public.network_settings for share;
  if w.id is null or n.id is null or not w.auto_select_stories or w.archived_at is not null
    or w.automation_paused or n.automation_paused or w.automation_mode = 'off' then return 0; end if;
  select coalesce(sum(estimated_cost_usd + reserved_cost_usd), 0),
    coalesce(sum(estimated_cost_usd + reserved_cost_usd) filter (where website_id = w.id), 0)
    into network_spend, site_spend from public.website_ai_spend;
  if site_spend >= w.monthly_ai_budget_usd or (n.monthly_ai_budget_usd is not null and network_spend >= n.monthly_ai_budget_usd) then return 0; end if;
  select (select count(*) from public.jobs where website_id = w.id and status in ('queued','running'))
    + (select count(*) from public.articles where website_id = w.id and origin = 'automated' and status in ('in_review','approved'))
    + (select count(*) from public.story_candidates s where s.website_id = w.id and s.status = 'selected'
      and not exists (select 1 from public.jobs j where j.website_id = w.id and j.story_id = s.id)) into occupied;
  capacity := least(12, w.daily_quota * 2 - occupied);
  foreach chosen in array ranked_stories loop
    exit when selected_count >= capacity;
    update public.story_candidates s set status = 'selected', selected_automatically = true
      where s.id = chosen and s.website_id = w.id and s.status = 'new' and not s.selected_automatically
        and coalesce(s.source_published_at, s.created_at) between now() - interval '48 hours' and now()
        and exists (select 1 from public.content_sources c where c.id = s.source_id and c.website_id = w.id and c.active)
        and not exists (select 1 from public.jobs j where j.website_id = w.id and j.story_id = s.id);
    if found then
      selected_count := selected_count + 1;
      insert into public.audit_log (website_id, action, entity_type, entity_id, details)
        values (w.id, 'story.auto_selected', 'story', chosen::text, '{"automatic":true}'::jsonb);
    end if;
  end loop;
  return selected_count;
end;
$$;
revoke all on function public.auto_select_stories(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.auto_select_stories(uuid, uuid[]) to service_role;
