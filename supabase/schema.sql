-- WorldConnect starter schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 30),
  display_name text not null default 'New member',
  bio text not null default '',
  avatar_url text,
  country text,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "Posts are viewable by everyone" on public.posts;
create policy "Posts are viewable by everyone" on public.posts for select using (true);
drop policy if exists "Authenticated users create own posts" on public.posts;
create policy "Authenticated users create own posts" on public.posts for insert to authenticated with check (auth.uid() = author_id);
drop policy if exists "Authors update own posts" on public.posts;
create policy "Authors update own posts" on public.posts for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);
drop policy if exists "Authors delete own posts" on public.posts;
create policy "Authors delete own posts" on public.posts for delete to authenticated using (auth.uid() = author_id);
drop policy if exists "Likes are viewable by everyone" on public.post_likes;
create policy "Likes are viewable by everyone" on public.post_likes for select using (true);
drop policy if exists "Users manage own likes" on public.post_likes;
create policy "Users manage own likes" on public.post_likes for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Comments are viewable by everyone" on public.comments;
create policy "Comments are viewable by everyone" on public.comments for select using (true);
drop policy if exists "Users create own comments" on public.comments;
create policy "Users create own comments" on public.comments for insert to authenticated with check (auth.uid() = author_id);
drop policy if exists "Users manage own comments" on public.comments;
create policy "Users manage own comments" on public.comments for delete to authenticated using (auth.uid() = author_id);
drop policy if exists "Follows are viewable by everyone" on public.follows;
create policy "Follows are viewable by everyone" on public.follows for select using (true);
drop policy if exists "Users manage own follows" on public.follows;
create policy "Users manage own follows" on public.follows for all to authenticated using (auth.uid() = follower_id) with check (auth.uid() = follower_id);
drop policy if exists "Communities are viewable by everyone" on public.communities;
create policy "Communities are viewable by everyone" on public.communities for select using (true);
drop policy if exists "Authenticated users create communities" on public.communities;
create policy "Authenticated users create communities" on public.communities for insert to authenticated with check (auth.uid() = created_by);
drop policy if exists "Memberships are viewable by everyone" on public.community_members;
create policy "Memberships are viewable by everyone" on public.community_members for select using (true);
drop policy if exists "Users manage own memberships" on public.community_members;
create policy "Users manage own memberships" on public.community_members for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Do not add a service-role key to client-side environment variables.
