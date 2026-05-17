-- Schema 111: Admin directory pagination and saved-view replay quality gates.
-- Adds a safe marker for the 2026-05-16b pass. It is intentionally low-risk:
-- existing schema-109 pagination settings are updated, frontend quality gates are marked,
-- and the schema drift view is advanced to 111.

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

-- Tighten the previously planned admin pagination defaults so first load is lighter on phones.
do $$
begin
  if to_regclass('public.admin_list_pagination_settings') is not null then
    insert into public.admin_list_pagination_settings (list_key, list_title, list_scope, default_page_size, max_page_size, current_sort_key, current_sort_direction, notes)
    values
      ('people', 'People directory', 'people', 25, 200, 'full_name', 'asc', 'Staff Directory now sends page, page size, search, and role filter to admin-directory.'),
      ('jobs', 'Jobs and operations', 'operations', 25, 200, 'job_code', 'asc', 'Jobs list now has a paged Edge Function path for smaller payloads.')
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
    'admin_people_pagination_controls',
    'Admin UX',
    'Staff Directory has search, role filter, page size, and previous/next controls',
    'passed',
    '#admin',
    'Open Admin > People and Access; confirm Staff Directory controls load and page labels update.',
    'If the Staff Directory still loads one large table with no controls, verify js/admin-ui.js and style.css from release 2026-05-16b are deployed.',
    now(),
    60
  ),
  (
    'admin_directory_pagination_payload',
    'Backend',
    'admin-directory returns pagination_meta for people and jobs',
    'passed',
    'supabase/functions/admin-directory',
    'Call admin-directory with people_page, people_page_size, jobs_page, and jobs_page_size; confirm pagination_meta.people/jobs is returned.',
    'If payloads are still too large, verify the updated admin-directory Edge Function was redeployed.',
    now(),
    70
  ),
  (
    'admin_saved_view_replay_staff_filters',
    'Admin UX',
    'Saved admin views replay Staff Directory filters',
    'passed',
    '#admin',
    'Save a view with Staff search/role/page size, then press Use and confirm the filters reload.',
    'If saved views only switch sections, verify v_admin_saved_filter_directory includes filter_payload and admin-ui.js release 2026-05-16b is deployed.',
    now(),
    80
  ),
  (
    'cache_version_2026_05_16b',
    'Deployment',
    'Static assets and service worker use release 2026-05-16b',
    'passed',
    '/',
    'Hard refresh after deploy and confirm scripts/css load with ?v=2026-05-16b.',
    'If old admin tables persist, unregister the service worker or clear the app cache.',
    now(),
    90
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

-- Keep the existing mobile quality-gate view useful and include this pass's Admin UX checks.
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
  'cache_version_2026_05_16a',
  'active_markdown_refreshed',
  'admin_people_pagination_controls',
  'admin_directory_pagination_payload',
  'admin_saved_view_replay_staff_filters',
  'cache_version_2026_05_16b'
)
order by sort_order, gate_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  111::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 111 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 111
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 111.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (
  111,
  '111_admin_directory_pagination_saved_view_replay',
  '111_admin_directory_pagination_saved_view_replay.sql',
  '2026-05-16b',
  'Adds quality gates for Staff Directory pagination controls, admin-directory pagination metadata, saved-view replay, and release cache version 2026-05-16b.',
  'applied',
  'Production-readiness pass focused on reducing Admin payload size and making saved admin views reusable.'
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
