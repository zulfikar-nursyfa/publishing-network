-- Research now searches the web for coverage of each story (Gemini with Google Search),
-- so search requests are priced and reserved alongside tokens. Pages are read without a
-- per-source permission; sources stay for discovery, credit and marking official sites.
alter table public.ai_model_prices
  add column search_per_thousand_usd numeric(12,6) not null default 35 check (search_per_thousand_usd >= 0);
alter table public.ai_usage
  add column search_per_thousand_usd numeric(12,6) not null default 0;
alter table public.ai_usage drop constraint ai_usage_operation_check;
alter table public.ai_usage add constraint ai_usage_operation_check check (operation in ('search','research','draft','verify'));

drop function public.reserve_ai_call(uuid, uuid, text, text, text, integer, integer);
create function public.reserve_ai_call(target_job uuid, worker uuid, chosen_model text,
  operation_name text, prompt_hash text, prompt_tokens integer, maximum_output_tokens integer, maximum_searches integer default 0)
returns setof public.ai_usage language plpgsql security definer set search_path = '' as $$
declare j public.jobs; w public.websites; n public.network_settings; p public.ai_model_prices;
  reservation numeric; site_spend numeric; network_spend numeric;
begin
  if not public.is_system_request() then raise exception 'Service only'; end if;
  if prompt_tokens < 0 or maximum_output_tokens not between 1 and 8192 or maximum_searches not between 0 and 10 then raise exception 'Invalid token bounds'; end if;
  perform pg_advisory_xact_lock(210021);
  select * into j from public.jobs where id = target_job for update;
  if j.status is distinct from 'running' or j.locked_by is distinct from worker or j.locked_until <= now() then raise exception 'Draft lease lost'; end if;
  select * into w from public.websites where id = j.website_id;
  select * into n from public.network_settings where id;
  if w.archived_at is not null or w.automation_paused or w.automation_mode = 'off' or n.id is null or n.automation_paused then
    raise exception 'Automation is paused or off';
  end if;
  select * into p from public.ai_model_prices where model = chosen_model;
  if p.model is null then raise exception 'Configure model pricing before generating content'; end if;
  reservation = ceil(((prompt_tokens * p.input_per_million_usd + maximum_output_tokens * p.output_per_million_usd) / 1000000
    + maximum_searches * p.search_per_thousand_usd / 1000) * 100000000) / 100000000;
  select coalesce(sum(case when status in ('reserved','uncertain') then reserved_cost_usd else estimated_cost_usd end),0),
    coalesce(sum(case when website_id = w.id then case when status in ('reserved','uncertain') then reserved_cost_usd else estimated_cost_usd end else 0 end),0)
    into network_spend, site_spend from public.ai_usage
    where created_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC' or status in ('reserved','uncertain');
  if site_spend + reservation > w.monthly_ai_budget_usd then raise exception 'Website AI budget would be exceeded'; end if;
  if n.monthly_ai_budget_usd is not null and network_spend + reservation > n.monthly_ai_budget_usd then raise exception 'Network AI budget would be exceeded'; end if;
  return query insert into public.ai_usage (website_id,job_id,model,operation,input_hash,reserved_cost_usd,input_per_million_usd,output_per_million_usd,search_per_thousand_usd)
    values (w.id,j.id,p.model,operation_name,prompt_hash,reservation,p.input_per_million_usd,p.output_per_million_usd,p.search_per_thousand_usd) returning *;
end;
$$;
revoke all on function public.reserve_ai_call(uuid, uuid, text, text, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_call(uuid, uuid, text, text, text, integer, integer, integer) to service_role;

drop function public.settle_ai_call(uuid, text, integer, integer, jsonb, text);
create function public.settle_ai_call(usage_id uuid, outcome text, prompt_tokens integer,
  generated_tokens integer, response_data jsonb, explanation text, searches integer default 0)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_system_request() then raise exception 'Service only'; end if;
  if outcome not in ('completed','uncertain','failed') or prompt_tokens < 0 or generated_tokens < 0 or searches < 0 then raise exception 'Invalid usage settlement'; end if;
  perform pg_advisory_xact_lock(210021);
  update public.ai_usage set status = outcome, input_tokens = prompt_tokens, output_tokens = generated_tokens, search_queries = searches,
    estimated_cost_usd = case when outcome = 'completed' then
      ceil(((prompt_tokens * input_per_million_usd + generated_tokens * output_per_million_usd) / 1000000
        + searches * search_per_thousand_usd / 1000) * 100000000) / 100000000
      else 0 end,
    result = response_data, last_error = left(explanation,500), completed_at = now()
    where id = usage_id and status = 'reserved';
  return found;
end;
$$;
revoke all on function public.settle_ai_call(uuid, text, integer, integer, jsonb, text, integer) from public, anon, authenticated;
grant execute on function public.settle_ai_call(uuid, text, integer, integer, jsonb, text, integer) to service_role;

-- Same as 20, without the per-source research permission and with a clear duplicate-headline error.
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
  if exists (select 1 from public.articles where website_id = j.website_id and origin = 'automated'
    and story_fingerprint is distinct from s.fingerprint
    and lower(regexp_replace(trim(title), '[[:space:]]+', ' ', 'g')) = lower(regexp_replace(trim(draft->>'title'), '[[:space:]]+', ' ', 'g'))) then
    raise exception 'Another automated article already has this headline';
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
