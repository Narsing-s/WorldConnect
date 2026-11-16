-- WorldConnect private candidate preferences for explainable job matching.
-- Additive only: existing profiles, jobs and applications remain unchanged.

create table if not exists public.wc_candidate_preferences (
  user_id uuid primary key references public.wc_profiles(id) on delete cascade,
  target_titles text[] not null default '{}',
  skills text[] not null default '{}',
  locations text[] not null default '{}',
  work_modes text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint wc_candidate_preferences_titles_limit check (cardinality(target_titles) <= 20),
  constraint wc_candidate_preferences_skills_limit check (cardinality(skills) <= 40),
  constraint wc_candidate_preferences_locations_limit check (cardinality(locations) <= 20),
  constraint wc_candidate_preferences_modes_limit check (cardinality(work_modes) <= 3)
);

alter table public.wc_candidate_preferences enable row level security;

drop policy if exists "Members view own candidate preferences" on public.wc_candidate_preferences;
create policy "Members view own candidate preferences"
  on public.wc_candidate_preferences for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Members create own candidate preferences" on public.wc_candidate_preferences;
create policy "Members create own candidate preferences"
  on public.wc_candidate_preferences for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Members update own candidate preferences" on public.wc_candidate_preferences;
create policy "Members update own candidate preferences"
  on public.wc_candidate_preferences for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.wc_candidate_preferences to authenticated;
revoke all on public.wc_candidate_preferences from anon;

create or replace function public.wc_candidate_preferences_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wc_candidate_preferences_updated_at on public.wc_candidate_preferences;
create trigger wc_candidate_preferences_updated_at
  before update on public.wc_candidate_preferences
  for each row execute function public.wc_candidate_preferences_touch_updated_at();
