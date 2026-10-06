-- Prices are configuration, not billing. Global catalog, like network_settings.
create table public.ai_model_prices (
  model text primary key check (model ~ '^gemini-[A-Za-z0-9._-]+$'),
  input_per_million_usd numeric(12,6) not null check (input_per_million_usd >= 0),
  output_per_million_usd numeric(12,6) not null check (output_per_million_usd >= 0),
  updated_at timestamptz not null default now()
);
-- Standard text pricing checked against https://ai.google.dev/gemini-api/docs/pricing.
insert into public.ai_model_prices values ('gemini-2.5-flash', 0.30, 2.50, now()), ('gemini-2.5-flash-lite', 0.10, 0.40, now());
alter table public.ai_model_prices enable row level security;
create policy "model prices: signed-in reads" on public.ai_model_prices for select to authenticated using (true);
create policy "model prices: admin manages" on public.ai_model_prices for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.ai_model_prices from anon;
grant select, insert, update, delete on public.ai_model_prices to authenticated;
grant all on public.ai_model_prices to service_role;

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  job_id uuid not null,
  provider text not null default 'gemini' check (provider = 'gemini'),
  model text not null,
  operation text not null check (operation in ('research','draft','verify')),
  input_hash text not null,
  status text not null default 'reserved' check (status in ('reserved','completed','uncertain','failed','reconciled')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  search_queries integer not null default 0 check (search_queries >= 0),
  reserved_cost_usd numeric(14,8) not null check (reserved_cost_usd >= 0),
  estimated_cost_usd numeric(14,8) not null default 0 check (estimated_cost_usd >= 0),
  input_per_million_usd numeric(12,6) not null,
  output_per_million_usd numeric(12,6) not null,
  result jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (job_id, website_id) references public.jobs(id, website_id) on delete cascade
);
create index ai_usage_website_month_idx on public.ai_usage (website_id, created_at);
create index ai_usage_job_operation_idx on public.ai_usage (job_id, operation, input_hash) where status = 'completed';
alter table public.ai_usage enable row level security;
create policy "usage: members read" on public.ai_usage for select to authenticated using (public.can_access_website(website_id));
revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;
grant all on public.ai_usage to service_role;

create or replace function public.reserve_ai_call(target_job uuid, worker uuid, chosen_model text,
  operation_name text, prompt_hash text, prompt_tokens integer, maximum_output_tokens integer)
returns setof public.ai_usage language plpgsql security definer set search_path = '' as $$
declare j public.jobs; w public.websites; n public.network_settings; p public.ai_model_prices;
  reservation numeric; site_spend numeric; network_spend numeric;
begin
  if not public.is_system_request() then raise exception 'Service only'; end if;
  if prompt_tokens < 0 or maximum_output_tokens not between 1 and 8192 then raise exception 'Invalid token bounds'; end if;
  -- One lock for all reservations and settlements prevents concurrent workers overspending.
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
  reservation = ceil((prompt_tokens * p.input_per_million_usd + maximum_output_tokens * p.output_per_million_usd) / 1000000 * 100000000) / 100000000;
  select coalesce(sum(case when status in ('reserved','uncertain') then reserved_cost_usd else estimated_cost_usd end),0),
    coalesce(sum(case when website_id = w.id then case when status in ('reserved','uncertain') then reserved_cost_usd else estimated_cost_usd end else 0 end),0)
    into network_spend, site_spend from public.ai_usage
    where created_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC' or status in ('reserved','uncertain');
  if site_spend + reservation > w.monthly_ai_budget_usd then raise exception 'Website AI budget would be exceeded'; end if;
  if n.monthly_ai_budget_usd is not null and network_spend + reservation > n.monthly_ai_budget_usd then raise exception 'Network AI budget would be exceeded'; end if;
  return query insert into public.ai_usage (website_id,job_id,model,operation,input_hash,reserved_cost_usd,input_per_million_usd,output_per_million_usd)
    values (w.id,j.id,p.model,operation_name,prompt_hash,reservation,p.input_per_million_usd,p.output_per_million_usd) returning *;
end;
$$;
revoke all on function public.reserve_ai_call(uuid, uuid, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_call(uuid, uuid, text, text, text, integer, integer) to service_role;

create or replace function public.settle_ai_call(usage_id uuid, outcome text, prompt_tokens integer,
  generated_tokens integer, response_data jsonb, explanation text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_system_request() then raise exception 'Service only'; end if;
  if outcome not in ('completed','uncertain','failed') or prompt_tokens < 0 or generated_tokens < 0 then raise exception 'Invalid usage settlement'; end if;
  perform pg_advisory_xact_lock(210021);
  update public.ai_usage set status = outcome, input_tokens = prompt_tokens, output_tokens = generated_tokens,
    estimated_cost_usd = case when outcome = 'completed' then
      ceil((prompt_tokens * input_per_million_usd + generated_tokens * output_per_million_usd) / 1000000 * 100000000) / 100000000
      else 0 end,
    result = response_data, last_error = left(explanation,500), completed_at = now()
    where id = usage_id and status = 'reserved';
  return found;
end;
$$;
revoke all on function public.settle_ai_call(uuid, text, integer, integer, jsonb, text) from public, anon, authenticated;
grant execute on function public.settle_ai_call(uuid, text, integer, integer, jsonb, text) to service_role;

-- Only after a person checks provider billing. The age gate avoids releasing an in-flight call.
create or replace function public.reconcile_ai_call(usage_id uuid, reviewed_cost numeric, explanation text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_system_request() then raise exception 'Service only'; end if;
  if reviewed_cost < 0 or reviewed_cost > 10000 or length(trim(explanation)) < 10 then raise exception 'Provide a reviewed cost and billing reconciliation note'; end if;
  perform pg_advisory_xact_lock(210021);
  update public.ai_usage set status = 'reconciled', estimated_cost_usd = reviewed_cost, result = null,
    last_error = left(explanation,500), completed_at = now()
    where id = usage_id and status in ('reserved','uncertain') and created_at < now() - interval '10 minutes';
  return found;
end;
$$;
revoke all on function public.reconcile_ai_call(uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.reconcile_ai_call(uuid, numeric, text) to service_role;

create view public.website_ai_spend with (security_invoker = true) as
select website_id,
  coalesce(sum(estimated_cost_usd) filter (where created_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC'),0) as estimated_cost_usd,
  coalesce(sum(reserved_cost_usd) filter (where status in ('reserved','uncertain')),0) as reserved_cost_usd,
  count(*) filter (where status in ('reserved','uncertain')) as unsettled_calls
from public.ai_usage group by website_id;
grant select on public.website_ai_spend to authenticated, service_role;
