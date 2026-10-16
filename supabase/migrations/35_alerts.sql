-- Email alerts. Recipients live on network_settings; each problem gets one row keyed by what it
-- is about, so a problem is emailed once instead of on every cron run. website_id is null for
-- network-wide alerts. Written only by the alerts cron; administrators can read the history.

alter table public.network_settings
  add column alert_emails text[] not null default '{}' check (cardinality(alert_emails) <= 10);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  website_id uuid references public.websites (id) on delete cascade,
  kind text not null check (kind in ('budget', 'slot', 'publication', 'job')),
  key text not null unique,
  message text not null,
  created_at timestamptz not null default now()
);

create index alerts_created_idx on public.alerts (created_at desc);

alter table public.alerts enable row level security;

create policy "alerts: admin reads" on public.alerts
  for select to authenticated using ((select public.is_admin()));

revoke all on public.alerts from anon, authenticated;
grant select on public.alerts to authenticated;
grant all on public.alerts to service_role;
