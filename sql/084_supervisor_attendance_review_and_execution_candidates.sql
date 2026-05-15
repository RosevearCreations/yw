-- 084_supervisor_attendance_review_and_execution_candidates.sql
-- Adds:
-- - supervisor review for missed clock-out, long breaks, and attendance exceptions
-- - optional geofence / photo-note capture fields on employee clock-in and clock-out
-- - payroll export generation views from time-clock-linked labor data
-- - estimate -> agreement -> contract -> invoice flow support views
-- - recurring agreement execution / invoice candidate views
-- - stronger operations dashboard summary cards
-- - customer-facing contract / application print layout view

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Site geofence reference fields
-- ------------------------------------------------------------
alter table if exists public.sites
  add column if not exists expected_latitude numeric(10,7),
  add column if not exists expected_longitude numeric(10,7),
  add column if not exists geofence_radius_meters numeric(10,2),
  add column if not exists geofence_notes text;

-- ------------------------------------------------------------
-- Employee time entry capture enhancements
-- ------------------------------------------------------------
alter table if exists public.employee_time_entries
  add column if not exists clock_in_latitude numeric(10,7),
  add column if not exists clock_in_longitude numeric(10,7),
  add column if not exists clock_out_latitude numeric(10,7),
  add column if not exists clock_out_longitude numeric(10,7),
  add column if not exists clock_in_photo_note text,
  add column if not exists clock_out_photo_note text,
  add column if not exists clock_in_photo_url text,
  add column if not exists clock_out_photo_url text,
  add column if not exists clock_in_geofence_status text not null default 'not_checked',
  add column if not exists clock_out_geofence_status text not null default 'not_checked',
  add column if not exists clock_in_geofence_distance_meters numeric(10,2),
  add column if not exists clock_out_geofence_distance_meters numeric(10,2),
  add column if not exists attendance_exception_notes text;

alter table if exists public.employee_time_entries
  drop constraint if exists employee_time_entries_clock_in_geofence_status_check;

alter table if exists public.employee_time_entries
  add constraint employee_time_entries_clock_in_geofence_status_check
  check (clock_in_geofence_status in ('not_checked','inside','outside','not_configured','override'));

alter table if exists public.employee_time_entries
  drop constraint if exists employee_time_entries_clock_out_geofence_status_check;

alter table if exists public.employee_time_entries
  add constraint employee_time_entries_clock_out_geofence_status_check
  check (clock_out_geofence_status in ('not_checked','inside','outside','not_configured','override'));

create index if not exists idx_employee_time_entries_clock_status
  on public.employee_time_entries(clock_status, signed_in_at desc);

create index if not exists idx_employee_time_entries_signed_out
  on public.employee_time_entries(signed_out_at);

-- ------------------------------------------------------------
-- Supervisor attendance review records
-- ------------------------------------------------------------
create table if not exists public.employee_time_reviews (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid not null references public.employee_time_entries(id) on delete cascade,
  review_type text not null default 'attendance_exception',
  review_status text not null default 'open',
  severity text not null default 'warning',
  issue_code text not null default 'manual_review',
  issue_summary text not null,
  review_notes text,
  resolved_notes text,
  approved_exception boolean not null default false,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.employee_time_reviews
  drop constraint if exists employee_time_reviews_type_check;

alter table if exists public.employee_time_reviews
  add constraint employee_time_reviews_type_check
  check (review_type in ('attendance_exception','missed_clock_out','long_break','zero_paid_time','manual'));

alter table if exists public.employee_time_reviews
  drop constraint if exists employee_time_reviews_status_check;

alter table if exists public.employee_time_reviews
  add constraint employee_time_reviews_status_check
  check (review_status in ('open','reviewed','resolved','dismissed'));

alter table if exists public.employee_time_reviews
  drop constraint if exists employee_time_reviews_severity_check;

alter table if exists public.employee_time_reviews
  add constraint employee_time_reviews_severity_check
  check (severity in ('info','warning','error'));

create index if not exists idx_employee_time_reviews_time_entry
  on public.employee_time_reviews(time_entry_id, created_at desc);

create index if not exists idx_employee_time_reviews_status
  on public.employee_time_reviews(review_status, severity, created_at desc);

-- ------------------------------------------------------------
-- Extend activity event types for attendance / contract / payroll flow
-- ------------------------------------------------------------
alter table if exists public.site_activity_events
  drop constraint if exists site_activity_events_type_check;

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
      'employee_time_review_created','employee_time_review_resolved',
      'payroll_export_generated','contract_print_generated','service_execution_candidate','service_invoice_candidate'
    )
  );

-- ------------------------------------------------------------
-- Preserve existing v_employee_time_clock_entries column order,
-- then append new 084 columns at the end.
-- This avoids CREATE OR REPLACE VIEW column rename failures.
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

  -- 084 appended columns
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
  end as long_break_exception_flag
from public.employee_time_entries te
left join public.profiles p on p.id = te.profile_id
left join public.crews c on c.id = te.crew_id
left join public.jobs j on j.id = te.job_id
left join public.sites s on s.id = te.site_id
left join public.job_sessions js on js.id = te.job_session_id
left join public.profiles actor on actor.id = te.created_by_profile_id
left join public.v_employee_time_entry_break_rollups br on br.time_entry_id = te.id
left join open_break ob on ob.time_entry_id = te.id;

create or replace view public.v_employee_time_clock_current as
select *
from public.v_employee_time_clock_entries
where signed_out_at is null
  and clock_status in ('active','paused');

-- Preserve existing summary columns first, append new ones after last_activity_at.
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

  -- 084 appended summary fields
  count(distinct crew_id) filter (where signed_out_at is null and clock_status in ('active','paused') and crew_id is not null)::int as active_crew_count,
  count(distinct site_id) filter (where signed_out_at is null and clock_status in ('active','paused') and site_id is not null)::int as active_site_count,
  count(*) filter (where signed_out_at is null and signed_in_at < now() - interval '12 hours')::int as overdue_sign_out_count,
  count(*) filter (where long_break_exception_flag = true)::int as long_break_exception_count,
  count(*) filter (
    where (signed_out_at is null and signed_in_at < now() - interval '12 hours')
       or long_break_exception_flag = true
       or (signed_out_at is not null and coalesce(paid_work_minutes, 0) <= 0)
  )::int as attendance_exception_count
from public.v_employee_time_clock_entries;

-- ------------------------------------------------------------
-- Attendance exception / supervisor review queue
-- ------------------------------------------------------------
create or replace view public.v_employee_time_review_queue as
with latest_review as (
  select distinct on (r.time_entry_id, r.issue_code)
    r.time_entry_id,
    r.issue_code,
    r.review_status,
    r.severity,
    r.reviewed_at,
    r.reviewed_by_profile_id,
    reviewer.full_name as reviewed_by_name,
    r.review_notes,
    r.resolved_notes
  from public.employee_time_reviews r
  left join public.profiles reviewer on reviewer.id = r.reviewed_by_profile_id
  order by r.time_entry_id, r.issue_code, r.created_at desc
), issue_rows as (
  select
    e.id as time_entry_id,
    e.profile_id,
    e.full_name,
    e.employee_number,
    e.job_id,
    e.job_code,
    e.job_name,
    e.site_id,
    e.site_code,
    e.site_name,
    e.crew_id,
    e.crew_name,
    e.clock_status,
    e.signed_in_at,
    e.signed_out_at,
    e.paid_work_minutes,
    e.unpaid_break_minutes,
    e.active_break_minutes,
    e.currently_overdue_sign_out,
    e.long_break_exception_flag,
    'missed_clock_out'::text as issue_code,
    'Missed or overdue clock-out'::text as issue_summary,
    'warning'::text as default_severity
  from public.v_employee_time_clock_entries e
  where e.currently_overdue_sign_out = true

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
    e.site_code,
    e.site_name,
    e.crew_id,
    e.crew_name,
    e.clock_status,
    e.signed_in_at,
    e.signed_out_at,
    e.paid_work_minutes,
    e.unpaid_break_minutes,
    e.active_break_minutes,
    e.currently_overdue_sign_out,
    e.long_break_exception_flag,
    'long_break'::text as issue_code,
    'Unpaid break exceeds expected threshold'::text as issue_summary,
    'warning'::text as default_severity
  from public.v_employee_time_clock_entries e
  where e.long_break_exception_flag = true

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
    e.site_code,
    e.site_name,
    e.crew_id,
    e.crew_name,
    e.clock_status,
    e.signed_in_at,
    e.signed_out_at,
    e.paid_work_minutes,
    e.unpaid_break_minutes,
    e.active_break_minutes,
    e.currently_overdue_sign_out,
    e.long_break_exception_flag,
    'zero_paid_time'::text as issue_code,
    'Clocked entry has zero paid work time'::text as issue_summary,
    'error'::text as default_severity
  from public.v_employee_time_clock_entries e
  where e.signed_out_at is not null
    and coalesce(e.paid_work_minutes, 0) <= 0
)
select
  ir.*,
  lr.review_status as latest_review_status,
  coalesce(lr.severity, ir.default_severity) as latest_severity,
  lr.reviewed_at as latest_reviewed_at,
  lr.reviewed_by_profile_id as latest_reviewed_by_profile_id,
  lr.reviewed_by_name as latest_reviewed_by_name,
  lr.review_notes as latest_review_notes,
  lr.resolved_notes as latest_resolved_notes,
  case
    when coalesce(lr.review_status, 'open') in ('resolved','dismissed') then false
    else true
  end as needs_review
from issue_rows ir
left join latest_review lr
  on lr.time_entry_id = ir.time_entry_id
 and lr.issue_code = ir.issue_code;

create or replace view public.v_employee_time_review_summary as
select
  count(*)::int as total_exception_count,
  count(*) filter (where issue_code = 'missed_clock_out')::int as missed_clock_out_count,
  count(*) filter (where issue_code = 'long_break')::int as long_break_count,
  count(*) filter (where issue_code = 'zero_paid_time')::int as zero_paid_time_count,
  count(*) filter (where needs_review = true)::int as needs_review_count,
  max(greatest(coalesce(signed_out_at, signed_in_at), signed_in_at)) as last_exception_activity_at
from public.v_employee_time_review_queue;

-- ------------------------------------------------------------
-- Payroll export generation rows from time-clock-linked labor data
-- ------------------------------------------------------------
create or replace view public.v_payroll_export_generation_rows as
select
  d.id,
  d.job_id,
  d.job_code,
  d.job_name,
  d.job_session_id,
  d.session_date,
  d.profile_id,
  d.full_name,
  d.employee_number,
  d.regular_hours,
  d.overtime_hours,
  d.hours_worked,
  d.hourly_cost_rate,
  d.overtime_cost_rate,
  d.payroll_burden_percent,
  d.payroll_cost_total,
  d.needs_export,
  concat_ws(
    ',',
    coalesce(d.employee_number, ''),
    coalesce(d.full_name, ''),
    coalesce(d.job_code, ''),
    coalesce(to_char(d.session_date, 'YYYY-MM-DD'), ''),
    coalesce(d.regular_hours::text, '0'),
    coalesce(d.overtime_hours::text, '0'),
    coalesce(d.hours_worked::text, '0'),
    coalesce(d.payroll_cost_total::text, '0')
  ) as csv_row
from public.v_payroll_review_detail d
where d.needs_export = true;

create or replace view public.v_payroll_export_generation_summary as
select
  count(*)::int as export_row_count,
  coalesce(sum(hours_worked), 0)::numeric(10,2) as export_hours_total,
  coalesce(sum(payroll_cost_total), 0)::numeric(12,2) as export_payroll_cost_total
from public.v_payroll_export_generation_rows;

-- ------------------------------------------------------------
-- Estimate -> agreement -> contract -> invoice flow view
-- ------------------------------------------------------------
create or replace view public.v_estimate_agreement_contract_invoice_flow as
select
  e.id as estimate_id,
  e.estimate_number,
  e.status as estimate_status,
  e.client_id,
  e.client_site_id,
  e.total_amount as estimate_total_amount,
  e.valid_until,
  rsa.id as agreement_id,
  rsa.agreement_code,
  rsa.agreement_status,
  rsa.service_name,
  rsa.billing_method,
  rsa.start_date as agreement_start_date,
  rsa.end_date as agreement_end_date,
  scd.id as contract_document_id,
  scd.document_number,
  scd.document_kind,
  scd.document_status,
  scd.effective_date as contract_effective_date,
  scd.expiry_date as contract_expiry_date,
  inv.id as invoice_id,
  inv.invoice_number,
  inv.invoice_status,
  inv.invoice_date,
  inv.total_amount as invoice_total_amount
from public.estimates e
left join public.recurring_service_agreements rsa on rsa.estimate_id = e.id
left join public.service_contract_documents scd on scd.agreement_id = rsa.id
left join public.ar_invoices inv
  on inv.recurring_service_agreement_id = rsa.id
 or inv.service_contract_document_id = scd.id;

-- ------------------------------------------------------------
-- Recurring agreement execution and invoice candidates
-- ------------------------------------------------------------
create or replace view public.v_service_execution_candidates as
select
  rsa.id as agreement_id,
  rsa.agreement_code,
  rsa.client_id,
  rsa.client_site_id,
  rsa.route_id,
  rsa.crew_id,
  rsa.tax_code_id,
  rsa.service_name,
  rsa.billing_method,
  rsa.service_pattern,
  rsa.recurrence_basis,
  rsa.recurrence_rule,
  rsa.recurrence_interval,
  rsa.start_date,
  rsa.end_date,
  rsa.open_end_date,
  current_date as candidate_date,
  case
    when rsa.event_trigger_type in ('snow_cm','snow_event','ice_event') then 'event_trigger'
    else 'scheduled_service'
  end as candidate_type,
  case
    when rsa.event_trigger_type in ('snow_cm','snow_event','ice_event') then 'Agreement is active and uses event-based execution'
    else 'Agreement is active and eligible for service execution'
  end as candidate_reason,
  rsa.visit_estimated_minutes,
  rsa.visit_estimated_duration_hours,
  rsa.visit_cost_total,
  rsa.visit_charge_total
from public.recurring_service_agreements rsa
where rsa.agreement_status = 'active'
  and (rsa.start_date is null or rsa.start_date <= current_date)
  and (coalesce(rsa.open_end_date, false) = true or rsa.end_date is null or rsa.end_date >= current_date);

create or replace view public.v_service_invoice_candidates as
select
  rsa.id as agreement_id,
  rsa.agreement_code,
  rsa.client_id,
  rsa.client_site_id,
  rsa.tax_code_id,
  rsa.service_name,
  rsa.billing_method,
  current_date as candidate_invoice_date,
  rsa.visit_charge_total as candidate_charge_total,
  rsa.discount_mode,
  rsa.discount_value,
  rsa.event_trigger_type,
  null::uuid as snow_event_trigger_id,
  'service_visit'::text as invoice_candidate_type
from public.recurring_service_agreements rsa
where rsa.agreement_status = 'active'
  and rsa.billing_method in ('per_visit','flat_period','seasonal','time_and_material')

union all

select
  rsa.id as agreement_id,
  rsa.agreement_code,
  rsa.client_id,
  rsa.client_site_id,
  rsa.tax_code_id,
  rsa.service_name,
  rsa.billing_method,
  setr.event_date as candidate_invoice_date,
  rsa.visit_charge_total as candidate_charge_total,
  rsa.discount_mode,
  rsa.discount_value,
  rsa.event_trigger_type,
  setr.id as snow_event_trigger_id,
  'snow_event'::text as invoice_candidate_type
from public.snow_event_triggers setr
join public.recurring_service_agreements rsa on rsa.id = setr.agreement_id
left join public.ar_invoices inv on inv.snow_event_trigger_id = setr.id
where rsa.agreement_status = 'active'
  and setr.trigger_met = true
  and inv.id is null;

create or replace view public.v_recurring_agreement_profitability_summary as
select
  rsa.id as agreement_id,
  rsa.agreement_code,
  rsa.service_name,
  rsa.client_id,
  rsa.client_site_id,
  rsa.billing_method,
  count(inv.id)::int as invoice_count,
  coalesce(sum(coalesce(inv.total_amount, 0)), 0)::numeric(12,2) as invoiced_total,
  coalesce(rsa.visit_cost_total, 0)::numeric(12,2) as estimated_visit_cost_total,
  coalesce(rsa.visit_charge_total, 0)::numeric(12,2) as estimated_visit_charge_total,
  max(inv.invoice_date) as last_invoice_date
from public.recurring_service_agreements rsa
left join public.ar_invoices inv on inv.recurring_service_agreement_id = rsa.id
group by
  rsa.id,
  rsa.agreement_code,
  rsa.service_name,
  rsa.client_id,
  rsa.client_site_id,
  rsa.billing_method,
  rsa.visit_cost_total,
  rsa.visit_charge_total;

-- ------------------------------------------------------------
-- Customer-facing print layout helper
-- ------------------------------------------------------------
create or replace view public.v_service_contract_print_layouts as
select
  scd.id,
  scd.document_number,
  scd.document_kind,
  scd.document_status,
  scd.title,
  scd.contract_reference,
  scd.effective_date,
  scd.expiry_date,
  scd.client_id,
  c.legal_name as client_legal_name,
  c.display_name as client_display_name,
  scd.client_site_id,
  cs.site_name as client_site_name,
  cs.service_address,
  scd.estimate_id,
  e.estimate_number,
  scd.agreement_id,
  rsa.agreement_code,
  rsa.service_name,
  concat_ws(
    ' ',
    'Agreement:',
    coalesce(rsa.agreement_code, scd.contract_reference, scd.document_number)
  ) as printable_reference,
  concat_ws(
    E'\n',
    coalesce(scd.rendered_text, ''),
    case when rsa.service_name is not null then 'Service: ' || rsa.service_name else null end,
    case when cs.site_name is not null then 'Site: ' || cs.site_name else null end,
    case when cs.service_address is not null then 'Address: ' || cs.service_address else null end
  ) as printable_text,
  coalesce(scd.rendered_html, '<p>No rendered HTML available yet.</p>') as printable_html,
  case
    when scd.document_kind = 'application' then 'Customer Application'
    when scd.document_kind = 'contract' then 'Service Contract'
    when scd.document_kind = 'change_order' then 'Change Order'
    else scd.document_kind
  end as printable_title
from public.service_contract_documents scd
left join public.clients c on c.id = scd.client_id
left join public.client_sites cs on cs.id = scd.client_site_id
left join public.estimates e on e.id = scd.estimate_id
left join public.recurring_service_agreements rsa on rsa.id = scd.agreement_id;

-- ------------------------------------------------------------
-- Stronger dashboard cards / summary
-- ------------------------------------------------------------
create or replace view public.v_operations_dashboard_summary as
with active_crews as (
  select
    count(distinct crew_id)::int as active_crew_count,
    count(distinct profile_id)::int as active_staff_count
  from public.v_employee_time_clock_current
  where crew_id is not null
),
attendance as (
  select
    overdue_sign_out_count,
    long_break_exception_count,
    attendance_exception_count,
    currently_clocked_in_count,
    currently_on_break_count
  from public.v_employee_time_clock_summary
),
job_cards as (
  select
    count(*) filter (where coalesce(unsigned_job_session_count, 0) > 0)::int as unsigned_session_job_count,
    count(*) filter (where coalesce(delayed_schedule, false) = true)::int as delayed_job_count,
    count(*) filter (where coalesce(actual_profit_rollup_total, 0) < 0)::int as loss_making_job_count
  from public.v_jobs_directory
),
review_cards as (
  select
    count(*) filter (where needs_review = true)::int as attendance_review_needed_count
  from public.v_employee_time_review_queue
)
select
  ac.active_crew_count,
  ac.active_staff_count,
  att.currently_clocked_in_count,
  att.currently_on_break_count,
  att.overdue_sign_out_count,
  att.long_break_exception_count,
  att.attendance_exception_count,
  rc.attendance_review_needed_count,
  jc.unsigned_session_job_count,
  jc.delayed_job_count,
  jc.loss_making_job_count
from active_crews ac
cross join attendance att
cross join job_cards jc
cross join review_cards rc;
