-- Public branding assets only; upload and delete require an administrator and a website folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('website-logos', 'website-logos', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects already has RLS and Storage API grants supplied by Supabase.
-- Do not change the shared table's grants or policies for unrelated buckets.
create policy "website logos: members read" on storage.objects for select to authenticated
using (bucket_id = 'website-logos' and exists (
  select 1 from public.websites w where w.id::text = split_part(objects.name, '/', 1) and public.can_access_website(w.id)
));

create policy "website logos: admin uploads" on storage.objects for insert to authenticated
with check (bucket_id = 'website-logos' and (select public.is_admin())
  and name ~ '^[0-9a-f-]{36}/logo-[0-9a-f-]{36}\.(png|jpg|webp)$'
  and exists (select 1 from public.websites w where w.id::text = split_part(objects.name, '/', 1)));

create policy "website logos: admin deletes" on storage.objects for delete to authenticated
using (bucket_id = 'website-logos' and (select public.is_admin())
  and exists (select 1 from public.websites w where w.id::text = split_part(objects.name, '/', 1)));
