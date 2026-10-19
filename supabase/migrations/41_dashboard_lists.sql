-- Invoker views keep the base tables' RLS; they expose joined fields needed for server-side lists.
create view public.story_list with (security_invoker = true) as
select s.*, c.name as source_name, c.kind as source_kind,
  w.name as website_name, w.timezone, w.text_direction
from public.story_candidates s
join public.websites w on w.id = s.website_id
left join public.content_sources c on c.id = s.source_id and c.website_id = s.website_id;

create view public.job_list with (security_invoker = true) as
select j.id, j.website_id, j.story_id, j.status, j.step, j.attempt_count, j.max_attempts,
  j.last_error, j.article_id, j.created_at, j.updated_at, s.title as story_title,
  w.name as website_name, w.timezone, w.text_direction
from public.jobs j join public.story_candidates s on s.id = j.story_id and s.website_id = j.website_id
join public.websites w on w.id = j.website_id;

create view public.article_list with (security_invoker = true) as
select a.*, coalesce(jsonb_array_length(j.state->'warnings'), 0) > 0 as has_warnings,
  p.status::text as publication_status, p.last_error as publication_error
from public.articles a left join public.jobs j on j.article_id = a.id and j.website_id = a.website_id
left join public.publications p on p.article_id = a.id and p.website_id = a.website_id;

create view public.website_list with (security_invoker = true) as
select w.*, n.name as niche_name,
  (select max(a.published_at) from public.articles a where a.website_id = w.id) as last_published_at,
  (coalesce(s.estimated_cost_usd,0) + coalesce(s.reserved_cost_usd,0) >= w.monthly_ai_budget_usd * 0.8
    and coalesce(s.estimated_cost_usd,0) + coalesce(s.reserved_cost_usd,0) > 0) as near_budget
from public.websites w left join public.niches n on n.id = w.niche_id
left join public.website_ai_spend s on s.website_id = w.id;

create view public.website_traffic_totals with (security_invoker = true) as
select website_id, sum(page_views) as page_views, sum(clicks) as clicks
from public.website_traffic_daily
where day >= (now() at time zone 'UTC')::date - 27 group by website_id;

create view public.slot_attention with (security_invoker = true) as
select s.website_id, count(*) as total from public.publish_slots s
join public.websites w on w.id = s.website_id
where s.status in ('skipped','failed') and w.archived_at is null
  and (s.slot_at at time zone w.timezone)::date = (now() at time zone w.timezone)::date
group by s.website_id;

revoke all on public.story_list, public.job_list, public.article_list, public.website_list, public.website_traffic_totals, public.slot_attention from public, anon;
grant select on public.story_list, public.job_list, public.article_list, public.website_list, public.website_traffic_totals, public.slot_attention to authenticated, service_role;

-- Aggregate in PostgreSQL: PostgREST's response limit must never truncate financial totals.
create function public.website_month_usage(target_website uuid, target_month date)
returns table (operation text, cost_usd numeric, searches bigint, calls bigint)
language sql stable security invoker set search_path = '' as $$
  select u.operation,
    sum(case when u.status in ('reserved','uncertain') then u.reserved_cost_usd else u.estimated_cost_usd end),
    sum(u.search_queries), count(*)
  from public.ai_usage u where u.website_id = target_website
    and u.created_at >= target_month::timestamp at time zone 'UTC'
    and u.created_at < (target_month + interval '1 month')::timestamp at time zone 'UTC'
  group by u.operation;
$$;
create function public.month_other_costs(target_month date)
returns table (website_id uuid, amount_usd numeric)
language sql stable security invoker set search_path = '' as $$
  select c.website_id, sum(c.amount_usd) from public.cost_entries c where c.month = target_month group by c.website_id;
$$;
create function public.job_usage_summary(target_job uuid)
returns table (operation text, cost_usd numeric, searches bigint, calls bigint)
language sql stable security invoker set search_path = '' as $$
  select u.operation,
    sum(case when u.status in ('reserved','uncertain') then u.reserved_cost_usd else u.estimated_cost_usd end),
    sum(u.search_queries), count(*) from public.ai_usage u where u.job_id = target_job group by u.operation;
$$;
revoke all on function public.website_month_usage(uuid,date), public.month_other_costs(date), public.job_usage_summary(uuid) from public, anon;
grant execute on function public.website_month_usage(uuid,date), public.month_other_costs(date), public.job_usage_summary(uuid) to authenticated, service_role;

-- Existing indexes already cover stories (website,status,created), articles (website,status,updated)
-- and audit dates. These add global sorting and commonly combined filters.
create index stories_status_published_idx on public.story_candidates (status, source_published_at desc, id);
create index stories_source_created_idx on public.story_candidates (website_id, source_id, created_at desc);
create index articles_review_submitted_idx on public.articles (status, submitted_at, id);
create index articles_category_updated_idx on public.articles (website_id, category_id, updated_at desc);
create index jobs_website_status_updated_idx on public.jobs (website_id, status, updated_at desc);
create index audit_actor_created_idx on public.audit_log (actor_id, created_at desc);
create index alerts_website_kind_created_idx on public.alerts (website_id, kind, created_at desc);
create index sources_website_name_idx on public.content_sources (website_id, name);
create index articles_website_published_idx on public.articles (website_id, published_at desc);

-- These are the high-volume substring searches; small configuration tables do not need GIN indexes.
create extension if not exists pg_trgm with schema extensions;
create index stories_title_search_idx on public.story_candidates using gin (title extensions.gin_trgm_ops);
create index articles_title_search_idx on public.articles using gin (title extensions.gin_trgm_ops);
