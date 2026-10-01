-- Scheduled publication, sensitivity flag and unpublishing.
--
-- Workflow: source → research → AI draft → verification → review → approval → scheduled
-- publication. An approved article with scheduled_for set is "scheduled"; the publishing job
-- publishes it at that time through the same idempotent publishArticle() path.

alter table public.articles
  add column scheduled_for timestamptz,
  -- Breaking, sensitive or consequential stories. Always reviewed, even in automatic mode.
  add column sensitive boolean not null default false,
  add column unpublished_at timestamptz;

create index articles_scheduled_idx
  on public.articles (scheduled_for)
  where status = 'approved' and scheduled_for is not null;

-- Same rules as 06_articles.sql, plus:
--   * only the server may unpublish, or move an article out of "published";
--   * an article that leaves the approved state loses its schedule.
create or replace function public.guard_article_system_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
  end if;

  if new.status in ('draft', 'in_review', 'rejected') then
    new.scheduled_for := null;
  end if;

  if public.is_system_request() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status in ('published', 'unpublished') or new.wp_post_id is not null
       or new.wp_post_url is not null or new.published_at is not null
       or new.unpublished_at is not null then
      raise exception 'Only the publishing service can create published articles';
    end if;
    return new;
  end if;

  if new.website_id is distinct from old.website_id then
    raise exception 'Articles cannot be moved between websites';
  end if;
  if new.wp_post_id is distinct from old.wp_post_id
     or new.wp_post_url is distinct from old.wp_post_url
     or new.published_at is distinct from old.published_at
     or new.unpublished_at is distinct from old.unpublished_at
     or (new.status in ('published', 'unpublished') and new.status is distinct from old.status)
     or (old.status = 'published' and new.status is distinct from old.status) then
    raise exception 'Only the publishing service can change publication fields';
  end if;
  return new;
end;
$$;

-- Overview counts gain "scheduled" and "unpublished". New columns go at the end so the view
-- can be replaced in place.
create or replace view public.website_article_stats with (security_invoker = true) as
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
  (select count(*) from public.publications p where p.website_id = w.id and p.status = 'failed') as failed_publications,
  count(a.id) filter (where a.status = 'approved' and a.scheduled_for is not null) as scheduled,
  -- Compared as text: if migrations run in one transaction, the enum value added in 14 cannot be
  -- used as an enum literal yet.
  count(a.id) filter (where a.status::text = 'unpublished') as unpublished
from public.websites w
left join public.articles a on a.website_id = w.id
group by w.id;
