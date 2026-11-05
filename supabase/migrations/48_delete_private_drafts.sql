-- Authors may delete their own private drafts. Shared articles are still deleted only by admins.
create policy "articles: authors delete private drafts" on public.articles
  for delete to authenticated
  using (private and status = 'draft' and created_by = (select auth.uid()));
