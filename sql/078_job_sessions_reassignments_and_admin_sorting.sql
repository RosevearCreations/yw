create extension if not exists pgcrypto;

alter table if exists public.jobs
  add column if not exists client_reference text,
  add column if not exists service_contract_reference text,
  add column if not exists billing_transaction_number text,
  add column if not exists invoice_number text;

create table if not exists public.job_sessions (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references public.jobs(id) on delete cascade,
  session_date date not null default current_date,
  session_kind text not null default 'field_service',
  session_status text not null default 'completed',
  service_frequency_label text,
  scheduled_start_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  duration_minutes integer,
  delay_minutes integer not null default 0,
  notes text,
  site_supervisor_profile_id uuid references public.profiles(id) on delete set null,
  site_supervisor_signoff_name text,
  site_supervisor_signed_off_at timestamptz,
  site_supervisor_signoff_notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.job_sessions drop constraint if exists job_sessions_status_check;
alter table if exists public.job_sessions
  add constraint job_sessions_status_check check (session_status in ('planned','in_progress','completed','delayed','paused','cancelled'));

create index if not exists idx_job_sessions_job_id on public.job_sessions(job_id, session_date desc, started_at desc);
create index if not exists idx_job_sessions_supervisor on public.job_sessions(site_supervisor_profile_id, session_date desc);

create table if not exists public.job_session_crew_hours (
  id uuid primary key default gen_random_uuid(),
  job_session_id uuid references public.job_sessions(id) on delete set null,
  job_id bigint not null references public.jobs(id) on delete cascade,
  crew_id uuid references public.crews(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  worker_name text,
  started_at timestamptz,
  ended_at timestamptz,
  hours_worked numeric(10,2) not null default 0,
  regular_hours numeric(10,2) not null default 0,
  overtime_hours numeric(10,2) not null default 0,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_job_session_crew_hours_job_id on public.job_session_crew_hours(job_id, created_at desc);
create index if not exists idx_job_session_crew_hours_session_id on public.job_session_crew_hours(job_session_id, created_at desc);
create index if not exists idx_job_session_crew_hours_profile_id on public.job_session_crew_hours(profile_id, created_at desc);

create table if not exists public.job_reassignment_events (
  id uuid primary key default gen_random_uuid(),
  source_job_id bigint references public.jobs(id) on delete set null,
  target_job_id bigint references public.jobs(id) on delete cascade,
  crew_id uuid references public.crews(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  equipment_item_id bigint references public.equipment_items(id) on delete set null,
  reassignment_type text not null default 'temporary_split',
  reason text,
  emergency_override boolean not null default false,
  service_contract_reference text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  reassigned_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.job_reassignment_events drop constraint if exists job_reassignment_events_type_check;
alter table if exists public.job_reassignment_events
  add constraint job_reassignment_events_type_check check (reassignment_type in ('temporary_split','emergency_override','service_contract_support','equipment_redirect'));

create index if not exists idx_job_reassignment_events_source on public.job_reassignment_events(source_job_id, started_at desc);
create index if not exists idx_job_reassignment_events_target on public.job_reassignment_events(target_job_id, started_at desc);
create index if not exists idx_job_reassignment_events_profile on public.job_reassignment_events(profile_id, started_at desc);
create index if not exists idx_job_reassignment_events_equipment on public.job_reassignment_events(equipment_item_id, started_at desc);

create or replace view public.v_job_session_directory as
select
  js.id,
  js.job_id,
  j.job_code,
  j.job_name,
  js.session_date,
  js.session_kind,
  js.session_status,
  js.service_frequency_label,
  js.scheduled_start_at,
  js.started_at,
  js.ended_at,
  coalesce(
    js.duration_minutes,
    case when js.started_at is not null and js.ended_at is not null then greatest(0, floor(extract(epoch from (js.ended_at - js.started_at)) / 60))::int else 0 end
  ) as duration_minutes,
  concat(
    floor(coalesce(js.duration_minutes, case when js.started_at is not null and js.ended_at is not null then greatest(0, floor(extract(epoch from (js.ended_at - js.started_at)) / 60))::int else 0 end) / 60),
    'h ',
    (coalesce(js.duration_minutes, case when js.started_at is not null and js.ended_at is not null then greatest(0, floor(extract(epoch from (js.ended_at - js.started_at)) / 60))::int else 0 end) % 60),
    'm'
  ) as duration_label,
  js.delay_minutes,
  js.notes,
  js.site_supervisor_profile_id,
  sup.full_name as site_supervisor_name,
  js.site_supervisor_signoff_name,
  js.site_supervisor_signed_off_at,
  js.site_supervisor_signoff_notes,
  js.created_by_profile_id,
  creator.full_name as created_by_name,
  to_char(js.started_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') as started_at_local,
  to_char(js.ended_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') as ended_at_local,
  js.created_at,
  js.updated_at
from public.job_sessions js
left join public.jobs j on j.id = js.job_id
left join public.profiles sup on sup.id = js.site_supervisor_profile_id
left join public.profiles creator on creator.id = js.created_by_profile_id;

create or replace view public.v_job_crew_hours_directory as
select
  jh.id,
  jh.job_session_id,
  jh.job_id,
  j.job_code,
  j.job_name,
  jh.crew_id,
  c.crew_name,
  c.crew_code,
  jh.profile_id,
  p.full_name as profile_name,
  coalesce(jh.worker_name, p.full_name, p.email) as worker_name,
  jh.started_at,
  jh.ended_at,
  to_char(jh.started_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') as started_at_local,
  to_char(jh.ended_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') as ended_at_local,
  jh.hours_worked,
  jh.regular_hours,
  jh.overtime_hours,
  jh.notes,
  js.session_date,
  jh.created_at,
  jh.updated_at
from public.job_session_crew_hours jh
left join public.jobs j on j.id = jh.job_id
left join public.job_sessions js on js.id = jh.job_session_id
left join public.crews c on c.id = jh.crew_id
left join public.profiles p on p.id = jh.profile_id;

create or replace view public.v_job_reassignment_directory as
select
  re.id,
  re.source_job_id,
  src.job_code as source_job_code,
  src.job_name as source_job_name,
  re.target_job_id,
  tgt.job_code as target_job_code,
  tgt.job_name as target_job_name,
  re.crew_id,
  c.crew_name,
  c.crew_code,
  re.profile_id,
  p.full_name as profile_name,
  re.equipment_item_id,
  eq.equipment_code,
  eq.equipment_name,
  re.reassignment_type,
  re.reason,
  re.emergency_override,
  re.service_contract_reference,
  re.started_at,
  re.ended_at,
  to_char(re.started_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') as started_at_local,
  to_char(re.ended_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') as ended_at_local,
  re.notes,
  re.reassigned_by_profile_id,
  actor.full_name as reassigned_by_name,
  re.created_at,
  re.updated_at
from public.job_reassignment_events re
left join public.jobs src on src.id = re.source_job_id
left join public.jobs tgt on tgt.id = re.target_job_id
left join public.crews c on c.id = re.crew_id
left join public.profiles p on p.id = re.profile_id
left join public.equipment_items eq on eq.id = re.equipment_item_id
left join public.profiles actor on actor.id = re.reassigned_by_profile_id;

create or replace view public.v_jobs_directory as
select
  j.id,
  j.job_code,
  j.job_name,
  j.site_id,
  j.job_type,
  j.status,
  j.priority,
  j.client_name,
  j.start_date,
  j.end_date,
  j.site_supervisor_profile_id,
  j.signing_supervisor_profile_id,
  j.admin_profile_id,
  j.notes,
  j.created_by_profile_id,
  j.approval_status,
  j.approval_requested_at,
  j.approved_at,
  j.approved_by_profile_id,
  j.approval_notes,
  j.created_at,
  j.updated_at,
  s.site_code,
  s.site_name,
  sup.full_name as supervisor_name,
  signsup.full_name as signing_supervisor_name,
  adm.full_name as admin_name,
  j.crew_id,
  j.assigned_supervisor_profile_id,
  j.schedule_mode,
  j.recurrence_rule,
  j.recurrence_summary,
  j.recurrence_interval,
  j.recurrence_anchor_date,
  j.special_instructions,
  j.last_activity_at,
  crew.crew_name,
  assignedsup.full_name as assigned_supervisor_name,
  coalesce(crew_rollup.member_count, 0) as crew_member_count,
  coalesce(comment_rollup.comment_count, 0) as comment_count,
  coalesce(comment_rollup.photo_count, 0) as photo_count,
  crew.crew_code,
  j.job_family,
  j.project_scope,
  j.service_pattern,
  j.recurrence_basis,
  j.recurrence_custom_days,
  j.custom_schedule_notes,
  j.crew_lead_profile_id,
  j.equipment_planning_status,
  j.reservation_window_start,
  j.reservation_window_end,
  j.reservation_notes,
  j.estimated_visit_minutes,
  j.equipment_readiness_required,
  crew.crew_kind,
  crew.service_area_id,
  crew.default_equipment_notes,
  leadp.full_name as crew_lead_name,
  service_area.name as service_area_name,
  j.estimated_cost_total,
  j.quoted_charge_total,
  j.pricing_method,
  j.markup_percent,
  j.discount_mode,
  j.discount_value,
  j.tiered_discount_notes,
  j.estimated_profit_total,
  j.estimated_margin_percent,
  j.estimated_duration_hours,
  j.estimated_duration_days,
  j.open_end_date,
  j.delayed_schedule,
  j.delay_reason,
  j.delay_cost_total,
  j.equipment_repair_cost_total,
  j.actual_cost_total,
  j.actual_charge_total,
  j.actual_profit_total,
  j.actual_margin_percent,
  j.service_pricing_template_id,
  spt.template_code as service_pricing_template_code,
  spt.template_name as service_pricing_template_name,
  j.sales_tax_code_id,
  tc.code as sales_tax_code,
  tc.name as sales_tax_name,
  tc.tax_type as sales_tax_type,
  j.estimated_tax_rate_percent,
  j.estimated_tax_total,
  j.estimated_total_with_tax,
  j.pricing_basis_label,
  j.client_reference,
  j.service_contract_reference,
  j.billing_transaction_number,
  j.invoice_number,
  coalesce(session_rollup.session_count, 0)::int as session_count,
  coalesce(session_rollup.total_logged_minutes, 0)::int as total_logged_minutes,
  round(coalesce(session_rollup.total_logged_minutes, 0) / 60.0, 2) as total_logged_hours,
  session_rollup.last_session_started_at,
  session_rollup.last_session_ended_at,
  session_rollup.last_supervisor_signoff_at,
  coalesce(reassignment_rollup.reassignment_count, 0)::int as reassignment_count,
  coalesce(crew_hours_rollup.logged_hours_total, 0)::numeric(10,2) as logged_hours_total
from public.jobs j
left join public.sites s on s.id = j.site_id
left join public.profiles sup on sup.id = j.site_supervisor_profile_id
left join public.profiles signsup on signsup.id = j.signing_supervisor_profile_id
left join public.profiles adm on adm.id = j.admin_profile_id
left join public.crews crew on crew.id = j.crew_id
left join public.profiles assignedsup on assignedsup.id = j.assigned_supervisor_profile_id
left join public.profiles leadp on leadp.id = j.crew_lead_profile_id
left join public.service_areas service_area on service_area.id = crew.service_area_id
left join public.service_pricing_templates spt on spt.id = j.service_pricing_template_id
left join public.tax_codes tc on tc.id = j.sales_tax_code_id
left join (
  select crew_id, count(*)::int as member_count
  from public.crew_members
  group by crew_id
) crew_rollup on crew_rollup.crew_id = j.crew_id
left join (
  select jc.job_id, count(*)::int as comment_count, coalesce(sum(v.photo_count), 0)::int as photo_count
  from public.job_comments jc
  left join public.v_job_comment_activity v on v.id = jc.id
  group by jc.job_id
) comment_rollup on comment_rollup.job_id = j.id
left join (
  select job_id,
    count(*)::int as session_count,
    sum(coalesce(duration_minutes, 0))::int as total_logged_minutes,
    max(started_at) as last_session_started_at,
    max(ended_at) as last_session_ended_at,
    max(site_supervisor_signed_off_at) as last_supervisor_signoff_at
  from public.v_job_session_directory
  group by job_id
) session_rollup on session_rollup.job_id = j.id
left join (
  select job_id, sum(coalesce(hours_worked, 0))::numeric(10,2) as logged_hours_total
  from public.job_session_crew_hours
  group by job_id
) crew_hours_rollup on crew_hours_rollup.job_id = j.id
left join (
  select source_job_id as job_id, count(*)::int as reassignment_count
  from public.job_reassignment_events
  group by source_job_id
) reassignment_rollup on reassignment_rollup.job_id = j.id;
