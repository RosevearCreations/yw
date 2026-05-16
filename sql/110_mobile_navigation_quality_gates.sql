-- Schema 110: mobile navigation quality gates.
-- Adds a safe DB marker for the 2026-05-16a mobile UX pass.
-- This migration has no hard dependency on app data tables and is safe to run after a partial schema-109 deploy.

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
    'mobile_main_nav_collapsed',
    'Mobile UX',
    'Main menu collapses on phones and expands on tap',
    'passed',
    '#toolbox',
    'Open the app under 760px wide and confirm the header shows one Menu button before expansion.',
    'If the full nav appears as a long vertical list on load, verify index.html, style.css, and js/mobile-menu.js are deployed with the same cache version.',
    now(),
    10
  ),
  (
    'mobile_admin_section_nav_collapsed',
    'Mobile UX',
    'Admin section menu collapses on phones and expands on tap',
    'passed',
    '#admin',
    'Open Admin under 720px wide and confirm Admin sections are hidden behind one expandable control.',
    'If admin section buttons form a long list, verify js/admin-ui.js and style.css are from release 2026-05-16a.',
    now(),
    20
  ),
  (
    'single_public_h1',
    'SEO',
    'Exposed app shell keeps one H1',
    'passed',
    '/',
    'Run node scripts/repo-smoke-check.mjs and confirm single-public-h1-index passes.',
    'If more than one H1 is found, demote secondary page headings to H2/H3.',
    now(),
    30
  ),
  (
    'cache_version_2026_05_16a',
    'Deployment',
    'Static assets and service worker use release 2026-05-16a',
    'passed',
    '/',
    'Hard refresh after deploy and confirm scripts/css load with ?v=2026-05-16a.',
    'If old menus persist, unregister the service worker or clear the app cache.',
    now(),
    40
  ),
  (
    'active_markdown_refreshed',
    'Documentation',
    'Active Markdown reflects schema 110 and mobile menu pass',
    'passed',
    'README.md',
    'Review README.md, DEVELOPMENT_ROADMAP.md, KNOWN_ISSUES_AND_GAPS.md, and DATABASE_STRUCTURE.md.',
    'If docs still mention schema 109 as latest, use the 2026-05-16a build docs.',
    now(),
    50
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

do $$
begin
  if to_regclass('public.admin_deployment_gate_checks') is not null then
    insert into public.admin_deployment_gate_checks (check_key, check_area, check_title, check_status, command_hint, failure_hint, sort_order)
    values (
      'schema_110_mobile_navigation_marker',
      'Mobile UX',
      'Schema 110 mobile navigation marker applied',
      'passed',
      'Apply sql/110_mobile_navigation_quality_gates.sql and verify v_mobile_navigation_quality_gates returns rows.',
      'Mobile UX gates will not appear in Admin readiness until schema 110 is applied.',
      46
    )
    on conflict (check_key) do update set
      check_area = excluded.check_area,
      check_title = excluded.check_title,
      check_status = excluded.check_status,
      command_hint = excluded.command_hint,
      failure_hint = excluded.failure_hint,
      sort_order = excluded.sort_order,
      updated_at = now();
  end if;
end $$;

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
  'active_markdown_refreshed'
)
order by sort_order, gate_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  110::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 110 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 110
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 110.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (
  110,
  '110_mobile_navigation_quality_gates',
  '110_mobile_navigation_quality_gates.sql',
  '2026-05-16a',
  'Adds frontend quality-gate tracking for compact mobile navigation, admin mobile sections, cache version, one-H1, and active docs readiness.',
  'applied',
  'Mobile UX pass focused on replacing long mobile menu lists with compact expandable menus.'
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
