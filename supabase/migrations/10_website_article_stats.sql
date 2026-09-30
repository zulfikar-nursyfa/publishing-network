-- Per-website article counts for the overview. security_invoker makes the view respect the
-- caller's row level security, so editors only get rows for their own websites.

create view public.website_article_stats with (security_invoker = true) as
select
  w.id as website_id,
  count(a.id) filter (where a.status = 'draft') as drafts,
  count(a.id) filter (where a.status = 'in_review') as in_review,
  count(a.id) filter (where a.status = 'approved') as approved,
  count(a.id) filter (where a.status = 'rejected') as rejected,
  count(a.id) filter (where a.status = 'published') as published_total,
  count(a.id) filter (
    where a.published_at >= (date_trunc('day', now() at time zone w.timezone) at time zone w.timezone)
  ) as published_today,
  count(a.id) filter (where a.published_at >= now() - interval '7 days') as published_7d,
  (select count(*) from public.publications p where p.website_id = w.id and p.status = 'failed') as failed_publications
from public.websites w
left join public.articles a on a.website_id = w.id
group by w.id;

revoke all on public.website_article_stats from anon;
grant select on public.website_article_stats to authenticated;
grant all on public.website_article_stats to service_role;
