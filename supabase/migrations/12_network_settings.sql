-- Network-wide controls. This is the one table without website_id: it holds exactly one row of
-- settings that apply to every website (the "pause entire network" switch, the overall spending
-- limit and the default AI model). Per-website settings stay on public.websites.

create table public.network_settings (
  id boolean primary key default true check (id),
  -- Stops automation on every website. Like the per-website pause, it never blocks manual
  -- publishing.
  automation_paused boolean not null default false,
  -- Estimated AI spend allowed per calendar month across all websites. Null means no network
  -- limit; each website's monthly_ai_budget_usd still applies.
  monthly_ai_budget_usd numeric(10, 2) check (monthly_ai_budget_usd is null or monthly_ai_budget_usd >= 0),
  -- Model used when a website has no ai_model of its own. Null falls back to GEMINI_MODEL.
  default_ai_model text check (default_ai_model is null or default_ai_model ~ '^[A-Za-z0-9._:/-]{1,100}$'),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.network_settings (id) values (true);

create trigger network_settings_updated_at before update on public.network_settings
  for each row execute function public.set_updated_at();

alter table public.network_settings enable row level security;

-- Everyone signed in can see whether the network is paused; only administrators change it.
-- The single row is created here, so users get no insert or delete.
create policy "network settings: signed-in users read" on public.network_settings
  for select to authenticated using (true);
create policy "network settings: admin updates" on public.network_settings
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.network_settings from anon;
grant select, update on public.network_settings to authenticated;
grant all on public.network_settings to service_role;
