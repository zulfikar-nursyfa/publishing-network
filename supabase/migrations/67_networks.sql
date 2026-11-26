-- Networks group niches (for example the 15 lifestyle niches, or the 15 health specialties) and hold
-- rules shared by every website in them. Websites take their network from their niche, so adding a
-- website or a network never needs a schema change. Not to be confused with network_settings, which
-- holds the deployment-wide controls (budget, AI model, pause).
-- kind picks network-specific drafting behaviour; shared rules are admin-written, so trusted
-- instructions, added to the research, draft and fact-check prompts above the niche guide.

create table public.networks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind text not null default 'general' check (kind in ('general', 'health')),
  -- Edited as HTML like the niche guides; long enough for a full bilingual rules document.
  rules_en text check (char_length(rules_en) <= 16000),
  rules_ar text check (char_length(rules_ar) <= 16000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger networks_updated_at before update on public.networks
  for each row execute function public.set_updated_at();

alter table public.networks enable row level security;

create policy "networks: signed-in read" on public.networks for select to authenticated using (true);
create policy "networks: admin manages" on public.networks for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.networks from anon;
grant select, insert, update, delete on public.networks to authenticated;
grant all on public.networks to service_role;

insert into public.networks (name, slug, sort_order) values ('General', 'general', 1)
on conflict (slug) do nothing;

-- Every niche belongs to a network; the existing niches join General, so their drafting is unchanged.
-- A network with niches cannot be deleted.
alter table public.niches add column network_id uuid references public.networks (id) on delete restrict;
update public.niches set network_id = (select id from public.networks where slug = 'general') where network_id is null;
alter table public.niches alter column network_id set not null;
create index niches_network_id_idx on public.niches (network_id);
