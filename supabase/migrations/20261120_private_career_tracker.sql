-- Private, single-account career tracker for the WorldConnect owner.
-- Existing WorldConnect job discovery and member data remain unchanged.

alter table public.wc_job_applications
  alter column job_external_id drop not null,
  add column if not exists company_name text not null default '',
  add column if not exists job_title text not null default '',
  add column if not exists location text not null default '',
  add column if not exists application_url text not null default '',
  add column if not exists reminder_email text not null default 'narsingbeesetti006@gmail.com';

update public.wc_job_applications a
set company_name = coalesce(nullif(a.company_name, ''), j.company, ''),
    job_title = coalesce(nullif(a.job_title, ''), j.title, ''),
    location = coalesce(nullif(a.location, ''), j.location, '')
from public.wc_jobs j
where a.job_external_id = j.external_id;

alter table public.wc_job_applications
  drop constraint if exists wc_job_applications_status_check;
alter table public.wc_job_applications
  add constraint wc_job_applications_status_check
  check (status in ('saved','applied','assessment','interview','selected','offer','rejected','withdrawn'));

-- The tracker is owner-only at the database boundary, not merely hidden in the UI.
drop policy if exists "Members view own job applications" on public.wc_job_applications;
drop policy if exists "Members create own job applications" on public.wc_job_applications;
drop policy if exists "Members update own job applications" on public.wc_job_applications;
drop policy if exists "Members delete own job applications" on public.wc_job_applications;

create policy "Career owner reads private applications"
  on public.wc_job_applications for select to authenticated
  using (auth.uid() = user_id
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'narsingbeesetti006@gmail.com');

create policy "Career owner creates private applications"
  on public.wc_job_applications for insert to authenticated
  with check (auth.uid() = user_id
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'narsingbeesetti006@gmail.com');

create policy "Career owner updates private applications"
  on public.wc_job_applications for update to authenticated
  using (auth.uid() = user_id
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'narsingbeesetti006@gmail.com')
  with check (auth.uid() = user_id
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'narsingbeesetti006@gmail.com');

create policy "Career owner deletes private applications"
  on public.wc_job_applications for delete to authenticated
  using (auth.uid() = user_id
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'narsingbeesetti006@gmail.com');

create index if not exists wc_job_applications_owner_created_idx
  on public.wc_job_applications(user_id, created_at desc);
