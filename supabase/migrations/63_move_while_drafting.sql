-- An article moved or copied to a website that is drafting the same story (moveArticles).
-- move_article only noticed this when the moved article had a draft job, and copy_article never did; the
-- target's draft then reached complete_draft_job, which took the arrived article as its own: the job was
-- marked done on it and could auto-approve an article nobody reviewed there. Now a move or copy waits until
-- the target's draft finishes (after which the target has its own article for the story), and a draft
-- whose story already has an article on its website fails instead of claiming that article.

create or replace function public.move_article(target_article uuid, target_website uuid,
  expected_version integer, actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.articles; w public.websites; new_category uuid; j public.jobs; new_story uuid;
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
  if a.story_fingerprint is not null and exists (select 1 from public.jobs j2
      join public.story_candidates s on s.id = j2.story_id
      where j2.website_id = w.id and j2.status in ('queued', 'running') and s.fingerprint = a.story_fingerprint) then
    raise exception 'That website is drafting this story right now.';
  end if;
  if a.origin = 'automated' and exists (select 1 from public.articles where website_id = w.id and origin = 'automated'
      and lower(regexp_replace(trim(title), '[[:space:]]+', ' ', 'g'))
        = lower(regexp_replace(trim(a.title), '[[:space:]]+', ' ', 'g'))) then
    raise exception 'That website already has an automated article with this headline.';
  end if;
  -- The category with the same slug on the new website, if it has one; otherwise the editor picks one.
  select c.id into new_category from public.categories c join public.categories old on old.slug = c.slug
    where old.id = a.category_id and c.website_id = w.id and c.archived_at is null;
  select * into j from public.jobs where article_id = a.id;
  update public.jobs set article_id = null where article_id = a.id;
  update public.articles set website_id = w.id, category_id = new_category, updated_by = actor where id = a.id;
  update public.article_sources set website_id = w.id where article_id = a.id;
  -- Files were copied to the new website's folder first (see moveArticle); media ids were the old site's.
  update public.article_images set wp_media_id = null,
    storage_path = regexp_replace(storage_path, '^[^/]+/', w.id::text || '/')
    where article_id = a.id;
  if j.id is null then return; end if;
  -- The story on the new website: one discovery already found there, else a copy. Used, so it is not drafted again.
  insert into public.story_candidates (website_id, url, title, summary, image_url, source_published_at,
      fingerprint, title_fingerprint, status, topic_checked_at)
    select w.id, s.url, s.title, s.summary, s.image_url, s.source_published_at, s.fingerprint,
      s.title_fingerprint, 'used', s.topic_checked_at
    from public.story_candidates s where s.id = j.story_id
  on conflict (website_id, fingerprint) do update set status = 'used'
  returning id into new_story;
  if exists (select 1 from public.jobs where website_id = w.id and story_id = new_story
      and status in ('queued', 'running')) then
    raise exception 'That website is drafting this story right now.';
  end if;
  -- A failed draft of the same story on the new website is replaced by this article's job.
  insert into public.jobs (website_id, story_id, status, step, state, article_id, requested_by, run_after)
    values (w.id, new_story, case when a.status = 'approved' then 'succeeded' else 'queued' end,
      case when a.status = 'approved' then 'create_article' else 'recollect' end,
      j.state, a.id, actor, now())
  on conflict (website_id, story_id) do update set status = excluded.status, step = excluded.step,
    state = excluded.state, article_id = excluded.article_id, requested_by = excluded.requested_by,
    run_after = excluded.run_after, attempt_count = 0, last_error = null, locked_by = null,
    locked_until = null, waiting_kind = null, waiting_reason = null, waiting_since = null;
end;
$$;
revoke all on function public.move_article(uuid, uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.move_article(uuid, uuid, integer, uuid) to service_role;

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
  if a.story_fingerprint is not null and exists (select 1 from public.jobs j
      join public.story_candidates s on s.id = j.story_id
      where j.website_id = w.id and j.status in ('queued', 'running') and s.fingerprint = a.story_fingerprint) then
    raise exception 'That website is drafting this story right now.';
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

create or replace function public.complete_draft_job(target_job uuid, worker uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare j public.jobs; s public.story_candidates; draft jsonb; result uuid; ref jsonb; note text;
begin
  if not public.is_system_request() then raise exception 'Service only'; end if;
  select * into j from public.jobs where id = target_job for update;
  if j.status <> 'running' or j.locked_by is distinct from worker or j.locked_until <= now() or j.step <> 'create_article' then
    raise exception 'Draft lease lost';
  end if;
  if not exists (select 1 from public.websites w, public.network_settings n
    where w.id = j.website_id and w.archived_at is null and not w.automation_paused and w.automation_mode <> 'off' and not n.automation_paused) then
    raise exception 'Automation is paused or off';
  end if;
  select * into s from public.story_candidates where id = j.story_id for update;
  if s.status <> 'selected' then raise exception 'Story is no longer selected'; end if;
  draft = j.state->'draft';
  if draft is null or j.state->'verification' is null then raise exception 'Draft has not been verified'; end if;
  if exists (select 1 from public.articles where website_id = j.website_id and origin = 'automated'
    and story_fingerprint is distinct from s.fingerprint
    and lower(regexp_replace(trim(title), '[[:space:]]+', ' ', 'g')) = lower(regexp_replace(trim(draft->>'title'), '[[:space:]]+', ' ', 'g'))) then
    raise exception 'Another automated article already has this headline';
  end if;
  select 'AI draft. Human review is required; verify facts, dates, names and sources before approval.'
    || coalesce(E'\n\nCheck these warnings:\n- ' || string_agg(w, E'\n- '), '')
    into note from jsonb_array_elements_text(coalesce(j.state->'warnings', '[]'::jsonb)) w;
  insert into public.articles (id, website_id, origin, status, title, slug, excerpt, body, story_fingerprint,
    category_id, sensitive, submitted_at, review_note)
  values (coalesce((j.state->>'article_id')::uuid, gen_random_uuid()), j.website_id, 'automated', 'in_review',
    draft->>'title', draft->>'slug', draft->>'excerpt', draft->>'body', s.fingerprint,
    (select c.id from public.categories c
      where c.id = nullif(draft->>'category_id','')::uuid and c.website_id = j.website_id), coalesce((draft->>'sensitive')::boolean, true), now(), left(note, 4000))
  on conflict (website_id, story_fingerprint) where story_fingerprint is not null do nothing returning id into result;
  -- A finished job never gets here again (the lease check above), so a conflict is another article.
  if result is null then
    raise exception 'This story already has an article on this website';
  end if;
  for ref in select value from jsonb_array_elements(coalesce(j.state->'sources','[]'::jsonb)) loop
    insert into public.article_sources (website_id, article_id, url, title, publisher)
      values (j.website_id, result, ref->>'url', ref->>'title', ref->>'publisher') on conflict (article_id,url) do nothing;
  end loop;
  for ref in select value from jsonb_array_elements(coalesce(j.state->'images','[]'::jsonb)) loop
    insert into public.article_images (article_id, website_id, role, storage_path, alt_text, credit, source_kind,
      source_url, license, ai_model, ai_prompt)
    values (result, j.website_id, ref->>'role', ref->>'storage_path', ref->>'alt_text', ref->>'credit',
      (ref->>'source_kind')::public.image_source_kind, ref->>'source_url', ref->>'license', ref->>'ai_model', ref->>'ai_prompt');
  end loop;
  update public.story_candidates set status = 'used' where id = s.id;
  update public.jobs set status = 'succeeded', article_id = result, locked_by = null, locked_until = null, last_error = null where id = j.id;
  return result;
end;
$$;
