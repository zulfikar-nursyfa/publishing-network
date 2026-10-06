-- Lease slots and bind the chosen article before making any external request.
alter table public.publish_slots
  add column locked_by uuid,
  add column locked_until timestamptz,
  add column attempt_count integer not null default 0 check (attempt_count >= 0);

create index publish_slots_recovery_idx on public.publish_slots (locked_until) where status = 'running';

create or replace function public.claim_publish_slot(target_website uuid, target_slot timestamptz, worker uuid)
returns setof public.publish_slots language plpgsql security definer set search_path = '' as $$
declare
  claimed public.publish_slots;
  chosen uuid;
begin
  if not public.is_system_request() then raise exception 'Service only'; end if;
  -- Serialises selection for a website, including overlapping cron invocations.
  perform pg_advisory_xact_lock(hashtextextended(target_website::text, 19));
  insert into public.publish_slots (website_id, slot_at)
    values (target_website, target_slot) on conflict (website_id, slot_at) do nothing;
  select * into claimed from public.publish_slots
    where website_id = target_website and slot_at = target_slot for update;
  if claimed.status <> 'running' or claimed.locked_until > now() then return; end if;
  if claimed.attempt_count >= 5 then
    update public.publish_slots set status = 'failed', note = 'Slot recovery attempts exhausted',
      locked_until = null, locked_by = null where id = claimed.id;
    return;
  end if;
  if claimed.article_id is null and target_slot >= now() - interval '30 minutes' and target_slot <= now() then
    select a.id into chosen from public.articles a
      where a.website_id = target_website and a.origin = 'automated' and a.status = 'approved'
        and (a.scheduled_for = target_slot or a.scheduled_for is null)
        and not exists (select 1 from public.publications p where p.article_id = a.id and p.status = 'failed')
        and not exists (select 1 from public.publish_slots s where s.article_id = a.id and s.id <> claimed.id)
      order by a.scheduled_for nulls last, a.approved_at, a.id limit 1 for update skip locked;
  end if;
  return query update public.publish_slots set
    article_id = coalesce(claimed.article_id, chosen), locked_by = worker,
    locked_until = now() + interval '10 minutes', attempt_count = attempt_count + 1
    where id = claimed.id returning *;
end;
$$;
revoke all on function public.claim_publish_slot(uuid, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.claim_publish_slot(uuid, timestamptz, uuid) to service_role;

create or replace function public.finish_publish_slot(target_slot uuid, worker uuid, outcome text, explanation text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_system_request() then raise exception 'Service only'; end if;
  if outcome not in ('published', 'failed', 'skipped') then raise exception 'Invalid slot outcome'; end if;
  update public.publish_slots set status = outcome, note = left(explanation, 2000),
    locked_by = null, locked_until = null
    where id = target_slot and status = 'running' and locked_by = worker and locked_until > now();
  return found;
end;
$$;
revoke all on function public.finish_publish_slot(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.finish_publish_slot(uuid, uuid, text, text) to service_role;
