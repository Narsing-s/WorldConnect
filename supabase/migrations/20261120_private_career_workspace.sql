-- Private career workspace. Resume text is private by default and never publicly selectable.
create table if not exists public.wc_career_workspaces (
  user_id uuid primary key references public.wc_profiles(id) on delete cascade,
  resume_text text not null check (char_length(resume_text) between 80 and 25000),
  target_role text not null check (char_length(btrim(target_role)) between 1 and 120),
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wc_career_workspaces enable row level security;

drop policy if exists "Members read own career workspace" on public.wc_career_workspaces;
create policy "Members read own career workspace"
  on public.wc_career_workspaces for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Members create own career workspace" on public.wc_career_workspaces;
create policy "Members create own career workspace"
  on public.wc_career_workspaces for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Members update own career workspace" on public.wc_career_workspaces;
create policy "Members update own career workspace"
  on public.wc_career_workspaces for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Members delete own career workspace" on public.wc_career_workspaces;
create policy "Members delete own career workspace"
  on public.wc_career_workspaces for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.wc_career_workspaces from public, anon;
grant select, insert, update, delete on public.wc_career_workspaces to authenticated;

create or replace function public.wc_career_workspace_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wc_career_workspace_updated_at on public.wc_career_workspaces;
create trigger wc_career_workspace_updated_at
  before update on public.wc_career_workspaces
  for each row execute function public.wc_career_workspace_touch_updated_at();
