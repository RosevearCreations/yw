-- Schema 128: accounting, equipment, public SEO, and fallback execution queues.
-- Build 2026-06-03a.
-- Repaired for the schema 126 app_roadmap_action_steps column names and constraints.

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

alter table public.app_schema_versions
  add column if not exists migration_key text;

alter table public.app_schema_versions
  add column if not exists release_label text;

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

alter table public.app_roadmap_action_steps
  add column if not exists step_batch text;

alter table public.app_roadmap_action_steps
  add column if not exists step_number integer;

alter table public.app_roadmap_action_steps
  add column if not exists step_area text;

alter table public.app_roadmap_action_steps
  add column if not exists step_title text;

alter table public.app_roadmap_action_steps
  add column if not exists step_status text not null default 'planned';

alter table public.app_roadmap_action_steps
  add column if not exists priority text not null default 'medium';

alter table public.app_roadmap_action_steps
  add column if not exists source_doc text;

alter table public.app_roadmap_action_steps
  add column if not exists route_hint text;

alter table public.app_roadmap_action_steps
  add column if not exists implementation_notes text;

alter table public.app_roadmap_action_steps
  add column if not exists acceptance_check text;

alter table public.app_roadmap_action_steps
  add column if not exists risk_if_skipped text;

alter table public.app_roadmap_action_steps
  add column if not exists sort_order integer not null default 100;

alter table public.app_roadmap_action_steps
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.app_roadmap_action_steps
  add column if not exists checked_at timestamptz;

alter table public.app_roadmap_action_steps
  add column if not exists updated_at timestamptz not null default now();

alter table public.app_roadmap_action_steps
  drop constraint if exists app_roadmap_action_steps_step_batch_check;

alter table public.app_roadmap_action_steps
  add constraint app_roadmap_action_steps_step_batch_check
  check (step_batch in ('completed_this_pass', 'next_20'));

alter table public.app_roadmap_action_steps
  drop constraint if exists app_roadmap_action_steps_step_status_check;

alter table public.app_roadmap_action_steps
  add constraint app_roadmap_action_steps_step_status_check
  check (step_status in ('completed', 'in_progress', 'planned', 'blocked', 'review'));

create table if not exists public.app_payment_application_action_registry (
  action_key text primary key,
  action_area text not null,
  action_title text not null,
  workflow_status text not null default 'planned',
  required_role text not null default 'admin',
  route_hint text,
  source_table_hint text,
  accounting_effect text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_accounting_close_control_queue (
  control_key text primary key,
  close_area text not null,
  control_title text not null,
  control_status text not null default 'planned',
  source_totals_hint text,
  reviewer_hint text,
  proof_hint text,
  lock_behavior text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_equipment_accountability_action_queue (
  action_key text primary key,
  equipment_area text not null,
  action_title text not null,
  action_status text not null default 'planned',
  required_role text not null default 'supervisor',
  scanner_status text not null default 'manual_fallback',
  server_enforcement_status text not null default 'review',
  service_task_behavior text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_public_seo_publication_queue (
  queue_key text primary key,
  route_key text,
  publish_area text not null,
  publish_title text not null,
  publish_status text not null default 'planned',
  required_evidence text,
  local_wording_hint text,
  smoke_test_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_fallback_observability_matrix (
  matrix_key text primary key,
  app_surface text not null,
  failure_mode text not null,
  fallback_status text not null default 'review',
  user_message_hint text,
  telemetry_hint text,
  retry_policy_hint text,
  owner_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_payment_application_action_registry (
  action_key,
  action_area,
  action_title,
  workflow_status,
  required_role,
  route_hint,
  source_table_hint,
  accounting_effect,
  fallback_hint,
  sort_order,
  metadata,
  checked_at
)
values
  (
    'apply_customer_payment',
    'payment_application',
    'Apply customer payment to one or more invoices',
    'planned',
    'admin',
    '#admin',
    'payment applications / invoices / deposits',
    'Reduces invoice balance and links cash to customer account.',
    'Keep staged until reviewer approves.',
    10,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'reverse_payment_application',
    'payment_application',
    'Reverse a mistaken payment application with audit reason',
    'planned',
    'admin',
    '#admin',
    'payment reversals',
    'Restores balance and keeps reversal trail.',
    'Lock row and add manual review note until reversal UI exists.',
    20,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'apply_adjustments',
    'adjustments',
    'Apply discount, credit, write-off, refund, or overpayment decision',
    'planned',
    'admin',
    '#admin',
    'adjustments / refunds',
    'Separates cash received from revenue reductions and refunds.',
    'Require reason and reviewer before posting.',
    30,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'job_cost_rollup',
    'job_costs',
    'Roll repair, delay, usage, replacement, fuel, disposal, materials, and subcontractors into job profitability',
    'in_progress',
    'admin',
    '#jobs',
    'job financial events / equipment service tasks',
    'Improves quoted-vs-actual margin reporting.',
    'Show source rows if rollup view is unavailable.',
    40,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  )
on conflict (action_key) do update set
  action_area = excluded.action_area,
  action_title = excluded.action_title,
  workflow_status = excluded.workflow_status,
  required_role = excluded.required_role,
  route_hint = excluded.route_hint,
  source_table_hint = excluded.source_table_hint,
  accounting_effect = excluded.accounting_effect,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_accounting_close_control_queue (
  control_key,
  close_area,
  control_title,
  control_status,
  source_totals_hint,
  reviewer_hint,
  proof_hint,
  lock_behavior,
  fallback_hint,
  sort_order,
  metadata,
  checked_at
)
values
  (
    'bank_csv_preview',
    'bank_reconciliation',
    'CSV preview validates headers, duplicates, bad dates, and amount signs',
    'planned',
    'Bank import staging and rejected-row reasons.',
    'Reviewer confirms import source and duplicate handling.',
    'Preview report retained with accepted/rejected counts.',
    'No posting from unreviewed imports.',
    'Manual spreadsheet review remains fallback.',
    10,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'manual_match_review',
    'bank_reconciliation',
    'Manual match, split match, undo, notes, and signoff',
    'planned',
    'Bank rows, payments, invoices, journal candidates, unmatched items.',
    'Reviewer signs off match decisions.',
    'Match history keeps who/when/reason.',
    'Matched rows lock after close.',
    'Unmatched rows stay in review queue.',
    20,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'hst_gst_proof',
    'tax_remittance',
    'HST/GST source totals, adjustments, proof, filed/remitted dates, and lock status',
    'planned',
    'Sales tax collected, ITCs, adjustments, payment rows.',
    'Reviewer confirms amounts before filing.',
    'Proof upload and remittance confirmation are linked.',
    'Filing row locks when accepted/paid.',
    'Export summary remains fallback.',
    30,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'payroll_remittance_proof',
    'payroll_remittance',
    'Payroll source pay runs, deductions, employer costs, proof, payment date, and signoff',
    'planned',
    'Pay runs, deductions, employer costs, payment proof.',
    'Reviewer signs source totals and proof.',
    'Proof retained with close period.',
    'Remittance locks after proof/signoff.',
    'Manual accountant package remains fallback.',
    40,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'month_end_lock_export',
    'month_end_close',
    'Month-end lock, reopen reason, posting block, and accountant export package',
    'planned',
    'Close period, journal rows, reconciliation, remittances, export manifest.',
    'Admin/accountant final signoff.',
    'Manifest lists CSV/JSON/proof files.',
    'Closed periods block postings unless reopened.',
    'Warning banners remain fallback.',
    50,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  )
on conflict (control_key) do update set
  close_area = excluded.close_area,
  control_title = excluded.control_title,
  control_status = excluded.control_status,
  source_totals_hint = excluded.source_totals_hint,
  reviewer_hint = excluded.reviewer_hint,
  proof_hint = excluded.proof_hint,
  lock_behavior = excluded.lock_behavior,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_equipment_accountability_action_queue (
  action_key,
  equipment_area,
  action_title,
  action_status,
  required_role,
  scanner_status,
  server_enforcement_status,
  service_task_behavior,
  fallback_hint,
  sort_order,
  metadata,
  checked_at
)
values
  (
    'camera_scan',
    'scan',
    'Add camera/BarcodeDetector scan with manual entry fallback',
    'planned',
    'employee',
    'manual_fallback_ready',
    'review',
    'Prefill checkout, arrival, return, and service task equipment code.',
    'Manual prompt remains fallback.',
    10,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'accessory_templates',
    'accessories',
    'Create reusable accessory checklist templates by equipment pool/category',
    'planned',
    'supervisor',
    'not_required',
    'review',
    'Expected accessories load during checkout/arrival/return.',
    'Free-text checklist remains fallback.',
    20,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'verifier_roles',
    'verification',
    'Enforce verifier role server-side for return, defect clear, and return-to-service',
    'planned',
    'supervisor',
    'not_required',
    'planned',
    'Service task cannot close below required role.',
    'UI disable remains fallback but server must be authority.',
    30,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'failed_test_work_orders',
    'service_tasks',
    'Promote failed arrival/return tests into assigned service work orders',
    'in_progress',
    'supervisor',
    'not_required',
    'review',
    'Failed tests get owner, due date, cost, evidence, and closeout proof.',
    'Current service-task insert remains fallback.',
    40,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'return_to_service',
    'lockout',
    'Require return-to-service signoff before locked-out equipment becomes available',
    'planned',
    'admin',
    'not_required',
    'planned',
    'Defect clear verifies service task completion and proof.',
    'Keep item locked out until verification succeeds.',
    50,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  )
on conflict (action_key) do update set
  equipment_area = excluded.equipment_area,
  action_title = excluded.action_title,
  action_status = excluded.action_status,
  required_role = excluded.required_role,
  scanner_status = excluded.scanner_status,
  server_enforcement_status = excluded.server_enforcement_status,
  service_task_behavior = excluded.service_task_behavior,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_public_seo_publication_queue (
  queue_key,
  route_key,
  publish_area,
  publish_title,
  publish_status,
  required_evidence,
  local_wording_hint,
  smoke_test_hint,
  fallback_hint,
  sort_order,
  metadata,
  checked_at
)
values
  (
    'sitemap_robots',
    'home_shell',
    'technical_seo',
    'Generate sitemap and robots from approved route rows',
    'planned',
    'Approved route registry rows.',
    'Only include true service/location coverage.',
    'Confirm sitemap.xml and robots.txt exist and list approved routes.',
    'Static index remains fallback.',
    10,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'broken_link_check',
    'home_shell',
    'technical_seo',
    'Add broken-link and broken-asset smoke checks',
    'planned',
    'Public links/assets from static shell and route registry.',
    'Avoid unsupported local pages.',
    'Flag missing routes, images, scripts, styles, and manifest files.',
    'Hide route until link check passes.',
    20,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'structured_data',
    'home_shell',
    'structured_data',
    'Review structured data before publishing public pages',
    'planned',
    'Business identity, service area, contact, proof data.',
    'Do not overclaim service areas.',
    'Check JSON-LD parses and required fields exist.',
    'Plain title/meta remains fallback.',
    30,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'image_alt_score',
    'home_shell',
    'image_alt',
    'Add image-alt completeness and local proof scoring',
    'planned',
    'Images, captions, alt text, route context, proof status.',
    'Alt text should describe real content truthfully.',
    'Flag missing or too-short public image alt text.',
    'Hide weak gallery blocks until proof passes.',
    40,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  )
on conflict (queue_key) do update set
  route_key = excluded.route_key,
  publish_area = excluded.publish_area,
  publish_title = excluded.publish_title,
  publish_status = excluded.publish_status,
  required_evidence = excluded.required_evidence,
  local_wording_hint = excluded.local_wording_hint,
  smoke_test_hint = excluded.smoke_test_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_fallback_observability_matrix (
  matrix_key,
  app_surface,
  failure_mode,
  fallback_status,
  user_message_hint,
  telemetry_hint,
  retry_policy_hint,
  owner_hint,
  sort_order,
  metadata,
  checked_at
)
values
  (
    'optional_view_missing',
    'Edge Functions',
    'Optional DB view missing after partial schema deploy',
    'covered',
    'Show empty table with Apply schema message.',
    'Record panel diagnostic and failed view name when available.',
    'Retry after schema deploy; keep cached rows if safe.',
    'Admin',
    10,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'stale_service_worker',
    'Public shell',
    'Old service worker serves stale assets',
    'covered',
    'Ask user to hard-refresh or clear old service worker when marker mismatches.',
    'Compare cache marker, index marker, and schema drift row.',
    'Install assets one at a time and keep shell fallback alive.',
    'Admin',
    20,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'offline_conflict',
    'Mobile forms',
    'Local draft conflicts with server state',
    'review',
    'Offer Retry sync, Keep local, or Discard local choices.',
    'Track draft count and last failed sync time locally.',
    'Retry failed payload only and keep local copy until acknowledged.',
    'Supervisor',
    30,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'scan_unsupported',
    'Equipment mobile',
    'Camera or BarcodeDetector unavailable',
    'covered',
    'Prompt for manual QR/barcode/code entry.',
    'Track manual fallback count once telemetry exists.',
    'No retry loop; use manual entry.',
    'Supervisor',
    40,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'accounting_blocked',
    'Accounting workbench',
    'Accounting action missing proof or close-period signoff',
    'planned',
    'Explain missing proof/signoff and keep action in queue.',
    'Store blocked reason and reviewer note.',
    'Do not auto-retry blocked accounting actions.',
    'Admin / Accountant',
    50,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  )
on conflict (matrix_key) do update set
  app_surface = excluded.app_surface,
  failure_mode = excluded.failure_mode,
  fallback_status = excluded.fallback_status,
  user_message_hint = excluded.user_message_hint,
  telemetry_hint = excluded.telemetry_hint,
  retry_policy_hint = excluded.retry_policy_hint,
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
  (
    'schema128_done_01',
    'completed_this_pass',
    1,
    'schema',
    'Added schema 128 execution queues',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Migration and full schema include schema 128.',
    'DB-visible queues now track accounting, equipment, SEO, and fallback depth.',
    'Roadmap stays Markdown-only.',
    1,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'schema128_done_02',
    'completed_this_pass',
    2,
    'admin',
    'Exposed schema 128 queues in Admin readiness',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'admin-directory and admin-ui reference schema 128 views.',
    'Operators can see the new queues.',
    'New rows stay hidden.',
    2,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'schema128_done_03',
    'completed_this_pass',
    3,
    'cleanup',
    'Archived current Markdown and retired test_write files',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    'archive',
    'Smoke archive hygiene passes.',
    'Root stays clean.',
    'Stale files keep breaking smoke.',
    3,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'schema128_done_04',
    'completed_this_pass',
    4,
    'cache',
    'Updated cache marker to 2026-06-03a',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '/',
    'index and service worker markers match.',
    'Stale browser issues are clearer.',
    'Old cache can mask repairs.',
    4,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'schema128_done_05',
    'completed_this_pass',
    5,
    'docs',
    'Updated active Markdown and added schema 128 docs',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    'docs',
    'Docs reflect schema 128.',
    'Future pass has context.',
    'Docs drift from code.',
    5,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'schema128_next_01',
    'next_20',
    1,
    'accounting',
    'Build payment apply/reverse/adjust/refund UI actions',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Payment actions move from registry to working buttons.',
    'Cash application becomes usable.',
    'Cash remains manual.',
    101,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'schema128_next_02',
    'next_20',
    2,
    'accounting',
    'Build bank CSV preview and staging screen',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Header/date/duplicate/sign validation appears before staging.',
    'Bad imports are blocked.',
    'Bad data can enter.',
    102,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'schema128_next_03',
    'next_20',
    3,
    'accounting',
    'Build reconciliation match/split/undo/signoff workflow',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Reviewer can match, split, undo, note, and sign off.',
    'Reconciliation is auditable.',
    'Rows remain unmatched.',
    103,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'schema128_next_04',
    'next_20',
    4,
    'equipment',
    'Add real camera scan and DB accessory templates',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#jobs',
    'Scanner and templates replace manual-only flow.',
    'Field checkout is faster and clearer.',
    'Manual entry stays slow.',
    104,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  ),
  (
    'schema128_next_05',
    'next_20',
    5,
    'seo',
    'Generate sitemap/robots and add broken-link/image-alt/JSON-LD smoke checks',
    'planned',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '/',
    'Technical SEO files and smoke checks exist.',
    'Public publish is safer.',
    'SEO files drift.',
    105,
    '{"build":"2026-06-03a","schema":128}'::jsonb,
    now()
  )
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

drop view if exists public.v_app_payment_application_action_registry;

create view public.v_app_payment_application_action_registry as
select
  action_key,
  action_area,
  action_title,
  workflow_status,
  required_role,
  route_hint,
  source_table_hint,
  accounting_effect,
  fallback_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_payment_application_action_registry
order by sort_order, action_key;

drop view if exists public.v_app_accounting_close_control_queue;

create view public.v_app_accounting_close_control_queue as
select
  control_key,
  close_area,
  control_title,
  control_status,
  source_totals_hint,
  reviewer_hint,
  proof_hint,
  lock_behavior,
  fallback_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_accounting_close_control_queue
order by sort_order, control_key;

drop view if exists public.v_app_equipment_accountability_action_queue;

create view public.v_app_equipment_accountability_action_queue as
select
  action_key,
  equipment_area,
  action_title,
  action_status,
  required_role,
  scanner_status,
  server_enforcement_status,
  service_task_behavior,
  fallback_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_equipment_accountability_action_queue
order by sort_order, action_key;

drop view if exists public.v_app_public_seo_publication_queue;

create view public.v_app_public_seo_publication_queue as
select
  queue_key,
  route_key,
  publish_area,
  publish_title,
  publish_status,
  required_evidence,
  local_wording_hint,
  smoke_test_hint,
  fallback_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_public_seo_publication_queue
order by sort_order, queue_key;

drop view if exists public.v_app_fallback_observability_matrix;

create view public.v_app_fallback_observability_matrix as
select
  matrix_key,
  app_surface,
  failure_mode,
  fallback_status,
  user_message_hint,
  telemetry_hint,
  retry_policy_hint,
  owner_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_fallback_observability_matrix
order by sort_order, matrix_key;

drop view if exists public.v_schema_drift_status;

create view public.v_schema_drift_status as
select
  128::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 128
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 128
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 128.'
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
  128,
  '128_accounting_equipment_seo_fallback_execution_depth',
  '128_accounting_equipment_seo_fallback_execution_depth.sql',
  '2026-06-03a',
  'Adds Admin-visible execution queues for accounting actions, close controls, equipment accountability, public SEO publishing, and fallback observability.',
  'applied',
  'This pass refreshes schema/docs/cache/smoke guardrails and moves the next-step list into DB-visible queues.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_payment_application_action_registry to authenticated;
grant select on public.app_accounting_close_control_queue to authenticated;
grant select on public.app_equipment_accountability_action_queue to authenticated;
grant select on public.app_public_seo_publication_queue to authenticated;
grant select on public.app_fallback_observability_matrix to authenticated;
grant select on public.v_app_payment_application_action_registry to authenticated;
grant select on public.v_app_accounting_close_control_queue to authenticated;
grant select on public.v_app_equipment_accountability_action_queue to authenticated;
grant select on public.v_app_public_seo_publication_queue to authenticated;
grant select on public.v_app_fallback_observability_matrix to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
