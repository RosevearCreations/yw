-- Schema 115: Admin panel retry, timing visibility, and command-center fast path.
-- Low-risk tracking migration for the 2026-05-18b pass.
-- Keeps the expected_schema_version column name stable to avoid PostgreSQL 42P16 view rename errors.

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

create table if not exists public.admin_panel_refresh_preferences (
  panel_key text primary key,
  panel_title text not null,
  edge_scope text not null,
  preferred_timeout_ms integer not null default 12000,
  last_refresh_status text not null default 'ready',
  last_refresh_at timestamptz,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_panel_load_diagnostics (
  id uuid primary key default gen_random_uuid(),
  panel_key text not null,
  edge_scope text not null,
  load_status text not null default 'observed',
  elapsed_ms integer,
  stale_age_seconds integer,
  diagnostic_message text,
  captured_by_profile_id uuid,
  captured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_admin_panel_load_diagnostics_scope_time
  on public.admin_panel_load_diagnostics(edge_scope, captured_at desc);

insert into public.admin_panel_refresh_preferences (
  panel_key,
  panel_title,
  edge_scope,
  preferred_timeout_ms,
  last_refresh_status,
  notes
)
values
  (
    'admin_command_center_fast_path',
    'Admin Command Center Fast Path',
    'command_center',
    16000,
    'ready',
    'Dedicated lightweight first-stage scope for Command Center cards, task inbox preview, and schema drift summary.'
  ),
  (
    'admin_health_retry_button',
    'Admin Health Retry Button',
    'health',
    16000,
    'ready',
    'Visible retry button lets operators reload Health and Schema without reloading the full Admin manager.'
  ),
  (
    'admin_accounting_retry_button',
    'Admin Accounting Retry Button',
    'accounting',
    16000,
    'ready',
    'Visible retry button lets operators reload Guided Close Center and accounting blocker panels independently.'
  ),
  (
    'admin_scope_timing_cards',
    'Admin Scope Timing Cards',
    'health',
    16000,
    'ready',
    'Frontend displays per-scope load timing, last loaded time, and retry status in the Health panel.'
  )
on conflict (panel_key) do update set
  panel_title = excluded.panel_title,
  edge_scope = excluded.edge_scope,
  preferred_timeout_ms = excluded.preferred_timeout_ms,
  last_refresh_status = excluded.last_refresh_status,
  notes = excluded.notes,
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
  (
    'admin_command_center_dedicated_scope',
    'Admin Performance',
    'Command Center has a dedicated fast path before heavier panels load',
    'passed',
    '#admin',
    'Open DevTools on Admin and confirm the first staged request can use scope=command_center before health, people, operations, and accounting.',
    'Redeploy admin-directory if scope=command_center returns the same large payload as health/all.',
    now(),
    390
  ),
  (
    'admin_visible_health_retry_button',
    'Admin UX',
    'Health panel has a visible retry button',
    'passed',
    '#admin',
    'Open App Health and Schema Center and use Retry Health without refreshing the full browser page.',
    'Clear service worker cache if the button does not appear after deployment.',
    now(),
    400
  ),
  (
    'admin_visible_accounting_retry_button',
    'Admin UX',
    'Guided Close Center has a visible Accounting retry button',
    'passed',
    '#admin',
    'Open Guided Close Center and use Retry Accounting without reloading Staff Directory or Jobs.',
    'Redeploy admin-directory/admin-ui assets if the button still triggers the full all-scope load.',
    now(),
    410
  ),
  (
    'admin_panel_scope_timing_cards',
    'Admin Diagnostics',
    'Admin Health shows per-panel live-load timing cards',
    'passed',
    '#admin',
    'Open App Health and confirm Command Center, Health, People, Operations, and Accounting status cards show timing and last-loaded age.',
    'Check js/admin-ui.js renderAdminScopeStatus if timing cards do not render.',
    now(),
    420
  ),
  (
    'report_subscription_delivery_run_bundle_ready',
    'Edge Functions',
    'Report subscription delivery function bundles with escaped newline strings',
    'passed',
    'supabase/functions/report-subscription-delivery-run/index.ts',
    'Deploy the Edge Function and confirm there is no unterminated regexp/string literal bundle error.',
    'Replace literal multi-line string joins with escaped newline strings if bundling fails again.',
    now(),
    430
  )
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

create or replace view public.v_admin_panel_load_diagnostics as
select
  id,
  panel_key,
  edge_scope,
  load_status,
  elapsed_ms,
  stale_age_seconds,
  diagnostic_message,
  captured_by_profile_id,
  captured_at,
  metadata
from public.admin_panel_load_diagnostics
order by captured_at desc;

create or replace view public.v_admin_panel_refresh_preferences as
select
  panel_key,
  panel_title,
  edge_scope,
  preferred_timeout_ms,
  last_refresh_status,
  last_refresh_at,
  notes,
  updated_at
from public.admin_panel_refresh_preferences
order by panel_key;

create or replace view public.v_schema_drift_status as
select
  115::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 115
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 115
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 115.'
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
  115,
  '115_admin_panel_retry_timing_and_command_scope',
  '115_admin_panel_retry_timing_and_command_scope.sql',
  '2026-05-18b',
  'Tracks visible Admin panel retry buttons, per-scope load timing cards, command_center fast path, and report-delivery bundle readiness.',
  'applied',
  'Production-readiness pass focused on making Admin staged loading visible, retryable, and easier to diagnose on mobile.'
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
grant select on public.admin_panel_refresh_preferences to authenticated;
grant select on public.admin_panel_load_diagnostics to authenticated;
grant select on public.v_admin_panel_load_diagnostics to authenticated;
grant select on public.v_admin_panel_refresh_preferences to authenticated;
grant select on public.v_schema_drift_status to authenticated;
