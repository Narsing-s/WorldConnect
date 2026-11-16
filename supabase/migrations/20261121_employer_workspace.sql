-- Phase 3: employer organizations, verified job publishing and applicant pipeline.
create table if not exists public.wc_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 140),
  website_url text check (website_url is null or (char_length(website_url) <= 500 and website_url ~* '^https?://')),
  industry text not null default '',
  company_size text not null default '',
  country text not null default '',
  created_by uuid not null references public.wc_profiles(id) on delete restrict,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','pending','verified','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wc_organizations_created_by_idx on public.wc_organizations(created_by);

create table if not exists public.wc_organization_members (
  organization_id uuid not null references public.wc_organizations(id) on delete cascade,
  user_id uuid not null references public.wc_profiles(id) on delete cascade,
  role text not null check (role in ('owner','recruiter')),
  created_at timestamptz not null default now(),
  primary key (organization_id,user_id)
);
create index if not exists wc_organization_members_user_idx on public.wc_organization_members(user_id);

create table if not exists public.wc_organization_verification_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wc_organizations(id) on delete cascade,
  submitted_by uuid not null references public.wc_profiles(id) on delete restrict,
  registration_reference text not null default '' check (char_length(registration_reference) <= 300),
  notes text not null default '' check (char_length(notes) <= 1500),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists wc_org_verification_pending_idx on public.wc_organization_verification_requests(status,created_at);

create table if not exists public.wc_employer_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.wc_organizations(id) on delete cascade,
  created_by uuid not null references public.wc_profiles(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 140),
  description text not null check (char_length(btrim(description)) between 30 and 10000),
  requirements text not null default '' check (char_length(requirements) <= 5000),
  location text not null default 'Remote' check (char_length(location) <= 160),
  work_mode text not null default 'Remote' check (work_mode in ('Remote','Hybrid','On-site')),
  employment_type text not null default 'Full-time' check (employment_type in ('Full-time','Part-time','Contract','Internship','Temporary')),
  salary_range text not null default '' check (char_length(salary_range) <= 120),
  application_url text check (application_url is null or (char_length(application_url)<=500 and application_url ~* '^https?://')),
  status text not null default 'draft' check (status in ('draft','published','closed')),
  published_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wc_employer_job_close_after_publish check (closes_at is null or published_at is null or closes_at >= published_at)
);
create index if not exists wc_employer_jobs_org_status_idx on public.wc_employer_jobs(organization_id,status,created_at desc);
create index if not exists wc_employer_jobs_public_idx on public.wc_employer_jobs(status,published_at desc);

create table if not exists public.wc_employer_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.wc_employer_jobs(id) on delete cascade,
  candidate_id uuid not null references public.wc_profiles(id) on delete cascade,
  cover_letter text not null default '' check (char_length(cover_letter) <= 3000),
  status text not null default 'submitted'
    check (status in ('submitted','reviewing','shortlisted','interview','offered','rejected','withdrawn')),
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id,candidate_id)
);
create index if not exists wc_employer_applications_candidate_idx on public.wc_employer_applications(candidate_id,applied_at desc);
create index if not exists wc_employer_applications_job_status_idx on public.wc_employer_applications(job_id,status,applied_at desc);

create table if not exists public.wc_employer_application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.wc_employer_applications(id) on delete cascade,
  actor_id uuid not null references public.wc_profiles(id) on delete restrict,
  from_status text,
  to_status text not null,
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists wc_employer_application_events_app_idx on public.wc_employer_application_events(application_id,created_at desc);

alter table public.wc_organizations enable row level security;
alter table public.wc_organization_members enable row level security;
alter table public.wc_organization_verification_requests enable row level security;
alter table public.wc_employer_jobs enable row level security;
alter table public.wc_employer_applications enable row level security;
alter table public.wc_employer_application_events enable row level security;

drop policy if exists "Members view their organizations and verified companies" on public.wc_organizations;
create policy "Members view their organizations and verified companies" on public.wc_organizations
for select to authenticated using (
  verification_status = 'verified' or exists (
    select 1 from public.wc_organization_members m
    where m.organization_id = id and m.user_id = auth.uid()
  )
);
drop policy if exists "Members view own organization memberships" on public.wc_organization_members;
create policy "Members view own organization memberships" on public.wc_organization_members
for select to authenticated using (user_id = auth.uid() or exists (
  select 1 from public.wc_organization_members mine
  where mine.organization_id = organization_id and mine.user_id = auth.uid()
));
drop policy if exists "Members view verification requests for their organizations" on public.wc_organization_verification_requests;
create policy "Members view verification requests for their organizations" on public.wc_organization_verification_requests
for select to authenticated using (exists (
  select 1 from public.wc_organization_members m
  where m.organization_id = organization_id and m.user_id = auth.uid()
));
drop policy if exists "Verified employer jobs are public and members see their drafts" on public.wc_employer_jobs;
create policy "Verified employer jobs are public and members see their drafts" on public.wc_employer_jobs
for select to authenticated using (
  exists (select 1 from public.wc_organizations o where o.id = organization_id and o.verification_status = 'verified' and status = 'published')
  or exists (select 1 from public.wc_organization_members m where m.organization_id = organization_id and m.user_id = auth.uid())
);
drop policy if exists "Organization members create employer jobs" on public.wc_employer_jobs;
create policy "Organization members create employer jobs" on public.wc_employer_jobs
for insert to authenticated with check (
  created_by = auth.uid() and exists (
    select 1 from public.wc_organization_members m where m.organization_id = organization_id and m.user_id = auth.uid()
  ) and (status = 'draft' or exists (
    select 1 from public.wc_organizations o where o.id = organization_id and o.verification_status = 'verified'
  ))
);
drop policy if exists "Organization members update employer jobs" on public.wc_employer_jobs;
create policy "Organization members update employer jobs" on public.wc_employer_jobs
for update to authenticated using (exists (
  select 1 from public.wc_organization_members m where m.organization_id = organization_id and m.user_id = auth.uid()
)) with check (
  exists (select 1 from public.wc_organization_members m where m.organization_id = organization_id and m.user_id = auth.uid())
  and (status <> 'published' or exists (
    select 1 from public.wc_organizations o where o.id = organization_id and o.verification_status = 'verified'
  ))
);
drop policy if exists "Candidates and employer members view applications" on public.wc_employer_applications;
create policy "Candidates and employer members view applications" on public.wc_employer_applications
for select to authenticated using (
  candidate_id = auth.uid() or exists (
    select 1 from public.wc_employer_jobs j join public.wc_organization_members m on m.organization_id = j.organization_id
    where j.id = job_id and m.user_id = auth.uid()
  )
);
drop policy if exists "Candidates and employer members view application history" on public.wc_employer_application_events;
create policy "Candidates and employer members view application history" on public.wc_employer_application_events
for select to authenticated using (
  exists (select 1 from public.wc_employer_applications a where a.id = application_id and a.candidate_id = auth.uid())
  or exists (
    select 1 from public.wc_employer_applications a
    join public.wc_employer_jobs j on j.id = a.job_id
    join public.wc_organization_members m on m.organization_id = j.organization_id
    where a.id = application_id and m.user_id = auth.uid()
  )
);

revoke all on public.wc_organizations, public.wc_organization_members, public.wc_organization_verification_requests,
  public.wc_employer_jobs, public.wc_employer_applications, public.wc_employer_application_events from public, anon;
grant select on public.wc_organizations, public.wc_organization_members, public.wc_organization_verification_requests,
  public.wc_employer_jobs, public.wc_employer_applications, public.wc_employer_application_events to authenticated;
grant insert,update on public.wc_employer_jobs to authenticated;
revoke insert,update,delete on public.wc_organizations, public.wc_organization_members,
  public.wc_organization_verification_requests, public.wc_employer_applications, public.wc_employer_application_events from authenticated;

create or replace function public.wc_create_organization(
  p_name text, p_website_url text default null, p_industry text default '', p_company_size text default '', p_country text default ''
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Sign in to create a company profile'; end if;
  if char_length(btrim(coalesce(p_name,''))) not between 2 and 140 then raise exception 'Company name must be 2 to 140 characters'; end if;
  if p_website_url is not null and (char_length(p_website_url)>500 or p_website_url !~* '^https?://') then raise exception 'Enter a valid company website URL'; end if;
  insert into public.wc_organizations(name,website_url,industry,company_size,country,created_by)
  values(btrim(p_name),nullif(btrim(p_website_url),''),left(btrim(coalesce(p_industry,'')),120),left(btrim(coalesce(p_company_size,'')),80),left(btrim(coalesce(p_country,'')),100),v_user)
  returning id into v_org;
  insert into public.wc_organization_members(organization_id,user_id,role) values(v_org,v_user,'owner');
  return v_org;
end; $$;

create or replace function public.wc_submit_organization_verification(
  p_organization_id uuid, p_registration_reference text default '', p_notes text default ''
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_request uuid; v_user uuid := auth.uid(); v_status text;
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  if not exists(select 1 from public.wc_organization_members where organization_id=p_organization_id and user_id=v_user and role='owner') then
    raise exception 'Only a company owner can submit verification';
  end if;
  select verification_status into v_status from public.wc_organizations where id=p_organization_id for update;
  if v_status is null then raise exception 'Company not found'; end if;
  if v_status='verified' then raise exception 'This company is already verified'; end if;
  if v_status='pending' then raise exception 'A verification request is already pending'; end if;
  insert into public.wc_organization_verification_requests(organization_id,submitted_by,registration_reference,notes)
  values(p_organization_id,v_user,left(coalesce(p_registration_reference,''),300),left(coalesce(p_notes,''),1500))
  returning id into v_request;
  update public.wc_organizations set verification_status='pending',updated_at=now() where id=p_organization_id;
  return v_request;
end; $$;

create or replace function public.wc_apply_to_employer_job(p_job_id uuid,p_cover_letter text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_application uuid; v_candidate uuid := auth.uid(); v_org uuid;
begin
  if v_candidate is null then raise exception 'Sign in to apply'; end if;
  if char_length(coalesce(p_cover_letter,''))>3000 then raise exception 'Cover letter is too long'; end if;
  select organization_id into v_org from public.wc_employer_jobs j
  join public.wc_organizations o on o.id=j.organization_id
  where j.id=p_job_id and j.status='published' and o.verification_status='verified';
  if v_org is null then raise exception 'This job is not accepting applications'; end if;
  if exists(select 1 from public.wc_organization_members where organization_id=v_org and user_id=v_candidate) then
    raise exception 'Company team members cannot apply to their own company jobs';
  end if;
  insert into public.wc_employer_applications(job_id,candidate_id,cover_letter)
  values(p_job_id,v_candidate,left(coalesce(p_cover_letter,''),3000))
  on conflict(job_id,candidate_id) do nothing returning id into v_application;
  if v_application is null then raise exception 'You have already applied to this job'; end if;
  insert into public.wc_employer_application_events(application_id,actor_id,to_status,note)
  values(v_application,v_candidate,'submitted','Application submitted');
  return v_application;
end; $$;

create or replace function public.wc_update_employer_application(
  p_application_id uuid,p_status text,p_note text default ''
) returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_old text;
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  if p_status not in ('reviewing','shortlisted','interview','offered','rejected') then raise exception 'Invalid recruiter status'; end if;
  if char_length(coalesce(p_note,''))>1000 then raise exception 'Note is too long'; end if;
  select a.status into v_old from public.wc_employer_applications a
  join public.wc_employer_jobs j on j.id=a.job_id
  join public.wc_organization_members m on m.organization_id=j.organization_id and m.user_id=v_user
  where a.id=p_application_id for update of a;
  if v_old is null then raise exception 'Application not found or you are not authorized'; end if;
  update public.wc_employer_applications set status=p_status,updated_at=now() where id=p_application_id;
  insert into public.wc_employer_application_events(application_id,actor_id,from_status,to_status,note)
  values(p_application_id,v_user,v_old,p_status,left(coalesce(p_note,''),1000));
end; $$;

create or replace function public.wc_withdraw_employer_application(p_application_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_old text;
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  update public.wc_employer_applications set status='withdrawn',updated_at=now()
  where id=p_application_id and candidate_id=v_user and status not in ('rejected','offered','withdrawn')
  returning status into v_old;
  if not found then raise exception 'Application not found or cannot be withdrawn'; end if;
  insert into public.wc_employer_application_events(application_id,actor_id,from_status,to_status,note)
  values(p_application_id,v_user,v_old,'withdrawn','Candidate withdrew application');
end; $$;

grant execute on function public.wc_create_organization(text,text,text,text,text) to authenticated;
grant execute on function public.wc_submit_organization_verification(uuid,text,text) to authenticated;
grant execute on function public.wc_apply_to_employer_job(uuid,text) to authenticated;
grant execute on function public.wc_update_employer_application(uuid,text,text) to authenticated;
grant execute on function public.wc_withdraw_employer_application(uuid) to authenticated;

create or replace function public.wc_employer_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists wc_employer_jobs_updated_at on public.wc_employer_jobs;
create trigger wc_employer_jobs_updated_at before update on public.wc_employer_jobs for each row execute function public.wc_employer_touch_updated_at();
