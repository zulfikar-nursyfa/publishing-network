-- Approved articles that never reached WordPress move too (bulk move, moveArticles). Same as 57
-- otherwise; moveArticles then sets their schedule on the new website.

create or replace function public.move_article(target_article uuid, target_website uuid,
  expected_version integer, actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.articles; w public.websites; new_category uuid;
begin
  if not public.is_system_request() then raise exception 'Service only'; end if;
  select * into a from public.articles where id = target_article for update;
  if a.id is null then raise exception 'Article not found'; end if;
  if a.version <> expected_version then
    raise exception 'The article changed since you opened it. Reload and try again.';
  end if;
  if a.website_id = target_website then raise exception 'The article is already on that website.'; end if;
  if a.status not in ('draft', 'in_review', 'rejected', 'approved') or a.wp_post_id is not null then
    raise exception 'Only articles that were never published can be moved.';
  end if;
  if exists (select 1 from public.publications where article_id = a.id)
     or exists (select 1 from public.publish_slots where article_id = a.id) then
    raise exception 'This article has publishing history on its website, so it cannot be moved.';
  end if;
  if exists (select 1 from public.jobs where article_id = a.id and status in ('queued', 'running')) then
    raise exception 'Wait for the article''s re-check to finish before moving it.';
  end if;
  select * into w from public.websites where id = target_website;
  if w.id is null or w.archived_at is not null then raise exception 'That website is archived or does not exist.'; end if;
  if w.language <> (select language from public.websites where id = a.website_id) then
    raise exception 'That website is in another language.';
  end if;
  if a.story_fingerprint is not null and exists (select 1 from public.articles
      where website_id = w.id and story_fingerprint = a.story_fingerprint) then
    raise exception 'That website already has an article for this story.';
  end if;
  if a.origin = 'automated' and exists (select 1 from public.articles where website_id = w.id and origin = 'automated'
      and lower(regexp_replace(trim(title), '[[:space:]]+', ' ', 'g'))
        = lower(regexp_replace(trim(a.title), '[[:space:]]+', ' ', 'g'))) then
    raise exception 'That website already has an automated article with this headline.';
  end if;
  -- The category with the same slug on the new website, if it has one; otherwise the editor picks one.
  select c.id into new_category from public.categories c join public.categories old on old.slug = c.slug
    where old.id = a.category_id and c.website_id = w.id and c.archived_at is null;
  update public.jobs set article_id = null where article_id = a.id;
  update public.articles set website_id = w.id, category_id = new_category, updated_by = actor where id = a.id;
  update public.article_sources set website_id = w.id where article_id = a.id;
  -- Files were copied to the new website's folder first (see moveArticle); media ids were the old site's.
  update public.article_images set wp_media_id = null,
    storage_path = regexp_replace(storage_path, '^[^/]+/', w.id::text || '/')
    where article_id = a.id;
end;
$$;
revoke all on function public.move_article(uuid, uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.move_article(uuid, uuid, integer, uuid) to service_role;
