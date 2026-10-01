-- One row per automated publishing slot that the scheduler has handled. The unique key means a
-- slot is processed once even if the cron job runs twice, so a site never exceeds its quota.
-- Skipped and failed slots keep a note, which is what the dashboard shows as an alert.

create table public.publish_slots (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  slot_at timestamptz not null,
  status text not null default 'running' check (status in ('running', 'published', 'skipped', 'failed')),
  article_id uuid references public.articles (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, slot_at)
);

create trigger publish_slots_updated_at before update on public.publish_slots
  for each row execute function public.set_updated_at();

alter table public.publish_slots enable row level security;

create policy "slots: members read" on public.publish_slots
  for select to authenticated using (public.can_access_website(website_id));

revoke all on public.publish_slots from anon;
grant select on public.publish_slots to authenticated;
grant all on public.publish_slots to service_role;
