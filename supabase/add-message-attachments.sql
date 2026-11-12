-- Enable image and video attachments in direct messages.
-- Existing messages are preserved; all new columns are nullable.
begin;

alter table public.wc_messages
  add column if not exists attachment_url text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text;

commit;
