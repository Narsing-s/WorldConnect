-- Private storage for new chat attachments.
-- Existing public media URLs remain valid; no old objects or database rows are changed.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('worldconnect-private-media', 'worldconnect-private-media', false, 52428800, array['image/*','video/*'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

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
    )
  );

commit;
