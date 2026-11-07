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


-- Automatically provision a public profile when a user confirms/signs up.
create or replace function public.wc_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
begin
  base_username := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', 'member'), '[^a-z0-9_]', '', 'g'));
  if char_length(base_username) < 3 then
    base_username := 'member';
  end if;

  insert into public.wc_profiles (id, username, display_name)
  values (
    new.id,
    left(base_username, 21) || '_' || substr(replace(new.id::text, '-', ''), 1, 8),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), base_username)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists wc_on_auth_user_created on auth.users;
create trigger wc_on_auth_user_created
  after insert on auth.users
  for each row execute function public.wc_handle_new_user();
