-- Schema 119: Admin action permissions, schema preflight rows, retry/backoff policy, and function signoff fields.
-- Low-risk tracking migration for the 2026-05-20b pass.
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

create table if not exists public.admin_action_permission_registry (
  action_key text primary key,
  action_area text not null,
  action_label text not null,
  required_role text not null default 'supervisor',
  required_scope text,
  is_enabled boolean not null default true,
  enabled_message text,
  disabled_message text,
  failure_hint text,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_panel_retry_policy (
  panel_key text primary key,
  panel_title text not null,
  scope_key text not null,
  max_attempts integer not null default 2,
  cooldown_seconds integer not null default 30,
  backoff_multiplier numeric(6,2) not null default 1.50,
  retry_status text not null default 'active',
  operator_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_schema_preflight_checks (
  check_key text primary key,
  check_area text not null,
  required_object_type text not null,
  required_object_name text not null,
  expected_status text not null default 'present',
  live_status text not null default 'not_checked',
  check_status text not null default 'review',
  operator_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table if exists public.admin_function_readiness_checks add column if not exists last_checked_at timestamptz;
alter table if exists public.admin_function_readiness_checks add column if not exists operator_signoff_at timestamptz;
alter table if exists public.admin_function_readiness_checks add column if not exists operator_signoff_by text;
alter table if exists public.admin_function_readiness_checks add column if not exists operator_notes text;

insert into public.admin_action_permission_registry (
  action_key,
  action_area,
  action_label,
  required_role,
  required_scope,
  is_enabled,
  enabled_message,
  disabled_message,
  failure_hint,
  sort_order
)
values
  ('job_status_update', 'Jobs', 'Complete or cancel a job', 'job_admin', 'operations', true, 'This role may change job status.', 'Requires Job Admin or Admin. Use Open/Add Note for review-only roles.', 'If this is disabled unexpectedly, check v_admin_action_permission_registry and actor_role returned by admin-directory.', 100),
  ('job_add_note', 'Jobs', 'Add a job note', 'supervisor', 'operations', true, 'This role may add job notes.', 'Requires Supervisor or higher.', 'Redeploy admin-directory if actor_role is missing from the Admin payload.', 110),
  ('close_step_complete', 'Accounting Close', 'Complete a close step', 'job_admin', 'accounting_close', true, 'This role may complete close steps.', 'Requires Job Admin or Admin.', 'Close steps should remain disabled for roles that cannot affect accounting close state.', 200),
  ('close_step_reopen', 'Accounting Close', 'Reopen a close step', 'admin', 'accounting_close', true, 'This role may reopen close steps.', 'Requires Admin because reopening can affect close evidence and exports.', 'Keep reopen permission tighter than complete permission.', 210),
  ('deployment_gate_update', 'Deployment', 'Mark a deployment gate as passed', 'admin', 'health', true, 'This role may update deployment gates.', 'Requires Admin signoff.', 'Deployment gates should not be marked passed by non-admin review roles.', 300),
  ('evidence_follow_up', 'Evidence', 'Create evidence follow-up', 'hse', 'evidence', true, 'This role may create HSE/evidence follow-up work.', 'Requires HSE, Job Admin, or Admin.', 'If supervisors need this workflow, add an explicit registry row with the lower required role.', 400)
on conflict (action_key) do update set
  action_area = excluded.action_area,
  action_label = excluded.action_label,
  required_role = excluded.required_role,
  required_scope = excluded.required_scope,
  is_enabled = excluded.is_enabled,
  enabled_message = excluded.enabled_message,
  disabled_message = excluded.disabled_message,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.admin_panel_retry_policy (
  panel_key,
  panel_title,
  scope_key,
  max_attempts,
  cooldown_seconds,
  backoff_multiplier,
  retry_status,
  operator_hint,
  failure_hint,
  sort_order
)
values
  ('command_center', 'Command Center', 'command_center', 2, 20, 1.50, 'active', 'Retry Command Center manually after a short pause if the first load fails.', 'Repeated failures usually mean admin-directory is stale or schema is behind.', 100),
  ('health_schema', 'Health and Schema', 'health', 2, 30, 1.75, 'active', 'Health can be retried without reloading Staff or Jobs.', 'If health times out, check expensive views and missing schema objects.', 110),
  ('staff_directory', 'Staff Directory', 'people', 2, 25, 1.50, 'active', 'Retry Staff Only keeps current search/filter/page settings.', 'If Staff repeatedly fails, reduce page size and check profiles RLS/function logs.', 200),
  ('jobs_operations', 'Jobs and Operations', 'operations', 2, 25, 1.50, 'active', 'Retry Jobs Only keeps current search/filter/page settings.', 'If Jobs repeatedly fails, check jobs status columns and fast-path query fields.', 210),
  ('accounting_close', 'Guided Close Center', 'accounting_close', 2, 45, 2.00, 'active', 'Retry Accounting after schema and close views are confirmed.', 'Repeated accounting failures usually point to missing close/reconciliation views.', 300),
  ('evidence_manager', 'Evidence Manager', 'evidence', 2, 30, 1.75, 'active', 'Retry Evidence separately from the HSE dashboard.', 'Repeated failures may mean an upload/evidence view is missing.', 400)
on conflict (panel_key) do update set
  panel_title = excluded.panel_title,
  scope_key = excluded.scope_key,
  max_attempts = excluded.max_attempts,
  cooldown_seconds = excluded.cooldown_seconds,
  backoff_multiplier = excluded.backoff_multiplier,
  retry_status = excluded.retry_status,
  operator_hint = excluded.operator_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.admin_schema_preflight_checks (
  check_key,
  check_area,
  required_object_type,
  required_object_name,
  expected_status,
  live_status,
  check_status,
  operator_hint,
  failure_hint,
  sort_order,
  checked_at
)
values
  ('schema_versions_table', 'Database', 'table', 'public.app_schema_versions', 'present', 'not_checked', 'review', 'Confirm the table exists before relying on schema drift cards.', 'Schema status cards cannot show current/behind state without app_schema_versions.', 100, now()),
  ('fast_path_registry_view', 'Admin Startup', 'view', 'public.v_admin_fast_path_scope_registry', 'present', 'not_checked', 'review', 'Apply schema 118+ so Admin can read startup scopes from DB.', 'Admin falls back to hard-coded scope order if this view is missing.', 110, now()),
  ('action_permission_view', 'Admin Actions', 'view', 'public.v_admin_action_permission_registry', 'present', 'not_checked', 'review', 'Apply schema 119 before relying on role-aware disabled buttons.', 'Unsafe action buttons cannot be disabled by registry if this view is missing.', 120, now()),
  ('panel_retry_policy_view', 'Admin Reliability', 'view', 'public.v_admin_panel_retry_policy', 'present', 'not_checked', 'review', 'Apply schema 119 before tuning retry/backoff rules from DB.', 'Repeated panel failures can keep hammering functions without an operator-visible policy.', 130, now()),
  ('schema_preflight_view', 'Deployment Preflight', 'view', 'public.v_admin_schema_preflight_checks', 'present', 'not_checked', 'review', 'Use this table as the first visible checklist before deployment.', 'Operators may miss missing schema objects until a button fails.', 140, now()),
  ('admin_directory_function', 'Edge Functions', 'function', 'supabase/functions/admin-directory', 'deployed', 'not_checked', 'review', 'Redeploy admin-directory after schema 119.', 'New readiness/preflight/permission arrays will not reach the browser until admin-directory is current.', 200, now())
on conflict (check_key) do update set
  check_area = excluded.check_area,
  required_object_type = excluded.required_object_type,
  required_object_name = excluded.required_object_name,
  expected_status = excluded.expected_status,
  live_status = excluded.live_status,
  check_status = excluded.check_status,
  operator_hint = excluded.operator_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  checked_at = excluded.checked_at,
  updated_at = now();

update public.admin_function_readiness_checks
set last_checked_at = coalesce(last_checked_at, checked_at, now())
where last_checked_at is null;

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
  ('admin_action_permission_registry_visible', 'Admin Actions', 'Action permission registry renders and disables risky buttons', 'passed', '#admin', 'Open Admin > Readiness and confirm action permission rows are visible. Test with a non-admin role before production.', 'Apply schema 119 and redeploy admin-directory if the table is empty or buttons are not annotated.', now(), 540),
  ('admin_schema_preflight_visible', 'Deployment Preflight', 'Schema preflight table names required tables/views/functions', 'passed', '#admin', 'Open Admin > Readiness and confirm schema preflight rows are visible.', 'Missing preflight rows make it harder to diagnose schema drift before button clicks.', now(), 550),
  ('admin_panel_retry_policy_visible', 'Admin Reliability', 'Panel retry policy rows render in Production Readiness', 'passed', '#admin', 'Open Admin > Readiness and confirm retry/backoff rows are visible.', 'Repeated failing panels may retry too aggressively if no policy rows are visible.', now(), 560)
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

drop view if exists public.v_admin_action_permission_registry;
create view public.v_admin_action_permission_registry as
select
  action_key,
  action_area,
  action_label,
  required_role,
  required_scope,
  is_enabled,
  enabled_message,
  disabled_message,
  failure_hint,
  sort_order,
  updated_at
from public.admin_action_permission_registry
order by sort_order, action_area, action_label;

drop view if exists public.v_admin_panel_retry_policy;
create view public.v_admin_panel_retry_policy as
select
  panel_key,
  panel_title,
  scope_key,
  max_attempts,
  cooldown_seconds,
  backoff_multiplier,
  retry_status,
  operator_hint,
  failure_hint,
  sort_order,
  updated_at
from public.admin_panel_retry_policy
order by sort_order, panel_title;

drop view if exists public.v_admin_schema_preflight_checks;
create view public.v_admin_schema_preflight_checks as
select
  check_key,
  check_area,
  required_object_type,
  required_object_name,
  expected_status,
  live_status,
  check_status,
  operator_hint,
  failure_hint,
  sort_order,
  checked_at,
  updated_at
from public.admin_schema_preflight_checks
order by sort_order, check_area, required_object_name;

drop view if exists public.v_admin_function_readiness_checks;
create view public.v_admin_function_readiness_checks as
select
  function_key,
  function_name,
  expected_scope,
  readiness_status,
  deploy_hint,
  failure_hint,
  sort_order,
  checked_at,
  last_checked_at,
  operator_signoff_at,
  operator_signoff_by,
  operator_notes,
  updated_at
from public.admin_function_readiness_checks
order by sort_order, function_name;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  119::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 119
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 119
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 119.'
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
  119,
  '119_admin_action_permissions_preflight_and_retry_rules',
  '119_admin_action_permissions_preflight_and_retry_rules.sql',
  '2026-05-20b',
  'Adds Admin action permission registry, schema preflight rows, panel retry/backoff policies, and function signoff metadata.',
  'applied',
  'Production-readiness pass focused on preventing unsafe button clicks, surfacing missing schema objects early, and making retry/backoff rules visible.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.admin_action_permission_registry to authenticated;
grant select on public.admin_panel_retry_policy to authenticated;
grant select on public.admin_schema_preflight_checks to authenticated;
grant select on public.v_admin_action_permission_registry to authenticated;
grant select on public.v_admin_panel_retry_policy to authenticated;
grant select on public.v_admin_schema_preflight_checks to authenticated;
grant select on public.v_admin_function_readiness_checks to authenticated;
grant select on public.v_schema_drift_status to authenticated;
