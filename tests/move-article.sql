-- Disposable local database only, with migrations 00–62 applied. Fixtures roll back.
begin;
create function pg_temp.check_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %', message; end if; end;
$$;
create function pg_temp.check_fails(statement text, expected text) returns void language plpgsql as $$
begin
  execute statement;
  raise exception 'Assertion failed: expected "%"', expected;
exception when others then
  if sqlerrm not like '%' || expected || '%' then raise exception 'Assertion failed: got "%"', sqlerrm; end if;
end;
$$;

insert into public.websites (id, name, slug, domain, language) values
  ('10000000-0000-4000-8000-000000000571', 'Real Estate', 'move-from', 'from.test', 'en'),
  ('10000000-0000-4000-8000-000000000572', 'Business', 'move-to', 'to.test', 'en'),
  ('10000000-0000-4000-8000-000000000573', 'Arabic', 'move-ar', 'ar.test', 'ar');
insert into public.categories (id, website_id, name, slug) values
  ('30000000-0000-4000-8000-000000000571', '10000000-0000-4000-8000-000000000571', 'Markets', 'markets'),
  ('30000000-0000-4000-8000-000000000572', '10000000-0000-4000-8000-000000000572', 'Markets', 'markets');
insert into public.articles (id, website_id, title, status, category_id, seo_title, story_fingerprint) values
  ('20000000-0000-4000-8000-000000000571', '10000000-0000-4000-8000-000000000571', 'Orders rise', 'in_review',
   '30000000-0000-4000-8000-000000000571', 'Orders rise 62%', 'story-571'),
  ('20000000-0000-4000-8000-000000000572', '10000000-0000-4000-8000-000000000571', 'Live post', 'published',
   null, null, null);
update public.articles set wp_post_id = 9, wp_post_url = 'https://from.test/live', published_at = now()
  where id = '20000000-0000-4000-8000-000000000572';
insert into public.article_sources (website_id, article_id, url) values
  ('10000000-0000-4000-8000-000000000571', '20000000-0000-4000-8000-000000000571', 'https://source.test/a');
insert into public.article_images (article_id, website_id, storage_path, source_kind, wp_media_id) values
  ('20000000-0000-4000-8000-000000000571', '10000000-0000-4000-8000-000000000571',
   '10000000-0000-4000-8000-000000000571/20000000-0000-4000-8000-000000000571/40000000-0000-4000-8000-000000000571.png',
   'ai_generated', 5);
insert into public.story_candidates (id, website_id, url, title, fingerprint, status) values
  ('50000000-0000-4000-8000-000000000571', '10000000-0000-4000-8000-000000000571', 'https://source.test/a',
   'Orders rise', 'story-571', 'used');
insert into public.jobs (id, website_id, story_id, status, step, state, article_id) values
  ('60000000-0000-4000-8000-000000000571', '10000000-0000-4000-8000-000000000571',
   '50000000-0000-4000-8000-000000000571', 'succeeded', 'create_article', '{"warnings": ["Verification: x"]}',
   '20000000-0000-4000-8000-000000000571');

select pg_temp.check_fails($$select public.move_article('20000000-0000-4000-8000-000000000572',
  '10000000-0000-4000-8000-000000000572', (select version from public.articles where id = '20000000-0000-4000-8000-000000000572'), null)$$,
  'never published');
select pg_temp.check_fails($$select public.move_article('20000000-0000-4000-8000-000000000571',
  '10000000-0000-4000-8000-000000000573', (select version from public.articles where id = '20000000-0000-4000-8000-000000000571'), null)$$,
  'another language');
select pg_temp.check_fails($$select public.move_article('20000000-0000-4000-8000-000000000571',
  '10000000-0000-4000-8000-000000000572', 0, null)$$, 'changed since you opened it');

select public.move_article('20000000-0000-4000-8000-000000000571', '10000000-0000-4000-8000-000000000572',
  (select version from public.articles where id = '20000000-0000-4000-8000-000000000571'), null);
select pg_temp.check_true((select website_id = '10000000-0000-4000-8000-000000000572'
  and category_id = '30000000-0000-4000-8000-000000000572' and seo_title = 'Orders rise 62%' and status = 'in_review'
  from public.articles where id = '20000000-0000-4000-8000-000000000571'), 'the article moves with its fields and matching category');
select pg_temp.check_true((select website_id = '10000000-0000-4000-8000-000000000572' from public.article_sources
  where article_id = '20000000-0000-4000-8000-000000000571'), 'its sources move');
select pg_temp.check_true((select website_id = '10000000-0000-4000-8000-000000000572' and wp_media_id is null
  and storage_path like '10000000-0000-4000-8000-000000000572/20000000-0000-4000-8000-000000000571/%'
  from public.article_images where article_id = '20000000-0000-4000-8000-000000000571'), 'its images move to the new folder');

select pg_temp.check_true((select article_id is null from public.jobs
  where id = '60000000-0000-4000-8000-000000000571'), 'the old job stays with the old website');
select pg_temp.check_true((select j.status = 'queued' and j.step = 'recollect' and j.state->'warnings' = '["Verification: x"]'
  and s.status = 'used' and s.fingerprint = 'story-571'
  from public.jobs j join public.story_candidates s on s.id = j.story_id and s.website_id = j.website_id
  where j.article_id = '20000000-0000-4000-8000-000000000571' and j.website_id = '10000000-0000-4000-8000-000000000572'),
  'the new website gets a used story and a queued re-check of the article');

-- Dashboard users go through the server action, never the function itself.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select pg_temp.check_fails($$select public.move_article('20000000-0000-4000-8000-000000000571',
  '10000000-0000-4000-8000-000000000571', 1, null)$$, 'permission denied');
reset role;
rollback;
