-- =========================================================
-- DATABASE AUDIT + SAFE COMPATIBILITY PATCH
-- For older test databases that have drifted behind the repo
-- Covers:
-- - recent scheduler/reporting/payroll/evidence compatibility
-- - historical reporting views
-- - portable scheduler secret handling
-- =========================================================

create extension if not exists pgcrypto;
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ---------------------------------------------------------
-- 1) Audit snapshot table
-- ---------------------------------------------------------
create temp table if not exists audit_results (
  item text,
  status text,
  details text
);

truncate table audit_results;

insert into audit_results(item, status, details)
select
  'table:submissions',
  case when exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'submissions'
  ) then 'ok' else 'missing' end,
  'Core HSE submissions table';

insert into audit_results(item, status, details)
select
  'column:submissions.supervisor_profile_id',
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'submissions' and column_name = 'supervisor_profile_id'
  ) then 'ok' else 'missing' end,
  'Needed by historical reporting';

insert into audit_results(item, status, details)
select
  'column:hse_packet_events.event_summary',
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'hse_packet_events' and column_name = 'event_summary'
  ) then 'ok' else 'missing' end,
  'Needed by workflow history';

insert into audit_results(item, status, details)
select
  'column:payroll_export_runs.export_batch_number',
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payroll_export_runs' and column_name = 'export_batch_number'
  ) then 'ok' else 'missing' end,
  'Needed by workflow history';

insert into audit_results(item, status, details)
select
  'table:media_review_actions',
  case when exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'media_review_actions'
  ) then 'ok' else 'missing' end,
  'Needed by evidence review history';

insert into audit_results(item, status, details)
select
  'table:service_execution_scheduler_settings',
  case when exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'service_execution_scheduler_settings'
  ) then 'ok' else 'missing' end,
  'Needed by scheduler dispatch';

-- ---------------------------------------------------------
-- 2) Safe compatibility columns for older databases
-- ---------------------------------------------------------
alter table if exists public.submissions
  add column if not exists site_id uuid references public.sites(id) on delete set null,
  add column if not exists submitted_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists supervisor_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists signing_supervisor_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists admin_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.hse_packet_events
  add column if not exists event_summary text,
  add column if not exists event_notes text;

alter table if exists public.payroll_export_runs
  add column if not exists export_provider text not null default 'generic_csv',
  add column if not exists export_mime_type text,
  add column if not exists export_layout_version text,
  add column if not exists export_batch_number text,
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

-- ---------------------------------------------------------
-- 3) Portable scheduler helper and dispatch function
--    Uses Vault if available, app.settings fallback if not
-- ---------------------------------------------------------
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
  when cadence = 'weekly' then
    (case when scheduled_local_today > local_now
      then scheduled_local_today
      else scheduled_local_today + interval '7 days'
    end) at time zone tz
  else
    (case when scheduled_local_today > local_now
      then scheduled_local_today
      else scheduled_local_today + interval '1 day'
    end) at time zone tz
end
from local_targets;
$$;

create or replace function public.dispatch_due_service_execution_scheduler_runs()
returns integer
language plpgsql
security definer
as $$
declare
  v_secret text := null;
  v_dispatched integer := 0;
  v_request_id bigint;
  r record;
begin
  -- Try Vault first.
  begin
    execute $sql$
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'service_execution_scheduler_secret'
      limit 1
    $sql$
    into v_secret;
  exception
    when undefined_table or invalid_schema_name then
      v_secret := null;
  end;

  -- Fallback for environments without Vault.
  if coalesce(v_secret, '') = '' then
    v_secret := nullif(current_setting('app.settings.service_execution_scheduler_secret', true), '');
  end if;

  if coalesce(v_secret, '') = '' then
    update public.service_execution_scheduler_settings
    set
      last_dispatch_status = 'failed',
      last_dispatch_notes = 'Missing scheduler secret. Checked Vault first, then app.settings.service_execution_scheduler_secret.',
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
      and not (
        coalesce(last_dispatch_status, '') = 'queued'
        and coalesce(last_dispatch_at, now() - interval '100 years') > now() - interval '10 minutes'
      )
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
set next_run_at = public.compute_service_execution_scheduler_next_run_at(
  run_timezone,
  cadence,
  run_hour_local,
  run_minute_local,
  now()
)
where is_enabled = true
  and cadence <> 'manual'
  and next_run_at is null;

-- ---------------------------------------------------------
-- 4) Reporting views
-- ---------------------------------------------------------
create or replace view public.v_hse_submission_history_report as
with review_rollup as (
  select
    sr.submission_id,
    count(*)::int as review_count,
    max(sr.created_at) as last_reviewed_at,
    (array_agg(sr.review_action order by sr.created_at desc nulls last))[1] as last_review_action,
    (array_agg(sr.review_note order by sr.created_at desc nulls last))[1] as last_review_note,
    (array_agg(coalesce(p.full_name, p.email, sr.reviewer_id::text) order by sr.created_at desc nulls last))[1] as last_reviewed_by_name
  from public.submission_reviews sr
  left join public.profiles p on p.id = sr.reviewer_id
  group by sr.submission_id
), image_rollup as (
  select
    si.submission_id,
    count(*)::int as image_count
  from public.submission_images si
  group by si.submission_id
)
select
  s.id as submission_id,
  s.form_type,
  s.date as submission_date,
  s.status,
  s.site_id,
  coalesce(st.site_code, s.site, '') as site_code,
  st.site_name,
  trim(
    both ' ' from concat(
      coalesce(st.site_code, ''),
      case when st.site_code is not null and st.site_name is not null then ' — ' else '' end,
      coalesce(st.site_name, s.site, '')
    )
  ) as site_label,
  s.submitted_by_profile_id,
  coalesce(sp.full_name, sp.email, s.submitted_by, '') as submitted_by_name,
  s.supervisor_profile_id,
  coalesce(sup.full_name, sup.email, '') as supervisor_name,
  s.admin_profile_id,
  coalesce(adm.full_name, adm.email, '') as admin_name,
  s.reviewed_at,
  coalesce(rev.review_count, 0) as review_count,
  coalesce(img.image_count, 0) as image_count,
  rev.last_reviewed_at,
  rev.last_review_action,
  rev.last_review_note,
  rev.last_reviewed_by_name,
  s.created_at,
  s.updated_at
from public.submissions s
left join public.sites st on st.id = s.site_id
left join public.profiles sp on sp.id = s.submitted_by_profile_id
left join public.profiles sup on sup.id = s.supervisor_profile_id
left join public.profiles adm on adm.id = s.admin_profile_id
left join review_rollup rev on rev.submission_id = s.id
left join image_rollup img on img.submission_id = s.id;

create or replace view public.v_hse_form_daily_rollup as
with base as (
  select * from public.v_hse_submission_history_report
)
select
  submission_date as report_date,
  form_type,
  status,
  count(*)::int as submission_count,
  count(distinct coalesce(site_id::text, site_code, site_name, 'unknown'))::int as unique_site_count,
  coalesce(sum(image_count), 0)::int as image_count,
  count(*) filter (where coalesce(review_count, 0) > 0)::int as reviewed_count,
  count(*) filter (
    where coalesce(last_review_action, '') = 'rejected'
       or coalesce(status, '') = 'rejected'
  )::int as rejected_count,
  max(last_reviewed_at) as last_reviewed_at
from base
group by submission_date, form_type, status;

create or replace view public.v_hse_form_site_rollup as
with base as (
  select * from public.v_hse_submission_history_report
)
select
  coalesce(site_id::text, site_code, site_name, 'unknown') as site_ref,
  site_id,
  site_code,
  site_name,
  site_label,
  form_type,
  count(*)::int as submission_count,
  count(*) filter (where coalesce(review_count, 0) > 0)::int as reviewed_count,
  count(*) filter (
    where coalesce(last_review_action, '') = 'rejected'
       or coalesce(status, '') = 'rejected'
  )::int as rejected_count,
  coalesce(sum(image_count), 0)::int as image_count,
  max(submission_date) as last_submission_date,
  max(last_reviewed_at) as last_reviewed_at
from base
group by
  coalesce(site_id::text, site_code, site_name, 'unknown'),
  site_id,
  site_code,
  site_name,
  site_label,
  form_type;

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

create or replace view public.v_workflow_history_report as
select
  'submission'::text as history_type,
  'submissions'::text as source_table,
  s.id::text as source_id,
  coalesce(s.reviewed_at, s.updated_at, s.created_at) as occurred_at,
  coalesce(s.status, 'submitted') as record_status,
  s.id::text as record_number,
  concat(upper(coalesce(s.form_type, 'form')), ' submission') as headline,
  concat(
    coalesce(st.site_code, st.site_name, s.site, 'Unknown site'),
    ' • ',
    coalesce(s.submitted_by, 'submitted')
  ) as detail,
  st.site_code,
  st.site_name
from public.submissions s
left join public.sites st on st.id = s.site_id

union all

select
  'hse_packet_event'::text,
  'hse_packet_events'::text,
  e.id::text,
  e.event_at,
  coalesce(e.event_type, 'event') as record_status,
  coalesce(lp.packet_number, e.packet_id::text) as record_number,
  concat('HSE packet ', coalesce(lp.packet_number, 'event')) as headline,
  coalesce(e.event_summary, e.event_notes, 'Packet event recorded') as detail,
  null::text as site_code,
  null::text as site_name
from public.hse_packet_events e
left join public.linked_hse_packets lp on lp.id = e.packet_id

union all

select
  'evidence_review'::text,
  'media_review_actions'::text,
  m.id::text,
  coalesce(m.reviewed_at, m.updated_at, m.created_at) as occurred_at,
  coalesce(m.review_status, 'pending') as record_status,
  m.target_id::text as record_number,
  concat('Evidence review • ', m.target_entity, ' • ', m.media_stage) as headline,
  coalesce(m.review_notes, 'Evidence status updated') as detail,
  null::text as site_code,
  null::text as site_name
from public.media_review_actions m

union all

select
  'scheduler_run'::text,
  'service_execution_scheduler_runs'::text,
  r.id::text,
  coalesce(r.updated_at, r.created_at) as occurred_at,
  coalesce(r.run_status, 'queued') as record_status,
  coalesce(r.run_code, r.id::text) as record_number,
  'Service execution scheduler run' as headline,
  concat(
    'Candidates: ', coalesce(r.candidate_count, 0),
    ' • Sessions: ', coalesce(r.session_created_count, 0),
    ' • Invoice candidates: ', coalesce(r.invoice_candidate_count, 0),
    ' • Skipped: ', coalesce(r.skipped_count, 0)
  ) as detail,
  null::text as site_code,
  null::text as site_name
from public.service_execution_scheduler_runs r

union all

select
  'payroll_export'::text,
  'payroll_export_runs'::text,
  p.id::text,
  coalesce(p.payroll_closed_at, p.delivery_confirmed_at, p.delivered_at, p.exported_at, p.created_at) as occurred_at,
  coalesce(p.payroll_close_status, p.delivery_status, p.status, 'open') as record_status,
  coalesce(p.export_batch_number, p.run_code, p.id::text) as record_number,
  'Payroll export workflow' as headline,
  concat(
    'Provider: ', coalesce(p.export_provider, 'n/a'),
    ' • Period: ', coalesce(p.period_start::text, ''),
    ' to ', coalesce(p.period_end::text, ''),
    ' • Delivery: ', coalesce(p.delivery_status, 'pending')
  ) as detail,
  null::text as site_code,
  null::text as site_name
from public.payroll_export_runs p

union all

select
  'signed_contract'::text,
  'service_contract_documents'::text,
  d.id::text,
  coalesce(d.signed_at, d.updated_at, d.created_at) as occurred_at,
  coalesce(d.document_status, 'draft') as record_status,
  coalesce(d.document_number, d.contract_reference, d.id::text) as record_number,
  coalesce(d.title, 'Service contract document') as headline,
  concat(
    'Kind: ', coalesce(d.document_kind, 'contract'),
    case when d.signed_by_name is not null then concat(' • Signed by ', d.signed_by_name) else '' end
  ) as detail,
  null::text as site_code,
  null::text as site_name
from public.service_contract_documents d;

-- ---------------------------------------------------------
-- 5) Post-patch audit snapshot
-- ---------------------------------------------------------
insert into audit_results(item, status, details)
select
  'postpatch:submissions.supervisor_profile_id',
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'submissions' and column_name = 'supervisor_profile_id'
  ) then 'ok' else 'missing' end,
  'After patch';

insert into audit_results(item, status, details)
select
  'postpatch:hse_packet_events.event_summary',
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'hse_packet_events' and column_name = 'event_summary'
  ) then 'ok' else 'missing' end,
  'After patch';

insert into audit_results(item, status, details)
select
  'postpatch:payroll_export_runs.export_batch_number',
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payroll_export_runs' and column_name = 'export_batch_number'
  ) then 'ok' else 'missing' end,
  'After patch';

insert into audit_results(item, status, details)
select
  'view:v_hse_submission_history_report',
  case when exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'v_hse_submission_history_report'
  ) then 'ok' else 'missing' end,
  'Historical HSE report view';

insert into audit_results(item, status, details)
select
  'view:v_workflow_history_report',
  case when exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'v_workflow_history_report'
  ) then 'ok' else 'missing' end,
  'Workflow history report view';

insert into audit_results(item, status, details)
select
  'view:v_service_execution_scheduler_status',
  case when exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'v_service_execution_scheduler_status'
  ) then 'ok' else 'missing' end,
  'Scheduler status view';


insert into audit_results(item, status, details)
select
  'table:corrective_action_tasks',
  case when exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'corrective_action_tasks'
  ) then 'ok' else 'missing' end,
  'Incident corrective-action task table';

insert into audit_results(item, status, details)
select
  'table:training_courses',
  case when exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'training_courses'
  ) then 'ok' else 'missing' end,
  'Training / certification course catalog';

insert into audit_results(item, status, details)
select
  'table:training_records',
  case when exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'training_records'
  ) then 'ok' else 'missing' end,
  'Worker training completion history';

insert into audit_results(item, status, details)
select
  'table:sds_acknowledgements',
  case when exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'sds_acknowledgements'
  ) then 'ok' else 'missing' end,
  'SDS acknowledgement history';

insert into audit_results(item, status, details)
select
  'view:v_corrective_action_task_directory',
  case when exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'v_corrective_action_task_directory'
  ) then 'ok' else 'missing' end,
  'Corrective action reporting view';

insert into audit_results(item, status, details)
select
  'view:v_training_record_directory',
  case when exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'v_training_record_directory'
  ) then 'ok' else 'missing' end,
  'Training / certification reporting view';

insert into audit_results(item, status, details)
select
  'view:v_sds_acknowledgement_directory',
  case when exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'v_sds_acknowledgement_directory'
  ) then 'ok' else 'missing' end,
  'SDS acknowledgement reporting view';

select * from audit_results order by item;


insert into audit_results(item, status, details)
select
  'table:report_subscriptions',
  case when exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'report_subscriptions'
  ) then 'ok' else 'missing' end,
  'Scheduled report delivery subscriptions';

insert into audit_results(item, status, details)
select
  'table:equipment_jsa_hazard_links',
  case when exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'equipment_jsa_hazard_links'
  ) then 'ok' else 'missing' end,
  'Equipment-specific hazard / JSA linkage';

insert into audit_results(item, status, details)
select
  'view:v_overdue_action_alerts',
  case when exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'v_overdue_action_alerts'
  ) then 'ok' else 'missing' end,
  'Overdue alert rollup view';

insert into audit_results(item, status, details)
select
  'view:v_site_safety_scorecards',
  case when exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'v_site_safety_scorecards'
  ) then 'ok' else 'missing' end,
  'Site scorecard view';

insert into audit_results(item, status, details)
select
  'view:v_supervisor_scorecards',
  case when exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'v_supervisor_scorecards'
  ) then 'ok' else 'missing' end,
  'Supervisor scorecard view';

insert into audit_results(item, status, details)
select
  'view:v_report_subscription_directory',
  case when exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'v_report_subscription_directory'
  ) then 'ok' else 'missing' end,
  'Report subscription directory';

insert into audit_results(item, status, details)
select
  'view:v_equipment_jsa_hazard_link_directory',
  case when exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'v_equipment_jsa_hazard_link_directory'
  ) then 'ok' else 'missing' end,
  'Equipment JSA / hazard link directory';


insert into audit_results(item, status, details)
select 'table:report_delivery_runs', case when exists (select 1 from information_schema.tables where table_schema='public' and table_name='report_delivery_runs') then 'ok' else 'missing' end, 'Scheduled report delivery run history';
insert into audit_results(item, status, details)
select 'table:report_delivery_scheduler_settings', case when exists (select 1 from information_schema.tables where table_schema='public' and table_name='report_delivery_scheduler_settings') then 'ok' else 'missing' end, 'Report delivery scheduler settings';
insert into audit_results(item, status, details)
select 'view:v_report_delivery_scheduler_status', case when exists (select 1 from information_schema.views where table_schema='public' and table_name='v_report_delivery_scheduler_status') then 'ok' else 'missing' end, 'Report delivery scheduler status';
insert into audit_results(item, status, details)
select 'view:v_report_delivery_run_history', case when exists (select 1 from information_schema.views where table_schema='public' and table_name='v_report_delivery_run_history') then 'ok' else 'missing' end, 'Report delivery run history';
insert into audit_results(item, status, details)
select 'view:v_worker_sds_prompt_queue', case when exists (select 1 from information_schema.views where table_schema='public' and table_name='v_worker_sds_prompt_queue') then 'ok' else 'missing' end, 'Worker SDS self-service prompt queue';

-- 2026-04-26 Jobs commercial workflow checks
select 'v_estimate_commercial_directory' as item, count(*) as row_count from public.v_estimate_commercial_directory;
select 'v_work_order_commercial_directory' as item, count(*) as row_count from public.v_work_order_commercial_directory;
select 'v_job_completion_review_directory' as item, count(*) as row_count from public.v_job_completion_review_directory;
select 'v_job_accounting_ready_queue' as item, count(*) as row_count from public.v_job_accounting_ready_queue;


-- Pass 096 verification
select to_regclass('public.quote_package_output_events') as quote_package_output_events;
select to_regclass('public.work_order_release_threshold_evaluations') as work_order_release_threshold_evaluations;
select to_regclass('public.job_completion_closeout_assets') as job_completion_closeout_assets;
select to_regclass('public.invoice_candidate_posting_rules') as invoice_candidate_posting_rules;
select to_regclass('public.journal_candidate_posting_rules') as journal_candidate_posting_rules;
select to_regclass('public.accountant_handoff_exports') as accountant_handoff_exports;
select to_regclass('public.v_quote_package_output_directory') as v_quote_package_output_directory;
select to_regclass('public.v_work_order_threshold_evaluation_directory') as v_work_order_threshold_evaluation_directory;
select to_regclass('public.v_job_closeout_evidence_directory') as v_job_closeout_evidence_directory;
select to_regclass('public.v_accountant_handoff_export_directory') as v_accountant_handoff_export_directory;
select to_regclass('public.v_job_profitability_variance_directory') as v_job_profitability_variance_directory;

-- Pass 097 verification
select to_regclass('public.quote_package_output_events') as quote_package_output_events;
select to_regclass('public.work_order_release_threshold_evaluations') as work_order_release_threshold_evaluations;
select to_regclass('public.job_completion_closeout_assets') as job_completion_closeout_assets;
select to_regclass('public.invoice_candidate_posting_rules') as invoice_candidate_posting_rules;
select to_regclass('public.journal_candidate_posting_rules') as journal_candidate_posting_rules;
select to_regclass('public.accountant_handoff_exports') as accountant_handoff_exports;
select to_regclass('public.v_quote_package_output_directory') as v_quote_package_output_directory;
select to_regclass('public.v_work_order_threshold_evaluation_directory') as v_work_order_threshold_evaluation_directory;
select to_regclass('public.v_job_closeout_evidence_directory') as v_job_closeout_evidence_directory;
select to_regclass('public.v_accountant_handoff_export_directory') as v_accountant_handoff_export_directory;
select to_regclass('public.v_job_profitability_scorecard_directory') as v_job_profitability_scorecard_directory;

select to_regclass('public.job_completion_signoff_steps') as job_completion_signoff_steps;
select to_regclass('public.job_invoice_postings') as job_invoice_postings;
select to_regclass('public.job_journal_postings') as job_journal_postings;
select to_regclass('public.v_job_completion_signoff_directory') as v_job_completion_signoff_directory;
select to_regclass('public.v_job_invoice_posting_directory') as v_job_invoice_posting_directory;
select to_regclass('public.v_job_journal_posting_directory') as v_job_journal_posting_directory;
select to_regclass('public.v_job_profitability_management_scorecard_directory') as v_job_profitability_management_scorecard_directory;
