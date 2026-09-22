begin;

-- Schema 226 — Build 338 Performance & Development.
-- Extends canonical workforce, training and timekeeping evidence without creating
-- a second employee, safety-incident, training, attendance or payroll authority.

create table if not exists public.workforce_role_expectations (
  id uuid primary key default gen_random_uuid(),
  role_key text not null,
  expectation_title text not null,
  expectation_area text not null default 'role',
  expectation_text text not null,
  evidence_guidance text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workforce_coaching_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  coach_profile_id uuid references public.profiles(id) on delete set null,
  expectation_id uuid references public.workforce_role_expectations(id) on delete set null,
  record_type text not null default 'coaching',
  topic text not null,
  summary text not null,
  observed_on date not null default current_date,
  follow_up_date date,
  record_status text not null default 'open',
  closed_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workforce_coaching_records_type_chk check (record_type in ('coaching','recognition','check_in','feedback')),
  constraint workforce_coaching_records_status_chk check (record_status in ('open','follow_up_due','closed'))
);

create table if not exists public.workforce_development_plans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  plan_title text not null,
  goal_text text not null,
  skill_id uuid references public.workforce_skills(id) on delete set null,
  training_requirement_code text,
  started_on date not null default current_date,
  target_date date,
  plan_status text not null default 'active',
  progress_note text,
  completed_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workforce_development_plans_status_chk check (plan_status in ('draft','active','on_hold','completed','cancelled'))
);

create table if not exists public.workforce_performance_reviews (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_profile_id uuid references public.profiles(id) on delete set null,
  review_period_start date,
  review_period_end date,
  review_status text not null default 'draft',
  summary text not null,
  strengths text,
  development_focus text,
  employee_comment text,
  follow_up_date date,
  completed_at timestamptz,
  acknowledged_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workforce_performance_reviews_status_chk check (review_status in ('draft','completed','acknowledged','superseded')),
  constraint workforce_performance_reviews_period_chk check (review_period_end is null or review_period_start is null or review_period_end>=review_period_start)
);

create table if not exists public.workforce_improvement_actions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  review_id uuid references public.workforce_performance_reviews(id) on delete set null,
  action_text text not null,
  success_measure text,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  due_date date,
  follow_up_date date,
  action_status text not null default 'open',
  outcome_note text,
  completed_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workforce_improvement_actions_status_chk check (action_status in ('open','in_progress','completed','cancelled'))
);

create index if not exists workforce_role_expectations_role_idx on public.workforce_role_expectations(role_key,is_active,sort_order);
create index if not exists workforce_coaching_profile_idx on public.workforce_coaching_records(profile_id,observed_on desc);
create index if not exists workforce_development_profile_idx on public.workforce_development_plans(profile_id,plan_status,target_date);
create index if not exists workforce_reviews_profile_idx on public.workforce_performance_reviews(profile_id,review_period_end desc);
create index if not exists workforce_improvement_profile_idx on public.workforce_improvement_actions(profile_id,action_status,due_date);

alter table public.workforce_role_expectations enable row level security;
alter table public.workforce_coaching_records enable row level security;
alter table public.workforce_development_plans enable row level security;
alter table public.workforce_performance_reviews enable row level security;
alter table public.workforce_improvement_actions enable row level security;

revoke all on table public.workforce_role_expectations from public,anon,authenticated;
revoke all on table public.workforce_coaching_records from public,anon,authenticated;
revoke all on table public.workforce_development_plans from public,anon,authenticated;
revoke all on table public.workforce_performance_reviews from public,anon,authenticated;
revoke all on table public.workforce_improvement_actions from public,anon,authenticated;
grant select,insert,update on table public.workforce_role_expectations to service_role;
grant select,insert,update on table public.workforce_coaching_records to service_role;
grant select,insert,update on table public.workforce_development_plans to service_role;
grant select,insert,update on table public.workforce_performance_reviews to service_role;
grant select,insert,update on table public.workforce_improvement_actions to service_role;

create or replace view public.v_workforce_attendance_patterns
with (security_invoker=true)
as
select
  t.profile_id,
  count(*) filter(where t.signed_in_at>=current_date-interval '90 days')::int as recent_shift_count,
  count(*) filter(where t.signed_in_at>=current_date-interval '90 days' and t.open_review_count>0)::int as attendance_review_count,
  count(*) filter(where t.signed_in_at>=current_date-interval '90 days' and t.pending_correction_count>0)::int as correction_pending_count,
  count(*) filter(where t.signed_in_at>=current_date-interval '90 days' and t.supervisor_approval_status<>'approved')::int as supervisor_approval_pending_count,
  count(*) filter(where t.signed_in_at>=current_date-interval '90 days' and t.payroll_ready=true)::int as payroll_ready_count,
  coalesce(sum(t.overtime_hours) filter(where t.signed_in_at>=current_date-interval '90 days'),0)::numeric as recent_overtime_hours,
  coalesce(sum(t.travel_minutes) filter(where t.signed_in_at>=current_date-interval '90 days'),0)::bigint as recent_travel_minutes,
  max(t.signed_in_at) as last_shift_at
from public.v_timekeeping_payroll_evidence t
group by t.profile_id;

create or replace view public.v_workforce_performance_development_overview
with (security_invoker=true)
as
with coaching as (
  select profile_id,
    count(*)::int as coaching_record_count,
    count(*) filter(where record_type='recognition')::int as recognition_count,
    count(*) filter(where record_status<>'closed' and follow_up_date is not null and follow_up_date<=current_date)::int as coaching_follow_up_due_count,
    max(observed_on) as last_coaching_on
  from public.workforce_coaching_records group by profile_id
), plans as (
  select profile_id,
    count(*) filter(where plan_status in ('draft','active','on_hold'))::int as open_development_plan_count,
    count(*) filter(where plan_status in ('draft','active','on_hold') and target_date is not null and target_date<=current_date)::int as development_due_count,
    max(updated_at) as last_development_update_at
  from public.workforce_development_plans group by profile_id
), reviews as (
  select profile_id,
    count(*)::int as review_count,
    count(*) filter(where review_status='draft')::int as draft_review_count,
    max(review_period_end) as last_review_period_end,
    max(completed_at) as last_review_completed_at
  from public.workforce_performance_reviews group by profile_id
), actions as (
  select profile_id,
    count(*) filter(where action_status in ('open','in_progress'))::int as open_improvement_action_count,
    count(*) filter(where action_status in ('open','in_progress') and due_date is not null and due_date<=current_date)::int as improvement_due_count,
    min(due_date) filter(where action_status in ('open','in_progress')) as next_improvement_due_date
  from public.workforce_improvement_actions group by profile_id
)
select
  p.id as profile_id,
  p.full_name,
  p.employee_number,
  p.email,
  p.role,
  p.current_position,
  p.employment_status,
  p.default_supervisor_profile_id,
  supervisor.full_name as supervisor_name,
  coalesce(c.coaching_record_count,0)::int as coaching_record_count,
  coalesce(c.recognition_count,0)::int as recognition_count,
  coalesce(c.coaching_follow_up_due_count,0)::int as coaching_follow_up_due_count,
  c.last_coaching_on,
  coalesce(dp.open_development_plan_count,0)::int as open_development_plan_count,
  coalesce(dp.development_due_count,0)::int as development_due_count,
  dp.last_development_update_at,
  coalesce(r.review_count,0)::int as review_count,
  coalesce(r.draft_review_count,0)::int as draft_review_count,
  r.last_review_period_end,
  r.last_review_completed_at,
  coalesce(a.open_improvement_action_count,0)::int as open_improvement_action_count,
  coalesce(a.improvement_due_count,0)::int as improvement_due_count,
  a.next_improvement_due_date,
  coalesce(ap.recent_shift_count,0)::int as recent_shift_count,
  coalesce(ap.attendance_review_count,0)::int as attendance_review_count,
  coalesce(ap.correction_pending_count,0)::int as correction_pending_count,
  coalesce(ap.supervisor_approval_pending_count,0)::int as supervisor_approval_pending_count,
  coalesce(ap.payroll_ready_count,0)::int as payroll_ready_count,
  coalesce(ap.recent_overtime_hours,0)::numeric as recent_overtime_hours,
  coalesce(ap.recent_travel_minutes,0)::bigint as recent_travel_minutes,
  ap.last_shift_at
from public.profiles p
left join public.profiles supervisor on supervisor.id=p.default_supervisor_profile_id
left join coaching c on c.profile_id=p.id
left join plans dp on dp.profile_id=p.id
left join reviews r on r.profile_id=p.id
left join actions a on a.profile_id=p.id
left join public.v_workforce_attendance_patterns ap on ap.profile_id=p.id
where coalesce(p.is_active,true)=true;

revoke all on table public.v_workforce_attendance_patterns from public,anon,authenticated;
revoke all on table public.v_workforce_performance_development_overview from public,anon,authenticated;
grant select on table public.v_workforce_attendance_patterns to service_role;
grant select on table public.v_workforce_performance_development_overview to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  226,'performance_development',
  'Build 338 adds role expectations, coaching/recognition, development plans, documented reviews, improvement actions and derived attendance-pattern context around the canonical workforce, training and timekeeping authorities.',
  'applied',now(),'schema226',
  'Safety incident and near-miss truth remains in the Safety module and is not joined into performance-management records. Attendance context is derived from Build 337 timekeeping evidence. Training and authorization truth remains with Build 330.',
  '226_performance_development.sql','schema226'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true)
as
select
  226 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=226 then 'current'
    when coalesce(max(schema_version) filter(where status='applied'),0)>226 then 'ahead'
    else 'drift'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=226 then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter(where status='applied'),0)>226 then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
