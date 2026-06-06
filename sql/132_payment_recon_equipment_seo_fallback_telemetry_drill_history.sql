-- Schema 132: payment posting proofs, reconciliation matching, equipment verification, local SEO assets, and fallback telemetry drill history.
-- Build 2026-06-05b.
-- This pass moves schema 131 execution controls closer to usable operator workflows while keeping roadmap/docs/schema drift aligned.

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

create table if not exists public.app_payment_posting_proof_queue (
  proof_key text primary key,
  proof_area text not null,
  proof_title text not null,
  proof_status text not null default 'planned',
  required_role text not null default 'admin',
  source_row_hint text,
  proof_requirement text,
  posting_block_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_reconciliation_match_workbench_queue (
  workbench_key text primary key,
  match_area text not null,
  workbench_title text not null,
  workbench_status text not null default 'planned',
  import_rule_hint text,
  match_score_hint text,
  manual_review_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_equipment_scan_verification_queue (
  verification_key text primary key,
  equipment_area text not null,
  verification_title text not null,
  verification_status text not null default 'planned',
  scan_path_hint text,
  role_gate_hint text,
  evidence_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_local_seo_asset_smoke_queue (
  smoke_key text primary key,
  seo_area text not null,
  smoke_title text not null,
  smoke_status text not null default 'planned',
  asset_path_hint text,
  local_relevance_hint text,
  validation_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_runtime_fallback_drill_history_queue (
  drill_key text primary key,
  app_surface text not null,
  drill_title text not null,
  drill_status text not null default 'planned',
  trigger_hint text,
  expected_result_hint text,
  evidence_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_payment_posting_proof_queue (proof_key, proof_area, proof_title, proof_status, required_role, source_row_hint, proof_requirement, posting_block_hint, fallback_hint, sort_order, metadata, checked_at)
values
  ('payment_source_required', 'payment_application', 'Require source payment, target invoice, amount, date, and method before Apply Payment', 'planned', 'admin', 'AR payment / deposit / invoice rows', 'Receipt reference or external transaction id is required before posting.', 'Block final posting if source or target is missing.', 'Keep row staged and show missing-field warning.', 10, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('adjustment_reason_required', 'payment_adjustments', 'Require reason and proof for discounts, credits, write-offs, refunds, and overpayments', 'planned', 'admin', 'Adjustment selector / payment application rows', 'Reason, reviewer, amount, and proof attachment/reference are required.', 'Block close-period posting if proof is missing.', 'Store draft adjustment with reviewer note.', 20, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('accountant_export_payment_manifest', 'accountant_export', 'Include payment application and reversal manifest in accountant export package', 'planned', 'admin', 'Payment, adjustment, reversal, and proof rows', 'Manifest lists row counts, totals, and proof references.', 'Closed period export is blocked until unmatched proof is resolved.', 'Export summary table remains fallback.', 30, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('job_profitability_payment_link', 'job_profitability', 'Link payment and adjustment proof back to job profitability review', 'planned', 'admin', 'Job financial events / AR invoice / payment rows', 'Job margin card shows payment, credit, write-off, refund, and outstanding balance.', 'Do not mark job accounting-complete until payment state is reviewed.', 'Show payment source rows if rollup fails.', 40, '{"build":"2026-06-05b","schema":132}'::jsonb, now())
on conflict (proof_key) do update set
  proof_area = excluded.proof_area,
  proof_title = excluded.proof_title,
  proof_status = excluded.proof_status,
  required_role = excluded.required_role,
  source_row_hint = excluded.source_row_hint,
  proof_requirement = excluded.proof_requirement,
  posting_block_hint = excluded.posting_block_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_reconciliation_match_workbench_queue (workbench_key, match_area, workbench_title, workbench_status, import_rule_hint, match_score_hint, manual_review_hint, fallback_hint, sort_order, metadata, checked_at)
values
  ('csv_preview_accept_reject', 'csv_preview', 'Preview bank CSV rows with accept/reject reasons before staging', 'planned', 'Validate mapped date, amount, description, reference, account, duplicate hash, and sign direction.', 'No match scoring until accepted rows are staged.', 'Reviewer can accept rejected row only with note.', 'Keep file outside posting path until preview passes.', 10, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('match_score_thresholds', 'match_scoring', 'Apply match score thresholds for exact, probable, and manual-review matches', 'planned', 'Accepted import rows are normalized before scoring.', 'Exact amount/reference/date gets highest score; fuzzy text is lower confidence.', 'Low confidence rows must be manually reviewed.', 'Manual search remains fallback.', 20, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('split_match_support', 'manual_review', 'Support split matches with notes, proof, and undo trail', 'planned', 'Split rows inherit source CSV row and reviewer note.', 'Split rows cannot exceed source amount.', 'Reviewer sees split history before close.', 'Leave row unmatched if split validation fails.', 30, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('reconciliation_close_block', 'period_close', 'Block month-end close when unmatched or unreviewed reconciliation rows remain', 'planned', 'Close wizard checks unmatched rows, rejected rows, and unsigned reviews.', 'Only signed sessions can close.', 'Admin/accountant must sign unresolved exceptions.', 'Close remains in review state.', 40, '{"build":"2026-06-05b","schema":132}'::jsonb, now())
on conflict (workbench_key) do update set
  match_area = excluded.match_area,
  workbench_title = excluded.workbench_title,
  workbench_status = excluded.workbench_status,
  import_rule_hint = excluded.import_rule_hint,
  match_score_hint = excluded.match_score_hint,
  manual_review_hint = excluded.manual_review_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_equipment_scan_verification_queue (verification_key, equipment_area, verification_title, verification_status, scan_path_hint, role_gate_hint, evidence_hint, fallback_hint, sort_order, metadata, checked_at)
values
  ('checkout_scan_required_when_available', 'checkout', 'Use QR/barcode scan when available, with manual code fallback', 'planned', 'Camera scan -> equipment code -> checkout form prefill.', 'Employee may scan; supervisor still approves checkout.', 'Checkout event records scanned/manual source.', 'Manual entry stays available when camera unsupported.', 10, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('arrival_scan_site_match', 'arrival_verification', 'Verify scanned equipment arrived at the intended site', 'planned', 'Scan equipment code at destination site.', 'Supervisor/site lead verifies arrival test.', 'Arrival event stores site, condition, test result, and proof note.', 'Manual verify arrival remains fallback.', 20, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('return_scan_accessory_match', 'return_verification', 'Scan equipment on return and compare accessory checklist', 'planned', 'Scan returned equipment and load expected accessories.', 'Supervisor verifies return, accessory status, and damage.', 'Missing/damaged accessories create service task and cost capture.', 'Keep return pending review if checklist fails.', 30, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('return_to_service_proof_gate', 'return_to_service', 'Require service proof before locked-out equipment becomes available', 'planned', 'Service task closeout references equipment scan/code.', 'Admin/supervisor role gate blocks bypass.', 'Proof, cost, and final test result are retained.', 'Keep locked out until gate passes.', 40, '{"build":"2026-06-05b","schema":132}'::jsonb, now())
on conflict (verification_key) do update set
  equipment_area = excluded.equipment_area,
  verification_title = excluded.verification_title,
  verification_status = excluded.verification_status,
  scan_path_hint = excluded.scan_path_hint,
  role_gate_hint = excluded.role_gate_hint,
  evidence_hint = excluded.evidence_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_local_seo_asset_smoke_queue (smoke_key, seo_area, smoke_title, smoke_status, asset_path_hint, local_relevance_hint, validation_hint, fallback_hint, sort_order, metadata, checked_at)
values
  ('sitemap_file_present', 'technical_seo', 'Ship sitemap.xml with approved public routes only', 'in_progress', '/sitemap.xml', 'Routes must match true service/location coverage.', 'Smoke checks sitemap file exists and excludes admin routes.', 'Keep single-page shell if sitemap generation fails.', 10, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('robots_file_present', 'technical_seo', 'Ship robots.txt with sitemap reference and admin exclusions', 'in_progress', '/robots.txt', 'Public crawl is allowed; admin routes are excluded.', 'Smoke checks robots file exists and references sitemap.', 'Default robots remains fallback.', 20, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('title_h1_meta_alignment', 'on_page_seo', 'Check title, H1, meta description, and local wording alignment', 'in_progress', 'index.html', 'Use clear service/location wording without duplicate H1s.', 'Smoke verifies one public H1 and local terms table rows.', 'Hold route in review until wording passes.', 30, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('image_alt_jsonld_check', 'structured_data', 'Add image alt and JSON-LD validation before local proof publishing', 'planned', 'index.html / public image registry', 'Image alt text and structured data must be accurate and not overclaim.', 'Smoke flags missing alt text and invalid JSON-LD.', 'Hide gallery/proof block until fixed.', 40, '{"build":"2026-06-05b","schema":132}'::jsonb, now())
on conflict (smoke_key) do update set
  seo_area = excluded.seo_area,
  smoke_title = excluded.smoke_title,
  smoke_status = excluded.smoke_status,
  asset_path_hint = excluded.asset_path_hint,
  local_relevance_hint = excluded.local_relevance_hint,
  validation_hint = excluded.validation_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_runtime_fallback_drill_history_queue (drill_key, app_surface, drill_title, drill_status, trigger_hint, expected_result_hint, evidence_hint, fallback_hint, sort_order, metadata, checked_at)
values
  ('edge_optional_view_drill', 'admin-directory', 'Drill missing optional view fallback', 'planned', 'Temporarily hide optional schema view in test database.', 'Admin readiness table shows empty rows with apply-schema hint instead of crashing.', 'Record drill date/result in future drill history.', 'safeList keeps response alive.', 10, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('service_worker_stale_drill', 'public_shell', 'Drill stale service worker and cache-marker recovery', 'planned', 'Serve previous worker marker against new index marker.', 'User sees hard-refresh/clear-worker instruction and app shell still loads.', 'Record marker mismatch signal once telemetry table exists.', 'Per-asset cache install keeps shell alive.', 20, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('offline_draft_conflict_drill', 'mobile_forms', 'Drill offline draft conflict choices', 'planned', 'Create local draft, change server record, then reconnect.', 'User can retry, keep local, or discard local draft.', 'Record choice, actor, and conflict reason in future history table.', 'Local copy is retained until acknowledged.', 30, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('accounting_block_drill', 'accounting_workbench', 'Drill accounting proof/signoff block before posting', 'planned', 'Attempt close/posting without proof or reviewer.', 'System blocks action and shows missing proof/signoff reason.', 'Record blocked reason and reviewer note in future audit table.', 'Action remains staged, not posted.', 40, '{"build":"2026-06-05b","schema":132}'::jsonb, now())
on conflict (drill_key) do update set
  app_surface = excluded.app_surface,
  drill_title = excluded.drill_title,
  drill_status = excluded.drill_status,
  trigger_hint = excluded.trigger_hint,
  expected_result_hint = excluded.expected_result_hint,
  evidence_hint = excluded.evidence_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_roadmap_action_steps (
  step_key, step_batch, step_number, step_area, step_title, step_status, priority, source_doc, route_hint, acceptance_check, implementation_notes, risk_if_skipped, sort_order, metadata, checked_at
)
values
  ('schema132_done_01', 'completed_this_pass', 1, 'schema', 'Added schema 132 operator workflow queues', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Migration and full schema include schema 132.', 'Payment proof, reconciliation matching, equipment scan verification, SEO asset smoke, and fallback drill queues are DB-visible.', 'Workflow depth remains only in Markdown.', 1, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_done_02', 'completed_this_pass', 2, 'admin', 'Loaded schema 132 queues in Admin readiness', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'admin-directory and admin-ui reference schema 132 views.', 'Operators can review the new proof/matching/scan/SEO/fallback queues.', 'Rows stay hidden from Admin.', 2, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_done_03', 'completed_this_pass', 3, 'seo', 'Added first static sitemap.xml and robots.txt assets', 'completed', 'medium', 'DEVELOPMENT_ROADMAP.md', '/', 'Files exist and smoke checks verify their presence.', 'Technical SEO moves from queue to shipped asset.', 'Search engines lack canonical crawl hints.', 3, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_done_04', 'completed_this_pass', 4, 'cleanup', 'Archived current Markdown and retired root test_write files', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', 'archive', 'Smoke archive hygiene passes and root test files are removed.', 'Root stays cleaner for deployment.', 'Temporary files keep drifting into builds.', 4, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_done_05', 'completed_this_pass', 5, 'cache', 'Updated cache marker to 2026-06-05b', 'completed', 'high', 'DEPLOYMENT_GUIDE.md', '/', 'index.html and service worker markers match.', 'Hard-refresh guidance points to the latest assets.', 'Old cache can mask repaired code.', 5, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_01', 'next_20', 1, 'accounting', 'Create real payment application tables and form actions from proof queue', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Apply/reverse/adjust/refund buttons write staged rows with proof requirements.', 'Payment application becomes operational.', 'Cash remains manually tracked.', 101, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_02', 'next_20', 2, 'accounting', 'Build bank CSV upload preview with accepted/rejected row staging', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'CSV preview validates headers, duplicate hashes, dates, signs, and row counts.', 'Bad import rows are stopped before reconciliation.', 'Bad bank data can enter.', 102, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_03', 'next_20', 3, 'accounting', 'Build reconciliation match workbench with split/undo/signoff', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Reviewer can accept matches, split rows, undo with reason, and sign the session.', 'Bank reconciliation gets usable workflow.', 'Unmatched rows stay manual.', 103, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_04', 'next_20', 4, 'equipment', 'Build camera scan helper with manual fallback and event source tracking', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Checkout/arrival/return forms can scan or enter code and record source.', 'Equipment movement becomes easier in the field.', 'Manual entry remains error-prone.', 104, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_05', 'next_20', 5, 'equipment', 'Build DB-backed accessory templates and return comparison', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Expected accessory templates load by equipment pool and compare on return.', 'Missing accessory cost/proof flow improves.', 'Accessory checks stay free-text.', 105, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_06', 'next_20', 6, 'equipment', 'Enforce return-to-service proof server-side', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Locked-out equipment cannot become available without service proof and verifier role.', 'Safety lockout becomes authoritative.', 'UI-only locks can be bypassed.', 106, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_07', 'next_20', 7, 'seo', 'Generate sitemap from approved route registry instead of static placeholder', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '/', 'sitemap.xml is generated from approved public route rows.', 'SEO assets stay aligned to real routes.', 'Static sitemap can drift.', 107, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_08', 'next_20', 8, 'seo', 'Add JSON-LD and image-alt smoke checks', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '/', 'Smoke flags invalid JSON-LD and missing/weak image alt text.', 'Public content quality improves.', 'SEO issues stay manual.', 108, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_09', 'next_20', 9, 'css', 'Add mobile overflow and component drift smoke checks', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '/', 'Smoke catches missing CSS blocks and obvious mobile overflow patterns.', 'CSS drift is caught earlier.', 'Mobile layout can regress.', 109, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_10', 'next_20', 10, 'fallback', 'Create fallback drill run-history table and UI', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Operators can mark fallback drills pass/fail with notes and evidence.', 'Fallbacks become testable.', 'Drills remain theoretical.', 110, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_11', 'next_20', 11, 'telemetry', 'Store runtime fallback telemetry signals', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Optional-view, cache-marker, offline-conflict, and accounting-block signals are summarized.', 'Troubleshooting gets faster.', 'Console-only failures remain hidden.', 111, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_12', 'next_20', 12, 'accounting', 'Build HST/GST source totals, adjustments, proof, filed/remitted signoff', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Tax filing screen shows source totals, proof, dates, and review status.', 'Tax review becomes auditable.', 'Tax support stays spreadsheet-based.', 112, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_13', 'next_20', 13, 'accounting', 'Build payroll remittance totals and proof signoff', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Payroll remittance screen shows deductions, employer costs, proof, and signoff.', 'Payroll remittance gets close workflow.', 'Payroll proof remains scattered.', 113, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_14', 'next_20', 14, 'accounting', 'Build month-end lock/reopen and accountant export package delivery', 'planned', 'high', 'DEPLOYMENT_GUIDE.md', '#admin', 'Close period lock, reopen reason, package manifest, and proof delivery work end-to-end.', 'Month-end close becomes controlled.', 'Posting can drift after close.', 114, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_15', 'next_20', 15, 'data', 'Promote repeated route, SEO, and action registry JSON into DB-backed review tables', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Repeated static config becomes editable/reviewable DB rows.', 'Duplication and stale JSON risk reduce.', 'Static config duplication remains.', 115, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_16', 'next_20', 16, 'mobile', 'Add offline conflict resolution choices to all mobile forms', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#today', 'Users can retry, keep local, or discard local drafts on conflict.', 'Field fallback becomes clearer.', 'Draft conflicts confuse users.', 116, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_17', 'next_20', 17, 'permissions', 'Tighten accounting and equipment verifier permissions in Edge Functions', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Server-side role gates match UI requirements for posting and return-to-service.', 'Permission enforcement becomes reliable.', 'UI-only restrictions can fail.', 117, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_18', 'next_20', 18, 'deployment', 'Add SQL migration compatibility linter for roadmap columns and status values', 'planned', 'medium', 'TESTING_CHECKLIST.md', 'scripts', 'Smoke detects legacy source_document/target_route_hint/completion_note and invalid status values.', 'SQL deploy errors are caught before Supabase.', 'Column drift can recur.', 118, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_19', 'next_20', 19, 'docs', 'Keep active Markdown and full schema reference synchronized every pass', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', 'docs', 'Roadmap, known gaps, changelog, project state, testing, deployment, and schema docs reference schema 132.', 'New chats start with correct context.', 'Docs drift again.', 119, '{"build":"2026-06-05b","schema":132}'::jsonb, now()),
  ('schema132_next_20', 'next_20', 20, 'testing', 'Add smoke checks for sitemap, robots, schema 132 views, Admin rendering, and cache marker', 'planned', 'medium', 'TESTING_CHECKLIST.md', 'scripts', 'Smoke reports schema 132 guardrails and assets before packaging.', 'Build quality gate stays current.', 'Packaging regressions slip through.', 120, '{"build":"2026-06-05b","schema":132}'::jsonb, now())
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

drop view if exists public.v_app_payment_posting_proof_queue;
create view public.v_app_payment_posting_proof_queue as
select proof_key, proof_area, proof_title, proof_status, required_role, source_row_hint, proof_requirement, posting_block_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_payment_posting_proof_queue
order by sort_order, proof_key;

drop view if exists public.v_app_reconciliation_match_workbench_queue;
create view public.v_app_reconciliation_match_workbench_queue as
select workbench_key, match_area, workbench_title, workbench_status, import_rule_hint, match_score_hint, manual_review_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_reconciliation_match_workbench_queue
order by sort_order, workbench_key;

drop view if exists public.v_app_equipment_scan_verification_queue;
create view public.v_app_equipment_scan_verification_queue as
select verification_key, equipment_area, verification_title, verification_status, scan_path_hint, role_gate_hint, evidence_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_equipment_scan_verification_queue
order by sort_order, verification_key;

drop view if exists public.v_app_local_seo_asset_smoke_queue;
create view public.v_app_local_seo_asset_smoke_queue as
select smoke_key, seo_area, smoke_title, smoke_status, asset_path_hint, local_relevance_hint, validation_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_local_seo_asset_smoke_queue
order by sort_order, smoke_key;

drop view if exists public.v_app_runtime_fallback_drill_history_queue;
create view public.v_app_runtime_fallback_drill_history_queue as
select drill_key, app_surface, drill_title, drill_status, trigger_hint, expected_result_hint, evidence_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_runtime_fallback_drill_history_queue
order by sort_order, drill_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  132::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 132
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 132
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 132.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (
  132,
  '132_payment_recon_equipment_seo_fallback_telemetry_drill_history',
  '132_payment_recon_equipment_seo_fallback_telemetry_drill_history.sql',
  '2026-06-05b',
  'Adds Admin-visible proof, reconciliation, equipment scan verification, local SEO asset smoke, and fallback drill-history queues.',
  'applied',
  'This pass ships first static sitemap/robots assets, keeps one-H1/local SEO guardrails, and moves accounting/equipment/fallback items toward operator workflows.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_payment_posting_proof_queue to authenticated;
grant select on public.app_reconciliation_match_workbench_queue to authenticated;
grant select on public.app_equipment_scan_verification_queue to authenticated;
grant select on public.app_local_seo_asset_smoke_queue to authenticated;
grant select on public.app_runtime_fallback_drill_history_queue to authenticated;
grant select on public.v_app_payment_posting_proof_queue to authenticated;
grant select on public.v_app_reconciliation_match_workbench_queue to authenticated;
grant select on public.v_app_equipment_scan_verification_queue to authenticated;
grant select on public.v_app_local_seo_asset_smoke_queue to authenticated;
grant select on public.v_app_runtime_fallback_drill_history_queue to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
