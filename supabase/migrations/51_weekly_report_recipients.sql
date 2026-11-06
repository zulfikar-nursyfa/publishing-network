-- People who get the weekly report email without the problem alerts. Alert recipients keep
-- getting the weekly report too; the cron sends one email to both lists, without duplicates.
alter table public.network_settings
  add column weekly_report_emails text[] not null default '{}' check (cardinality(weekly_report_emails) <= 10);
