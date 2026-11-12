-- WorldConnect social feed + interaction repair
-- Run once in Supabase SQL Editor. Safe to re-run; preserves all existing posts,
-- likes and comments. This does not disable RLS or grant public write access.

begin;

grant usage on schema public to anon, authenticated;

-- Public members can read posts, profiles, likes and comments.
grant select on table
  public.wc_profiles,
  public.wc_posts,
  public.wc_post_likes,
  public.wc_comments
to anon, authenticated;

-- Only signed-in users can create their own posts and interactions.
grant insert, update, delete on table public.wc_posts to authenticated;
grant insert, delete on table public.wc_post_likes to authenticated;
grant insert, delete on table public.wc_comments to authenticated;

alter table public.wc_profiles enable row level security;
alter table public.wc_posts enable row level security;
alter table public.wc_post_likes enable row level security;
alter table public.wc_comments enable row level security;

-- Profiles
drop policy if exists "Profiles are viewable by everyone" on public.wc_profiles;
create policy "Profiles are viewable by everyone"
  on public.wc_profiles for select to anon, authenticated
  using (true);

-- Posts
drop policy if exists "Posts are viewable by everyone" on public.wc_posts;
create policy "Posts are viewable by everyone"
  on public.wc_posts for select to anon, authenticated
  using (true);

drop policy if exists "Authenticated users create own posts" on public.wc_posts;
create policy "Authenticated users create own posts"
  on public.wc_posts for insert to authenticated
  with check (auth.uid() = author_id);

drop policy if exists "Authors update own posts" on public.wc_posts;
create policy "Authors update own posts"
  on public.wc_posts for update to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "Authors delete own posts" on public.wc_posts;
create policy "Authors delete own posts"
  on public.wc_posts for delete to authenticated
  using (auth.uid() = author_id);

-- Likes: readable by everyone; each member can add/remove only their own like.
drop policy if exists "Likes are viewable by everyone" on public.wc_post_likes;
create policy "Likes are viewable by everyone"
  on public.wc_post_likes for select to anon, authenticated
  using (true);

drop policy if exists "Users manage own likes" on public.wc_post_likes;
create policy "Users manage own likes"
  on public.wc_post_likes for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Comments: readable by everyone; signed-in members can add comments as themselves
-- and delete only comments they authored.
drop policy if exists "Comments are viewable by everyone" on public.wc_comments;
create policy "Comments are viewable by everyone"
  on public.wc_comments for select to anon, authenticated
  using (true);

drop policy if exists "Users create own comments" on public.wc_comments;
create policy "Users create own comments"
  on public.wc_comments for insert to authenticated
  with check (auth.uid() = author_id);

drop policy if exists "Users manage own comments" on public.wc_comments;
create policy "Users manage own comments"
  on public.wc_comments for delete to authenticated
  using (auth.uid() = author_id);

commit;

-- Verification (run separately after the migration):
-- select count(*) as posts from public.wc_posts;
-- select count(*) as likes from public.wc_post_likes;
-- select count(*) as comments from public.wc_comments;
-- select tablename, policyname, cmd, roles
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('wc_posts','wc_post_likes','wc_comments')
-- order by tablename, policyname;
