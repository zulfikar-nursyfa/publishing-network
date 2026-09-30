-- Which editors may work on which websites. Administrators need no rows: they see everything.

create table public.website_members (
  website_id uuid not null references public.websites (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (website_id, user_id)
);

create index website_members_user_idx on public.website_members (user_id);

-- The central permission check used by every website-scoped policy.
create or replace function public.can_access_website(target_website uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.website_members
    where website_id = target_website and user_id = (select auth.uid())
  );
$$;

-- True when the current user and another user are assigned to at least one common website.
create or replace function public.shares_website_with(other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.website_members mine
    join public.website_members theirs on theirs.website_id = mine.website_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other_user
  );
$$;

alter table public.website_members enable row level security;

create policy "members: read own or admin" on public.website_members
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "members: admin manages" on public.website_members
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Policies on earlier tables that depend on memberships.
create policy "websites: members read" on public.websites
  for select to authenticated using (public.can_access_website(id));

-- Colleagues' names appear in article history.
create policy "profiles: read colleagues" on public.profiles
  for select to authenticated using (public.shares_website_with(id));

revoke all on public.website_members from anon;
grant select, insert, update, delete on public.website_members to authenticated;
grant all on public.website_members to service_role;
