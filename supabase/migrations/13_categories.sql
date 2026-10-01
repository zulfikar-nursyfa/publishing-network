-- Article categories, per website, mirrored to WordPress categories.
--
-- Categories also carry the review policy: in automatic mode an automated article may skip
-- review only when its category allows it (breaking, sensitive or consequential topics stay
-- reviewed by leaving auto_publish_allowed false).

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  name text not null,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  -- WordPress term id once the category exists on the site.
  wp_term_id bigint,
  auto_publish_allowed boolean not null default false,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, slug),
  unique (website_id, wp_term_id),
  -- Target of the composite foreign key on articles, so an article can only use a category from
  -- its own website.
  unique (id, website_id)
);

create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

alter table public.categories enable row level security;

create policy "categories: members read" on public.categories
  for select to authenticated using (public.can_access_website(website_id));
create policy "categories: admin manages" on public.categories
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.categories from anon;
grant select, insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;

-- Deleting a category leaves its articles uncategorised rather than deleting them.
alter table public.articles
  add column category_id uuid,
  add constraint articles_category_fkey foreign key (category_id, website_id)
    references public.categories (id, website_id) on delete set null (category_id);

create index articles_category_idx on public.articles (website_id, category_id);
