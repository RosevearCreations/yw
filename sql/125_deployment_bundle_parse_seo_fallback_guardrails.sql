-- Schema 125: Deployment bundle parse, SEO, and fallback guardrails.
-- Adds database-visible checklists for Edge Function bundle readiness, public SEO/local wording,
-- and runtime fallback behaviour. This pass was triggered by a Supabase Edge Function deploy
-- failure caused by an unterminated regular-expression literal in jobs-manage.

begin;

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

create table if not exists public.app_deployment_bundle_checks (
  check_key text primary key,
  check_area text not null,
  check_title text not null,
  expected_status text not null default 'required',
  current_status text not null default 'pending',
  function_name text,
  file_path text,
  route_hint text,
  test_command text,
  failure_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_public_seo_checks (
  check_key text primary key,
  check_area text not null default 'seo',
  check_title text not null,
  route_hint text,
  expected_status text not null default 'required',
  current_status text not null default 'pending',
  local_wording_hint text,
  test_command text,
  failure_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_runtime_fallback_checks (
  check_key text primary key,
  check_area text not null default 'fallback',
  check_title text not null,
  expected_status text not null default 'required',
  current_status text not null default 'pending',
  surface_hint text,
  fallback_hint text,
  test_command text,
  failure_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_deployment_bundle_checks (
  check_key,
  check_area,
  check_title,
  expected_status,
  current_status,
  function_name,
  file_path,
  route_hint,
  test_command,
  failure_hint,
  sort_order,
  metadata,
  checked_at
)
values
  ('edge_ts_parse_all_functions', 'edge-functions', 'All Supabase Edge Function index.ts files parse before deploy', 'required', 'passed', null, 'supabase/functions/*/index.ts', 'Supabase Edge Functions', 'node scripts/repo-smoke-check.mjs', 'Do not deploy until TypeScript parser diagnostics are zero.', 10, '{"schema_pass":"125","source":"repo-smoke-check"}'::jsonb, now()),
  ('jobs_manage_regex_escape_guard', 'edge-functions', 'jobs-manage accessory JSON fallback uses an escaped newline regexp', 'required', 'passed', 'jobs-manage', 'supabase/functions/jobs-manage/index.ts', 'Jobs / Equipment', 'grep -n "split(/\\\\[" supabase/functions/jobs-manage/index.ts', 'A literal newline inside a regexp breaks Supabase bundling.', 20, '{"fixed_error":"Unterminated regexp literal at normalizeJsonArray"}'::jsonb, now()),
  ('jobs_directory_attachment_dedup_guard', 'edge-functions', 'jobs-directory returns each comment attachment once', 'required', 'passed', 'jobs-directory', 'supabase/functions/jobs-directory/index.ts', 'Jobs / Comments', 'node scripts/repo-smoke-check.mjs', 'Duplicate push calls create repeated attachment rows in Admin/Jobs views.', 30, '{"fixed_error":"duplicate attachment push removed"}'::jsonb, now()),
  ('service_worker_install_fallback_guard', 'frontend', 'Service worker install tolerates one stale/missing static asset', 'required', 'passed', null, 'server-worker.js', 'PWA shell', 'node --check app.js && node scripts/repo-smoke-check.mjs', 'cache.addAll-only installs can fail the whole worker if one file is stale.', 40, '{"fallback":"cache each app shell asset independently"}'::jsonb, now()),
  ('schema_marker_125_current', 'schema', 'Canonical schema and drift view expect schema 125', 'required', 'passed', null, 'sql/000_full_schema_reference.sql', 'Schema Drift', 'node scripts/repo-smoke-check.mjs', 'A stale schema marker makes deploy/debugging harder after SQL changes.', 50, '{"expected_schema_version":125}'::jsonb, now())
on conflict (check_key) do update set
  check_area = excluded.check_area,
  check_title = excluded.check_title,
  expected_status = excluded.expected_status,
  current_status = excluded.current_status,
  function_name = excluded.function_name,
  file_path = excluded.file_path,
  route_hint = excluded.route_hint,
  test_command = excluded.test_command,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_public_seo_checks (
  check_key,
  check_title,
  route_hint,
  expected_status,
  current_status,
  local_wording_hint,
  test_command,
  failure_hint,
  sort_order,
  metadata,
  checked_at
)
values
  ('public_one_h1_index', 'Public shell keeps no more than one H1', '/ /#today', 'required', 'passed', 'Use one clear page-level heading and supporting H2/H3 sections.', 'node scripts/repo-smoke-check.mjs', 'Duplicate H1s weaken page-title clarity and accessibility.', 10, '{"file":"index.html"}'::jsonb, now()),
  ('public_title_meta_prominent_words', 'Title and meta description keep plain searchable local wording', '/ /#today', 'required', 'passed', 'Keep service, safety, Ontario, job/equipment, and local terms in visible headings/body copy where accurate.', 'manual content review plus smoke check', 'Avoid vague headings and repeated title-like text blocks.', 20, '{"source":"roadmap"}'::jsonb, now()),
  ('local_service_wording_truthful', 'Local wording only claims real service coverage', 'public routes', 'required', 'review', 'Mention locations only when the business truly serves them or has real proof.', 'content review before publish', 'Do not add thin city pages or unsupported location claims.', 30, '{"local_ranking":"relevance_distance_prominence"}'::jsonb, now()),
  ('public_static_asset_cache_version', 'Public assets use the current cache marker', 'index.html / server-worker.js', 'required', 'passed', 'Update cache marker on every build pass so stale CSS/JS does not hide fixes.', 'node scripts/repo-smoke-check.mjs', 'Old service worker assets can keep repaired code from loading.', 40, '{"cache_marker":"2026-06-01a"}'::jsonb, now())
on conflict (check_key) do update set
  check_title = excluded.check_title,
  route_hint = excluded.route_hint,
  expected_status = excluded.expected_status,
  current_status = excluded.current_status,
  local_wording_hint = excluded.local_wording_hint,
  test_command = excluded.test_command,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_runtime_fallback_checks (
  check_key,
  check_title,
  expected_status,
  current_status,
  surface_hint,
  fallback_hint,
  test_command,
  failure_hint,
  sort_order,
  metadata,
  checked_at
)
values
  ('jobs_directory_optional_views_safe_select', 'Jobs directory optional schema views fail soft to empty arrays', 'required', 'passed', 'jobs-directory', 'Use safeSelect for newer optional views so older databases do not crash the whole page.', 'review jobs-directory safeSelect usage', 'A missing view should show an empty table and visible gap, not a 500.', 10, '{"function":"jobs-directory"}'::jsonb, now()),
  ('jobs_manage_optional_service_tasks_fail_soft', 'Equipment service-task inserts fail soft if schema 124 is not deployed yet', 'required', 'passed', 'jobs-manage equipment return/arrival', 'Keep checkout/return alive while the service-task table is still being migrated.', 'review insertEquipmentServiceTask catch block', 'Field equipment workflows should not fail only because optional follow-up task schema is missing.', 20, '{"function":"jobs-manage"}'::jsonb, now()),
  ('pwa_shell_individual_asset_cache', 'PWA shell caches assets one by one with install fallback', 'required', 'passed', 'server-worker.js', 'A single stale asset should not prevent a repaired service worker from installing.', 'node scripts/repo-smoke-check.mjs', 'cache.addAll can block the whole install when one cache entry is stale.', 30, '{"file":"server-worker.js"}'::jsonb, now()),
  ('smoke_script_edge_parse_check', 'Smoke script parses Edge Functions before packaging', 'required', 'passed', 'scripts/repo-smoke-check.mjs', 'Use TypeScript parser diagnostics to catch deploy bundle syntax problems locally.', 'node scripts/repo-smoke-check.mjs', 'Supabase deploy should not be the first place syntax errors are found.', 40, '{"tool":"typescript.transpileModule"}'::jsonb, now())
on conflict (check_key) do update set
  check_title = excluded.check_title,
  expected_status = excluded.expected_status,
  current_status = excluded.current_status,
  surface_hint = excluded.surface_hint,
  fallback_hint = excluded.fallback_hint,
  test_command = excluded.test_command,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_app_deployment_bundle_checks;
create view public.v_app_deployment_bundle_checks as
select
  check_key,
  check_area,
  check_title,
  expected_status,
  current_status,
  function_name,
  file_path,
  route_hint,
  test_command,
  failure_hint,
  sort_order,
  metadata,
  checked_at,
  updated_at
from public.app_deployment_bundle_checks
order by sort_order, check_key;

drop view if exists public.v_app_public_seo_checks;
create view public.v_app_public_seo_checks as
select
  check_key,
  check_area,
  check_title,
  route_hint,
  expected_status,
  current_status,
  local_wording_hint,
  test_command,
  failure_hint,
  sort_order,
  metadata,
  checked_at,
  updated_at
from public.app_public_seo_checks
order by sort_order, check_key;

drop view if exists public.v_app_runtime_fallback_checks;
create view public.v_app_runtime_fallback_checks as
select
  check_key,
  check_area,
  check_title,
  expected_status,
  current_status,
  surface_hint,
  fallback_hint,
  test_command,
  failure_hint,
  sort_order,
  metadata,
  checked_at,
  updated_at
from public.app_runtime_fallback_checks
order by sort_order, check_key;

create table if not exists public.app_operational_depth_gates (
  gate_key text primary key,
  gate_area text not null,
  gate_title text not null,
  gate_status text not null default 'review',
  owner_hint text,
  route_hint text,
  test_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_operational_depth_gates (
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  owner_hint,
  route_hint,
  test_hint,
  failure_hint,
  sort_order,
  checked_at
)
values
  ('edge_function_parse_before_deploy', 'deployment', 'Edge Function TypeScript parse check runs before deploy', 'passed', 'Admin / Developer', 'Supabase Functions', 'Run node scripts/repo-smoke-check.mjs before deploying Edge Functions.', 'Do not deploy functions with TypeScript parser diagnostics.', 67, now()),
  ('jobs_manage_regex_repair_verified', 'deployment', 'jobs-manage regexp newline repair verified', 'passed', 'Admin / Developer', '#equipment', 'Confirm normalizeJsonArray uses split(/[\\n,]/), not a literal newline inside the regexp.', 'Literal newline regex failure blocks Supabase bundling.', 68, now()),
  ('public_seo_local_guardrails_visible', 'seo', 'Public SEO/local wording guardrails are visible in database checks', 'passed', 'Admin / Content', '#admin', 'Review v_app_public_seo_checks before publishing new public route copy.', 'Unsupported local wording or duplicate H1s should block publish.', 69, now()),
  ('runtime_fallback_guardrails_visible', 'fallback', 'Runtime fallback guardrails are visible in database checks', 'passed', 'Admin / Developer', '#admin', 'Review v_app_runtime_fallback_checks after schema or service-worker changes.', 'Missing optional views/assets should not take down whole screens.', 70, now())
on conflict (gate_key) do update set
  gate_area = excluded.gate_area,
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  owner_hint = excluded.owner_hint,
  route_hint = excluded.route_hint,
  test_hint = excluded.test_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  125::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 125
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 125
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 125.'
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
  125,
  '125_deployment_bundle_parse_seo_fallback_guardrails',
  '125_deployment_bundle_parse_seo_fallback_guardrails.sql',
  '2026-06-01a',
  'Adds deployment bundle parse checks, public SEO/local wording checks, and runtime fallback checks after the jobs-manage Edge Function bundle failure.',
  'applied',
  'This pass repairs jobs-manage bundling, adds TypeScript parse checks to smoke testing, improves service-worker install fallback, and exposes deployment/SEO/fallback guardrails in database views.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_deployment_bundle_checks to authenticated;
grant select on public.app_public_seo_checks to authenticated;
grant select on public.app_runtime_fallback_checks to authenticated;
grant select on public.v_app_deployment_bundle_checks to authenticated;
grant select on public.v_app_public_seo_checks to authenticated;
grant select on public.v_app_runtime_fallback_checks to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
