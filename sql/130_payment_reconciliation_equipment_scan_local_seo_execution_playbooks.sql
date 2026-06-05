-- Schema 130: payment, reconciliation, equipment scan, local SEO, and fallback execution playbooks.
-- Build 2026-06-04b.
-- This pass moves the schema 129 planning queues closer to executable Admin/mobile work.

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

create table if not exists public.app_payment_execution_queue (
  action_key text primary key,
  action_area text not null,
  action_title text not null,
  action_status text not null default 'planned',
  required_role text not null default 'admin',
  route_hint text,
  source_rows_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_bank_reconciliation_execution_queue (
  action_key text primary key,
  action_area text not null,
  action_title text not null,
  action_status text not null default 'planned',
  route_hint text,
  source_rows_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_equipment_scan_template_registry (
  action_key text primary key,
  equipment_area text not null,
  action_title text not null,
  action_status text not null default 'planned',
  required_role text not null default 'supervisor',
  scanner_status text not null default 'manual_fallback',
  service_task_behavior text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_local_seo_execution_queue (
  action_key text primary key,
  seo_area text not null,
  action_title text not null,
  action_status text not null default 'planned',
  required_evidence text,
  local_wording_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_fallback_drill_queue (
  drill_key text primary key,
  app_surface text not null,
  drill_title text not null,
  drill_status text not null default 'planned',
  trigger_hint text,
  expected_fallback text,
  recovery_hint text,
  owner_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_payment_execution_queue (
  action_key, action_area, action_title, action_status, required_role, route_hint, source_rows_hint, fallback_hint, sort_order, metadata, checked_at
)
values
  ('payment_apply_form', 'payment_application', 'Build apply-payment form state and validation', 'planned', 'admin', '#admin', 'invoice/deposit/payment rows', 'Manual journal note until posting is wired', 10, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('payment_reverse_action', 'payment_application', 'Add reversal action with reason and audit trail', 'planned', 'admin', '#admin', 'payment_application reversal rows', 'Block reversal without reason', 20, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('payment_adjustment_types', 'payment_application', 'Separate discounts, credits, write-offs, overpayments, and refunds', 'planned', 'admin', '#admin', 'adjustment rows and journal candidates', 'Keep as reviewer note if GL posting unavailable', 30, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('payment_approval_gate', 'payment_application', 'Require reviewer approval before posting payment decisions', 'planned', 'admin', '#admin', 'approval status and reviewer profile', 'Keep staged status', 40, '{"build":"2026-06-04b","schema":130}'::jsonb, now())
on conflict (action_key) do update set
  action_area = excluded.action_area,
  action_title = excluded.action_title,
  action_status = excluded.action_status,
  required_role = excluded.required_role,
  route_hint = excluded.route_hint,
  source_rows_hint = excluded.source_rows_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_bank_reconciliation_execution_queue (
  action_key, action_area, action_title, action_status, route_hint, source_rows_hint, fallback_hint, sort_order, metadata, checked_at
)
values
  ('bank_csv_header_preview', 'bank_reconciliation', 'Validate CSV headers, dates, amount signs, duplicates, and rejected rows', 'planned', '#admin', 'bank_statement_imports', 'Rejected row report stays visible', 10, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('bank_match_scoring', 'bank_reconciliation', 'Score matches by amount, date, reference, invoice, and customer', 'planned', '#admin', 'bank_reconciliation_items', 'Manual search fallback', 20, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('bank_manual_split_undo', 'bank_reconciliation', 'Support manual match, split match, unmatch/undo, and notes', 'planned', '#admin', 'bank_reconciliation_sessions', 'Keep unmatched rows open', 30, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('bank_reviewer_signoff', 'bank_reconciliation', 'Final reviewer signoff locks reconciled rows', 'planned', '#admin', 'accounting_period_closes', 'Prevent posting from unreviewed imports', 40, '{"build":"2026-06-04b","schema":130}'::jsonb, now())
on conflict (action_key) do update set
  action_area = excluded.action_area,
  action_title = excluded.action_title,
  action_status = excluded.action_status,
  route_hint = excluded.route_hint,
  source_rows_hint = excluded.source_rows_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_equipment_scan_template_registry (
  action_key, equipment_area, action_title, action_status, required_role, scanner_status, service_task_behavior, fallback_hint, sort_order, metadata, checked_at
)
values
  ('scan_camera_detector', 'scan', 'Camera BarcodeDetector scan with manual entry fallback', 'planned', 'employee', 'manual_fallback', 'Fill equipment code / QR / barcode from camera when supported', 'Manual code prompt', 10, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('accessory_template_registry', 'accessory_templates', 'Reusable accessory templates by equipment category/pool', 'planned', 'supervisor', 'not_required', 'Load expected accessories on checkout/arrival/return', 'Free text checklist', 20, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('verifier_server_enforcement', 'verifier_roles', 'Server-side verifier role checks for return and defect clear', 'planned', 'supervisor', 'not_required', 'Block final signoff below required role', 'UI disable as fallback', 30, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('return_service_proof', 'return_to_service', 'Proof upload and cost capture before locked-out equipment returns to available', 'planned', 'admin', 'not_required', 'Close service task with proof, cost, and verifier', 'Keep locked out', 40, '{"build":"2026-06-04b","schema":130}'::jsonb, now())
on conflict (action_key) do update set
  equipment_area = excluded.equipment_area,
  action_title = excluded.action_title,
  action_status = excluded.action_status,
  required_role = excluded.required_role,
  scanner_status = excluded.scanner_status,
  service_task_behavior = excluded.service_task_behavior,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_local_seo_execution_queue (
  action_key, seo_area, action_title, action_status, required_evidence, local_wording_hint, fallback_hint, sort_order, metadata, checked_at
)
values
  ('sitemap_robot_generator', 'technical_seo', 'Generate sitemap.xml and robots.txt from approved public route rows', 'planned', 'Approved route registry rows', 'Use only true service/location wording', 'Keep static shell', 10, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('broken_link_asset_smoke', 'technical_seo', 'Smoke-check public links, scripts, styles, images, and manifest files', 'planned', 'Static shell and route registry', 'Flag broken public assets before deploy', 'Hide route until fixed', 20, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('jsonld_validation', 'structured_data', 'Parse JSON-LD and check required business/service fields', 'planned', 'Structured data snippets', 'Avoid overclaiming service areas', 'Plain title/meta fallback', 30, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('image_alt_local_proof', 'image_alt', 'Score public image alt text, captions, and local proof', 'planned', 'Image registry or static HTML', 'Describe real content truthfully', 'Hide weak gallery blocks', 40, '{"build":"2026-06-04b","schema":130}'::jsonb, now())
on conflict (action_key) do update set
  seo_area = excluded.seo_area,
  action_title = excluded.action_title,
  action_status = excluded.action_status,
  required_evidence = excluded.required_evidence,
  local_wording_hint = excluded.local_wording_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_fallback_drill_queue (
  drill_key, app_surface, drill_title, drill_status, trigger_hint, expected_fallback, recovery_hint, owner_hint, sort_order, metadata, checked_at
)
values
  ('offline_conflict_drill', 'mobile_offline', 'Run offline draft conflict drill', 'planned', 'Mobile form drafts', 'Retry / keep local / discard local options', 'Manual copy fallback', 'Supervisor', 10, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('optional_view_drill', 'edge_optional_views', 'Run optional-view missing drill', 'planned', 'admin-directory safeList', 'Empty table with schema hint', 'Apply schema then retry', 'Admin', 20, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('cache_stale_drill', 'service_worker', 'Run stale service worker/cache marker drill', 'planned', 'index/server-worker marker', 'Hard-refresh / clear worker guidance', 'Cache shell fallback', 'Admin', 30, '{"build":"2026-06-04b","schema":130}'::jsonb, now()),
  ('accounting_block_drill', 'accounting_workbench', 'Run blocked accounting proof/signoff drill', 'planned', 'accounting close controls', 'Explain missing proof/signoff', 'Keep action queued', 'Admin / Accountant', 40, '{"build":"2026-06-04b","schema":130}'::jsonb, now())
on conflict (drill_key) do update set
  app_surface = excluded.app_surface,
  drill_title = excluded.drill_title,
  drill_status = excluded.drill_status,
  trigger_hint = excluded.trigger_hint,
  expected_fallback = excluded.expected_fallback,
  recovery_hint = excluded.recovery_hint,
  owner_hint = excluded.owner_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_roadmap_action_steps (
  step_key, step_batch, step_number, step_area, step_title, step_status, priority, source_doc, route_hint, acceptance_check, implementation_notes, risk_if_skipped, sort_order, metadata, checked_at
)
values
  (
    'schema130_done_01',
    'completed_this_pass',
    1,
    'schema',
    'Added schema 130 execution playbooks',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Migration and full schema include schema 130.',
    'DB-visible queues now track next executable payment, reconciliation, scan, SEO, and fallback work.',
    'Roadmap stays too abstract.',
    1,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_02',
    'completed_this_pass',
    2,
    'accounting',
    'Added payment execution queue',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Admin readiness can load payment execution rows.',
    'Payment application work has a staged implementation list.',
    'Payment UI remains unclear.',
    2,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_03',
    'completed_this_pass',
    3,
    'banking',
    'Added reconciliation execution queue',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Admin readiness can load reconciliation execution rows.',
    'CSV preview and match workflow work is staged clearly.',
    'Bank workflow remains manual.',
    3,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_04',
    'completed_this_pass',
    4,
    'equipment',
    'Added equipment scan/template execution queue',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Admin readiness can load equipment scan/template rows.',
    'Camera scan, templates, verifier roles, and return-to-service actions are broken down.',
    'Equipment accountability remains manual.',
    4,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_05',
    'completed_this_pass',
    5,
    'seo',
    'Added local SEO execution queue',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Admin readiness can load local SEO rows.',
    'Sitemap, robots, broken-link, JSON-LD, and alt-text work is staged.',
    'Public SEO work drifts.',
    5,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_06',
    'completed_this_pass',
    6,
    'fallback',
    'Added fallback drill queue',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Admin readiness can load fallback drill rows.',
    'Offline, stale cache, optional view, and blocked accounting flows have drill steps.',
    'Fallbacks stay untested.',
    6,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_07',
    'completed_this_pass',
    7,
    'admin',
    'Loaded schema 130 views in admin-directory',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'admin-directory references schema 130 views.',
    'Admin can see schema 130 rows after deploy.',
    'Rows stay hidden.',
    7,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_08',
    'completed_this_pass',
    8,
    'admin',
    'Rendered schema 130 tables in Admin UI',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Admin UI includes schema 130 table bodies.',
    'Operators can review queue rows from the app.',
    'Rows require SQL queries to inspect.',
    8,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_09',
    'completed_this_pass',
    9,
    'docs',
    'Updated active Markdown files to schema 130',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Root Markdown reflects build 2026-06-04b.',
    'New chat/roadmap/testing/deploy files stay in sync.',
    'Future work loses context.',
    9,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_10',
    'completed_this_pass',
    10,
    'docs',
    'Added schema 130 documentation',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'docs/PAYMENT_RECONCILIATION_EQUIPMENT_SCAN_LOCAL_SEO_SCHEMA130.md exists.',
    'Schema 130 intent is documented.',
    'Schema intent is unclear.',
    10,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_11',
    'completed_this_pass',
    11,
    'schema',
    'Updated canonical full schema through schema 130',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    '000_full_schema_reference.sql contains schema 130 marker and drift view expects 130.',
    'Full rebuilds match migrations.',
    'Full schema can lag migrations.',
    11,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_12',
    'completed_this_pass',
    12,
    'smoke',
    'Updated smoke checks for schema 130',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'repo-smoke-check requires schema 130 marker, views, Admin UI, and cache marker.',
    'Future packages catch drift.',
    'Schema 130 can regress silently.',
    12,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_13',
    'completed_this_pass',
    13,
    'cache',
    'Updated static/cache marker to 2026-06-04b',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'index and service worker use 2026-06-04b.',
    'Browser cache issues are easier to spot.',
    'Old assets can mask changes.',
    13,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_14',
    'completed_this_pass',
    14,
    'seo',
    'Verified one public H1 remains in index',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Smoke check confirms one H1.',
    'Title/main-heading clarity remains protected.',
    'Public page clarity can weaken.',
    14,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_15',
    'completed_this_pass',
    15,
    'css',
    'Verified CSS brace balance',
    'completed',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'CSS brace balance is zero.',
    'CSS drift is less likely to break layout.',
    'UI layout can drift.',
    15,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_16',
    'completed_this_pass',
    16,
    'edge',
    'Verified Edge Function TypeScript parse checks',
    'completed',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'repo-smoke-check TypeScript parse diagnostics pass.',
    'Deploy parse errors are caught earlier.',
    'Supabase deploy can fail late.',
    16,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_17',
    'completed_this_pass',
    17,
    'archive',
    'Restored 2026-05-29a Markdown archive snapshot',
    'completed',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'archive/markdown-current-snapshot-2026-05-29a/README.md exists.',
    'Legacy smoke compatibility is restored.',
    'Smoke fails before useful checks.',
    17,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_18',
    'completed_this_pass',
    18,
    'cleanup',
    'Retired active test_write files',
    'completed',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'test_write files are moved out of active root.',
    'Temporary files do not pollute package.',
    'Smoke hygiene fails.',
    18,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_19',
    'completed_this_pass',
    19,
    'roadmap',
    'Replaced completed/next 20 Markdown lists',
    'completed',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'DEVELOPMENT_ROADMAP.md contains schema 130 completed and next steps.',
    'Next work is clear.',
    'Work repeats or scatters.',
    19,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_done_20',
    'completed_this_pass',
    20,
    'issues',
    'Updated Known Issues and Gaps',
    'completed',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Known issues list calls out schema 130 deployment and remaining depth gaps.',
    'Deployment/feature gaps are clear.',
    'Operators chase stale issues.',
    20,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_01',
    'next_20',
    1,
    'accounting',
    'Build real payment application form and buttons',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Payment apply/reverse/discount/write-off/overpayment actions work in Admin.',
    'Cash application becomes usable.',
    'Cash application remains tracked only.',
    101,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_02',
    'next_20',
    2,
    'accounting',
    'Create payment proof package generator',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Proof package rows produce downloadable manifest and proof bundle.',
    'Payment review is exportable.',
    'Proof remains manual.',
    102,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_03',
    'next_20',
    3,
    'banking',
    'Build bank CSV preview importer',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'CSV rows stage with header, duplicate, date, and amount-sign validation.',
    'Bad imports are blocked before posting.',
    'Bad data can enter review.',
    103,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_04',
    'next_20',
    4,
    'banking',
    'Build reconciliation match/split/undo/signoff UI',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Reviewer can match, split, undo, note, and sign off rows.',
    'Bank reconciliation becomes auditable.',
    'Reconciliation remains manual.',
    104,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_05',
    'next_20',
    5,
    'banking',
    'Add match confidence scoring',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Rows show confidence from amount/date/reference/customer matches.',
    'Reviewer can prioritize likely matches.',
    'Manual review is slower.',
    105,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_06',
    'next_20',
    6,
    'tax',
    'Build HST/GST review package screen',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Source totals, adjustments, filed date, remitted date, proof, and lock status are visible.',
    'Tax review is traceable.',
    'Tax evidence stays scattered.',
    106,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_07',
    'next_20',
    7,
    'payroll',
    'Build payroll remittance review screen',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Pay runs, deductions, employer costs, proof, and signoff are visible.',
    'Payroll remittance review is traceable.',
    'Payroll proof stays manual.',
    107,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_08',
    'next_20',
    8,
    'close',
    'Build month-end close lock/reopen controls',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Closed periods block postings unless reopened with reason and role.',
    'Accounting close becomes safer.',
    'Late edits can alter closed periods.',
    108,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_09',
    'next_20',
    9,
    'export',
    'Generate accountant export package files',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'CSV/JSON/proof files and manifest are generated from close rows.',
    'Accountant handoff is complete.',
    'Exports remain manual.',
    109,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_10',
    'next_20',
    10,
    'equipment',
    'Implement camera BarcodeDetector scan',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Camera scan fills QR/barcode/equipment code with manual fallback.',
    'Field equipment handling is faster.',
    'Manual entry remains default.',
    110,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_11',
    'next_20',
    11,
    'equipment',
    'Add accessory template DB tables',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Accessory templates auto-load by equipment category/pool.',
    'Missing accessories are easier to catch.',
    'Free-text accessories stay inconsistent.',
    111,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_12',
    'next_20',
    12,
    'equipment',
    'Enforce verifier roles server-side',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Return, defect clear, and return-to-service actions require the configured role.',
    'UI bypass cannot clear equipment incorrectly.',
    'Role enforcement is only visual.',
    112,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_13',
    'next_20',
    13,
    'equipment',
    'Turn failed tests into assignable service work orders',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Failed arrival/return tests create assigned tasks with proof, due date, and cost.',
    'Lockouts become actionable.',
    'Failed tests stay loose.',
    113,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_14',
    'next_20',
    14,
    'equipment',
    'Add return-to-service proof upload',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Locked-out equipment requires proof before availability.',
    'Unsafe equipment stays blocked.',
    'Defect clear can be too easy.',
    114,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_15',
    'next_20',
    15,
    'seo',
    'Generate sitemap.xml and robots.txt',
    'planned',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Approved public route rows generate deployable sitemap/robots files.',
    'Crawlers have cleaner route signals.',
    'Technical SEO remains manual.',
    115,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_16',
    'next_20',
    16,
    'seo',
    'Add broken-link and broken-asset smoke checks',
    'planned',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Smoke flags missing routes, images, scripts, styles, and manifests.',
    'Public errors are caught before deploy.',
    'Broken links can ship.',
    116,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_17',
    'next_20',
    17,
    'seo',
    'Add JSON-LD validation queue',
    'planned',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Structured data rows parse and pass required-field checks before publication.',
    'Search snippets are safer.',
    'Structured data can drift.',
    117,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_18',
    'next_20',
    18,
    'seo',
    'Add image alt/local proof scoring',
    'planned',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Public images require alt/caption/local proof before route publication.',
    'Local proof stays truthful and accessible.',
    'Weak gallery blocks can publish.',
    118,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_19',
    'next_20',
    19,
    'mobile',
    'Add offline conflict resolution UI',
    'planned',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Users can retry, keep local, or discard local drafts when server state changed.',
    'Mobile sync feels safer.',
    'Draft conflicts are confusing.',
    119,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
    now()
  ),
  (
    'schema130_next_20',
    'next_20',
    20,
    'fallback',
    'Add fallback drill run history',
    'planned',
    'medium',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Operators can mark fallback drills run/pass/fail with notes.',
    'Fallbacks are tested, not just listed.',
    'Recovery plans stay unproven.',
    120,
    '{"build":"2026-06-04b","schema":130}'::jsonb,
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

drop view if exists public.v_app_payment_execution_queue;
create view public.v_app_payment_execution_queue as
select action_key, action_area, action_title, action_status, required_role, route_hint, source_rows_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_payment_execution_queue
order by sort_order, action_key;

drop view if exists public.v_app_bank_reconciliation_execution_queue;
create view public.v_app_bank_reconciliation_execution_queue as
select action_key, action_area, action_title, action_status, route_hint, source_rows_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_bank_reconciliation_execution_queue
order by sort_order, action_key;

drop view if exists public.v_app_equipment_scan_template_registry;
create view public.v_app_equipment_scan_template_registry as
select action_key, equipment_area, action_title, action_status, required_role, scanner_status, service_task_behavior, fallback_hint, sort_order, checked_at, updated_at
from public.app_equipment_scan_template_registry
order by sort_order, action_key;

drop view if exists public.v_app_local_seo_execution_queue;
create view public.v_app_local_seo_execution_queue as
select action_key, seo_area, action_title, action_status, required_evidence, local_wording_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_local_seo_execution_queue
order by sort_order, action_key;

drop view if exists public.v_app_fallback_drill_queue;
create view public.v_app_fallback_drill_queue as
select drill_key, app_surface, drill_title, drill_status, trigger_hint, expected_fallback, recovery_hint, owner_hint, sort_order, checked_at, updated_at
from public.app_fallback_drill_queue
order by sort_order, drill_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  130::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 130
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 130
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 130.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version, migration_key, schema_name, release_label, description, status, notes
)
values (
  130,
  '130_payment_reconciliation_equipment_scan_local_seo_execution_playbooks',
  '130_payment_reconciliation_equipment_scan_local_seo_execution_playbooks.sql',
  '2026-06-04b',
  'Adds Admin-visible execution queues for payment application, bank reconciliation, equipment scan/template work, local SEO publication, and fallback drills.',
  'applied',
  'This pass converts the next 20 roadmap items into DB-visible execution rows and keeps schema/docs/cache/smoke guardrails aligned.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_payment_execution_queue to authenticated;
grant select on public.app_bank_reconciliation_execution_queue to authenticated;
grant select on public.app_equipment_scan_template_registry to authenticated;
grant select on public.app_local_seo_execution_queue to authenticated;
grant select on public.app_fallback_drill_queue to authenticated;
grant select on public.v_app_payment_execution_queue to authenticated;
grant select on public.v_app_bank_reconciliation_execution_queue to authenticated;
grant select on public.v_app_equipment_scan_template_registry to authenticated;
grant select on public.v_app_local_seo_execution_queue to authenticated;
grant select on public.v_app_fallback_drill_queue to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
