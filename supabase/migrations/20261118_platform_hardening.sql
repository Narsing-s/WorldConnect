-- WorldConnect Phase 1 hardening: notification write scope and query indexes.
-- Additive and data-preserving. Apply once in Supabase SQL Editor after schema.sql.

-- Members may acknowledge their own notifications, but must not rewrite
-- notification identity, actor, content, type, or recipient fields.
revoke update on table public.wc_notifications from authenticated;
grant select on table public.wc_notifications to authenticated;
grant update (read_at) on table public.wc_notifications to authenticated;
revoke all on table public.wc_notifications from anon;

-- Keep the existing recipient-only RLS boundary for notification updates.
drop policy if exists "Users update their notifications" on public.wc_notifications;
create policy "Users update their notifications"
  on public.wc_notifications for update to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- Support the common feed, inbox, and conversation query patterns.
create index if not exists wc_notifications_recipient_unread_created_idx
  on public.wc_notifications (recipient_id, read_at, created_at desc);

create index if not exists wc_messages_conversation_created_idx
  on public.wc_messages (conversation_id, created_at desc);

create index if not exists wc_comments_post_created_idx
  on public.wc_comments (post_id, created_at asc);

create index if not exists wc_conversation_members_user_conversation_idx
  on public.wc_conversation_members (user_id, conversation_id);

create index if not exists wc_community_members_user_joined_idx
  on public.wc_community_members (user_id, joined_at desc);

create index if not exists wc_follows_following_follower_idx
  on public.wc_follows (following_id, follower_id);
