-- Posting live manual articles to each website's own X account and subreddit.
-- social_accounts holds one connection per website and platform. Its tokens are encrypted by the
-- application and only the secret key can read them; members see who is connected.
-- social_posts records one post per article and platform, so a cron run that overlaps another, or a
-- retry, cannot post the same article twice.

create table public.social_accounts (
  website_id uuid not null references public.websites (id) on delete cascade,
  platform text not null check (platform in ('x', 'reddit')),
  account_name text not null,
  subreddit text check (subreddit ~ '^[A-Za-z0-9_]{3,21}$'),
  credentials_encrypted text not null,
  last_error text,
  connected_by uuid references public.profiles (id) on delete set null,
  -- Only articles published after this moment are posted, so connecting does not post the backlog.
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (website_id, platform),
  check ((platform = 'reddit') = (subreddit is not null))
);

create trigger social_accounts_updated_at before update on public.social_accounts
  for each row execute function public.set_updated_at();

alter table public.social_accounts enable row level security;

create policy "social_accounts: members read" on public.social_accounts
  for select to authenticated using (public.can_access_website(website_id));

revoke all on public.social_accounts from anon, authenticated;
grant select (website_id, platform, account_name, subreddit, last_error, connected_at, updated_at)
  on public.social_accounts to authenticated;
grant all on public.social_accounts to service_role;

create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  article_id uuid not null references public.articles (id) on delete cascade,
  platform text not null check (platform in ('x', 'reddit')),
  -- posting: a run is sending it. unknown: the platform may have posted it (timeout, server error),
  -- so it is never retried automatically. failed: the platform refused it; retried up to 3 times.
  status text not null default 'posting' check (status in ('posting', 'posted', 'failed', 'unknown')),
  attempt_count integer not null default 1,
  external_url text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (article_id, platform)
);

create index social_posts_website_idx on public.social_posts (website_id, created_at desc);

create trigger social_posts_updated_at before update on public.social_posts
  for each row execute function public.set_updated_at();

alter table public.social_posts enable row level security;

create policy "social_posts: members read" on public.social_posts
  for select to authenticated using (public.can_access_website(website_id));

revoke all on public.social_posts from anon, authenticated;
grant select on public.social_posts to authenticated;
grant all on public.social_posts to service_role;
