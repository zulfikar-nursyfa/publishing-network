-- Cost report. cost_entries holds the costs that are not AI calls, entered by administrators per
-- month: images, paid sources, extra hosting, editorial time and other. website_id null is a
-- network-wide charge, which the report splits evenly across the active websites. The existing
-- Vercel Pro, Supabase Pro and SiteGround subscriptions are left out (project brief).

create table public.cost_entries (
  id uuid primary key default gen_random_uuid(),
  website_id uuid references public.websites (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  category text not null check (category in ('images', 'sources', 'hosting', 'editorial', 'other')),
  amount_usd numeric(12, 2) not null check (amount_usd between 0 and 1000000),
  note text check (note is null or length(note) <= 300),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index cost_entries_month_idx on public.cost_entries (month, website_id);

alter table public.cost_entries enable row level security;

create policy "cost entries: admin manages" on public.cost_entries
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.cost_entries from anon, authenticated;
grant select, insert, delete on public.cost_entries to authenticated;
grant all on public.cost_entries to service_role;

-- Per website for one UTC month (the budget month): estimated AI cost (open calls at their
-- reservation, as the budget counts them), the AI image part, searches, automated drafts created
-- and articles published. Runs as the caller, so row level security applies.
create or replace function public.website_month_costs(target_month date)
returns table (website_id uuid, ai_cost_usd numeric, image_cost_usd numeric, searches bigint, drafted bigint, published bigint)
language sql stable security invoker set search_path = '' as $$
  with bounds as (
    select target_month::timestamp at time zone 'UTC' as start_at,
      (target_month + interval '1 month')::timestamp at time zone 'UTC' as end_at
  ),
  spend as (
    select u.website_id,
      sum(case when u.status in ('reserved', 'uncertain') then u.reserved_cost_usd else u.estimated_cost_usd end) as cost,
      sum(case when u.operation = 'illustrate' then
        case when u.status in ('reserved', 'uncertain') then u.reserved_cost_usd else u.estimated_cost_usd end
        else 0 end) as image_cost,
      sum(u.search_queries) as searches
    from public.ai_usage u, bounds b
    where u.created_at >= b.start_at and u.created_at < b.end_at
    group by u.website_id
  ),
  counts as (
    select a.website_id,
      count(*) filter (where a.origin = 'automated' and a.created_at >= b.start_at and a.created_at < b.end_at) as drafted,
      count(*) filter (where a.published_at >= b.start_at and a.published_at < b.end_at) as published
    from public.articles a, bounds b
    group by a.website_id
  )
  select w.id, coalesce(u.cost, 0), coalesce(u.image_cost, 0), coalesce(u.searches, 0),
    coalesce(c.drafted, 0), coalesce(c.published, 0)
  from public.websites w
  left join spend u on u.website_id = w.id
  left join counts c on c.website_id = w.id;
$$;

-- Articles created or published in one UTC month, with their AI cost and 28-day traffic, for
-- the CSV export.
create or replace function public.month_article_report(target_month date)
returns table (website text, title text, status text, origin text, category text, created_at timestamptz,
  published_at timestamptz, url text, ai_cost_usd numeric, page_views integer, search_clicks integer,
  search_impressions integer)
language sql stable security invoker set search_path = '' as $$
  with bounds as (
    select target_month::timestamp at time zone 'UTC' as start_at,
      (target_month + interval '1 month')::timestamp at time zone 'UTC' as end_at
  )
  select w.name, a.title, a.status::text, a.origin::text, c.name, a.created_at, a.published_at, a.wp_post_url,
    (select sum(case when u.status in ('reserved', 'uncertain') then u.reserved_cost_usd else u.estimated_cost_usd end)
      from public.jobs j join public.ai_usage u on u.job_id = j.id where j.article_id = a.id),
    p.page_views, p.clicks, p.impressions
  from public.articles a
  cross join bounds b
  join public.websites w on w.id = a.website_id
  left join public.categories c on c.id = a.category_id
  left join public.website_traffic_pages p on p.article_id = a.id
  where (a.created_at >= b.start_at and a.created_at < b.end_at)
    or (a.published_at >= b.start_at and a.published_at < b.end_at)
  order by w.name, a.created_at;
$$;

revoke all on function public.website_month_costs(date), public.month_article_report(date) from public, anon;
grant execute on function public.website_month_costs(date), public.month_article_report(date) to authenticated, service_role;
