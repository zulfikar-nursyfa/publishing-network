-- Stock-first article images: drafting searches Shutterstock and licenses a fitting photo, and falls
-- back to an AI image (now gemini-nano-banana-2.1) when none fits or Shutterstock is not configured.

-- Shutterstock photos each website has licensed, so a website never uses the same photo twice.
-- The row is written before licensing, so two jobs cannot license the same photo for one website.
-- article_id has no foreign key: the drafting job fixes the id before the article row exists.
create table public.website_stock_images (
  website_id uuid not null references public.websites (id) on delete cascade,
  image_id text not null check (image_id ~ '^[0-9]+$'),
  article_id uuid,
  created_at timestamptz not null default now(),
  primary key (website_id, image_id)
);

alter table public.website_stock_images enable row level security;

create policy "website_stock_images: members read" on public.website_stock_images
  for select to authenticated using (public.can_access_website(website_id));

revoke all on public.website_stock_images from anon, authenticated;
grant select on public.website_stock_images to authenticated;
grant all on public.website_stock_images to service_role;

-- Nano Banana 2.1: $0.0336 per 1K image (about 1,120 output tokens at $30 per million); input $1.50 per
-- million. Standard paid prices from https://ai.google.dev/gemini-api/docs/pricing, checked 2026-11-20.
-- An image model does not search, so its search price is 0.
insert into public.ai_model_prices (model, input_per_million_usd, output_per_million_usd, search_per_thousand_usd)
values ('gemini-nano-banana-2.1', 1.50, 30, 0)
on conflict (model) do update set input_per_million_usd = excluded.input_per_million_usd,
  output_per_million_usd = excluded.output_per_million_usd, search_per_thousand_usd = excluded.search_per_thousand_usd,
  updated_at = now();
