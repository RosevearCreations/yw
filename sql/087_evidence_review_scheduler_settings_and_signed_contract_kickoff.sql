-- 087_evidence_review_scheduler_settings_and_signed_contract_kickoff.sql
-- Adds:
-- - Admin-visible attendance / HSE evidence review views
-- - scheduler settings/status for service execution automation
-- - signed-contract kickoff candidates for live jobs
-- - payroll close review summaries for provider-ready delivery

create table if not exists public.service_execution_scheduler_settings (
  id uuid primary key default gen_random_uuid(),
  setting_code text not null unique,
  is_enabled boolean not null default false,
  run_timezone text not null default 'America/Toronto',
  cadence text not null default 'daily',
  run_hour_local integer not null default 4,
  run_minute_local integer not null default 0,
  lookahead_days integer not null default 1,
  auto_create_sessions boolean not null default true,
  auto_stage_invoices boolean not null default true,
  require_linked_job boolean not null default true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.service_execution_scheduler_settings
  drop constraint if exists service_execution_scheduler_settings_cadence_check;

alter table if exists public.service_execution_scheduler_settings
  add constraint service_execution_scheduler_settings_cadence_check
  check (cadence in ('manual','hourly','daily','weekly'));

alter table if exists public.service_execution_scheduler_settings
  drop constraint if exists service_execution_scheduler_settings_run_hour_check;

alter table if exists public.service_execution_scheduler_settings
  add constraint service_execution_scheduler_settings_run_hour_check
  check (run_hour_local between 0 and 23);

alter table if exists public.service_execution_scheduler_settings
  drop constraint if exists service_execution_scheduler_settings_run_minute_check;

alter table if exists public.service_execution_scheduler_settings
  add constraint service_execution_scheduler_settings_run_minute_check
  check (run_minute_local between 0 and 59);

alter table if exists public.service_execution_scheduler_settings
  drop constraint if exists service_execution_scheduler_settings_lookahead_days_check;

alter table if exists public.service_execution_scheduler_settings
  add constraint service_execution_scheduler_settings_lookahead_days_check
  check (lookahead_days between 0 and 14);

create index if not exists idx_service_execution_scheduler_settings_enabled
  on public.service_execution_scheduler_settings(is_enabled, next_run_at);

insert into public.service_execution_scheduler_settings (
  setting_code,
  is_enabled,
  run_timezone,
  cadence,
  run_hour_local,
  run_minute_local,
  lookahead_days,
  auto_create_sessions,
  auto_stage_invoices,
  require_linked_job,
  next_run_at,
  notes
)
select
  'default',
  false,
  'America/Toronto',
  'daily',
  4,
  0,
  1,
  true,
  true,
  true,
  null,
  'Default scheduler settings row for service execution automation.'
where not exists (
  select 1 from public.service_execution_scheduler_settings where setting_code = 'default'
);

create or replace view public.v_service_execution_scheduler_status as
with latest_run as (
  select distinct on (coalesce(agreement_id::text, 'ALL'))
    coalesce(agreement_id::text, 'ALL') as agreement_key,
    id,
    agreement_id,
    run_code,
    run_mode,
    run_status,
    candidate_count,
    session_created_count,
    invoice_candidate_count,
    skipped_count,
    created_at,
    updated_at
  from public.service_execution_scheduler_runs
  order by coalesce(agreement_id::text, 'ALL'), created_at desc
)
select
  s.id,
  s.setting_code,
  s.is_enabled,
  s.run_timezone,
  s.cadence,
  s.run_hour_local,
  s.run_minute_local,
  s.lookahead_days,
  s.auto_create_sessions,
  s.auto_stage_invoices,
  s.require_linked_job,
  s.last_run_at,
  s.next_run_at,
  s.notes,
  lr.id as latest_run_id,
  lr.run_code as latest_run_code,
  lr.run_mode as latest_run_mode,
  lr.run_status as latest_run_status,
  lr.candidate_count as latest_candidate_count,
  lr.session_created_count as latest_session_created_count,
  lr.invoice_candidate_count as latest_invoice_candidate_count,
  lr.skipped_count as latest_skipped_count,
  lr.created_at as latest_run_created_at,
  case
    when s.is_enabled = true and s.next_run_at is not null and s.next_run_at <= now() then true
    else false
  end as is_due
from public.service_execution_scheduler_settings s
left join latest_run lr on lr.agreement_key = 'ALL';

create or replace view public.v_attendance_photo_review as
select
  e.id as time_entry_id,
  e.profile_id,
  e.full_name,
  e.employee_number,
  e.job_id,
  e.job_code,
  e.job_name,
  e.site_id,
  e.site_name,
  'clock_in'::text as photo_stage,
  e.clock_in_photo_url as photo_url,
  e.clock_in_photo_note as photo_note,
  e.clock_in_photo_bucket as storage_bucket,
  e.clock_in_photo_path as storage_path,
  e.clock_in_photo_uploaded_at as uploaded_at,
  e.clock_in_geofence_status as geofence_status,
  e.clock_in_geofence_distance_meters as geofence_distance_meters,
  e.currently_overdue_sign_out,
  e.long_break_exception_flag,
  e.attendance_exception_notes,
  e.signed_in_at,
  e.signed_out_at
from public.v_employee_time_clock_entries e
where e.has_clock_in_photo = true

union all

select
  e.id as time_entry_id,
  e.profile_id,
  e.full_name,
  e.employee_number,
  e.job_id,
  e.job_code,
  e.job_name,
  e.site_id,
  e.site_name,
  'clock_out'::text as photo_stage,
  e.clock_out_photo_url as photo_url,
  e.clock_out_photo_note as photo_note,
  e.clock_out_photo_bucket as storage_bucket,
  e.clock_out_photo_path as storage_path,
  e.clock_out_photo_uploaded_at as uploaded_at,
  e.clock_out_geofence_status as geofence_status,
  e.clock_out_geofence_distance_meters as geofence_distance_meters,
  e.currently_overdue_sign_out,
  e.long_break_exception_flag,
  e.attendance_exception_notes,
  e.signed_in_at,
  e.signed_out_at
from public.v_employee_time_clock_entries e
where e.has_clock_out_photo = true;

create or replace view public.v_hse_evidence_review as
select
  p.id as proof_id,
  p.packet_id,
  hp.packet_number,
  hp.packet_type,
  hp.packet_status,
  p.proof_stage,
  p.proof_kind,
  p.public_url,
  p.storage_bucket,
  p.storage_path,
  p.file_name,
  p.mime_type,
  p.caption,
  p.proof_notes,
  p.uploaded_by_profile_id,
  pr.full_name as uploaded_by_name,
  p.created_at,
  p.updated_at
from public.hse_packet_proofs p
left join public.linked_hse_packets hp on hp.id = p.packet_id
left join public.profiles pr on pr.id = p.uploaded_by_profile_id;

create or replace view public.v_signed_contract_job_kickoff_candidates as
with linked_jobs as (
  select
    d.id as contract_document_id,
    min(j.id) as linked_job_id
  from public.service_contract_documents d
  left join public.recurring_service_agreements a on a.id = d.agreement_id
  left join public.jobs j
    on upper(coalesce(j.service_contract_reference, '')) = upper(coalesce(a.agreement_code, d.contract_reference, ''))
  group by d.id
)
select
  d.id as contract_document_id,
  d.document_number,
  d.document_kind,
  d.document_status,
  d.title,
  d.contract_reference,
  d.signed_at,
  d.signed_by_name,
  d.client_id,
  d.client_site_id,
  d.agreement_id,
  d.estimate_id,
  d.job_id as direct_job_id,
  lj.linked_job_id,
  a.agreement_code,
  a.service_name,
  a.route_id,
  a.crew_id,
  a.tax_code_id,
  coalesce(a.visit_cost_total, e.subtotal, 0)::numeric(12,2) as estimated_cost_total,
  coalesce(a.visit_charge_total, e.total_amount, 0)::numeric(12,2) as quoted_charge_total,
  case
    when d.document_status = 'signed' or d.signed_at is not null then true
    else false
  end as is_signed_ready,
  case
    when coalesce(d.job_id::text, '') <> '' or coalesce(lj.linked_job_id::text, '') <> '' then 'linked_job_exists'
    when d.document_status = 'signed' or d.signed_at is not null then 'ready'
    else 'not_signed'
  end as kickoff_status,
  concat('JOB-', regexp_replace(coalesce(a.agreement_code, d.document_number, d.contract_reference, d.id::text), '[^A-Za-z0-9]+', '-', 'g')) as suggested_job_code,
  coalesce(a.service_name, d.title, 'Signed Contract Job') as suggested_job_name
from public.service_contract_documents d
left join public.recurring_service_agreements a on a.id = d.agreement_id
left join public.estimates e on e.id = d.estimate_id
left join linked_jobs lj on lj.contract_document_id = d.id
where d.document_kind in ('contract','application');

create or replace view public.v_payroll_close_review_summary as
with export_rollup as (
  select
    count(*)::int as export_run_count,
    count(*) filter (where coalesce(status, '') <> 'exported')::int as open_export_run_count,
    max(exported_at) as last_exported_at,
    coalesce(sum(coalesce(exported_entry_count, 0)), 0)::int as exported_entry_count_total,
    coalesce(sum(coalesce(exported_hours_total, 0)), 0)::numeric(10,2) as exported_hours_total,
    coalesce(sum(coalesce(exported_payroll_cost_total, 0)), 0)::numeric(12,2) as exported_payroll_cost_total
  from public.payroll_export_runs
), attendance_rollup as (
  select
    coalesce(sum(unexported_entry_count), 0)::int as unexported_entry_count,
    coalesce(sum(unexported_hours_total), 0)::numeric(10,2) as unexported_hours_total,
    coalesce(sum(unexported_payroll_cost_total), 0)::numeric(12,2) as unexported_payroll_cost_total
  from public.v_payroll_review_summary
), review_rollup as (
  select
    count(*) filter (where needs_review = true)::int as attendance_review_needed_count
  from public.v_employee_time_review_queue
), clock_rollup as (
  select
    coalesce(overdue_sign_out_count, 0)::int as overdue_sign_out_count,
    coalesce(attendance_exception_count, 0)::int as attendance_exception_count
  from public.v_employee_time_clock_summary
)
select
  er.export_run_count,
  er.open_export_run_count,
  er.last_exported_at,
  er.exported_entry_count_total,
  er.exported_hours_total,
  er.exported_payroll_cost_total,
  ar.unexported_entry_count,
  ar.unexported_hours_total,
  ar.unexported_payroll_cost_total,
  rr.attendance_review_needed_count,
  cr.overdue_sign_out_count,
  cr.attendance_exception_count
from export_rollup er
cross join attendance_rollup ar
cross join review_rollup rr
cross join clock_rollup cr;
