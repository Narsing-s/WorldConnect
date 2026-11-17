-- WorldConnect trust and safety foundation.
-- Additive: reports and member blocks do not alter existing posts, messages, or accounts.

begin;

create table if not exists public.wc_user_blocks (
  blocker_id uuid not null references public.wc_profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.wc_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_user_id),
  constraint wc_user_blocks_no_self check (blocker_id <> blocked_user_id)
);

create index if not exists wc_user_blocks_blocked_idx
  on public.wc_user_blocks (blocked_user_id, created_at desc);

alter table public.wc_user_blocks enable row level security;

drop policy if exists "Members read blocks they created" on public.wc_user_blocks;
create policy "Members read blocks they created"
  on public.wc_user_blocks for select to authenticated
  using (auth.uid() = blocker_id);

drop policy if exists "Members block other accounts" on public.wc_user_blocks;
create policy "Members block other accounts"
  on public.wc_user_blocks for insert to authenticated
  with check (auth.uid() = blocker_id and blocker_id <> blocked_user_id);

drop policy if exists "Members unblock accounts they blocked" on public.wc_user_blocks;
create policy "Members unblock accounts they blocked"
  on public.wc_user_blocks for delete to authenticated
  using (auth.uid() = blocker_id);

revoke all on public.wc_user_blocks from public, anon;
grant select, insert, delete on public.wc_user_blocks to authenticated;

create table if not exists public.wc_content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.wc_profiles(id) on delete cascade,
  target_type text not null check (target_type in ('profile','post','comment','message','job','community')),
  target_id text not null check (char_length(btrim(target_id)) between 1 and 160),
  reason text not null check (reason in ('spam','harassment','scam_or_fraud','misinformation','inappropriate_content','impersonation','other')),
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_id uuid references public.wc_profiles(id) on delete set null
);

create index if not exists wc_content_reports_reporter_created_idx
  on public.wc_content_reports (reporter_id, created_at desc);
create index if not exists wc_content_reports_review_queue_idx
  on public.wc_content_reports (status, created_at asc);

alter table public.wc_content_reports enable row level security;

drop policy if exists "Members submit reports about content" on public.wc_content_reports;
create policy "Members submit reports about content"
  on public.wc_content_reports for insert to authenticated
  with check (auth.uid() = reporter_id and status = 'open' and reviewer_id is null and reviewed_at is null);

drop policy if exists "Members view reports they submitted" on public.wc_content_reports;
create policy "Members view reports they submitted"
  on public.wc_content_reports for select to authenticated
  using (auth.uid() = reporter_id);

drop policy if exists "Trusted reviewers view reports" on public.wc_content_reports;
create policy "Trusted reviewers view reports"
  on public.wc_content_reports for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'worldconnect_role') = 'reviewer');

drop policy if exists "Trusted reviewers update reports" on public.wc_content_reports;
create policy "Trusted reviewers update reports"
  on public.wc_content_reports for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'worldconnect_role') = 'reviewer')
  with check ((auth.jwt() -> 'app_metadata' ->> 'worldconnect_role') = 'reviewer');

revoke all on public.wc_content_reports from public, anon;
grant select, insert on public.wc_content_reports to authenticated;
grant update (status, reviewed_at, reviewer_id) on public.wc_content_reports to authenticated;

commit;
