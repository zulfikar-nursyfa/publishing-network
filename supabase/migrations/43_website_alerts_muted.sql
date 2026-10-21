alter table public.websites add column alerts_muted boolean not null default false;

-- Existing table grants cover this column; website writes remain admin-only through RLS.
create function public.set_website_alert_muting(muted_website_ids uuid[])
returns void language plpgsql set search_path = '' as $$
begin
  if muted_website_ids is null or exists (
    select 1 from unnest(muted_website_ids) as selected(id)
    left join public.websites w on w.id = selected.id
    where w.id is null or w.archived_at is not null
  ) then
    raise exception 'Choose non-archived websites. Reload and try again.';
  end if;

  update public.websites
  set alerts_muted = (id = any(muted_website_ids))
  where archived_at is null and alerts_muted is distinct from (id = any(muted_website_ids));
end;
$$;

revoke all on function public.set_website_alert_muting(uuid[]) from public, anon, authenticated;
grant execute on function public.set_website_alert_muting(uuid[]) to service_role;
