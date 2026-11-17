-- Enforce member blocks at the database boundary across social discovery and interaction.
-- Additive and data-preserving: existing posts, messages, follows and media are not deleted.
begin;

create or replace function public.wc_is_blocked_between(user_a uuid, user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select user_a is not null
     and user_b is not null
     and user_a <> user_b
     and exists (
       select 1
       from public.wc_user_blocks b
       where (b.blocker_id = user_a and b.blocked_user_id = user_b)
          or (b.blocker_id = user_b and b.blocked_user_id = user_a)
     );
$$;

revoke all on function public.wc_is_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.wc_is_blocked_between(uuid, uuid) to authenticated;

-- Profiles, feed posts, and public opportunities are hidden from either side
-- of a block for signed-in viewers. Anonymous public browsing is unchanged.
drop policy if exists "Profiles are viewable by everyone" on public.wc_profiles;
create policy "Profiles are viewable by everyone"
  on public.wc_profiles for select
  using (
    auth.uid() is null
    or id = auth.uid()
    or not public.wc_is_blocked_between(auth.uid(), id)
  );

drop policy if exists "Posts are viewable by everyone" on public.wc_posts;
create policy "Posts are viewable by everyone"
  on public.wc_posts for select
  using (
    auth.uid() is null
    or author_id = auth.uid()
    or not public.wc_is_blocked_between(auth.uid(), author_id)
  );

drop policy if exists "Opportunities are public" on public.wc_opportunities;
create policy "Opportunities are public"
  on public.wc_opportunities for select
  using (
    auth.uid() is null
    or created_by = auth.uid()
    or not public.wc_is_blocked_between(auth.uid(), created_by)
  );

-- A blocked member's comments and reactions are not exposed to the viewer.
drop policy if exists "Comments are viewable by everyone" on public.wc_comments;
create policy "Comments are viewable by everyone"
  on public.wc_comments for select
  using (
    auth.uid() is null
    or author_id = auth.uid()
    or not public.wc_is_blocked_between(auth.uid(), author_id)
  );

drop policy if exists "Users create own comments" on public.wc_comments;
create policy "Users create own comments"
  on public.wc_comments for insert to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.wc_posts p
      where p.id = post_id
        and not public.wc_is_blocked_between(auth.uid(), p.author_id)
    )
  );

drop policy if exists "Likes are viewable by everyone" on public.wc_post_likes;
create policy "Likes are viewable by everyone"
  on public.wc_post_likes for select
  using (
    auth.uid() is null
    or user_id = auth.uid()
    or not public.wc_is_blocked_between(auth.uid(), user_id)
  );

drop policy if exists "Users manage own likes" on public.wc_post_likes;
create policy "Users manage own likes"
  on public.wc_post_likes for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.wc_posts p
      where p.id = post_id
        and not public.wc_is_blocked_between(auth.uid(), p.author_id)
    )
  );

-- A block removes both directions of a follow from each other's view and
-- prevents either side from creating a new follow edge.
drop policy if exists "Follows are viewable by everyone" on public.wc_follows;
create policy "Follows are viewable by everyone"
  on public.wc_follows for select
  using (
    auth.uid() is null
    or (
      not public.wc_is_blocked_between(auth.uid(), follower_id)
      and not public.wc_is_blocked_between(auth.uid(), following_id)
    )
  );

drop policy if exists "Users manage own follows" on public.wc_follows;
create policy "Users manage own follows"
  on public.wc_follows for all to authenticated
  using (auth.uid() = follower_id)
  with check (
    auth.uid() = follower_id
    and not public.wc_is_blocked_between(follower_id, following_id)
  );

-- Communities remain discoverable, but a blocked creator/member is omitted
-- from authenticated community queries and member-count embeds.
drop policy if exists "Communities are viewable by everyone" on public.wc_communities;
create policy "Communities are viewable by everyone"
  on public.wc_communities for select
  using (
    auth.uid() is null
    or created_by is null
    or created_by = auth.uid()
    or not public.wc_is_blocked_between(auth.uid(), created_by)
  );

drop policy if exists "Memberships are viewable by everyone" on public.wc_community_members;
create policy "Memberships are viewable by everyone"
  on public.wc_community_members for select
  using (
    auth.uid() is null
    or user_id = auth.uid()
    or not public.wc_is_blocked_between(auth.uid(), user_id)
  );

-- Conversation membership becomes inaccessible to both sides as soon as
-- either side blocks the other. This is used by conversation, membership,
-- message and private-storage RLS policies.
create or replace function public.wc_is_conversation_member(target_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.wc_conversation_members mine
    where mine.conversation_id = target_conversation
      and mine.user_id = auth.uid()
  )
  and not exists (
    select 1
    from public.wc_conversation_members other_member
    where other_member.conversation_id = target_conversation
      and other_member.user_id <> auth.uid()
      and public.wc_is_blocked_between(auth.uid(), other_member.user_id)
  );
$$;

revoke all on function public.wc_is_conversation_member(uuid) from public, anon;
grant execute on function public.wc_is_conversation_member(uuid) to authenticated;

-- A direct chat cannot be created or reopened across a block.
create or replace function public.wc_start_conversation(target_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_conversation uuid;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if target_user is null or target_user = current_user_id then
    raise exception 'Choose another member';
  end if;
  if not exists (select 1 from public.wc_profiles p where p.id = target_user) then
    raise exception 'Member not found';
  end if;
  if public.wc_is_blocked_between(current_user_id, target_user) then
    raise exception 'This conversation is unavailable because one member has blocked the other';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(least(current_user_id::text, target_user::text) || ':' ||
             greatest(current_user_id::text, target_user::text))
  );

  select c.id into new_conversation
  from public.wc_conversations c
  where exists (
      select 1 from public.wc_conversation_members m
      where m.conversation_id = c.id and m.user_id = current_user_id
    )
    and exists (
      select 1 from public.wc_conversation_members m
      where m.conversation_id = c.id and m.user_id = target_user
    )
    and (
      select count(*) from public.wc_conversation_members m
      where m.conversation_id = c.id
    ) = 2
  order by c.created_at desc
  limit 1;

  if new_conversation is not null then
    return new_conversation;
  end if;

  insert into public.wc_conversations default values returning id into new_conversation;
  insert into public.wc_conversation_members (conversation_id, user_id)
  values (new_conversation, current_user_id), (new_conversation, target_user);
  return new_conversation;
end;
$$;

revoke all on function public.wc_start_conversation(uuid) from public, anon;
grant execute on function public.wc_start_conversation(uuid) to authenticated;

-- Existing notifications from a blocked actor are hidden. New activity
-- notifications are suppressed at the trigger boundary as well.
drop policy if exists "Users view their notifications" on public.wc_notifications;
create policy "Users view their notifications"
  on public.wc_notifications for select to authenticated
  using (
    auth.uid() = recipient_id
    and (
      actor_id is null
      or not public.wc_is_blocked_between(auth.uid(), actor_id)
    )
  );

create or replace function public.wc_create_activity_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
  actor uuid;
  related_post uuid;
  notification_kind text;
  notification_text text;
begin
  if tg_table_name = 'wc_post_likes' then
    actor := new.user_id;
    related_post := new.post_id;
    notification_kind := 'like';
    notification_text := 'appreciated your post';
  elsif tg_table_name = 'wc_comments' then
    actor := new.author_id;
    related_post := new.post_id;
    notification_kind := 'comment';
    notification_text := 'commented on your post';
  elsif tg_table_name = 'wc_follows' then
    actor := new.follower_id;
    recipient := new.following_id;
    notification_kind := 'follow';
    notification_text := 'started following you';
  end if;

  if recipient is null then
    select p.author_id into recipient
    from public.wc_posts p
    where p.id = related_post;
  end if;

  if recipient is not null
     and recipient <> actor
     and not public.wc_is_blocked_between(recipient, actor) then
    insert into public.wc_notifications (recipient_id, actor_id, post_id, kind, message)
    values (recipient, actor, related_post, notification_kind, notification_text);
  end if;
  return new;
end;
$$;

create or replace function public.wc_notify_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.wc_notifications (recipient_id, actor_id, kind, message)
  select m.user_id, new.sender_id, 'message', 'sent you a message'
  from public.wc_conversation_members m
  where m.conversation_id = new.conversation_id
    and m.user_id <> new.sender_id
    and not public.wc_is_blocked_between(m.user_id, new.sender_id);
  return new;
end;
$$;

-- Private chat attachments inherit the same block-aware conversation boundary.
drop policy if exists "Conversation members upload private chat files" on storage.objects;
create policy "Conversation members upload private chat files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'worldconnect-private-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] = 'messages'
    and exists (
      select 1 from public.wc_conversation_members cm
      where cm.conversation_id::text = (storage.foldername(name))[3]
        and cm.user_id = auth.uid()
        and public.wc_is_conversation_member(cm.conversation_id)
    )
  );

drop policy if exists "Conversation members read private chat files" on storage.objects;
create policy "Conversation members read private chat files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'worldconnect-private-media'
    and (storage.foldername(name))[2] = 'messages'
    and exists (
      select 1 from public.wc_conversation_members cm
      where cm.conversation_id::text = (storage.foldername(name))[3]
        and cm.user_id = auth.uid()
        and public.wc_is_conversation_member(cm.conversation_id)
    )
  );

commit;
