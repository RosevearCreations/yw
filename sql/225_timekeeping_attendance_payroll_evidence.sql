begin;

-- Schema 225 — Build 337 Timekeeping, Attendance & Payroll Evidence.
-- Extends the canonical employee_time_entries / breaks / job_session_crew_hours /
-- attendance-review / payroll-export authorities. No parallel clock or payroll ledger is created.

alter table public.employee_time_entries
  add column if not exists travel_minutes integer not null default 0,
  add column if not exists employee_explanation text,
  add column if not exists approved_break_minutes_override integer,
  add column if not exists supervisor_approval_status text not null default 'pending',
  add column if not exists supervisor_approval_note text,
  add column if not exists supervisor_approved_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists supervisor_approved_at timestamptz,
  add column if not exists correction_version integer not null default 0;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='employee_time_entries_travel_minutes_chk') then
    alter table public.employee_time_entries add constraint employee_time_entries_travel_minutes_chk
      check (travel_minutes>=0);
  end if;
  if not exists(select 1 from pg_constraint where conname='employee_time_entries_break_override_chk') then
    alter table public.employee_time_entries add constraint employee_time_entries_break_override_chk
      check (approved_break_minutes_override is null or approved_break_minutes_override>=0);
  end if;
  if not exists(select 1 from pg_constraint where conname='employee_time_entries_supervisor_approval_status_chk') then
    alter table public.employee_time_entries add constraint employee_time_entries_supervisor_approval_status_chk
      check (supervisor_approval_status in ('pending','approved','returned','not_required'));
  end if;
  if not exists(select 1 from pg_constraint where conname='employee_time_entries_correction_version_chk') then
    alter table public.employee_time_entries add constraint employee_time_entries_correction_version_chk
      check (correction_version>=0);
  end if;
end $$;

create table if not exists public.employee_time_corrections (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid not null references public.employee_time_entries(id) on delete cascade,
  correction_status text not null default 'pending',
  correction_reason text not null,
  employee_explanation text not null,
  requested_signed_in_at timestamptz,
  requested_signed_out_at timestamptz,
  requested_break_minutes integer,
  requested_travel_minutes integer,
  before_snapshot jsonb not null default '{}'::jsonb,
  after_snapshot jsonb,
  requested_by_profile_id uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_time_corrections_status_chk check (correction_status in ('pending','approved','rejected','cancelled')),
  constraint employee_time_corrections_break_chk check (requested_break_minutes is null or requested_break_minutes>=0),
  constraint employee_time_corrections_travel_chk check (requested_travel_minutes is null or requested_travel_minutes>=0),
  constraint employee_time_corrections_clock_chk check (
    requested_signed_out_at is null or requested_signed_in_at is null or requested_signed_out_at>=requested_signed_in_at
  )
);

create index if not exists employee_time_corrections_entry_idx
  on public.employee_time_corrections(time_entry_id,created_at desc);
create index if not exists employee_time_corrections_status_idx
  on public.employee_time_corrections(correction_status,created_at desc);
create index if not exists employee_time_entries_payroll_approval_idx
  on public.employee_time_entries(supervisor_approval_status,signed_in_at desc);

alter table public.employee_time_corrections enable row level security;
revoke all on table public.employee_time_corrections from public,anon,authenticated;
grant select,insert,update on table public.employee_time_corrections to service_role;

create or replace view public.v_timekeeping_correction_audit
with (security_invoker=true)
as
select
  c.id,
  c.time_entry_id,
  te.profile_id,
  p.full_name,
  p.employee_number,
  te.job_id,
  j.job_code,
  j.job_name,
  c.correction_status,
  c.correction_reason,
  c.employee_explanation,
  c.requested_signed_in_at,
  c.requested_signed_out_at,
  c.requested_break_minutes,
  c.requested_travel_minutes,
  c.before_snapshot,
  c.after_snapshot,
  c.requested_by_profile_id,
  requester.full_name as requested_by_name,
  c.requested_at,
  c.reviewed_by_profile_id,
  reviewer.full_name as reviewed_by_name,
  c.reviewed_at,
  c.review_note,
  c.applied_at,
  c.updated_at
from public.employee_time_corrections c
join public.employee_time_entries te on te.id=c.time_entry_id
left join public.profiles p on p.id=te.profile_id
left join public.profiles requester on requester.id=c.requested_by_profile_id
left join public.profiles reviewer on reviewer.id=c.reviewed_by_profile_id
left join public.jobs j on j.id=te.job_id;

create or replace view public.v_timekeeping_payroll_evidence
with (security_invoker=true)
as
with review_state as (
  select
    q.time_entry_id,
    count(*) filter(where q.needs_review=true)::int as open_review_count,
    string_agg(distinct q.issue_code,', ' order by q.issue_code) filter(where q.needs_review=true) as open_review_codes
  from public.v_employee_time_review_queue q
  group by q.time_entry_id
), correction_state as (
  select
    c.time_entry_id,
    count(*)::int as correction_count,
    count(*) filter(where c.correction_status='pending')::int as pending_correction_count,
    max(c.updated_at) as last_correction_at
  from public.employee_time_corrections c
  group by c.time_entry_id
)
select
  te.id as time_entry_id,
  te.profile_id,
  p.full_name,
  p.employee_number,
  te.crew_id,
  cr.crew_name,
  te.job_id,
  j.job_code,
  j.job_name,
  te.job_session_id,
  te.site_id,
  s.site_code,
  s.site_name,
  te.clock_status,
  te.signed_in_at,
  te.signed_out_at,
  te.total_elapsed_minutes as shift_minutes,
  coalesce(te.approved_break_minutes_override,te.unpaid_break_minutes,0)::int as break_minutes,
  greatest(coalesce(te.paid_work_minutes,0)-coalesce(te.travel_minutes,0),0)::int as job_work_minutes,
  coalesce(te.travel_minutes,0)::int as travel_minutes,
  coalesce(te.paid_work_minutes,0)::int as paid_minutes,
  round(coalesce(jh.regular_hours,0)::numeric,2) as regular_hours,
  round(coalesce(jh.overtime_hours,0)::numeric,2) as overtime_hours,
  round(coalesce(jh.hours_worked,coalesce(te.paid_work_minutes,0)/60.0)::numeric,2) as allocated_hours,
  jh.pay_code,
  jh.payroll_export_run_id,
  jh.payroll_exported_at,
  te.employee_explanation,
  te.exception_status,
  coalesce(rs.open_review_count,0)::int as open_review_count,
  coalesce(rs.open_review_codes,'') as open_review_codes,
  coalesce(cs.correction_count,0)::int as correction_count,
  coalesce(cs.pending_correction_count,0)::int as pending_correction_count,
  cs.last_correction_at,
  te.correction_version,
  te.supervisor_approval_status,
  te.supervisor_approval_note,
  te.supervisor_approved_by_profile_id,
  approver.full_name as supervisor_approved_by_name,
  te.supervisor_approved_at,
  case
    when te.signed_out_at is null or te.clock_status in ('active','paused') then 'open_shift'
    when coalesce(cs.pending_correction_count,0)>0 then 'correction_pending'
    when coalesce(rs.open_review_count,0)>0 or coalesce(te.exception_status,'clear') not in ('clear','resolved','reviewed') then 'attendance_review'
    when te.supervisor_approval_status<>'approved' then 'supervisor_approval'
    else 'ready'
  end as payroll_readiness_status,
  case
    when te.signed_out_at is not null
      and coalesce(cs.pending_correction_count,0)=0
      and coalesce(rs.open_review_count,0)=0
      and coalesce(te.exception_status,'clear') in ('clear','resolved','reviewed')
      and te.supervisor_approval_status='approved'
    then true else false
  end as payroll_ready,
  te.updated_at
from public.employee_time_entries te
left join public.profiles p on p.id=te.profile_id
left join public.crews cr on cr.id=te.crew_id
left join public.jobs j on j.id=te.job_id
left join public.sites s on s.id=te.site_id
left join public.job_session_crew_hours jh on jh.time_entry_id=te.id
left join public.profiles approver on approver.id=te.supervisor_approved_by_profile_id
left join review_state rs on rs.time_entry_id=te.id
left join correction_state cs on cs.time_entry_id=te.id;

create or replace view public.v_timekeeping_attendance_summary
with (security_invoker=true)
as
select
  count(*)::int as entry_count,
  count(*) filter(where clock_status in ('active','paused') and signed_out_at is null)::int as open_shift_count,
  count(*) filter(where payroll_readiness_status='attendance_review')::int as attendance_review_count,
  count(*) filter(where payroll_readiness_status='correction_pending')::int as correction_pending_count,
  count(*) filter(where payroll_readiness_status='supervisor_approval')::int as supervisor_approval_count,
  count(*) filter(where payroll_ready=true)::int as payroll_ready_count,
  coalesce(sum(paid_minutes) filter(where signed_in_at>=current_date-interval '14 days'),0)::bigint as recent_paid_minutes,
  coalesce(sum(travel_minutes) filter(where signed_in_at>=current_date-interval '14 days'),0)::bigint as recent_travel_minutes,
  max(updated_at) as last_activity_at
from public.v_timekeeping_payroll_evidence;

revoke all on table public.v_timekeeping_correction_audit from public,anon,authenticated;
revoke all on table public.v_timekeeping_payroll_evidence from public,anon,authenticated;
revoke all on table public.v_timekeeping_attendance_summary from public,anon,authenticated;
grant select on table public.v_timekeeping_correction_audit to service_role;
grant select on table public.v_timekeeping_payroll_evidence to service_role;
grant select on table public.v_timekeeping_attendance_summary to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  225,'timekeeping_attendance_payroll_evidence',
  'Build 337 consolidates shift, break, travel, attendance review, correction, supervisor approval, job-cost allocation and payroll-ready evidence around the existing employee time and payroll authorities.',
  'applied',now(),'schema225',
  'employee_time_entries remains the time authority; employee_time_entry_breaks remains break evidence; job_session_crew_hours remains job-cost/payroll allocation; existing payroll_export_runs remains the Finance export/provider authority. Corrections are auditable and payroll readiness does not post or transmit payroll.',
  '225_timekeeping_attendance_payroll_evidence.sql','schema225'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true)
as
select
  225 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=225 then 'current'
    when coalesce(max(schema_version) filter(where status='applied'),0)>225 then 'ahead'
    else 'drift'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=225 then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter(where status='applied'),0)>225 then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
