-- Schema 133: payment write-path staging, reconciliation scoring, equipment accessory templates, SEO generation, and offline conflict controls.
-- Build 2026-06-05c.
-- This pass turns schema 132 queues into more concrete execution registries while preserving local SEO, one-H1, CSS, fallback, and documentation guardrails.

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

create table if not exists public.app_roadmap_action_steps (
  step_key text primary key,
  step_batch text not null,
  step_number integer not null,
  step_area text not null,
  step_title text not null,
  step_status text not null default 'planned',
  priority text not null default 'medium',
  source_doc text,
  route_hint text,
  implementation_notes text,
  acceptance_check text,
  risk_if_skipped text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_roadmap_action_steps add column if not exists source_doc text;
alter table public.app_roadmap_action_steps add column if not exists route_hint text;
alter table public.app_roadmap_action_steps add column if not exists implementation_notes text;
alter table public.app_roadmap_action_steps add column if not exists acceptance_check text;
alter table public.app_roadmap_action_steps add column if not exists risk_if_skipped text;
alter table public.app_roadmap_action_steps add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_roadmap_action_steps add column if not exists checked_at timestamptz;
alter table public.app_roadmap_action_steps add column if not exists updated_at timestamptz not null default now();

alter table public.app_roadmap_action_steps drop constraint if exists app_roadmap_action_steps_step_batch_check;
alter table public.app_roadmap_action_steps add constraint app_roadmap_action_steps_step_batch_check check (step_batch in ('completed_this_pass', 'next_20'));
alter table public.app_roadmap_action_steps drop constraint if exists app_roadmap_action_steps_step_status_check;
alter table public.app_roadmap_action_steps add constraint app_roadmap_action_steps_step_status_check check (step_status in ('completed', 'in_progress', 'planned', 'blocked', 'review'));

create table if not exists public.app_payment_write_path_queue (
  write_key text primary key,
  write_area text not null,
  write_title text not null,
  write_status text not null default 'planned',
  required_role text not null default 'admin',
  source_rows_hint text,
  validation_hint text,
  posting_proof_hint text,
  rollback_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_reconciliation_scoring_rule_queue (
  rule_key text primary key,
  rule_area text not null,
  rule_title text not null,
  rule_status text not null default 'planned',
  score_hint text,
  match_input_hint text,
  reviewer_action_hint text,
  undo_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_equipment_accessory_template_queue (
  template_key text primary key,
  equipment_pool_hint text not null,
  template_title text not null,
  template_status text not null default 'planned',
  expected_items_hint text,
  checkout_compare_hint text,
  return_compare_hint text,
  exception_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_local_seo_generation_queue (
  generation_key text primary key,
  seo_area text not null,
  generation_title text not null,
  generation_status text not null default 'planned',
  source_registry_hint text,
  output_asset_hint text,
  local_relevance_hint text,
  validation_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_mobile_offline_conflict_resolution_queue (
  conflict_key text primary key,
  form_area text not null,
  conflict_title text not null,
  conflict_status text not null default 'planned',
  detection_hint text,
  user_choice_hint text,
  retry_hint text,
  data_safety_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_payment_write_path_queue (write_key, write_area, write_title, write_status, required_role, source_rows_hint, validation_hint, posting_proof_hint, rollback_hint, fallback_hint, sort_order, metadata, checked_at)
values
  ('payment_apply_staging', 'payment_application', 'Create staged payment application write path', 'planned', 'admin', 'Invoices, deposits, unapplied payments, customer account rows.', 'Amount cannot exceed available cash or invoice balance unless overpayment is selected.', 'Reviewer, note, source reference, and timestamp are required before posting.', 'Reverse creates a linked reversal row instead of deleting history.', 'Keep payment visible in manual review queue until staged apply exists.', 10, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('payment_adjustment_write_path', 'payment_adjustment', 'Write credit, discount, refund, write-off, and overpayment decisions with proof', 'planned', 'admin', 'Adjustment reason, customer, job/invoice, source payment, proof upload.', 'Requires reason code and accounting effect before posting.', 'Proof package should link to close period and export manifest.', 'Adjustment reversal requires reviewer reason.', 'Use notes-only adjustment registry until write tables are live.', 20, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('job_profitability_payment_link', 'job_profitability', 'Link payment and cost events back to job profitability', 'planned', 'admin', 'Job financial events, equipment service tasks, invoice/payment rows.', 'Costs and collected cash should be separately tracked.', 'Profitability row shows estimated vs actual margin and evidence status.', 'Corrections create adjustment entries.', 'Show raw source rows if rollup is unavailable.', 30, '{"build":"2026-06-05c","schema":133}'::jsonb, now())
on conflict (write_key) do update set write_area = excluded.write_area, write_title = excluded.write_title, write_status = excluded.write_status, required_role = excluded.required_role, source_rows_hint = excluded.source_rows_hint, validation_hint = excluded.validation_hint, posting_proof_hint = excluded.posting_proof_hint, rollback_hint = excluded.rollback_hint, fallback_hint = excluded.fallback_hint, sort_order = excluded.sort_order, metadata = excluded.metadata, checked_at = excluded.checked_at, updated_at = now();

insert into public.app_reconciliation_scoring_rule_queue (rule_key, rule_area, rule_title, rule_status, score_hint, match_input_hint, reviewer_action_hint, undo_hint, fallback_hint, sort_order, metadata, checked_at)
values
  ('exact_reference_amount_date', 'match_scoring', 'Score exact reference, amount, and near-date matches highest', 'planned', 'Reference + amount + date window should score as strong match.', 'Bank CSV row, payment reference, invoice number, amount, transaction date.', 'Reviewer can accept, split, or reject the suggested match.', 'Undo restores all linked rows to unmatched.', 'Manual match remains fallback.', 10, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('split_deposit_grouping', 'split_matching', 'Support one bank deposit matched to multiple invoices/payments', 'planned', 'Grouped rows total must equal bank row within tolerance.', 'Bank deposit row and selected payment/application rows.', 'Reviewer signs split allocation with note.', 'Undo removes group and restores individual unmatched rows.', 'Keep deposit in review queue if total does not match.', 20, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('unmatched_age_escalation', 'review_queue', 'Escalate unmatched bank rows by age and amount', 'planned', 'Older or larger unmatched rows get higher priority.', 'CSV staging rows and unmatched review status.', 'Reviewer can defer with reason or create manual transaction.', 'Undo defer reopens the row.', 'Export unmatched list for accountant.', 30, '{"build":"2026-06-05c","schema":133}'::jsonb, now())
on conflict (rule_key) do update set rule_area = excluded.rule_area, rule_title = excluded.rule_title, rule_status = excluded.rule_status, score_hint = excluded.score_hint, match_input_hint = excluded.match_input_hint, reviewer_action_hint = excluded.reviewer_action_hint, undo_hint = excluded.undo_hint, fallback_hint = excluded.fallback_hint, sort_order = excluded.sort_order, metadata = excluded.metadata, checked_at = excluded.checked_at, updated_at = now();

insert into public.app_equipment_accessory_template_queue (template_key, equipment_pool_hint, template_title, template_status, expected_items_hint, checkout_compare_hint, return_compare_hint, exception_hint, fallback_hint, sort_order, metadata, checked_at)
values
  ('pool_template_small_power_tools', 'small_power_tools', 'Accessory template for batteries, chargers, guards, and cases', 'planned', 'Battery count, charger, blade/guard, case, manual/safety card.', 'Checkout compares expected accessories with signed release list.', 'Return compares expected vs returned and opens exception for missing/damaged items.', 'Missing accessory keeps equipment pending review.', 'Free-text accessory checklist remains fallback.', 10, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('pool_template_lawn_equipment', 'lawn_equipment', 'Accessory template for fuel, guard, line/blade, PPE cue, and cleaning tools', 'planned', 'Fuel level, guard, trimmer line/blade, PPE cue, cleaning brush/wrench.', 'Checkout requires site-safe condition and accessory confirmation.', 'Return requires condition, cleaning, and accessory status.', 'Failed return creates service task and lockout.', 'Manual return notes remain fallback.', 20, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('pool_template_measurement_safety', 'measurement_safety', 'Accessory template for measuring, signage, SDS, and safety kits', 'planned', 'Tape/measure tools, sign kit, SDS card, first aid cue, traffic cone count.', 'Checkout confirms kit completeness before site release.', 'Return confirms kit completeness and replaces missing consumables.', 'Missing safety accessory triggers supervisor review.', 'Supervisor checklist remains fallback.', 30, '{"build":"2026-06-05c","schema":133}'::jsonb, now())
on conflict (template_key) do update set equipment_pool_hint = excluded.equipment_pool_hint, template_title = excluded.template_title, template_status = excluded.template_status, expected_items_hint = excluded.expected_items_hint, checkout_compare_hint = excluded.checkout_compare_hint, return_compare_hint = excluded.return_compare_hint, exception_hint = excluded.exception_hint, fallback_hint = excluded.fallback_hint, sort_order = excluded.sort_order, metadata = excluded.metadata, checked_at = excluded.checked_at, updated_at = now();

insert into public.app_local_seo_generation_queue (generation_key, seo_area, generation_title, generation_status, source_registry_hint, output_asset_hint, local_relevance_hint, validation_hint, fallback_hint, sort_order, metadata, checked_at)
values
  ('generate_sitemap_from_routes', 'technical_seo', 'Generate sitemap from approved public route registry', 'in_progress', 'v_app_public_route_seo_registry approved/published rows.', 'sitemap.xml', 'Only include real service/location pages that the business supports.', 'Smoke confirms urlset, route count, and no blocked routes.', 'Static sitemap remains fallback.', 10, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('generate_robots_from_settings', 'technical_seo', 'Generate robots.txt with sitemap pointer and admin disallow rules', 'in_progress', 'Public route and deployment settings.', 'robots.txt', 'Do not expose internal admin paths.', 'Smoke confirms Sitemap line and Disallow for admin/internal paths.', 'Static robots.txt remains fallback.', 20, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('jsonld_local_business_gate', 'structured_data', 'Add JSON-LD local business/service validation before publish', 'planned', 'Business identity, service area, contact, approved service rows.', 'public JSON-LD block', 'Avoid unsupported location or service claims.', 'Smoke parses JSON-LD and checks required fields.', 'Title/meta remain fallback until JSON-LD is ready.', 30, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('image_alt_local_proof_gate', 'image_alt', 'Validate image alt text and local proof captions', 'planned', 'Image registry, captions, route context, evidence/proof flags.', 'public gallery/card images', 'Alt text describes the actual image and local context truthfully.', 'Smoke flags missing or weak alt text.', 'Hide weak public image blocks until reviewed.', 40, '{"build":"2026-06-05c","schema":133}'::jsonb, now())
on conflict (generation_key) do update set seo_area = excluded.seo_area, generation_title = excluded.generation_title, generation_status = excluded.generation_status, source_registry_hint = excluded.source_registry_hint, output_asset_hint = excluded.output_asset_hint, local_relevance_hint = excluded.local_relevance_hint, validation_hint = excluded.validation_hint, fallback_hint = excluded.fallback_hint, sort_order = excluded.sort_order, metadata = excluded.metadata, checked_at = excluded.checked_at, updated_at = now();

insert into public.app_mobile_offline_conflict_resolution_queue (conflict_key, form_area, conflict_title, conflict_status, detection_hint, user_choice_hint, retry_hint, data_safety_hint, fallback_hint, sort_order, metadata, checked_at)
values
  ('offline_draft_conflict_choices', 'mobile_forms', 'Offer retry, keep local, or discard local when a draft conflicts', 'planned', 'Server updated_at or version marker differs from local draft marker.', 'Show three clear choices with the affected form name.', 'Retry only the failed payload and keep local data until success.', 'Never delete local draft until the user chooses or server confirms save.', 'Current draft resume remains fallback.', 10, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('offline_attachment_retry_queue', 'attachments', 'Keep failed photos/proof attachments in retry queue with clear status', 'planned', 'Upload failure, missing public URL, or network timeout.', 'Show Retry Upload and Remove Local Copy after warning.', 'Retry with same metadata and show final success/fail.', 'Keep local metadata and filename until acknowledged.', 'Evidence Manager failed-upload rows remain fallback.', 20, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('offline_equipment_scan_resolution', 'equipment_mobile', 'Resolve equipment scan/manual code mismatch before checkout or return', 'planned', 'Scanned QR/barcode does not match selected equipment row.', 'User must confirm scanned item or re-enter code.', 'Retry lookup after network returns.', 'Do not post checkout/return against mismatched equipment.', 'Manual code entry remains fallback.', 30, '{"build":"2026-06-05c","schema":133}'::jsonb, now())
on conflict (conflict_key) do update set form_area = excluded.form_area, conflict_title = excluded.conflict_title, conflict_status = excluded.conflict_status, detection_hint = excluded.detection_hint, user_choice_hint = excluded.user_choice_hint, retry_hint = excluded.retry_hint, data_safety_hint = excluded.data_safety_hint, fallback_hint = excluded.fallback_hint, sort_order = excluded.sort_order, metadata = excluded.metadata, checked_at = excluded.checked_at, updated_at = now();

insert into public.app_roadmap_action_steps (step_key, step_batch, step_number, step_area, step_title, step_status, priority, source_doc, route_hint, acceptance_check, implementation_notes, risk_if_skipped, sort_order, metadata, checked_at)
values
  ('schema133_done_01', 'completed_this_pass', 1, 'schema', 'Added schema 133 execution registries', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Migration and full schema include schema 133.', 'Added DB-visible queues for payment write paths, reconciliation scoring, accessory templates, local SEO generation, and offline conflict handling.', 'Roadmap remains disconnected from deployable schema.', 1, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_done_02', 'completed_this_pass', 2, 'admin', 'Loaded schema 133 queues through Admin directory', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'admin-directory safeList includes all schema 133 views.', 'New queues are visible to Admin readiness when schema is applied.', 'Operators cannot see the latest execution queues.', 2, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_done_03', 'completed_this_pass', 3, 'ui', 'Rendered schema 133 queues in Admin readiness', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Admin UI includes table bodies and render handlers for schema 133 rows.', 'Admin can review next execution depth without opening SQL.', 'New DB rows remain hidden.', 3, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_done_04', 'completed_this_pass', 4, 'seo', 'Updated static sitemap and robots assets for schema 133', 'completed', 'medium', 'TESTING_CHECKLIST.md', '/', 'Smoke confirms sitemap and robots remain present.', 'SEO fallback files remain deployable while generator is planned.', 'Search discovery assets can drift.', 4, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_done_05', 'completed_this_pass', 5, 'docs', 'Updated active Markdown and schema documentation', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', 'docs', 'Roadmap, known gaps, changelog, project state, testing, deployment, and docs mention schema 133.', 'New chats and future passes have current context.', 'Documentation drifts from build.', 5, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_done_06', 'completed_this_pass', 6, 'testing', 'Updated smoke checks to expect schema 133', 'completed', 'high', 'TESTING_CHECKLIST.md', 'scripts', 'repo-smoke-check validates schema 133 markers and Admin rendering.', 'Packaging catches schema/admin drift.', 'Smoke checks lag behind build.', 6, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_done_07', 'completed_this_pass', 7, 'cleanup', 'Archived current Markdown and retired test_write files', 'completed', 'medium', 'CHANGELOG.md', 'archive', 'Archive snapshots exist and root test_write files are not active.', 'Root stays clean for deployment.', 'Smoke and packaging hygiene can fail.', 7, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_done_08', 'completed_this_pass', 8, 'cache', 'Updated cache marker to 2026-06-05c', 'completed', 'medium', 'DEPLOYMENT_GUIDE.md', '/', 'index and service worker asset versions match.', 'Browser refresh behavior is predictable.', 'Old assets can mask repairs.', 8, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_done_09', 'completed_this_pass', 9, 'css', 'Preserved CSS brace and mobile table guardrails', 'completed', 'medium', 'TESTING_CHECKLIST.md', 'style.css', 'CSS brace balance remains clean and Admin tables use scroll containers.', 'CSS drift remains controlled.', 'Mobile table overflow can regress.', 9, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_done_10', 'completed_this_pass', 10, 'h1', 'Preserved one public H1 rule', 'completed', 'medium', 'TESTING_CHECKLIST.md', '/', 'Smoke confirms index.html has no more than one H1.', 'Public title clarity remains protected.', 'Search/title clarity can degrade.', 10, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_01', 'next_20', 1, 'payment', 'Create payment application base tables and Edge write action', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Admin can stage and apply payment rows with proof.', 'Cash application begins to work end-to-end.', 'Payment workflow remains registry-only.', 101, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_02', 'next_20', 2, 'payment', 'Create payment reversal, credit, refund, write-off, and overpayment actions', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Adjustment actions require reason, proof, reviewer, and rollback trail.', 'Accounting adjustments become auditable.', 'Adjustments stay manual.', 102, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_03', 'next_20', 3, 'reconciliation', 'Create bank CSV upload preview and staging write path', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'CSV import stores accepted/rejected rows with reasons.', 'Bank import becomes safe and reviewable.', 'Spreadsheet import remains manual.', 103, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_04', 'next_20', 4, 'reconciliation', 'Create reconciliation score rows and manual match/split/undo UI', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Reviewer can accept, split, undo, and sign off matches.', 'Bank reconciliation becomes operational.', 'Unmatched rows remain hard to process.', 104, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_05', 'next_20', 5, 'equipment', 'Create DB accessory template tables and editor', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Templates attach to equipment pools and populate checkout/return checklists.', 'Accessory accountability becomes consistent.', 'Accessory checks remain free text.', 105, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_06', 'next_20', 6, 'equipment', 'Add BarcodeDetector camera scan with manual fallback and mismatch handling', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Camera scanning works where supported and manual fallback stays clear.', 'Field equipment flow gets faster.', 'Manual code lookup stays slow.', 106, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_07', 'next_20', 7, 'equipment', 'Enforce return-to-service proof and verifier role server-side', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Locked-out equipment cannot become available without proof and required role.', 'Equipment safety accountability tightens.', 'UI-only restrictions can be bypassed.', 107, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_08', 'next_20', 8, 'equipment', 'Roll equipment service costs into job profitability', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Service-task costs appear in job financial events and margin views.', 'Job profitability is more accurate.', 'Repair costs remain disconnected.', 108, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_09', 'next_20', 9, 'seo', 'Generate sitemap and robots from approved DB route registry', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '/', 'Generated assets match approved public routes.', 'Local discovery assets stay current.', 'Static assets can drift.', 109, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_10', 'next_20', 10, 'seo', 'Add JSON-LD, image-alt, broken-link, and local-proof smoke checks', 'planned', 'medium', 'TESTING_CHECKLIST.md', '/', 'Smoke flags invalid structured data, weak alt text, broken links, and unsupported local wording.', 'Public SEO quality improves.', 'SEO issues remain manual.', 110, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_11', 'next_20', 11, 'mobile', 'Add offline conflict resolution choices to mobile forms', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#today', 'Forms show retry, keep local, and discard local choices on conflict.', 'Field users can recover safely.', 'Draft conflict risk remains.', 111, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_12', 'next_20', 12, 'fallback', 'Create fallback drill result write UI', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Operators can record pass/fail drill results with notes.', 'Fallbacks become testable instead of theoretical.', 'Drill history remains read-only.', 112, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_13', 'next_20', 13, 'telemetry', 'Store runtime fallback telemetry counts', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Optional-view, stale-cache, offline-conflict, upload-failure, and accounting-block counts appear in Admin.', 'Troubleshooting gets faster.', 'Failures remain console-only.', 113, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_14', 'next_20', 14, 'tax', 'Build HST/GST source totals, proof, filed, and remitted screens', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Tax review has source totals, proof upload, filed/remitted dates, and lock status.', 'Tax review becomes auditable.', 'Tax remains spreadsheet-based.', 114, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_15', 'next_20', 15, 'payroll', 'Build payroll remittance proof and signoff screens', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Payroll source totals and proof signoff are visible.', 'Payroll close support improves.', 'Payroll proof remains scattered.', 115, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_16', 'next_20', 16, 'close', 'Build month-end close lock/reopen and accountant export delivery', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Close period blocks postings and export package has manifest/proofs.', 'Month-end close becomes controlled.', 'Posting can drift after close.', 116, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_17', 'next_20', 17, 'data', 'Promote repeated JSON route/action config into DB registries', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Duplicate route/action lists become DB-backed where they need review status.', 'Duplication risk decreases.', 'Static JSON drift continues.', 117, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_18', 'next_20', 18, 'css', 'Add component drift and mobile overflow smoke checks', 'planned', 'medium', 'TESTING_CHECKLIST.md', 'style.css', 'Smoke catches missing critical CSS blocks and obvious mobile overflow risks.', 'Mobile CSS drift is caught earlier.', 'Visual drift can recur.', 118, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_19', 'next_20', 19, 'deployment', 'Add SQL compatibility linter for roadmap/status column drift', 'planned', 'medium', 'TESTING_CHECKLIST.md', 'scripts', 'Smoke catches legacy source_document/target_route_hint/completion_note and invalid status values.', 'Migration errors are caught earlier.', 'Column drift can recur.', 119, '{"build":"2026-06-05c","schema":133}'::jsonb, now()),
  ('schema133_next_20', 'next_20', 20, 'docs', 'Keep all active Markdown, schema, cache, and smoke checks synchronized each pass', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', 'docs', 'Docs and SQL reference schema 133 and next 20.', 'Future work starts from correct context.', 'Build context drifts.', 120, '{"build":"2026-06-05c","schema":133}'::jsonb, now())
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

drop view if exists public.v_app_payment_write_path_queue;
create view public.v_app_payment_write_path_queue as
select write_key, write_area, write_title, write_status, required_role, source_rows_hint, validation_hint, posting_proof_hint, rollback_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_payment_write_path_queue
order by sort_order, write_key;

drop view if exists public.v_app_reconciliation_scoring_rule_queue;
create view public.v_app_reconciliation_scoring_rule_queue as
select rule_key, rule_area, rule_title, rule_status, score_hint, match_input_hint, reviewer_action_hint, undo_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_reconciliation_scoring_rule_queue
order by sort_order, rule_key;

drop view if exists public.v_app_equipment_accessory_template_queue;
create view public.v_app_equipment_accessory_template_queue as
select template_key, equipment_pool_hint, template_title, template_status, expected_items_hint, checkout_compare_hint, return_compare_hint, exception_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_equipment_accessory_template_queue
order by sort_order, template_key;

drop view if exists public.v_app_local_seo_generation_queue;
create view public.v_app_local_seo_generation_queue as
select generation_key, seo_area, generation_title, generation_status, source_registry_hint, output_asset_hint, local_relevance_hint, validation_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_local_seo_generation_queue
order by sort_order, generation_key;

drop view if exists public.v_app_mobile_offline_conflict_resolution_queue;
create view public.v_app_mobile_offline_conflict_resolution_queue as
select conflict_key, form_area, conflict_title, conflict_status, detection_hint, user_choice_hint, retry_hint, data_safety_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_mobile_offline_conflict_resolution_queue
order by sort_order, conflict_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  133::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 133 then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 133 then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 133.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (
  133,
  '133_payment_recon_equipment_seo_offline_execution_controls',
  '133_payment_recon_equipment_seo_offline_execution_controls.sql',
  '2026-06-05c',
  'Adds Admin-visible execution registries for payment write paths, reconciliation scoring, equipment accessory templates, local SEO asset generation, and mobile offline conflict handling.',
  'applied',
  'This pass keeps schema/docs/cache/smoke guardrails aligned while preparing the next write-path workflows.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_payment_write_path_queue to authenticated;
grant select on public.app_reconciliation_scoring_rule_queue to authenticated;
grant select on public.app_equipment_accessory_template_queue to authenticated;
grant select on public.app_local_seo_generation_queue to authenticated;
grant select on public.app_mobile_offline_conflict_resolution_queue to authenticated;
grant select on public.v_app_payment_write_path_queue to authenticated;
grant select on public.v_app_reconciliation_scoring_rule_queue to authenticated;
grant select on public.v_app_equipment_accessory_template_queue to authenticated;
grant select on public.v_app_local_seo_generation_queue to authenticated;
grant select on public.v_app_mobile_offline_conflict_resolution_queue to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
