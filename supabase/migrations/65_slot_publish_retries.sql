-- Failed publications are retried at the website's next publishing slots instead of every ten minutes
-- (PM review 20 Nov: four quick retries were spent on a category error before anyone could fix it, and the
-- article then never came back because slots skipped every article with a failed publication).
--
-- A slot now picks a failed article with attempts left first, then the article approved longest ago. If
-- the slot's article fails, next_slot_article moves the same slot on to the next candidate, so one broken
-- article never costs a publish. An article whose publication was tried since the slot began is not picked
-- again for that slot. Only slots that are running or published keep an article out of other slots.

create or replace function public.next_slot_candidate(target_website uuid, target_slot timestamptz)
returns uuid language sql security definer set search_path = '' as $$
  select a.id from public.articles a
    left join public.publications p on p.article_id = a.id
  where a.website_id = target_website and a.origin = 'automated' and a.status = 'approved'
    and (
      (p.status is distinct from 'failed' and (a.scheduled_for = target_slot or a.scheduled_for is null))
      or (p.status = 'failed' and p.attempt_count < p.max_attempts and p.updated_at < target_slot
        and (a.scheduled_for is null or a.scheduled_for <= target_slot))
    )
    and not exists (select 1 from public.publish_slots s
      where s.article_id = a.id and s.slot_at <> target_slot and s.status in ('running', 'published'))
  order by (p.status = 'failed') is true desc, a.scheduled_for nulls last, a.approved_at, a.id
  limit 1 for update of a skip locked;
$$;
revoke all on function public.next_slot_candidate(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.next_slot_candidate(uuid, timestamptz) to service_role;

-- Same as 19 except for how the article is chosen.
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
    chosen := public.next_slot_candidate(target_website, target_slot);
  end if;
  return query update public.publish_slots set
    article_id = coalesce(claimed.article_id, chosen), locked_by = worker,
    locked_until = now() + interval '10 minutes', attempt_count = attempt_count + 1
    where id = claimed.id returning *;
end;
$$;

-- After the slot's article failed: binds the next candidate to the slot the worker still holds, or returns nothing.
create or replace function public.next_slot_article(target_slot uuid, worker uuid)
returns setof public.publish_slots language plpgsql security definer set search_path = '' as $$
declare
  claimed public.publish_slots;
  chosen uuid;
begin
  if not public.is_system_request() then raise exception 'Service only'; end if;
  select * into claimed from public.publish_slots where id = target_slot;
  if claimed.id is null then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(claimed.website_id::text, 19));
  select * into claimed from public.publish_slots where id = target_slot for update;
  if claimed.status <> 'running' or claimed.locked_by is distinct from worker or claimed.locked_until <= now()
    or claimed.slot_at < now() - interval '30 minutes' then
    return;
  end if;
  chosen := public.next_slot_candidate(claimed.website_id, claimed.slot_at);
  if chosen is null then return; end if;
  return query update public.publish_slots set article_id = chosen, locked_until = now() + interval '10 minutes'
    where id = claimed.id returning *;
end;
$$;
revoke all on function public.next_slot_article(uuid, uuid) from public, anon, authenticated;
grant execute on function public.next_slot_article(uuid, uuid) to service_role;
