-- Status report: current counts per website. Articles by origin and status, draft jobs that are
-- active, waiting (queued with a waiting reason) or failed, and failed publications. Long format,
-- so a new article status shows up without changing this function. Runs as the caller (RLS applies).
create function public.website_status_counts()
returns table (website_id uuid, kind text, origin text, status text, total bigint)
language sql stable security invoker set search_path = '' as $$
  select a.website_id, 'article'::text, a.origin::text, a.status::text, count(*)
  from public.articles a
  group by a.website_id, a.origin, a.status
  union all
  select j.website_id, 'job'::text, null::text,
    case when j.status = 'queued' and j.waiting_kind is not null then 'waiting' else j.status end, count(*)
  from public.jobs j
  where j.status in ('queued', 'running', 'failed')
  group by 1, 4
  union all
  select p.website_id, 'publication'::text, null::text, p.status::text, count(*)
  from public.publications p
  where p.status = 'failed'
  group by p.website_id, p.status;
$$;

revoke all on function public.website_status_counts() from public, anon;
grant execute on function public.website_status_counts() to authenticated, service_role;
