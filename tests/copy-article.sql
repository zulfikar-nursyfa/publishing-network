-- Disposable local database only, with migrations 00–58 applied. Fixtures roll back.
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
  ('10000000-0000-4000-8000-000000000581', 'Dev', 'copy-from', 'dev.test', 'en'),
  ('10000000-0000-4000-8000-000000000582', 'Main', 'copy-to', 'main.test', 'en'),
  ('10000000-0000-4000-8000-000000000583', 'Arabic', 'copy-ar', 'ar.test', 'ar');
insert into public.categories (id, website_id, name, slug) values
  ('30000000-0000-4000-8000-000000000581', '10000000-0000-4000-8000-000000000581', 'Markets', 'markets'),
  ('30000000-0000-4000-8000-000000000582', '10000000-0000-4000-8000-000000000582', 'News', 'news');
insert into public.articles (id, website_id, title, body, status, category_id, seo_title, story_fingerprint) values
  ('20000000-0000-4000-8000-000000000581', '10000000-0000-4000-8000-000000000581', 'Orders rise',
   E'Intro\n[image:40000000-0000-4000-8000-000000000582]', 'published',
   '30000000-0000-4000-8000-000000000581', 'Orders rise 62%', 'story-581'),
  ('20000000-0000-4000-8000-000000000582', '10000000-0000-4000-8000-000000000581', 'Draft', '', 'draft',
   null, null, null);
update public.articles set wp_post_id = 9, wp_post_url = 'https://dev.test/p', published_at = '2024-03-05 10:00+00'
  where id = '20000000-0000-4000-8000-000000000581';
insert into public.article_sources (website_id, article_id, url) values
  ('10000000-0000-4000-8000-000000000581', '20000000-0000-4000-8000-000000000581', 'https://source.test/a');
insert into public.article_images (id, article_id, website_id, role, storage_path, source_kind, wp_media_id) values
  ('40000000-0000-4000-8000-000000000581', '20000000-0000-4000-8000-000000000581',
   '10000000-0000-4000-8000-000000000581', 'featured',
   '10000000-0000-4000-8000-000000000581/20000000-0000-4000-8000-000000000581/f.png', 'ai_generated', 5),
  ('40000000-0000-4000-8000-000000000582', '20000000-0000-4000-8000-000000000581',
   '10000000-0000-4000-8000-000000000581', 'inline',
   '10000000-0000-4000-8000-000000000581/20000000-0000-4000-8000-000000000581/i.png', 'ai_generated', 6);

select pg_temp.check_fails($$select public.copy_article('20000000-0000-4000-8000-000000000582',
  '10000000-0000-4000-8000-000000000582', gen_random_uuid(), null, now(), null)$$, 'Only published');
select pg_temp.check_fails($$select public.copy_article('20000000-0000-4000-8000-000000000581',
  '10000000-0000-4000-8000-000000000583', gen_random_uuid(), null, now(), null)$$, 'another language');
select pg_temp.check_fails($$select public.copy_article('20000000-0000-4000-8000-000000000581',
  '10000000-0000-4000-8000-000000000582', gen_random_uuid(), null, now(), null)$$, 'Choose a category');

select public.copy_article('20000000-0000-4000-8000-000000000581', '10000000-0000-4000-8000-000000000582',
  '20000000-0000-4000-8000-000000000589', '30000000-0000-4000-8000-000000000582', '2030-01-01 08:00+00', null);
select pg_temp.check_true((select status = 'approved' and category_id = '30000000-0000-4000-8000-000000000582'
  and seo_title = 'Orders rise 62%' and original_published_at = '2024-03-05 10:00+00' and published_at is null
  and wp_post_id is null and scheduled_for = '2030-01-01 08:00+00'
  and copied_from = '20000000-0000-4000-8000-000000000581'
  from public.articles where id = '20000000-0000-4000-8000-000000000589'), 'the copy is approved and scheduled');
select pg_temp.check_true((select status = 'published' and wp_post_id = 9 from public.articles
  where id = '20000000-0000-4000-8000-000000000581'), 'the original stays published');
select pg_temp.check_true((select count(*) = 1 from public.article_sources
  where article_id = '20000000-0000-4000-8000-000000000589'), 'its sources are copied');
select pg_temp.check_true((select count(*) = 2 and bool_and(wp_media_id is null)
  and bool_and(storage_path like '10000000-0000-4000-8000-000000000582/20000000-0000-4000-8000-000000000589/%')
  from public.article_images where article_id = '20000000-0000-4000-8000-000000000589'), 'its images are copied');
select pg_temp.check_true((select a.body like '%[image:' || i.id || ']%' from public.articles a
  join public.article_images i on i.article_id = a.id and i.role = 'inline'
  where a.id = '20000000-0000-4000-8000-000000000589'), 'the body points at the copied inline image');
select pg_temp.check_fails($$select public.copy_article('20000000-0000-4000-8000-000000000581',
  '10000000-0000-4000-8000-000000000582', gen_random_uuid(), '30000000-0000-4000-8000-000000000582', now(), null)$$,
  'Already copied');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select pg_temp.check_fails($$select public.copy_article('20000000-0000-4000-8000-000000000581',
  '10000000-0000-4000-8000-000000000582', gen_random_uuid(), null, now(), null)$$, 'permission denied');
rollback;
