-- Marks the article sources that are the original official announcement (company, government or
-- regulator), so each article keeps which reference is primary and which corroborate it.
-- Set by the draft pipeline; editing an article's sources keeps the flag for URLs that remain.

alter table public.article_sources add column official boolean not null default false;
