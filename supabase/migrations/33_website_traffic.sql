-- Google Analytics 4 and Search Console per website, and the daily numbers pulled from them by
-- /api/cron/traffic. Read with a service account (GOOGLE_SERVICE_ACCOUNT_KEY); written only by the server.

alter table public.websites
  add column ga4_property_id text check (ga4_property_id ~ '^[0-9]{5,20}$'),
  -- "sc-domain:example.com" (domain property) or "https://example.com/" (URL-prefix property).
  add column search_console_site text check (search_console_site ~ '^(sc-domain:[a-z0-9.-]+|https?://[^[:space:]]+/)$'),
  add column traffic_checked_at timestamptz,
  add column traffic_error text;

create table public.website_traffic_daily (
  website_id uuid not null references public.websites (id) on delete cascade,
  day date not null,
  users integer,
  sessions integer,
  page_views integer,
  clicks integer,
  impressions integer,
  ctr numeric(7, 4),
  position numeric(7, 2),
  updated_at timestamptz not null default now(),
  primary key (website_id, day)
);

alter table public.website_traffic_daily enable row level security;

create policy "traffic: members read" on public.website_traffic_daily
  for select to authenticated using (public.can_access_website(website_id));

revoke all on public.website_traffic_daily from anon, authenticated;
grant select on public.website_traffic_daily to authenticated;
grant all on public.website_traffic_daily to service_role;
