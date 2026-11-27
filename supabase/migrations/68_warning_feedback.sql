-- A reviewer's verdict on one draft warning: a false alarm, or a real problem. It does not change what
-- the warning blocks (auto-publish still waits for review); it builds the checker's regression set.
-- snapshot holds the article and source pages the warning came from, because a re-check replaces them.
-- Written only by the server action after its permission check; members read their websites' rows.

create table public.warning_feedback (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  article_id uuid references public.articles (id) on delete set null,
  warning text not null check (char_length(warning) between 1 and 4000),
  check_name text not null check (char_length(check_name) between 1 and 200),
  verdict text not null check (verdict in ('false_alarm', 'real_problem')),
  note text check (char_length(note) <= 500),
  -- { article, evidence, language, kind, today, reproduces }: reproduces is false when the text checks
  -- no longer give this warning for the snapshot (the article was edited after its last check).
  snapshot jsonb not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, warning)
);

create index warning_feedback_created_idx on public.warning_feedback (created_at desc);

create trigger warning_feedback_updated_at before update on public.warning_feedback
  for each row execute function public.set_updated_at();

alter table public.warning_feedback enable row level security;

create policy "warning_feedback: members read" on public.warning_feedback
  for select to authenticated using (public.can_access_website(website_id));

revoke all on public.warning_feedback from anon, authenticated;
grant select (id, website_id, job_id, article_id, warning, check_name, verdict, note, created_by, created_at, updated_at)
  on public.warning_feedback to authenticated;
grant all on public.warning_feedback to service_role;
