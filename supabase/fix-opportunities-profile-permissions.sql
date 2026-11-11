-- Repair the Community Board author lookup permissions.
-- Run this once in Supabase Dashboard -> SQL Editor.
-- RLS remains enabled; this grants read-only access to public profile fields.
grant usage on schema public to anon, authenticated;
grant select on table public.wc_profiles to anon, authenticated;
grant select on table public.wc_opportunities to anon, authenticated;
grant insert, update, delete on table public.wc_opportunities to authenticated;

alter table public.wc_profiles enable row level security;
drop policy if exists "Profiles are viewable by everyone" on public.wc_profiles;
create policy "Profiles are viewable by everyone"
  on public.wc_profiles
  for select
  to anon, authenticated
  using (true);

alter table public.wc_opportunities enable row level security;
drop policy if exists "Opportunities are public" on public.wc_opportunities;
create policy "Opportunities are public"
  on public.wc_opportunities
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Members publish opportunities" on public.wc_opportunities;
create policy "Members publish opportunities"
  on public.wc_opportunities
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "Authors manage opportunities" on public.wc_opportunities;
create policy "Authors manage opportunities"
  on public.wc_opportunities
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "Authors delete opportunities" on public.wc_opportunities;
create policy "Authors delete opportunities"
  on public.wc_opportunities
  for delete
  to authenticated
  using (created_by = auth.uid());
