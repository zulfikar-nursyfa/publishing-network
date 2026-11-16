-- Copies a published article to another website of the same niche and language (dashboard action
-- moveArticles). The original and its WordPress post stay on the old site; the copy is approved and
-- scheduled on the new one, and publishing gives its post the original's date (original_published_at).
-- copied_from stops the same article being copied to a website twice.

alter table public.articles
  add column copied_from uuid references public.articles (id) on delete set null,
  add column original_published_at timestamptz;

create unique index articles_copied_from_idx on public.articles (website_id, copied_from)
  where copied_from is not null;

create or replace function public.copy_article(source_article uuid, target_website uuid, new_article uuid,
  fallback_category uuid, publish_at timestamptz, actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.articles; w public.websites; old_site public.websites; new_category uuid;
  img public.article_images; new_image uuid; new_body text;
begin
  if not public.is_system_request() then raise exception 'Service only'; end if;
  select * into a from public.articles where id = source_article for share;
  if a.id is null then raise exception 'Article not found'; end if;
  if a.status <> 'published' or a.wp_post_id is null then raise exception 'Only published articles are copied.'; end if;
  if a.website_id = target_website then raise exception 'The article is already on that website.'; end if;
  select * into w from public.websites where id = target_website;
  if w.id is null or w.archived_at is not null then raise exception 'That website is archived or does not exist.'; end if;
  select * into old_site from public.websites where id = a.website_id;
  if w.language <> old_site.language then raise exception 'That website is in another language.'; end if;
  if w.niche_id is distinct from old_site.niche_id then raise exception 'That website is in another niche.'; end if;
  if exists (select 1 from public.articles where website_id = w.id and copied_from = a.id) then
    raise exception 'Already copied to that website.';
  end if;
  if a.story_fingerprint is not null and exists (select 1 from public.articles
      where website_id = w.id and story_fingerprint = a.story_fingerprint) then
    raise exception 'That website already has an article for this story.';
  end if;
  -- The category with the same slug on the new website, else the one the editor chose for the batch.
  select c.id into new_category from public.categories c join public.categories old on old.slug = c.slug
    where old.id = a.category_id and c.website_id = w.id and c.archived_at is null;
  if new_category is null then
    select id into new_category from public.categories
      where id = fallback_category and website_id = w.id and archived_at is null;
  end if;
  if new_category is null then raise exception 'Choose a category on that website.'; end if;

  insert into public.articles (id, website_id, origin, status, title, slug, excerpt, body, story_fingerprint,
      human_edited_at, created_by, updated_by, submitted_at, approved_by, approved_at, category_id, scheduled_for,
      sensitive, seo_title, meta_description, focus_keyword, tags, copied_from, original_published_at)
    values (new_article, w.id, a.origin, 'approved', a.title, a.slug, a.excerpt, a.body, a.story_fingerprint,
      a.human_edited_at, actor, actor, now(), actor, now(), new_category, publish_at,
      a.sensitive, a.seo_title, a.meta_description, a.focus_keyword, a.tags, a.id,
      coalesce(a.original_published_at, a.published_at));
  insert into public.article_sources (article_id, website_id, url, title, publisher, accessed_at)
    select new_article, w.id, url, title, publisher, accessed_at from public.article_sources where article_id = a.id;

  -- Files were copied to <website>/<new article>/<same name> first (see moveArticles). Media ids
  -- belong to the old site, and the body's [image:<id>] lines follow the new image ids.
  new_body := a.body;
  for img in select * from public.article_images where article_id = a.id and role in ('featured', 'inline') loop
    new_image := gen_random_uuid();
    insert into public.article_images (id, article_id, website_id, role, storage_path, url, alt_text, caption, credit,
        source_kind, source_url, license, license_url, ai_model, ai_prompt, created_by)
      values (new_image, new_article, w.id, img.role,
        case when img.storage_path is null then null
          else w.id::text || '/' || new_article::text || '/' || regexp_replace(img.storage_path, '^.*/', '') end,
        img.url, img.alt_text, img.caption, img.credit, img.source_kind, img.source_url, img.license, img.license_url,
        img.ai_model, img.ai_prompt, actor);
    new_body := replace(new_body, '[image:' || img.id::text || ']', '[image:' || new_image::text || ']');
  end loop;
  if new_body is distinct from a.body then
    update public.articles set body = new_body where id = new_article;
  end if;
end;
$$;
revoke all on function public.copy_article(uuid, uuid, uuid, uuid, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.copy_article(uuid, uuid, uuid, uuid, timestamptz, uuid) to service_role;
