-- WorldConnect starter schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.wc_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 30),
  display_name text not null default 'New member',
  bio text not null default '',
  avatar_url text,
  country text,
  created_at timestamptz not null default now()
);

create table if not exists public.wc_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.wc_profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.wc_post_likes (
  post_id uuid not null references public.wc_posts(id) on delete cascade,
  user_id uuid not null references public.wc_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.wc_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.wc_posts(id) on delete cascade,
  author_id uuid not null references public.wc_profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.wc_follows (
  follower_id uuid not null references public.wc_profiles(id) on delete cascade,
  following_id uuid not null references public.wc_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.wc_communities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  created_by uuid references public.wc_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.wc_community_members (
  community_id uuid not null references public.wc_communities(id) on delete cascade,
  user_id uuid not null references public.wc_profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

alter table public.wc_profiles enable row level security;
alter table public.wc_posts enable row level security;
alter table public.wc_post_likes enable row level security;
alter table public.wc_comments enable row level security;
alter table public.wc_follows enable row level security;
alter table public.wc_communities enable row level security;
alter table public.wc_community_members enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.wc_profiles;
create policy "Profiles are viewable by everyone" on public.wc_profiles for select using (true);
drop policy if exists "Users insert own profile" on public.wc_profiles;
create policy "Users insert own profile" on public.wc_profiles for insert with check (auth.uid() = id);
drop policy if exists "Users update own profile" on public.wc_profiles;
create policy "Users update own profile" on public.wc_profiles for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "Posts are viewable by everyone" on public.wc_posts;
create policy "Posts are viewable by everyone" on public.wc_posts for select using (true);
drop policy if exists "Authenticated users create own posts" on public.wc_posts;
create policy "Authenticated users create own posts" on public.wc_posts for insert to authenticated with check (auth.uid() = author_id);
drop policy if exists "Authors update own posts" on public.wc_posts;
create policy "Authors update own posts" on public.wc_posts for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);
drop policy if exists "Authors delete own posts" on public.wc_posts;
create policy "Authors delete own posts" on public.wc_posts for delete to authenticated using (auth.uid() = author_id);
drop policy if exists "Likes are viewable by everyone" on public.wc_post_likes;
create policy "Likes are viewable by everyone" on public.wc_post_likes for select using (true);
drop policy if exists "Users manage own likes" on public.wc_post_likes;
create policy "Users manage own likes" on public.wc_post_likes for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Comments are viewable by everyone" on public.wc_comments;
create policy "Comments are viewable by everyone" on public.wc_comments for select using (true);
drop policy if exists "Users create own comments" on public.wc_comments;
create policy "Users create own comments" on public.wc_comments for insert to authenticated with check (auth.uid() = author_id);
drop policy if exists "Users manage own comments" on public.wc_comments;
create policy "Users manage own comments" on public.wc_comments for delete to authenticated using (auth.uid() = author_id);
drop policy if exists "Follows are viewable by everyone" on public.wc_follows;
create policy "Follows are viewable by everyone" on public.wc_follows for select using (true);
drop policy if exists "Users manage own follows" on public.wc_follows;
create policy "Users manage own follows" on public.wc_follows for all to authenticated using (auth.uid() = follower_id) with check (auth.uid() = follower_id);
drop policy if exists "Communities are viewable by everyone" on public.wc_communities;
create policy "Communities are viewable by everyone" on public.wc_communities for select using (true);
drop policy if exists "Authenticated users create communities" on public.wc_communities;
create policy "Authenticated users create communities" on public.wc_communities for insert to authenticated with check (auth.uid() = created_by);
drop policy if exists "Memberships are viewable by everyone" on public.wc_community_members;
create policy "Memberships are viewable by everyone" on public.wc_community_members for select using (true);
drop policy if exists "Users manage own memberships" on public.wc_community_members;
create policy "Users manage own memberships" on public.wc_community_members for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Do not add a service-role key to client-side environment variables.


-- Automatically provision a public profile when a user signs up.
-- Preserve the requested username when available; add a stable suffix only on collision.
create or replace function public.wc_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
  final_username text;
  clean_display_name text;
begin
  base_username := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', 'member'), '[^a-z0-9_]', '', 'g'));
  if char_length(base_username) < 3 then
    base_username := 'member';
  end if;

  base_username := left(base_username, 30);
  clean_display_name := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), base_username);

  insert into public.wc_profiles (id, username, display_name)
  values (new.id, base_username, clean_display_name)
  on conflict do nothing;

  if not exists (select 1 from public.wc_profiles where id = new.id) then
    final_username := left(base_username, 21) || '_' || substr(replace(new.id::text, '-', ''), 1, 8);
    insert into public.wc_profiles (id, username, display_name)
    values (new.id, final_username, clean_display_name)
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists wc_on_auth_user_created on auth.users;
create trigger wc_on_auth_user_created
  after insert on auth.users
  for each row execute function public.wc_handle_new_user();


-- Durable social features used by the application.
alter table public.wc_posts add column if not exists video_url text;
alter table public.wc_posts add column if not exists updated_at timestamptz not null default now();

create table if not exists public.wc_saved_posts (
  user_id uuid not null references public.wc_profiles(id) on delete cascade,
  post_id uuid not null references public.wc_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.wc_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.wc_profiles(id) on delete cascade,
  actor_id uuid references public.wc_profiles(id) on delete set null,
  post_id uuid references public.wc_posts(id) on delete cascade,
  kind text not null check (kind in ('like','comment','follow','message')),
  message text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.wc_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table if not exists public.wc_conversation_members (
  conversation_id uuid not null references public.wc_conversations(id) on delete cascade,
  user_id uuid not null references public.wc_profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.wc_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.wc_conversations(id) on delete cascade,
  sender_id uuid not null references public.wc_profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

alter table public.wc_saved_posts enable row level security;
alter table public.wc_notifications enable row level security;
alter table public.wc_conversations enable row level security;
alter table public.wc_conversation_members enable row level security;
alter table public.wc_messages enable row level security;

drop policy if exists "Users manage their saved posts" on public.wc_saved_posts;
create policy "Users manage their saved posts" on public.wc_saved_posts for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users view their notifications" on public.wc_notifications;
create policy "Users view their notifications" on public.wc_notifications for select to authenticated
  using (auth.uid() = recipient_id);
drop policy if exists "Users update their notifications" on public.wc_notifications;
create policy "Users update their notifications" on public.wc_notifications for update to authenticated
  using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);

create or replace function public.wc_is_conversation_member(target_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.wc_conversation_members m
    where m.conversation_id = target_conversation and m.user_id = auth.uid()
  );
$;

drop policy if exists "Members view their conversations" on public.wc_conversations;
create policy "Members view their conversations" on public.wc_conversations for select to authenticated
  using (public.wc_is_conversation_member(id));
drop policy if exists "Members view conversation membership" on public.wc_conversation_members;
create policy "Members view conversation membership" on public.wc_conversation_members for select to authenticated
  using (public.wc_is_conversation_member(conversation_id));
drop policy if exists "Users create conversations" on public.wc_conversations;
create policy "Users create conversations" on public.wc_conversations for insert to authenticated with check (true);
drop policy if exists "Users add themselves to conversations" on public.wc_conversation_members;
create policy "Users add themselves to conversations" on public.wc_conversation_members for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Members read messages" on public.wc_messages;
create policy "Members read messages" on public.wc_messages for select to authenticated
  using (public.wc_is_conversation_member(wc_messages.conversation_id));
drop policy if exists "Members send messages" on public.wc_messages;
create policy "Members send messages" on public.wc_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.wc_is_conversation_member(wc_messages.conversation_id));

-- Public media bucket. Uploads are scoped to the authenticated user's folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('worldconnect-media', 'worldconnect-media', true, 52428800, array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = 52428800, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "WorldConnect media is publicly readable" on storage.objects;
create policy "WorldConnect media is publicly readable" on storage.objects for select
  using (bucket_id = 'worldconnect-media');
drop policy if exists "Users upload their own WorldConnect media" on storage.objects;
create policy "Users upload their own WorldConnect media" on storage.objects for insert to authenticated
  with check (bucket_id = 'worldconnect-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users update their own WorldConnect media" on storage.objects;
create policy "Users update their own WorldConnect media" on storage.objects for update to authenticated
  using (bucket_id = 'worldconnect-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'worldconnect-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users delete their own WorldConnect media" on storage.objects;
create policy "Users delete their own WorldConnect media" on storage.objects for delete to authenticated
  using (bucket_id = 'worldconnect-media' and (storage.foldername(name))[1] = auth.uid()::text);


create table if not exists public.wc_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.wc_profiles(id) on delete cascade,
  post_id uuid not null references public.wc_posts(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now(),
  unique (reporter_id, post_id)
);
alter table public.wc_reports enable row level security;
drop policy if exists "Users create reports" on public.wc_reports;
create policy "Users create reports" on public.wc_reports for insert to authenticated
  with check (reporter_id = auth.uid());
drop policy if exists "Users view own reports" on public.wc_reports;
create policy "Users view own reports" on public.wc_reports for select to authenticated
  using (reporter_id = auth.uid());


create table if not exists public.wc_opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 10 and 3000),
  opportunity_type text not null default 'Other',
  location text not null default 'Remote',
  application_url text,
  created_by uuid not null references public.wc_profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.wc_opportunities enable row level security;
drop policy if exists "Opportunities are public" on public.wc_opportunities;
create policy "Opportunities are public" on public.wc_opportunities for select using (true);
drop policy if exists "Members publish opportunities" on public.wc_opportunities;
create policy "Members publish opportunities" on public.wc_opportunities for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "Authors manage opportunities" on public.wc_opportunities;
create policy "Authors manage opportunities" on public.wc_opportunities for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
drop policy if exists "Authors delete opportunities" on public.wc_opportunities;
create policy "Authors delete opportunities" on public.wc_opportunities for delete to authenticated using (created_by = auth.uid());
