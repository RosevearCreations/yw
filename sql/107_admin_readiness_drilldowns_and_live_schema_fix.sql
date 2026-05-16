-- Schema 107: production readiness, schema drift, saved filters, permissions, close/evidence manager foundations.
-- 107_admin_readiness_drilldowns_and_live_schema_fix.sql

-- Schema 107 is also safe to run directly after a partial/live failed schema-106 attempt.
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

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists schema_name text;
alter table public.app_schema_versions add column if not exists release_label text;
alter table public.app_schema_versions add column if not exists description text;
alter table public.app_schema_versions add column if not exists status text not null default 'applied';
alter table public.app_schema_versions add column if not exists applied_at timestamptz not null default now();
alter table public.app_schema_versions add column if not exists applied_by text;
alter table public.app_schema_versions add column if not exists notes text;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (
  107,
  '107_admin_readiness_drilldowns_and_live_schema_fix',
  '107_admin_readiness_drilldowns_and_live_schema_fix.sql',
  '2026-05-14b',
  'Adds schema drift status, production readiness checklist, saved admin filters, role permission matrix, close center overview, and evidence manager directory.',
  'applied',
  'Follow-up to live schema errors: avoids jobs.job_status assumptions and gives admins production-readiness visibility.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

create table if not exists public.admin_saved_filters (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid references public.profiles(id),
  filter_scope text not null,
  filter_name text not null,
  filter_payload jsonb not null default '{}'::jsonb,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_saved_filters_scope on public.admin_saved_filters(filter_scope, updated_at desc);

create table if not exists public.admin_production_readiness_checks (
  check_key text primary key,
  check_area text not null,
  check_title text not null,
  check_detail text,
  check_status text not null default 'review',
  next_action text,
  sort_order int not null default 100,
  updated_at timestamptz not null default now()
);

insert into public.admin_production_readiness_checks (check_key, check_area, check_title, check_detail, check_status, next_action, sort_order)
values
  ('schema_drift', 'Database', 'Live schema matches repo marker', 'Database should have all migrations through schema 107.', 'review', 'Confirm v_schema_drift_status says current.', 10),
  ('rls_review', 'Security', 'RLS and role policies reviewed', 'Admin, supervisor, HSE, and employee workflows need final live policy review.', 'review', 'Run a role-by-role permission test.', 20),
  ('backup_restore', 'Recovery', 'Backup and restore tested', 'Supabase DB, storage/media, and export bundles need restore proof.', 'review', 'Run a small restore rehearsal before production sign-off.', 30),
  ('error_monitoring', 'Monitoring', 'Error and health center monitored', 'Frontend diagnostics and backend health rows should be watched after deploy.', 'review', 'Open Admin Health after deploy and confirm no critical rows.', 40),
  ('accounting_close', 'Accounting', 'Close workflow has no blockers', 'Close Center should show payment, reconciliation, tax, payroll, journal, and package status.', 'review', 'Clear blockers before locking a period.', 50),
  ('seo_public_pages', 'SEO', 'Public pages pass SEO smoke check', 'One H1, clear title/meta, local terms, alt text, and no broken assets.', 'review', 'Run public-page smoke checks when marketing pages are added.', 60)
on conflict (check_key) do update set
  check_area = excluded.check_area,
  check_title = excluded.check_title,
  check_detail = excluded.check_detail,
  check_status = excluded.check_status,
  next_action = excluded.next_action,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.admin_role_permission_matrix (
  id uuid primary key default gen_random_uuid(),
  role_key text not null,
  workflow_area text not null,
  can_view boolean not null default true,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_approve boolean not null default false,
  can_close_reopen boolean not null default false,
  can_export boolean not null default false,
  notes text,
  sort_order int not null default 100,
  unique(role_key, workflow_area)
);

insert into public.admin_role_permission_matrix (role_key, workflow_area, can_view, can_create, can_edit, can_approve, can_close_reopen, can_export, notes, sort_order)
values
  ('admin', 'Admin / Security', true, true, true, true, true, true, 'Full admin access after RLS review.', 10),
  ('admin', 'Accounting Close', true, true, true, true, true, true, 'Can close/reopen periods and export accountant packages.', 20),
  ('supervisor', 'Jobs / Operations', true, true, true, true, false, true, 'Can manage jobs and review operational exceptions.', 30),
  ('supervisor', 'HSE Review', true, true, true, true, false, true, 'Can review evidence and safety tasks.', 40),
  ('hse', 'HSE Review', true, true, true, true, false, true, 'Safety-focused review and export lane.', 50),
  ('employee', 'Worker Self-Service', true, true, true, false, false, false, 'Own forms, profile, training, SDS, clock/outbox only.', 60)
on conflict (role_key, workflow_area) do update set
  can_view = excluded.can_view,
  can_create = excluded.can_create,
  can_edit = excluded.can_edit,
  can_approve = excluded.can_approve,
  can_close_reopen = excluded.can_close_reopen,
  can_export = excluded.can_export,
  notes = excluded.notes,
  sort_order = excluded.sort_order;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  107::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 107 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 107
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 107.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

drop view if exists public.v_production_readiness_checklist;
create view public.v_production_readiness_checklist as
select check_key, check_area, check_title, check_detail, check_status, next_action, sort_order, updated_at
from public.admin_production_readiness_checks
order by sort_order, check_key;

drop view if exists public.v_role_permission_matrix;
create view public.v_role_permission_matrix as
select role_key, workflow_area, can_view, can_create, can_edit, can_approve, can_close_reopen, can_export, notes, sort_order
from public.admin_role_permission_matrix
order by sort_order, role_key, workflow_area;

drop view if exists public.v_admin_saved_filter_directory;
create view public.v_admin_saved_filter_directory as
select f.id, f.filter_scope, f.filter_name, f.filter_payload, f.is_shared, f.created_at, f.updated_at,
       p.full_name as owner_name
from public.admin_saved_filters f
left join public.profiles p on p.id = f.owner_profile_id
order by f.updated_at desc;

drop view if exists public.v_admin_close_center_overview;
create view public.v_admin_close_center_overview as
select
  now() as checked_at,
  (select count(*) from public.accounting_period_closes c where coalesce(c.close_status, 'open') <> 'closed')::int as open_accounting_period_count,
  ((select count(*) from public.ar_payment_applications a where coalesce(a.application_status, 'draft') in ('draft','review','exception'))::int +
   (select count(*) from public.ap_payment_applications a where coalesce(a.application_status, 'draft') in ('draft','review','exception'))::int) as payment_application_attention_count,
  (select count(*) from public.bank_reconciliation_items i where coalesce(i.match_status, 'unmatched') in ('unmatched','partial','exception'))::int as reconciliation_review_count,
  (select count(*) from public.sales_tax_filings f where coalesce(f.review_status, f.filing_status, 'draft') not in ('filed','paid'))::int as open_tax_filing_count,
  (select count(*) from public.payroll_remittance_runs r where coalesce(r.review_status, r.remittance_status, 'draft') <> 'remitted')::int as open_payroll_remittance_count,
  (select count(*) from public.gl_journal_batches b where coalesce(b.batch_status, 'draft') in ('draft','review','exception','generated'))::int as journal_candidate_count,
  (select count(*) from public.accountant_handoff_exports e where coalesce(e.package_status, 'prepared') in ('prepared','reviewed','finalized') and coalesce(e.delivery_status, 'pending') <> 'confirmed')::int as package_delivery_attention_count;

drop view if exists public.v_evidence_manager_directory;
create view public.v_evidence_manager_directory as
select
  'field_upload_failure'::text as source_area,
  'Failed upload'::text as evidence_type,
  coalesce(file_name, storage_path, id::text) as evidence_title,
  coalesce(retry_status, failure_stage, 'failed') as evidence_status,
  true as needs_review,
  coalesce(failure_reason, resolution_notes, 'Upload needs retry or admin resolution.') as action_hint,
  null::text as owner_name,
  created_at as last_seen_at,
  id::text as source_id
from public.field_upload_failures
union all
select
  'attendance_photo'::text,
  'Attendance photo'::text,
  coalesce(photo_stage, time_entry_id::text),
  coalesce(review_status, geofence_status, 'review'),
  coalesce(needs_review, false),
  coalesce(review_notes, 'Review attendance photo/geofence status.'),
  full_name,
  uploaded_at,
  time_entry_id::text
from public.v_attendance_photo_review
union all
select
  'hse_evidence'::text,
  coalesce(proof_kind, 'HSE proof')::text,
  coalesce(caption, file_name, proof_id::text),
  coalesce(review_status, 'review')::text,
  coalesce(needs_review, false),
  coalesce(review_notes, proof_notes, 'Review HSE proof.'),
  uploaded_by_name,
  created_at,
  proof_id::text
from public.v_hse_evidence_review;

grant select on public.v_schema_drift_status to authenticated;
grant select on public.v_production_readiness_checklist to authenticated;
grant select on public.v_role_permission_matrix to authenticated;
grant select on public.v_admin_saved_filter_directory to authenticated;
grant select on public.v_admin_close_center_overview to authenticated;
grant select on public.v_evidence_manager_directory to authenticated;
grant select on public.admin_saved_filters to authenticated;
grant select on public.admin_production_readiness_checks to authenticated;
grant select on public.admin_role_permission_matrix to authenticated;
