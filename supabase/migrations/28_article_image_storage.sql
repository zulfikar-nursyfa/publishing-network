-- Private bucket for article images, at "<website id>/<article id>/<uuid>.<ext>".
-- Members of the website upload and remove them; publishing downloads with the secret key.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('article-images', 'article-images', false, 3145728, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "article images: members read files" on storage.objects for select to authenticated
using (bucket_id = 'article-images' and exists (
  select 1 from public.articles a where a.id::text = split_part(objects.name, '/', 2)
    and a.website_id::text = split_part(objects.name, '/', 1) and public.can_access_website(a.website_id)
));

create policy "article images: members upload files" on storage.objects for insert to authenticated
with check (bucket_id = 'article-images'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$'
  and exists (
    select 1 from public.articles a where a.id::text = split_part(objects.name, '/', 2)
      and a.website_id::text = split_part(objects.name, '/', 1) and public.can_access_website(a.website_id)
  ));

create policy "article images: members delete files" on storage.objects for delete to authenticated
using (bucket_id = 'article-images' and exists (
  select 1 from public.articles a where a.id::text = split_part(objects.name, '/', 2)
    and a.website_id::text = split_part(objects.name, '/', 1) and public.can_access_website(a.website_id)
));
