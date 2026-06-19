-- Schema 121: Mobile Today dashboard, PWA install helper, and offline queue badges.
-- Tracks the 2026-05-27a pass that makes the app more usable as a phone-first
-- Ontario OHSA field workflow instead of a desktop-first admin shell.

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

create table if not exists public.mobile_today_action_registry (
  action_key text primary key,
  action_title text not null,
  action_detail text not null,
  route_hint text not null,
  required_role text not null default 'employee',
  action_status text not null default 'active',
  priority_rank integer not null default 100,
  mobile_hint text,
  offline_hint text,
  updated_at timestamptz not null default now()
);

create table if not exists public.mobile_pwa_install_quality_gates (
  gate_key text primary key,
  gate_title text not null,
  gate_status text not null default 'review',
  platform_hint text,
  test_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.mobile_today_action_registry (
  action_key,
  action_title,
  action_detail,
  route_hint,
  required_role,
  action_status,
  priority_rank,
  mobile_hint,
  offline_hint
)
values
  (
    'today_dashboard_core',
    'Today mobile dashboard',
    'Shows the next phone-first actions for the signed-in role before the long route list.',
    '#today',
    'employee',
    'active',
    10,
    'Keep this as the first mobile route and PWA start URL.',
    'The shell loads offline; live data still requires sync.'
  ),
  (
    'toolbox_quick_action',
    'Toolbox Talk quick action',
    'One-tap route to daily talk capture and signoff.',
    '#toolbox',
    'employee',
    'active',
    20,
    'Large tap target in quick nav and Today cards.',
    'Queued submissions show in the quick-nav badge.'
  ),
  (
    'incident_quick_action',
    'Incident / Near Miss quick action',
    'One-tap route for urgent event capture from a phone.',
    '#incident',
    'employee',
    'active',
    30,
    'Keep visible in bottom quick nav.',
    'Use local queue if connection drops before sync.'
  ),
  (
    'jobs_quick_action',
    'Jobs mobile action',
    'Field users can jump directly into jobs and operations records.',
    '#jobs',
    'employee',
    'active',
    40,
    'Today card explains job status use before desktop tables.',
    'Offline shell opens; updates need live connection.'
  ),
  (
    'ontario_safety_ops',
    'Ontario Safety Ops quick action',
    'Keeps Ontario OHSA-aware safety workflows visible for field users.',
    '#hseops',
    'employee',
    'active',
    50,
    'Use Ontario OHSA / workplace safety wording in visible copy.',
    'Offline shell opens; queue actions when possible.'
  ),
  (
    'admin_retry_action',
    'Admin retry/status action',
    'Admins can see staged load state and queued action count from the mobile quick nav.',
    '#admin',
    'admin',
    'active',
    90,
    'Badge shows queued admin/action outbox items.',
    'Retries should respect panel cooldown/backoff policies.'
  )
on conflict (action_key) do update set
  action_title = excluded.action_title,
  action_detail = excluded.action_detail,
  route_hint = excluded.route_hint,
  required_role = excluded.required_role,
  action_status = excluded.action_status,
  priority_rank = excluded.priority_rank,
  mobile_hint = excluded.mobile_hint,
  offline_hint = excluded.offline_hint,
  updated_at = now();

insert into public.mobile_pwa_install_quality_gates (
  gate_key,
  gate_title,
  gate_status,
  platform_hint,
  test_hint,
  failure_hint,
  sort_order,
  checked_at
)
values
  (
    'pwa_start_route_today',
    'PWA starts on the Today dashboard',
    'passed',
    'Android, iOS, desktop browser install',
    'Open manifest.json and confirm start_url is /#today.',
    'Update manifest.json start_url if the installed app opens an older form route.',
    10,
    now()
  ),
  (
    'quick_nav_badges',
    'Mobile quick nav shows offline queue badges',
    'passed',
    'Phone browser and installed PWA',
    'Queue a draft/offline action and confirm Today/Talk/Admin badges update.',
    'Check js/outbox.js notifyQueueChanged and js/mobile-menu.js syncBadges.',
    20,
    now()
  ),
  (
    'install_helper_card',
    'Today screen includes install guidance',
    'passed',
    'Chrome Android, Safari iOS',
    'Open #today on a phone-width viewport and confirm install guidance is visible when not already installed.',
    'Check js/mobile-today.js renderInstallCard and mobile-install-card CSS.',
    30,
    now()
  ),
  (
    'six_button_mobile_quick_nav',
    'Six primary mobile routes fit without turning into a long list',
    'passed',
    'Small phone width',
    'Confirm Today, Talk, Incident, Safety, Jobs, and Admin remain in one bottom bar.',
    'Check .mobile-quick-nav mobile CSS if labels wrap badly.',
    40,
    now()
  )
on conflict (gate_key) do update set
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  platform_hint = excluded.platform_hint,
  test_hint = excluded.test_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  checked_at = excluded.checked_at,
  updated_at = now();

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
    'mobile_today_dashboard_role_aware',
    'Mobile UX',
    'Today dashboard shows role-aware field actions',
    'passed',
    '#today',
    'Sign in as employee/supervisor/admin and confirm Today cards adjust to the role.',
    'Check js/mobile-today.js visibleCards and js/security.js section rules.',
    150,
    now()
  ),
  (
    'mobile_quick_nav_queue_badges',
    'Mobile UX',
    'Bottom quick nav displays queued form/action badges',
    'passed',
    '#today #toolbox #admin',
    'Queue a failed submission or action and confirm the badge updates without reload.',
    'Check js/outbox.js notifyQueueChanged and js/mobile-menu.js syncBadges.',
    160,
    now()
  ),
  (
    'mobile_pwa_install_helper',
    'Mobile UX',
    'Today route includes a PWA install helper',
    'passed',
    '#today',
    'Open the app in a non-installed mobile browser and confirm the helper explains Android/iOS install paths.',
    'Check mobileInstallCard in index.html and js/mobile-today.js.',
    170,
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

drop view if exists public.v_mobile_today_action_registry;
create view public.v_mobile_today_action_registry as
select
  action_key,
  action_title,
  action_detail,
  route_hint,
  required_role,
  action_status,
  priority_rank,
  mobile_hint,
  offline_hint,
  updated_at
from public.mobile_today_action_registry
order by priority_rank, action_key;

drop view if exists public.v_mobile_pwa_install_quality_gates;
create view public.v_mobile_pwa_install_quality_gates as
select
  gate_key,
  gate_title,
  gate_status,
  platform_hint,
  test_hint,
  failure_hint,
  sort_order,
  checked_at,
  updated_at
from public.mobile_pwa_install_quality_gates
order by sort_order, gate_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  121::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 121
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 121
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 121.'
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
  121,
  '121_mobile_today_dashboard_pwa_and_offline_badges',
  '121_mobile_today_dashboard_pwa_and_offline_badges.sql',
  '2026-05-27a',
  'Adds a mobile Today dashboard registry, PWA install quality gates, and quick-nav offline badge tracking.',
  'applied',
  'Mobile-first pass focused on role-aware Today cards, quick-action badges, install guidance, and Ontario OHSA field workflow usability.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.mobile_today_action_registry to authenticated;
grant select on public.mobile_pwa_install_quality_gates to authenticated;
grant select on public.v_mobile_today_action_registry to authenticated;
grant select on public.v_mobile_pwa_install_quality_gates to authenticated;
grant select on public.v_app_mobile_first_quality_gates to authenticated;
grant select on public.v_schema_drift_status to authenticated;
