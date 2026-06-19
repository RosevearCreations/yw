-- Schema 131: payment UI, reconciliation import, equipment service closeout, SEO asset, and runtime recovery controls.
-- Build 2026-06-05a.
-- This pass moves schema 130 execution queues closer to working controls and operator proof paths.

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

create table if not exists public.app_payment_application_ui_queue (
  control_key text primary key,
  control_area text not null,
  control_title text not null,
  control_status text not null default 'planned',
  required_role text not null default 'admin',
  route_hint text,
  validation_hint text,
  posting_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_reconciliation_import_validation_queue (
  check_key text primary key,
  import_area text not null,
  check_title text not null,
  check_status text not null default 'planned',
  csv_rule_hint text,
  match_rule_hint text,
  reviewer_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_equipment_service_closeout_queue (
  closeout_key text primary key,
  equipment_area text not null,
  closeout_title text not null,
  closeout_status text not null default 'planned',
  required_role text not null default 'supervisor',
  proof_hint text,
  cost_capture_hint text,
  return_to_service_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_seo_asset_publication_queue (
  asset_key text primary key,
  route_key text,
  seo_area text not null,
  asset_title text not null,
  asset_status text not null default 'planned',
  file_path_hint text,
  local_search_hint text,
  validation_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_runtime_recovery_telemetry_queue (
  telemetry_key text primary key,
  app_surface text not null,
  recovery_title text not null,
  recovery_status text not null default 'planned',
  signal_hint text,
  operator_message_hint text,
  retry_hint text,
  owner_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_payment_application_ui_queue (
  control_key, control_area, control_title, control_status, required_role, route_hint, validation_hint, posting_hint, fallback_hint, sort_order, metadata, checked_at
)
values
  ('payment_apply_button_guard', 'payment_application', 'Wire Apply Payment button with invoice/deposit validation', 'planned', 'admin', '#admin', 'Require customer, invoice/deposit source, positive amount, date, and payment method.', 'Create staged application row before posting.', 'Keep payment as reviewer note if validation fails.', 10, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('payment_reverse_button_guard', 'payment_application', 'Wire Reverse Payment button with reason and role gate', 'planned', 'admin', '#admin', 'Require original application, reversal reason, and reviewer role.', 'Create reversal row and restore open balance.', 'Block reversal and show reason field.', 20, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('payment_adjustment_selector', 'payment_application', 'Add adjustment selector for discount, credit, write-off, refund, and overpayment', 'planned', 'admin', '#admin', 'Adjustment type controls required proof and posting path.', 'Separate cash movement from revenue reduction.', 'Keep staged adjustment until accountant review.', 30, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('payment_proof_attachment_gate', 'payment_application', 'Require proof attachment or external reference before final posting', 'planned', 'admin', '#admin', 'Proof/reference required for refunds, overpayments, and write-offs.', 'Link proof to accountant export package.', 'Keep status pending proof.', 40, '{"build":"2026-06-05a","schema":131}'::jsonb, now())
on conflict (control_key) do update set
  control_area = excluded.control_area,
  control_title = excluded.control_title,
  control_status = excluded.control_status,
  required_role = excluded.required_role,
  route_hint = excluded.route_hint,
  validation_hint = excluded.validation_hint,
  posting_hint = excluded.posting_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_reconciliation_import_validation_queue (
  check_key, import_area, check_title, check_status, csv_rule_hint, match_rule_hint, reviewer_hint, fallback_hint, sort_order, metadata, checked_at
)
values
  ('csv_header_map', 'bank_reconciliation', 'Preview and map bank CSV headers before staging', 'planned', 'Detect date, description, debit, credit, amount, balance, reference, and account columns.', 'No match scoring until mapped columns pass.', 'Reviewer confirms the bank/source account.', 'Reject import with clear missing-column message.', 10, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('csv_duplicate_detection', 'bank_reconciliation', 'Detect duplicate bank rows before acceptance', 'planned', 'Hash date, amount, description, reference, and account.', 'Duplicates are excluded from confidence scoring.', 'Reviewer can mark duplicate as accepted only with note.', 'Keep duplicates in rejected-row preview.', 20, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('match_confidence_rules', 'bank_reconciliation', 'Score match confidence by amount, date, reference, customer, and invoice', 'planned', 'Accepted rows feed match candidates.', 'Exact amount/reference wins, date proximity adds score, fuzzy description is lower score.', 'Reviewer signs manual low-confidence matches.', 'Manual search stays available.', 30, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('unmatch_undo_history', 'bank_reconciliation', 'Track unmatch/undo/split history with reason', 'planned', 'Each manual action records actor and reason.', 'Undo returns rows to unmatched queue.', 'Reviewer sees history before close.', 'Closed periods block undo unless reopened.', 40, '{"build":"2026-06-05a","schema":131}'::jsonb, now())
on conflict (check_key) do update set
  import_area = excluded.import_area,
  check_title = excluded.check_title,
  check_status = excluded.check_status,
  csv_rule_hint = excluded.csv_rule_hint,
  match_rule_hint = excluded.match_rule_hint,
  reviewer_hint = excluded.reviewer_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_equipment_service_closeout_queue (
  closeout_key, equipment_area, closeout_title, closeout_status, required_role, proof_hint, cost_capture_hint, return_to_service_hint, fallback_hint, sort_order, metadata, checked_at
)
values
  ('failed_arrival_closeout', 'arrival_issue', 'Close failed arrival test with service proof and cost', 'planned', 'supervisor', 'Attach photo/note proof and arrival test result.', 'Capture repair/delay/replacement estimate against job/equipment.', 'Equipment stays locked out until verifier signs off.', 'Keep open service task if proof missing.', 10, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('failed_return_closeout', 'return_issue', 'Close failed return test with return-to-service signoff', 'planned', 'supervisor', 'Attach return proof, damage notes, and test result.', 'Capture actual repair/replacement cost.', 'Status changes to available only after final verifier.', 'Keep equipment maintenance/locked_out.', 20, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('accessory_missing_closeout', 'accessory_issue', 'Resolve missing or damaged accessories before final return', 'planned', 'supervisor', 'Checklist shows missing/damaged accessories and resolution proof.', 'Capture accessory replacement cost.', 'Accessory issue must be closed before ready status.', 'Keep issue visible in exception queue.', 30, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('service_task_cost_rollup', 'cost_rollup', 'Roll equipment service task costs into job profitability', 'planned', 'admin', 'Service task closeout includes cost proof.', 'Post repair, delay, usage, or replacement cost to job financial events.', 'Cost rows become part of close package.', 'Show service task source rows if rollup fails.', 40, '{"build":"2026-06-05a","schema":131}'::jsonb, now())
on conflict (closeout_key) do update set
  equipment_area = excluded.equipment_area,
  closeout_title = excluded.closeout_title,
  closeout_status = excluded.closeout_status,
  required_role = excluded.required_role,
  proof_hint = excluded.proof_hint,
  cost_capture_hint = excluded.cost_capture_hint,
  return_to_service_hint = excluded.return_to_service_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_seo_asset_publication_queue (
  asset_key, route_key, seo_area, asset_title, asset_status, file_path_hint, local_search_hint, validation_hint, fallback_hint, sort_order, metadata, checked_at
)
values
  ('sitemap_publish', 'home_shell', 'technical_seo', 'Publish sitemap.xml from approved public route registry', 'planned', '/sitemap.xml', 'Include only truthful service/location routes.', 'Smoke check file exists and contains approved routes.', 'Do not submit sitemap until generated file passes.', 10, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('robots_publish', 'home_shell', 'technical_seo', 'Publish robots.txt with sitemap reference', 'planned', '/robots.txt', 'Allow public service pages; do not expose admin routes.', 'Smoke check sitemap reference and admin exclusions.', 'Keep default static shell until robots passes.', 20, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('jsonld_publish_gate', 'home_shell', 'structured_data', 'Validate JSON-LD before public publish', 'planned', 'index.html / route snippets', 'Use accurate business/service area wording only.', 'Parse JSON-LD and flag missing required fields.', 'Plain title/meta remains fallback.', 30, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('image_alt_publish_gate', 'home_shell', 'image_alt', 'Block weak public image alt text and missing local proof', 'planned', 'public image registry/static markup', 'Alt text describes real image and service area proof truthfully.', 'Smoke check missing/short alt text before deploy.', 'Hide weak gallery blocks until fixed.', 40, '{"build":"2026-06-05a","schema":131}'::jsonb, now())
on conflict (asset_key) do update set
  route_key = excluded.route_key,
  seo_area = excluded.seo_area,
  asset_title = excluded.asset_title,
  asset_status = excluded.asset_status,
  file_path_hint = excluded.file_path_hint,
  local_search_hint = excluded.local_search_hint,
  validation_hint = excluded.validation_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_runtime_recovery_telemetry_queue (
  telemetry_key, app_surface, recovery_title, recovery_status, signal_hint, operator_message_hint, retry_hint, owner_hint, sort_order, metadata, checked_at
)
values
  ('edge_view_missing_signal', 'admin-directory', 'Track optional view missing signals with operator-friendly copy', 'planned', 'safeList fallback result and view name.', 'Apply latest schema, redeploy function, then refresh.', 'Retry after schema deploy; keep table empty meanwhile.', 'Admin', 10, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('service_worker_marker_signal', 'public_shell', 'Track stale service worker marker mismatch', 'planned', 'Index marker, service worker cache marker, and asset query version.', 'Hard refresh or clear old worker if markers mismatch.', 'Install cache assets one by one and keep shell fallback alive.', 'Admin', 20, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('offline_sync_signal', 'mobile_forms', 'Track offline draft sync failures and conflict choices', 'planned', 'Local draft count, outbox count, last failed sync reason.', 'Choose retry, keep local, or discard local copy.', 'Retry failed payload only; keep copy until acknowledged.', 'Supervisor', 30, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('accounting_block_signal', 'accounting_workbench', 'Track proof/signoff blocks before close or posting', 'planned', 'Missing proof, reviewer, close period, or reconciliation signal.', 'Complete the missing proof/signoff before posting.', 'No automatic retry for blocked accounting actions.', 'Admin / Accountant', 40, '{"build":"2026-06-05a","schema":131}'::jsonb, now())
on conflict (telemetry_key) do update set
  app_surface = excluded.app_surface,
  recovery_title = excluded.recovery_title,
  recovery_status = excluded.recovery_status,
  signal_hint = excluded.signal_hint,
  operator_message_hint = excluded.operator_message_hint,
  retry_hint = excluded.retry_hint,
  owner_hint = excluded.owner_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_roadmap_action_steps (
  step_key, step_batch, step_number, step_area, step_title, step_status, priority, source_doc, route_hint, acceptance_check, implementation_notes, risk_if_skipped, sort_order, metadata, checked_at
)
values
  ('schema131_done_01', 'completed_this_pass', 1, 'schema', 'Added schema 131 execution-control queues', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Migration and full schema include schema 131.', 'New DB-visible queues track payment UI, reconciliation import validation, equipment service closeout, SEO asset publication, and runtime recovery telemetry.', 'Execution controls remain scattered.', 1, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_done_02', 'completed_this_pass', 2, 'admin', 'Loaded schema 131 queues in admin-directory', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'admin-directory returns all schema 131 views with safe fallbacks.', 'Admin can see these queues when schema 131 is applied.', 'Rows stay hidden from operators.', 2, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_done_03', 'completed_this_pass', 3, 'ui', 'Rendered schema 131 queues in Admin readiness', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Admin UI contains schema 131 table bindings and empty-state fallback messages.', 'Planning rows are visible in the app.', 'Operators rely on Markdown only.', 3, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_done_04', 'completed_this_pass', 4, 'seo', 'Kept one-H1 and local SEO smoke checks active', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '/', 'Smoke confirms one H1 and cache markers.', 'Public route quality habits continue each pass.', 'Search clarity can drift.', 4, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_done_05', 'completed_this_pass', 5, 'cleanup', 'Restored missing archive snapshots and retired test_write files', 'completed', 'medium', 'KNOWN_ISSUES_AND_GAPS.md', 'archive', 'Smoke archive and temporary file checks pass.', 'Root stays clean and smoke script stays reliable.', 'Old hygiene failures distract from real work.', 5, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_01', 'next_20', 1, 'payments', 'Build the real Apply Payment form and staged save action', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Admin can choose invoice/deposit rows, amount, date, method, and save staged application.', 'Payment action moves from queue to real UI.', 'Cash application stays manual.', 101, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_02', 'next_20', 2, 'payments', 'Add reversal and adjustment actions with proof gates', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Reverse/adjust buttons require reason, proof/reference, and reviewer role.', 'Mistakes can be corrected with audit trail.', 'Corrections remain unsafe/manual.', 102, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_03', 'next_20', 3, 'reconciliation', 'Create bank CSV preview/import staging screen', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'CSV rows preview with header map, duplicate detection, rejected rows, and accepted count.', 'Bank imports become safer.', 'Bad rows may enter accounting.', 103, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_04', 'next_20', 4, 'reconciliation', 'Create match scoring and manual match/split/undo controls', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Reviewer can accept scored matches, manually match, split, unmatch, and see history.', 'Reconciliation gets auditable flow.', 'Rows stay unmatched.', 104, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_05', 'next_20', 5, 'equipment', 'Add camera scan using BarcodeDetector with manual fallback', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Camera scan fills equipment code when supported and falls back to manual entry.', 'Field equipment work speeds up.', 'Manual entry stays slow.', 105, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_06', 'next_20', 6, 'equipment', 'Create accessory template tables and editor', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Expected accessories load by equipment pool/category.', 'Missing accessories are easier to catch.', 'Checklists stay free-text.', 106, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_07', 'next_20', 7, 'equipment', 'Enforce verifier roles server-side for return-to-service', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Server blocks return-to-service below required verifier role.', 'Lockout safety is authoritative.', 'UI-only locks can be bypassed.', 107, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_08', 'next_20', 8, 'equipment', 'Build equipment service closeout screen with proof and costs', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Failed test service tasks can be closed with proof, costs, and final status.', 'Equipment cost and safety flow gets depth.', 'Service tasks stay open-ended.', 108, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_09', 'next_20', 9, 'seo', 'Generate sitemap.xml and robots.txt from approved routes', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '/', 'Generated files exist and list approved public routes only.', 'Technical SEO moves beyond planning.', 'Search engines get stale route hints.', 109, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_10', 'next_20', 10, 'seo', 'Add broken-link, image-alt, and JSON-LD validation to smoke checks', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '/', 'Smoke flags broken assets, weak alt text, and invalid JSON-LD.', 'Public quality gate becomes stronger.', 'SEO drift remains manual.', 110, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_11', 'next_20', 11, 'accounting', 'Build HST/GST source totals and proof review UI', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Reviewer sees tax totals, adjustments, filed date, remitted date, and proof.', 'Tax review becomes auditable.', 'Tax filing remains spreadsheet-based.', 111, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_12', 'next_20', 12, 'accounting', 'Build payroll remittance source totals and proof UI', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Reviewer sees payroll source totals, deductions, employer costs, proof, and signoff.', 'Payroll remittance gets close workflow.', 'Payroll proof remains scattered.', 112, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_13', 'next_20', 13, 'accounting', 'Build month-end lock/reopen and accountant export package', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Closed periods block posting unless reopened with reason; export package lists files/proofs.', 'Month-end becomes controlled.', 'Posting drift can happen after close.', 113, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_14', 'next_20', 14, 'mobile', 'Add offline conflict resolution choices to forms', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#today', 'Users can retry, keep local, or discard local draft when conflict occurs.', 'Mobile fallback becomes clear.', 'Draft conflict can confuse users.', 114, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_15', 'next_20', 15, 'fallback', 'Store fallback drill run history and pass/fail notes', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Operators can mark drills run/pass/fail with notes.', 'Fallbacks become testable.', 'Fallback rows are unproven.', 115, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_16', 'next_20', 16, 'telemetry', 'Add runtime recovery telemetry summary cards', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Admin sees optional-view, service-worker, offline-sync, and accounting-block signals.', 'Failures are easier to triage.', 'Errors remain hidden in console.', 116, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_17', 'next_20', 17, 'data', 'Promote repeated route/SEO/action JSON data into DB-backed registries', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Repeated static config with review status moves into DB queues.', 'Admin can sort/review/update it.', 'JSON duplication remains.', 117, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_18', 'next_20', 18, 'css', 'Add CSS component drift snapshot and mobile overflow check', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '/', 'Smoke detects major missing CSS components and mobile overflow patterns.', 'CSS drift is caught earlier.', 'Mobile layout can regress.', 118, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_19', 'next_20', 19, 'deployment', 'Add schema deploy order and function redeploy checklist for 131+', 'planned', 'medium', 'DEPLOYMENT_GUIDE.md', '#admin', 'Deployment checklist states schema/function/cache order.', 'Deploy steps stay clear.', 'Partial deploy confusion continues.', 119, '{"build":"2026-06-05a","schema":131}'::jsonb, now()),
  ('schema131_next_20', 'next_20', 20, 'docs', 'Keep all active Markdown and schema references synced each pass', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', 'docs', 'Roadmap, known gaps, changelog, project state, testing, deployment, and full schema all reference latest build.', 'New chat starts with correct context.', 'Docs drift again.', 120, '{"build":"2026-06-05a","schema":131}'::jsonb, now())
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

drop view if exists public.v_app_payment_application_ui_queue;
create view public.v_app_payment_application_ui_queue as
select control_key, control_area, control_title, control_status, required_role, route_hint, validation_hint, posting_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_payment_application_ui_queue
order by sort_order, control_key;

drop view if exists public.v_app_reconciliation_import_validation_queue;
create view public.v_app_reconciliation_import_validation_queue as
select check_key, import_area, check_title, check_status, csv_rule_hint, match_rule_hint, reviewer_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_reconciliation_import_validation_queue
order by sort_order, check_key;

drop view if exists public.v_app_equipment_service_closeout_queue;
create view public.v_app_equipment_service_closeout_queue as
select closeout_key, equipment_area, closeout_title, closeout_status, required_role, proof_hint, cost_capture_hint, return_to_service_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_equipment_service_closeout_queue
order by sort_order, closeout_key;

drop view if exists public.v_app_seo_asset_publication_queue;
create view public.v_app_seo_asset_publication_queue as
select asset_key, route_key, seo_area, asset_title, asset_status, file_path_hint, local_search_hint, validation_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_seo_asset_publication_queue
order by sort_order, asset_key;

drop view if exists public.v_app_runtime_recovery_telemetry_queue;
create view public.v_app_runtime_recovery_telemetry_queue as
select telemetry_key, app_surface, recovery_title, recovery_status, signal_hint, operator_message_hint, retry_hint, owner_hint, sort_order, checked_at, updated_at
from public.app_runtime_recovery_telemetry_queue
order by sort_order, telemetry_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  131::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 131
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 131
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 131.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version, migration_key, schema_name, release_label, description, status, notes
)
values (
  131,
  '131_payment_recon_equipment_seo_runtime_execution_controls',
  '131_payment_recon_equipment_seo_runtime_execution_controls.sql',
  '2026-06-05a',
  'Adds Admin-visible execution controls for payment UI validation, reconciliation import validation, equipment service closeout, SEO asset publication, and runtime recovery telemetry.',
  'applied',
  'This pass moves schema 130 execution playbooks closer to working controls while keeping schema/docs/cache/smoke guardrails aligned.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_payment_application_ui_queue to authenticated;
grant select on public.app_reconciliation_import_validation_queue to authenticated;
grant select on public.app_equipment_service_closeout_queue to authenticated;
grant select on public.app_seo_asset_publication_queue to authenticated;
grant select on public.app_runtime_recovery_telemetry_queue to authenticated;
grant select on public.v_app_payment_application_ui_queue to authenticated;
grant select on public.v_app_reconciliation_import_validation_queue to authenticated;
grant select on public.v_app_equipment_service_closeout_queue to authenticated;
grant select on public.v_app_seo_asset_publication_queue to authenticated;
grant select on public.v_app_runtime_recovery_telemetry_queue to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
