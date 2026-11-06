-- Traffic sources and contact-link clicks from GA4, and the weekly report.
-- The connector plugin sends GA4 events contact_phone, contact_email and contact_whatsapp when a
-- reader clicks a tel:, mailto: or WhatsApp link. The traffic sync stores their daily total on
-- website_traffic_daily and a 28-day snapshot per page; sources are a 28-day snapshot too.
-- Both snapshots are replaced on every sync, like website_traffic_pages.

alter table public.website_traffic_daily add column contact_clicks integer;

create table public.website_traffic_sources (
  website_id uuid not null references public.websites (id) on delete cascade,
  channel text not null,
  source text not null,
  sessions integer not null,
  users integer not null,
  updated_at timestamptz not null default now(),
  primary key (website_id, channel, source)
);

create table public.website_contact_clicks (
  website_id uuid not null references public.websites (id) on delete cascade,
  path text not null,
  article_id uuid references public.articles (id) on delete set null,
  channel text not null check (channel in ('phone', 'email', 'whatsapp')),
  clicks integer not null,
  updated_at timestamptz not null default now(),
  primary key (website_id, path, channel)
);

alter table public.website_traffic_sources enable row level security;
alter table public.website_contact_clicks enable row level security;

create policy "traffic sources: members read" on public.website_traffic_sources
  for select to authenticated using (public.can_access_website(website_id));
create policy "contact clicks: members read" on public.website_contact_clicks
  for select to authenticated using (public.can_access_website(website_id));

revoke all on public.website_traffic_sources, public.website_contact_clicks from anon, authenticated;
grant select on public.website_traffic_sources, public.website_contact_clicks to authenticated;
grant all on public.website_traffic_sources, public.website_contact_clicks to service_role;

-- The Monday (UTC) of the last week emailed, so overlapping cron runs send it once.
alter table public.network_settings add column weekly_report_sent_for date;

-- Per website for [period_start, period_end): articles published (automated / manual), automated
-- drafts created, draft jobs that failed, estimated AI cost (open calls at their reservation, as in
-- website_month_costs) and traffic summed over the UTC days in the period. Traffic stays null when
-- nothing was synced, so "not connected" is not shown as zero. Runs as the caller (RLS applies).
create or replace function public.website_period_report(period_start timestamptz, period_end timestamptz)
returns table (website_id uuid, published_automated bigint, published_manual bigint, drafted bigint,
  failed_jobs bigint, ai_cost_usd numeric, sessions bigint, page_views bigint, search_clicks bigint,
  contact_clicks bigint)
language sql stable security invoker set search_path = '' as $$
  with spend as (
    select u.website_id,
      sum(case when u.status in ('reserved', 'uncertain') then u.reserved_cost_usd else u.estimated_cost_usd end) as cost
    from public.ai_usage u
    where u.created_at >= period_start and u.created_at < period_end
    group by u.website_id
  ),
  counts as (
    select a.website_id,
      count(*) filter (where a.origin = 'automated' and a.published_at >= period_start and a.published_at < period_end) as automated,
      count(*) filter (where a.origin = 'manual' and a.published_at >= period_start and a.published_at < period_end) as manual,
      count(*) filter (where a.origin = 'automated' and a.created_at >= period_start and a.created_at < period_end) as drafted
    from public.articles a
    where (a.published_at >= period_start and a.published_at < period_end)
      or (a.created_at >= period_start and a.created_at < period_end)
    group by a.website_id
  ),
  failures as (
    select j.website_id, count(*) as failed
    from public.jobs j
    where j.status = 'failed' and j.updated_at >= period_start and j.updated_at < period_end
    group by j.website_id
  ),
  traffic as (
    select t.website_id, sum(t.sessions) as sessions, sum(t.page_views) as page_views, sum(t.clicks) as clicks,
      sum(t.contact_clicks) as contact_clicks
    from public.website_traffic_daily t
    where t.day >= (period_start at time zone 'UTC')::date and t.day < (period_end at time zone 'UTC')::date
    group by t.website_id
  )
  select w.id, coalesce(c.automated, 0), coalesce(c.manual, 0), coalesce(c.drafted, 0), coalesce(f.failed, 0),
    coalesce(s.cost, 0), t.sessions, t.page_views, t.clicks, t.contact_clicks
  from public.websites w
  left join spend s on s.website_id = w.id
  left join counts c on c.website_id = w.id
  left join failures f on f.website_id = w.id
  left join traffic t on t.website_id = w.id;
$$;

revoke all on function public.website_period_report(timestamptz, timestamptz) from public, anon;
grant execute on function public.website_period_report(timestamptz, timestamptz) to authenticated, service_role;
