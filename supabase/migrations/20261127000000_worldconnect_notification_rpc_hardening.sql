-- Restore missing social activity notification triggers and close direct RPC access
-- to trigger-only SECURITY DEFINER functions.
--
-- Apply after 20261127_mentorship_marketplace.sql. This migration is additive:
-- it does not alter or delete member content, accounts, or existing messages.

begin;

-- The live database audit found that the notification function existed but
-- these three triggers were absent. Recreate them idempotently so likes,
-- comments, and follows generate notifications again.
drop trigger if exists wc_notify_post_like on public.wc_post_likes;
create trigger wc_notify_post_like
  after insert on public.wc_post_likes
  for each row execute function public.wc_create_activity_notification();

drop trigger if exists wc_notify_comment on public.wc_comments;
create trigger wc_notify_comment
  after insert on public.wc_comments
  for each row execute function public.wc_create_activity_notification();

drop trigger if exists wc_notify_follow on public.wc_follows;
create trigger wc_notify_follow
  after insert on public.wc_follows
  for each row execute function public.wc_create_activity_notification();

-- Trigger functions are invoked by PostgreSQL's trigger manager; they are not
-- application RPC endpoints. Remove direct EXECUTE grants from API roles.
revoke all on function public.wc_create_activity_notification()
  from public, anon, authenticated;
revoke all on function public.wc_handle_new_user()
  from public, anon, authenticated;
revoke all on function public.wc_log_content_report_event()
  from public, anon, authenticated;
revoke all on function public.wc_notify_message()
  from public, anon, authenticated;

-- wc_is_blocked_between is intentionally retained for RLS evaluation on
-- public-readable rows. It returns false when auth.uid() is null and checks
-- only relationships involving the authenticated caller. Keep this helper's
-- existing anon/authenticated grants until policies are split by database role;
-- revoking anon here can break planning of anonymous SELECT policies.

commit;
