-- 091_corrective_actions_training_and_sds_tracking.sql
-- Adds first-class corrective-action tasks, training / certification tracking,
-- SDS acknowledgement history, and management-focused reporting views.

create table if not exists public.corrective_action_tasks (
  id uuid primary key default gen_random_uuid(),
  source_submission_id bigint references public.submissions(id) on delete set null,
  source_history_type text not null default 'incident_submission',
  source_record_number text,
  task_scope text not null default 'incident_corrective_action',
  task_title text not null,
  task_description text,
  priority text not null default 'medium',
  status text not null default 'open',
  assigned_to_profile_id uuid references public.profiles(id) on delete set null,
  assigned_by_profile_id uuid references public.profiles(id) on delete set null,
  owner_name text,
  due_date date,
  started_at timestamptz,
  completed_at timestamptz,
  escalation_level integer not null default 0,
  reminder_last_sent_at timestamptz,
  closeout_notes text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.corrective_action_tasks
  drop constraint if exists corrective_action_tasks_priority_check;

alter table if exists public.corrective_action_tasks
  add constraint corrective_action_tasks_priority_check
  check (priority in ('low','medium','high','critical'));

alter table if exists public.corrective_action_tasks
  drop constraint if exists corrective_action_tasks_status_check;

alter table if exists public.corrective_action_tasks
  add constraint corrective_action_tasks_status_check
  check (status in ('open','in_progress','blocked','ready_for_review','closed','cancelled'));

create index if not exists idx_corrective_action_tasks_status_due
  on public.corrective_action_tasks(status, due_date, created_at desc);

create index if not exists idx_corrective_action_tasks_assigned
  on public.corrective_action_tasks(assigned_to_profile_id, due_date, created_at desc);

create table if not exists public.corrective_action_task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.corrective_action_tasks(id) on delete cascade,
  event_type text not null default 'note',
  event_status text,
  event_notes text,
  changed_by_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_corrective_action_task_events_task
  on public.corrective_action_task_events(task_id, created_at desc);

create table if not exists public.training_courses (
  id uuid primary key default gen_random_uuid(),
  course_code text not null unique,
  course_name text not null,
  category text not null default 'safety',
  validity_months integer,
  reminder_days_before integer not null default 30,
  requires_sds_acknowledgement boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_training_courses_active
  on public.training_courses(is_active, category, course_name);

create table if not exists public.training_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.training_courses(id) on delete cascade,
  completion_status text not null default 'completed',
  completed_at date,
  expires_at date,
  trainer_name text,
  provider_name text,
  certificate_number text,
  license_number text,
  source_submission_id bigint references public.submissions(id) on delete set null,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.training_records
  drop constraint if exists training_records_status_check;

alter table if exists public.training_records
  add constraint training_records_status_check
  check (completion_status in ('scheduled','in_progress','completed','expired','waived'));

create index if not exists idx_training_records_profile
  on public.training_records(profile_id, expires_at, completed_at desc);

create index if not exists idx_training_records_course
  on public.training_records(course_id, expires_at, completed_at desc);

create table if not exists public.sds_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  chemical_name text not null,
  product_name text,
  vendor_name text,
  sds_revision_date date,
  acknowledged_at date not null default current_date,
  expires_at date,
  status text not null default 'acknowledged',
  source_submission_id bigint references public.submissions(id) on delete set null,
  linked_training_record_id uuid references public.training_records(id) on delete set null,
  acknowledged_by_profile_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.sds_acknowledgements
  drop constraint if exists sds_acknowledgements_status_check;

alter table if exists public.sds_acknowledgements
  add constraint sds_acknowledgements_status_check
  check (status in ('acknowledged','expired','revoked'));

create index if not exists idx_sds_acknowledgements_profile
  on public.sds_acknowledgements(profile_id, expires_at, acknowledged_at desc);

insert into public.training_courses (course_code, course_name, category, validity_months, reminder_days_before, requires_sds_acknowledgement, notes)
values
  ('WHMIS', 'WHMIS / Hazard Communication', 'safety', 12, 30, true, 'Covers chemical hazard communication and SDS review expectations.'),
  ('FIRST_AID', 'First Aid / CPR', 'medical', 36, 60, false, 'Worker first aid and CPR certification tracking.'),
  ('INCIDENT_REPORTING', 'Incident / Near-Miss Reporting', 'safety', 12, 30, false, 'How to report hazards, incidents, and close calls correctly.'),
  ('EMERGENCY_RESPONSE', 'Emergency Response and Drill Readiness', 'emergency', 12, 30, false, 'Emergency procedures, contacts, and drill expectations.'),
  ('JSA_HAZARD', 'Hazard Assessment / JSA Review', 'safety', 12, 30, false, 'Routine and non-routine hazard assessment expectations.'),
  ('PPE_USE', 'PPE Selection and Use', 'safety', 12, 30, false, 'PPE verification, selection, inspection, and use reminders.')
on conflict (course_code) do update set
  course_name = excluded.course_name,
  category = excluded.category,
  validity_months = excluded.validity_months,
  reminder_days_before = excluded.reminder_days_before,
  requires_sds_acknowledgement = excluded.requires_sds_acknowledgement,
  notes = excluded.notes,
  is_active = true,
  updated_at = now();

insert into public.corrective_action_tasks (
  source_submission_id,
  source_history_type,
  source_record_number,
  task_scope,
  task_title,
  task_description,
  priority,
  status,
  owner_name,
  due_date,
  payload,
  created_at,
  updated_at
)
select
  inc.submission_id,
  'incident_submission',
  inc.submission_id::text,
  'incident_corrective_action',
  left(coalesce(nullif(inc.event_summary, ''), 'Incident corrective action'), 160) as task_title,
  nullif(inc.corrective_action_required, '') as task_description,
  case when lower(coalesce(inc.severity, '')) in ('high','critical') then 'high' else 'medium' end as priority,
  case when lower(coalesce(inc.corrective_action_status, '')) in ('closed','complete','completed') then 'closed' else 'open' end as status,
  nullif(inc.corrective_action_owner, '') as owner_name,
  nullif(inc.corrective_action_due_date, '')::date as due_date,
  jsonb_build_object(
    'incident_kind', inc.incident_kind,
    'severity', inc.severity,
    'site_label', inc.site_label,
    'job_code', inc.job_code,
    'work_order_number', inc.work_order_number,
    'route_code', inc.route_code,
    'worker_name', inc.worker_name,
    'source', '091_backfill'
  ) as payload,
  coalesce(inc.created_at, now()),
  now()
from public.v_incident_near_miss_history inc
where coalesce(nullif(inc.corrective_action_required, ''), '') <> ''
  and not exists (
    select 1
    from public.corrective_action_tasks t
    where t.source_submission_id = inc.submission_id
      and t.task_scope = 'incident_corrective_action'
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
  er.last_changed_by_name
from public.corrective_action_tasks t
left join public.profiles ap on ap.id = t.assigned_to_profile_id
left join public.profiles bp on bp.id = t.assigned_by_profile_id
left join public.v_incident_near_miss_history inc on inc.submission_id = t.source_submission_id
left join event_rollup er on er.task_id = t.id;

create or replace view public.v_corrective_action_task_summary as
select
  count(*)::int as task_count,
  count(*) filter (where status in ('open','in_progress','blocked','ready_for_review'))::int as open_task_count,
  count(*) filter (where status = 'closed')::int as closed_task_count,
  count(*) filter (where status <> 'closed' and due_date is not null and due_date < current_date)::int as overdue_task_count,
  count(*) filter (where priority in ('high','critical') and status <> 'closed')::int as high_priority_open_count,
  max(updated_at) as last_updated_at
from public.corrective_action_tasks;

create or replace view public.v_training_course_directory as
select
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
  tc.updated_at
from public.training_courses tc
where tc.is_active = true;

create or replace view public.v_training_record_directory as
select
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
  case when tr.expires_at is not null then greatest(0, tr.expires_at - current_date)::int else null end as days_until_expiry
from public.training_records tr
left join public.profiles p on p.id = tr.profile_id
left join public.training_courses tc on tc.id = tr.course_id
left join public.profiles cp on cp.id = tr.created_by_profile_id;

create or replace view public.v_training_expiry_summary as
select
  count(*)::int as record_count,
  count(*) filter (where is_expired = true)::int as expired_count,
  count(*) filter (where expires_within_30_days = true)::int as expiring_30_days_count,
  count(*) filter (where completion_status = 'scheduled')::int as scheduled_count,
  max(updated_at) as last_updated_at
from public.v_training_record_directory;

create or replace view public.v_sds_acknowledgement_directory as
select
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
  case when sa.expires_at is not null and sa.expires_at between current_date and current_date + interval '30 days' then true else false end as expires_within_30_days
from public.sds_acknowledgements sa
left join public.profiles p on p.id = sa.profile_id
left join public.profiles ap on ap.id = sa.acknowledged_by_profile_id;

create or replace view public.v_supervisor_safety_queue as
select
  'corrective_action'::text as queue_type,
  t.id::text as queue_id,
  coalesce(t.site_label, 'Unknown site') as primary_context,
  coalesce(t.task_title, 'Corrective action') as headline,
  coalesce(t.status, 'open') as queue_status,
  t.priority as queue_priority,
  coalesce(t.assigned_to_name, t.owner_name, '') as owner_name,
  t.due_date::text as due_label,
  t.updated_at as sort_at
from public.v_corrective_action_task_directory t
where t.status <> 'closed'

union all

select
  'training_expiry'::text,
  tr.id::text,
  coalesce(tr.profile_name, 'Unknown worker') as primary_context,
  concat(tr.course_name, ' training expiry') as headline,
  case when tr.is_expired then 'expired' else 'expiring' end as queue_status,
  case when tr.is_expired then 'high' else 'medium' end as queue_priority,
  tr.profile_name as owner_name,
  coalesce(tr.expires_at::text, '') as due_label,
  tr.updated_at as sort_at
from public.v_training_record_directory tr
where tr.is_expired = true or tr.expires_within_30_days = true

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
  sa.updated_at as sort_at
from public.v_sds_acknowledgement_directory sa
where sa.is_expired = true or sa.expires_within_30_days = true;
