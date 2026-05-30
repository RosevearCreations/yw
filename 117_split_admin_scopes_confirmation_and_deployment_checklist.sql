-- Schema 117: Split Admin fast paths, evidence scope, confirmation guardrails, and deployment checklist notes.
-- Low-risk tracking migration for the 2026-05-19b pass.
-- Keeps v_schema_drift_status column name as expected_schema_version to avoid PostgreSQL 42P16 view rename errors.

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists release_label text;

create table if not exists public.app_frontend_quality_gates (
  gate_key text primary key,
  gate_area text not null default 'Frontend',
  gate_title text not null,
  gate_status text not null default 'review',
  route_hint text,
  command_hint text,
  failure_hint text,
  checked_at timestamptz,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_fast_path_scope_registry (
  scope_key text primary key,
  scope_title text not null,
  panel_key text not null,
  preferred_timeout_ms integer not null default 16000,
  is_initial_load_scope boolean not null default false,
  is_deprecated boolean not null default false,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_action_confirmation_rules (
  rule_key text primary key,
  action_area text not null,
  action_key text not null,
  confirmation_level text not null default 'confirm',
  prompt_text text not null,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_deployment_checklist_items (
  checklist_key text primary key,
  checklist_area text not null,
  checklist_title text not null,
  check_status text not null default 'review',
  command_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.admin_fast_path_scope_registry (
  scope_key,
  scope_title,
  panel_key,
  preferred_timeout_ms,
  is_initial_load_scope,
  is_deprecated,
  notes
)
values
  ('command_center', 'Command Center', 'admin_command_center', 16000, true, false, 'Lightweight command-center counters, task inbox, and schema drift rows.'),
  ('health', 'Health and Schema', 'admin_health_schema', 16000, true, false, 'Health, schema, readiness, diagnostics, and deployment gate rows.'),
  ('people', 'People and Access', 'admin_staff_directory', 16000, true, false, 'Paged Staff Directory and assignment access rows.'),
  ('operations', 'Jobs and Operations', 'admin_jobs_operations', 25000, true, false, 'Paged Jobs, service areas, routes, clients, and operations dashboard rows.'),
  ('accounting_close', 'Accounting Close', 'admin_accounting_close', 18000, true, false, 'Close center, close wizard steps, close dashboard, and accountant package rows.'),
  ('banking', 'Banking and Reconciliation', 'admin_banking_reconciliation', 18000, true, false, 'Bank reconciliation sessions, review queue, match candidates, scored matches, and bank CSV import status.'),
  ('tax_payroll', 'Tax and Payroll', 'admin_tax_payroll', 18000, true, false, 'Sales tax, payroll remittance, and AR/AP payment application review rows.'),
  ('evidence', 'Evidence Manager', 'admin_evidence_manager', 18000, true, false, 'Evidence manager, action queue, attendance/HSE evidence review, and HSE action rows.'),
  ('accounting', 'Accounting Fallback', 'admin_accounting_fallback', 30000, false, true, 'Temporary broad accounting fallback retained while split accounting scopes are production-tested.'),
  ('all', 'All Fallback', 'admin_all_fallback', 90000, false, true, 'Emergency broad fallback only; should be retired after split panel scopes are trusted.')
on conflict (scope_key) do update set
  scope_title = excluded.scope_title,
  panel_key = excluded.panel_key,
  preferred_timeout_ms = excluded.preferred_timeout_ms,
  is_initial_load_scope = excluded.is_initial_load_scope,
  is_deprecated = excluded.is_deprecated,
  notes = excluded.notes,
  updated_at = now();

insert into public.admin_action_confirmation_rules (
  rule_key,
  action_area,
  action_key,
  confirmation_level,
  prompt_text,
  notes
)
values
  ('job_complete_confirm', 'jobs', 'complete', 'confirm', 'Confirm before marking a job complete.', 'Protects job status changes from accidental phone taps.'),
  ('job_cancel_confirm', 'jobs', 'cancel', 'confirm', 'Confirm before cancelling a job.', 'Protects job status changes from accidental phone taps.'),
  ('close_step_complete_confirm', 'accounting_close', 'complete', 'confirm', 'Confirm before completing a close step.', 'Close workflow actions affect accounting review status.'),
  ('close_step_reopen_confirm', 'accounting_close', 'reopen', 'confirm', 'Confirm before reopening a close step.', 'Reopen actions should be deliberate and visible.'),
  ('health_resolve_confirm', 'health', 'resolve', 'confirm', 'Confirm before marking a health item resolved.', 'Resolution rows should only be marked after review.'),
  ('evidence_followup_confirm', 'evidence', 'follow_up', 'confirm', 'Confirm before creating an evidence follow-up.', 'Evidence follow-ups create action queue rows.')
on conflict (rule_key) do update set
  action_area = excluded.action_area,
  action_key = excluded.action_key,
  confirmation_level = excluded.confirmation_level,
  prompt_text = excluded.prompt_text,
  notes = excluded.notes,
  updated_at = now();

insert into public.admin_deployment_checklist_items (
  checklist_key,
  checklist_area,
  checklist_title,
  check_status,
  command_hint,
  failure_hint,
  sort_order,
  checked_at
)
values
  ('apply_schema_117', 'Database', 'Apply migrations through schema 117', 'review', 'Run sql/117_split_admin_scopes_confirmation_and_deployment_checklist.sql in Supabase SQL editor.', 'Admin split scopes can return empty results if schema 117 has not been applied.', 510, now()),
  ('redeploy_admin_directory_117', 'Edge Functions', 'Redeploy admin-directory after split-scope changes', 'review', 'Deploy supabase/functions/admin-directory.', 'New accounting/evidence fast paths will not exist until the function is redeployed.', 520, now()),
  ('redeploy_admin_manage_117', 'Edge Functions', 'Redeploy admin-manage after confirmation/diagnostic updates', 'review', 'Deploy supabase/functions/admin-manage.', 'Panel diagnostics and admin action writes may fail if the older function remains deployed.', 530, now()),
  ('hard_refresh_2026_05_19b', 'Browser Cache', 'Clear service worker cache for 2026-05-19b assets', 'review', 'Hard refresh or unregister service worker after deployment.', 'Old admin-ui.js can keep the old broad accounting scope alive.', 540, now())
on conflict (checklist_key) do update set
  checklist_area = excluded.checklist_area,
  checklist_title = excluded.checklist_title,
  check_status = excluded.check_status,
  command_hint = excluded.command_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_frontend_quality_gates (
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  route_hint,
  command_hint,
  failure_hint,
  checked_at,
  sort_order
)
values
  ('admin_split_accounting_scopes', 'Admin Performance', 'Admin initial load uses split accounting fast paths', 'passed', '#admin', 'Open Admin and confirm Accounting Close, Banking, and Tax/Payroll status cards load separately.', 'Redeploy admin-directory and clear cache if Accounting still loads as one broad scope.', now(), 470),
  ('admin_evidence_fast_path', 'Admin Performance', 'Evidence Manager has a dedicated fast path and retry button', 'passed', '#admin', 'Open Evidence Manager and press Retry Evidence.', 'Redeploy admin-directory if Retry Evidence returns unsupported scope.', now(), 480),
  ('admin_action_confirmation_dialogs', 'Mobile UX', 'Destructive/status-changing Admin actions ask for confirmation', 'passed', '#admin', 'Tap Complete/Cancel job, close-step actions, health resolve, or evidence follow-up and confirm a dialog appears.', 'Check js/admin-ui.js confirmAdminAction wiring if actions fire immediately.', now(), 490),
  ('admin_loading_skeletons', 'Mobile UX', 'Admin shows lightweight skeleton loaders during staged panel loads', 'passed', '#admin', 'Reload Admin on a slow connection and confirm panel placeholders appear before live data.', 'Check style.css is-admin-loading skeleton rules if the page looks frozen.', now(), 500)
on conflict (gate_key) do update set
  gate_area = excluded.gate_area,
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  route_hint = excluded.route_hint,
  command_hint = excluded.command_hint,
  failure_hint = excluded.failure_hint,
  checked_at = excluded.checked_at,
  sort_order = excluded.sort_order,
  updated_at = now();

drop view if exists public.v_admin_fast_path_scope_registry;
create view public.v_admin_fast_path_scope_registry as
select
  scope_key,
  scope_title,
  panel_key,
  preferred_timeout_ms,
  is_initial_load_scope,
  is_deprecated,
  notes,
  updated_at
from public.admin_fast_path_scope_registry
order by is_deprecated asc, is_initial_load_scope desc, scope_key;

drop view if exists public.v_admin_action_confirmation_rules;
create view public.v_admin_action_confirmation_rules as
select
  rule_key,
  action_area,
  action_key,
  confirmation_level,
  prompt_text,
  notes,
  updated_at
from public.admin_action_confirmation_rules
order by action_area, action_key;

drop view if exists public.v_admin_deployment_checklist;
create view public.v_admin_deployment_checklist as
select
  checklist_key,
  checklist_area,
  checklist_title,
  check_status,
  command_hint,
  failure_hint,
  sort_order,
  checked_at,
  updated_at
from public.admin_deployment_checklist_items
order by sort_order, checklist_area, checklist_title;

create or replace view public.v_schema_drift_status as
select
  117::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 117
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 117
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 117.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version,
  migration_key,
  schema_name,
  release_label,
  description,
  status,
  notes
)
values (
  117,
  '117_split_admin_scopes_confirmation_and_deployment_checklist',
  '117_split_admin_scopes_confirmation_and_deployment_checklist.sql',
  '2026-05-19b',
  'Splits Admin accounting/evidence fast paths, tracks confirmation guardrails, and adds deployment checklist rows.',
  'applied',
  'Production-readiness pass focused on smaller Admin payloads, safer mobile status-changing actions, and clearer deployment readiness checks.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_frontend_quality_gates to authenticated;
grant select on public.admin_fast_path_scope_registry to authenticated;
grant select on public.admin_action_confirmation_rules to authenticated;
grant select on public.admin_deployment_checklist_items to authenticated;
grant select on public.v_admin_fast_path_scope_registry to authenticated;
grant select on public.v_admin_action_confirmation_rules to authenticated;
grant select on public.v_admin_deployment_checklist to authenticated;
grant select on public.v_schema_drift_status to authenticated;
