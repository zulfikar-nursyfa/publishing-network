-- Niches (topics shared by a network's English and Arabic sites) and their source groups.
-- A website in a niche gets a copy of each niche source in content_sources (niche_source_id set),
-- so discovery and research keep reading one per-website list. sync_niche_sources() keeps the
-- copies in step; a site may disable a niche source and may add sources of its own.

create table public.niches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger niches_updated_at before update on public.niches
  for each row execute function public.set_updated_at();

create table public.niche_sources (
  id uuid primary key default gen_random_uuid(),
  niche_id uuid not null references public.niches (id) on delete cascade,
  name text not null,
  url text not null check (url ~ '^https?://'),
  kind text not null default 'news' check (kind in ('news', 'newsroom', 'government', 'api')),
  feed_url text check (feed_url is null or feed_url ~ '^https?://'),
  images_reusable boolean not null default false,
  attribution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (niche_id, url)
);

create trigger niche_sources_updated_at before update on public.niche_sources
  for each row execute function public.set_updated_at();

alter table public.niches enable row level security;
alter table public.niche_sources enable row level security;

create policy "niches: signed-in read" on public.niches for select to authenticated using (true);
create policy "niches: admin manages" on public.niches for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "niche sources: signed-in read" on public.niche_sources for select to authenticated using (true);
create policy "niche sources: admin manages" on public.niche_sources for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.niches, public.niche_sources from anon;
grant select, insert, update, delete on public.niches, public.niche_sources to authenticated;
grant all on public.niches, public.niche_sources to service_role;

alter table public.websites add column niche_id uuid references public.niches (id) on delete set null;

alter table public.content_sources
  add column niche_source_id uuid references public.niche_sources (id) on delete cascade,
  add constraint content_sources_niche_source_key unique (website_id, niche_source_id);

-- Runs with the caller's rights: only administrators can change content_sources.
create function public.sync_niche_sources(target_website uuid)
returns void language plpgsql set search_path = '' as $$
declare target_niche uuid;
begin
  select niche_id into target_niche from public.websites where id = target_website;
  -- A source the site already had with the same URL becomes the niche copy (keeps its history).
  update public.content_sources c set niche_source_id = n.id
    from public.niche_sources n
    where c.website_id = target_website and c.niche_source_id is null and n.niche_id = target_niche and c.url = n.url
      and not exists (select 1 from public.content_sources x where x.website_id = target_website and x.niche_source_id = n.id);
  -- Copies from a niche the site no longer belongs to.
  delete from public.content_sources
    where website_id = target_website and niche_source_id is not null
      and niche_source_id not in (select id from public.niche_sources where niche_id = target_niche);
  -- New copies, and updated details for existing ones. "active" stays the site's own choice.
  insert into public.content_sources (website_id, niche_source_id, name, url, kind, feed_url, images_reusable, attribution_note)
    select target_website, n.id, n.name, n.url, n.kind, n.feed_url, n.images_reusable, n.attribution_note
    from public.niche_sources n where n.niche_id = target_niche
  on conflict (website_id, niche_source_id) do update set name = excluded.name, url = excluded.url, kind = excluded.kind,
    feed_url = excluded.feed_url, images_reusable = excluded.images_reusable, attribution_note = excluded.attribution_note;
end;
$$;
revoke all on function public.sync_niche_sources(uuid) from public, anon;
grant execute on function public.sync_niche_sources(uuid) to authenticated, service_role;

-- The 15 niches from Ali's plan of 6 October 2026, section 7.
insert into public.niches (sort_order, name, slug) values
  (1, 'Marketing & Content Creation', 'marketing-content-creation'),
  (2, 'Football News & Analysis', 'football-news-analysis'),
  (3, 'Business & Investment', 'business-investment'),
  (4, 'Artificial Intelligence', 'artificial-intelligence'),
  (5, 'Travel & Tourism', 'travel-tourism'),
  (6, 'Culture & Arts', 'culture-arts'),
  (7, 'Women & Modern Life', 'women-modern-life'),
  (8, 'Technology & Gadgets', 'technology-gadgets'),
  (9, 'Automotive & Mobility', 'automotive-mobility'),
  (10, 'Property & Housing', 'property-housing'),
  (11, 'Education & Careers', 'education-careers'),
  (12, 'Food & Cooking', 'food-cooking'),
  (13, 'Family & Parenting', 'family-parenting'),
  (14, 'Fitness & Wellbeing', 'fitness-wellbeing'),
  (15, 'Gaming & Esports', 'gaming-esports')
on conflict (slug) do nothing;

-- Business & Investment sources; feeds checked on 8 October 2026. Google News searches stand in
-- for sites without a readable feed; official sites without one are kept so research marks them primary.
insert into public.niche_sources (niche_id, name, kind, url, feed_url)
select n.id, s.name, s.kind, s.url, s.feed_url
from public.niches n, (values
  ('Reuters', 'news', 'https://www.reuters.com', 'https://news.google.com/rss/search?q=site:reuters.com+%28UAE+OR+Gulf+OR+Saudi+OR+Dubai%29+business+when:2d&hl=en-US&gl=US&ceid=US:en'),
  ('Bloomberg', 'news', 'https://www.bloomberg.com', 'https://feeds.bloomberg.com/business/news.rss'),
  ('Financial Times', 'news', 'https://www.ft.com', 'https://www.ft.com/middle-east-north-africa?format=rss'),
  ('CNBC', 'news', 'https://www.cnbc.com', 'https://www.cnbc.com/id/10001147/device/rss/rss.html'),
  ('Forbes Middle East', 'news', 'https://www.forbesmiddleeast.com', 'https://www.forbesmiddleeast.com/feed'),
  ('Arabian Business', 'news', 'https://www.arabianbusiness.com', 'https://www.arabianbusiness.com/feed'),
  ('Gulf Business', 'news', 'https://gulfbusiness.com', 'https://news.google.com/rss/search?q=site:gulfbusiness.com+when:2d&hl=en-US&gl=US&ceid=US:en'),
  ('WAM', 'government', 'https://www.wam.ae', 'https://news.google.com/rss/search?q=site:wam.ae+%28economy+OR+investment+OR+business+OR+trade%29+when:2d&hl=en-US&gl=US&ceid=US:en'),
  ('Dubai Media Office', 'government', 'https://www.mediaoffice.ae', 'https://news.google.com/rss/search?q=site:mediaoffice.ae+%28economy+OR+investment+OR+business+OR+trade%29+when:2d&hl=en-US&gl=US&ceid=US:en'),
  ('UAE Ministry of Economy and Tourism', 'government', 'https://www.moet.gov.ae', null),
  ('Dubai Chambers', 'government', 'https://www.dubaichambers.com', null),
  ('TechCrunch', 'news', 'https://techcrunch.com', 'https://techcrunch.com/feed/')
) as s (name, kind, url, feed_url)
where n.slug = 'business-investment'
on conflict (niche_id, url) do nothing;
