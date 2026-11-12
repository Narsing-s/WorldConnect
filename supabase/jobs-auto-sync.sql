-- WorldConnect automatic external job publishing. Run once in Supabase SQL Editor.
create table if not exists public.wc_jobs (
 id uuid primary key default gen_random_uuid(), external_id text not null unique, title text not null,
 company text not null default '', location text not null default 'Not specified', remote boolean not null default false,
 description text not null default '', application_url text not null, posted_at timestamptz, source text not null,
 tags text[] not null default '{}', salary text, status text not null default 'published' check(status in('published','expired')),
 last_seen_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists wc_jobs_status_posted_idx on public.wc_jobs(status,posted_at desc);
create index if not exists wc_jobs_source_idx on public.wc_jobs(source);
alter table public.wc_jobs enable row level security;
drop policy if exists "Published jobs are public" on public.wc_jobs;
create policy "Published jobs are public" on public.wc_jobs for select using(status='published');
create table if not exists public.wc_job_sync_runs (
 id uuid primary key default gen_random_uuid(), status text not null check(status in('running','completed','failed')),
 started_at timestamptz not null default now(), completed_at timestamptz, imported_count integer not null default 0,
 provider_errors text[] not null default '{}', error text
);
alter table public.wc_job_sync_runs enable row level security;
drop policy if exists "Completed job sync status is public" on public.wc_job_sync_runs;
create policy "Completed job sync status is public" on public.wc_job_sync_runs for select using(status='completed');
create or replace function public.wc_jobs_touch_updated_at() returns trigger language plpgsql set search_path=public as $$
begin new.updated_at=now();return new;end;$$;
drop trigger if exists wc_jobs_updated_at on public.wc_jobs;
create trigger wc_jobs_updated_at before update on public.wc_jobs for each row execute function public.wc_jobs_touch_updated_at();
-- Import/update permissions are restricted to server-side service-role access. Never expose the service-role key to browsers.
