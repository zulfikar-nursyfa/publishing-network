-- Publishing attempts: one row per article, reused across retries. Written only by the
-- publishing service; dashboard users can read it.

create type public.publication_status as enum ('pending', 'in_progress', 'succeeded', 'failed');

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null unique references public.articles (id) on delete cascade,
  website_id uuid not null references public.websites (id) on delete cascade,
  status public.publication_status not null default 'pending',
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  locked_until timestamptz,
  last_error text,
  wp_post_id bigint,
  wp_post_url text,
  requested_by uuid references public.profiles (id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index publications_website_status_idx on public.publications (website_id, status);

create trigger publications_updated_at before update on public.publications
  for each row execute function public.set_updated_at();

-- Atomically takes the publication lock for an article. Returns the claimed row, or nothing if
-- another worker holds an unexpired lock, the article already succeeded, or retries ran out.
create or replace function public.claim_publication(
  target_article uuid,
  requester uuid,
  lock_seconds integer default 120
)
returns setof public.publications
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_website uuid;
begin
  if not public.is_system_request() then
    raise exception 'claim_publication is reserved for the publishing service';
  end if;

  select website_id into target_website from public.articles where id = target_article;
  if target_website is null then
    return;
  end if;

  insert into public.publications (article_id, website_id, requested_by)
  values (target_article, target_website, requester)
  on conflict (article_id) do nothing;

  return query
  update public.publications
     set status = 'in_progress',
         attempt_count = attempt_count + 1,
         locked_until = now() + make_interval(secs => lock_seconds),
         started_at = now(),
         requested_by = coalesce(requester, requested_by),
         last_error = null
   where article_id = target_article
     and status <> 'succeeded'
     and attempt_count < max_attempts
     and (status <> 'in_progress' or locked_until is null or locked_until < now())
  returning *;
end;
$$;

revoke execute on function public.claim_publication(uuid, uuid, integer) from public, anon, authenticated;

alter table public.publications enable row level security;

create policy "publications: members read" on public.publications
  for select to authenticated using (public.can_access_website(website_id));

revoke all on public.publications from anon;
grant select on public.publications to authenticated;
grant all on public.publications to service_role;
