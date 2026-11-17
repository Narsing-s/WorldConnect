-- Phase 4: employer collaboration, interviews, candidate-controlled sharing and review operations.
-- Reviewer access is granted only through trusted Supabase auth app_metadata:
-- { "worldconnect_role": "reviewer" }. Never let clients edit app_metadata.

create table if not exists public.wc_organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wc_organizations(id) on delete cascade,
  invited_email text not null check (char_length(invited_email) between 5 and 320),
  role text not null default 'recruiter' check (role = 'recruiter'),
  token_hash text not null unique,
  invited_by uuid not null references public.wc_profiles(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references public.wc_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index if not exists wc_org_invites_org_status_idx on public.wc_organization_invitations(organization_id,status,created_at desc);

create table if not exists public.wc_employer_interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.wc_employer_applications(id) on delete cascade,
  scheduled_by uuid not null references public.wc_profiles(id) on delete restrict,
  starts_at timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes between 15 and 240),
  meeting_url text check (meeting_url is null or (char_length(meeting_url)<=1000 and meeting_url ~* '^https?://')),
  location text not null default '',
  interview_type text not null default 'Video' check (interview_type in ('Video','Phone','In-person')),
  notes text not null default '' check (char_length(notes)<=1500),
  status text not null default 'scheduled' check (status in ('scheduled','rescheduled','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wc_employer_interviews_application_idx on public.wc_employer_interviews(application_id,starts_at);

create table if not exists public.wc_candidate_profile_consents (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.wc_profiles(id) on delete cascade,
  organization_id uuid not null references public.wc_organizations(id) on delete cascade,
  application_id uuid references public.wc_employer_applications(id) on delete cascade,
  shared_fields text[] not null default array['basic_profile']::text[]
    check (shared_fields <@ array['basic_profile','skills','portfolio','experience','certifications']::text[]),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  revoked_at timestamptz,
  check (expires_at > granted_at)
);
create index if not exists wc_candidate_consents_candidate_idx on public.wc_candidate_profile_consents(candidate_id,organization_id,expires_at);

alter table public.wc_organization_invitations enable row level security;
alter table public.wc_employer_interviews enable row level security;
alter table public.wc_candidate_profile_consents enable row level security;

drop policy if exists "Trusted reviewers view verification queue" on public.wc_organization_verification_requests;
create policy "Trusted reviewers view verification queue" on public.wc_organization_verification_requests
for select to authenticated using (coalesce(auth.jwt()->'app_metadata'->>'worldconnect_role','')='reviewer');

drop policy if exists "Organization owners view invitations" on public.wc_organization_invitations;
create policy "Organization owners view invitations" on public.wc_organization_invitations
for select to authenticated using (exists (
  select 1 from public.wc_organization_members m
  where m.organization_id=wc_organization_invitations.organization_id and m.user_id=auth.uid() and m.role='owner'
));
drop policy if exists "Candidates and employer members view interviews" on public.wc_employer_interviews;
create policy "Candidates and employer members view interviews" on public.wc_employer_interviews
for select to authenticated using (
  exists (select 1 from public.wc_employer_applications a where a.id=application_id and a.candidate_id=auth.uid())
  or exists (
    select 1 from public.wc_employer_applications a
    join public.wc_employer_jobs j on j.id=a.job_id
    join public.wc_organization_members m on m.organization_id=j.organization_id
    where a.id=application_id and m.user_id=auth.uid()
  )
);
drop policy if exists "Candidates manage their profile sharing consents" on public.wc_candidate_profile_consents;
create policy "Candidates manage their profile sharing consents" on public.wc_candidate_profile_consents
for select to authenticated using (candidate_id=auth.uid());
drop policy if exists "Employers view active consent metadata" on public.wc_candidate_profile_consents;
create policy "Employers view active consent metadata" on public.wc_candidate_profile_consents
for select to authenticated using (
  revoked_at is null and expires_at>now() and exists (
    select 1 from public.wc_organization_members m
    where m.organization_id=wc_candidate_profile_consents.organization_id and m.user_id=auth.uid()
  )
);

revoke all on public.wc_organization_invitations,public.wc_employer_interviews,public.wc_candidate_profile_consents from public,anon;
grant select on public.wc_organization_invitations,public.wc_employer_interviews,public.wc_candidate_profile_consents to authenticated;
revoke insert,update,delete on public.wc_organization_invitations,public.wc_employer_interviews,public.wc_candidate_profile_consents from authenticated;

create or replace function public.wc_create_organization_invitation(p_organization_id uuid,p_email text)
returns text language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_token text; v_email text:=lower(btrim(coalesce(p_email,'')));
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  if v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'Enter a valid email address'; end if;
  if not exists(select 1 from public.wc_organization_members where organization_id=p_organization_id and user_id=v_user and role='owner') then raise exception 'Only an organization owner can invite recruiters'; end if;
  if exists(select 1 from public.wc_organization_members m join auth.users u on u.id=m.user_id where m.organization_id=p_organization_id and lower(u.email)=v_email) then raise exception 'This person is already a member'; end if;
  if exists(select 1 from public.wc_organization_invitations where organization_id=p_organization_id and invited_email=v_email and status='pending' and expires_at>now()) then raise exception 'An active invitation already exists'; end if;
  v_token:=encode(gen_random_bytes(32),'hex');
  insert into public.wc_organization_invitations(organization_id,invited_email,token_hash,invited_by)
  values(p_organization_id,v_email,encode(digest(v_token,'sha256'),'hex'),v_user);
  return v_token;
end; $$;

create or replace function public.wc_accept_organization_invitation(p_token text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_email text; v_inv public.wc_organization_invitations%rowtype;
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  select lower(email) into v_email from auth.users where id=v_user;
  select * into v_inv from public.wc_organization_invitations
  where token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex') and status='pending' and expires_at>now()
  for update;
  if not found then raise exception 'Invitation is invalid, expired or already used'; end if;
  if v_email is null or v_email<>v_inv.invited_email then raise exception 'Sign in with the email address that received this invitation'; end if;
  insert into public.wc_organization_members(organization_id,user_id,role) values(v_inv.organization_id,v_user,'recruiter')
  on conflict(organization_id,user_id) do nothing;
  update public.wc_organization_invitations set status='accepted',accepted_by=v_user,accepted_at=now() where id=v_inv.id;
  return v_inv.organization_id;
end; $$;

create or replace function public.wc_revoke_organization_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.wc_organization_invitations i set status='revoked'
  where i.id=p_invitation_id and i.status='pending'
    and exists(select 1 from public.wc_organization_members m where m.organization_id=i.organization_id and m.user_id=auth.uid() and m.role='owner');
  if not found then raise exception 'Invitation not found or not authorized'; end if;
end; $$;

create or replace function public.wc_schedule_employer_interview(
 p_application_id uuid,p_starts_at timestamptz,p_duration_minutes integer default 30,
 p_meeting_url text default null,p_location text default '',p_interview_type text default 'Video',p_notes text default ''
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_id uuid;
begin
 if v_user is null then raise exception 'Sign in required'; end if;
 if p_starts_at<=now() then raise exception 'Choose a future interview time'; end if;
 if p_duration_minutes not between 15 and 240 then raise exception 'Duration must be 15 to 240 minutes'; end if;
 if p_interview_type not in ('Video','Phone','In-person') then raise exception 'Invalid interview type'; end if;
 if char_length(coalesce(p_notes,''))>1500 then raise exception 'Notes are too long'; end if;
 if not exists(select 1 from public.wc_employer_applications a join public.wc_employer_jobs j on j.id=a.job_id
  join public.wc_organization_members m on m.organization_id=j.organization_id
  where a.id=p_application_id and m.user_id=v_user) then raise exception 'Application not found or not authorized'; end if;
 insert into public.wc_employer_interviews(application_id,scheduled_by,starts_at,duration_minutes,meeting_url,location,interview_type,notes)
 values(p_application_id,v_user,p_starts_at,p_duration_minutes,nullif(btrim(p_meeting_url),''),left(coalesce(p_location,''),300),p_interview_type,left(coalesce(p_notes,''),1500))
 returning id into v_id;
 update public.wc_employer_applications set status='interview',updated_at=now() where id=p_application_id and status in ('submitted','reviewing','shortlisted');
 insert into public.wc_employer_application_events(application_id,actor_id,to_status,note)
 values(p_application_id,v_user,'interview','Interview scheduled');
 return v_id;
end; $$;

create or replace function public.wc_candidate_grant_profile_consent(
 p_organization_id uuid,p_application_id uuid,p_shared_fields text[] default array['basic_profile']::text[]
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_id uuid;
begin
 if v_user is null then raise exception 'Sign in required'; end if;
 if p_shared_fields is null or cardinality(p_shared_fields)=0 or not (p_shared_fields <@ array['basic_profile','skills','portfolio','experience','certifications']::text[]) then raise exception 'Choose valid profile sections'; end if;
 if p_application_id is not null and not exists(select 1 from public.wc_employer_applications a join public.wc_employer_jobs j on j.id=a.job_id where a.id=p_application_id and a.candidate_id=v_user and j.organization_id=p_organization_id) then raise exception 'Application does not belong to this candidate and company'; end if;
 insert into public.wc_candidate_profile_consents(candidate_id,organization_id,application_id,shared_fields)
 values(v_user,p_organization_id,p_application_id,p_shared_fields) returning id into v_id;
 return v_id;
end; $$;

create or replace function public.wc_candidate_revoke_profile_consent(p_consent_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.wc_candidate_profile_consents set revoked_at=now()
 where id=p_consent_id and candidate_id=auth.uid() and revoked_at is null;
 if not found then raise exception 'Consent not found'; end if;
end; $$;

create or replace function public.wc_review_organization_verification(
 p_request_id uuid,p_decision text,p_reviewer_note text default ''
) returns void language plpgsql security definer set search_path='' as $$
declare v_org uuid;
begin
 if coalesce(auth.jwt()->'app_metadata'->>'worldconnect_role','')<>'reviewer' then raise exception 'Authorized platform reviewer role required'; end if;
 if p_decision not in ('verified','rejected') then raise exception 'Decision must be verified or rejected'; end if;
 if char_length(coalesce(p_reviewer_note,''))>1500 then raise exception 'Reviewer note is too long'; end if;
 select organization_id into v_org from public.wc_organization_verification_requests where id=p_request_id and status='pending' for update;
 if v_org is null then raise exception 'Pending verification request not found'; end if;
 update public.wc_organization_verification_requests set status=case when p_decision='verified' then 'approved' else 'rejected' end,reviewed_at=now(),reviewer_note=left(coalesce(p_reviewer_note,''),1500) where id=p_request_id;
 update public.wc_organizations set verification_status=p_decision,updated_at=now() where id=v_org;
end; $$;

create or replace view public.wc_employer_analytics with (security_invoker=true) as
select o.id organization_id,o.name organization_name,
 count(distinct j.id) filter(where j.status='published') published_jobs,
 count(distinct a.id) applications_total,
 count(distinct a.id) filter(where a.status='submitted') applications_submitted,
 count(distinct a.id) filter(where a.status='reviewing') applications_reviewing,
 count(distinct a.id) filter(where a.status='shortlisted') applications_shortlisted,
 count(distinct a.id) filter(where a.status='interview') applications_interview,
 count(distinct a.id) filter(where a.status='offered') applications_offered,
 count(distinct a.id) filter(where a.status='rejected') applications_rejected
from public.wc_organizations o
join public.wc_organization_members m on m.organization_id=o.id
left join public.wc_employer_jobs j on j.organization_id=o.id
left join public.wc_employer_applications a on a.job_id=j.id
where m.user_id=auth.uid()
group by o.id,o.name;
revoke all on public.wc_employer_analytics from public,anon;
grant select on public.wc_employer_analytics to authenticated;

revoke all on function public.wc_create_organization_invitation(uuid,text) from public,anon;
revoke all on function public.wc_accept_organization_invitation(text) from public,anon;
revoke all on function public.wc_revoke_organization_invitation(uuid) from public,anon;
revoke all on function public.wc_schedule_employer_interview(uuid,timestamptz,integer,text,text,text,text) from public,anon;
revoke all on function public.wc_candidate_grant_profile_consent(uuid,uuid,text[]) from public,anon;
revoke all on function public.wc_candidate_revoke_profile_consent(uuid) from public,anon;
revoke all on function public.wc_review_organization_verification(uuid,text,text) from public,anon;
grant execute on function public.wc_create_organization_invitation(uuid,text) to authenticated;
grant execute on function public.wc_accept_organization_invitation(text) to authenticated;
grant execute on function public.wc_revoke_organization_invitation(uuid) to authenticated;
grant execute on function public.wc_schedule_employer_interview(uuid,timestamptz,integer,text,text,text,text) to authenticated;
grant execute on function public.wc_candidate_grant_profile_consent(uuid,uuid,text[]) to authenticated;
grant execute on function public.wc_candidate_revoke_profile_consent(uuid) to authenticated;
grant execute on function public.wc_review_organization_verification(uuid,text,text) to authenticated;
