-- Make direct-message conversation creation safe to repeat.
-- Existing conversations and messages are preserved.
begin;

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

  -- Serialize attempts for this member pair to prevent duplicate direct chats.
  perform pg_advisory_xact_lock(
    hashtext(least(current_user_id::text, target_user::text) || ':' ||
             greatest(current_user_id::text, target_user::text))
  );

  select c.id
    into new_conversation
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

revoke all on function public.wc_start_conversation(uuid) from public;
grant execute on function public.wc_start_conversation(uuid) to authenticated;

commit;
