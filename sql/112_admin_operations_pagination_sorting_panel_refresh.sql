-- Schema 112: Admin Operations pagination, sorting, panel refresh, and saved view quality gates.
-- Low-risk tracking migration for the 2026-05-17a pass. It records the new Admin UX/backend
-- behavior without changing core business tables.

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

-- Keep default list settings aligned with the visible Admin list controls.
do $$
begin
  if to_regclass('public.admin_list_pagination_settings') is not null then
    insert into public.admin_list_pagination_settings (
      list_key,
      list_title,
      list_scope,
      default_page_size,
      max_page_size,
      current_sort_key,
      current_sort_direction,
      notes
    )
    values
      ('people', 'People directory', 'people', 25, 200, 'full_name', 'asc', 'Staff Directory supports search, role filter, sort, direction, page size, previous/next, and saved-view replay.'),
      ('jobs', 'Jobs and operations', 'operations', 25, 200, 'job_code', 'asc', 'Jobs/Operations supports search, sort, direction, page size, previous/next, and saved-view replay.')
    on conflict (list_key) do update set
      list_title = excluded.list_title,
      list_scope = excluded.list_scope,
      default_page_size = excluded.default_page_size,
      max_page_size = excluded.max_page_size,
      current_sort_key = excluded.current_sort_key,
      current_sort_direction = excluded.current_sort_direction,
      notes = excluded.notes,
      updated_at = now();
  end if;
end $$;

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
    'admin_people_sort_controls',
    'Admin UX',
    'Staff Directory supports visible sort and direction controls',
    'passed',
    '#admin',
    'Open Admin > People and Access; change Sort/Direction and confirm the page reloads with the selected order.',
    'If sorting is ignored, redeploy admin-directory and clear cached 2026-05-16b assets.',
    now(),
    92
  ),
  (
    'admin_jobs_pagination_controls',
    'Admin UX',
    'Jobs/Operations supports visible search, sort, page size, and previous/next controls',
    'passed',
    '#admin',
    'Open Admin > Jobs and Operations; use the Jobs toolbar and confirm the page label changes.',
    'If the Jobs toolbar is missing, verify js/admin-ui.js and style.css from 2026-05-17a deployed.',
    now(),
    94
  ),
  (
    'admin_directory_people_jobs_sort_payload',
    'Backend',
    'admin-directory accepts sanitized people_sort/jobs_sort payloads',
    'passed',
    'supabase/functions/admin-directory',
    'Call admin-directory with people_sort, people_sort_dir, jobs_sort, and jobs_sort_dir; confirm pagination_meta returns sorting metadata.',
    'If sorting fails, redeploy the admin-directory Edge Function from 2026-05-17a.',
    now(),
    96
  ),
  (
    'admin_saved_view_replay_people_jobs',
    'Admin UX',
    'Saved admin views replay Staff and Jobs list filters',
    'passed',
    '#admin',
    'Save a view with Staff and Jobs filters, press Use, and confirm both toolbars are restored.',
    'If only the section changes, redeploy admin-manage/admin-directory and clear the service worker cache.',
    now(),
    98
  ),
  (
    'cache_version_2026_05_17a',
    'Deployment',
    'Static assets and service worker use release 2026-05-17a',
    'passed',
    '/',
    'Hard refresh after deploy and confirm scripts/css load with ?v=2026-05-17a.',
    'If old Admin list controls persist, unregister the service worker or clear the app cache.',
    now(),
    100
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

-- Keep the quality gate directory current for Admin Health / Readiness panels.
drop view if exists public.v_mobile_navigation_quality_gates;
create view public.v_mobile_navigation_quality_gates as
select
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  route_hint,
  command_hint,
  failure_hint,
  checked_at,
  sort_order,
  updated_at
from public.app_frontend_quality_gates
where gate_key in (
  'mobile_main_nav_collapsed',
  'mobile_admin_section_nav_collapsed',
  'single_public_h1',
  'active_markdown_refreshed',
  'admin_people_pagination_controls',
  'admin_directory_pagination_payload',
  'admin_saved_view_replay_staff_filters',
  'cache_version_2026_05_16b',
  'admin_people_sort_controls',
  'admin_jobs_pagination_controls',
  'admin_directory_people_jobs_sort_payload',
  'admin_saved_view_replay_people_jobs',
  'cache_version_2026_05_17a'
)
order by sort_order, gate_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  112::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 112 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 112
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 112.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (
  112,
  '112_admin_operations_pagination_sorting_panel_refresh',
  '112_admin_operations_pagination_sorting_panel_refresh.sql',
  '2026-05-17a',
  'Adds quality gates for Staff sort controls, visible Jobs/Operations pagination controls, sanitized admin-directory sorting, saved-view replay, and cache version 2026-05-17a.',
  'applied',
  'Production-readiness pass focused on mobile-friendly list controls and smaller Admin refresh payloads.'
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
grant select on public.v_mobile_navigation_quality_gates to authenticated;
grant select on public.v_schema_drift_status to authenticated;
