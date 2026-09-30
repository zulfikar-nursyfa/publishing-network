-- Significant administrative and publishing actions. Written only by the server.

create table public.audit_log (
  id bigint generated always as identity primary key,
  website_id uuid references public.websites (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_website_idx on public.audit_log (website_id, created_at desc);

alter table public.audit_log enable row level security;

-- Administrators read everything, editors read entries for their websites.
create policy "audit: admin or website member reads" on public.audit_log
  for select to authenticated
  using ((select public.is_admin()) or (website_id is not null and public.can_access_website(website_id)));

revoke all on public.audit_log from anon;
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
