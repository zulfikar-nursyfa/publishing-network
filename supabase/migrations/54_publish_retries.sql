-- Automatic publishing makes one attempt plus three retries (max_attempts = 4). A person pressing
-- Retry publishing (requester is set) is not limited by the counter, so no admin reset is needed.

alter table public.publications alter column max_attempts set default 4;
update public.publications set max_attempts = 4 where status <> 'succeeded';

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
     and (requester is not null or attempt_count < max_attempts)
     and (status <> 'in_progress' or locked_until is null or locked_until < now())
  returning *;
end;
$$;

revoke execute on function public.claim_publication(uuid, uuid, integer) from public, anon, authenticated;
