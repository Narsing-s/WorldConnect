-- WorldConnect post publishing repair
-- Run once in Supabase SQL Editor. Safe to re-run; does not delete member content.

begin;

grant usage on schema public to anon, authenticated;
grant select on public.wc_profiles, public.wc_posts to anon, authenticated;
grant insert, update, delete on public.wc_posts to authenticated;
grant insert, update on public.wc_profiles to authenticated;

alter table public.wc_profiles enable row level security;
alter table public.wc_posts enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.wc_profiles;
create policy "Profiles are viewable by everyone"
  on public.wc_profiles for select to anon, authenticated using (true);

drop policy if exists "Users insert own profile" on public.wc_profiles;
create policy "Users insert own profile"
  on public.wc_profiles for insert to authenticated with check (auth.uid() = id);

drop policy if exists "Users update own profile" on public.wc_profiles;
create policy "Users update own profile"
  on public.wc_profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Posts are viewable by everyone" on public.wc_posts;
create policy "Posts are viewable by everyone"
  on public.wc_posts for select to anon, authenticated using (true);

drop policy if exists "Authenticated users create own posts" on public.wc_posts;
create policy "Authenticated users create own posts"
  on public.wc_posts for insert to authenticated with check (auth.uid() = author_id);

drop policy if exists "Authors update own posts" on public.wc_posts;
create policy "Authors update own posts"
  on public.wc_posts for update to authenticated
  using (auth.uid() = author_id) with check (auth.uid() = author_id);

drop policy if exists "Authors delete own posts" on public.wc_posts;
create policy "Authors delete own posts"
  on public.wc_posts for delete to authenticated using (auth.uid() = author_id);

-- Ensure the media bucket is present and matches the formats accepted by the app.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'worldconnect-media', 'worldconnect-media', true, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']
)
on conflict (id) do update
set public = true,
    file_size_limit = 52428800,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "WorldConnect media is publicly readable" on storage.objects;
create policy "WorldConnect media is publicly readable"
  on storage.objects for select using (bucket_id = 'worldconnect-media');

drop policy if exists "Users upload their own WorldConnect media" on storage.objects;
create policy "Users upload their own WorldConnect media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'worldconnect-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update their own WorldConnect media" on storage.objects;
create policy "Users update their own WorldConnect media"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'worldconnect-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'worldconnect-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete their own WorldConnect media" on storage.objects;
create policy "Users delete their own WorldConnect media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'worldconnect-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;

-- Quick verification after running:
-- select count(*) as profiles_without_auth_users
-- from public.wc_profiles p left join auth.users u on u.id = p.id
-- where u.id is null;
-- select count(*) as posts from public.wc_posts;
