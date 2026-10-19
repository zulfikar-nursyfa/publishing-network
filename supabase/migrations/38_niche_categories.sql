-- Starting categories are copied once; website edits and WordPress term ids remain local.
create table public.niche_categories (
  id uuid primary key default gen_random_uuid(),
  niche_id uuid not null references public.niches(id) on delete cascade,
  language public.site_language not null,
  name text not null check (char_length(name) between 1 and 80),
  slug text not null check (char_length(slug) <= 60 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (char_length(description) <= 300),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (niche_id, language, slug)
);
create trigger niche_categories_updated_at before update on public.niche_categories
  for each row execute function public.set_updated_at();
alter table public.niche_categories enable row level security;
create policy "niche categories: signed-in read" on public.niche_categories
  for select to authenticated using (true);
create policy "niche categories: admin manages" on public.niche_categories
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.niche_categories from anon;
grant select, insert, update, delete on public.niche_categories to authenticated;
grant all on public.niche_categories to service_role;

alter table public.categories
  add column niche_category_id uuid references public.niche_categories(id) on delete set null,
  add constraint categories_niche_category_key unique (website_id, niche_category_id);

-- Invoker rights: category writes still require the existing admin RLS policy.
create function public.sync_niche_categories(target_website uuid)
returns void language plpgsql set search_path = '' as $$
declare target_niche uuid; target_language public.site_language;
begin
  perform pg_advisory_xact_lock(hashtextextended(target_website::text, 38));
  select niche_id, language into target_niche, target_language from public.websites where id = target_website;
  -- Detach old templates without removing or changing any category details.
  update public.categories c set niche_category_id = null
    where c.website_id = target_website and c.niche_category_id is not null
      and not exists (select 1 from public.niche_categories n where n.id = c.niche_category_id
        and n.niche_id = target_niche and n.language = target_language);
  update public.categories c set niche_category_id = n.id
    from public.niche_categories n
    where c.website_id = target_website and c.niche_category_id is null
      and n.niche_id = target_niche and n.language = target_language and n.archived_at is null
      and c.slug = n.slug
      and not exists (select 1 from public.categories x where x.website_id = target_website and x.niche_category_id = n.id);
  insert into public.categories (website_id, niche_category_id, name, slug, description, sort_order)
    select target_website, n.id, n.name, n.slug, n.description, n.sort_order
    from public.niche_categories n
    where n.niche_id = target_niche and n.language = target_language and n.archived_at is null
      and not exists (select 1 from public.categories c where c.website_id = target_website
        and (c.niche_category_id = n.id or c.slug = n.slug))
    on conflict do nothing;
end;
$$;
revoke all on function public.sync_niche_categories(uuid) from public, anon;
grant execute on function public.sync_niche_categories(uuid) to authenticated, service_role;

-- Inas must confirm the Arabic names before the Arabic website launches. Slugs stay ASCII.
insert into public.niche_categories (niche_id, language, name, slug, sort_order)
select n.id, s.language::public.site_language, s.name, s.slug, s.sort_order
from public.niches n cross join (values
  ('en', 'News', 'news', 1), ('en', 'Companies', 'companies', 2),
  ('en', 'Startups', 'startups', 3), ('en', 'Investment', 'investment', 4),
  ('en', 'Entrepreneurship', 'entrepreneurship', 5), ('en', 'Tech & AI Business', 'tech-ai-business', 6),
  ('en', 'GCC Economy', 'gcc-economy', 7), ('en', 'Guides', 'guides', 8),
  ('ar', 'أخبار', 'news', 1), ('ar', 'شركات', 'companies', 2),
  ('ar', 'شركات ناشئة', 'startups', 3), ('ar', 'استثمار', 'investment', 4),
  ('ar', 'ريادة الأعمال', 'entrepreneurship', 5), ('ar', 'الأعمال والتقنية والذكاء الاصطناعي', 'tech-ai-business', 6),
  ('ar', 'اقتصاد الخليج', 'gcc-economy', 7), ('ar', 'أدلة', 'guides', 8)
) s(language, name, slug, sort_order) where n.slug = 'business-investment';
