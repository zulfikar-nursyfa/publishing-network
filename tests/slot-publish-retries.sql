-- Disposable local database only, with migrations 00–65 applied. Fixtures roll back.
-- Checks the slot order: failed articles with attempts left first, then the oldest approval, and moving on.
begin;
create function pg_temp.check_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %', message; end if; end;
$$;

insert into public.websites (id, name, slug, domain, language) values
  ('10000000-0000-4000-8000-000000000651', 'Slots', 'slot-retries', 'slots.test', 'en');
insert into public.articles (id, website_id, title, status, origin, approved_at) values
  ('20000000-0000-4000-8000-000000000651', '10000000-0000-4000-8000-000000000651', 'Oldest', 'approved', 'automated', now() - interval '3 days'),
  ('20000000-0000-4000-8000-000000000652', '10000000-0000-4000-8000-000000000651', 'Newer', 'approved', 'automated', now() - interval '1 day'),
  ('20000000-0000-4000-8000-000000000653', '10000000-0000-4000-8000-000000000651', 'Failed', 'approved', 'automated', now() - interval '2 hours'),
  ('20000000-0000-4000-8000-000000000654', '10000000-0000-4000-8000-000000000651', 'Exhausted', 'approved', 'automated', now() - interval '4 days');
insert into public.publications (article_id, website_id, status, attempt_count, max_attempts, updated_at) values
  ('20000000-0000-4000-8000-000000000653', '10000000-0000-4000-8000-000000000651', 'failed', 1, 4, now() - interval '1 hour'),
  ('20000000-0000-4000-8000-000000000654', '10000000-0000-4000-8000-000000000651', 'failed', 4, 4, now() - interval '1 hour');

create temp table slot as select * from public.claim_publish_slot('10000000-0000-4000-8000-000000000651',
  date_trunc('minute', now()) - interval '1 minute', '40000000-0000-4000-8000-000000000651');
select pg_temp.check_true((select article_id from slot) = '20000000-0000-4000-8000-000000000653',
  'a failed article with attempts left goes first');

-- It fails again in this slot (the trigger moves updated_at past the slot time): the slot moves on.
update public.publications set attempt_count = 2 where article_id = '20000000-0000-4000-8000-000000000653';
select pg_temp.check_true((select article_id from public.next_slot_article((select id from slot),
  '40000000-0000-4000-8000-000000000651')) = '20000000-0000-4000-8000-000000000651',
  'then the oldest approval; exhausted and just-failed articles are passed over');

insert into public.publications (article_id, website_id, status, attempt_count)
  values ('20000000-0000-4000-8000-000000000651', '10000000-0000-4000-8000-000000000651', 'failed', 1);
select pg_temp.check_true((select article_id from public.next_slot_article((select id from slot),
  '40000000-0000-4000-8000-000000000651')) = '20000000-0000-4000-8000-000000000652',
  'each failure in the slot moves on to the next article');
select pg_temp.check_true(not exists (select 1 from public.next_slot_article((select id from slot),
  '40000000-0000-4000-8000-000000000659')), 'only the worker holding the slot can move it on');

select pg_temp.check_true((select article_id from public.claim_publish_slot('10000000-0000-4000-8000-000000000651',
  date_trunc('minute', now()) - interval '2 minutes', '40000000-0000-4000-8000-000000000652')) is null,
  'another slot does not take the running slot''s article or articles that failed since it began');

rollback;
