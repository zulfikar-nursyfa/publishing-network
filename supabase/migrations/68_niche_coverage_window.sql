-- How many days older than the story a page may be and still count as coverage of it. Older pages
-- are skipped as background, and an older story page means the feed promoted an old article again.
-- Trade press (marketing, travel) often reports a campaign or opening a week after it happened.
alter table public.niches add column coverage_window_days integer not null default 3
  check (coverage_window_days between 1 and 30);

update public.niches set coverage_window_days = 7
where slug in ('marketing-content-creation', 'travel-tourism');
