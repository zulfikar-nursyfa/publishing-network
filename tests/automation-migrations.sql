-- Run only against a disposable local database with migrations 00–40 applied. All fixtures roll back.
begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'Assertion failed: %', message; end if;
end;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'admin@test.invalid'),
  ('00000000-0000-0000-0000-000000000002', 'editor@test.invalid');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000001';
insert into public.websites (id, name, slug, domain, wp_base_url, wp_username, language, niche_id,
  automation_paused, monthly_ai_budget_usd, daily_quota, publish_times)
select s.id::uuid, s.name, s.name, 'test.invalid', 'https://test.invalid', 'test', s.language::public.site_language,
  n.id, false, 10, 1, array['08:00'::time]
from public.niches n cross join (values
  ('10000000-0000-0000-0000-000000000001', 'test-english', 'en'),
  ('10000000-0000-0000-0000-000000000002', 'test-arabic', 'ar')
) s(id, name, language) where n.slug = 'business-investment';

-- Reproduce the dev site's existing eight English categories before linking templates.
insert into public.categories (website_id, name, slug, wp_term_id, sort_order, auto_publish_allowed, archived_at)
select '10000000-0000-0000-0000-000000000001', 'Local ' || name, slug, sort_order, 99, true,
  case when slug = 'news' then now() else null end
from public.niche_categories where language = 'en';
select public.sync_niche_categories('10000000-0000-0000-0000-000000000001');
select public.sync_niche_categories('10000000-0000-0000-0000-000000000001');
select pg_temp.assert_true((select count(*) = 8 from public.categories where website_id = '10000000-0000-0000-0000-000000000001'), 'sync must link, not duplicate');
select pg_temp.assert_true((select bool_and(niche_category_id is not null and wp_term_id is not null and sort_order = 99 and auto_publish_allowed and name like 'Local %')
  from public.categories where website_id = '10000000-0000-0000-0000-000000000001'), 'sync must preserve every local setting');
select pg_temp.assert_true((select archived_at is not null from public.categories where website_id = '10000000-0000-0000-0000-000000000001' and slug = 'news'), 'keep local archive');
update public.niche_categories set name = 'Renamed template', description = 'Changed template', sort_order = 42 where language = 'en' and slug = 'news';
select public.sync_niche_categories('10000000-0000-0000-0000-000000000001');
select pg_temp.assert_true((select name = 'Local News' and description is null and sort_order = 99 from public.categories where website_id = '10000000-0000-0000-0000-000000000001' and slug = 'news'), 'template changes must not overwrite local edits');
update public.niche_categories set archived_at = now() where language = 'ar' and slug = 'guides';
select public.sync_niche_categories('10000000-0000-0000-0000-000000000002');
select pg_temp.assert_true((select count(*) = 7 and bool_and(not auto_publish_allowed and wp_term_id is null) from public.categories where website_id = '10000000-0000-0000-0000-000000000002'), 'Arabic sync skips archived templates and leaves publishing off');
select pg_temp.assert_true((select c.name = n.name and n.language = 'ar' from public.categories c join public.niche_categories n on n.id = c.niche_category_id where c.website_id = '10000000-0000-0000-0000-000000000002' and c.slug = 'news'), 'category language matches website');
update public.websites set niche_id = null where id = '10000000-0000-0000-0000-000000000002';
select public.sync_niche_categories('10000000-0000-0000-0000-000000000002');
select pg_temp.assert_true((select count(*) = 7 and bool_and(niche_category_id is null) from public.categories where website_id = '10000000-0000-0000-0000-000000000002'), 'changing niche detaches without deleting categories');

-- Authenticated users may read templates, but only administrators may write or sync.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select pg_temp.assert_true((select count(*) = 16 from public.niche_categories), 'editors read starting categories');
do $$
begin
  begin
    insert into public.niche_categories (niche_id, language, name, slug)
      select id, 'en', 'Forbidden', 'forbidden' from public.niches limit 1;
    raise exception 'editor insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select public.sync_niche_categories('10000000-0000-0000-0000-000000000001');
select pg_temp.assert_true((select count(*) = 0 from public.categories), 'editor cannot see another website categories');
select pg_temp.assert_true(not has_function_privilege('authenticated', 'public.auto_select_stories(uuid,uuid[])', 'execute'), 'selection RPC is service-only');
reset role;
select pg_temp.assert_true(not has_table_privilege('anon', 'public.niche_categories', 'select'), 'anonymous users cannot read templates');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
set local role authenticated;
update public.niche_categories set description = 'Admin edit' where language = 'en' and slug = 'news';
select pg_temp.assert_true((select description = 'Admin edit' from public.niche_categories where language = 'en' and slug = 'news'), 'authenticated admins manage templates');
select public.sync_niche_categories('10000000-0000-0000-0000-000000000001');
select pg_temp.assert_true((select description is null from public.categories where website_id = '10000000-0000-0000-0000-000000000001' and slug = 'news'), 'authenticated sync also preserves edits');
reset role;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '', true);

-- Defaults do not change automation until an administrator explicitly enables them.
select pg_temp.assert_true((select not auto_select_stories from public.websites where id = '10000000-0000-0000-0000-000000000001'), 'selection default off');
select pg_temp.assert_true((select strict_draft_checks = '{}'::text[] from public.network_settings), 'strict defaults empty');
do $$
begin
  begin
    update public.network_settings set strict_draft_checks = array['invented'];
    raise exception 'unknown strict key accepted';
  exception when check_violation then null;
  end;
end;
$$;
insert into public.content_sources (id, website_id, name, url, active)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Test', 'https://source.test', true);
insert into public.story_candidates (id, website_id, source_id, title, url, fingerprint) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'First distinct headline', 'https://source.test/1', 'first'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Second distinct headline', 'https://source.test/2', 'second'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Third distinct headline', 'https://source.test/3', 'third');
set local role service_role;
select pg_temp.assert_true(public.auto_select_stories('10000000-0000-0000-0000-000000000001', array['30000000-0000-0000-0000-000000000001'::uuid]) = 0, 'disabled setting blocks service RPC');
reset role;
update public.websites set auto_select_stories = true where id = '10000000-0000-0000-0000-000000000001';
update public.network_settings set automation_paused = true;
set local role service_role;
select pg_temp.assert_true(public.auto_select_stories('10000000-0000-0000-0000-000000000001', array['30000000-0000-0000-0000-000000000001'::uuid]) = 0, 'network pause blocks selection');
reset role;
update public.network_settings set automation_paused = false;
update public.websites set monthly_ai_budget_usd = 0 where id = '10000000-0000-0000-0000-000000000001';
set local role service_role;
select pg_temp.assert_true(public.auto_select_stories('10000000-0000-0000-0000-000000000001', array['30000000-0000-0000-0000-000000000001'::uuid]) = 0, 'zero budget blocks selection');
reset role;
update public.websites set monthly_ai_budget_usd = 10 where id = '10000000-0000-0000-0000-000000000001';
update public.story_candidates set source_published_at = now() - interval '49 hours' where id = '30000000-0000-0000-0000-000000000003';
set local role service_role;
select pg_temp.assert_true(public.auto_select_stories('10000000-0000-0000-0000-000000000001', array['30000000-0000-0000-0000-000000000003'::uuid]) = 0, 'stale publication time blocks selection');
reset role;
update public.story_candidates set source_published_at = now() where id = '30000000-0000-0000-0000-000000000003';
update public.content_sources set active = false where id = '20000000-0000-0000-0000-000000000001';
set local role service_role;
select pg_temp.assert_true(public.auto_select_stories('10000000-0000-0000-0000-000000000001', array['30000000-0000-0000-0000-000000000003'::uuid]) = 0, 'disabled source blocks selection');
reset role;
update public.content_sources set active = true where id = '20000000-0000-0000-0000-000000000001';
set local role service_role;
select pg_temp.assert_true(public.auto_select_stories('10000000-0000-0000-0000-000000000001', array[
  '30000000-0000-0000-0000-000000000001'::uuid, '30000000-0000-0000-0000-000000000002'::uuid, '30000000-0000-0000-0000-000000000003'::uuid]) = 2, 'selection stops at two-day capacity');
select pg_temp.assert_true((select count(*) = 2 from public.story_candidates where selected_automatically and status = 'selected'), 'automatic provenance stored');
select pg_temp.assert_true((select count(*) = 2 from public.audit_log where action = 'story.auto_selected'), 'selection audited transactionally');
select pg_temp.assert_true(public.auto_select_stories('10000000-0000-0000-0000-000000000001', array['30000000-0000-0000-0000-000000000003'::uuid]) = 0, 'repeated or overlapping run cannot overfill selection');
update public.story_candidates set status = 'new' where id = '30000000-0000-0000-0000-000000000001';
select pg_temp.assert_true(public.auto_select_stories('10000000-0000-0000-0000-000000000001', array['30000000-0000-0000-0000-000000000001'::uuid]) = 0, 'editor unselection prevents reselection');
select pg_temp.assert_true(public.queue_story_draft('30000000-0000-0000-0000-000000000002', null) is not null, 'existing queue RPC accepts automatic picks');
select pg_temp.assert_true(public.auto_select_stories('10000000-0000-0000-0000-000000000001', array['30000000-0000-0000-0000-000000000003'::uuid]) = 1, 'queued pick counts once in buffer');
reset role;
rollback;
