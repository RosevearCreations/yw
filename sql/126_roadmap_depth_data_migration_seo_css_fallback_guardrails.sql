-- Schema 126: Roadmap depth, data-migration, SEO/CSS, and fallback guardrails.
-- Adds DB-visible tracking for this pass's completed 20 steps, the next 20 planned steps,
-- duplicated-data migration decisions, documentation/schema sync checks, and CSS/SEO/fallback sanity.

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

alter table public.app_roadmap_action_steps add column if not exists step_batch text;
alter table public.app_roadmap_action_steps add column if not exists step_number integer;
alter table public.app_roadmap_action_steps add column if not exists step_area text;
alter table public.app_roadmap_action_steps add column if not exists step_title text;
alter table public.app_roadmap_action_steps add column if not exists step_status text not null default 'planned';
alter table public.app_roadmap_action_steps add column if not exists priority text not null default 'medium';
alter table public.app_roadmap_action_steps add column if not exists source_doc text;
alter table public.app_roadmap_action_steps add column if not exists route_hint text;
alter table public.app_roadmap_action_steps add column if not exists implementation_notes text;
alter table public.app_roadmap_action_steps add column if not exists acceptance_check text;
alter table public.app_roadmap_action_steps add column if not exists risk_if_skipped text;
alter table public.app_roadmap_action_steps add column if not exists sort_order integer not null default 100;
alter table public.app_roadmap_action_steps add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_roadmap_action_steps add column if not exists checked_at timestamptz;
alter table public.app_roadmap_action_steps add column if not exists updated_at timestamptz not null default now();

alter table public.app_roadmap_action_steps drop constraint if exists app_roadmap_action_steps_step_batch_check;
alter table public.app_roadmap_action_steps add constraint app_roadmap_action_steps_step_batch_check
  check (step_batch in ('completed_this_pass','next_20'));

alter table public.app_roadmap_action_steps drop constraint if exists app_roadmap_action_steps_step_status_check;
alter table public.app_roadmap_action_steps add constraint app_roadmap_action_steps_step_status_check
  check (step_status in ('completed','in_progress','planned','blocked','review'));

create table if not exists public.app_depth_review_queue (
  review_key text primary key,
  review_area text not null,
  review_title text not null,
  current_depth text,
  recommended_depth text,
  review_status text not null default 'review',
  cost_linkage_hint text,
  accounting_impact text,
  route_hint text,
  acceptance_check text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_depth_review_queue add column if not exists review_area text;
alter table public.app_depth_review_queue add column if not exists review_title text;
alter table public.app_depth_review_queue add column if not exists current_depth text;
alter table public.app_depth_review_queue add column if not exists recommended_depth text;
alter table public.app_depth_review_queue add column if not exists review_status text not null default 'review';
alter table public.app_depth_review_queue add column if not exists cost_linkage_hint text;
alter table public.app_depth_review_queue add column if not exists accounting_impact text;
alter table public.app_depth_review_queue add column if not exists route_hint text;
alter table public.app_depth_review_queue add column if not exists acceptance_check text;
alter table public.app_depth_review_queue add column if not exists sort_order integer not null default 100;
alter table public.app_depth_review_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_depth_review_queue add column if not exists checked_at timestamptz;
alter table public.app_depth_review_queue add column if not exists updated_at timestamptz not null default now();

alter table public.app_depth_review_queue drop constraint if exists app_depth_review_queue_review_status_check;
alter table public.app_depth_review_queue add constraint app_depth_review_queue_review_status_check
  check (review_status in ('passed','review','planned','blocked','in_progress'));

create table if not exists public.app_data_migration_candidates (
  candidate_key text primary key,
  data_area text not null,
  source_location text not null,
  recommended_target text not null,
  duplication_risk text not null default 'medium',
  migration_status text not null default 'review',
  reason text,
  fallback_plan text,
  acceptance_check text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_data_migration_candidates add column if not exists data_area text;
alter table public.app_data_migration_candidates add column if not exists source_location text;
alter table public.app_data_migration_candidates add column if not exists recommended_target text;
alter table public.app_data_migration_candidates add column if not exists duplication_risk text not null default 'medium';
alter table public.app_data_migration_candidates add column if not exists migration_status text not null default 'review';
alter table public.app_data_migration_candidates add column if not exists reason text;
alter table public.app_data_migration_candidates add column if not exists fallback_plan text;
alter table public.app_data_migration_candidates add column if not exists acceptance_check text;
alter table public.app_data_migration_candidates add column if not exists sort_order integer not null default 100;
alter table public.app_data_migration_candidates add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_data_migration_candidates add column if not exists checked_at timestamptz;
alter table public.app_data_migration_candidates add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_schema_documentation_sync_checks (
  check_key text primary key,
  check_area text not null,
  check_title text not null,
  expected_status text not null default 'required',
  current_status text not null default 'pending',
  file_path text,
  test_command text,
  failure_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_schema_documentation_sync_checks add column if not exists check_area text;
alter table public.app_schema_documentation_sync_checks add column if not exists check_title text;
alter table public.app_schema_documentation_sync_checks add column if not exists expected_status text not null default 'required';
alter table public.app_schema_documentation_sync_checks add column if not exists current_status text not null default 'pending';
alter table public.app_schema_documentation_sync_checks add column if not exists file_path text;
alter table public.app_schema_documentation_sync_checks add column if not exists test_command text;
alter table public.app_schema_documentation_sync_checks add column if not exists failure_hint text;
alter table public.app_schema_documentation_sync_checks add column if not exists sort_order integer not null default 100;
alter table public.app_schema_documentation_sync_checks add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_schema_documentation_sync_checks add column if not exists checked_at timestamptz;
alter table public.app_schema_documentation_sync_checks add column if not exists updated_at timestamptz not null default now();

insert into public.app_roadmap_action_steps (
  step_key, step_batch, step_number, step_area, step_title, step_status, priority,
  source_doc, route_hint, implementation_notes, acceptance_check, risk_if_skipped,
  sort_order, metadata, checked_at
)
values
  ('schema126_01_archive_snapshots', 'completed_this_pass', 1, 'documentation', 'Create Markdown archive snapshots for current and legacy build checks', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', 'repo/archive', 'Added archive snapshot folders so smoke checks prove active docs were preserved before editing.', 'Archive contains README.md for required snapshot folders.', 'Future edits could lose the previous project state.', 1, '{"build":"2026-06-02a"}'::jsonb, now()),
  ('schema126_02_remove_test_files', 'completed_this_pass', 2, 'repo hygiene', 'Retire temporary test_write files from the active root', 'completed', 'high', 'KNOWN_ISSUES_AND_GAPS.md', 'repo root', 'Moved temporary test_write files to archive/retired-test-files-2026-06-02a.', 'Root no longer contains test_write files.', 'Smoke checks fail and repo root stays confusing.', 2, '{}'::jsonb, now()),
  ('schema126_03_schema_marker', 'completed_this_pass', 3, 'schema', 'Add schema 126 migration and drift marker', 'completed', 'high', 'DATABASE_STRUCTURE.md', 'Schema Drift', 'Added this migration and updated the canonical schema reference.', 'v_schema_drift_status expects schema 126.', 'Live database may appear current when it is behind.', 3, '{}'::jsonb, now()),
  ('schema126_04_roadmap_db_rows', 'completed_this_pass', 4, 'roadmap', 'Store completed and next roadmap steps in DB-visible rows', 'completed', 'medium', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Added app_roadmap_action_steps and v_app_roadmap_action_steps.', 'Admin/readiness data can show current and next steps.', 'Roadmap only lives in Markdown and is easy to drift.', 4, '{}'::jsonb, now()),
  ('schema126_05_depth_review_queue', 'completed_this_pass', 5, 'sanity check', 'Add application-depth review queue', 'completed', 'high', 'KNOWN_ISSUES_AND_GAPS.md', '#admin', 'Added app_depth_review_queue for accounting, equipment, SEO, mobile, and fallback depth gaps.', 'Depth gaps are queryable by area and status.', 'Large app gaps stay hidden in prose.', 5, '{}'::jsonb, now()),
  ('schema126_06_data_migration_tracker', 'completed_this_pass', 6, 'data migration', 'Add JSON/DB duplication migration candidate tracker', 'completed', 'high', 'DATABASE_STRUCTURE.md', '#admin', 'Added app_data_migration_candidates so repeated data sources have a reviewed target and fallback plan.', 'High-risk duplication areas are visible in v_app_data_migration_candidates.', 'Data can drift between JSON, DB, and local cache.', 6, '{}'::jsonb, now()),
  ('schema126_07_doc_sync_checks', 'completed_this_pass', 7, 'documentation', 'Add schema/documentation sync checks', 'completed', 'medium', 'TESTING_CHECKLIST.md', '#admin', 'Added app_schema_documentation_sync_checks for SQL, Markdown, smoke, cache, and service-worker sync.', 'Sync checks are visible in v_app_schema_documentation_sync_checks.', 'Docs can claim a build state the app does not match.', 7, '{}'::jsonb, now()),
  ('schema126_08_admin_edge_loads', 'completed_this_pass', 8, 'admin ui', 'Load deployment/SEO/fallback/roadmap/depth views in admin-directory', 'completed', 'high', 'SYSTEM_ARCHITECTURE.md', '#admin', 'admin-directory now returns the schema 125 and 126 guardrail views on command_center and health scopes.', 'Admin payload includes new guardrail arrays.', 'New DB checks exist but are not visible to operators.', 8, '{}'::jsonb, now()),
  ('schema126_09_admin_ui_tables', 'completed_this_pass', 9, 'admin ui', 'Render new guardrail tables in Production Readiness', 'completed', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin', 'Admin UI now renders build guardrails, SEO guardrails, fallback guardrails, roadmap steps, and depth review rows.', 'Readiness section has visible tables for new checks.', 'Operators must inspect DB manually.', 9, '{}'::jsonb, now()),
  ('schema126_10_cache_marker', 'completed_this_pass', 10, 'pwa', 'Update public cache marker to 2026-06-02a', 'completed', 'medium', 'DEPLOYMENT_GUIDE.md', 'index.html / service worker', 'Updated index.html query strings and service-worker cache name.', 'Smoke confirms 2026-06-02a marker.', 'Browsers may keep stale repaired code.', 10, '{}'::jsonb, now()),
  ('schema126_11_edge_parse', 'completed_this_pass', 11, 'deployment', 'Keep Edge Function TypeScript parse checks in smoke testing', 'completed', 'high', 'TESTING_CHECKLIST.md', 'Supabase Functions', 'Smoke script continues parsing Edge Function index.ts files before packaging.', 'node scripts/repo-smoke-check.mjs passes Edge Function parse check.', 'Deploy failures are discovered only in Supabase.', 11, '{}'::jsonb, now()),
  ('schema126_12_css_brace', 'completed_this_pass', 12, 'css', 'Keep CSS brace-balance check active', 'completed', 'medium', 'TESTING_CHECKLIST.md', 'style.css', 'Smoke script checks style.css brace balance.', 'CSS brace balance equals zero.', 'CSS drift can silently break mobile layouts.', 12, '{}'::jsonb, now()),
  ('schema126_13_h1_guard', 'completed_this_pass', 13, 'seo', 'Keep single H1 public-page guard active', 'completed', 'high', 'SEO_PUBLIC_PAGE_RULES.md', 'index.html', 'Smoke script confirms index.html has no more than one H1.', 'H1 count is one or less.', 'Search title clarity and accessibility can drift.', 13, '{}'::jsonb, now()),
  ('schema126_14_local_wording', 'completed_this_pass', 14, 'seo', 'Refresh local search wording guidance in docs', 'completed', 'medium', 'SEO_PUBLIC_PAGE_RULES.md', 'public pages', 'Docs continue emphasizing truthful local wording, title/main-heading clarity, and no thin location claims.', 'Roadmap and SEO docs mention local relevance/distance/prominence habits.', 'Local pages can become vague or unsupported.', 14, '{}'::jsonb, now()),
  ('schema126_15_fallback_depth', 'completed_this_pass', 15, 'fallback', 'Track missing optional-view fallback depth', 'completed', 'medium', 'KNOWN_ISSUES_AND_GAPS.md', '#admin', 'Runtime fallback checks remain visible and are reinforced by the new depth queue.', 'Fallback rows exist for optional views and service-worker install.', 'One missing optional object can take down a full screen.', 15, '{}'::jsonb, now()),
  ('schema126_16_accounting_depth', 'completed_this_pass', 16, 'accounting', 'Carry accounting cost and close gaps forward as tracked depth items', 'completed', 'high', 'KNOWN_ISSUES_AND_GAPS.md', '#jobs / #admin', 'Payment application, reconciliation, remittance, and close-package gaps are listed in app_depth_review_queue.', 'Accounting depth rows are visible.', 'Cost and close workflows remain partially manual.', 16, '{}'::jsonb, now()),
  ('schema126_17_equipment_depth', 'completed_this_pass', 17, 'equipment', 'Carry equipment scan/signoff gaps forward as tracked depth items', 'completed', 'high', 'KNOWN_ISSUES_AND_GAPS.md', '#equipment', 'QR/barcode scan, accessory checklist, verifier role, and failed-test task depth are listed in app_depth_review_queue.', 'Equipment accountability rows are visible.', 'Equipment movement can be hard to audit after site work.', 17, '{}'::jsonb, now()),
  ('schema126_18_mobile_depth', 'completed_this_pass', 18, 'mobile', 'Carry mobile-first field workflow depth forward', 'completed', 'medium', 'DEVELOPMENT_ROADMAP.md', '#today', 'Mobile offline, draft resume, and supervisor scan actions are tracked as next-step rows.', 'Mobile rows appear in next 20.', 'Field users may avoid the app on phones.', 18, '{}'::jsonb, now()),
  ('schema126_19_docs_refresh', 'completed_this_pass', 19, 'documentation', 'Update active Markdown files for build 2026-06-02a', 'completed', 'high', 'README.md', 'repo docs', 'Updated active project, roadmap, issue, database, testing, deployment, and new-chat docs.', 'Active Markdown files reference schema 126.', 'Future chats continue from stale schema assumptions.', 19, '{}'::jsonb, now()),
  ('schema126_20_smoke_update', 'completed_this_pass', 20, 'testing', 'Update smoke script to require schema 126 guardrails', 'completed', 'high', 'TESTING_CHECKLIST.md', 'scripts/repo-smoke-check.mjs', 'Smoke now checks schema 126 file, cache marker, archive snapshots, admin loads, and UI rendering.', 'Smoke passes with no failed checks.', 'Build packages can ship without the new guardrails.', 20, '{}'::jsonb, now()),
  ('next126_01_payment_application_ui', 'next_20', 1, 'accounting', 'Build full payment application screen', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin accounting', 'Apply deposits, payments, credits, discounts, write-offs, and overpayments to invoices with undo/review.', 'Payment application rows can be created, reviewed, reversed, and exported.', 'Revenue recognition and balances remain manual.', 101, '{}'::jsonb, now()),
  ('next126_02_bank_csv_preview', 'next_20', 2, 'accounting', 'Add bank CSV preview and import validation UI', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin banking', 'Preview CSV headers, duplicates, invalid dates, and amount sign rules before commit.', 'CSV import has preview, accept/reject, and error rows.', 'Bad imports can pollute reconciliation.', 102, '{}'::jsonb, now()),
  ('next126_03_match_undo', 'next_20', 3, 'accounting', 'Add reconciliation manual match and undo controls', 'planned', 'high', 'KNOWN_ISSUES_AND_GAPS.md', '#admin banking', 'Allow scored match, manual match, split match, unmatch, and review signoff.', 'Bank line shows match status, reviewer, and undo history.', 'Bank reconciliation cannot be trusted end to end.', 103, '{}'::jsonb, now()),
  ('next126_04_hst_review', 'next_20', 4, 'tax', 'Add HST/GST filing review screen with source totals', 'planned', 'high', 'KNOWN_ISSUES_AND_GAPS.md', '#admin tax', 'Show collected/paid/adjustment totals, reviewer signoff, filed date, remitted date, and proof upload.', 'Tax filing row ties back to source totals and proof.', 'Filing records remain outside the system.', 104, '{}'::jsonb, now()),
  ('next126_05_payroll_remittance_review', 'next_20', 5, 'payroll', 'Add payroll remittance review/signoff flow', 'planned', 'high', 'KNOWN_ISSUES_AND_GAPS.md', '#admin payroll', 'Track source pay runs, remittance amounts, reviewer, filing proof, payment proof, and lock status.', 'Payroll remittance run has proof and signoff fields visible.', 'Payroll obligations stay hard to audit.', 105, '{}'::jsonb, now()),
  ('next126_06_month_end_lock_ui', 'next_20', 6, 'accounting', 'Finish month-end close lock/reopen controls', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin close center', 'Lock periods, block new postings, request reopen with reason, and record approval.', 'Closed period rejects new postings unless reopened.', 'Reports can change after accountant review.', 106, '{}'::jsonb, now()),
  ('next126_07_accountant_export_delivery', 'next_20', 7, 'accounting', 'Finish accountant export packaging and delivery', 'planned', 'high', 'DEVELOPMENT_ROADMAP.md', '#admin close center', 'Bundle reports, CSVs, proof files, journal lines, and manifest with delivery status.', 'Export package has manifest, files, delivery timestamp, and receipt.', 'Accountant handoff remains manual.', 107, '{}'::jsonb, now()),
  ('next126_08_qr_scan_flow', 'next_20', 8, 'equipment', 'Add QR/barcode scan flow for equipment checkout/arrival/return', 'planned', 'high', 'KNOWN_ISSUES_AND_GAPS.md', '#equipment', 'Use camera/manual scan to load equipment item and reduce typing errors.', 'Scan fills equipment code and shows current status.', 'Wrong equipment can be checked out or returned.', 108, '{}'::jsonb, now()),
  ('next126_09_accessory_template_library', 'next_20', 9, 'equipment', 'Create reusable accessory checklist templates', 'planned', 'medium', 'KNOWN_ISSUES_AND_GAPS.md', '#equipment', 'Attach default accessory checklist templates to equipment categories.', 'Checkout/return checklist defaults from equipment type.', 'Accessory checks stay inconsistent.', 109, '{}'::jsonb, now()),
  ('next126_10_verifier_permissions', 'next_20', 10, 'equipment', 'Tighten verifier permissions for final returns and lockout clearing', 'planned', 'high', 'KNOWN_ISSUES_AND_GAPS.md', '#equipment', 'Require configured role for verify_return_complete and defect_clear actions.', 'Lower roles see disabled action with clear explanation.', 'Unqualified users can clear safety-critical defects.', 110, '{}'::jsonb, now()),
  ('next126_11_failed_test_service_workorder', 'next_20', 11, 'equipment', 'Convert failed equipment tests into service work orders', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#equipment', 'Turn failed arrival/return tests into assignable repair/service tasks with cost tracking.', 'Failed test creates visible service task and optional job cost.', 'Failed tests do not become actionable work.', 111, '{}'::jsonb, now()),
  ('next126_12_job_cost_rollup', 'next_20', 12, 'jobs/accounting', 'Link repair, delay, fuel, disposal, subcontractor, and material costs to job profitability', 'planned', 'high', 'KNOWN_ISSUES_AND_GAPS.md', '#jobs', 'Roll up cost categories into job margin and close blockers.', 'Job margin shows category subtotals and actual-vs-estimate variance.', 'Profitability is incomplete.', 112, '{}'::jsonb, now()),
  ('next126_13_customer_quote_to_invoice', 'next_20', 13, 'jobs/accounting', 'Tighten quote acceptance to invoice candidate flow', 'planned', 'medium', 'DEVELOPMENT_ROADMAP.md', '#jobs', 'Carry accepted quote totals, tax code, discounts, and attachments into invoice candidates.', 'Accepted quote produces invoice candidate without retyping.', 'Billing handoff is slow and error prone.', 113, '{}'::jsonb, now()),
  ('next126_14_local_seo_route_registry', 'next_20', 14, 'seo', 'Add public route SEO registry for local wording review', 'planned', 'medium', 'SEO_PUBLIC_PAGE_RULES.md', '#admin readiness', 'Track route title, H1, meta, local terms, image alt, and proof level.', 'SEO smoke table covers each public route.', 'Local SEO work stays informal.', 114, '{}'::jsonb, now()),
  ('next126_15_internal_link_suggestions', 'next_20', 15, 'seo', 'Add internal-link suggestion queue', 'planned', 'medium', 'SEO_PUBLIC_PAGE_RULES.md', '#admin readiness', 'Suggest links between service, location, proof, gallery, and contact pages.', 'Queue shows suggested source, target, anchor, status.', 'Pages can stay orphaned or weakly connected.', 115, '{}'::jsonb, now()),
  ('next126_16_mobile_scan_buttons', 'next_20', 16, 'mobile', 'Add phone-first scan buttons to Today dashboard', 'planned', 'medium', 'MOBILE_TODAY_DASHBOARD_PWA_AND_OFFLINE_BADGES.md', '#today', 'Give supervisors quick access to equipment scan, proof upload, incident, and closeout actions.', 'Today dashboard exposes scan and proof shortcuts.', 'Field users must dig through menus.', 116, '{}'::jsonb, now()),
  ('next126_17_offline_conflict_labels', 'next_20', 17, 'fallback', 'Improve offline conflict labels and retry messages', 'planned', 'medium', 'WORKFLOW_AUTOMATION_AND_EVIDENCE_REVIEW.md', '#admin messaging', 'Show user-friendly conflict causes and recommended retry/keep/discard decisions.', 'Conflict table explains what failed and what to do.', 'Users may delete useful local drafts.', 117, '{}'::jsonb, now()),
  ('next126_18_css_component_tokens', 'next_20', 18, 'css', 'Introduce small CSS component token inventory', 'planned', 'low', 'SYSTEM_ARCHITECTURE.md', 'style.css', 'Document reused card/table/button spacing tokens to slow CSS drift.', 'Style guide names common layout classes.', 'One-off CSS keeps accumulating.', 118, '{}'::jsonb, now()),
  ('next126_19_schema_preflight_auto_seed', 'next_20', 19, 'deployment', 'Auto-seed schema preflight rows for new migrations', 'planned', 'medium', 'TESTING_CHECKLIST.md', '#admin readiness', 'Each migration adds required table/view rows so missing live objects are visible.', 'New schema objects appear in preflight list.', 'Live database gaps are not obvious.', 119, '{}'::jsonb, now()),
  ('next126_20_live_supabase_smoke_runbook', 'next_20', 20, 'deployment', 'Create live Supabase deployment smoke runbook', 'planned', 'high', 'DEPLOYMENT_GUIDE.md', 'Supabase', 'Document exact Edge Function deploy order, schema apply order, and browser cache reset.', 'Runbook can be followed without local node access.', 'Deploy errors repeat across passes.', 120, '{}'::jsonb, now())
on conflict (step_key) do update set
  step_batch = excluded.step_batch,
  step_number = excluded.step_number,
  step_area = excluded.step_area,
  step_title = excluded.step_title,
  step_status = excluded.step_status,
  priority = excluded.priority,
  source_doc = excluded.source_doc,
  route_hint = excluded.route_hint,
  implementation_notes = excluded.implementation_notes,
  acceptance_check = excluded.acceptance_check,
  risk_if_skipped = excluded.risk_if_skipped,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_depth_review_queue (
  review_key, review_area, review_title, current_depth, recommended_depth, review_status,
  cost_linkage_hint, accounting_impact, route_hint, acceptance_check, sort_order, metadata, checked_at
)
values
  ('accounting_cost_category_rollups', 'accounting costs', 'Repair, delay, equipment usage, replacement, fuel, disposal, material, and subcontractor costs need stronger job profitability links', 'Schema has job financial events and rollups, but category-level actual-vs-estimate review needs deeper UI and close blocking.', 'Add cost category subtotals, source proof, approval state, job margin impact, and close blocker status.', 'review', 'Link each cost to job_id, job_session_id, equipment_item_id, vendor_id, tax code, and GL account where possible.', 'Improves job margin, tax prep, close review, and accountant handoff.', '#jobs / #admin accounting', 'Job profitability row shows each cost category with source count, total, and variance.', 10, '{}'::jsonb, now()),
  ('payment_application_full_screen', 'payment application', 'Payment application needs a full screen for invoices, deposits, credits, discounts, write-offs, and overpayments', 'Schema foundation exists, but operator workflow is not yet complete enough for month-end.', 'Build apply/reverse/review controls with clear unapplied balance and audit trail.', 'planned', 'Link AR payment application to invoice, quote, job, bank item, and close period.', 'Needed before final close lock and accountant export are reliable.', '#admin accounting', 'Payment can be applied, partially applied, reversed, and exported with reviewer.', 20, '{}'::jsonb, now()),
  ('bank_reconciliation_manual_review', 'bank reconciliation', 'Bank reconciliation needs CSV preview, scored matching, manual matching, undo, and review status', 'Schema has review queues and match candidates, but the operator review flow needs more depth.', 'Add CSV staging preview, match scoring display, manual review screen, undo, and reviewer signoff.', 'planned', 'Tie bank item to payment, invoice, journal entry, vendor bill, and close period.', 'Prevents incorrect bank matches and supports close lock.', '#admin banking', 'Each bank row has import status, match status, reviewer, and undo trail.', 30, '{}'::jsonb, now()),
  ('hst_gst_payroll_remittance', 'tax and payroll', 'HST/GST and payroll remittance need source totals, review/signoff, filed/remitted dates, and export proof', 'Tables/views exist but need more proof and review UX.', 'Add source totals, adjustment rows, proof upload, filed date, paid date, reviewer, and lock status.', 'planned', 'Tie tax/payroll rows to close period and accountant export bundle.', 'Needed for audit trail and month-end package confidence.', '#admin tax_payroll', 'Filing/remittance row has proof, source totals, reviewed by, filed date, remitted date.', 40, '{}'::jsonb, now()),
  ('month_end_close_package', 'month-end close', 'Month-end close lock/reopen and accountant export packaging still need completion', 'Close center exists, but lock/reopen and package delivery need stronger workflow enforcement.', 'Block changes to closed periods, allow approved reopen, and export a manifest with all proofs.', 'planned', 'Tie all journal/payment/reconciliation/tax/export rows to accounting period close.', 'Stops reports from changing after accountant handoff.', '#admin close center', 'Closed period blocks posting; package has manifest, files, and delivery proof.', 50, '{}'::jsonb, now()),
  ('equipment_qr_accessory_verifier', 'equipment accountability', 'Equipment accountability needs QR/barcode scan flow, accessory templates, verifier permissions, and service tasks from failed tests', 'Schema has QR/barcode fields, accessory JSON, verifier-role fields, and service task rows; UI scan and permission enforcement need more depth.', 'Add camera/manual scan UI, checklist templates, role-disabled final verification, and service-task work orders.', 'planned', 'Link failed equipment task cost to job and equipment maintenance history.', 'Improves custody, safety, repair costing, and return signoff.', '#equipment', 'Scan-driven checkout/arrival/return works and failed tests create follow-up work.', 60, '{}'::jsonb, now()),
  ('seo_local_public_pages', 'SEO/local search', 'Public SEO needs route-level title, H1, meta, local wording, image alt, and proof checks per public page', 'Smoke checks index.html and DB has SEO guardrails, but multi-route public SEO registry needs expansion.', 'Create public route registry and internal-link suggestion workflow.', 'planned', null, 'Improves local relevance and prevents unsupported location claims.', '#admin readiness', 'Every public route has title, H1 count, meta, local terms, proof level, and internal-link status.', 70, '{}'::jsonb, now()),
  ('css_drift_component_system', 'CSS/mobile', 'CSS drift needs component-level reuse and mobile regression checks', 'Brace balance passes; component-level drift is still manual.', 'Add component token inventory and per-breakpoint visual checklist.', 'review', null, 'Reduces layout regressions and long-scroll mobile issues.', 'style.css / #admin readiness', 'Common cards/tables/buttons/forms use documented classes and smoke checks.', 80, '{}'::jsonb, now())
on conflict (review_key) do update set
  review_area = excluded.review_area,
  review_title = excluded.review_title,
  current_depth = excluded.current_depth,
  recommended_depth = excluded.recommended_depth,
  review_status = excluded.review_status,
  cost_linkage_hint = excluded.cost_linkage_hint,
  accounting_impact = excluded.accounting_impact,
  route_hint = excluded.route_hint,
  acceptance_check = excluded.acceptance_check,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_data_migration_candidates (
  candidate_key, data_area, source_location, recommended_target, duplication_risk,
  migration_status, reason, fallback_plan, acceptance_check, sort_order, metadata, checked_at
)
values
  ('public_route_seo_registry', 'SEO/public routes', 'index.html, Markdown notes, future static route copy', 'Database registry with generated static fallback JSON', 'high', 'planned', 'SEO checks currently exist in code/docs, but per-route proof and local terms should be reviewable.', 'Keep static HTML/meta as the public fallback and export reviewed DB rows into build-time JSON when needed.', 'Admin can list public route title, H1, meta, local terms, proof level, and status.', 10, '{}'::jsonb, now()),
  ('mobile_today_action_registry', 'Mobile Today actions', 'DB registry plus frontend fallback arrays', 'Database as source of truth with cached frontend fallback', 'medium', 'in_progress', 'Mobile actions need admin visibility but must still work offline.', 'Keep safe hard-coded fallback actions if the view is missing or offline.', 'Today actions load from DB when available and fallback offline.', 20, '{}'::jsonb, now()),
  ('equipment_accessory_templates', 'Equipment accessories', 'Free-text/JSON accessory checklists', 'Database template rows linked to equipment category or item', 'high', 'planned', 'Accessory requirements should not be typed differently every checkout.', 'Preserve existing JSON checklist data as historical event payload.', 'Equipment type preloads expected accessory list at checkout and return.', 30, '{}'::jsonb, now()),
  ('accounting_close_exports', 'Accounting exports', 'Manual reports, proof files, and accountant notes', 'Database package manifest with generated export files', 'high', 'planned', 'Accountant handoff should not depend on ad-hoc local files.', 'Allow manual download bundle until automated delivery is tested.', 'Export package includes manifest, source totals, proof files, delivery status.', 40, '{}'::jsonb, now()),
  ('bank_csv_imports', 'Bank CSV imports', 'Uploaded CSV rows and manual review notes', 'Database staging/import tables with reject reasons and fallback export', 'high', 'planned', 'Bank import decisions must be auditable and reversible.', 'Allow rejected rows to be downloaded as a correction CSV.', 'Import session has row counts, duplicate counts, accepted rows, rejected rows, and reviewer.', 50, '{}'::jsonb, now()),
  ('local_draft_outbox', 'Offline drafts/outbox', 'Browser localStorage queue', 'Keep localStorage for offline-first, sync summary to DB when authenticated', 'medium', 'review', 'Offline drafts belong locally first, but Admin needs conflict visibility after sync.', 'Never delete local draft automatically on failed sync; show conflict actions.', 'Conflict review shows local payload, server response, retry/keep/discard actions.', 60, '{}'::jsonb, now())
on conflict (candidate_key) do update set
  data_area = excluded.data_area,
  source_location = excluded.source_location,
  recommended_target = excluded.recommended_target,
  duplication_risk = excluded.duplication_risk,
  migration_status = excluded.migration_status,
  reason = excluded.reason,
  fallback_plan = excluded.fallback_plan,
  acceptance_check = excluded.acceptance_check,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_schema_documentation_sync_checks (
  check_key, check_area, check_title, expected_status, current_status,
  file_path, test_command, failure_hint, sort_order, metadata, checked_at
)
values
  ('schema_126_file_present', 'schema', 'Schema 126 migration file is present', 'required', 'passed', 'sql/126_roadmap_depth_data_migration_seo_css_fallback_guardrails.sql', 'test -f sql/126_roadmap_depth_data_migration_seo_css_fallback_guardrails.sql', 'Do not ship schema 126 docs without the migration file.', 10, '{}'::jsonb, now()),
  ('canonical_schema_126', 'schema', 'Canonical full schema reference includes schema 126', 'required', 'passed', 'sql/000_full_schema_reference.sql', 'grep 126_roadmap_depth_data_migration_seo_css_fallback_guardrails sql/000_full_schema_reference.sql', 'The full schema reference must match latest migration.', 20, '{}'::jsonb, now()),
  ('markdown_126_refreshed', 'documentation', 'Active Markdown files are refreshed for schema 126', 'required', 'passed', 'README.md / DEVELOPMENT_ROADMAP.md / KNOWN_ISSUES_AND_GAPS.md', 'grep 2026-06-02a README.md DEVELOPMENT_ROADMAP.md KNOWN_ISSUES_AND_GAPS.md', 'Future chat handoff will be stale if active Markdown is not updated.', 30, '{}'::jsonb, now()),
  ('smoke_126_current', 'testing', 'Smoke script expects schema 126 and 2026-06-02a cache marker', 'required', 'passed', 'scripts/repo-smoke-check.mjs', 'node scripts/repo-smoke-check.mjs', 'Smoke script must fail stale schema/cache packages.', 40, '{}'::jsonb, now()),
  ('css_brace_balance', 'css', 'CSS brace balance remains clean', 'required', 'passed', 'style.css', 'node scripts/repo-smoke-check.mjs', 'CSS drift can break mobile sections invisibly.', 50, '{}'::jsonb, now()),
  ('single_h1_public_shell', 'seo', 'Public app shell keeps no more than one H1', 'required', 'passed', 'index.html', 'node scripts/repo-smoke-check.mjs', 'Duplicate H1s can weaken main-title clarity and accessibility.', 60, '{}'::jsonb, now()),
  ('edge_function_parse', 'deployment', 'All Edge Function TypeScript files parse before deploy', 'required', 'passed', 'supabase/functions/*/index.ts', 'node scripts/repo-smoke-check.mjs', 'Supabase should not be first place syntax errors are found.', 70, '{}'::jsonb, now())
on conflict (check_key) do update set
  check_area = excluded.check_area,
  check_title = excluded.check_title,
  expected_status = excluded.expected_status,
  current_status = excluded.current_status,
  file_path = excluded.file_path,
  test_command = excluded.test_command,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_app_roadmap_action_steps;
create view public.v_app_roadmap_action_steps as
select
  step_key,
  step_batch,
  step_number,
  step_area,
  step_title,
  step_status,
  priority,
  source_doc,
  route_hint,
  implementation_notes,
  acceptance_check,
  risk_if_skipped,
  sort_order,
  metadata,
  checked_at,
  updated_at
from public.app_roadmap_action_steps
order by step_batch, sort_order, step_number, step_key;

drop view if exists public.v_app_depth_review_queue;
create view public.v_app_depth_review_queue as
select
  review_key,
  review_area,
  review_title,
  current_depth,
  recommended_depth,
  review_status,
  cost_linkage_hint,
  accounting_impact,
  route_hint,
  acceptance_check,
  sort_order,
  metadata,
  checked_at,
  updated_at
from public.app_depth_review_queue
order by sort_order, review_key;

drop view if exists public.v_app_data_migration_candidates;
create view public.v_app_data_migration_candidates as
select
  candidate_key,
  data_area,
  source_location,
  recommended_target,
  duplication_risk,
  migration_status,
  reason,
  fallback_plan,
  acceptance_check,
  sort_order,
  metadata,
  checked_at,
  updated_at
from public.app_data_migration_candidates
order by sort_order, candidate_key;

drop view if exists public.v_app_schema_documentation_sync_checks;
create view public.v_app_schema_documentation_sync_checks as
select
  check_key,
  check_area,
  check_title,
  expected_status,
  current_status,
  file_path,
  test_command,
  failure_hint,
  sort_order,
  metadata,
  checked_at,
  updated_at
from public.app_schema_documentation_sync_checks
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
  gate_key, gate_area, gate_title, gate_status, owner_hint, route_hint,
  test_hint, failure_hint, sort_order, checked_at
)
values
  ('roadmap_next20_visible', 'roadmap', 'Completed 20 and next 20 roadmap steps are DB-visible', 'passed', 'Admin / Developer', '#admin readiness', 'Review v_app_roadmap_action_steps after each pass.', 'Roadmap may drift from app state if only Markdown is updated.', 71, now()),
  ('data_migration_candidates_visible', 'data migration', 'JSON/DB duplication migration candidates are tracked', 'passed', 'Admin / Developer', '#admin readiness', 'Review v_app_data_migration_candidates before moving shared data between JSON and DB.', 'Moving data without fallback can break offline use or create duplicated sources.', 72, now()),
  ('depth_review_queue_visible', 'sanity check', 'Application-depth review queue is visible', 'passed', 'Admin / Developer', '#admin readiness', 'Review v_app_depth_review_queue for accounting, equipment, SEO, CSS, mobile, and fallback depth.', 'Important gaps can be missed between build passes.', 73, now()),
  ('schema_126_sync_visible', 'documentation', 'Schema/documentation sync checks are visible', 'passed', 'Admin / Developer', '#admin readiness', 'Review v_app_schema_documentation_sync_checks before packaging.', 'Docs and schema can ship out of sync.', 74, now())
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
  126::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 126
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 126
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 126.'
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
  126,
  '126_roadmap_depth_data_migration_seo_css_fallback_guardrails',
  '126_roadmap_depth_data_migration_seo_css_fallback_guardrails.sql',
  '2026-06-02a',
  'Adds DB-visible roadmap completion/next-step tracking, application-depth review rows, data-migration candidates, and schema/documentation sync checks for SEO, CSS, fallback, accounting, and equipment accountability.',
  'applied',
  'This pass repairs repo archive/test hygiene, updates the cache marker, exposes schema 125/126 guardrails in Admin, and records completed 20 plus next 20 roadmap steps.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_roadmap_action_steps to authenticated;
grant select on public.app_depth_review_queue to authenticated;
grant select on public.app_data_migration_candidates to authenticated;
grant select on public.app_schema_documentation_sync_checks to authenticated;
grant select on public.v_app_roadmap_action_steps to authenticated;
grant select on public.v_app_depth_review_queue to authenticated;
grant select on public.v_app_data_migration_candidates to authenticated;
grant select on public.v_app_schema_documentation_sync_checks to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
