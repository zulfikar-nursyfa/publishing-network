-- Disposable local database only, with migrations 00–41 applied. Fixtures always roll back.
begin;
create function pg_temp.check_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %', message; end if; end;
$$;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000011', 'list-admin@test.invalid'), ('00000000-0000-0000-0000-000000000012', 'list-editor@test.invalid');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000011';
insert into public.websites (id, name, slug, domain, wp_base_url, wp_username, timezone)
values ('10000000-0000-0000-0000-000000000011', 'Visible', 'list-visible', 'visible.test', 'https://visible.test', 'test', 'Africa/Cairo'),
  ('10000000-0000-0000-0000-000000000012', 'Private', 'list-private', 'private.test', 'https://private.test', 'test', 'UTC');
insert into public.website_members (website_id, user_id) values ('10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000012');
insert into public.story_candidates (id, website_id, title, url, fingerprint) values
  ('20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000011', 'شركة تعلن استثمارا جديدا', 'https://visible.test/story', 'visible-story'),
  ('20000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000012', 'Private story', 'https://private.test/story', 'private-story');
insert into public.articles (id, website_id, title, origin, status, published_at) values
  ('30000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000011', 'Visible article', 'automated', 'published', now()),
  ('30000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000012', 'Private article', 'automated', 'in_review', null);
insert into public.jobs (id, website_id, story_id, article_id, state) values
  ('40000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000011', '{"warnings":["Verify launch date"]}'),
  ('40000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000012', '30000000-0000-0000-0000-000000000012', '{}');
insert into public.ai_usage (website_id, job_id, model, operation, input_hash, status, reserved_cost_usd, estimated_cost_usd, input_per_million_usd, output_per_million_usd, search_queries)
select '10000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000000011', 'gemini-test',
  (array['search','research','draft','verify','illustrate'])[1 + (i % 5)], i::text,
  case when i % 10 = 0 then 'reserved' else 'completed' end, 0.03, 0.01, 0, 0, 1
from generate_series(1,1205) i;
insert into public.ai_usage (website_id, job_id, model, operation, input_hash, status, reserved_cost_usd, estimated_cost_usd, input_per_million_usd, output_per_million_usd, created_at)
values ('10000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000000011', 'gemini-test', 'draft', 'previous-month', 'completed', 0, 100, 0, 0, date_trunc('month', now() at time zone 'UTC') at time zone 'UTC' - interval '1 second'),
  ('10000000-0000-0000-0000-000000000012', '40000000-0000-0000-0000-000000000012', 'gemini-test', 'draft', 'private-call', 'completed', 0, 999, 0, 0, now());

select pg_temp.check_true((select sum(calls) = 1205 and sum(cost_usd) = 14.45 and sum(searches) = 1205 from public.website_month_usage('10000000-0000-0000-0000-000000000011', (now() at time zone 'UTC')::date - (extract(day from now() at time zone 'UTC')::integer - 1))), 'monthly totals include >1000 calls, reservations and searches, excluding the previous month');
select pg_temp.check_true((select sum(calls) = 1206 and sum(cost_usd) = 114.45 from public.job_usage_summary('40000000-0000-0000-0000-000000000011')), 'article/job lifetime totals include every call');
insert into public.cost_entries (website_id, month, category, amount_usd)
select '10000000-0000-0000-0000-000000000011', date_trunc('month', now() at time zone 'UTC')::date, 'images', 1 from generate_series(1,1005);
select pg_temp.check_true((select amount_usd = 1005 from public.month_other_costs(date_trunc('month', now() at time zone 'UTC')::date) where website_id = '10000000-0000-0000-0000-000000000011'), 'entered cost totals include >1000 rows');
select pg_temp.check_true((select has_warnings from public.article_list where id = '30000000-0000-0000-0000-000000000011'), 'warning flag derives from real job warnings');
select pg_temp.check_true((select last_published_at is not null from public.website_list where id = '10000000-0000-0000-0000-000000000011'), 'last published sort uses the website articles');
select pg_temp.check_true(not has_table_privilege('anon', 'public.story_list', 'select'), 'anonymous cannot read list views');
select pg_temp.check_true(not has_function_privilege('anon', 'public.website_month_usage(uuid,date)', 'execute'), 'anonymous cannot read financial aggregates');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', true);
select pg_temp.check_true((select count(*) = 1 from public.story_list), 'story view keeps editor RLS');
select pg_temp.check_true((select count(*) = 1 from public.job_list), 'job view keeps editor RLS');
select pg_temp.check_true((select count(*) = 1 from public.article_list), 'article view keeps editor RLS');
select pg_temp.check_true((select count(*) = 1 from public.website_list), 'website view keeps editor RLS');
select pg_temp.check_true((select count(*) = 0 from public.story_list where website_id = '10000000-0000-0000-0000-000000000012'), 'an inaccessible website filter cannot widen access');
select pg_temp.check_true((select sum(calls) = 1205 from public.website_month_usage('10000000-0000-0000-0000-000000000011', date_trunc('month', now() at time zone 'UTC')::date)), 'editor can aggregate own site');
select pg_temp.check_true((select count(*) = 0 from public.website_month_usage('10000000-0000-0000-0000-000000000012', date_trunc('month', now() at time zone 'UTC')::date)), 'editor cannot aggregate another site');
select pg_temp.check_true((select count(*) = 0 from public.job_usage_summary('40000000-0000-0000-0000-000000000012')), 'editor cannot aggregate another job');
select pg_temp.check_true((select count(*) = 0 from public.month_other_costs(date_trunc('month', now() at time zone 'UTC')::date)), 'entered cost aggregates retain admin-only RLS');
reset role;
rollback;
