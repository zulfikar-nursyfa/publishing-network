-- A manual article starts as its author's private draft: nobody else sees it, its sources, images
-- or files until the author submits it for review or approves it. Once shared it stays shared.
alter table public.articles add column private boolean not null default false;

create function public.share_article_on_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status <> 'draft' then
    new.private := false;
  elsif tg_op = 'UPDATE' and new.private and not old.private then
    raise exception 'A shared article cannot be made private again';
  end if;
  return new;
end;
$$;

create trigger articles_share_on_status before insert or update on public.articles
  for each row execute function public.share_article_on_status();

drop policy "articles: members read" on public.articles;
drop policy "articles: members create" on public.articles;
drop policy "articles: members update" on public.articles;
create policy "articles: members read" on public.articles
  for select to authenticated
  using (public.can_access_website(website_id) and (not private or created_by = (select auth.uid())));
create policy "articles: members create" on public.articles
  for insert to authenticated
  with check (public.can_access_website(website_id) and (not private or created_by = (select auth.uid())));
create policy "articles: members update" on public.articles
  for update to authenticated
  using (public.can_access_website(website_id) and (not private or created_by = (select auth.uid())))
  with check (public.can_access_website(website_id) and (not private or created_by = (select auth.uid())));

-- Sources and images follow their article: the subquery runs under the articles policies above.
-- The storage.objects policies already check the article that way.
drop policy "article sources: members read" on public.article_sources;
drop policy "article sources: members write" on public.article_sources;
create policy "article sources: members read" on public.article_sources
  for select to authenticated using (exists (
    select 1 from public.articles a where a.id = article_id and a.website_id = article_sources.website_id));
create policy "article sources: members write" on public.article_sources
  for all to authenticated
  using (exists (
    select 1 from public.articles a where a.id = article_id and a.website_id = article_sources.website_id))
  with check (exists (
    select 1 from public.articles a where a.id = article_id and a.website_id = article_sources.website_id));

drop policy "article images: members read" on public.article_images;
drop policy "article images: members write" on public.article_images;
create policy "article images: members read" on public.article_images
  for select to authenticated using (exists (
    select 1 from public.articles a where a.id = article_id and a.website_id = article_images.website_id));
create policy "article images: members write" on public.article_images
  for all to authenticated
  using (exists (
    select 1 from public.articles a where a.id = article_id and a.website_id = article_images.website_id))
  with check (exists (
    select 1 from public.articles a where a.id = article_id and a.website_id = article_images.website_id));
