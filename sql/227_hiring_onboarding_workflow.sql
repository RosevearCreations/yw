begin;

-- Schema 227 — Build 339 Hiring & Onboarding Workflow.
-- Adds a bounded candidate/onboarding workflow around the canonical profiles,
-- crew, training/certification and internal equipment/task authorization authorities.
-- YW is a four-season Ontario operation: spring/summer landscaping and mowing,
-- fall cleanup, and winter snow clearing/removal are explicit readiness contexts.
-- Season checklist codes are SPRING_SUMMER_LANDSCAPING_ORIENTATION,
-- FALL_CLEANUP_ORIENTATION and WINTER_SNOW_OPERATIONS_ORIENTATION.

create table if not exists public.workforce_hiring_candidates (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  preferred_name text,
  email text,
  phone text,
  source text,
  target_position text,
  employment_type text not null default 'full_time',
  season_profile text not null default 'four_season',
  stage text not null default 'applicant',
  profile_id uuid references public.profiles(id) on delete set null,
  planned_crew_id uuid references public.crews(id) on delete set null,
  available_from date,
  offer_date date,
  hire_date date,
  notes text,
  is_archived boolean not null default false,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workforce_hiring_employment_type_chk check (employment_type in ('full_time','part_time','seasonal','casual','contract')),
  constraint workforce_hiring_season_profile_chk check (season_profile in ('four_season','spring_summer','fall','fall_winter','winter','seasonal_flexible')),
  constraint workforce_hiring_stage_chk check (stage in ('applicant','interview','offer','hired','documents','orientation','training','equipment_authorization','crew_assignment','ready','withdrawn','not_selected'))
);

create index if not exists workforce_hiring_candidates_stage_idx
  on public.workforce_hiring_candidates(stage,is_archived,season_profile);
create index if not exists workforce_hiring_candidates_profile_idx
  on public.workforce_hiring_candidates(profile_id);

create table if not exists public.workforce_candidate_onboarding_items (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.workforce_hiring_candidates(id) on delete cascade,
  item_code text not null,
  item_name text not null,
  item_category text not null default 'orientation',
  is_required boolean not null default true,
  item_status text not null default 'pending',
  due_date date,
  completed_at timestamptz,
  evidence_reference text,
  note text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workforce_candidate_onboarding_item_code_chk check (item_code ~ '^[A-Z0-9_]{2,100}$'),
  constraint workforce_candidate_onboarding_category_chk check (item_category in ('documents','orientation','seasonal_service','readiness')),
  constraint workforce_candidate_onboarding_status_chk check (item_status in ('pending','in_progress','completed','waived','not_applicable')),
  constraint workforce_candidate_onboarding_unique unique(candidate_id,item_code)
);

create index if not exists workforce_candidate_onboarding_state_idx
  on public.workforce_candidate_onboarding_items(candidate_id,item_status,is_required);

create table if not exists public.workforce_candidate_stage_events (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.workforce_hiring_candidates(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  transition_note text,
  changed_by_profile_id uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists workforce_candidate_stage_events_idx
  on public.workforce_candidate_stage_events(candidate_id,changed_at desc);

alter table public.workforce_hiring_candidates enable row level security;
alter table public.workforce_candidate_onboarding_items enable row level security;
alter table public.workforce_candidate_stage_events enable row level security;

revoke all on table public.workforce_hiring_candidates from public,anon,authenticated;
revoke all on table public.workforce_candidate_onboarding_items from public,anon,authenticated;
revoke all on table public.workforce_candidate_stage_events from public,anon,authenticated;
grant select,insert,update on table public.workforce_hiring_candidates to service_role;
grant select,insert,update on table public.workforce_candidate_onboarding_items to service_role;
grant select,insert on table public.workforce_candidate_stage_events to service_role;

create or replace view public.v_workforce_hiring_onboarding_overview
with (security_invoker=true)
as
with item_rollup as (
  select
    candidate_id,
    count(*) filter(where is_required)::int as required_item_count,
    count(*) filter(where is_required and item_status not in ('completed','waived','not_applicable'))::int as onboarding_blocker_count,
    count(*) filter(where item_code='EMPLOYMENT_DOCUMENTS' and is_required and item_status not in ('completed','waived','not_applicable'))::int as document_blocker_count,
    count(*) filter(where item_category='orientation' and is_required and item_status not in ('completed','waived','not_applicable'))::int as orientation_blocker_count,
    count(*) filter(where item_category='seasonal_service' and is_required and item_status not in ('completed','waived','not_applicable'))::int as seasonal_service_blocker_count,
    count(*) filter(where item_code='WINTER_SNOW_OPERATIONS_ORIENTATION' and is_required and item_status not in ('completed','waived','not_applicable'))::int as winter_readiness_blocker_count,
    max(updated_at) as last_onboarding_update_at
  from public.workforce_candidate_onboarding_items
  group by candidate_id
),
training_rollup as (
  select
    profile_id,
    count(*)::int as training_requirement_count,
    count(*) filter(where coalesce(readiness_status,'') not in ('ready','current','not_required'))::int as training_blocker_count,
    count(*) filter(where internal_authorization_required is true and coalesce(internal_authorization_status,'pending') <> 'authorized')::int as equipment_authorization_blocker_count
  from public.v_training_certification_matrix
  group by profile_id
),
current_crew as (
  select distinct on (cm.profile_id)
    cm.profile_id,
    cm.crew_id,
    c.crew_name
  from public.crew_members cm
  join public.crews c on c.id=cm.crew_id
  where coalesce(cm.membership_status,'active')='active'
    and (cm.active_from is null or cm.active_from<=current_date)
    and (cm.active_until is null or cm.active_until>=current_date)
  order by cm.profile_id,coalesce(cm.is_primary,false) desc,cm.created_at desc
)
select
  h.id as candidate_id,
  h.full_name,
  h.preferred_name,
  h.email,
  h.phone,
  h.source,
  h.target_position,
  h.employment_type,
  h.season_profile,
  h.stage,
  h.profile_id,
  p.employee_number,
  p.employment_status as linked_employment_status,
  h.planned_crew_id,
  pc.crew_name as planned_crew_name,
  cc.crew_id as current_crew_id,
  cc.crew_name as current_crew_name,
  h.available_from,
  h.offer_date,
  h.hire_date,
  h.notes,
  h.is_archived,
  coalesce(ir.required_item_count,0)::int as required_item_count,
  coalesce(ir.onboarding_blocker_count,0)::int as onboarding_blocker_count,
  coalesce(ir.document_blocker_count,0)::int as document_blocker_count,
  coalesce(ir.orientation_blocker_count,0)::int as orientation_blocker_count,
  coalesce(ir.seasonal_service_blocker_count,0)::int as seasonal_service_blocker_count,
  coalesce(ir.winter_readiness_blocker_count,0)::int as winter_readiness_blocker_count,
  coalesce(tr.training_requirement_count,0)::int as training_requirement_count,
  coalesce(tr.training_blocker_count,0)::int as training_blocker_count,
  coalesce(tr.equipment_authorization_blocker_count,0)::int as equipment_authorization_blocker_count,
  (cc.crew_id is not null) as canonical_crew_assignment_ready,
  (
    h.profile_id is not null
    and h.stage in ('hired','documents','orientation','training','equipment_authorization','crew_assignment','ready')
    and coalesce(ir.onboarding_blocker_count,0)=0
    and coalesce(tr.training_blocker_count,0)=0
    and coalesce(tr.equipment_authorization_blocker_count,0)=0
    and cc.crew_id is not null
  ) as pre_field_ready,
  case
    when h.profile_id is null then 'link_employee_profile'
    when coalesce(ir.document_blocker_count,0)>0 then 'documents'
    when coalesce(ir.orientation_blocker_count,0)>0 then 'orientation'
    when coalesce(ir.seasonal_service_blocker_count,0)>0 then 'seasonal_service_orientation'
    when coalesce(tr.training_blocker_count,0)>0 then 'training'
    when coalesce(tr.equipment_authorization_blocker_count,0)>0 then 'equipment_authorization'
    when cc.crew_id is null then 'crew_assignment'
    else 'ready'
  end as next_readiness_gate,
  ir.last_onboarding_update_at,
  h.created_at,
  h.updated_at
from public.workforce_hiring_candidates h
left join public.profiles p on p.id=h.profile_id
left join public.crews pc on pc.id=h.planned_crew_id
left join item_rollup ir on ir.candidate_id=h.id
left join training_rollup tr on tr.profile_id=h.profile_id
left join current_crew cc on cc.profile_id=h.profile_id;

revoke all on table public.v_workforce_hiring_onboarding_overview from public,anon,authenticated;
grant select on table public.v_workforce_hiring_onboarding_overview to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  227,'hiring_onboarding_workflow',
  'Build 339 adds Applicant through pre-field-ready hiring and onboarding evidence around canonical workforce, training, internal authorization and crew authorities.',
  'applied',now(),'schema227',
  'Four-season Ontario readiness includes spring/summer landscaping and mowing, fall cleanup, and winter snow clearing/removal orientation. Candidate records never replace profiles, crew_members, training records or internal authorization truth.',
  '227_hiring_onboarding_workflow.sql','schema227'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true)
as
select
  227 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=227 then 'current'
    when coalesce(max(schema_version) filter(where status='applied'),0)>227 then 'ahead'
    else 'drift'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=227 then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter(where status='applied'),0)>227 then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
