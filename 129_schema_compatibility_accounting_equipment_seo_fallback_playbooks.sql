-- Schema 129: schema compatibility repair, accounting proof packaging, equipment return-to-service, SEO asset checks, and fallback playbooks.
-- Build 2026-06-04a.
-- This pass locks in the schema 128 column-name repair and adds DB-visible queues for the next implementation layer.

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

create table if not exists public.app_schema_migration_compatibility_checks (
  check_key text primary key,
  schema_file text not null,
  compatibility_area text not null,
  check_title text not null,
  check_status text not null default 'review',
  expected_column text,
  legacy_column text,
  repair_hint text,
  smoke_test_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_accounting_evidence_package_queue (
  package_key text primary key,
  package_area text not null,
  package_title text not null,
  package_status text not null default 'planned',
  source_rows_hint text,
  required_proof_hint text,
  reviewer_role_hint text,
  export_format_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_equipment_return_to_service_rules (
  rule_key text primary key,
  equipment_area text not null,
  rule_title text not null,
  rule_status text not null default 'planned',
  required_role text not null default 'supervisor',
  source_event_hint text,
  proof_required_hint text,
  block_behavior text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_public_asset_smoke_checks (
  check_key text primary key,
  asset_area text not null,
  asset_title text not null,
  check_status text not null default 'planned',
  file_path text,
  source_registry_hint text,
  local_seo_hint text,
  failure_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_error_recovery_playbook (
  playbook_key text primary key,
  app_area text not null,
  error_signature text not null,
  playbook_status text not null default 'review',
  operator_message text,
  recovery_steps text,
  prevention_check text,
  owner_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_schema_migration_compatibility_checks (
  check_key,
  schema_file,
  compatibility_area,
  check_title,
  check_status,
  expected_column,
  legacy_column,
  repair_hint,
  smoke_test_hint,
  sort_order,
  metadata,
  checked_at
)
values
  (
    'schema128_roadmap_source_doc',
    'sql/128_accounting_equipment_seo_fallback_execution_depth.sql',
    'roadmap_column_names',
    'Schema 128 uses source_doc instead of source_document',
    'passed',
    'source_doc',
    'source_document',
    'Use the schema 126 app_roadmap_action_steps column name and reject the legacy alias in smoke checks.',
    'repo-smoke-check searches schema 128 and 000_full_schema_reference for source_document, target_route_hint, and completion_note.',
    10,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'schema128_roadmap_route_hint',
    'sql/128_accounting_equipment_seo_fallback_execution_depth.sql',
    'roadmap_column_names',
    'Schema 128 uses route_hint instead of target_route_hint',
    'passed',
    'route_hint',
    'target_route_hint',
    'Keep the insert and update clauses aligned with schema 126.',
    'repo-smoke-check blocks target_route_hint in schema 128/full schema.',
    20,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'schema128_roadmap_implementation_notes',
    'sql/128_accounting_equipment_seo_fallback_execution_depth.sql',
    'roadmap_column_names',
    'Schema 128 uses implementation_notes instead of completion_note',
    'passed',
    'implementation_notes',
    'completion_note',
    'Keep completed-step notes in implementation_notes.',
    'repo-smoke-check blocks completion_note in schema 128/full schema.',
    30,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'schema129_full_schema_sync',
    'sql/000_full_schema_reference.sql',
    'canonical_schema_reference',
    'Full schema reference includes the repaired schema 128 block and schema 129 marker',
    'passed',
    'expected_schema_version=129',
    'expected_schema_version=128',
    'Append schema 129 and make v_schema_drift_status expect 129.',
    'Smoke checks schema 129 marker and expected 129 drift string.',
    40,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  )
on conflict (check_key) do update set
  schema_file = excluded.schema_file,
  compatibility_area = excluded.compatibility_area,
  check_title = excluded.check_title,
  check_status = excluded.check_status,
  expected_column = excluded.expected_column,
  legacy_column = excluded.legacy_column,
  repair_hint = excluded.repair_hint,
  smoke_test_hint = excluded.smoke_test_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_accounting_evidence_package_queue (
  package_key,
  package_area,
  package_title,
  package_status,
  source_rows_hint,
  required_proof_hint,
  reviewer_role_hint,
  export_format_hint,
  fallback_hint,
  sort_order,
  metadata,
  checked_at
)
values
  (
    'payment_application_package',
    'payment_application',
    'Payment application proof package',
    'planned',
    'AR/AP payments, invoice or bill rows, application rows, adjustments, reversals, and reviewer notes.',
    'Payment source, application date, amount split, customer/vendor, reviewer, and reversal reason when applicable.',
    'admin / accountant',
    'CSV summary plus JSON manifest and proof attachments.',
    'Manual accountant export remains fallback until generated package files exist.',
    10,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'bank_reconciliation_package',
    'bank_reconciliation',
    'Bank reconciliation proof package',
    'planned',
    'Bank imports, rejected rows, matched items, split matches, unmatched items, and undo history.',
    'CSV preview report, duplicate report, match proof, reviewer notes, and final signoff.',
    'admin / accountant',
    'CSV exports plus close-period PDF/Markdown summary when available.',
    'Keep unmatched rows in review queue with exportable CSV.',
    20,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'remittance_package',
    'remittance',
    'HST/GST and payroll remittance proof package',
    'planned',
    'Sales tax filing rows, payroll remittance rows, payment rows, proof uploads, filed/remitted dates.',
    'Source totals, adjustments, filing period, remitted date, proof upload, and reviewer signoff.',
    'admin / accountant',
    'Accountant handoff package with source totals and proof index.',
    'Manual filing checklist remains fallback until proof package automation is done.',
    30,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'month_end_close_package',
    'month_end_close',
    'Month-end close and accountant export proof package',
    'planned',
    'Period close row, lock/reopen audit, journal candidates, reconciliation, remittances, and export manifest.',
    'Final close signoff, reopen reason history, blocked posting check, and package delivery status.',
    'admin / accountant',
    'ZIP package manifest plus CSV/JSON exports and proof file list.',
    'Do not mark the period locked until proof package checks pass.',
    40,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  )
on conflict (package_key) do update set
  package_area = excluded.package_area,
  package_title = excluded.package_title,
  package_status = excluded.package_status,
  source_rows_hint = excluded.source_rows_hint,
  required_proof_hint = excluded.required_proof_hint,
  reviewer_role_hint = excluded.reviewer_role_hint,
  export_format_hint = excluded.export_format_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_equipment_return_to_service_rules (
  rule_key,
  equipment_area,
  rule_title,
  rule_status,
  required_role,
  source_event_hint,
  proof_required_hint,
  block_behavior,
  fallback_hint,
  sort_order,
  metadata,
  checked_at
)
values
  (
    'failed_arrival_blocks_availability',
    'arrival_verification',
    'Failed arrival tests keep equipment locked until service proof exists',
    'planned',
    'supervisor',
    'equipment_transfer_verification_events and equipment_service_tasks',
    'Arrival test status, failure reason, assigned service task, repair/inspection note, and verifier.',
    'Block available status when last_arrival_test_status is failed or needs_service.',
    'Manual lockout stays in place if rule automation is unavailable.',
    10,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'failed_return_blocks_availability',
    'return_verification',
    'Failed return tests require return-to-service signoff',
    'planned',
    'supervisor',
    'equipment_signouts, equipment_transfer_verification_events, and equipment_service_tasks',
    'Return condition, test notes, damage notes, service closeout, proof, and final verifier.',
    'Block available status until a completed service task and return-to-service verifier are recorded.',
    'Keep maintenance status if proof is missing.',
    20,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'missing_accessory_blocks_closeout',
    'accessory_checklist',
    'Missing accessories block final closeout until resolved or waived',
    'planned',
    'supervisor',
    'checkout/arrival/return accessory checklist JSON',
    'Accessory list, missing/damaged reason, replacement cost, waiver reason, and reviewer.',
    'Block return_verified when required accessories are missing without waiver.',
    'Manual exception note remains fallback.',
    30,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'qr_scan_audit_required',
    'scan_audit',
    'QR/barcode manual fallback records who entered the code and why',
    'planned',
    'employee',
    'manual scan fallback and future BarcodeDetector flow',
    'Scanned or typed code, actor, timestamp, unsupported-camera reason, and related action.',
    'Warn when high-risk equipment is moved by manual entry only.',
    'Manual entry still works with visible fallback reason.',
    40,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  )
on conflict (rule_key) do update set
  equipment_area = excluded.equipment_area,
  rule_title = excluded.rule_title,
  rule_status = excluded.rule_status,
  required_role = excluded.required_role,
  source_event_hint = excluded.source_event_hint,
  proof_required_hint = excluded.proof_required_hint,
  block_behavior = excluded.block_behavior,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_public_asset_smoke_checks (
  check_key,
  asset_area,
  asset_title,
  check_status,
  file_path,
  source_registry_hint,
  local_seo_hint,
  failure_hint,
  sort_order,
  metadata,
  checked_at
)
values
  (
    'single_h1_index',
    'public_html',
    'Index keeps exactly one public H1',
    'passed',
    'index.html',
    'Public route shell and smoke script.',
    'Use one clear main heading and supporting section headings only.',
    'Block release when exposed page has duplicate H1 tags.',
    10,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'cache_marker_match',
    'service_worker',
    'Index and service worker cache markers match',
    'passed',
    'index.html / server-worker.js',
    'Release manifest and smoke script.',
    'Avoid stale public assets hiding repaired code.',
    'Hard-refresh or unregister old worker if marker mismatch is visible.',
    20,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'sitemap_robots_next',
    'technical_seo',
    'Sitemap and robots generation should come from approved route rows',
    'planned',
    'sitemap.xml / robots.txt',
    'v_app_public_route_seo_registry and v_app_public_seo_publication_queue.',
    'Only list real locations/services with proof and useful wording.',
    'Do not publish thin unsupported local routes.',
    30,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'broken_asset_next',
    'technical_seo',
    'Broken link and asset smoke checks should run before packaging',
    'planned',
    'index.html, manifest.json, css, js, icons',
    'Release manifest and route registry.',
    'Missing images/scripts/styles weaken trust and search quality.',
    'Keep route hidden until assets pass.',
    40,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  )
on conflict (check_key) do update set
  asset_area = excluded.asset_area,
  asset_title = excluded.asset_title,
  check_status = excluded.check_status,
  file_path = excluded.file_path,
  source_registry_hint = excluded.source_registry_hint,
  local_seo_hint = excluded.local_seo_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_error_recovery_playbook (
  playbook_key,
  app_area,
  error_signature,
  playbook_status,
  operator_message,
  recovery_steps,
  prevention_check,
  owner_hint,
  sort_order,
  metadata,
  checked_at
)
values
  (
    'schema_column_missing_roadmap',
    'schema_deploy',
    'column source_document of relation app_roadmap_action_steps does not exist',
    'covered',
    'The schema file is using an older roadmap column name. Use source_doc, route_hint, and implementation_notes.',
    'Replace the schema 128 file with the repaired version, confirm 000_full_schema_reference has no source_document/target_route_hint/completion_note roadmap insert, then rerun schema 128 followed by schema 129.',
    'Smoke check rejects legacy roadmap column names in schema 128 and canonical full schema.',
    'Admin',
    10,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'edge_function_parse_error',
    'edge_deploy',
    'Failed to bundle the function / source code could not be parsed',
    'covered',
    'The Edge Function contains a syntax error and must not be deployed until node/TypeScript parse checks pass.',
    'Run repo smoke check, repair the exact file and line, then redeploy the specific Edge Function only.',
    'Edge Function TypeScript parse diagnostics are part of repo-smoke-check.',
    'Admin',
    20,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'optional_view_missing_admin',
    'admin_readiness',
    'relation v_app_* does not exist',
    'covered',
    'A new optional readiness view is missing because a migration has not been applied yet.',
    'Show an empty table with Apply schema message, then rerun the latest schema and refresh Admin.',
    'admin-directory safeList calls must stay optional-view tolerant.',
    'Admin',
    30,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  ),
  (
    'offline_sync_conflict',
    'mobile_forms',
    'local draft conflicts with server state',
    'planned',
    'A saved local draft needs review before it can sync safely.',
    'Offer Retry sync, Keep local, or Discard local choices with a plain-language reason.',
    'Offline draft queue and conflict wording stay visible on mobile Today.',
    'Supervisor',
    40,
    '{"build":"2026-06-04a","schema":129}'::jsonb,
    now()
  )
on conflict (playbook_key) do update set
  app_area = excluded.app_area,
  error_signature = excluded.error_signature,
  playbook_status = excluded.playbook_status,
  operator_message = excluded.operator_message,
  recovery_steps = excluded.recovery_steps,
  prevention_check = excluded.prevention_check,
  owner_hint = excluded.owner_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_roadmap_action_steps (
  step_key,
  step_batch,
  step_number,
  step_area,
  step_title,
  step_status,
  priority,
  source_doc,
  route_hint,
  acceptance_check,
  implementation_notes,
  risk_if_skipped,
  sort_order,
  metadata,
  checked_at
)
values
  ('schema129_done_01','completed_this_pass',1,'schema','Repaired canonical full schema reference for schema 128 roadmap columns','completed','high','DEVELOPMENT_ROADMAP.md','sql/000_full_schema_reference.sql','Full schema no longer contains the legacy source_document/target_route_hint/completion_note roadmap insert.','The schema 128 repair is now reflected in the full canonical schema, not only the standalone file.','Full-schema deploys keep failing even when the standalone file is fixed.',1,'{"build":"2026-06-04a","schema":129}'::jsonb,now()),
  ('schema129_done_02','completed_this_pass',2,'schema','Added schema 129 compatibility checks and recovery playbooks','completed','high','DEVELOPMENT_ROADMAP.md','#admin','Schema 129 views expose compatibility and error recovery rows.','Operators get a DB-visible explanation for the schema 128 failure and future parse/view failures.','Known deploy errors remain tribal knowledge.',2,'{"build":"2026-06-04a","schema":129}'::jsonb,now()),
  ('schema129_done_03','completed_this_pass',3,'accounting','Added accounting evidence package queue','completed','high','DEVELOPMENT_ROADMAP.md','#admin','Payment, reconciliation, remittance, and close package rows exist.','Accounting next steps are now packaged around proof, reviewer, and export requirements.','Accounting actions can be built without proof requirements.',3,'{"build":"2026-06-04a","schema":129}'::jsonb,now()),
  ('schema129_done_04','completed_this_pass',4,'equipment','Added equipment return-to-service rule queue','completed','high','DEVELOPMENT_ROADMAP.md','#jobs','Return-to-service rules are visible for failed tests, missing accessories, and manual scan audit.','Equipment accountability now has clearer server-side enforcement targets.','Failed equipment may accidentally return to available status.',4,'{"build":"2026-06-04a","schema":129}'::jsonb,now()),
  ('schema129_done_05','completed_this_pass',5,'seo','Added public asset smoke-check queue','completed','medium','DEVELOPMENT_ROADMAP.md','/','H1/cache/sitemap/asset rows exist and Admin can load them.','SEO checks are tied to release assets and route registry rows.','SEO regressions stay manual.',5,'{"build":"2026-06-04a","schema":129}'::jsonb,now()),
  ('schema129_next_01','next_20',1,'accounting','Build the payment application screen using the schema 128/129 action and proof queues','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Admin can apply, reverse, adjust, refund, and export proof for payments.','Use schema 129 package rows as acceptance criteria.','Payments remain manually matched.',101,'{"build":"2026-06-04a","schema":129}'::jsonb,now()),
  ('schema129_next_02','next_20',2,'accounting','Build bank CSV staging with reject reasons and preview report','planned','high','DEVELOPMENT_ROADMAP.md','#admin','CSV header/date/duplicate/amount checks are visible before import.','Keep rejected rows exportable.','Bad bank data enters reconciliation.',102,'{"build":"2026-06-04a","schema":129}'::jsonb,now()),
  ('schema129_next_03','next_20',3,'accounting','Build reconciliation match/split/undo/signoff controls','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Reviewer can match, split, undo, note, and sign off.','Tie final signoff into close package rows.','Unmatched rows remain unresolved.',103,'{"build":"2026-06-04a","schema":129}'::jsonb,now()),
  ('schema129_next_04','next_20',4,'equipment','Add real BarcodeDetector camera scan with manual-fallback audit reason','planned','high','DEVELOPMENT_ROADMAP.md','#jobs','Camera scan populates equipment code; unsupported camera records manual fallback reason.','Use schema 129 scan audit rule as acceptance criteria.','Manual entry has no audit reason.',104,'{"build":"2026-06-04a","schema":129}'::jsonb,now()),
  ('schema129_next_05','next_20',5,'seo','Generate sitemap/robots from approved route SEO rows and add broken-asset checks','planned','medium','DEVELOPMENT_ROADMAP.md','/','Generated files and smoke checks exist.','Only publish routes that pass local proof and asset checks.','Search/public assets drift.',105,'{"build":"2026-06-04a","schema":129}'::jsonb,now())
on conflict (step_key) do update set
  step_batch = excluded.step_batch,
  step_number = excluded.step_number,
  step_area = excluded.step_area,
  step_title = excluded.step_title,
  step_status = excluded.step_status,
  priority = excluded.priority,
  source_doc = excluded.source_doc,
  route_hint = excluded.route_hint,
  acceptance_check = excluded.acceptance_check,
  implementation_notes = excluded.implementation_notes,
  risk_if_skipped = excluded.risk_if_skipped,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_app_schema_migration_compatibility_checks;
create view public.v_app_schema_migration_compatibility_checks as
select
  check_key,
  schema_file,
  compatibility_area,
  check_title,
  check_status,
  expected_column,
  legacy_column,
  repair_hint,
  smoke_test_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_schema_migration_compatibility_checks
order by sort_order, check_key;

drop view if exists public.v_app_accounting_evidence_package_queue;
create view public.v_app_accounting_evidence_package_queue as
select
  package_key,
  package_area,
  package_title,
  package_status,
  source_rows_hint,
  required_proof_hint,
  reviewer_role_hint,
  export_format_hint,
  fallback_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_accounting_evidence_package_queue
order by sort_order, package_key;

drop view if exists public.v_app_equipment_return_to_service_rules;
create view public.v_app_equipment_return_to_service_rules as
select
  rule_key,
  equipment_area,
  rule_title,
  rule_status,
  required_role,
  source_event_hint,
  proof_required_hint,
  block_behavior,
  fallback_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_equipment_return_to_service_rules
order by sort_order, rule_key;

drop view if exists public.v_app_public_asset_smoke_checks;
create view public.v_app_public_asset_smoke_checks as
select
  check_key,
  asset_area,
  asset_title,
  check_status,
  file_path,
  source_registry_hint,
  local_seo_hint,
  failure_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_public_asset_smoke_checks
order by sort_order, check_key;

drop view if exists public.v_app_error_recovery_playbook;
create view public.v_app_error_recovery_playbook as
select
  playbook_key,
  app_area,
  error_signature,
  playbook_status,
  operator_message,
  recovery_steps,
  prevention_check,
  owner_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_error_recovery_playbook
order by sort_order, playbook_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  129::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 129 then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 129 then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 129.'
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
  129,
  '129_schema_compatibility_accounting_equipment_seo_fallback_playbooks',
  '129_schema_compatibility_accounting_equipment_seo_fallback_playbooks.sql',
  '2026-06-04a',
  'Repairs the canonical schema 128 roadmap-column mismatch and adds compatibility checks, accounting proof package queues, equipment return-to-service rules, public asset smoke checks, and error recovery playbooks.',
  'applied',
  'This pass prevents the schema 128 source_document/target_route_hint/completion_note mismatch from returning and makes the next implementation layer visible in Admin readiness.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_schema_migration_compatibility_checks to authenticated;
grant select on public.app_accounting_evidence_package_queue to authenticated;
grant select on public.app_equipment_return_to_service_rules to authenticated;
grant select on public.app_public_asset_smoke_checks to authenticated;
grant select on public.app_error_recovery_playbook to authenticated;
grant select on public.v_app_schema_migration_compatibility_checks to authenticated;
grant select on public.v_app_accounting_evidence_package_queue to authenticated;
grant select on public.v_app_equipment_return_to_service_rules to authenticated;
grant select on public.v_app_public_asset_smoke_checks to authenticated;
grant select on public.v_app_error_recovery_playbook to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
