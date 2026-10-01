-- Source types and feeds for discovery, and the stories found in them.
-- Newsroom and government sources count as primary sources. Sources are for discovery only:
-- automation never copies their text. images_reusable marks sources whose images may be reused.

alter table public.content_sources drop constraint content_sources_kind_check;
update public.content_sources set kind = 'news' where kind in ('rss', 'website');
alter table public.content_sources
  alter column kind set default 'news',
  add constraint content_sources_kind_check check (kind in ('news', 'newsroom', 'government', 'api')),
  add column feed_url text check (feed_url is null or feed_url ~ '^https?://'),
  add column images_reusable boolean not null default false,
  add column last_checked_at timestamptz,
  add column last_error text;

-- Existing sources were added as RSS feeds.
update public.content_sources set feed_url = url where feed_url is null;

create table public.story_candidates (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  source_id uuid references public.content_sources (id) on delete set null,
  url text not null,
  title text not null,
  summary text,
  image_url text,
  source_published_at timestamptz,
  -- Hash of the normalised URL; matches articles.story_fingerprint once a story is used.
  fingerprint text not null,
  status text not null default 'new' check (status in ('new', 'selected', 'skipped', 'used')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, fingerprint)
);

create index story_candidates_website_status_idx
  on public.story_candidates (website_id, status, created_at desc);

create trigger story_candidates_updated_at before update on public.story_candidates
  for each row execute function public.set_updated_at();

alter table public.story_candidates enable row level security;

-- Discovery inserts with the secret key; members may only change the status.
create policy "stories: members read" on public.story_candidates
  for select to authenticated using (public.can_access_website(website_id));
create policy "stories: members update" on public.story_candidates
  for update to authenticated
  using (public.can_access_website(website_id))
  with check (public.can_access_website(website_id));

revoke all on public.story_candidates from anon;
grant select on public.story_candidates to authenticated;
grant update (status) on public.story_candidates to authenticated;
grant all on public.story_candidates to service_role;
