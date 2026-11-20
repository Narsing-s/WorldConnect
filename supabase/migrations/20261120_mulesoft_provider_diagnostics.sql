-- Store structured per-provider discovery health for the dedicated MuleSoft feed.
alter table public.wc_mulesoft_job_sync_runs
  add column if not exists provider_diagnostics jsonb not null default '[]'::jsonb;
