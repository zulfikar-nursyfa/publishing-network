-- Per-website publishing schedule and automation policy (Ali's decisions, 2026-10-01).
--
-- A website publishes its automated articles at fixed local times (e.g. 08:00, 14:00, 20:00 in
-- Africa/Cairo). The times are wall-clock times in websites.timezone, so daylight-saving changes
-- are handled by the timezone rather than a hard-coded UTC offset. daily_quota is kept as the
-- number of times so existing queries keep working; the check below keeps the two in step.

-- Automation policy for a website:
--   off       – automation creates nothing (manual publishing still works)
--   review    – every automated article waits for editorial approval (the launch default)
--   automatic – articles may publish without review, but only in categories that allow it and
--               never when flagged sensitive (see 13_categories.sql and 15_article_scheduling.sql)
create type public.automation_mode as enum ('off', 'review', 'automatic');

alter table public.websites
  drop constraint websites_daily_quota_check,
  add column publish_times time[] not null default '{}',
  add column automation_mode public.automation_mode not null default 'review',
  -- Model used for drafting on this website. Null means the network default
  -- (network_settings.default_ai_model, then the GEMINI_MODEL environment variable).
  add column ai_model text check (ai_model is null or ai_model ~ '^[A-Za-z0-9._:/-]{1,100}$');

-- Existing websites keep their quota, using the first of the standard launch times.
update public.websites
   set publish_times = (array['08:00', '14:00', '20:00']::time[])[1:daily_quota]
 where daily_quota > 0 and cardinality(publish_times) = 0;

alter table public.websites
  add constraint websites_daily_quota_check check (daily_quota between 0 and 12),
  add constraint websites_publish_times_match_quota check (cardinality(publish_times) = daily_quota),
  alter column timezone set default 'Africa/Cairo',
  -- Superseded by automation_mode; nothing reads it.
  drop column require_review;
