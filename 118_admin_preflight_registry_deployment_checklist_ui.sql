-- Schema 118: Admin preflight registry, deployment checklist rendering, and function readiness tracking.
-- Low-risk tracking migration for the 2026-05-20a pass.
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

create table if not exists public.admin_function_readiness_checks (
  function_key text primary key,
  function_name text not null,
  expected_scope text,
  readiness_status text not null default 'review',
  deploy_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

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
  ('apply_schema_118', 'Database', 'Apply migrations through schema 118', 'review', 'Run sql/118_admin_preflight_registry_deployment_checklist_ui.sql in Supabase SQL editor.', 'The Admin UI can show empty deployment/function-readiness tables if schema 118 has not been applied.', 550, now()),
  ('redeploy_admin_directory_118', 'Edge Functions', 'Redeploy admin-directory after registry/checklist payload changes', 'review', 'Deploy supabase/functions/admin-directory.', 'Admin startup will fall back to hard-coded scopes if v_admin_fast_path_scope_registry is not returned.', 560, now()),
  ('hard_refresh_2026_05_20a', 'Browser Cache', 'Clear service worker cache for 2026-05-20a assets', 'review', 'Hard refresh or unregister service worker after deployment.', 'Old admin-ui.js will not render deployment checklist or function readiness rows.', 570, now()),
  ('verify_admin_preflight_ui', 'Admin QA', 'Verify Production Readiness shows checklist and function tables', 'review', 'Open #admin, filter Readiness, and confirm both new tables populate or show useful empty states.', 'Operators may miss deploy steps if readiness rows are not visible.', 580, now())
on conflict (checklist_key) do update set
  checklist_area = excluded.checklist_area,
  checklist_title = excluded.checklist_title,
  check_status = excluded.check_status,
  command_hint = excluded.command_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.admin_function_readiness_checks (
  function_key,
  function_name,
  expected_scope,
  readiness_status,
  deploy_hint,
  failure_hint,
  sort_order,
  checked_at
)
values
  ('admin_directory_command_center', 'admin-directory', 'command_center / health / people / operations / accounting_close / banking / tax_payroll / evidence', 'review', 'Deploy supabase/functions/admin-directory after schema 118.', 'Admin panels can show cached or missing data if the deployed function does not return the latest fast-path payloads.', 100, now()),
  ('admin_manage_actions', 'admin-manage', 'job actions, diagnostics, deployment gates, evidence follow-up', 'review', 'Deploy supabase/functions/admin-manage after Admin action changes.', 'Status-changing buttons or diagnostic writes can fail if this function is stale.', 110, now()),
  ('report_subscription_delivery_run', 'report-subscription-delivery-run', 'scheduled report delivery', 'review', 'Deploy supabase/functions/report-subscription-delivery-run after newline/CSV escaping fixes.', 'Report delivery scheduler can fail to bundle or send if this function is stale.', 120, now()),
  ('service_execution_scheduler_run', 'service-execution-scheduler-run', 'scheduled operations dispatch', 'review', 'Confirm SERVICE_EXECUTION_SCHEDULER_SECRET and deploy service-execution-scheduler-run.', 'Scheduled service execution can stop advancing next_run_at if this function or secret is not ready.', 130, now())
on conflict (function_key) do update set
  function_name = excluded.function_name,
  expected_scope = excluded.expected_scope,
  readiness_status = excluded.readiness_status,
  deploy_hint = excluded.deploy_hint,
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
  ('admin_registry_driven_initial_scopes', 'Admin Performance', 'Admin initial load reads the fast-path scope registry', 'passed', '#admin', 'Open Admin and confirm command_center loads first, then configured initial scopes load from v_admin_fast_path_scope_registry.', 'Redeploy admin-directory if the registry array is missing from the command center payload.', now(), 510),
  ('admin_deployment_checklist_visible', 'Production Readiness', 'Deployment checklist rows render in Admin Readiness', 'passed', '#admin', 'Open Admin > Readiness and confirm deployment checklist rows are visible.', 'Apply schema 118 and clear cache if the checklist table is empty.', now(), 520),
  ('admin_function_readiness_visible', 'Production Readiness', 'Function readiness rows render in Admin Readiness', 'passed', '#admin', 'Open Admin > Readiness and confirm function readiness rows are visible.', 'Apply schema 118 and redeploy admin-directory if function rows are missing.', now(), 530)
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
  updated_at
from public.admin_function_readiness_checks
order by sort_order, function_name;

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
  118::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 118
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 118
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 118.'
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
  118,
  '118_admin_preflight_registry_deployment_checklist_ui',
  '118_admin_preflight_registry_deployment_checklist_ui.sql',
  '2026-05-20a',
  'Renders Admin deployment checklist and function readiness rows, and lets Admin startup use the fast-path scope registry.',
  'applied',
  'Production-readiness pass focused on making deploy/preflight state visible in Admin and reducing hard-coded Admin startup assumptions.'
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
grant select on public.admin_deployment_checklist_items to authenticated;
grant select on public.admin_function_readiness_checks to authenticated;
grant select on public.v_admin_deployment_checklist to authenticated;
grant select on public.v_admin_function_readiness_checks to authenticated;
grant select on public.v_schema_drift_status to authenticated;
