-- Publishing Network: shared building blocks.
--
-- Every business table carries website_id so that adding a website is a data change, never a
-- schema change. Row level security is the second line of defence behind the server's own
-- permission checks: administrators see everything, editors see only their assigned websites.
--
-- Each table file enables RLS and sets explicit grants, so the schema does not depend on the
-- project's "expose new tables" setting. Anonymous visitors get nothing.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- True when the current request comes from the server's secret key or a direct database
-- connection (migrations, SQL editor) rather than a signed-in dashboard user.
create or replace function public.is_system_request()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'role', 'service_role') = 'service_role';
$$;
