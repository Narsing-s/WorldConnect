-- Safe, repeatable chat upgrade. This never deletes existing messages or files.
begin;

alter table public.wc_messages
  add column if not exists attachment_url text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text;

-- Per-user read cursor: unread means messages from the other member after this time.
alter table public.wc_conversation_members
  add column if not exists last_read_at timestamptz;

drop policy if exists "Users update their own conversation read cursor" on public.wc_conversation_members;
create policy "Users update their own conversation read cursor"
  on public.wc_conversation_members for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Supports fast chronological paging even for very large conversations.
create index if not exists wc_messages_conversation_history_idx
  on public.wc_messages (conversation_id, created_at desc, id desc);

-- Enable live incoming messages when the Supabase Realtime publication is available.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'wc_messages'
     ) then
    alter publication supabase_realtime add table public.wc_messages;
  end if;
end
$$;

commit;
