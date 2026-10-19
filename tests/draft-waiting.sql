-- Disposable PostgreSQL only, with migrations 00–42 applied. Everything rolls back.
begin;
create function pg_temp.check_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Assertion failed: %', message; end if; end; $$;
insert into auth.users (id,email) values ('00000000-0000-4000-8000-000000000042','editor@test.invalid');
insert into public.websites (id,name,slug,domain,wp_base_url,wp_username,automation_mode,automation_paused)
values ('10000000-0000-4000-8000-000000000042','Waiting test','waiting-test','test.invalid','https://test.invalid','test','review',false),
('10000000-0000-4000-8000-000000000043','Private test','private-test','private.invalid','https://private.invalid','test','review',false);
insert into public.website_members (website_id,user_id) values
('10000000-0000-4000-8000-000000000042','00000000-0000-4000-8000-000000000042');
insert into public.story_candidates (id,website_id,title,url,fingerprint,status,source_published_at)
select ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'10000000-0000-4000-8000-000000000042',
  'Waiting story '||i,'https://test.invalid/'||i,'waiting-'||i,'selected',now()-interval '3 days'
from generate_series(1,9) i;
insert into public.jobs (id,website_id,story_id,status,step,state,locked_by,locked_until)
select ('30000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'10000000-0000-4000-8000-000000000042',
  ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
  case when i=2 then 'running' when i=3 then 'failed' when i=4 then 'cancelled' when i=9 then 'succeeded' else 'queued' end,
  case when i=6 then 'research' else 'collect' end,
  case when i=7 then '{"research":{},"corroboration_searched":true}'::jsonb else '{}'::jsonb end,
  case when i=2 then '40000000-0000-4000-8000-000000000042'::uuid else null end,
  case when i=2 then now()+interval '2 minutes' else null end
from generate_series(1,9) i;
update public.story_candidates set source_published_at=now()-interval '1 hour' where id='20000000-0000-4000-8000-000000000005';
update public.story_candidates set status='used' where id='20000000-0000-4000-8000-000000000009';
update public.jobs set waiting_kind='budget',waiting_reason='Network AI budget exceeded',waiting_since=now()-interval '1 hour'
where id='30000000-0000-4000-8000-000000000001';
insert into public.ai_usage (website_id,job_id,model,operation,input_hash,status,reserved_cost_usd,input_per_million_usd,output_per_million_usd)
values ('10000000-0000-4000-8000-000000000042','30000000-0000-4000-8000-000000000008',
  'gemini-test','research','old-generation','uncertain',0.01,0.3,2.5);

select pg_temp.check_true(public.cancel_draft_job('30000000-0000-4000-8000-000000000001',true,now()-interval '48 hours'),'stale queued story removed');
select pg_temp.check_true((select status='skipped' from public.story_candidates where id='20000000-0000-4000-8000-000000000001'),'stale story skipped');
select pg_temp.check_true((select status='cancelled' and waiting_kind is null and waiting_since is null and last_error='Story went stale while waiting' from public.jobs where id='30000000-0000-4000-8000-000000000001'),'stale reason persisted and waiting cleared');
select pg_temp.check_true(not public.cancel_draft_job('30000000-0000-4000-8000-000000000002',true,now()-interval '48 hours'),'stale rule protects running job');
select pg_temp.check_true(not public.cancel_draft_job('30000000-0000-4000-8000-000000000005',true,now()-interval '48 hours'),'stale rule protects recent story');
select pg_temp.check_true(not public.cancel_draft_job('30000000-0000-4000-8000-000000000006',true,now()-interval '48 hours'),'stale rule protects research step');
select pg_temp.check_true(not public.cancel_draft_job('30000000-0000-4000-8000-000000000007',true,now()-interval '48 hours'),'stale rule protects research returning for corroboration');
select pg_temp.check_true(not public.cancel_draft_job('30000000-0000-4000-8000-000000000008',true,now()-interval '48 hours'),'stale rule protects historical research after a manual restart');
select pg_temp.check_true(public.cancel_draft_job('30000000-0000-4000-8000-000000000002',true),'running removal accepted');
select pg_temp.check_true((select status='cancelled' and locked_by='40000000-0000-4000-8000-000000000042' and locked_until>now() from public.jobs where id='30000000-0000-4000-8000-000000000002'),'running lease preserved');
do $$ begin
  perform public.complete_draft_job('30000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000042');
  raise exception 'Cancelled worker was allowed to complete';
exception when others then
  if sqlerrm <> 'Draft lease lost' then raise; end if;
end $$;
select pg_temp.check_true(public.cancel_draft_job('30000000-0000-4000-8000-000000000003',true),'failed removal accepted');
select pg_temp.check_true(public.cancel_draft_job('30000000-0000-4000-8000-000000000004',true),'already cancelled story can be dropped');
select pg_temp.check_true(not public.cancel_draft_job('30000000-0000-4000-8000-000000000004',true),'repeated removal is idempotent');
select pg_temp.check_true(not public.cancel_draft_job('30000000-0000-4000-8000-000000000009',true),'completed article protected');
select pg_temp.check_true(not has_function_privilege('authenticated','public.cancel_draft_job(uuid,boolean,timestamptz)','execute'),'editors must use permission checked server action');
select pg_temp.check_true(not has_function_privilege('anon','public.cancel_draft_job(uuid,boolean,timestamptz)','execute'),'anonymous RPC rejected');
select pg_temp.check_true(has_function_privilege('service_role','public.cancel_draft_job(uuid,boolean,timestamptz)','execute'),'worker may cancel');
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000042',true);
select pg_temp.check_true((select count(*)=9 from public.job_list),'editor can read assigned jobs and waiting fields');
select pg_temp.check_true((select count(*)=1 from public.websites),'editor cannot access private website');
rollback;
