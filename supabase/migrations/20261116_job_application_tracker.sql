-- WorldConnect job application tracker.
-- Apply once in Supabase SQL Editor. Existing jobs and member data are untouched.

create table if not exists public.wc_job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.wc_profiles(id) on delete cascade,
  job_external_id text not null references public.wc_jobs(external_id) on delete cascade,
  status text not null default 'saved'
    check (status in ('saved', 'applied', 'interview', 'offer', 'rejected', 'withdrawn')),
  notes text not null default '' check (char_length(notes) <= 4000),
  applied_at timestamptz,
  follow_up_at timestamptz,
  interview_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_external_id)
);

create index if not exists wc_job_applications_user_status_idx
  on public.wc_job_applications(user_id, status, updated_at desc);
create index if not exists wc_job_applications_follow_up_idx
  on public.wc_job_applications(user_id, follow_up_at)
  where follow_up_at is not null;

alter table public.wc_job_applications enable row level security;

drop policy if exists "Members view own job applications" on public.wc_job_applications;
create policy "Members view own job applications"
  on public.wc_job_applications for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Members create own job applications" on public.wc_job_applications;
create policy "Members create own job applications"
  on public.wc_job_applications for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Members update own job applications" on public.wc_job_applications;
create policy "Members update own job applications"
  on public.wc_job_applications for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Members delete own job applications" on public.wc_job_applications;
create policy "Members delete own job applications"
  on public.wc_job_applications for delete to authenticated
  using (auth.uid() = user_id);

create or replace function public.wc_job_applications_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wc_job_applications_updated_at on public.wc_job_applications;
create trigger wc_job_applications_updated_at
  before update on public.wc_job_applications
  for each row execute function public.wc_job_applications_touch_updated_at();

grant select, insert, update, delete on public.wc_job_applications to authenticated;
revoke all on public.wc_job_applications from anon;
