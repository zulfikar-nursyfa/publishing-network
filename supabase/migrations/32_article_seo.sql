-- SEO fields per article, sent to WordPress (Yoast SEO) when publishing, and the result of the
-- check that the published post loads and can be indexed.

alter table public.articles
  add column seo_title text check (char_length(seo_title) <= 70),
  add column meta_description text check (char_length(meta_description) <= 170),
  add column focus_keyword text check (char_length(focus_keyword) <= 80),
  add column tags text[] not null default '{}' check (cardinality(tags) <= 10);

-- {ok, status, problems[], checked_at}; written by the publishing service only.
alter table public.publications add column live_check jsonb;
