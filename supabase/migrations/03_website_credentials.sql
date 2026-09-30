-- WordPress application passwords, encrypted by the application (AES-256-GCM) before they reach
-- the database. RLS is enabled with no policies and dashboard users have no grants: only the
-- server-side secret key can read or write this table.

create table public.website_credentials (
  website_id uuid primary key references public.websites (id) on delete cascade,
  wp_app_password_encrypted text not null,
  updated_at timestamptz not null default now()
);

create trigger website_credentials_updated_at before update on public.website_credentials
  for each row execute function public.set_updated_at();

alter table public.website_credentials enable row level security;

revoke all on public.website_credentials from anon, authenticated;
grant all on public.website_credentials to service_role;
