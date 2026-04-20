-- 085_attendance_photo_geofence_scheduler_and_signed_contract_invoice.sql
-- Adds:
-- - full attendance photo upload/storage metadata for clock-in and clock-out
-- - geofence distance/status rules against site coordinates
-- - service-execution scheduler run tracking and candidate views
-- - provider-specific payroll export layouts
-- - signed-contract-only invoice candidates and generation support

create extension if not exists pgcrypto;

alter table if exists public.employee_time_entries
  add column if not exists clock_in_photo_bucket text,
  add column if not exists clock_in_photo_path text,
  add column if not exists clock_in_photo_url text,
  add column if not exists clock_in_photo_file_name text,
  add column if not exists clock_in_photo_mime_type text,
  add column if not exists clock_in_photo_uploaded_at timestamptz,
  add column if not exists clock_out_photo_bucket text,
  add column if not exists clock_out_photo_path text,
  add column if not exists clock_out_photo_url text,
  add column if not exists clock_out_photo_file_name text,
  add column if not exists clock_out_photo_mime_type text,
  add column if not exists clock_out_photo_uploaded_at timestamptz;

alter table if exists public.payroll_export_runs
  add column if not exists export_provider text not null default 'generic_csv',
  add column if not exists provider_layout_name text;

alter table if exists public.payroll_export_runs
  drop constraint if exists payroll_export_runs_export_provider_check;

alter table if exists public.payroll_export_runs
  add constraint payroll_export_runs_export_provider_check
  check (export_provider in ('generic_csv','quickbooks_time_csv','simplepay_csv','adp_csv','json'));

alter table if exists public.service_contract_documents
  add column if not exists signed_at timestamptz,
  add column if not exists signed_by_name text,
  add column if not exists signed_by_email text,
  add column if not exists signature_notes text,
  add column if not exists auto_generate_invoice boolean not null default false,
  add column if not exists generated_invoice_id uuid references public.ar_invoices(id) on delete set null,
  add column if not exists invoice_generated_at timestamptz;

create table if not exists public.service_execution_scheduler_runs (
  id uuid primary key default gen_random_uuid(),
  run_code text not null unique,
  run_status text not null default 'draft',
  candidate_count integer not null default 0,
  sessions_created_count integer not null default 0,
  invoices_created_count integer not null default 0,
  notes text,
  last_error text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  ran_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.service_execution_scheduler_runs
  drop constraint if exists service_execution_scheduler_runs_status_check;

alter table if exists public.service_execution_scheduler_runs
  add constraint service_execution_scheduler_runs_status_check
  check (run_status in ('draft','running','completed','completed_with_warnings','failed'));

create index if not exists idx_service_execution_scheduler_runs_ran_at
  on public.service_execution_scheduler_runs(ran_at desc, created_at desc);

create or replace view public.v_employee_time_clock_entries as
select
  te.id,
  te.profile_id,
  p.full_name,
  p.employee_number,
  te.crew_id,
  c.crew_name,
  c.crew_code,
  te.job_id,
  j.job_code,
  j.job_name,
  te.site_id,
  s.site_code,
  s.site_name,
  te.job_session_id,
  js.session_date,
  js.session_status,
  te.clock_status,
  te.signed_in_at,
  te.last_status_at,
  te.signed_out_at,
  te.total_elapsed_minutes,
  coalesce(br.unpaid_break_minutes, te.unpaid_break_minutes, 0)::int as unpaid_break_minutes,
  te.paid_work_minutes,
  te.clock_in_latitude,
  te.clock_in_longitude,
  te.clock_in_accuracy_m,
  te.clock_in_geo_source,
  te.clock_in_photo_note,
  te.clock_out_latitude,
  te.clock_out_longitude,
  te.clock_out_accuracy_m,
  te.clock_out_geo_source,
  te.clock_out_photo_note,
  te.exception_status,
  te.exception_notes,
  te.exception_reviewed_at,
  te.exception_reviewed_by_profile_id,
  te.notes,
  te.created_by_profile_id,
  actor.full_name as created_by_name,
  coalesce(br.break_count, 0)::int as break_count,
  coalesce(br.open_break_count, 0)::int as open_break_count,
  br.last_break_started_at,
  br.last_break_ended_at,
  to_char(te.signed_in_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') as signed_in_at_local,
  to_char(te.signed_out_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') as signed_out_at_local,
  te.created_at,
  te.updated_at,
  te.clock_in_geofence_status,
  te.clock_out_geofence_status,
  te.clock_in_geofence_distance_meters,
  te.clock_out_geofence_distance_meters,
  te.attendance_exception_notes,
  te.clock_in_photo_bucket,
  te.clock_in_photo_path,
  te.clock_in_photo_url,
  te.clock_in_photo_file_name,
  te.clock_in_photo_mime_type,
  te.clock_in_photo_uploaded_at,
  te.clock_out_photo_bucket,
  te.clock_out_photo_path,
  te.clock_out_photo_url,
  te.clock_out_photo_file_name,
  te.clock_out_photo_mime_type,
  te.clock_out_photo_uploaded_at,
  s.expected_latitude as site_expected_latitude,
  s.expected_longitude as site_expected_longitude,
  s.geofence_radius_meters,
  s.geofence_notes
from public.employee_time_entries te
left join public.profiles p on p.id = te.profile_id
left join public.crews c on c.id = te.crew_id
left join public.jobs j on j.id = te.job_id
left join public.sites s on s.id = te.site_id
left join public.job_sessions js on js.id = te.job_session_id
left join public.profiles actor on actor.id = te.created_by_profile_id
left join public.v_employee_time_entry_break_rollups br on br.time_entry_id = te.id;

create or replace view public.v_service_agreement_execution_candidates as
with active_agreements as (
  select
    a.*,
    scd.id as signed_contract_document_id,
    scd.document_number as signed_contract_document_number,
    scd.signed_at,
    greatest(current_date, coalesce(a.start_date, current_date)) as candidate_date
  from public.recurring_service_agreements a
  left join public.service_contract_documents scd
    on scd.id = a.contract_document_id
   and scd.document_status = 'signed'
  where a.agreement_status = 'active'
    and coalesce(a.start_date, current_date) <= current_date
    and (coalesce(a.open_end_date, false) = true or a.end_date is null or a.end_date >= current_date)
), linked_jobs as (
  select
    a.id as agreement_id,
    j.id as job_id,
    j.job_code,
    j.job_name,
    row_number() over (partition by a.id order by j.updated_at desc nulls last, j.id desc) as rn
  from active_agreements a
  left join public.jobs j on coalesce(j.service_contract_reference, '') = coalesce(a.agreement_code, '')
), visit_candidates as (
  select
    a.id,
    a.agreement_code,
    a.service_name,
    a.client_id,
    a.client_site_id,
    a.route_id,
    a.crew_id,
    'service_session'::text as candidate_kind,
    a.default_invoice_source as invoice_source,
    a.candidate_date,
    a.visit_charge_total,
    a.visit_cost_total,
    null::uuid as snow_event_trigger_id,
    'Active agreement is due for service execution review.'::text as candidate_reason,
    lj.job_id,
    a.signed_contract_document_id,
    a.signed_contract_document_number,
    a.signed_at,
    case when lj.job_id is not null then true else false end as scheduler_ready
  from active_agreements a
  left join linked_jobs lj on lj.agreement_id = a.id and lj.rn = 1
  where coalesce(a.auto_create_session_candidates, false) = true
), invoice_candidates as (
  select
    a.id,
    a.agreement_code,
    a.service_name,
    a.client_id,
    a.client_site_id,
    a.route_id,
    a.crew_id,
    'visit_invoice'::text as candidate_kind,
    a.default_invoice_source as invoice_source,
    a.candidate_date,
    a.visit_charge_total,
    a.visit_cost_total,
    null::uuid as snow_event_trigger_id,
    case when a.signed_contract_document_id is not null then 'Signed contract allows invoice candidate staging.' else 'Agreement allows invoice candidate staging but no signed contract is linked yet.' end as candidate_reason,
    null::bigint as job_id,
    a.signed_contract_document_id,
    a.signed_contract_document_number,
    a.signed_at,
    case when a.signed_contract_document_id is not null then true else false end as scheduler_ready
  from active_agreements a
  where coalesce(a.auto_stage_invoice_candidates, false) = true
    and coalesce(a.default_invoice_source, 'agreement_visit') = 'agreement_visit'
), snow_candidates as (
  select
    a.id,
    a.agreement_code,
    a.service_name,
    a.client_id,
    a.client_site_id,
    a.route_id,
    a.crew_id,
    'snow_invoice'::text as candidate_kind,
    'agreement_snow'::text as invoice_source,
    st.event_date as candidate_date,
    a.visit_charge_total,
    a.visit_cost_total,
    st.id as snow_event_trigger_id,
    case when a.signed_contract_document_id is not null then 'Triggered snow event is ready for invoice candidate staging.' else 'Triggered snow event exists but no signed contract is linked yet.' end as candidate_reason,
    null::bigint as job_id,
    a.signed_contract_document_id,
    a.signed_contract_document_number,
    a.signed_at,
    case when a.signed_contract_document_id is not null then true else false end as scheduler_ready
  from active_agreements a
  join public.snow_event_triggers st on st.agreement_id = a.id
  left join public.ar_invoices ai on ai.snow_event_trigger_id = st.id
  where coalesce(a.auto_stage_invoice_candidates, false) = true
    and st.trigger_met = true
    and ai.id is null
)
select * from visit_candidates
union all
select * from invoice_candidates
union all
select * from snow_candidates;

create or replace view public.v_signed_contract_invoice_candidates as
select
  scd.id as contract_document_id,
  scd.document_number,
  scd.document_kind,
  scd.document_status,
  scd.signed_at,
  scd.client_id,
  c.legal_name as client_name,
  scd.client_site_id,
  cs.site_name as client_site_name,
  scd.estimate_id,
  e.estimate_number,
  scd.agreement_id,
  rsa.agreement_code,
  rsa.service_name,
  rsa.tax_code_id,
  coalesce(rsa.visit_charge_total, e.total_amount, e.subtotal, 0)::numeric(12,2) as candidate_subtotal,
  inv.id as existing_invoice_id,
  inv.invoice_number as existing_invoice_number,
  inv.invoice_status as existing_invoice_status
from public.service_contract_documents scd
left join public.clients c on c.id = scd.client_id
left join public.client_sites cs on cs.id = scd.client_site_id
left join public.estimates e on e.id = scd.estimate_id
left join public.recurring_service_agreements rsa on rsa.id = scd.agreement_id
left join public.ar_invoices inv on inv.service_contract_document_id = scd.id
where scd.document_status = 'signed';

create or replace view public.v_service_execution_scheduler_summary as
select
  count(*)::int as candidate_count,
  count(*) filter (where candidate_kind = 'service_session')::int as session_candidate_count,
  count(*) filter (where candidate_kind in ('visit_invoice','snow_invoice'))::int as invoice_candidate_count,
  count(*) filter (where scheduler_ready = true)::int as scheduler_ready_count,
  max(candidate_date) as latest_candidate_date
from public.v_service_agreement_execution_candidates;
