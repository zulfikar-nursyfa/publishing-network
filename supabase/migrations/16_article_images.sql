-- Images attached to articles, with their source and usage rights.
--
-- Preference order for a website: owned images, properly licensed images, official press/media
-- assets whose terms permit use, then AI-generated editorial illustrations. AI illustrations must
-- never be presented as photographs of a real event: the publishing code labels them using
-- source_kind, so it is required on every row.

create type public.image_source_kind as enum ('owned', 'licensed', 'press', 'ai_generated');

-- Target of the composite foreign key below, so an image can only belong to an article of the
-- same website.
alter table public.articles add constraint articles_id_website_key unique (id, website_id);

create table public.article_images (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null,
  website_id uuid not null references public.websites (id) on delete cascade,
  role text not null default 'featured' check (role in ('featured', 'inline')),
  -- The file: in Supabase Storage, or a remote URL we are permitted to use.
  storage_path text,
  url text check (url ~ '^https?://'),
  alt_text text,
  caption text,
  -- Shown with the image, e.g. "Photo: Dubai Media Office".
  credit text,
  source_kind public.image_source_kind not null,
  -- Where the image came from and the terms it is used under.
  source_url text check (source_url ~ '^https?://'),
  license text,
  license_url text check (license_url ~ '^https?://'),
  -- For AI illustrations: what produced it.
  ai_model text,
  ai_prompt text,
  -- WordPress media library id once uploaded.
  wp_media_id bigint,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (article_id, website_id) references public.articles (id, website_id) on delete cascade,
  check (storage_path is not null or url is not null),
  -- Licensed and press images must record where the rights come from.
  check (source_kind not in ('licensed', 'press') or source_url is not null or license is not null)
);

create unique index article_images_featured_idx on public.article_images (article_id) where role = 'featured';
create index article_images_website_idx on public.article_images (website_id, created_at desc);

create trigger article_images_updated_at before update on public.article_images
  for each row execute function public.set_updated_at();

alter table public.article_images enable row level security;

create policy "article images: members read" on public.article_images
  for select to authenticated using (public.can_access_website(website_id));
create policy "article images: members write" on public.article_images
  for all to authenticated
  using (public.can_access_website(website_id))
  with check (public.can_access_website(website_id));

revoke all on public.article_images from anon;
grant select, insert, update, delete on public.article_images to authenticated;
grant all on public.article_images to service_role;
