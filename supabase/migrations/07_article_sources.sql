-- Source URLs and attribution for each article; published under the article in WordPress.

create table public.article_sources (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  website_id uuid not null references public.websites (id) on delete cascade,
  url text not null check (url ~ '^https?://'),
  title text,
  publisher text,
  accessed_at timestamptz not null default now(),
  unique (article_id, url)
);

create index article_sources_website_url_idx on public.article_sources (website_id, url);

alter table public.article_sources enable row level security;

create policy "article sources: members read" on public.article_sources
  for select to authenticated using (public.can_access_website(website_id));
create policy "article sources: members write" on public.article_sources
  for all to authenticated
  using (public.can_access_website(website_id))
  with check (
    public.can_access_website(website_id)
    and exists (select 1 from public.articles a where a.id = article_id and a.website_id = article_sources.website_id)
  );

revoke all on public.article_sources from anon;
grant select, insert, update, delete on public.article_sources to authenticated;
grant all on public.article_sources to service_role;
