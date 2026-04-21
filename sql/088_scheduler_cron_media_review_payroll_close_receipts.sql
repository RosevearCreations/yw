-- 088_scheduler_cron_media_review_payroll_close_receipts.sql
-- Adds:
-- - cron/dispatch plumbing for service execution scheduler settings
-- - richer media review actions for attendance and HSE evidence
-- - payroll export delivery confirmation and payroll-close signoff fields
-- - stronger signed-contract kickoff suggestions for first planned session timing

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.media_review_actions (
  id uuid primary key default gen_random_uuid(),
  target_entity text not null,
  target_id uuid not null,
  media_stage text not null default 'evidence',
  review_status text not null default 'pending',
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target_entity, target_id, media_stage)
);

alter table if exists public.media_review_actions
  drop constraint if exists media_review_actions_target_entity_check;

alter table if exists public.media_review_actions
  add constraint media_review_actions_target_entity_check
  check (target_entity in ('employee_time_entry','hse_packet_proof'));

alter table if exists public.media_review_actions
  drop constraint if exists media_review_actions_review_status_check;

alter table if exists public.media_review_actions
  add constraint media_review_actions_review_status_check
  check (review_status in ('pending','approved','rejected','follow_up'));

create index if not exists idx_media_review_actions_target
  on public.media_review_actions(target_entity, target_id, media_stage, reviewed_at desc, created_at desc);

alter table if exists public.service_execution_scheduler_settings
  add column if not exists invoke_url text,
  add column if not exists last_dispatch_at timestamptz,
  add column if not exists last_dispatch_request_id bigint,
  add column if not exists last_dispatch_status text,
  add column if not exists last_dispatch_notes text;

alter table if exists public.service_execution_scheduler_settings
  drop constraint if exists service_execution_scheduler_settings_last_dispatch_status_check;

alter table if exists public.service_execution_scheduler_settings
  add constraint service_execution_scheduler_settings_last_dispatch_status_check
  check (last_dispatch_status in ('queued','completed','failed') or last_dispatch_status is null);

create or replace function public.compute_service_execution_scheduler_next_run_at(
  p_run_timezone text,
  p_cadence text,
  p_run_hour_local integer,
  p_run_minute_local integer,
  p_base timestamptz default now()
)
returns timestamptz
language sql
stable
as $$
with args as (
  select
    coalesce(nullif(trim(p_run_timezone), ''), 'America/Toronto') as tz,
    lower(coalesce(nullif(trim(p_cadence), ''), 'manual')) as cadence,
    greatest(0, least(coalesce(p_run_hour_local, 0), 23)) as run_hour_local,
    greatest(0, least(coalesce(p_run_minute_local, 0), 59)) as run_minute_local,
    coalesce(p_base, now()) as base_ts
), local_clock as (
  select
    tz,
    cadence,
    run_hour_local,
    run_minute_local,
    base_ts,
    (base_ts at time zone tz) as local_now
  from args
), local_targets as (
  select
    tz,
    cadence,
    local_now,
    (date_trunc('day', local_now)
      + make_interval(hours => run_hour_local, mins => run_minute_local)) as scheduled_local_today,
    date_trunc('hour', local_now) + interval '1 hour' as next_hour_local
  from local_clock
)
select case
  when cadence = 'manual' then null
  when cadence = 'hourly' then next_hour_local at time zone tz
  when cadence = 'weekly' then (case when scheduled_local_today > local_now then scheduled_local_today else scheduled_local_today + interval '7 days' end) at time zone tz
  else (case when scheduled_local_today > local_now then scheduled_local_today else scheduled_local_today + interval '1 day' end) at time zone tz
end
from local_targets;
$$;

create or replace function public.dispatch_due_service_execution_scheduler_runs()
returns integer
language plpgsql
security definer
as $$
declare
  v_secret text := nullif(current_setting('app.settings.service_execution_scheduler_secret', true), '');
  v_dispatched integer := 0;
  v_request_id bigint;
  r record;
begin
  if coalesce(v_secret, '') = '' then
    update public.service_execution_scheduler_settings
    set
      last_dispatch_status = 'failed',
      last_dispatch_notes = 'Missing app.settings.service_execution_scheduler_secret setting.',
      updated_at = now()
    where is_enabled = true
      and coalesce(invoke_url, '') <> ''
      and coalesce(next_run_at, now()) <= now();
    return 0;
  end if;

  for r in
    select *
    from public.service_execution_scheduler_settings
    where is_enabled = true
      and cadence <> 'manual'
      and coalesce(invoke_url, '') <> ''
      and coalesce(next_run_at, now()) <= now()
    order by next_run_at nulls first, created_at
    for update skip locked
  loop
    begin
      select net.http_post(
        url := r.invoke_url,
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-scheduler-secret', v_secret
        ),
        body := jsonb_build_object('setting_code', r.setting_code)
      ) into v_request_id;

      update public.service_execution_scheduler_settings
      set
        last_dispatch_at = now(),
        last_dispatch_request_id = v_request_id,
        last_dispatch_status = 'queued',
        last_dispatch_notes = 'Queued through pg_cron/pg_net dispatcher.',
        updated_at = now()
      where id = r.id;

      v_dispatched := v_dispatched + 1;
    exception when others then
      update public.service_execution_scheduler_settings
      set
        last_dispatch_at = now(),
        last_dispatch_status = 'failed',
        last_dispatch_notes = left(sqlerrm, 1000),
        updated_at = now()
      where id = r.id;
    end;
  end loop;

  return v_dispatched;
end;
$$;

do $dispatch$
begin
  begin
    perform cron.unschedule('service_execution_scheduler_dispatch_default');
  exception when others then
    null;
  end;

  perform cron.schedule(
    'service_execution_scheduler_dispatch_default',
    '* * * * *',
    $job$select public.dispatch_due_service_execution_scheduler_runs();$job$
  );
exception when others then
  null;
end;
$dispatch$;

update public.service_execution_scheduler_settings
set next_run_at = public.compute_service_execution_scheduler_next_run_at(run_timezone, cadence, run_hour_local, run_minute_local, now())
where is_enabled = true
  and cadence <> 'manual'
  and next_run_at is null;

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
  end as is_due,
  s.invoke_url,
  s.last_dispatch_at,
  s.last_dispatch_request_id,
  s.last_dispatch_status,
  s.last_dispatch_notes
from public.service_execution_scheduler_settings s
left join latest_run lr on lr.agreement_key = 'ALL';

create or replace view public.v_attendance_photo_review as
with latest_review as (
  select distinct on (m.target_id, m.media_stage)
    m.target_id,
    m.media_stage,
    m.review_status,
    m.review_notes,
    m.reviewed_at,
    m.reviewed_by_profile_id,
    reviewer.full_name as reviewed_by_name
  from public.media_review_actions m
  left join public.profiles reviewer on reviewer.id = m.reviewed_by_profile_id
  where m.target_entity = 'employee_time_entry'
  order by m.target_id, m.media_stage, coalesce(m.reviewed_at, m.updated_at, m.created_at) desc, m.created_at desc
)
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
  e.signed_out_at,
  coalesce(lr.review_status, 'pending') as review_status,
  lr.review_notes,
  lr.reviewed_at,
  lr.reviewed_by_profile_id,
  lr.reviewed_by_name,
  case
    when lr.review_status is null then true
    when lr.review_status in ('pending','follow_up') then true
    when e.clock_in_geofence_status in ('outside','override') then true
    else false
  end as needs_review
from public.v_employee_time_clock_entries e
left join latest_review lr on lr.target_id = e.id and lr.media_stage = 'clock_in'
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
  e.signed_out_at,
  coalesce(lr.review_status, 'pending') as review_status,
  lr.review_notes,
  lr.reviewed_at,
  lr.reviewed_by_profile_id,
  lr.reviewed_by_name,
  case
    when lr.review_status is null then true
    when lr.review_status in ('pending','follow_up') then true
    when e.clock_out_geofence_status in ('outside','override') then true
    else false
  end as needs_review
from public.v_employee_time_clock_entries e
left join latest_review lr on lr.target_id = e.id and lr.media_stage = 'clock_out'
where e.has_clock_out_photo = true;

create or replace view public.v_hse_evidence_review as
with latest_review as (
  select distinct on (m.target_id, m.media_stage)
    m.target_id,
    m.media_stage,
    m.review_status,
    m.review_notes,
    m.reviewed_at,
    m.reviewed_by_profile_id,
    reviewer.full_name as reviewed_by_name
  from public.media_review_actions m
  left join public.profiles reviewer on reviewer.id = m.reviewed_by_profile_id
  where m.target_entity = 'hse_packet_proof'
  order by m.target_id, m.media_stage, coalesce(m.reviewed_at, m.updated_at, m.created_at) desc, m.created_at desc
)
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
  p.updated_at,
  coalesce(lr.review_status, 'pending') as review_status,
  lr.review_notes,
  lr.reviewed_at,
  lr.reviewed_by_profile_id,
  lr.reviewed_by_name,
  case
    when lr.review_status is null then true
    when lr.review_status in ('pending','follow_up') then true
    else false
  end as needs_review
from public.hse_packet_proofs p
left join public.linked_hse_packets hp on hp.id = p.packet_id
left join public.profiles pr on pr.id = p.uploaded_by_profile_id
left join latest_review lr on lr.target_id = p.id and lr.media_stage = p.proof_stage;

alter table if exists public.payroll_export_runs
  add column if not exists delivery_status text not null default 'pending',
  add column if not exists delivery_reference text,
  add column if not exists delivery_notes text,
  add column if not exists delivered_at timestamptz,
  add column if not exists delivered_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists delivery_confirmed_at timestamptz,
  add column if not exists payroll_close_status text not null default 'open',
  add column if not exists payroll_closed_at timestamptz,
  add column if not exists payroll_closed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists payroll_close_notes text;

alter table if exists public.payroll_export_runs
  drop constraint if exists payroll_export_runs_delivery_status_check;

alter table if exists public.payroll_export_runs
  add constraint payroll_export_runs_delivery_status_check
  check (delivery_status in ('pending','delivered','confirmed'));

alter table if exists public.payroll_export_runs
  drop constraint if exists payroll_export_runs_payroll_close_status_check;

alter table if exists public.payroll_export_runs
  add constraint payroll_export_runs_payroll_close_status_check
  check (payroll_close_status in ('open','ready_to_close','closed'));

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
  coalesce(a.service_name, d.title, 'Signed Contract Job') as suggested_job_name,
  concat('WO-', regexp_replace(coalesce(a.agreement_code, d.document_number, d.contract_reference, d.id::text), '[^A-Za-z0-9]+', '-', 'g')) as suggested_work_order_number,
  greatest(current_date, coalesce(a.start_date, current_date))::date as suggested_first_session_date,
  coalesce(a.visit_estimated_duration_hours, 0)::numeric(10,2) as suggested_first_session_hours
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
    count(*) filter (where coalesce(delivery_status, 'pending') = 'pending')::int as delivery_pending_count,
    count(*) filter (where coalesce(delivery_status, '') in ('delivered','confirmed'))::int as delivery_recorded_count,
    count(*) filter (where coalesce(delivery_status, '') = 'confirmed')::int as delivery_confirmed_count,
    count(*) filter (where coalesce(payroll_close_status, 'open') = 'ready_to_close')::int as ready_to_close_count,
    count(*) filter (where coalesce(payroll_close_status, 'open') = 'closed')::int as closed_run_count,
    max(exported_at) as last_exported_at,
    max(delivery_confirmed_at) as last_delivery_confirmed_at,
    max(payroll_closed_at) as last_payroll_closed_at,
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
  cr.attendance_exception_count,
  er.delivery_pending_count,
  er.delivery_recorded_count,
  er.delivery_confirmed_count,
  er.ready_to_close_count,
  er.closed_run_count,
  er.last_delivery_confirmed_at,
  er.last_payroll_closed_at
from export_rollup er
cross join attendance_rollup ar
cross join review_rollup rr
cross join clock_rollup cr;
