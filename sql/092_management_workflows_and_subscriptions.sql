-- 092_management_workflows_and_subscriptions.sql
-- Adds management workflow depth on top of incident/corrective/training reporting:
-- - automated reminder / escalation fields for corrective actions and training
-- - worker self-service training acknowledgement support
-- - SDS prompts tied to product / job / route / equipment context
-- - site and supervisor scorecards
-- - report subscriptions and delivery candidates
-- - equipment-specific JSA / hazard-assessment linkage

alter table if exists public.corrective_action_tasks
  add column if not exists supervisor_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reminder_count integer not null default 0,
  add column if not exists next_reminder_at timestamptz,
  add column if not exists escalation_due_at date,
  add column if not exists escalated_at timestamptz,
  add column if not exists escalation_notes text;

create index if not exists idx_corrective_action_tasks_supervisor
  on public.corrective_action_tasks(supervisor_profile_id, due_date, created_at desc);

alter table if exists public.training_courses
  add column if not exists self_service_enabled boolean not null default true,
  add column if not exists require_supervisor_verification boolean not null default false,
  add column if not exists sds_prompt_text text;

alter table if exists public.training_records
  add column if not exists self_attested boolean not null default false,
  add column if not exists self_attested_at date,
  add column if not exists acknowledgement_method text not null default 'admin_recorded',
  add column if not exists verified_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists verified_at date,
  add column if not exists reminder_last_sent_at timestamptz;

alter table if exists public.training_records
  drop constraint if exists training_records_acknowledgement_method_check;

alter table if exists public.training_records
  add constraint training_records_acknowledgement_method_check
  check (acknowledgement_method in ('admin_recorded','worker_self_ack','imported','system_generated'));

alter table if exists public.sds_acknowledgements
  add column if not exists product_context jsonb not null default '{}'::jsonb,
  add column if not exists equipment_code text,
  add column if not exists job_code text,
  add column if not exists work_order_number text,
  add column if not exists route_code text;

create table if not exists public.report_subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscription_scope text not null default 'safety_reporting',
  subscription_name text not null,
  report_kind text not null default 'weekly_supervisor_summary',
  cadence text not null default 'weekly',
  delivery_channel text not null default 'email',
  target_role text,
  target_profile_id uuid references public.profiles(id) on delete set null,
  recipient_email text,
  report_preset_id uuid references public.report_presets(id) on delete set null,
  filter_payload jsonb not null default '{}'::jsonb,
  include_csv boolean not null default true,
  is_active boolean not null default true,
  last_sent_at timestamptz,
  next_send_at timestamptz,
  last_status text,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.report_subscriptions
  drop constraint if exists report_subscriptions_scope_check;
alter table if exists public.report_subscriptions
  add constraint report_subscriptions_scope_check
  check (subscription_scope in ('safety_reporting'));

alter table if exists public.report_subscriptions
  drop constraint if exists report_subscriptions_kind_check;
alter table if exists public.report_subscriptions
  add constraint report_subscriptions_kind_check
  check (report_kind in ('weekly_supervisor_summary','overdue_corrective_actions','training_expiry_30_days','rejected_evidence_followup','incident_near_miss_summary'));

alter table if exists public.report_subscriptions
  drop constraint if exists report_subscriptions_cadence_check;
alter table if exists public.report_subscriptions
  add constraint report_subscriptions_cadence_check
  check (cadence in ('daily','weekly','monthly'));

alter table if exists public.report_subscriptions
  drop constraint if exists report_subscriptions_delivery_channel_check;
alter table if exists public.report_subscriptions
  add constraint report_subscriptions_delivery_channel_check
  check (delivery_channel in ('email','in_app'));

create index if not exists idx_report_subscriptions_active_next_send
  on public.report_subscriptions(is_active, next_send_at, cadence);

create table if not exists public.equipment_jsa_hazard_links (
  id uuid primary key default gen_random_uuid(),
  source_submission_id bigint references public.submissions(id) on delete set null,
  linked_hse_packet_id uuid references public.linked_hse_packets(id) on delete set null,
  equipment_code text,
  job_code text,
  work_order_number text,
  route_code text,
  hazard_title text not null,
  hazard_summary text,
  jsa_required boolean not null default true,
  status text not null default 'open',
  review_due_date date,
  completed_at date,
  notes text,
  payload jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.equipment_jsa_hazard_links
  drop constraint if exists equipment_jsa_hazard_links_status_check;
alter table if exists public.equipment_jsa_hazard_links
  add constraint equipment_jsa_hazard_links_status_check
  check (status in ('open','in_review','ready','closed','cancelled'));

create index if not exists idx_equipment_jsa_hazard_links_due
  on public.equipment_jsa_hazard_links(status, review_due_date, created_at desc);

insert into public.equipment_jsa_hazard_links (
  source_submission_id,
  equipment_code,
  job_code,
  work_order_number,
  route_code,
  hazard_title,
  hazard_summary,
  jsa_required,
  status,
  review_due_date,
  payload,
  created_at,
  updated_at
)
select
  inc.submission_id,
  nullif(inc.equipment_code, ''),
  nullif(inc.job_code, ''),
  nullif(inc.work_order_number, ''),
  nullif(inc.route_code, ''),
  left(coalesce(nullif(inc.event_summary, ''), 'Hazard / JSA review'), 160),
  nullif(inc.root_cause_summary, ''),
  true,
  'open',
  case
    when nullif(inc.corrective_action_due_date, '') is not null then nullif(inc.corrective_action_due_date, '')::date
    else current_date + 14
  end,
  jsonb_build_object(
    'source', '092_backfill',
    'incident_kind', inc.incident_kind,
    'severity', inc.severity,
    'site_label', inc.site_label,
    'worker_name', inc.worker_name
  ),
  coalesce(inc.created_at, now()),
  now()
from public.v_incident_near_miss_history inc
where coalesce(nullif(inc.equipment_code, ''), '') <> ''
  and not exists (
    select 1 from public.equipment_jsa_hazard_links j
    where j.source_submission_id = inc.submission_id
      and coalesce(j.equipment_code, '') = coalesce(inc.equipment_code, '')
  );

create or replace view public.v_corrective_action_task_directory as
with event_rollup as (
  select
    e.task_id,
    count(*)::int as event_count,
    max(e.created_at) as last_event_at,
    (array_agg(e.event_type order by e.created_at desc nulls last))[1] as last_event_type,
    (array_agg(e.event_notes order by e.created_at desc nulls last))[1] as last_event_notes,
    (array_agg(coalesce(p.full_name, p.email, e.changed_by_profile_id::text) order by e.created_at desc nulls last))[1] as last_changed_by_name
  from public.corrective_action_task_events e
  left join public.profiles p on p.id = e.changed_by_profile_id
  group by e.task_id
)
select
  -- keep old 091 column order first
  t.id,
  t.source_submission_id,
  t.source_history_type,
  t.source_record_number,
  t.task_scope,
  t.task_title,
  t.task_description,
  t.priority,
  t.status,
  t.assigned_to_profile_id,
  coalesce(ap.full_name, ap.email, '') as assigned_to_name,
  t.assigned_by_profile_id,
  coalesce(bp.full_name, bp.email, '') as assigned_by_name,
  t.owner_name,
  t.due_date,
  t.started_at,
  t.completed_at,
  t.escalation_level,
  t.reminder_last_sent_at,
  t.closeout_notes,
  t.payload,
  t.created_at,
  t.updated_at,
  inc.submission_date,
  inc.site_id,
  inc.site_code,
  inc.site_name,
  inc.site_label,
  inc.worker_name,
  inc.job_code,
  inc.work_order_number,
  inc.route_code,
  inc.event_summary,
  inc.immediate_actions_taken,
  inc.root_cause_summary,
  inc.incident_kind,
  inc.severity,
  case when t.status <> 'closed' and t.due_date is not null and t.due_date < current_date then true else false end as is_overdue,
  greatest(0, current_date - coalesce(t.due_date, current_date))::int as days_overdue,
  coalesce(er.event_count, 0) as event_count,
  er.last_event_at,
  er.last_event_type,
  er.last_event_notes,
  er.last_changed_by_name,
  -- append new columns only
  t.supervisor_profile_id,
  coalesce(sp.full_name, sp.email, '') as supervisor_name,
  t.reminder_count,
  t.next_reminder_at,
  t.escalation_due_at,
  t.escalated_at,
  t.escalation_notes,
  case when t.status <> 'closed' and t.due_date is not null and t.due_date between current_date and current_date + 7 then true else false end as is_due_within_7_days,
  case when t.status <> 'closed' and t.next_reminder_at is not null and t.next_reminder_at <= now() then true else false end as reminder_due,
  case when t.status <> 'closed' and t.escalation_due_at is not null and t.escalation_due_at <= current_date then true else false end as escalation_due
from public.corrective_action_tasks t
left join public.profiles ap on ap.id = t.assigned_to_profile_id
left join public.profiles bp on bp.id = t.assigned_by_profile_id
left join public.profiles sp on sp.id = t.supervisor_profile_id
left join public.v_incident_near_miss_history inc on inc.submission_id = t.source_submission_id
left join event_rollup er on er.task_id = t.id;

create or replace view public.v_training_course_directory as
select
  -- keep old order first
  tc.id,
  tc.course_code,
  tc.course_name,
  tc.category,
  tc.validity_months,
  tc.reminder_days_before,
  tc.requires_sds_acknowledgement,
  tc.is_active,
  tc.notes,
  tc.created_at,
  tc.updated_at,
  -- append new columns
  tc.self_service_enabled,
  tc.require_supervisor_verification,
  tc.sds_prompt_text
from public.training_courses tc
where tc.is_active = true;

create or replace view public.v_training_record_directory as
select
  -- keep old order first
  tr.id,
  tr.profile_id,
  coalesce(p.full_name, p.email, '') as profile_name,
  p.role as profile_role,
  p.employee_number,
  tr.course_id,
  tc.course_code,
  tc.course_name,
  tc.category,
  tc.validity_months,
  tc.reminder_days_before,
  tc.requires_sds_acknowledgement,
  tr.completion_status,
  tr.completed_at,
  tr.expires_at,
  tr.trainer_name,
  tr.provider_name,
  tr.certificate_number,
  tr.license_number,
  tr.source_submission_id,
  tr.notes,
  tr.created_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as created_by_name,
  tr.created_at,
  tr.updated_at,
  case when tr.expires_at is not null and tr.expires_at < current_date then true else false end as is_expired,
  case when tr.expires_at is not null and tr.expires_at between current_date and current_date + interval '30 days' then true else false end as expires_within_30_days,
  case when tr.expires_at is not null then greatest(0, tr.expires_at - current_date)::int else null end as days_until_expiry,
  -- append new columns
  tr.self_attested,
  tr.self_attested_at,
  tr.acknowledgement_method,
  tr.verified_by_profile_id,
  coalesce(vp.full_name, vp.email, '') as verified_by_name,
  tr.verified_at,
  tr.reminder_last_sent_at,
  case when tr.self_attested = true and tr.verified_at is null and tc.require_supervisor_verification = true then true else false end as verification_pending,
  case when tr.expires_at is not null and tr.expires_at between current_date and current_date + 7 then true else false end as expires_within_7_days
from public.training_records tr
left join public.profiles p on p.id = tr.profile_id
left join public.training_courses tc on tc.id = tr.course_id
left join public.profiles cp on cp.id = tr.created_by_profile_id
left join public.profiles vp on vp.id = tr.verified_by_profile_id;

create or replace view public.v_sds_acknowledgement_directory as
select
  -- keep old order first
  sa.id,
  sa.profile_id,
  coalesce(p.full_name, p.email, '') as profile_name,
  p.employee_number,
  sa.chemical_name,
  sa.product_name,
  sa.vendor_name,
  sa.sds_revision_date,
  sa.acknowledged_at,
  sa.expires_at,
  sa.status,
  sa.source_submission_id,
  sa.linked_training_record_id,
  sa.acknowledged_by_profile_id,
  coalesce(ap.full_name, ap.email, '') as acknowledged_by_name,
  sa.notes,
  sa.created_at,
  sa.updated_at,
  case when sa.expires_at is not null and sa.expires_at < current_date then true else false end as is_expired,
  case when sa.expires_at is not null and sa.expires_at between current_date and current_date + interval '30 days' then true else false end as expires_within_30_days,
  -- append new columns
  sa.product_context,
  sa.equipment_code,
  sa.job_code,
  sa.work_order_number,
  sa.route_code,
  trim(both ' ' from concat(
    coalesce(sa.product_name, sa.chemical_name, ''),
    case when coalesce(sa.job_code, sa.work_order_number, sa.route_code, sa.equipment_code, '') <> '' then ' • ' else '' end,
    concat_ws(' / ', nullif(sa.job_code, ''), nullif(sa.work_order_number, ''), nullif(sa.route_code, ''), nullif(sa.equipment_code, ''))
  )) as prompt_context_label,
  case when sa.expires_at is not null and sa.expires_at between current_date and current_date + 7 then true else false end as expires_within_7_days
from public.sds_acknowledgements sa
left join public.profiles p on p.id = sa.profile_id
left join public.profiles ap on ap.id = sa.acknowledged_by_profile_id;

create or replace view public.v_report_subscription_directory as
select
  rs.id,
  rs.subscription_scope,
  rs.subscription_name,
  rs.report_kind,
  rs.cadence,
  rs.delivery_channel,
  rs.target_role,
  rs.target_profile_id,
  coalesce(tp.full_name, tp.email, '') as target_profile_name,
  rs.recipient_email,
  rs.report_preset_id,
  coalesce(rp.preset_name, '') as report_preset_name,
  rs.filter_payload,
  rs.include_csv,
  rs.is_active,
  rs.last_sent_at,
  rs.next_send_at,
  rs.last_status,
  rs.notes,
  rs.created_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as created_by_name,
  rs.created_at,
  rs.updated_at,
  case when rs.is_active = true and rs.next_send_at is not null and rs.next_send_at <= now() then true else false end as send_due
from public.report_subscriptions rs
left join public.profiles tp on tp.id = rs.target_profile_id
left join public.report_presets rp on rp.id = rs.report_preset_id
left join public.profiles cp on cp.id = rs.created_by_profile_id;

create or replace view public.v_report_delivery_candidates as
select
  id,
  subscription_scope,
  subscription_name,
  report_kind,
  cadence,
  delivery_channel,
  target_role,
  target_profile_id,
  target_profile_name,
  recipient_email,
  report_preset_id,
  report_preset_name,
  filter_payload,
  include_csv,
  next_send_at,
  last_sent_at,
  last_status,
  notes
from public.v_report_subscription_directory
where is_active = true
  and send_due = true;

create or replace view public.v_equipment_jsa_hazard_link_directory as
select
  j.id,
  j.source_submission_id,
  j.linked_hse_packet_id,
  j.equipment_code,
  j.job_code,
  j.work_order_number,
  j.route_code,
  j.hazard_title,
  j.hazard_summary,
  j.jsa_required,
  j.status,
  j.review_due_date,
  j.completed_at,
  j.notes,
  j.payload,
  j.created_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as created_by_name,
  j.created_at,
  j.updated_at,
  case when j.status <> 'closed' and j.review_due_date is not null and j.review_due_date < current_date then true else false end as is_overdue,
  coalesce(lp.packet_number, '') as linked_packet_number
from public.equipment_jsa_hazard_links j
left join public.profiles cp on cp.id = j.created_by_profile_id
left join public.linked_hse_packets lp on lp.id = j.linked_hse_packet_id;

create or replace view public.v_site_safety_scorecards as
with submission_rollup as (
  select
    coalesce(site_id::text, site_label, site_name, site_code, 'unknown') as site_ref,
    (array_agg(site_id order by site_id nulls last))[1] as site_id,
    max(site_code) as site_code,
    max(site_name) as site_name,
    max(site_label) as site_label,
    count(*)::int as submission_count,
    count(*) filter (where form_key = 'incident')::int as incident_count,
    count(*) filter (where coalesce(last_review_action, '') = 'rejected' or coalesce(status, '') = 'rejected')::int as rejected_count,
    max(submission_date) as last_submission_date
  from public.v_hse_submission_history_report
  group by coalesce(site_id::text, site_label, site_name, site_code, 'unknown')
), corrective_rollup as (
  select
    coalesce(site_id::text, site_label, site_name, site_code, 'unknown') as site_ref,
    count(*) filter (where status <> 'closed')::int as open_corrective_count,
    count(*) filter (where is_overdue = true)::int as overdue_corrective_count,
    count(*) filter (where reminder_due = true or escalation_due = true)::int as escalation_attention_count
  from public.v_corrective_action_task_directory
  group by coalesce(site_id::text, site_label, site_name, site_code, 'unknown')
)
select
  sr.site_ref,
  sr.site_id,
  sr.site_code,
  sr.site_name,
  sr.site_label,
  sr.submission_count,
  sr.incident_count,
  sr.rejected_count,
  coalesce(cr.open_corrective_count, 0) as open_corrective_count,
  coalesce(cr.overdue_corrective_count, 0) as overdue_corrective_count,
  coalesce(cr.escalation_attention_count, 0) as escalation_attention_count,
  sr.last_submission_date,
  case
    when coalesce(cr.overdue_corrective_count, 0) > 0 then 'high'
    when sr.rejected_count > 0 then 'medium'
    else 'normal'
  end as scorecard_status
from submission_rollup sr
left join corrective_rollup cr on cr.site_ref = sr.site_ref;

create or replace view public.v_supervisor_scorecards as
with corrective_rollup as (
  select
    coalesce(supervisor_profile_id::text, assigned_to_profile_id::text, 'unassigned') as supervisor_ref,
    (array_agg(supervisor_profile_id order by supervisor_profile_id nulls last))[1] as supervisor_profile_id,
    count(*)::int as task_count,
    count(*) filter (where status <> 'closed')::int as open_task_count,
    count(*) filter (where is_overdue = true)::int as overdue_task_count,
    count(*) filter (where reminder_due = true or escalation_due = true)::int as reminder_or_escalation_count,
    max(updated_at) as last_activity_at
  from public.v_corrective_action_task_directory
  group by coalesce(supervisor_profile_id::text, assigned_to_profile_id::text, 'unassigned')
), training_rollup as (
  select
    p.default_supervisor_profile_id as supervisor_profile_id,
    count(*) filter (where is_expired = true)::int as expired_training_count,
    count(*) filter (where expires_within_30_days = true)::int as expiring_training_count,
    count(*) filter (where verification_pending = true)::int as verification_pending_count
  from public.v_training_record_directory tr
  left join public.profiles p on p.id = tr.profile_id
  group by p.default_supervisor_profile_id
), sds_rollup as (
  select
    p.default_supervisor_profile_id as supervisor_profile_id,
    count(*) filter (where is_expired = true)::int as expired_sds_count,
    count(*) filter (where expires_within_30_days = true)::int as expiring_sds_count
  from public.v_sds_acknowledgement_directory sa
  left join public.profiles p on p.id = sa.profile_id
  group by p.default_supervisor_profile_id
)
select
  coalesce(cr.supervisor_profile_id, tr.supervisor_profile_id, sr.supervisor_profile_id) as supervisor_profile_id,
  coalesce(pp.full_name, pp.email, 'Unassigned supervisor') as supervisor_name,
  coalesce(cr.task_count, 0) as task_count,
  coalesce(cr.open_task_count, 0) as open_task_count,
  coalesce(cr.overdue_task_count, 0) as overdue_task_count,
  coalesce(cr.reminder_or_escalation_count, 0) as reminder_or_escalation_count,
  coalesce(tr.expired_training_count, 0) as expired_training_count,
  coalesce(tr.expiring_training_count, 0) as expiring_training_count,
  coalesce(tr.verification_pending_count, 0) as verification_pending_count,
  coalesce(sr.expired_sds_count, 0) as expired_sds_count,
  coalesce(sr.expiring_sds_count, 0) as expiring_sds_count,
  cr.last_activity_at,
  case
    when coalesce(cr.overdue_task_count, 0) > 0 or coalesce(tr.expired_training_count, 0) > 0 or coalesce(sr.expired_sds_count, 0) > 0 then 'high'
    when coalesce(cr.reminder_or_escalation_count, 0) > 0 or coalesce(tr.expiring_training_count, 0) > 0 or coalesce(sr.expiring_sds_count, 0) > 0 then 'medium'
    else 'normal'
  end as scorecard_status
from corrective_rollup cr
full outer join training_rollup tr on tr.supervisor_profile_id = cr.supervisor_profile_id
full outer join sds_rollup sr on sr.supervisor_profile_id = coalesce(cr.supervisor_profile_id, tr.supervisor_profile_id)
left join public.profiles pp on pp.id = coalesce(cr.supervisor_profile_id, tr.supervisor_profile_id, sr.supervisor_profile_id);

create or replace view public.v_overdue_action_alerts as
select
  'corrective_action'::text as alert_type,
  id::text as alert_id,
  coalesce(site_label, site_name, site_code, 'Unknown site') as primary_context,
  task_title as headline,
  status as alert_status,
  priority as alert_priority,
  coalesce(assigned_to_name, owner_name, '') as owner_name,
  coalesce(due_date::text, '') as due_label,
  updated_at as sort_at
from public.v_corrective_action_task_directory
where status <> 'closed' and (is_overdue = true or reminder_due = true or escalation_due = true)

union all

select
  'training_expiry'::text,
  id::text,
  coalesce(profile_name, 'Unknown worker') as primary_context,
  concat(course_name, ' training follow-up') as headline,
  case when is_expired then 'expired' else 'expiring' end as alert_status,
  case when is_expired then 'high' else 'medium' end as alert_priority,
  profile_name as owner_name,
  coalesce(expires_at::text, '') as due_label,
  updated_at as sort_at
from public.v_training_record_directory
where is_expired = true or expires_within_7_days = true or verification_pending = true

union all

select
  'sds_acknowledgement'::text,
  id::text,
  coalesce(profile_name, 'Unknown worker') as primary_context,
  concat(coalesce(product_name, chemical_name, 'Product'), ' SDS prompt') as headline,
  case when is_expired then 'expired' else 'expiring' end as alert_status,
  case when is_expired then 'high' else 'medium' end as alert_priority,
  profile_name as owner_name,
  coalesce(expires_at::text, '') as due_label,
  updated_at as sort_at
from public.v_sds_acknowledgement_directory
where is_expired = true or expires_within_7_days = true

union all

select
  'report_subscription'::text,
  id::text,
  coalesce(target_profile_name, recipient_email, target_role, 'Report recipient') as primary_context,
  subscription_name as headline,
  coalesce(last_status, 'pending') as alert_status,
  'medium'::text as alert_priority,
  coalesce(target_profile_name, recipient_email, '') as owner_name,
  coalesce(next_send_at::text, '') as due_label,
  updated_at as sort_at
from public.v_report_subscription_directory
where send_due = true

union all

select
  'jsa_hazard_review'::text,
  id::text,
  coalesce(equipment_code, job_code, work_order_number, route_code, 'Equipment / work context') as primary_context,
  hazard_title as headline,
  status as alert_status,
  case when is_overdue then 'high' else 'medium' end as alert_priority,
  '' as owner_name,
  coalesce(review_due_date::text, '') as due_label,
  updated_at as sort_at
from public.v_equipment_jsa_hazard_link_directory
where status <> 'closed' and (is_overdue = true or review_due_date between current_date and current_date + 7);

create or replace view public.v_supervisor_safety_queue as
select
  -- keep old 091 column order first
  'corrective_action'::text as queue_type,
  t.id::text as queue_id,
  coalesce(t.site_label, 'Unknown site') as primary_context,
  coalesce(t.task_title, 'Corrective action') as headline,
  coalesce(t.status, 'open') as queue_status,
  t.priority as queue_priority,
  coalesce(t.assigned_to_name, t.owner_name, '') as owner_name,
  t.due_date::text as due_label,
  t.updated_at as sort_at,
  -- append new columns
  coalesce(t.site_code, '') as site_code,
  coalesce(t.site_name, '') as site_name,
  coalesce(t.job_code, '') as job_code,
  coalesce(t.work_order_number, '') as work_order_number,
  coalesce(t.route_code, '') as route_code,
  coalesce(t.supervisor_name, '') as supervisor_name
from public.v_corrective_action_task_directory t
where t.status <> 'closed'

union all

select
  'training_expiry'::text,
  tr.id::text,
  coalesce(tr.profile_name, 'Unknown worker') as primary_context,
  concat(tr.course_name, ' training expiry') as headline,
  case when tr.is_expired then 'expired' when tr.verification_pending then 'verification_pending' else 'expiring' end as queue_status,
  case when tr.is_expired then 'high' else 'medium' end as queue_priority,
  tr.profile_name as owner_name,
  coalesce(tr.expires_at::text, '') as due_label,
  tr.updated_at as sort_at,
  '' as site_code,
  '' as site_name,
  '' as job_code,
  '' as work_order_number,
  '' as route_code,
  '' as supervisor_name
from public.v_training_record_directory tr
where tr.is_expired = true or tr.expires_within_30_days = true or tr.verification_pending = true

union all

select
  'sds_acknowledgement'::text,
  sa.id::text,
  coalesce(sa.profile_name, 'Unknown worker') as primary_context,
  concat(coalesce(sa.chemical_name, 'Chemical'), ' SDS acknowledgement') as headline,
  case when sa.is_expired then 'expired' else 'acknowledged' end as queue_status,
  case when sa.is_expired then 'high' else 'medium' end as queue_priority,
  sa.profile_name as owner_name,
  coalesce(sa.expires_at::text, '') as due_label,
  sa.updated_at as sort_at,
  '' as site_code,
  '' as site_name,
  coalesce(sa.job_code, '') as job_code,
  coalesce(sa.work_order_number, '') as work_order_number,
  coalesce(sa.route_code, '') as route_code,
  '' as supervisor_name
from public.v_sds_acknowledgement_directory sa
where sa.is_expired = true or sa.expires_within_30_days = true

union all

select
  'report_subscription'::text,
  rs.id::text,
  coalesce(rs.target_profile_name, rs.recipient_email, rs.target_role, 'Report recipient') as primary_context,
  rs.subscription_name as headline,
  coalesce(rs.last_status, 'pending') as queue_status,
  'medium'::text as queue_priority,
  coalesce(rs.target_profile_name, rs.recipient_email, '') as owner_name,
  coalesce(rs.next_send_at::text, '') as due_label,
  rs.updated_at as sort_at,
  '' as site_code,
  '' as site_name,
  '' as job_code,
  '' as work_order_number,
  '' as route_code,
  '' as supervisor_name
from public.v_report_subscription_directory rs
where rs.send_due = true

union all

select
  'jsa_hazard_review'::text,
  j.id::text,
  coalesce(j.equipment_code, j.job_code, j.work_order_number, j.route_code, 'Equipment / work context') as primary_context,
  j.hazard_title as headline,
  j.status as queue_status,
  case when j.is_overdue then 'high' else 'medium' end as queue_priority,
  '' as owner_name,
  coalesce(j.review_due_date::text, '') as due_label,
  j.updated_at as sort_at,
  '' as site_code,
  '' as site_name,
  coalesce(j.job_code, '') as job_code,
  coalesce(j.work_order_number, '') as work_order_number,
  coalesce(j.route_code, '') as route_code,
  '' as supervisor_name
from public.v_equipment_jsa_hazard_link_directory j
where j.status <> 'closed' and (j.is_overdue = true or j.review_due_date between current_date and current_date + 30);
