-- Schema 120: Ontario OHSA wording and mobile-first app guardrails.
-- Tracks the 2026-05-26a pass that removed user-facing U.S. safety wording
-- and promoted mobile-first field use for Ontario workplace safety workflows.

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

create table if not exists public.app_mobile_first_quality_gates (
  gate_key text primary key,
  gate_area text not null default 'Mobile UX',
  gate_title text not null,
  gate_status text not null default 'review',
  route_hint text,
  test_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_jurisdiction_wording_gates (
  gate_key text primary key,
  jurisdiction text not null default 'Ontario',
  gate_title text not null,
  preferred_terms text not null default 'Ontario OHSA; Ontario workplace safety; safety operations',
  avoid_terms text not null default 'U.S. safety terminology when describing Ontario workplace procedures',
  gate_status text not null default 'review',
  route_hint text,
  operator_hint text,
  sort_order integer not null default 100,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_mobile_first_quality_gates (
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  route_hint,
  test_hint,
  failure_hint,
  sort_order,
  checked_at
)
values
  (
    'mobile_quick_nav_core_routes',
    'Mobile UX',
    'Mobile quick-action bar exposes the five most-used field routes',
    'passed',
    '#toolbox #incident #hseops #jobs #admin',
    'Open a phone-width viewport and confirm Talk, Incident, Safety, Jobs, and Admin remain visible at the bottom.',
    'Check index.html mobileQuickNav, js/mobile-menu.js syncQuickNav, and style.css mobile-quick-nav rules.',
    120,
    now()
  ),
  (
    'mobile_admin_action_spacing',
    'Mobile UX',
    'Admin and form actions stack as phone-friendly buttons',
    'passed',
    '#admin',
    'Confirm Admin retry/action buttons are one-column and easy to tap on phone width.',
    'Review .admin-heading-actions and .form-footer mobile CSS if actions overflow.',
    130,
    now()
  ),
  (
    'mobile_content_one_h1',
    'SEO / Mobile',
    'Public app shell keeps one main H1 for clearer mobile title signals',
    'passed',
    '/',
    'Run the smoke check and confirm H1_COUNT remains 1.',
    'Remove extra public H1 tags or convert section headings to H2/H3.',
    140,
    now()
  )
on conflict (gate_key) do update set
  gate_area = excluded.gate_area,
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  route_hint = excluded.route_hint,
  test_hint = excluded.test_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_jurisdiction_wording_gates (
  gate_key,
  jurisdiction,
  gate_title,
  preferred_terms,
  avoid_terms,
  gate_status,
  route_hint,
  operator_hint,
  sort_order,
  checked_at
)
values
  (
    'ontario_ohsa_not_us_osha',
    'Ontario',
    'Use Ontario OHSA / workplace safety language instead of U.S. safety wording',
    'Ontario OHSA; Ontario workplace safety; safety operations; HSE where used as internal shorthand',
    'U.S. safety terminology for Ontario workplace procedures',
    'passed',
    '#hseops #admin #reports',
    'Historical migration filenames may remain unchanged, but user-facing text should use Ontario terms.',
    110,
    now()
  ),
  (
    'mobile_first_field_app_copy',
    'Ontario',
    'App copy emphasizes phone-first field use',
    'mobile-first; phone; field workflow; quick action',
    'desktop-only workflow assumptions',
    'passed',
    '#toolbox #incident #hseops',
    'Keep new field workflows usable on phone before adding desktop-only tables.',
    120,
    now()
  )
on conflict (gate_key) do update set
  jurisdiction = excluded.jurisdiction,
  gate_title = excluded.gate_title,
  preferred_terms = excluded.preferred_terms,
  avoid_terms = excluded.avoid_terms,
  gate_status = excluded.gate_status,
  route_hint = excluded.route_hint,
  operator_hint = excluded.operator_hint,
  sort_order = excluded.sort_order,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_app_mobile_first_quality_gates;
create view public.v_app_mobile_first_quality_gates as
select
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  route_hint,
  test_hint,
  failure_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_mobile_first_quality_gates
order by sort_order, gate_key;

drop view if exists public.v_app_jurisdiction_wording_gates;
create view public.v_app_jurisdiction_wording_gates as
select
  gate_key,
  jurisdiction,
  gate_title,
  preferred_terms,
  avoid_terms,
  gate_status,
  route_hint,
  operator_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_jurisdiction_wording_gates
order by sort_order, gate_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  120::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 120
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 120
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 120.'
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
  120,
  '120_ontario_ohsa_mobile_first_app_guardrails',
  '120_ontario_ohsa_mobile_first_app_guardrails.sql',
  '2026-05-26a',
  'Adds Ontario OHSA wording gates and mobile-first app quality gates for phone-heavy field usage.',
  'applied',
  'Mobile-first pass focused on Ontario workplace safety terminology, bottom quick navigation, PWA copy, and phone-friendly field workflows.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_mobile_first_quality_gates to authenticated;
grant select on public.app_jurisdiction_wording_gates to authenticated;
grant select on public.v_app_mobile_first_quality_gates to authenticated;
grant select on public.v_app_jurisdiction_wording_gates to authenticated;
grant select on public.v_schema_drift_status to authenticated;
