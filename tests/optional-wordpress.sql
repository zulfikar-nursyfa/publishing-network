-- Disposable local database only, with migrations 00–53 applied. Fixtures roll back.
begin;
create function pg_temp.check_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %', message; end if; end;
$$;

insert into public.websites (id, name, slug, domain) values
  ('10000000-0000-4000-8000-000000000053', 'Drafting only', 'drafting-only', 'drafting.test');
select pg_temp.check_true((select wp_base_url is null and wp_username is null and wp_connection_status = 'untested'
  from public.websites where id = '10000000-0000-4000-8000-000000000053'), 'websites can exist without WordPress');

do $$ begin
  update public.websites set wp_base_url = 'https://drafting.test' where id = '10000000-0000-4000-8000-000000000053';
  raise exception 'URL without username was accepted';
exception when check_violation then null;
end $$;

update public.websites set wp_base_url = 'https://drafting.test', wp_username = 'publisher'
where id = '10000000-0000-4000-8000-000000000053';
select pg_temp.check_true((select wp_base_url is not null from public.websites
  where id = '10000000-0000-4000-8000-000000000053'), 'WordPress can be added later');
rollback;
