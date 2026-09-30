-- Websites in the network. Adding a website is a row here, never a schema change.

create type public.site_language as enum ('en', 'ar');
create type public.connection_status as enum ('untested', 'ok', 'failed');

create table public.websites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  domain text not null,
  language public.site_language not null default 'en',
  text_direction text generated always as (case when language = 'ar' then 'rtl' else 'ltr' end) stored,
  topic text,
  audience text,
  branding jsonb not null default '{}'::jsonb,
  timezone text not null default 'UTC',
  -- Automated articles per day. Manual articles are additional and never count against this.
  daily_quota smallint not null default 0 check (daily_quota between 0 and 2),
  -- At launch every automated article needs editorial approval; the column exists so the
  -- policy can be relaxed per website later without a schema change.
  require_review boolean not null default true,
  -- Automation starts paused. Manual publishing is never affected by this flag.
  automation_paused boolean not null default true,
  monthly_ai_budget_usd numeric(10, 2) not null default 0 check (monthly_ai_budget_usd >= 0),
  generate_illustrations boolean not null default false,
  wp_base_url text not null check (wp_base_url ~ '^https?://'),
  wp_username text not null,
  wp_connection_status public.connection_status not null default 'untested',
  wp_connection_checked_at timestamptz,
  wp_connection_error text,
  wp_plugin_version text,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger websites_updated_at before update on public.websites
  for each row execute function public.set_updated_at();

alter table public.websites enable row level security;

-- Administrators manage websites. Assigned editors get read access in 04_website_members.sql.
create policy "websites: admin reads" on public.websites
  for select to authenticated using ((select public.is_admin()));
create policy "websites: admin inserts" on public.websites
  for insert to authenticated with check ((select public.is_admin()));
create policy "websites: admin updates" on public.websites
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "websites: admin deletes" on public.websites
  for delete to authenticated using ((select public.is_admin()));

revoke all on public.websites from anon;
grant select, insert, update, delete on public.websites to authenticated;
grant all on public.websites to service_role;
