-- Schema 114: Staged Admin load and cache fallback guardrails.
-- Low-risk tracking migration for the 2026-05-18a pass.
-- Documents the Admin load change from one large `scope: all` request to smaller staged panel requests.

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
    'admin_initial_health_stage',
    'Admin Initial Load - Health Stage',
    'health',
    16000,
    'ready',
    'Initial Admin load starts with the light health scope so the Command Center can render before heavier panels.'
  ),
  (
    'admin_initial_people_stage',
    'Admin Initial Load - People Stage',
    'people',
    16000,
    'ready',
    'Initial Admin load uses the people scope for Staff Directory pagination instead of one large all-scope payload.'
  ),
  (
    'admin_initial_operations_stage',
    'Admin Initial Load - Operations Stage',
    'operations',
    25000,
    'ready',
    'Initial Admin load uses the operations scope for Jobs/Operations and gives it a slightly longer timeout.'
  ),
  (
    'admin_initial_accounting_stage',
    'Admin Initial Load - Accounting Stage',
    'accounting',
    16000,
    'ready',
    'Initial Admin load uses the accounting scope for close-center data instead of blocking the whole Admin page.'
  ),
  (
    'admin_initial_all_fallback',
    'Admin Initial Load - All Scope Emergency Fallback',
    'all',
    90000,
    'ready',
    'The old all-scope request remains only as a fallback when every staged panel request fails.'
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
    'admin_initial_load_staged_scopes',
    'Admin UX',
    'Admin initial load uses staged Edge scopes',
    'passed',
    '#admin',
    'Open Admin and confirm it loads without immediately falling back to cached data. Network calls should show health, people, operations, and accounting scopes before any all-scope fallback.',
    'Redeploy admin-directory and clear the service worker if Admin still starts with only scope=all.',
    now(),
    350
  ),
  (
    'admin_cached_data_warning_specific',
    'Admin Resilience',
    'Cached Admin fallback remains available but is not the first normal path',
    'passed',
    '#admin',
    'Temporarily block one staged scope and confirm Admin shows partial live data with a panel retry warning instead of blanking the whole screen.',
    'Check js/admin-ui.js loadDirectory stagedWarnings handling if the whole Admin screen falls back too quickly.',
    now(),
    360
  ),
  (
    'admin_operations_timeout_guardrail',
    'Admin Performance',
    'Operations scope has a bounded 25s timeout during initial Admin load',
    'passed',
    '#admin',
    'Confirm Jobs/Operations can be retried separately with Refresh Jobs Only if the initial operations panel is slow.',
    'Use the operations fast path and pagination controls before increasing the timeout further.',
    now(),
    370
  ),
  (
    'admin_all_scope_emergency_fallback_only',
    'Admin Performance',
    'All-scope Admin load is kept as emergency fallback only',
    'passed',
    '#admin',
    'Confirm the all-scope request is not the first request during normal Admin page load.',
    'If all-scope fires first, clear cached 2026-05-17b assets and verify 2026-05-18a scripts are deployed.',
    now(),
    380
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
  114::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 114
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 114
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 114.'
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
  114,
  '114_staged_admin_load_and_cache_fallback_guardrails',
  '114_staged_admin_load_and_cache_fallback_guardrails.sql',
  '2026-05-18a',
  'Tracks staged Admin initial load, smaller panel scopes, bounded timeouts, and cache fallback guardrails.',
  'applied',
  'Production-readiness pass focused on stopping Admin from starting with one heavy all-scope request and falling back to stale cached data too quickly.'
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
grant select on public.v_admin_panel_refresh_preferences to authenticated;
grant select on public.v_schema_drift_status to authenticated;
