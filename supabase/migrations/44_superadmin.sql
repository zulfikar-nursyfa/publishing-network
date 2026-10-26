-- Super administrators have every admin right and alone may change roles or remove users.
-- role::text comparisons: a new enum value cannot be used in the transaction that adds it.

alter type public.app_role add value if not exists 'superadmin';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role::text in ('admin', 'superadmin')
  );
$$;

create function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role::text = 'superadmin'
  );
$$;

revoke all on function public.is_superadmin() from public, anon;
grant execute on function public.is_superadmin() to authenticated, service_role;

drop policy "profiles: read self and admins" on public.profiles;
create policy "profiles: read self and admins" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or role::text in ('admin', 'superadmin') or (select public.is_admin()));

drop policy "profiles: admin updates" on public.profiles;
create policy "profiles: superadmin updates" on public.profiles
  for update to authenticated
  using ((select public.is_superadmin())) with check ((select public.is_superadmin()));
