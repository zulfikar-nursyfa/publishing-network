-- Images for AI drafts. A new "illustrate" step (after verify) stores an AI image and, for sources
-- marked images_reusable, the story's own image. One becomes the featured image; the other is kept
-- as an "option" the editor can switch to. The step fixes the article id in job state so the
-- files can be stored under the article's folder before the article row exists.

alter table public.jobs drop constraint jobs_step_check;
alter table public.jobs add constraint jobs_step_check
  check (step in ('collect','research','draft','verify','illustrate','create_article'));

alter table public.ai_usage drop constraint ai_usage_operation_check;
alter table public.ai_usage add constraint ai_usage_operation_check
  check (operation in ('search','research','draft','verify','illustrate'));

alter table public.article_images drop constraint article_images_role_check;
alter table public.article_images add constraint article_images_role_check
  check (role in ('featured', 'inline', 'option'));

-- Same as 26, plus the article id and images from job state.
create or replace function public.complete_draft_job(target_job uuid, worker uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare j public.jobs; s public.story_candidates; draft jsonb; result uuid; ref jsonb; note text;
begin
  if not public.is_system_request() then raise exception 'Service only'; end if;
  select * into j from public.jobs where id = target_job for update;
  if j.status <> 'running' or j.locked_by is distinct from worker or j.locked_until <= now() or j.step <> 'create_article' then
    raise exception 'Draft lease lost';
  end if;
  if not exists (select 1 from public.websites w, public.network_settings n
    where w.id = j.website_id and w.archived_at is null and not w.automation_paused and w.automation_mode <> 'off' and not n.automation_paused) then
    raise exception 'Automation is paused or off';
  end if;
  select * into s from public.story_candidates where id = j.story_id for update;
  if s.status <> 'selected' then raise exception 'Story is no longer selected'; end if;
  draft = j.state->'draft';
  if draft is null or j.state->'verification' is null then raise exception 'Draft has not been verified'; end if;
  if exists (select 1 from public.articles where website_id = j.website_id and origin = 'automated'
    and story_fingerprint is distinct from s.fingerprint
    and lower(regexp_replace(trim(title), '[[:space:]]+', ' ', 'g')) = lower(regexp_replace(trim(draft->>'title'), '[[:space:]]+', ' ', 'g'))) then
    raise exception 'Another automated article already has this headline';
  end if;
  select 'AI draft. Human review is required; verify facts, dates, names and sources before approval.'
    || coalesce(E'\n\nCheck these warnings:\n- ' || string_agg(w, E'\n- '), '')
    into note from jsonb_array_elements_text(coalesce(j.state->'warnings', '[]'::jsonb)) w;
  insert into public.articles (id, website_id, origin, status, title, slug, excerpt, body, story_fingerprint,
    category_id, sensitive, submitted_at, review_note)
  values (coalesce((j.state->>'article_id')::uuid, gen_random_uuid()), j.website_id, 'automated', 'in_review',
    draft->>'title', draft->>'slug', draft->>'excerpt', draft->>'body', s.fingerprint,
    nullif(draft->>'category_id','')::uuid, coalesce((draft->>'sensitive')::boolean, true), now(), left(note, 4000))
  on conflict (website_id, story_fingerprint) where story_fingerprint is not null do nothing returning id into result;
  if result is null then
    select id into result from public.articles where website_id = j.website_id and story_fingerprint = s.fingerprint;
  else
    for ref in select value from jsonb_array_elements(coalesce(j.state->'sources','[]'::jsonb)) loop
      insert into public.article_sources (website_id, article_id, url, title, publisher)
        values (j.website_id, result, ref->>'url', ref->>'title', ref->>'publisher') on conflict (article_id,url) do nothing;
    end loop;
    for ref in select value from jsonb_array_elements(coalesce(j.state->'images','[]'::jsonb)) loop
      insert into public.article_images (article_id, website_id, role, storage_path, alt_text, credit, source_kind,
        source_url, license, ai_model, ai_prompt)
      values (result, j.website_id, ref->>'role', ref->>'storage_path', ref->>'alt_text', ref->>'credit',
        (ref->>'source_kind')::public.image_source_kind, ref->>'source_url', ref->>'license', ref->>'ai_model', ref->>'ai_prompt');
    end loop;
  end if;
  update public.story_candidates set status = 'used' where id = s.id;
  update public.jobs set status = 'succeeded', article_id = result, locked_by = null, locked_until = null, last_error = null where id = j.id;
  return result;
end;
$$;
