-- Top pages and search queries for the last 28 days, replaced on every traffic sync.
-- path is the decoded URL path with a trailing slash, so GA4 rows, Search Console rows and an
-- article's WordPress URL match. article_id is set when the path is a published article.
-- Search queries with path '' are for the whole site; the others are per page.

create table public.website_traffic_pages (
  website_id uuid not null references public.websites (id) on delete cascade,
  path text not null,
  article_id uuid references public.articles (id) on delete set null,
  users integer,
  page_views integer,
  clicks integer,
  impressions integer,
  ctr numeric(7, 4),
  position numeric(7, 2),
  updated_at timestamptz not null default now(),
  primary key (website_id, path)
);

create index website_traffic_pages_article_idx on public.website_traffic_pages (article_id) where article_id is not null;

create table public.website_search_queries (
  website_id uuid not null references public.websites (id) on delete cascade,
  path text not null default '',
  query text not null,
  clicks integer not null,
  impressions integer not null,
  ctr numeric(7, 4),
  position numeric(7, 2),
  updated_at timestamptz not null default now(),
  primary key (website_id, path, query)
);

alter table public.website_traffic_pages enable row level security;
alter table public.website_search_queries enable row level security;

create policy "traffic pages: members read" on public.website_traffic_pages
  for select to authenticated using (public.can_access_website(website_id));
create policy "search queries: members read" on public.website_search_queries
  for select to authenticated using (public.can_access_website(website_id));

revoke all on public.website_traffic_pages, public.website_search_queries from anon, authenticated;
grant select on public.website_traffic_pages, public.website_search_queries to authenticated;
grant all on public.website_traffic_pages, public.website_search_queries to service_role;
