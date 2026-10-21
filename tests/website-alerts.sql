-- Disposable local database only, with migrations 00–43 applied. Fixtures roll back.
begin;
create function pg_temp.check_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %', message; end if; end;
$$;
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000043', 'mute-admin@test.invalid'),
  ('00000000-0000-4000-8000-000000000044', 'mute-editor@test.invalid');
update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000043';
insert into public.websites (id, name, slug, domain, wp_base_url, wp_username) values
  ('10000000-0000-4000-8000-000000000043', 'Live', 'mute-live', 'live.test', 'https://live.test', 'test'),
  ('10000000-0000-4000-8000-000000000044', 'Test', 'mute-test', 'test.invalid', 'https://test.invalid', 'test');
insert into public.website_members (website_id, user_id) values
  ('10000000-0000-4000-8000-000000000044', '00000000-0000-4000-8000-000000000044');
select pg_temp.check_true((select bool_and(not alerts_muted) from public.websites), 'new websites send alerts');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000044', true);
with changed as (
  update public.websites set alerts_muted = true where id = '10000000-0000-4000-8000-000000000044' returning id
) select pg_temp.check_true((select count(*) = 0 from changed), 'editors cannot mute assigned websites');
select pg_temp.check_true(not has_function_privilege('authenticated', 'public.set_website_alert_muting(uuid[])', 'execute'), 'RPC is service-only');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000043', true);
update public.websites set alerts_muted = true where id = '10000000-0000-4000-8000-000000000043';
select pg_temp.check_true((select alerts_muted from public.websites where id = '10000000-0000-4000-8000-000000000043'), 'admins can mute websites');
reset role;

set local role service_role;
select public.set_website_alert_muting(array['10000000-0000-4000-8000-000000000044'::uuid]);
select pg_temp.check_true((select not alerts_muted from public.websites where id = '10000000-0000-4000-8000-000000000043'), 'unselected websites unmute');
select pg_temp.check_true((select alerts_muted from public.websites where id = '10000000-0000-4000-8000-000000000044'), 'selected websites mute');
do $$ begin
  perform public.set_website_alert_muting(array['10000000-0000-4000-8000-000000000099'::uuid]);
  raise exception 'Expected invalid website rejection';
exception when raise_exception then
  if sqlerrm <> 'Choose non-archived websites. Reload and try again.' then raise; end if;
end; $$;
select pg_temp.check_true((select alerts_muted from public.websites where id = '10000000-0000-4000-8000-000000000044'), 'invalid saves change nothing');
select public.set_website_alert_muting('{}'::uuid[]);
select pg_temp.check_true((select bool_and(not alerts_muted) from public.websites), 'empty selection unmutes every site');
reset role;
rollback;
