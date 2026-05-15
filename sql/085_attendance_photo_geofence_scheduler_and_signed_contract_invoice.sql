-- 085_attendance_photo_geofence_scheduler_and_signed_contract_invoice.sql
-- Adds:
-- - attendance photo storage metadata and geofence accuracy/source fields
-- - provider-specific payroll export layouts
-- - signed-contract invoice generation support
-- - scheduler-driven service execution runs and candidate views

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Employee time entry photo + geofence storage/capture fields
-- ------------------------------------------------------------
alter table if exists public.employee_time_entries
  add column if not exists clock_in_accuracy_m numeric(8,2),
  add column if not exists clock_in_geo_source text not null default 'manual',
  add column if not exists clock_out_accuracy_m numeric(8,2),
  add column if not exists clock_out_geo_source text not null default 'manual',
  add column if not exists clock_in_photo_bucket text,
  add column if not exists clock_in_photo_path text,
  add column if not exists clock_out_photo_bucket text,
  add column if not exists clock_out_photo_path text,
  add column if not exists clock_in_photo_uploaded_at timestamptz,
  add column if not exists clock_out_photo_uploaded_at timestamptz;

alter table if exists public.employee_time_entries drop constraint if exists employee_time_entries_clock_in_geo_source_check;
alter table if exists public.employee_time_entries
  add constraint employee_time_entries_clock_in_geo_source_check
  check (clock_in_geo_source in ('manual','browser_geolocation','admin_override','unknown'));

alter table if exists public.employee_time_entries drop constraint if exists employee_time_entries_clock_out_geo_source_check;
alter table if exists public.employee_time_entries
  add constraint employee_time_entries_clock_out_geo_source_check
  check (clock_out_geo_source in ('manual','browser_geolocation','admin_override','unknown'));


alter table if exists public.employee_time_entries
  add column if not exists exception_status text not null default 'clear',
  add column if not exists exception_notes text,
  add column if not exists exception_reviewed_at timestamptz,
  add column if not exists exception_reviewed_by_profile_id uuid references public.profiles(id) on delete set null;

alter table if exists public.employee_time_entries drop constraint if exists employee_time_entries_exception_status_check;
alter table if exists public.employee_time_entries
  add constraint employee_time_entries_exception_status_check
  check (exception_status in ('clear','open','reviewed','resolved','waived'));

create table if not exists public.employee_time_entry_reviews (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid not null references public.employee_time_entries(id) on delete cascade,
  review_type text not null default 'attendance_exception',
  exception_type text,
  review_status text not null default 'open',
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  resolution_notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.employee_time_entry_reviews drop constraint if exists employee_time_entry_reviews_type_check;
alter table if exists public.employee_time_entry_reviews
  add constraint employee_time_entry_reviews_type_check
  check (review_type in ('attendance_exception','clock_edit','geofence_review','payroll_review'));

alter table if exists public.employee_time_entry_reviews drop constraint if exists employee_time_entry_reviews_status_check;
alter table if exists public.employee_time_entry_reviews
  add constraint employee_time_entry_reviews_status_check
  check (review_status in ('open','reviewed','resolved','waived'));

create index if not exists idx_employee_time_entry_reviews_entry on public.employee_time_entry_reviews(time_entry_id, created_at desc);

-- ------------------------------------------------------------
-- Payroll export provider options
-- ------------------------------------------------------------
alter table if exists public.payroll_export_runs
  add column if not exists export_provider text not null default 'generic_csv',
  add column if not exists export_mime_type text,
  add column if not exists export_layout_version text;

alter table if exists public.payroll_export_runs drop constraint if exists payroll_export_runs_export_provider_check;
alter table if exists public.payroll_export_runs
  add constraint payroll_export_runs_export_provider_check
  check (export_provider in ('generic_csv','quickbooks_time_csv','simplepay_csv','adp_csv','json'));

-- ------------------------------------------------------------
-- Signed contract / application metadata and invoice linkage
-- ------------------------------------------------------------
alter table if exists public.service_contract_documents
  add column if not exists issued_at timestamptz,
  add column if not exists signed_at timestamptz,
  add column if not exists signed_by_name text,
  add column if not exists signed_by_title text,
  add column if not exists signed_by_email text,
  add column if not exists signed_document_bucket text,
  add column if not exists signed_document_path text,
  add column if not exists signed_document_url text,
  add column if not exists application_submitted_at timestamptz,
  add column if not exists linked_invoice_id uuid references public.ar_invoices(id) on delete set null,
  add column if not exists invoice_generated_at timestamptz;

create index if not exists idx_service_contract_documents_signed_at on public.service_contract_documents(signed_at desc);
create index if not exists idx_service_contract_documents_linked_invoice_id on public.service_contract_documents(linked_invoice_id);

alter table if exists public.recurring_service_agreements
  add column if not exists last_scheduler_run_at timestamptz;

alter table if exists public.recurring_service_agreements
  add column if not exists auto_create_session_candidates boolean not null default true,
  add column if not exists auto_stage_invoice_candidates boolean not null default false,
  add column if not exists default_invoice_source text not null default 'agreement_visit';

alter table if exists public.recurring_service_agreements drop constraint if exists recurring_service_agreements_default_invoice_source_check;
alter table if exists public.recurring_service_agreements
  add constraint recurring_service_agreements_default_invoice_source_check
  check (default_invoice_source in ('agreement_visit','agreement_snow','contract','manual'));

-- ------------------------------------------------------------
-- Scheduler runs
-- ------------------------------------------------------------
create table if not exists public.service_execution_scheduler_runs (
  id uuid primary key default gen_random_uuid(),
  run_code text not null unique,
  run_mode text not null default 'manual',
  run_status text not null default 'completed',
  agreement_id uuid references public.recurring_service_agreements(id) on delete set null,
  candidate_count integer not null default 0,
  session_created_count integer not null default 0,
  invoice_candidate_count integer not null default 0,
  skipped_count integer not null default 0,
  run_notes text,
  payload jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.service_execution_scheduler_runs drop constraint if exists service_execution_scheduler_runs_mode_check;
alter table if exists public.service_execution_scheduler_runs
  add constraint service_execution_scheduler_runs_mode_check
  check (run_mode in ('manual','scheduled','admin_trigger','agreement_trigger'));

alter table if exists public.service_execution_scheduler_runs drop constraint if exists service_execution_scheduler_runs_status_check;
alter table if exists public.service_execution_scheduler_runs
  add constraint service_execution_scheduler_runs_status_check
  check (run_status in ('queued','running','completed','partial','failed'));

create index if not exists idx_service_execution_scheduler_runs_created_at on public.service_execution_scheduler_runs(created_at desc);
create index if not exists idx_service_execution_scheduler_runs_agreement_id on public.service_execution_scheduler_runs(agreement_id, created_at desc);

-- ------------------------------------------------------------
-- Extend activity event types
-- ------------------------------------------------------------
alter table if exists public.site_activity_events drop constraint if exists site_activity_events_type_check;
alter table if exists public.site_activity_events
  add constraint site_activity_events_type_check
  check (
    event_type in (
      'job_created','job_updated','job_session_created','job_session_updated','crew_hours_logged','job_reassignment_created','job_financial_event_created',
      'staff_created','staff_updated','staff_status_changed','staff_deleted',
      'equipment_created','equipment_updated','equipment_deleted',
      'agreement_created','agreement_updated','snow_trigger_created','change_order_created',
      'customer_asset_created','callback_created','payroll_export_created','contract_document_created',
      'order_created','account_login',
      'employee_clock_in','employee_break_started','employee_break_ended','employee_clock_out',
      'attendance_exception_opened','attendance_exception_reviewed','attendance_exception_resolved',
      'employee_time_photo_uploaded','service_execution_candidate','service_invoice_candidate',
      'service_execution_scheduler_run','signed_contract_invoice_generated'
    )
  );

-- ------------------------------------------------------------
-- Preserve existing view column order, append new columns only
-- ------------------------------------------------------------
create or replace view public.v_employee_time_clock_entries as
with open_break as (
  select
    b.time_entry_id,
    max(b.started_at) filter (where b.ended_at is null and coalesce(b.unpaid, true) = true) as current_break_started_at
  from public.employee_time_entry_breaks b
  group by b.time_entry_id
)
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
  te.clock_in_latitude,
  te.clock_in_longitude,
  te.clock_out_latitude,
  te.clock_out_longitude,
  te.clock_in_photo_note,
  te.clock_out_photo_note,
  te.clock_in_photo_url,
  te.clock_out_photo_url,
  te.clock_in_geofence_status,
  te.clock_out_geofence_status,
  te.clock_in_geofence_distance_meters,
  te.clock_out_geofence_distance_meters,
  te.attendance_exception_notes,
  s.expected_latitude as site_expected_latitude,
  s.expected_longitude as site_expected_longitude,
  s.geofence_radius_meters,
  case when te.clock_in_latitude is not null and te.clock_in_longitude is not null then true else false end as has_clock_in_location,
  case when te.clock_out_latitude is not null and te.clock_out_longitude is not null then true else false end as has_clock_out_location,
  case
    when te.signed_out_at is null and te.signed_in_at < now() - interval '12 hours' then true
    else false
  end as currently_overdue_sign_out,
  case
    when ob.current_break_started_at is not null
      then greatest(floor(extract(epoch from (now() - ob.current_break_started_at)) / 60.0), 0)::int
    else 0
  end as active_break_minutes,
  case
    when ob.current_break_started_at is not null and ob.current_break_started_at < now() - interval '45 minutes' then true
    when coalesce(br.unpaid_break_minutes, te.unpaid_break_minutes, 0) >= 90 then true
    else false
  end as long_break_exception_flag,
  te.clock_in_accuracy_m,
  te.clock_in_geo_source,
  te.clock_out_accuracy_m,
  te.clock_out_geo_source,
  te.clock_in_photo_bucket,
  te.clock_in_photo_path,
  te.clock_out_photo_bucket,
  te.clock_out_photo_path,
  te.clock_in_photo_uploaded_at,
  te.clock_out_photo_uploaded_at,
  case when te.clock_in_photo_path is not null or te.clock_in_photo_url is not null then true else false end as has_clock_in_photo,
  case when te.clock_out_photo_path is not null or te.clock_out_photo_url is not null then true else false end as has_clock_out_photo
from public.employee_time_entries te
left join public.profiles p on p.id = te.profile_id
left join public.crews c on c.id = te.crew_id
left join public.jobs j on j.id = te.job_id
left join public.sites s on s.id = te.site_id
left join public.job_sessions js on js.id = te.job_session_id
left join public.profiles actor on actor.id = te.created_by_profile_id
left join public.v_employee_time_entry_break_rollups br on br.time_entry_id = te.id
left join open_break ob on ob.time_entry_id = te.id;

create or replace view public.v_employee_time_clock_summary as
select
  count(*)::int as total_entry_count,
  count(*) filter (where signed_in_at >= now() - interval '24 hours')::int as last_24h_clock_event_count,
  count(*) filter (where signed_in_at >= now() - interval '24 hours')::int as last_24h_clock_in_count,
  count(*) filter (where signed_out_at >= now() - interval '24 hours')::int as last_24h_clock_out_count,
  count(*) filter (where clock_status = 'paused' and signed_out_at is null)::int as currently_on_break_count,
  count(*) filter (where clock_status = 'active' and signed_out_at is null)::int as currently_clocked_in_count,
  coalesce(sum(case when signed_in_at >= now() - interval '24 hours' then paid_work_minutes else 0 end), 0)::int as last_24h_paid_minutes,
  max(greatest(coalesce(signed_out_at, signed_in_at), signed_in_at)) as last_activity_at,
  count(distinct crew_id) filter (where signed_out_at is null and clock_status in ('active','paused') and crew_id is not null)::int as active_crew_count,
  count(distinct site_id) filter (where signed_out_at is null and clock_status in ('active','paused') and site_id is not null)::int as active_site_count,
  count(*) filter (where signed_out_at is null and signed_in_at < now() - interval '12 hours')::int as overdue_sign_out_count,
  count(*) filter (where long_break_exception_flag = true)::int as long_break_exception_count,
  count(*) filter (
    where (signed_out_at is null and signed_in_at < now() - interval '12 hours')
       or long_break_exception_flag = true
       or (signed_out_at is not null and coalesce(paid_work_minutes, 0) <= 0)
  )::int as attendance_exception_count,
  count(*) filter (where clock_in_geofence_status = 'outside' or clock_out_geofence_status = 'outside')::int as geofence_exception_count,
  count(*) filter (where has_clock_in_photo or has_clock_out_photo)::int as entry_with_photo_count
from public.v_employee_time_clock_entries;

-- ------------------------------------------------------------
-- Scheduler / invoice candidate views
-- ------------------------------------------------------------
create or replace view public.v_service_agreement_execution_candidates as
with active_agreements as (
  select
    a.*,
    greatest(current_date, coalesce(a.start_date, current_date)) as candidate_date
  from public.recurring_service_agreements a
  where a.agreement_status = 'active'
    and coalesce(a.start_date, current_date) <= current_date
    and (coalesce(a.open_end_date, false) = true or a.end_date is null or a.end_date >= current_date)
), visit_candidates as (
  select
    a.id as agreement_id,
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
    'Active agreement is due for service execution review.'::text as candidate_reason
  from active_agreements a
  where coalesce(a.auto_create_session_candidates, false) = true
), invoice_candidates as (
  select
    a.id as agreement_id,
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
    'Agreement allows invoice candidate staging for the next visit.'::text as candidate_reason
  from active_agreements a
  where coalesce(a.auto_stage_invoice_candidates, false) = true
    and coalesce(a.default_invoice_source, 'agreement_visit') = 'agreement_visit'
), snow_candidates as (
  select
    a.id as agreement_id,
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
    'Triggered snow event is ready for invoice candidate staging.'::text as candidate_reason
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
create or replace view public.v_service_execution_scheduler_candidates as
with candidate_jobs as (
  select
    c.*, 
    j.id as job_id,
    j.job_code,
    j.job_name,
    j.status as job_status
  from public.v_service_agreement_execution_candidates c
  left join public.jobs j
    on upper(coalesce(j.service_contract_reference, '')) = upper(coalesce(c.agreement_code, ''))
)
select
  cj.agreement_id,
  cj.agreement_code,
  cj.service_name,
  cj.candidate_kind,
  cj.invoice_source,
  cj.candidate_date,
  cj.candidate_reason,
  cj.client_id,
  cj.client_site_id,
  cj.route_id,
  cj.crew_id,
  cj.job_id,
  cj.job_code,
  cj.job_name,
  cj.job_status,
  cj.visit_charge_total,
  cj.visit_cost_total,
  cj.snow_event_trigger_id,
  case when cj.job_id is null then 'no_linked_job'
       when exists (
         select 1 from public.job_sessions js
         where js.job_id = cj.job_id
           and js.session_date = cj.candidate_date
       ) then 'session_exists'
       else 'ready'
  end as scheduler_status
from candidate_jobs cj;

create or replace view public.v_signed_contract_invoice_candidates as
select
  d.id as contract_document_id,
  d.document_number,
  d.title,
  d.client_id,
  d.client_site_id,
  d.agreement_id,
  d.estimate_id,
  d.job_id,
  d.signed_at,
  d.signed_by_name,
  d.document_status,
  d.linked_invoice_id,
  a.agreement_code,
  a.service_name,
  a.tax_code_id,
  coalesce(a.visit_charge_total, e.total_amount, 0)::numeric(12,2) as candidate_subtotal,
  case
    when d.document_status = 'signed' or d.signed_at is not null then true
    else false
  end as is_signed_ready,
  case
    when d.linked_invoice_id is not null then 'already_invoiced'
    when d.document_status = 'signed' or d.signed_at is not null then 'ready'
    else 'not_signed'
  end as invoice_candidate_status
from public.service_contract_documents d
left join public.recurring_service_agreements a on a.id = d.agreement_id
left join public.estimates e on e.id = d.estimate_id;

create or replace view public.v_service_execution_scheduler_summary as
select
  count(*)::int as total_candidate_count,
  count(*) filter (where scheduler_status = 'ready')::int as ready_candidate_count,
  count(*) filter (where scheduler_status = 'session_exists')::int as session_exists_count,
  count(*) filter (where scheduler_status = 'no_linked_job')::int as no_linked_job_count,
  count(*) filter (where candidate_kind = 'service_session')::int as session_candidate_count,
  count(*) filter (where candidate_kind in ('visit_invoice','snow_invoice'))::int as invoice_candidate_count
from public.v_service_execution_scheduler_candidates;
