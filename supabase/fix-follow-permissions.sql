-- WorldConnect follow permissions repair
-- Safe to re-run. Preserves all existing follow relationships.
-- RLS remains enabled; signed-in users can only create/remove their own follows.

begin;

grant usage on schema public to anon, authenticated;
grant select on table public.wc_profiles to anon, authenticated;
grant select, insert, delete on table public.wc_follows to authenticated;
grant select on table public.wc_follows to anon;

alter table public.wc_follows enable row level security;

drop policy if exists "Follows are viewable by everyone" on public.wc_follows;
create policy "Follows are viewable by everyone"
  on public.wc_follows
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Users manage own follows" on public.wc_follows;
create policy "Users manage own follows"
  on public.wc_follows
  for all
  to authenticated
  using (auth.uid() = follower_id)
  with check (
    auth.uid() = follower_id
    and follower_id <> following_id
  );

commit;

-- Verify after running:
-- select has_table_privilege('authenticated', 'public.wc_follows', 'select') as can_select,
--        has_table_privilege('authenticated', 'public.wc_follows', 'insert') as can_insert,
--        has_table_privilege('authenticated', 'public.wc_follows', 'delete') as can_delete;
-- select policyname, cmd, roles
-- from pg_policies
-- where schemaname = 'public' and tablename = 'wc_follows'
-- order by policyname;
