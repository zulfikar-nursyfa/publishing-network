-- AI calls an editor asks for on the article form ("Generate with AI" for the SEO fields) have no
-- draft job. They are recorded in ai_usage without one and count against the same budgets.
alter table public.ai_usage alter column job_id drop not null;
alter table public.ai_usage drop constraint ai_usage_operation_check;
alter table public.ai_usage add constraint ai_usage_operation_check
  check (operation in ('search','research','draft','verify','illustrate','seo'));

-- Like reserve_ai_call, without the job lease and automation switches: an editor's request is not
-- automation, so only an archived website, missing pricing or the budgets stop it.
create function public.reserve_editor_ai_call(target_website uuid, chosen_model text, operation_name text,
  prompt_hash text, prompt_tokens integer, maximum_output_tokens integer)
returns setof public.ai_usage language plpgsql security definer set search_path = '' as $$
declare w public.websites; n public.network_settings; p public.ai_model_prices;
  reservation numeric; site_spend numeric; network_spend numeric;
begin
  if not public.is_system_request() then raise exception 'Service only'; end if;
  if operation_name <> 'seo' then raise exception 'Unknown editor operation'; end if;
  if prompt_tokens < 0 or maximum_output_tokens not between 1 and 8192 then raise exception 'Invalid token bounds'; end if;
  perform pg_advisory_xact_lock(210021);
  select * into w from public.websites where id = target_website;
  if w.id is null or w.archived_at is not null then raise exception 'Website is archived'; end if;
  select * into n from public.network_settings where id;
  select * into p from public.ai_model_prices where model = chosen_model;
  if p.model is null then raise exception 'Configure model pricing before generating content'; end if;
  reservation = ceil((prompt_tokens * p.input_per_million_usd + maximum_output_tokens * p.output_per_million_usd)
    / 1000000 * 100000000) / 100000000;
  select coalesce(sum(case when status in ('reserved','uncertain') then reserved_cost_usd else estimated_cost_usd end),0),
    coalesce(sum(case when website_id = w.id then case when status in ('reserved','uncertain') then reserved_cost_usd else estimated_cost_usd end else 0 end),0)
    into network_spend, site_spend from public.ai_usage
    where created_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC' or status in ('reserved','uncertain');
  if site_spend + reservation > w.monthly_ai_budget_usd then raise exception 'Website AI budget would be exceeded'; end if;
  if n.monthly_ai_budget_usd is not null and network_spend + reservation > n.monthly_ai_budget_usd then raise exception 'Network AI budget would be exceeded'; end if;
  return query insert into public.ai_usage (website_id,model,operation,input_hash,reserved_cost_usd,input_per_million_usd,output_per_million_usd,search_per_thousand_usd)
    values (w.id,p.model,operation_name,prompt_hash,reservation,p.input_per_million_usd,p.output_per_million_usd,p.search_per_thousand_usd) returning *;
end;
$$;
revoke all on function public.reserve_editor_ai_call(uuid, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_editor_ai_call(uuid, text, text, text, integer, integer) to service_role;
