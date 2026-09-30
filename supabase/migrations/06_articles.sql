-- Articles, manual and automated, for every website.

create type public.article_origin as enum ('manual', 'automated');
create type public.article_status as enum ('draft', 'in_review', 'approved', 'published', 'rejected');

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  origin public.article_origin not null default 'manual',
  status public.article_status not null default 'draft',
  title text not null,
  slug text,
  excerpt text,
  body text not null default '',
  -- Used by automation to recognise stories it has already processed.
  story_fingerprint text,
  -- Set whenever a person edits the article; automation must never overwrite it afterwards.
  human_edited_at timestamptz,
  review_note text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  wp_post_id bigint,
  wp_post_url text,
  published_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, wp_post_id)
);

create unique index articles_story_fingerprint_idx
  on public.articles (website_id, story_fingerprint) where story_fingerprint is not null;
create index articles_website_status_idx on public.articles (website_id, status, updated_at desc);

create trigger articles_updated_at before update on public.articles
  for each row execute function public.set_updated_at();

-- Dashboard users may edit and review articles on their websites, but only the server's
-- publishing code may mark an article as published or record WordPress identifiers.
create or replace function public.guard_article_system_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
  end if;

  if public.is_system_request() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'published' or new.wp_post_id is not null or new.wp_post_url is not null
       or new.published_at is not null then
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
     or (new.status = 'published' and old.status <> 'published') then
    raise exception 'Only the publishing service can change publication fields';
  end if;
  return new;
end;
$$;

create trigger articles_guard before insert or update on public.articles
  for each row execute function public.guard_article_system_fields();

alter table public.articles enable row level security;

create policy "articles: members read" on public.articles
  for select to authenticated using (public.can_access_website(website_id));
create policy "articles: members create" on public.articles
  for insert to authenticated with check (public.can_access_website(website_id));
create policy "articles: members update" on public.articles
  for update to authenticated
  using (public.can_access_website(website_id))
  with check (public.can_access_website(website_id));
create policy "articles: admin deletes" on public.articles
  for delete to authenticated using ((select public.is_admin()));

revoke all on public.articles from anon;
grant select, insert, update, delete on public.articles to authenticated;
grant all on public.articles to service_role;
