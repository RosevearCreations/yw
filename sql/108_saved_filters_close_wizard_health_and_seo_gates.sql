-- Schema 108: saved-filter actions, close wizard steps, health resolution notes, deployment gates, and SEO smoke checks.
-- 108_saved_filters_close_wizard_health_and_seo_gates.sql

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  migration_key text,
  schema_name text,
  release_label text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.admin_saved_filters add column if not exists last_used_at timestamptz;
alter table public.admin_saved_filters add column if not exists usage_count int not null default 0;
alter table public.admin_saved_filters add column if not exists route_hint text;
alter table public.admin_saved_filters add column if not exists section_hint text;
create index if not exists idx_admin_saved_filters_scope_name on public.admin_saved_filters(filter_scope, filter_name);
create index if not exists idx_admin_saved_filters_shared_scope on public.admin_saved_filters(filter_scope, is_shared, updated_at desc);

create table if not exists public.admin_close_workflow_steps (
  step_key text primary key,
  step_group text not null,
  step_title text not null,
  step_detail text,
  source_view text,
  source_entity text,
  route_hint text,
  blocker_count_column text,
  step_status text not null default 'review',
  sort_order int not null default 100,
  updated_at timestamptz not null default now()
);

insert into public.admin_close_workflow_steps (step_key, step_group, step_title, step_detail, source_view, source_entity, route_hint, blocker_count_column, step_status, sort_order)
values
  ('period_review', 'Period Close', 'Review open accounting periods', 'Confirm each period is ready before lock/reopen actions are used.', 'v_admin_close_center_overview', 'accounting_period_close', 'admin:accounting', 'open_accounting_period_count', 'review', 10),
  ('payment_applications', 'Payments', 'Clear AR/AP payment applications', 'Review partial payments, overpayments, unapplied amounts, reversals, and voids.', 'v_admin_close_center_overview', 'ar_payment_application', 'admin:accounting', 'payment_application_attention_count', 'review', 20),
  ('bank_reconciliation', 'Banking', 'Resolve reconciliation review items', 'Clear unmatched, partial, and exception rows before close.', 'v_admin_close_center_overview', 'bank_reconciliation_item', 'admin:accounting', 'reconciliation_review_count', 'review', 30),
  ('tax_payroll', 'Tax and Payroll', 'Review filings and remittances', 'Confirm sales-tax filing and payroll remittance review screens before package export.', 'v_admin_close_center_overview', 'sales_tax_filing', 'admin:accounting', 'open_tax_filing_count', 'review', 40),
  ('journal_preview', 'Posting', 'Validate journal candidates', 'Preview generated lines, debit/credit balance, source links, approvals, and locked periods before posting.', 'v_admin_close_center_overview', 'gl_journal_batch', 'admin:accounting', 'journal_candidate_count', 'review', 50),
  ('accountant_package', 'Export', 'Finalize accountant package delivery', 'Confirm package manifest, GL detail, trial balance, AR/AP aging, tax, payroll, reconciliation, and receipts.', 'v_admin_close_center_overview', 'accountant_handoff_export', 'admin:accounting', 'package_delivery_attention_count', 'review', 60)
on conflict (step_key) do update set
  step_group = excluded.step_group,
  step_title = excluded.step_title,
  step_detail = excluded.step_detail,
  source_view = excluded.source_view,
  source_entity = excluded.source_entity,
  route_hint = excluded.route_hint,
  blocker_count_column = excluded.blocker_count_column,
  step_status = excluded.step_status,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.admin_health_resolution_notes (
  id uuid primary key default gen_random_uuid(),
  source_area text not null default 'manual',
  source_id text,
  resolution_status text not null default 'open',
  resolution_notes text,
  assigned_to_profile_id uuid references public.profiles(id),
  resolved_by_profile_id uuid references public.profiles(id),
  resolved_at timestamptz,
  created_by_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_admin_health_resolution_status on public.admin_health_resolution_notes(resolution_status, updated_at desc);

create table if not exists public.admin_deployment_gate_checks (
  check_key text primary key,
  check_area text not null,
  check_title text not null,
  check_status text not null default 'review',
  command_hint text,
  failure_hint text,
  sort_order int not null default 100,
  updated_at timestamptz not null default now()
);

insert into public.admin_deployment_gate_checks (check_key, check_area, check_title, check_status, command_hint, failure_hint, sort_order)
values
  ('node_syntax', 'Code', 'JavaScript syntax checks pass', 'review', 'node --check js/api.js && node --check js/admin-ui.js && node --check app.js', 'Fix syntax errors before deploy.', 10),
  ('repo_smoke', 'Code', 'Repo smoke check passes', 'review', 'node scripts/repo-smoke-check.mjs', 'Smoke check must pass before packaging.', 20),
  ('single_h1', 'SEO', 'Exposed app shell has no more than one H1', 'review', 'grep -oi "<h1" index.html | wc -l', 'Keep one clear public H1.', 30),
  ('schema_marker', 'Database', 'Schema marker matches latest repo migration', 'review', 'Apply SQL through schema 108 and check Admin Health.', 'Live schema behind repo can break views/functions.', 40),
  ('service_worker_version', 'Deploy', 'Service worker cache version bumped', 'review', 'Confirm CACHE_NAME and script query strings match the build.', 'Old service worker assets can keep stale bugs alive.', 50),
  ('edge_functions', 'Backend', 'Changed Supabase functions redeployed', 'review', 'Deploy admin-directory, admin-manage, and admin-selectors when changed.', 'New UI may call old Edge Function code.', 60),
  ('backup_ready', 'Recovery', 'Backup and restore rehearsal is scheduled', 'review', 'Export schema/data sample and test restore before production sign-off.', 'No restore proof means recovery remains untested.', 70)
on conflict (check_key) do update set
  check_area = excluded.check_area,
  check_title = excluded.check_title,
  check_status = excluded.check_status,
  command_hint = excluded.command_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.admin_public_seo_checks (
  page_path text primary key,
  page_title text,
  h1_count int not null default 0,
  local_terms_present boolean not null default false,
  meta_description_present boolean not null default false,
  image_alt_coverage_percent numeric(6,2),
  broken_asset_count int not null default 0,
  check_status text not null default 'review',
  notes text,
  checked_at timestamptz not null default now()
);

insert into public.admin_public_seo_checks (page_path, page_title, h1_count, local_terms_present, meta_description_present, image_alt_coverage_percent, broken_asset_count, check_status, notes)
values
  ('/', 'YWI HSE App', 1, true, true, 100, 0, 'review', 'Current app shell has one H1. Re-run when public marketing pages are added.')
on conflict (page_path) do update set
  page_title = excluded.page_title,
  h1_count = excluded.h1_count,
  local_terms_present = excluded.local_terms_present,
  meta_description_present = excluded.meta_description_present,
  image_alt_coverage_percent = excluded.image_alt_coverage_percent,
  broken_asset_count = excluded.broken_asset_count,
  check_status = excluded.check_status,
  notes = excluded.notes,
  checked_at = now();

insert into public.admin_production_readiness_checks (check_key, check_area, check_title, check_detail, check_status, next_action, sort_order)
values
  ('saved_filters', 'Admin UX', 'Saved filters have write actions', 'Managers can save shared/personal views for Command Center and admin lists.', 'review', 'Test create/update/delete saved filters from Admin.', 70),
  ('close_wizard_steps', 'Accounting', 'Guided close steps are visible', 'Close Center now has ordered step rows that map blockers to the related manager.', 'review', 'Use the step cards before building the write wizard.', 80),
  ('deployment_gates', 'Deploy', 'Deployment gate checklist exists', 'Code/schema/cache/Edge Function checks are tracked before packaging/deploy.', 'review', 'Mark gate rows pass/fail during each release.', 90),
  ('seo_gate', 'SEO', 'SEO smoke check table exists', 'Public pages can be checked for title/meta/H1/local words/alt/broken assets.', 'review', 'Automate this when more public pages are introduced.', 100)
on conflict (check_key) do update set
  check_area = excluded.check_area,
  check_title = excluded.check_title,
  check_detail = excluded.check_detail,
  check_status = excluded.check_status,
  next_action = excluded.next_action,
  sort_order = excluded.sort_order,
  updated_at = now();

drop view if exists public.v_admin_saved_filter_directory;
create view public.v_admin_saved_filter_directory as
select f.id, f.filter_scope, f.filter_name, f.filter_payload, f.is_shared, f.route_hint, f.section_hint, f.usage_count, f.last_used_at, f.created_at, f.updated_at,
       p.full_name as owner_name
from public.admin_saved_filters f
left join public.profiles p on p.id = f.owner_profile_id
order by f.updated_at desc;

drop view if exists public.v_admin_saved_filter_scope_summary;
create view public.v_admin_saved_filter_scope_summary as
select
  filter_scope,
  count(*)::int as filter_count,
  count(*) filter (where is_shared)::int as shared_filter_count,
  max(updated_at) as last_updated_at,
  max(last_used_at) as last_used_at
from public.admin_saved_filters
group by filter_scope
order by filter_scope;

drop view if exists public.v_admin_close_wizard_steps;
create view public.v_admin_close_wizard_steps as
select
  s.step_key,
  s.step_group,
  s.step_title,
  s.step_detail,
  s.source_view,
  s.source_entity,
  s.route_hint,
  s.blocker_count_column,
  s.step_status,
  s.sort_order,
  s.updated_at
from public.admin_close_workflow_steps s
order by s.sort_order, s.step_key;

drop view if exists public.v_admin_health_resolution_queue;
create view public.v_admin_health_resolution_queue as
select
  n.id,
  n.source_area,
  n.source_id,
  n.resolution_status,
  n.resolution_notes,
  assigned.full_name as assigned_to_name,
  resolved.full_name as resolved_by_name,
  n.resolved_at,
  n.created_at,
  n.updated_at
from public.admin_health_resolution_notes n
left join public.profiles assigned on assigned.id = n.assigned_to_profile_id
left join public.profiles resolved on resolved.id = n.resolved_by_profile_id
order by case n.resolution_status when 'open' then 1 when 'assigned' then 2 when 'resolved' then 9 when 'dismissed' then 10 else 5 end, n.updated_at desc;

drop view if exists public.v_admin_deployment_gate_status;
create view public.v_admin_deployment_gate_status as
select check_key, check_area, check_title, check_status, command_hint, failure_hint, sort_order, updated_at
from public.admin_deployment_gate_checks
order by sort_order, check_key;

drop view if exists public.v_public_seo_smoke_check;
create view public.v_public_seo_smoke_check as
select
  page_path,
  page_title,
  h1_count,
  local_terms_present,
  meta_description_present,
  image_alt_coverage_percent,
  broken_asset_count,
  case
    when h1_count > 1 then 'fail'
    when broken_asset_count > 0 then 'warning'
    when not meta_description_present then 'warning'
    when not local_terms_present then 'review'
    else check_status
  end as check_status,
  notes,
  checked_at
from public.admin_public_seo_checks
order by page_path;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  108::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 108 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 108
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 108.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (
  108,
  '108_saved_filters_close_wizard_health_and_seo_gates',
  '108_saved_filters_close_wizard_health_and_seo_gates.sql',
  '2026-05-15b',
  'Adds saved filter actions, close wizard step metadata, health resolution notes, deployment gate checks, and SEO smoke check foundations.',
  'applied',
  'Production-readiness pass that advances saved filters, close workflow, health resolution, deployment gating, and SEO checks.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.v_admin_saved_filter_scope_summary to authenticated;
grant select on public.v_admin_close_wizard_steps to authenticated;
grant select on public.v_admin_health_resolution_queue to authenticated;
grant select on public.v_admin_deployment_gate_status to authenticated;
grant select on public.v_public_seo_smoke_check to authenticated;
grant select on public.admin_close_workflow_steps to authenticated;
grant select on public.admin_health_resolution_notes to authenticated;
grant select on public.admin_deployment_gate_checks to authenticated;
grant select on public.admin_public_seo_checks to authenticated;
grant select on public.admin_saved_filters to authenticated;
