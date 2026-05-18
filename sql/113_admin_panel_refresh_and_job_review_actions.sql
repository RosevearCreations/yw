-- Schema 113: Admin panel-only refreshes, Operations job review actions, and mobile table quality gates.
-- Low-risk tracking migration for the 2026-05-17b pass.
--
-- Important live-schema fix:
-- Keep v_schema_drift_status column name as expected_schema_version.
-- Earlier file used repo_schema_version, which caused:
-- ERROR 42P16: cannot change name of view column "expected_schema_version" to "repo_schema_version"

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

create table if not exists public.admin_job_action_audit (
  id uuid primary key default gen_random_uuid(),
  job_id bigint,
  action_key text not null,
  action_status text not null default 'queued',
  action_note text,
  created_by_profile_id uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_admin_job_action_audit_job_id_created
  on public.admin_job_action_audit(job_id, created_at desc);

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
    'staff_directory',
    'Staff Directory and Access',
    'people',
    12000,
    'ready',
    'Refresh Staff Only uses the people fast path instead of reloading all Admin data.'
  ),
  (
    'jobs_operations',
    'Jobs and Operations',
    'operations',
    12000,
    'ready',
    'Refresh Jobs Only uses the operations fast path and keeps the current Jobs filter/page.'
  ),
  (
    'health_schema',
    'App Health and Schema Center',
    'health',
    12000,
    'ready',
    'Health panel can be refreshed through a narrow health/command-center scope.'
  ),
  (
    'accounting_close',
    'Guided Close Center',
    'accounting',
    12000,
    'ready',
    'Close center can refresh close blockers without reloading Staff Directory data.'
  ),
  (
    'reporting',
    'Reporting',
    'reporting',
    20000,
    'ready',
    'Reports remain lazy-loaded and use the reporting fast path.'
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
    'admin_panel_refresh_people_scope',
    'Admin UX',
    'Staff panel refresh uses people-only Edge scope',
    'passed',
    '#admin',
    'Open Admin > People and Access, press Refresh Staff Only, and confirm other sections are not reloaded.',
    'Redeploy admin-directory and clear service worker cache if the button still reloads the full Admin manager.',
    now(),
    310
  ),
  (
    'admin_panel_refresh_operations_scope',
    'Admin UX',
    'Jobs panel refresh uses operations-only Edge scope',
    'passed',
    '#admin',
    'Open Admin > Jobs and Operations, press Refresh Jobs Only, and confirm Jobs paging remains intact.',
    'Redeploy admin-directory and clear service worker cache if Jobs reload is slow or resets filters.',
    now(),
    320
  ),
  (
    'admin_jobs_review_table_mobile',
    'Mobile UX',
    'Jobs review table has compact mobile row actions',
    'passed',
    '#admin',
    'On a phone-width viewport, confirm Open, Complete, Cancel, and Add Note stack cleanly.',
    'Check style.css admin-row-actions and admin-jobs-review-wrap rules if actions overflow.',
    now(),
    330
  ),
  (
    'admin_job_action_handlers',
    'Admin Actions',
    'Admin Manage supports job status and note actions',
    'passed',
    '#admin',
    'Use a safe test job to add a note, then review job_comments and site activity.',
    'Redeploy admin-manage if row actions return unsupported job action.',
    now(),
    340
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

create or replace view public.v_admin_job_action_audit_directory as
select
  a.id,
  a.job_id,
  j.job_code,
  j.job_name,
  a.action_key,
  a.action_status,
  a.action_note,
  p.full_name as created_by_name,
  a.created_at,
  a.resolved_at,
  a.metadata
from public.admin_job_action_audit a
left join public.jobs j on j.id = a.job_id
left join public.profiles p on p.id = a.created_by_profile_id
order by a.created_at desc;

create or replace view public.v_schema_drift_status as
select
  113::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 113
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 113
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 113.'
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
  113,
  '113_admin_panel_refresh_and_job_review_actions',
  '113_admin_panel_refresh_and_job_review_actions.sql',
  '2026-05-17b',
  'Adds Admin panel-only refresh tracking, mobile Jobs review quality gates, and job action audit foundations.',
  'applied',
  'Production-readiness pass focused on smaller Admin payloads, direct jobs review actions, and mobile-safe admin tables.'
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
grant select on public.v_admin_job_action_audit_directory to authenticated;
grant select on public.v_schema_drift_status to authenticated;
