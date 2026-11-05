-- Disposable local database only, with migrations 00–47 applied. Fixtures roll back.
begin;
create function pg_temp.check_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %', message; end if; end;
$$;
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000471', 'author@test.invalid'),
  ('00000000-0000-4000-8000-000000000472', 'colleague@test.invalid'),
  ('00000000-0000-4000-8000-000000000473', 'private-admin@test.invalid');
update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000473';
insert into public.websites (id, name, slug, domain, wp_base_url, wp_username) values
  ('10000000-0000-4000-8000-000000000471', 'Private', 'private-drafts', 'private.test', 'https://private.test', 'test');
insert into public.website_members (website_id, user_id) values
  ('10000000-0000-4000-8000-000000000471', '00000000-0000-4000-8000-000000000471'),
  ('10000000-0000-4000-8000-000000000471', '00000000-0000-4000-8000-000000000472');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000471', true);
insert into public.articles (id, website_id, title, private, created_by) values
  ('20000000-0000-4000-8000-000000000471', '10000000-0000-4000-8000-000000000471', 'Mine', true,
   '00000000-0000-4000-8000-000000000471');
insert into public.article_sources (website_id, article_id, url) values
  ('10000000-0000-4000-8000-000000000471', '20000000-0000-4000-8000-000000000471', 'https://source.test/a');
select pg_temp.check_true((select count(*) = 1 from public.articles where private), 'the author sees their draft');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000472', true);
select pg_temp.check_true((select count(*) = 0 from public.articles), 'a colleague cannot see it');
select pg_temp.check_true((select count(*) = 0 from public.article_sources), 'nor its sources');
with changed as (update public.articles set title = 'Taken' returning id)
  select pg_temp.check_true((select count(*) = 0 from changed), 'nor edit it');
do $$ begin
  insert into public.articles (website_id, title, private, created_by) values
    ('10000000-0000-4000-8000-000000000471', 'Fake', true, '00000000-0000-4000-8000-000000000471');
  raise exception 'Assertion failed: private drafts in someone else''s name';
exception when insufficient_privilege then null;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000473', true);
select pg_temp.check_true((select count(*) = 0 from public.articles), 'admins cannot see it either');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000471', true);
update public.articles set status = 'in_review' where id = '20000000-0000-4000-8000-000000000471';
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000472', true);
select pg_temp.check_true((select count(*) = 1 from public.articles where not private), 'submitting shares it');
update public.articles set status = 'draft' where id = '20000000-0000-4000-8000-000000000471';
select pg_temp.check_true((select count(*) = 1 from public.articles where not private), 'returned to draft it stays shared');
do $$ begin
  update public.articles set private = true;
  raise exception 'Assertion failed: re-hiding a shared article';
exception when others then
  if sqlerrm like 'Assertion failed%' then raise; end if;
end $$;
reset role;
rollback;
