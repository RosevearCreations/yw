-- Schema 116: Admin diagnostics drawer, persisted panel failures, and stale-data badges.
-- Low-risk tracking migration for the 2026-05-19a pass.
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

create index if not exists idx_admin_panel_load_diagnostics_status_time
  on public.admin_panel_load_diagnostics(load_status, captured_at desc);

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
    'admin_diagnostics_drawer',
    'Admin Diagnostics Drawer',
    'health',
    16000,
    'ready',
    'Health panel now expands staged load details, elapsed time, stale age, and persisted database diagnostics.'
  ),
  (
    'admin_stale_age_badges',
    'Admin Stale Data Age Badges',
    'health',
    16000,
    'ready',
    'Admin panel headings and Health summary show last live-load age so cached or stale panels are visible.'
  ),
  (
    'admin_persisted_panel_failures',
    'Persisted Admin Panel Load Failures',
    'health',
    16000,
    'ready',
    'Failed staged Admin panel loads can be written through admin-manage into admin_panel_load_diagnostics.'
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
    'admin_diagnostics_drawer_visible',
    'Admin Diagnostics',
    'Admin Health includes an expandable panel diagnostics drawer',
    'passed',
    '#admin',
    'Open App Health and Schema Center, then expand Panel diagnostics and live-load details.',
    'Clear service worker cache and confirm js/admin-ui.js is loading the 2026-05-19a asset version.',
    now(),
    440
  ),
  (
    'admin_panel_failure_persistence',
    'Admin Diagnostics',
    'Failed staged panel loads are persisted through admin-manage',
    'passed',
    '#admin',
    'Temporarily block a panel endpoint in dev, reload Admin, then confirm admin_panel_load_diagnostics receives a failed row.',
    'Redeploy admin-manage and apply schema 116 if failures only appear in the browser session.',
    now(),
    450
  ),
  (
    'admin_stale_data_age_badges',
    'Mobile UX',
    'Admin panels show stale-data age badges on mobile-friendly layouts',
    'passed',
    '#admin',
    'Open Admin on a phone-width viewport and confirm panel age badges wrap without horizontal scrolling.',
    'Check style.css admin-age-badge and admin-panel-age-grid rules if badges overflow.',
    now(),
    460
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

drop view if exists public.v_admin_panel_load_diagnostics;
create view public.v_admin_panel_load_diagnostics as
select
  d.id,
  d.panel_key,
  d.edge_scope,
  d.load_status,
  d.elapsed_ms,
  d.stale_age_seconds,
  d.diagnostic_message,
  d.captured_by_profile_id,
  p.full_name as captured_by_name,
  d.captured_at,
  d.metadata
from public.admin_panel_load_diagnostics d
left join public.profiles p on p.id = d.captured_by_profile_id
order by d.captured_at desc;

create or replace view public.v_schema_drift_status as
select
  116::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 116
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 116
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 116.'
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
  116,
  '116_admin_diagnostics_drawer_and_stale_data_badges',
  '116_admin_diagnostics_drawer_and_stale_data_badges.sql',
  '2026-05-19a',
  'Adds Admin diagnostics drawer tracking, persisted panel failure writes, and stale-data age badge quality gates.',
  'applied',
  'Production-readiness pass focused on making staged Admin loading diagnosable, visible, and mobile-friendly.'
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
grant select on public.v_schema_drift_status to authenticated;
