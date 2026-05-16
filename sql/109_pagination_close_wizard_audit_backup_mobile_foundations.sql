-- Schema 109: pagination, guided close actions, audit log, backup rehearsal, bank CSV import staging, evidence queue, and mobile action cards.
-- 109_pagination_close_wizard_audit_backup_mobile_foundations.sql

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  migration_key text,
  schema_name text,
  release_label text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.admin_close_workflow_steps add column if not exists owner_profile_id uuid references public.profiles(id);
alter table public.admin_close_workflow_steps add column if not exists due_at timestamptz;
alter table public.admin_close_workflow_steps add column if not exists blocker_count_override int;
alter table public.admin_close_workflow_steps add column if not exists completion_notes text;
alter table public.admin_close_workflow_steps add column if not exists completed_by_profile_id uuid references public.profiles(id);
alter table public.admin_close_workflow_steps add column if not exists completed_at timestamptz;

create table if not exists public.admin_close_step_events (
  id uuid primary key default gen_random_uuid(),
  step_key text not null references public.admin_close_workflow_steps(step_key) on delete cascade,
  event_action text not null,
  from_status text,
  to_status text,
  event_notes text,
  actor_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_close_step_events_step_created on public.admin_close_step_events(step_key, created_at desc);

create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id),
  event_area text not null default 'admin',
  event_action text not null,
  entity_type text,
  entity_id text,
  event_summary text,
  event_status text not null default 'recorded',
  route_hint text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists idx_admin_audit_events_occurred on public.admin_audit_events(occurred_at desc);
create index if not exists idx_admin_audit_events_entity on public.admin_audit_events(entity_type, entity_id);

create table if not exists public.admin_list_pagination_settings (
  list_key text primary key,
  list_title text not null,
  list_scope text not null default 'admin',
  default_page_size int not null default 50,
  max_page_size int not null default 200,
  current_sort_key text,
  current_sort_direction text not null default 'desc',
  supports_server_paging boolean not null default true,
  notes text,
  updated_at timestamptz not null default now()
);

insert into public.admin_list_pagination_settings (list_key, list_title, list_scope, default_page_size, max_page_size, current_sort_key, current_sort_direction, notes)
values
  ('people', 'People directory', 'people', 50, 200, 'full_name', 'asc', 'First list to wire to true server-side pagination.'),
  ('jobs', 'Jobs and operations', 'operations', 50, 200, 'updated_at', 'desc', 'Use for work orders, jobs, routes, and operations tables.'),
  ('accounting_close', 'Accounting close lists', 'accounting', 50, 200, 'period_end', 'desc', 'Use for period close, tax, payroll, reconciliation, and exports.'),
  ('health', 'Health and evidence queues', 'health', 50, 150, 'updated_at', 'desc', 'Use for health resolution, evidence, and failed upload queues.'),
  ('reports', 'Reports and rollups', 'reports', 40, 150, 'updated_at', 'desc', 'Keep reporting payloads smaller to avoid timeout regressions.')
on conflict (list_key) do update set
  list_title = excluded.list_title,
  list_scope = excluded.list_scope,
  default_page_size = excluded.default_page_size,
  max_page_size = excluded.max_page_size,
  current_sort_key = excluded.current_sort_key,
  current_sort_direction = excluded.current_sort_direction,
  notes = excluded.notes,
  updated_at = now();

create table if not exists public.bank_csv_import_sessions (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid references public.bank_accounts(id),
  file_name text,
  import_status text not null default 'draft',
  total_row_count int not null default 0,
  accepted_row_count int not null default 0,
  rejected_row_count int not null default 0,
  duplicate_row_count int not null default 0,
  preview_notes text,
  import_notes text,
  created_by_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_bank_csv_import_sessions_status on public.bank_csv_import_sessions(import_status, updated_at desc);

create table if not exists public.bank_csv_import_rows (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.bank_csv_import_sessions(id) on delete cascade,
  row_number int not null,
  transaction_date date,
  description text,
  amount numeric(14,2),
  row_hash text,
  duplicate_status text not null default 'unchecked',
  import_status text not null default 'preview',
  matched_reconciliation_item_id uuid references public.bank_reconciliation_items(id),
  reject_reason text,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_bank_csv_import_rows_session_row on public.bank_csv_import_rows(session_id, row_number);
create index if not exists idx_bank_csv_import_rows_hash on public.bank_csv_import_rows(row_hash);

create table if not exists public.admin_backup_restore_rehearsals (
  id uuid primary key default gen_random_uuid(),
  rehearsal_key text,
  rehearsal_name text not null,
  rehearsal_scope text not null default 'database',
  rehearsal_status text not null default 'planned',
  operator_profile_id uuid references public.profiles(id),
  rehearsal_at timestamptz,
  source_backup_label text,
  restore_target_label text,
  result_summary text,
  next_action text,
  evidence_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.admin_backup_restore_rehearsals add column if not exists rehearsal_key text;
create unique index if not exists idx_admin_backup_restore_rehearsal_key on public.admin_backup_restore_rehearsals(rehearsal_key);
create index if not exists idx_admin_backup_restore_status on public.admin_backup_restore_rehearsals(rehearsal_status, updated_at desc);

insert into public.admin_backup_restore_rehearsals (rehearsal_key, rehearsal_name, rehearsal_scope, rehearsal_status, result_summary, next_action)
values
  ('supabase_restore_first', 'First Supabase backup restore rehearsal', 'database', 'planned', 'No restore rehearsal recorded yet.', 'Export a small backup, restore it to a non-production project, and record the result.'),
  ('edge_function_rollback_first', 'Edge Function rollback rehearsal', 'functions', 'planned', 'No rollback rehearsal recorded yet.', 'Keep prior function bundle and document rollback command before production sign-off.')
on conflict (rehearsal_key) do update set
  rehearsal_name = excluded.rehearsal_name,
  rehearsal_scope = excluded.rehearsal_scope,
  rehearsal_status = excluded.rehearsal_status,
  result_summary = excluded.result_summary,
  next_action = excluded.next_action,
  updated_at = now();

create table if not exists public.admin_evidence_action_queue (
  id uuid primary key default gen_random_uuid(),
  source_area text not null default 'evidence',
  source_id text,
  evidence_title text,
  action_type text not null default 'follow_up',
  action_status text not null default 'queued',
  assigned_to_profile_id uuid references public.profiles(id),
  created_by_profile_id uuid references public.profiles(id),
  action_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_admin_evidence_action_status on public.admin_evidence_action_queue(action_status, updated_at desc);

create table if not exists public.admin_mobile_action_cards (
  card_key text primary key,
  role_key text not null,
  card_title text not null,
  card_detail text,
  route_hint text,
  priority_rank int not null default 50,
  card_status text not null default 'review',
  offline_ready boolean not null default false,
  sort_order int not null default 100,
  updated_at timestamptz not null default now()
);

insert into public.admin_mobile_action_cards (card_key, role_key, card_title, card_detail, route_hint, priority_rank, card_status, offline_ready, sort_order)
values
  ('worker_clock', 'employee', 'Clock in / out', 'Mobile worker entry for shift start, breaks, and sign-out.', 'timeclock', 10, 'review', true, 10),
  ('worker_forms', 'employee', 'Assigned forms', 'Show required HSE forms, SDS prompts, training acknowledgements, and offline outbox status.', 'toolbox', 20, 'review', true, 20),
  ('worker_help', 'employee', 'Help contact', 'Fast call/message route for blocked workers and upload failures.', 'support', 30, 'review', false, 30),
  ('supervisor_daily', 'supervisor', 'Daily crew dashboard', 'Active crews, late/no-show risk, evidence review, incidents, and payroll exceptions.', 'admin', 10, 'review', false, 40),
  ('supervisor_evidence', 'supervisor', 'Evidence review', 'Supervisor queue for photos, signatures, failed uploads, and closeout proof.', 'admin', 20, 'review', false, 50)
on conflict (card_key) do update set
  role_key = excluded.role_key,
  card_title = excluded.card_title,
  card_detail = excluded.card_detail,
  route_hint = excluded.route_hint,
  priority_rank = excluded.priority_rank,
  card_status = excluded.card_status,
  offline_ready = excluded.offline_ready,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.admin_production_readiness_checks (check_key, check_area, check_title, check_detail, check_status, next_action, sort_order)
values
  ('server_pagination_foundation', 'Performance', 'Server-side pagination settings exist', 'Admin lists now have DB-backed defaults for page size, sort, and payload limits.', 'review', 'Wire each table UI to send list_key, page, page_size, sort, and search to admin-directory.', 110),
  ('close_step_write_actions', 'Accounting', 'Guided close step write actions exist', 'Close steps can be completed or reopened and event history is logged.', 'review', 'Add owner/due-date editing and blocker drill-down per step.', 120),
  ('audit_event_log', 'Audit', 'Admin audit event log exists', 'Admin actions can be written to a central audit table and viewed in the readiness panel.', 'review', 'Expand every write action to call audit insert consistently.', 130),
  ('bank_csv_import_foundation', 'Accounting', 'Bank CSV import staging exists', 'Bank statement CSV uploads can be staged with duplicate/reject/accept counts before reconciliation posting.', 'review', 'Build the upload and preview screen next.', 140),
  ('evidence_retry_queue', 'Evidence', 'Evidence retry/replace/archive queue exists', 'Failed uploads and proof issues can now be queued for retry, replacement, archive, or follow-up.', 'review', 'Wire retry/replace/archive to the actual upload providers.', 150),
  ('mobile_action_cards', 'Mobile', 'Worker and supervisor mobile cards exist', 'Mobile dashboard cards are tracked for clocking, assigned forms, help contact, and supervisor daily view.', 'review', 'Build the worker mobile dashboard screen and offline outbox UI.', 160),
  ('backup_restore_rehearsal_log', 'Recovery', 'Backup/restore rehearsal log exists', 'Restore rehearsals can be tracked with operator, result, evidence, and next action.', 'review', 'Complete one real restore rehearsal before production sign-off.', 170)
on conflict (check_key) do update set
  check_area = excluded.check_area,
  check_title = excluded.check_title,
  check_detail = excluded.check_detail,
  check_status = excluded.check_status,
  next_action = excluded.next_action,
  sort_order = excluded.sort_order,
  updated_at = now();

update public.admin_deployment_gate_checks
set command_hint = replace(coalesce(command_hint, ''), 'schema 108', 'schema 109'),
    failure_hint = replace(coalesce(failure_hint, ''), 'schema 108', 'schema 109'),
    updated_at = now()
where check_key = 'schema_marker';

insert into public.admin_deployment_gate_checks (check_key, check_area, check_title, check_status, command_hint, failure_hint, sort_order)
values
  ('schema_109_marker', 'Database', 'Schema 109 marker applied', 'review', 'Apply sql/109_pagination_close_wizard_audit_backup_mobile_foundations.sql and verify Admin Health shows schema 109.', 'Admin UI can load schema 109 panels only after this migration is applied.', 45)
on conflict (check_key) do update set
  check_area = excluded.check_area,
  check_title = excluded.check_title,
  command_hint = excluded.command_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  updated_at = now();

drop view if exists public.v_admin_close_wizard_steps;
create view public.v_admin_close_wizard_steps as
select
  s.step_key,
  s.step_group,
  s.step_title,
  s.step_detail,
  s.source_view,
  s.source_entity,
  s.route_hint,
  s.blocker_count_column,
  s.blocker_count_override,
  coalesce(s.blocker_count_override, 0)::int as active_blocker_count,
  s.step_status,
  s.owner_profile_id,
  owner.full_name as owner_name,
  s.due_at,
  s.completion_notes,
  s.completed_by_profile_id,
  completed.full_name as completed_by_name,
  s.completed_at,
  s.sort_order,
  s.updated_at
from public.admin_close_workflow_steps s
left join public.profiles owner on owner.id = s.owner_profile_id
left join public.profiles completed on completed.id = s.completed_by_profile_id
order by s.sort_order, s.step_key;

drop view if exists public.v_admin_audit_event_directory;
create view public.v_admin_audit_event_directory as
select
  e.id,
  e.occurred_at,
  e.event_area,
  e.event_action,
  e.entity_type,
  e.entity_id,
  e.event_summary,
  e.event_status,
  e.route_hint,
  p.full_name as actor_name,
  p.email as actor_email
from public.admin_audit_events e
left join public.profiles p on p.id = e.actor_profile_id
order by e.occurred_at desc;

drop view if exists public.v_admin_list_pagination_settings;
create view public.v_admin_list_pagination_settings as
select * from public.admin_list_pagination_settings order by list_scope, list_key;

drop view if exists public.v_bank_csv_import_session_directory;
create view public.v_bank_csv_import_session_directory as
select
  s.id,
  s.file_name,
  s.import_status,
  s.total_row_count,
  s.accepted_row_count,
  s.rejected_row_count,
  s.duplicate_row_count,
  s.preview_notes,
  s.import_notes,
  s.created_at,
  s.updated_at,
  ba.account_name as bank_account_name,
  p.full_name as created_by_name
from public.bank_csv_import_sessions s
left join public.bank_accounts ba on ba.id = s.bank_account_id
left join public.profiles p on p.id = s.created_by_profile_id
order by s.updated_at desc;

drop view if exists public.v_admin_backup_restore_rehearsal_directory;
create view public.v_admin_backup_restore_rehearsal_directory as
select
  r.id,
  r.rehearsal_key,
  r.rehearsal_name,
  r.rehearsal_scope,
  r.rehearsal_status,
  r.rehearsal_at,
  r.source_backup_label,
  r.restore_target_label,
  r.result_summary,
  r.next_action,
  r.evidence_url,
  r.created_at,
  r.updated_at,
  p.full_name as operator_name
from public.admin_backup_restore_rehearsals r
left join public.profiles p on p.id = r.operator_profile_id
order by case r.rehearsal_status when 'failed' then 1 when 'planned' then 2 when 'running' then 3 when 'passed' then 9 else 5 end, r.updated_at desc;

drop view if exists public.v_admin_evidence_action_queue;
create view public.v_admin_evidence_action_queue as
select
  q.id,
  q.source_area,
  q.source_id,
  q.evidence_title,
  q.action_type,
  q.action_status,
  assigned.full_name as assigned_to_name,
  created.full_name as created_by_name,
  q.action_notes,
  q.created_at,
  q.updated_at
from public.admin_evidence_action_queue q
left join public.profiles assigned on assigned.id = q.assigned_to_profile_id
left join public.profiles created on created.id = q.created_by_profile_id
order by case q.action_status when 'queued' then 1 when 'assigned' then 2 when 'blocked' then 3 when 'completed' then 9 else 5 end, q.updated_at desc;

drop view if exists public.v_admin_mobile_action_card_directory;
create view public.v_admin_mobile_action_card_directory as
select * from public.admin_mobile_action_cards order by role_key, sort_order, card_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  109::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 109 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 109
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 109.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (
  109,
  '109_pagination_close_wizard_audit_backup_mobile_foundations',
  '109_pagination_close_wizard_audit_backup_mobile_foundations.sql',
  '2026-05-15c',
  'Adds server pagination settings, close step write history, admin audit events, bank CSV staging, evidence action queue, mobile action cards, and backup rehearsal tracking.',
  'applied',
  'Production-readiness pass that advances the next 20 roadmap items into DB-backed foundations.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.v_admin_close_wizard_steps to authenticated;
grant select on public.v_admin_audit_event_directory to authenticated;
grant select on public.v_admin_list_pagination_settings to authenticated;
grant select on public.v_bank_csv_import_session_directory to authenticated;
grant select on public.v_admin_backup_restore_rehearsal_directory to authenticated;
grant select on public.v_admin_evidence_action_queue to authenticated;
grant select on public.v_admin_mobile_action_card_directory to authenticated;
grant select on public.admin_close_step_events to authenticated;
grant select on public.admin_audit_events to authenticated;
grant select on public.admin_list_pagination_settings to authenticated;
grant select on public.bank_csv_import_sessions to authenticated;
grant select on public.bank_csv_import_rows to authenticated;
grant select on public.admin_backup_restore_rehearsals to authenticated;
grant select on public.admin_evidence_action_queue to authenticated;
grant select on public.admin_mobile_action_cards to authenticated;
