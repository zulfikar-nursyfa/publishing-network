-- A language switch reapplies the niche's category names: categories linked to the old-language
-- template take the new-language name and description (same slug, so WordPress URLs stay).
-- Same body as 38 plus the rename step.
create or replace function public.sync_niche_categories(target_website uuid)
returns void language plpgsql set search_path = '' as $$
declare target_niche uuid; target_language public.site_language;
begin
  perform pg_advisory_xact_lock(hashtextextended(target_website::text, 38));
  select niche_id, language into target_niche, target_language from public.websites where id = target_website;
  update public.categories c set name = n.name, description = n.description, niche_category_id = n.id
    from public.niche_categories old, public.niche_categories n
    where c.website_id = target_website and c.niche_category_id = old.id
      and old.niche_id = target_niche and old.language <> target_language
      and n.niche_id = target_niche and n.language = target_language and n.archived_at is null
      and n.slug = c.slug
      and not exists (select 1 from public.categories x where x.website_id = target_website and x.niche_category_id = n.id);
  update public.categories c set niche_category_id = null
    where c.website_id = target_website and c.niche_category_id is not null
      and not exists (select 1 from public.niche_categories n where n.id = c.niche_category_id
        and n.niche_id = target_niche and n.language = target_language);
  update public.categories c set niche_category_id = n.id
    from public.niche_categories n
    where c.website_id = target_website and c.niche_category_id is null
      and n.niche_id = target_niche and n.language = target_language and n.archived_at is null
      and c.slug = n.slug
      and not exists (select 1 from public.categories x where x.website_id = target_website and x.niche_category_id = n.id);
  insert into public.categories (website_id, niche_category_id, name, slug, description, sort_order)
    select target_website, n.id, n.name, n.slug, n.description, n.sort_order
    from public.niche_categories n
    where n.niche_id = target_niche and n.language = target_language and n.archived_at is null
      and not exists (select 1 from public.categories c where c.website_id = target_website
        and (c.niche_category_id = n.id or c.slug = n.slug))
    on conflict do nothing;
end;
$$;
