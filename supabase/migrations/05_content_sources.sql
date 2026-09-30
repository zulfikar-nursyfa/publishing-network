-- Approved sources automation may draw stories from, per website.

create table public.content_sources (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  name text not null,
  url text not null check (url ~ '^https?://'),
  kind text not null default 'rss' check (kind in ('rss', 'website', 'api')),
  attribution_note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, url)
);

create trigger content_sources_updated_at before update on public.content_sources
  for each row execute function public.set_updated_at();

alter table public.content_sources enable row level security;

create policy "sources: members read" on public.content_sources
  for select to authenticated using (public.can_access_website(website_id));
create policy "sources: admin manages" on public.content_sources
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.content_sources from anon;
grant select, insert, update, delete on public.content_sources to authenticated;
grant all on public.content_sources to service_role;
