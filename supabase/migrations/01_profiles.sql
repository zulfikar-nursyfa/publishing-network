-- Dashboard users. One row per Supabase Auth user, created automatically on invitation.

create type public.app_role as enum ('admin', 'editor');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.app_role not null default 'editor',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- New auth users (created by invitation) start as editors with no websites.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;

-- Everyone can see themselves and the administrators; administrators see every user.
-- Colleagues on shared websites become visible in 04_website_members.sql.
create policy "profiles: read self and admins" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or role = 'admin' or (select public.is_admin()));
create policy "profiles: admin updates" on public.profiles
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.profiles from anon;
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
