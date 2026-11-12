-- Safe, repeatable chat upgrade. This never deletes existing messages or files.
begin;

alter table public.wc_messages
  add column if not exists attachment_url text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text;

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
