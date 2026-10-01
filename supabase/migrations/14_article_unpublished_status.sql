-- An article that was live on WordPress and has been taken down from the dashboard.
--
-- Kept in its own migration: PostgreSQL does not allow a new enum value to be used in the same
-- transaction that adds it. 15_article_scheduling.sql only refers to it in a function body and
-- as text, so it also works if both files are applied in one transaction.

alter type public.article_status add value if not exists 'unpublished' after 'published';
