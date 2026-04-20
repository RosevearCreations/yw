-- 084_supervisor_attendance_review_and_execution_candidates.sql
-- Adds:
-- - supervisor attendance review for missed clock-out / long-break exceptions
-- - geofence and photo-note capture fields on employee clock in/out
-- - operations dashboard summary cards
-- - recurring agreement execution candidate rules

create extension if not exists pgcrypto;

alter table if exists public.employee_time_entries
  add column if not exists clock_in_latitude numeric(10,7),
  add column if not exists clock_in_longitude numeric(10,7),
  add column if not exists clock_in_accuracy_m numeric(8,2),
  add column if not exists clock_in_geo_source text not null default 'manual',
  add column if not exists clock_in_photo_note text,
  add column if not exists clock_out_latitude numeric(10,7),
  add column if not exists clock_out_longitude numeric(10,7),
  add column if not exists clock_out_accuracy_m numeric(8,2),
  add column if not exists clock_out_geo_source text not null default 'manual',
  add column if not exists clock_out_photo_note text,
  add column if not exists exception_status text not null default 'clear',
  add column if not exists exception_notes text,
  add column if not exists exception_reviewed_at timestamptz,
  add column if not exists exception_reviewed_by_profile_id uuid references public.profiles(id) on delete set null;

alter table if exists public.employee_time_entries drop constraint if exists employee_time_entries_clock_in_geo_source_check;
alter table if exists public.employee_time_entries
  add constraint employee_time_entries_clock_in_geo_source_check
  check (clock_in_geo_source in ('manual','browser_geolocation','admin_override','unknown'));

alter table if exists public.employee_time_entries drop constraint if exists employee_time_entries_clock_out_geo_source_check;
alter table if exists public.employee_time_entries
  add constraint employee_time_entries_clock_out_geo_source_check
  check (clock_out_geo_source in ('manual','browser_geolocation','admin_override','unknown'));

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
      'attendance_exception_opened','attendance_exception_reviewed','attendance_exception_resolved'
    )
  );

alter table if exists public.recurring_service_agreements
  add column if not exists auto_create_session_candidates boolean not null default true,
  add column if not exists auto_stage_invoice_candidates boolean not null default false,
  add column if not exists execution_lead_days integer not null default 0,
  add column if not exists application_required boolean not null default false,
  add column if not exists default_invoice_source text not null default 'agreement_visit';

alter table if exists public.recurring_service_agreements drop constraint if exists recurring_service_agreements_default_invoice_source_check;
alter table if exists public.recurring_service_agreements
  add constraint recurring_service_agreements_default_invoice_source_check
  check (default_invoice_source in ('agreement_visit','agreement_snow','contract','manual'));

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
  te.updated_at
from public.employee_time_entries te
left join public.profiles p on p.id = te.profile_id
left join public.crews c on c.id = te.crew_id
left join public.jobs j on j.id = te.job_id
left join public.sites s on s.id = te.site_id
left join public.job_sessions js on js.id = te.job_session_id
left join public.profiles actor on actor.id = te.created_by_profile_id
left join public.v_employee_time_entry_break_rollups br on br.time_entry_id = te.id;

create or replace view public.v_employee_time_attendance_exceptions as
with latest_review as (
  select distinct on (r.time_entry_id)
    r.time_entry_id,
    r.id as review_id,
    r.review_type,
    r.review_status,
    r.exception_type as reviewed_exception_type,
    r.reviewed_by_profile_id,
    r.reviewed_at,
    r.resolution_notes,
    rp.full_name as reviewed_by_name
  from public.employee_time_entry_reviews r
  left join public.profiles rp on rp.id = r.reviewed_by_profile_id
  order by r.time_entry_id, coalesce(r.reviewed_at, r.updated_at, r.created_at) desc, r.created_at desc
), base as (
  select
    e.*,
    case
      when e.signed_out_at is null and e.clock_status in ('active','paused') and e.signed_in_at <= now() - interval '12 hours' then 'missed_clock_out'
      when e.clock_status = 'paused' and coalesce(e.open_break_count, 0) > 0 and e.last_break_started_at <= now() - interval '45 minutes' then 'long_break'
      when e.signed_out_at is not null and coalesce(e.total_elapsed_minutes, 0) >= 60 and coalesce(e.paid_work_minutes, 0) <= 0 then 'zero_paid_time'
      else null
    end as exception_type,
    case when e.signed_out_at is null then floor(extract(epoch from (now() - e.signed_in_at)) / 60.0)::int else null end as open_minutes,
    case when e.clock_status = 'paused' and e.last_break_started_at is not null then floor(extract(epoch from (now() - e.last_break_started_at)) / 60.0)::int else null end as open_break_minutes_live
  from public.v_employee_time_clock_entries e
)
select
  b.id,
  b.profile_id,
  b.full_name,
  b.employee_number,
  b.crew_id,
  b.crew_name,
  b.job_id,
  b.job_code,
  b.job_name,
  b.site_id,
  b.site_code,
  b.site_name,
  b.job_session_id,
  b.session_date,
  b.session_status,
  b.clock_status,
  b.signed_in_at,
  b.signed_out_at,
  b.total_elapsed_minutes,
  b.unpaid_break_minutes,
  b.paid_work_minutes,
  b.break_count,
  b.open_break_count,
  b.last_break_started_at,
  b.last_break_ended_at,
  b.clock_in_latitude,
  b.clock_in_longitude,
  b.clock_in_accuracy_m,
  b.clock_in_geo_source,
  b.clock_in_photo_note,
  b.clock_out_latitude,
  b.clock_out_longitude,
  b.clock_out_accuracy_m,
  b.clock_out_geo_source,
  b.clock_out_photo_note,
  coalesce(b.exception_type, case when b.exception_status in ('open','reviewed','resolved','waived') then 'manual_review' else null end) as exception_type,
  b.exception_status,
  b.exception_notes,
  b.exception_reviewed_at,
  b.exception_reviewed_by_profile_id,
  b.open_minutes,
  b.open_break_minutes_live,
  lr.review_id,
  lr.review_status as latest_review_status,
  lr.reviewed_exception_type,
  lr.reviewed_by_profile_id,
  lr.reviewed_by_name,
  lr.reviewed_at,
  lr.resolution_notes
from base b
left join latest_review lr on lr.time_entry_id = b.id
where b.exception_type is not null or b.exception_status in ('open','reviewed','resolved','waived');

create or replace view public.v_operations_dashboard_summary as
with active_crews as (
  select count(distinct crew_id)::int as active_crews_on_site_count
  from public.v_employee_time_clock_current
  where crew_id is not null
), active_staff as (
  select count(*)::int as active_staff_on_site_count
  from public.v_employee_time_clock_current
), attendance as (
  select
    count(*) filter (where exception_type = 'missed_clock_out')::int as overdue_sign_out_count,
    count(*) filter (where exception_type = 'long_break')::int as long_break_exception_count,
    count(*) filter (where coalesce(latest_review_status, exception_status, 'open') in ('open','reviewed') )::int as open_attendance_exception_count
  from public.v_employee_time_attendance_exceptions
), unsigned_sessions as (
  select count(*)::int as unsigned_session_job_count
  from public.v_job_financial_rollups
  where coalesce(unsigned_session_count, 0) > 0
), delayed as (
  select count(*)::int as delayed_job_count
  from public.jobs
  where coalesce(delayed_schedule, false) = true
), losses as (
  select count(*)::int as loss_making_job_count
  from public.v_job_financial_rollups
  where coalesce(actual_profit_rollup_total, 0) < 0
)
select
  ac.active_crews_on_site_count,
  ast.active_staff_on_site_count,
  atd.overdue_sign_out_count,
  atd.long_break_exception_count,
  atd.open_attendance_exception_count,
  us.unsigned_session_job_count,
  d.delayed_job_count,
  l.loss_making_job_count
from active_crews ac
cross join active_staff ast
cross join attendance atd
cross join unsigned_sessions us
cross join delayed d
cross join losses l;

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
    'Active agreement is due for service execution review.'::text as candidate_reason
  from active_agreements a
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
    'Agreement allows invoice candidate staging for the next visit.'::text as candidate_reason
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
