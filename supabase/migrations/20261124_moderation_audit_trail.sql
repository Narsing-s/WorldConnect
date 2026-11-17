-- Immutable audit trail for trust-and-safety report decisions.
begin;

create table if not exists public.wc_content_report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.wc_content_reports(id) on delete cascade,
  actor_id uuid references public.wc_profiles(id) on delete set null,
  previous_status text,
  new_status text not null check (new_status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists wc_content_report_events_report_created_idx
  on public.wc_content_report_events (report_id, created_at asc);

alter table public.wc_content_report_events enable row level security;

drop policy if exists "Trusted reviewers read report audit events" on public.wc_content_report_events;
create policy "Trusted reviewers read report audit events"
  on public.wc_content_report_events for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'worldconnect_role') = 'reviewer');

revoke all on public.wc_content_report_events from public, anon, authenticated;
grant select on public.wc_content_report_events to authenticated;

create or replace function public.wc_log_content_report_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.wc_content_report_events (report_id, actor_id, previous_status, new_status)
    values (new.id, new.reporter_id, null, new.status);
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public.wc_content_report_events (report_id, actor_id, previous_status, new_status)
    values (new.id, coalesce(auth.uid(), new.reviewer_id), old.status, new.status);
  end if;
  return new;
end;
$$;

drop trigger if exists wc_content_report_audit on public.wc_content_reports;
create trigger wc_content_report_audit
  after insert or update of status on public.wc_content_reports
  for each row execute function public.wc_log_content_report_event();

commit;
