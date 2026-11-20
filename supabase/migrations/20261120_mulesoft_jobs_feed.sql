-- Dedicated MuleSoft openings feed. Separate from the general WorldConnect job catalogue.
create table if not exists public.wc_mulesoft_jobs (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  title text not null,
  company text not null default '',
  location text not null default 'Not specified',
  remote boolean not null default false,
  description text not null default '',
  application_url text not null,
  posted_at timestamptz,
  source text not null,
  tags text[] not null default '{}',
  salary text,
  experience text not null default 'Not stated',
  india_relevance text not null default 'India role'
    check (india_relevance in ('India role','Remote - India eligibility to verify')),
  status text not null default 'published' check (status in ('published','expired')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wc_mulesoft_jobs_status_posted_idx
  on public.wc_mulesoft_jobs(status, posted_at desc nulls last);
create index if not exists wc_mulesoft_jobs_company_idx
  on public.wc_mulesoft_jobs(company);

create table if not exists public.wc_mulesoft_job_sync_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('running','completed','failed')),
  imported_count integer not null default 0,
  added_count integer not null default 0,
  updated_count integer not null default 0,
  provider_errors jsonb not null default '[]'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.wc_mulesoft_jobs enable row level security;
alter table public.wc_mulesoft_job_sync_runs enable row level security;

drop policy if exists "Public can view published MuleSoft jobs" on public.wc_mulesoft_jobs;
create policy "Public can view published MuleSoft jobs"
  on public.wc_mulesoft_jobs for select to anon, authenticated
  using (status = 'published');

drop policy if exists "Public can view MuleSoft sync status" on public.wc_mulesoft_job_sync_runs;
create policy "Public can view MuleSoft sync status"
  on public.wc_mulesoft_job_sync_runs for select to anon, authenticated
  using (status = 'completed');

grant select on public.wc_mulesoft_jobs to anon, authenticated;
grant select on public.wc_mulesoft_job_sync_runs to anon, authenticated;
grant all privileges on public.wc_mulesoft_jobs to service_role;
grant all privileges on public.wc_mulesoft_job_sync_runs to service_role;
revoke insert, update, delete, truncate, references, trigger on public.wc_mulesoft_jobs from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.wc_mulesoft_job_sync_runs from anon, authenticated;

create or replace function public.wc_mulesoft_jobs_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wc_mulesoft_jobs_updated_at on public.wc_mulesoft_jobs;
create trigger wc_mulesoft_jobs_updated_at
  before update on public.wc_mulesoft_jobs
  for each row execute function public.wc_mulesoft_jobs_touch_updated_at();
