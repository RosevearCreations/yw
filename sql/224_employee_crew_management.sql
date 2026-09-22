begin;

-- Schema 224 — Build 336 Employee & Crew Management.
-- Extends canonical profiles, crews/crew_members and Build 330 training/authorization truth.
-- It does not create a parallel employee, crew, training or equipment-authorization authority.

alter table public.profiles
  add column if not exists workforce_availability_status text not null default 'available',
  add column if not exists seasonal_status text not null default 'year_round',
  add column if not exists workforce_active_from date,
  add column if not exists workforce_active_until date;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='profiles_workforce_availability_status_chk') then
    alter table public.profiles add constraint profiles_workforce_availability_status_chk
      check (workforce_availability_status in ('available','limited','unavailable','leave'));
  end if;
  if not exists(select 1 from pg_constraint where conname='profiles_seasonal_status_chk') then
    alter table public.profiles add constraint profiles_seasonal_status_chk
      check (seasonal_status in ('year_round','spring_summer','fall_winter','seasonal','on_call','inactive'));
  end if;
  if not exists(select 1 from pg_constraint where conname='profiles_workforce_active_dates_chk') then
    alter table public.profiles add constraint profiles_workforce_active_dates_chk
      check (workforce_active_until is null or workforce_active_from is null or workforce_active_until>=workforce_active_from);
  end if;
end $$;

alter table public.crews
  add column if not exists seasonal_status text not null default 'year_round',
  add column if not exists active_from date,
  add column if not exists active_until date;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='crews_seasonal_status_chk') then
    alter table public.crews add constraint crews_seasonal_status_chk
      check (seasonal_status in ('year_round','spring_summer','fall_winter','seasonal','on_call','inactive'));
  end if;
  if not exists(select 1 from pg_constraint where conname='crews_active_dates_chk') then
    alter table public.crews add constraint crews_active_dates_chk
      check (active_until is null or active_from is null or active_until>=active_from);
  end if;
end $$;

alter table public.crew_members
  add column if not exists membership_status text not null default 'active',
  add column if not exists active_from date,
  add column if not exists active_until date;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='crew_members_membership_status_chk') then
    alter table public.crew_members add constraint crew_members_membership_status_chk
      check (membership_status in ('active','paused','ended'));
  end if;
  if not exists(select 1 from pg_constraint where conname='crew_members_active_dates_chk') then
    alter table public.crew_members add constraint crew_members_active_dates_chk
      check (active_until is null or active_from is null or active_until>=active_from);
  end if;
end $$;

create table if not exists public.workforce_skills (
  id uuid primary key default gen_random_uuid(),
  skill_code text not null unique,
  skill_name text not null,
  skill_category text not null default 'general',
  description text,
  authorization_boundary_note text not null default 'Operational skill evidence only. This record does not grant equipment, driving, regulated-task, trade, pesticide, or other legal authorization.',
  is_active boolean not null default true,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workforce_skills_code_chk check (skill_code ~ '^[A-Z0-9_]{2,80}$')
);

create table if not exists public.workforce_profile_skills (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.workforce_skills(id) on delete cascade,
  proficiency_level text not null default 'basic',
  evidence_note text,
  verified_by_profile_id uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  active_from date,
  active_until date,
  is_active boolean not null default true,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id,skill_id),
  constraint workforce_profile_skills_level_chk check (proficiency_level in ('awareness','basic','competent','advanced','lead')),
  constraint workforce_profile_skills_dates_chk check (active_until is null or active_from is null or active_until>=active_from)
);

create table if not exists public.workforce_availability_windows (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  availability_status text not null default 'available',
  day_of_week smallint,
  start_time time,
  end_time time,
  effective_from date,
  effective_until date,
  availability_note text,
  is_active boolean not null default true,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workforce_availability_status_chk check (availability_status in ('available','preferred','on_call','unavailable')),
  constraint workforce_availability_day_chk check (day_of_week is null or day_of_week between 0 and 6),
  constraint workforce_availability_time_chk check (end_time is null or start_time is null or end_time>start_time),
  constraint workforce_availability_dates_chk check (effective_until is null or effective_from is null or effective_until>=effective_from)
);

create index if not exists workforce_profile_skills_profile_idx
  on public.workforce_profile_skills(profile_id,is_active,proficiency_level);
create index if not exists workforce_profile_skills_skill_idx
  on public.workforce_profile_skills(skill_id,is_active);
create index if not exists workforce_availability_profile_idx
  on public.workforce_availability_windows(profile_id,is_active,effective_from,effective_until);
create index if not exists workforce_availability_day_idx
  on public.workforce_availability_windows(day_of_week,availability_status)
  where is_active=true;
create index if not exists workforce_profiles_state_idx
  on public.profiles(is_active,employment_status,seasonal_status,workforce_availability_status);
create index if not exists workforce_crew_members_state_idx
  on public.crew_members(crew_id,membership_status,active_from,active_until);

alter table public.workforce_skills enable row level security;
alter table public.workforce_profile_skills enable row level security;
alter table public.workforce_availability_windows enable row level security;

revoke all on table public.workforce_skills from public,anon,authenticated;
revoke all on table public.workforce_profile_skills from public,anon,authenticated;
revoke all on table public.workforce_availability_windows from public,anon,authenticated;
grant select,insert,update,delete on table public.workforce_skills to service_role;
grant select,insert,update,delete on table public.workforce_profile_skills to service_role;
grant select,insert,update,delete on table public.workforce_availability_windows to service_role;

insert into public.workforce_skills(skill_code,skill_name,skill_category,description)
values
  ('MOWING_FINISH','Mowing & Finish Quality','maintenance','Mowing patterns, edge quality, cleanup and finish expectations.'),
  ('TRIM_EDGE','Trimming & Edging','maintenance','Line trimming, edging and finish work.'),
  ('PRUNING','Pruning & Shrub Care','horticulture','Routine pruning and shrub-care capability.'),
  ('PLANTING','Planting & Bed Work','horticulture','Planting, bed preparation and basic plant handling.'),
  ('SOD_SEED','Sod / Seed Installation','landscape','Sod preparation/placement and seed application work.'),
  ('MATERIAL_HANDLING','Landscape Material Handling','landscape','Mulch, soil, gravel, stone and similar material handling.'),
  ('SITE_SETUP','Site Setup & Work-Zone Readiness','operations','Work-zone setup, site protection and operational readiness.'),
  ('CUSTOMER_SERVICE','Field Customer Service','operations','Professional field communication and customer handoff.'),
  ('CREW_LEADERSHIP','Crew Leadership','leadership','Daily crew coordination, task assignment and field communication.'),
  ('QUALITY_CONTROL','Field Quality Control','leadership','Completion review, deficiency identification and rework coordination.')
on conflict(skill_code) do update set
  skill_name=excluded.skill_name,
  skill_category=excluded.skill_category,
  description=excluded.description,
  is_active=true,
  updated_at=now();

create or replace view public.v_workforce_skill_directory
with (security_invoker=true)
as
select
  s.id,s.skill_code,s.skill_name,s.skill_category,s.description,s.authorization_boundary_note,s.is_active,
  count(ps.id) filter(where ps.is_active)::int as active_profile_count,
  s.updated_at
from public.workforce_skills s
left join public.workforce_profile_skills ps on ps.skill_id=s.id
group by s.id;

create or replace view public.v_workforce_employee_directory
with (security_invoker=true)
as
select
  p.id,
  p.employee_number,
  p.full_name,
  p.email,
  p.role,
  p.current_position,
  p.trade_specialty,
  p.employment_status,
  p.is_active,
  p.seniority_level,
  p.staff_tier,
  p.start_date,
  p.workforce_availability_status,
  p.seasonal_status,
  p.workforce_active_from,
  p.workforce_active_until,
  coalesce(p.override_supervisor_profile_id,p.default_supervisor_profile_id) as effective_supervisor_profile_id,
  coalesce(os.full_name,ds.full_name) as effective_supervisor_name,
  coalesce(cm.crew_count,0)::int as crew_count,
  coalesce(cm.primary_crew_name,'') as primary_crew_name,
  coalesce(cm.crews_json,'[]'::jsonb) as crews_json,
  coalesce(sk.skill_count,0)::int as skill_count,
  coalesce(sk.skills_json,'[]'::jsonb) as skills_json,
  coalesce(av.availability_window_count,0)::int as availability_window_count,
  coalesce(av.available_window_count,0)::int as available_window_count,
  coalesce(av.unavailable_window_count,0)::int as unavailable_window_count,
  coalesce(tm.training_requirement_count,0)::int as training_requirement_count,
  coalesce(tm.training_current_count,0)::int as training_current_count,
  coalesce(tm.training_blocker_count,0)::int as training_blocker_count,
  coalesce(tm.internal_authorization_required_count,0)::int as internal_authorization_required_count,
  coalesce(tm.internal_authorized_count,0)::int as internal_authorized_count,
  coalesce(tm.internal_authorization_pending_count,0)::int as internal_authorization_pending_count,
  case
    when p.is_active=false or lower(coalesce(p.employment_status,'')) in ('blocked','inactive','terminated') then 'inactive'
    when p.workforce_active_from is not null and p.workforce_active_from>current_date then 'future'
    when p.workforce_active_until is not null and p.workforce_active_until<current_date then 'ended'
    when p.workforce_availability_status='leave' then 'leave'
    when p.workforce_availability_status='unavailable' then 'unavailable'
    else 'active'
  end as workforce_state,
  greatest(p.updated_at,coalesce(sk.updated_at,p.updated_at),coalesce(av.updated_at,p.updated_at),coalesce(cm.updated_at,p.updated_at),coalesce(tm.updated_at,p.updated_at)) as updated_at
from public.profiles p
left join public.profiles ds on ds.id=p.default_supervisor_profile_id
left join public.profiles os on os.id=p.override_supervisor_profile_id
left join lateral (
  select
    count(*)::int as crew_count,
    (array_agg(c.crew_name order by cm0.is_primary desc,c.crew_name))[1] as primary_crew_name,
    jsonb_agg(jsonb_build_object(
      'crew_id',c.id,'crew_code',c.crew_code,'crew_name',c.crew_name,'member_role',cm0.member_role,
      'is_primary',cm0.is_primary,'membership_status',cm0.membership_status,
      'active_from',cm0.active_from,'active_until',cm0.active_until
    ) order by cm0.is_primary desc,c.crew_name) as crews_json,
    max(cm0.updated_at) as updated_at
  from public.crew_members cm0
  join public.crews c on c.id=cm0.crew_id
  where cm0.profile_id=p.id and cm0.membership_status='active'
    and (cm0.active_from is null or cm0.active_from<=current_date)
    and (cm0.active_until is null or cm0.active_until>=current_date)
    and c.crew_status='active'
) cm on true
left join lateral (
  select
    count(*)::int as skill_count,
    jsonb_agg(jsonb_build_object(
      'skill_id',s.id,'skill_code',s.skill_code,'skill_name',s.skill_name,'category',s.skill_category,
      'proficiency_level',ps.proficiency_level,'verified_at',ps.verified_at,
      'active_from',ps.active_from,'active_until',ps.active_until
    ) order by s.skill_category,s.skill_name) as skills_json,
    max(ps.updated_at) as updated_at
  from public.workforce_profile_skills ps
  join public.workforce_skills s on s.id=ps.skill_id and s.is_active=true
  where ps.profile_id=p.id and ps.is_active=true
    and (ps.active_from is null or ps.active_from<=current_date)
    and (ps.active_until is null or ps.active_until>=current_date)
) sk on true
left join lateral (
  select
    count(*)::int as availability_window_count,
    count(*) filter(where aw.availability_status in ('available','preferred','on_call'))::int as available_window_count,
    count(*) filter(where aw.availability_status='unavailable')::int as unavailable_window_count,
    max(aw.updated_at) as updated_at
  from public.workforce_availability_windows aw
  where aw.profile_id=p.id and aw.is_active=true
    and (aw.effective_from is null or aw.effective_from<=current_date)
    and (aw.effective_until is null or aw.effective_until>=current_date)
) av on true
left join lateral (
  select
    count(*)::int as training_requirement_count,
    count(*) filter(where m.readiness_status='current')::int as training_current_count,
    count(*) filter(where m.readiness_status not in ('current','waived'))::int as training_blocker_count,
    count(*) filter(where m.internal_authorization_required)::int as internal_authorization_required_count,
    count(*) filter(where m.internal_authorization_required and m.internal_authorization_status='authorized'
      and (m.internal_authorization_expires_at is null or m.internal_authorization_expires_at>=current_date))::int as internal_authorized_count,
    count(*) filter(where m.internal_authorization_required and (
      m.internal_authorization_status<>'authorized'
      or (m.internal_authorization_expires_at is not null and m.internal_authorization_expires_at<current_date)
    ))::int as internal_authorization_pending_count,
    max(m.updated_at) as updated_at
  from public.v_training_certification_matrix m
  where m.profile_id=p.id
) tm on true;

create or replace view public.v_workforce_crew_directory
with (security_invoker=true)
as
select
  c.id,c.crew_code,c.crew_name,c.crew_kind,c.crew_status,c.seasonal_status,c.active_from,c.active_until,
  c.supervisor_profile_id,sup.full_name as supervisor_name,
  c.lead_profile_id,lead.full_name as lead_name,
  c.service_area_id,sa.name as service_area_name,
  c.default_equipment_notes,c.notes,
  count(cm.id) filter(where cm.membership_status='active')::int as active_member_count,
  coalesce(jsonb_agg(jsonb_build_object(
    'profile_id',p.id,'full_name',p.full_name,'employee_number',p.employee_number,
    'member_role',cm.member_role,'is_primary',cm.is_primary,'membership_status',cm.membership_status,
    'active_from',cm.active_from,'active_until',cm.active_until
  ) order by cm.is_primary desc,p.full_name) filter(where cm.id is not null),'[]'::jsonb) as members_json,
  c.updated_at
from public.crews c
left join public.profiles sup on sup.id=c.supervisor_profile_id
left join public.profiles lead on lead.id=c.lead_profile_id
left join public.service_areas sa on sa.id=c.service_area_id
left join public.crew_members cm on cm.crew_id=c.id
left join public.profiles p on p.id=cm.profile_id
group by c.id,sup.full_name,lead.full_name,sa.name;

create or replace view public.v_workforce_summary
with (security_invoker=true)
as
select
  count(*)::int as profile_count,
  count(*) filter(where workforce_state='active')::int as active_profile_count,
  count(*) filter(where workforce_state='future')::int as future_profile_count,
  count(*) filter(where workforce_state='leave')::int as leave_profile_count,
  count(*) filter(where workforce_state in ('inactive','ended'))::int as inactive_profile_count,
  count(*) filter(where training_blocker_count>0)::int as training_attention_count,
  count(*) filter(where internal_authorization_pending_count>0)::int as authorization_attention_count,
  count(*) filter(where workforce_availability_status in ('limited','unavailable'))::int as availability_attention_count
from public.v_workforce_employee_directory;

revoke all on table public.v_workforce_skill_directory from public,anon,authenticated;
revoke all on table public.v_workforce_employee_directory from public,anon,authenticated;
revoke all on table public.v_workforce_crew_directory from public,anon,authenticated;
revoke all on table public.v_workforce_summary from public,anon,authenticated;
grant select on table public.v_workforce_skill_directory to service_role;
grant select on table public.v_workforce_employee_directory to service_role;
grant select on table public.v_workforce_crew_directory to service_role;
grant select on table public.v_workforce_summary to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  224,'employee_crew_management',
  'Build 336 extends canonical staff and crew records with operational skills, availability, seasonal dates and workforce rollups while reusing Build 330 training/authorization evidence.',
  'applied',now(),'schema224',
  'Profiles remain employee identity; crews/crew_members remain crew authority; training_records and Schema 218 remain training/internal-authorization authority. Home/emergency information is not exposed by workforce views.',
  '224_employee_crew_management.sql','schema224'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true)
as
select
  224 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=224 then 'current'
    when coalesce(max(schema_version) filter(where status='applied'),0)>224 then 'ahead'
    else 'drift'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=224 then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter(where status='applied'),0)>224 then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
