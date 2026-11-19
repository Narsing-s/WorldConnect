-- WorldConnect mentorship marketplace.
-- Additive and opt-in: no existing profiles or member data are changed.
begin;

create table if not exists public.wc_mentorship_profiles (
  user_id uuid primary key references public.wc_profiles(id) on delete cascade,
  headline text not null default '' check (char_length(headline) <= 120),
  bio text not null default '' check (char_length(bio) <= 800),
  skills text[] not null default '{}',
  languages text[] not null default '{}',
  country text not null default '',
  availability text not null default 'Flexible' check (availability in ('Flexible','Weekdays','Weekends','Evenings','By arrangement')),
  accepting_requests boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wc_mentorship_skills_limit check (cardinality(skills) <= 12),
  constraint wc_mentorship_languages_limit check (cardinality(languages) <= 8)
);

create index if not exists wc_mentorship_discovery_idx
  on public.wc_mentorship_profiles (accepting_requests, updated_at desc)
  where accepting_requests = true;

alter table public.wc_mentorship_profiles enable row level security;
drop policy if exists "Members discover opted-in mentors" on public.wc_mentorship_profiles;
create policy "Members discover opted-in mentors"
  on public.wc_mentorship_profiles for select to authenticated
  using (
    auth.uid() = user_id
    or (
      accepting_requests
      and not public.wc_is_blocked_between(auth.uid(), user_id)
    )
  );
drop policy if exists "Members manage their mentorship profile" on public.wc_mentorship_profiles;
create policy "Members manage their mentorship profile"
  on public.wc_mentorship_profiles for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.wc_mentorship_requests (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.wc_profiles(id) on delete cascade,
  requester_id uuid not null references public.wc_profiles(id) on delete cascade,
  goal text not null check (char_length(btrim(goal)) between 10 and 1200),
  cadence text not null default 'monthly' check (cadence in ('weekly','monthly','one_off')),
  status text not null default 'pending' check (status in ('pending','accepted','declined','withdrawn','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wc_mentorship_no_self_request check (mentor_id <> requester_id)
);

create index if not exists wc_mentorship_requests_mentor_idx
  on public.wc_mentorship_requests (mentor_id, status, created_at desc);
create index if not exists wc_mentorship_requests_requester_idx
  on public.wc_mentorship_requests (requester_id, status, created_at desc);
create unique index if not exists wc_mentorship_one_active_request_idx
  on public.wc_mentorship_requests (mentor_id, requester_id)
  where status in ('pending','accepted');

alter table public.wc_mentorship_requests enable row level security;
drop policy if exists "Participants view mentorship requests" on public.wc_mentorship_requests;
create policy "Participants view mentorship requests"
  on public.wc_mentorship_requests for select to authenticated
  using (auth.uid() = mentor_id or auth.uid() = requester_id);

revoke all on public.wc_mentorship_profiles, public.wc_mentorship_requests from public, anon;
grant select, insert, update, delete on public.wc_mentorship_profiles to authenticated;
grant select on public.wc_mentorship_requests to authenticated;

create or replace function public.wc_request_mentorship(
  p_mentor_id uuid,
  p_goal text,
  p_cadence text default 'monthly'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requester uuid := auth.uid();
  v_id uuid;
  v_goal text := btrim(coalesce(p_goal,''));
  v_cadence text := coalesce(p_cadence,'monthly');
begin
  if v_requester is null then raise exception 'Sign in required'; end if;
  if p_mentor_id is null or p_mentor_id = v_requester then raise exception 'Choose another member'; end if;
  if char_length(v_goal) < 10 or char_length(v_goal) > 1200 then
    raise exception 'Describe your mentorship goal in 10 to 1,200 characters';
  end if;
  if v_cadence not in ('weekly','monthly','one_off') then raise exception 'Choose a valid meeting cadence'; end if;
  if not exists (
    select 1 from public.wc_mentorship_profiles mp
    where mp.user_id = p_mentor_id and mp.accepting_requests = true
  ) then raise exception 'This member is not accepting mentorship requests'; end if;
  if public.wc_is_blocked_between(v_requester,p_mentor_id) then
    raise exception 'This mentorship request is unavailable';
  end if;
  if (select count(*) from public.wc_mentorship_requests r
      where r.requester_id=v_requester and r.created_at > now() - interval '24 hours') >= 10 then
    raise exception 'Daily mentorship request limit reached. Try again tomorrow';
  end if;
  if exists (
    select 1 from public.wc_mentorship_requests r
    where r.mentor_id=p_mentor_id and r.requester_id=v_requester
      and r.status in ('pending','accepted')
  ) then raise exception 'You already have an active request with this mentor'; end if;

  insert into public.wc_mentorship_requests(mentor_id,requester_id,goal,cadence)
  values(p_mentor_id,v_requester,v_goal,v_cadence)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.wc_respond_mentorship_request(
  p_request_id uuid,
  p_action text
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_request public.wc_mentorship_requests%rowtype;
  v_next text;
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  select * into v_request from public.wc_mentorship_requests
  where id=p_request_id for update;
  if not found then raise exception 'Mentorship request not found'; end if;

  if p_action in ('accept','decline') then
    if v_user <> v_request.mentor_id or v_request.status <> 'pending' then
      raise exception 'Only the mentor can respond to a pending request';
    end if;
    if p_action='accept' and public.wc_is_blocked_between(v_request.requester_id,v_request.mentor_id) then
      raise exception 'This request cannot be accepted';
    end if;
    v_next := case when p_action='accept' then 'accepted' else 'declined' end;
  elsif p_action='withdraw' then
    if v_user <> v_request.requester_id or v_request.status <> 'pending' then
      raise exception 'Only the requester can withdraw a pending request';
    end if;
    v_next := 'withdrawn';
  elsif p_action='complete' then
    if v_user not in (v_request.mentor_id,v_request.requester_id) or v_request.status <> 'accepted' then
      raise exception 'Only a participant can complete an accepted mentorship';
    end if;
    v_next := 'completed';
  else
    raise exception 'Unsupported mentorship action';
  end if;

  update public.wc_mentorship_requests
  set status=v_next, updated_at=now()
  where id=p_request_id;
  return v_next;
end;
$$;

revoke all on function public.wc_request_mentorship(uuid,text,text) from public, anon;
revoke all on function public.wc_respond_mentorship_request(uuid,text) from public, anon;
grant execute on function public.wc_request_mentorship(uuid,text,text) to authenticated;
grant execute on function public.wc_respond_mentorship_request(uuid,text) to authenticated;

commit;
