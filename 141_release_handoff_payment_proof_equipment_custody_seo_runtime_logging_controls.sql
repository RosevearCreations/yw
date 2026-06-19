-- Schema 141: Release handoff, payment posting proof, equipment custody evidence,
-- SEO conversion evidence, and runtime fallback logging controls.
-- Build 2026-06-09b.
--
-- Repaired:
-- 1. Supports existing partial/older app_payment_posting_proof_queue tables that already have proof_area NOT NULL.
-- 2. Adds/uses both proof_area and payment_area so either schema shape remains compatible.
-- 3. Fixes app_seo_conversion_evidence_queue VALUES row lengths.
-- 4. Keeps schema 141 idempotent after failed partial deploy attempts.

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
  step_batch text not null default 'next_20',
  step_number integer not null default 0,
  step_area text not null default 'general',
  step_title text not null default 'Roadmap action',
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

alter table public.app_roadmap_action_steps add column if not exists step_batch text not null default 'next_20';
alter table public.app_roadmap_action_steps add column if not exists step_number integer not null default 0;
alter table public.app_roadmap_action_steps add column if not exists step_area text not null default 'general';
alter table public.app_roadmap_action_steps add column if not exists step_title text not null default 'Roadmap action';
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
alter table public.app_roadmap_action_steps
  add constraint app_roadmap_action_steps_step_batch_check
  check (step_batch in ('completed_this_pass','next_20'));

alter table public.app_roadmap_action_steps drop constraint if exists app_roadmap_action_steps_step_status_check;
alter table public.app_roadmap_action_steps
  add constraint app_roadmap_action_steps_step_status_check
  check (step_status in ('completed','in_progress','planned','blocked','review'));

create table if not exists public.app_release_handoff_queue (
  handoff_key text primary key,
  handoff_area text not null default 'release',
  handoff_title text not null default 'Release handoff',
  handoff_status text not null default 'planned',
  release_evidence_hint text,
  deploy_action_hint text,
  rollback_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_release_handoff_queue add column if not exists handoff_area text not null default 'release';
alter table public.app_release_handoff_queue add column if not exists handoff_title text not null default 'Release handoff';
alter table public.app_release_handoff_queue add column if not exists handoff_status text not null default 'planned';
alter table public.app_release_handoff_queue add column if not exists release_evidence_hint text;
alter table public.app_release_handoff_queue add column if not exists deploy_action_hint text;
alter table public.app_release_handoff_queue add column if not exists rollback_hint text;
alter table public.app_release_handoff_queue add column if not exists fallback_hint text;
alter table public.app_release_handoff_queue add column if not exists sort_order integer not null default 100;
alter table public.app_release_handoff_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_release_handoff_queue add column if not exists checked_at timestamptz;
alter table public.app_release_handoff_queue add column if not exists updated_at timestamptz not null default now();

create unique index if not exists app_release_handoff_queue_handoff_key_uidx
  on public.app_release_handoff_queue (handoff_key);

create table if not exists public.app_payment_posting_proof_queue (
  proof_key text primary key,
  proof_area text not null default 'payment',
  payment_area text not null default 'payment',
  proof_title text not null default 'Payment posting proof',
  proof_status text not null default 'planned',
  owner_role text not null default 'admin',
  source_rows_hint text,
  proof_required_hint text,
  posting_or_close_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_payment_posting_proof_queue add column if not exists proof_area text not null default 'payment';
alter table public.app_payment_posting_proof_queue add column if not exists payment_area text not null default 'payment';
alter table public.app_payment_posting_proof_queue add column if not exists proof_title text not null default 'Payment posting proof';
alter table public.app_payment_posting_proof_queue add column if not exists proof_status text not null default 'planned';
alter table public.app_payment_posting_proof_queue add column if not exists owner_role text not null default 'admin';
alter table public.app_payment_posting_proof_queue add column if not exists source_rows_hint text;
alter table public.app_payment_posting_proof_queue add column if not exists proof_required_hint text;
alter table public.app_payment_posting_proof_queue add column if not exists posting_or_close_hint text;
alter table public.app_payment_posting_proof_queue add column if not exists fallback_hint text;
alter table public.app_payment_posting_proof_queue add column if not exists sort_order integer not null default 100;
alter table public.app_payment_posting_proof_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_payment_posting_proof_queue add column if not exists checked_at timestamptz;
alter table public.app_payment_posting_proof_queue add column if not exists updated_at timestamptz not null default now();

update public.app_payment_posting_proof_queue
set
  proof_area = coalesce(proof_area, payment_area, 'payment'),
  payment_area = coalesce(payment_area, proof_area, 'payment'),
  owner_role = coalesce(owner_role, 'admin'),
  proof_status = coalesce(proof_status, 'planned'),
  proof_title = coalesce(proof_title, 'Payment posting proof'),
  sort_order = coalesce(sort_order, 100),
  metadata = coalesce(metadata, '{}'::jsonb),
  updated_at = coalesce(updated_at, now());

create unique index if not exists app_payment_posting_proof_queue_proof_key_uidx
  on public.app_payment_posting_proof_queue (proof_key);

create table if not exists public.app_equipment_custody_evidence_queue (
  evidence_key text primary key,
  custody_area text not null default 'equipment',
  evidence_title text not null default 'Equipment custody evidence',
  evidence_status text not null default 'planned',
  required_scan_or_signature text,
  required_photo_or_note text,
  accounting_or_service_link text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_equipment_custody_evidence_queue add column if not exists custody_area text not null default 'equipment';
alter table public.app_equipment_custody_evidence_queue add column if not exists evidence_title text not null default 'Equipment custody evidence';
alter table public.app_equipment_custody_evidence_queue add column if not exists evidence_status text not null default 'planned';
alter table public.app_equipment_custody_evidence_queue add column if not exists required_scan_or_signature text;
alter table public.app_equipment_custody_evidence_queue add column if not exists required_photo_or_note text;
alter table public.app_equipment_custody_evidence_queue add column if not exists accounting_or_service_link text;
alter table public.app_equipment_custody_evidence_queue add column if not exists fallback_hint text;
alter table public.app_equipment_custody_evidence_queue add column if not exists sort_order integer not null default 100;
alter table public.app_equipment_custody_evidence_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_equipment_custody_evidence_queue add column if not exists checked_at timestamptz;
alter table public.app_equipment_custody_evidence_queue add column if not exists updated_at timestamptz not null default now();

create unique index if not exists app_equipment_custody_evidence_queue_evidence_key_uidx
  on public.app_equipment_custody_evidence_queue (evidence_key);

create table if not exists public.app_seo_conversion_evidence_queue (
  evidence_key text primary key,
  route_key text,
  evidence_area text not null default 'seo',
  evidence_title text not null default 'SEO conversion evidence',
  evidence_status text not null default 'planned',
  search_phrase_hint text,
  page_evidence_hint text,
  conversion_path_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_seo_conversion_evidence_queue add column if not exists route_key text;
alter table public.app_seo_conversion_evidence_queue add column if not exists evidence_area text not null default 'seo';
alter table public.app_seo_conversion_evidence_queue add column if not exists evidence_title text not null default 'SEO conversion evidence';
alter table public.app_seo_conversion_evidence_queue add column if not exists evidence_status text not null default 'planned';
alter table public.app_seo_conversion_evidence_queue add column if not exists search_phrase_hint text;
alter table public.app_seo_conversion_evidence_queue add column if not exists page_evidence_hint text;
alter table public.app_seo_conversion_evidence_queue add column if not exists conversion_path_hint text;
alter table public.app_seo_conversion_evidence_queue add column if not exists fallback_hint text;
alter table public.app_seo_conversion_evidence_queue add column if not exists sort_order integer not null default 100;
alter table public.app_seo_conversion_evidence_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_seo_conversion_evidence_queue add column if not exists checked_at timestamptz;
alter table public.app_seo_conversion_evidence_queue add column if not exists updated_at timestamptz not null default now();

create unique index if not exists app_seo_conversion_evidence_queue_evidence_key_uidx
  on public.app_seo_conversion_evidence_queue (evidence_key);

create table if not exists public.app_runtime_fallback_event_log_queue (
  event_key text primary key,
  app_surface text not null default 'app',
  event_title text not null default 'Runtime fallback event',
  event_status text not null default 'planned',
  detection_hint text,
  log_payload_hint text,
  owner_action_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_runtime_fallback_event_log_queue add column if not exists app_surface text not null default 'app';
alter table public.app_runtime_fallback_event_log_queue add column if not exists event_title text not null default 'Runtime fallback event';
alter table public.app_runtime_fallback_event_log_queue add column if not exists event_status text not null default 'planned';
alter table public.app_runtime_fallback_event_log_queue add column if not exists detection_hint text;
alter table public.app_runtime_fallback_event_log_queue add column if not exists log_payload_hint text;
alter table public.app_runtime_fallback_event_log_queue add column if not exists owner_action_hint text;
alter table public.app_runtime_fallback_event_log_queue add column if not exists fallback_hint text;
alter table public.app_runtime_fallback_event_log_queue add column if not exists sort_order integer not null default 100;
alter table public.app_runtime_fallback_event_log_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_runtime_fallback_event_log_queue add column if not exists checked_at timestamptz;
alter table public.app_runtime_fallback_event_log_queue add column if not exists updated_at timestamptz not null default now();

create unique index if not exists app_runtime_fallback_event_log_queue_event_key_uidx
  on public.app_runtime_fallback_event_log_queue (event_key);

insert into public.app_release_handoff_queue (
  handoff_key,
  handoff_area,
  handoff_title,
  handoff_status,
  release_evidence_hint,
  deploy_action_hint,
  rollback_hint,
  fallback_hint,
  sort_order,
  metadata,
  checked_at
)
values
  (
    'schema_140_full_reference_repair',
    'schema',
    'Canonical full schema carries the repaired schema 140 insert',
    'completed',
    'sql/000_full_schema_reference.sql uses the same 12-column app_local_seo_conversion_queue insert shape as the standalone schema 140 file.',
    'Run schema 140 only if live database did not already apply the repaired file, then apply schema 141.',
    'Use standalone schema files before full-schema restore if a compact insert regresses.',
    'Keep a verified code block repair in NEW_CHAT_STATUS.md for handoff.',
    10,
    '{"build":"2026-06-09b","schema":141}'::jsonb,
    now()
  ),
  (
    'release_handoff_bundle',
    'release',
    'Create deploy handoff showing schema order, function redeploys, cache marker, and smoke result',
    'in_progress',
    'Schema 141 migration, admin-directory update, docs, sitemap/robots, cache marker, and smoke output.',
    'Apply schema 141, redeploy admin-directory, then redeploy jobs functions only if live versions are behind.',
    'Rollback by restoring previous zip and leaving DB at latest applied schema; views are additive.',
    'Use cached Admin empty-table fallback if optional views are not live yet.',
    20,
    '{"build":"2026-06-09b","schema":141}'::jsonb,
    now()
  ),
  (
    'markdown_schema_sync_handoff',
    'docs',
    'Markdown and schema notes describe the next 20 steps after schema 141',
    'completed',
    'Development Roadmap, Known Issues and Gaps, changelog, database notes, project state, and new schema doc are updated.',
    'Use NEW_CHAT_STATUS.md as the next-chat handoff.',
    'Return to schema 140 bundle only if schema 141 cannot be deployed.',
    'Archive snapshots preserve previous root docs.',
    30,
    '{"build":"2026-06-09b","schema":141}'::jsonb,
    now()
  )
on conflict (handoff_key) do update set
  handoff_area = excluded.handoff_area,
  handoff_title = excluded.handoff_title,
  handoff_status = excluded.handoff_status,
  release_evidence_hint = excluded.release_evidence_hint,
  deploy_action_hint = excluded.deploy_action_hint,
  rollback_hint = excluded.rollback_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_payment_posting_proof_queue (
  proof_key,
  proof_area,
  payment_area,
  proof_title,
  proof_status,
  owner_role,
  source_rows_hint,
  proof_required_hint,
  posting_or_close_hint,
  fallback_hint,
  sort_order,
  metadata,
  checked_at
)
values
  (
    'cash_application_proof',
    'payment_application',
    'payment_application',
    'Require proof before posting applied cash, refunds, write-offs, or overpayments',
    'planned',
    'admin',
    'Payment closeout queue, invoice balance, bank match, adjustment reason, and reviewer profile.',
    'Attach receipt/bank row/reference plus approval reason and tax handling where applicable.',
    'Post or close only after proof and reviewer approval are present.',
    'Leave row in exception queue and include it in accountant export.',
    10,
    '{"build":"2026-06-09b","schema":141}'::jsonb,
    now()
  ),
  (
    'reconciliation_exception_proof',
    'reconciliation',
    'reconciliation',
    'Require proof notes for low-confidence, split, duplicate, and unmatched bank decisions',
    'planned',
    'admin',
    'Bank staging rows, match score, accepted/rejected candidates, split rows, and undo history.',
    'Reviewer note explains decision and source evidence.',
    'Accepted rows lock after close; unresolved rows move to export package.',
    'Manual CSV review remains fallback until full posting UI exists.',
    20,
    '{"build":"2026-06-09b","schema":141}'::jsonb,
    now()
  ),
  (
    'close_period_payment_block',
    'month_end_close',
    'month_end_close',
    'Block close if material payment exceptions lack proof or export owner',
    'planned',
    'admin',
    'Open payment/reconciliation exceptions, materiality, due date, owner, and package inclusion.',
    'Each exception needs reviewer signoff or approved blocker override.',
    'Close package records unresolved items and handoff owner.',
    'Keep close in review status until approved.',
    30,
    '{"build":"2026-06-09b","schema":141}'::jsonb,
    now()
  )
on conflict (proof_key) do update set
  proof_area = excluded.proof_area,
  payment_area = excluded.payment_area,
  proof_title = excluded.proof_title,
  proof_status = excluded.proof_status,
  owner_role = excluded.owner_role,
  source_rows_hint = excluded.source_rows_hint,
  proof_required_hint = excluded.proof_required_hint,
  posting_or_close_hint = excluded.posting_or_close_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_equipment_custody_evidence_queue (
  evidence_key,
  custody_area,
  evidence_title,
  evidence_status,
  required_scan_or_signature,
  required_photo_or_note,
  accounting_or_service_link,
  fallback_hint,
  sort_order,
  metadata,
  checked_at
)
values
  (
    'checkout_site_arrival_return_evidence',
    'chain_of_custody',
    'Require scan/signature evidence across checkout, site arrival, return, and return-to-service',
    'in_progress',
    'QR/barcode/manual code plus worker/supervisor/admin signature names and timestamps.',
    'Condition, accessory checklist, and notes/photo reference when damaged/missing.',
    'Failed test creates service task and cost recovery/write-off review if needed.',
    'Manual entry remains fallback when scanner is unavailable.',
    10,
    '{"build":"2026-06-09b","schema":141}'::jsonb,
    now()
  ),
  (
    'accessory_replacement_cost_evidence',
    'accessory_costs',
    'Tie missing/damaged accessory proof to replacement cost or write-off decision',
    'planned',
    'Accessory checklist status, missing/damaged item, replacement cost, owner, and decision.',
    'Photo/note or supervisor signoff explains the exception.',
    'Billable/internal/warranty/write-off decision flows to job profitability/accountant export.',
    'Keep exception visible until a cost decision exists.',
    20,
    '{"build":"2026-06-09b","schema":141}'::jsonb,
    now()
  ),
  (
    'equipment_override_evidence',
    'lockout_override',
    'Require evidence and reason before overriding equipment lockout',
    'planned',
    'Open lockout/service task, verifier role, override reason, and admin profile.',
    'Proof gap and mitigation note are required if normal service proof is missing.',
    'Override remains auditable and can still create follow-up service task.',
    'Keep equipment locked out when evidence is weak.',
    30,
    '{"build":"2026-06-09b","schema":141}'::jsonb,
    now()
  )
on conflict (evidence_key) do update set
  custody_area = excluded.custody_area,
  evidence_title = excluded.evidence_title,
  evidence_status = excluded.evidence_status,
  required_scan_or_signature = excluded.required_scan_or_signature,
  required_photo_or_note = excluded.required_photo_or_note,
  accounting_or_service_link = excluded.accounting_or_service_link,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_seo_conversion_evidence_queue (
  evidence_key,
  route_key,
  evidence_area,
  evidence_title,
  evidence_status,
  search_phrase_hint,
  page_evidence_hint,
  conversion_path_hint,
  fallback_hint,
  sort_order,
  metadata,
  checked_at
)
values
  (
    'local_home_conversion_path',
    'home',
    'home_page',
    'Home page local wording connects to contact/quote path',
    'in_progress',
    'Primary service, location/service area, and plain user search terms in title/H1/body.',
    'One H1, meta description, sitemap/robots, image alt, and honest local proof block.',
    'CTA goes to contact/quote/booking path without dead internal links.',
    'Keep static homepage as fallback until service pages mature.',
    10,
    '{"build":"2026-06-09b","schema":141}'::jsonb,
    now()
  ),
  (
    'service_area_route_proof',
    'service_area',
    'service_area',
    'Approved service-area route proof before internal linking',
    'planned',
    'Only real served areas and services should appear in route/title/internal links.',
    'Route has proof, title/meta, one clear H1, and no unsupported locality claims.',
    'Internal links help users compare proof, pricing/quote, or contact actions.',
    'Hold location pages in draft if proof is weak.',
    20,
    '{"build":"2026-06-09b","schema":141}'::jsonb,
    now()
  ),
  (
    'seo_conversion_release_smoke',
    'technical_seo',
    'technical_seo',
    'Smoke-test local SEO wording and conversion links together',
    'planned',
    'Sitemap, robots, title/H1/meta, local terms, image alt, link targets, and CTA anchors.',
    'Smoke check catches missing assets, stale cache marker, unsupported routes, and dead links.',
    'Release cannot treat SEO as passing when the user action path is broken.',
    'Keep unpublished routes out of sitemap.',
    30,
    '{"build":"2026-06-09b","schema":141}'::jsonb,
    now()
  )
on conflict (evidence_key) do update set
  route_key = excluded.route_key,
  evidence_area = excluded.evidence_area,
  evidence_title = excluded.evidence_title,
  evidence_status = excluded.evidence_status,
  search_phrase_hint = excluded.search_phrase_hint,
  page_evidence_hint = excluded.page_evidence_hint,
  conversion_path_hint = excluded.conversion_path_hint,
  fallback_hint = excluded.fallback_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  checked_at = excluded.checked_at,
  updated_at = now();

insert into public.app_runtime_fallback_event_log_queue (
  event_key,
  app_surface,
  event_title,
  event_status,
  detection_hint,
  log_payload_hint,
  owner_action_hint,
  fallback_hint,
  sort_order,
  metadata,
  checked_at
)
values
  (
    'optional_view_missing_log',
    'admin_directory',
    'Log optional-view missing fallback with view name and schema marker',
    'planned',
    'safeList catches missing relation/view after partial schema deploy.',
    'view name, scope, schema drift status, cache marker, and actor role.',
    'Redeploy function or apply missing schema; count repeated misses.',
    'Show empty table with apply schema message.',
    10,
    '{"build":"2026-06-09b","schema":141}'::jsonb,
    now()
  ),
  (
    'accounting_blocked_log',
    'accounting',
    'Log blocked accounting actions with proof/lock reason',
    'planned',
    'Payment or reconciliation action cannot post due to missing proof, approval, or close lock.',
    'action key, blocker, source rows, reviewer, close period, and suggested next action.',
    'Admin/accountant attaches proof, approves blocker, or exports exception.',
    'Do not auto-retry blocked accounting actions.',
    20,
    '{"build":"2026-06-09b","schema":141}'::jsonb,
    now()
  ),
  (
    'offline_conflict_log',
    'mobile_offline',
    'Log offline draft conflicts without discarding local work',
    'review',
    'Local draft conflicts with changed server row or failed sync retry.',
    'draft key, entity, local timestamp, server timestamp, and selected resolution.',
    'Supervisor chooses retry, keep local, or discard after confirmation.',
    'Keep local draft until acknowledged.',
    30,
    '{"build":"2026-06-09b","schema":141}'::jsonb,
    now()
  )
on conflict (event_key) do update set
  app_surface = excluded.app_surface,
  event_title = excluded.event_title,
  event_status = excluded.event_status,
  detection_hint = excluded.detection_hint,
  log_payload_hint = excluded.log_payload_hint,
  owner_action_hint = excluded.owner_action_hint,
  fallback_hint = excluded.fallback_hint,
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
    'schema141_done_01',
    'completed_this_pass',
    1,
    'schema',
    'Added schema 141 release handoff and evidence queues',
    'completed',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Migration and full schema include schema 141.',
    'Release handoff, payment proof, equipment custody evidence, SEO conversion evidence, and fallback event logging are visible in Admin readiness.',
    'Release proof remains scattered across Markdown.',
    1,
    '{"build":"2026-06-09b","schema":141}'::jsonb,
    now()
  ),
  (
    'schema141_done_02',
    'completed_this_pass',
    2,
    'schema',
    'Repaired schema 140 block inside canonical full schema reference',
    'completed',
    'high',
    'KNOWN_ISSUES_AND_GAPS.md',
    'sql/000_full_schema_reference.sql',
    'Full schema app_local_seo_conversion_queue values match the explicit column list.',
    'Full-schema deploy no longer repeats the schema 140 VALUES-list mismatch.',
    'The same schema 140 error returns during full schema deploy.',
    2,
    '{"build":"2026-06-09b","schema":141}'::jsonb,
    now()
  ),
  (
    'schema141_done_03',
    'completed_this_pass',
    3,
    'cleanup',
    'Archived retired helper Markdown and root test files',
    'completed',
    'high',
    'TESTING_CHECKLIST.md',
    'archive',
    'Smoke root hygiene checks pass.',
    'Temporary files and retired helper docs stay out of the active deployment root.',
    'Smoke fails before feature checks.',
    3,
    '{"build":"2026-06-09b","schema":141}'::jsonb,
    now()
  ),
  (
    'schema141_next_01',
    'next_20',
    1,
    'admin',
    'Turn release handoff queue into a deploy checklist with copyable order',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Admin shows schema order, function deploy order, cache clear, and smoke status in one checklist.',
    'Release handoff becomes operational.',
    'Deploy notes remain manual.',
    101,
    '{"build":"2026-06-09b","schema":141}'::jsonb,
    now()
  ),
  (
    'schema141_next_02',
    'next_20',
    2,
    'accounting',
    'Build payment posting proof upload/reason controls',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#admin',
    'Payment closeout actions require proof, reviewer, and reason before posting.',
    'Accounting close gains audit depth.',
    'Cash decisions remain notes-only.',
    102,
    '{"build":"2026-06-09b","schema":141}'::jsonb,
    now()
  ),
  (
    'schema141_next_03',
    'next_20',
    3,
    'equipment',
    'Build equipment custody evidence timeline and cost recovery decision actions',
    'planned',
    'high',
    'DEVELOPMENT_ROADMAP.md',
    '#jobs',
    'Timeline displays checkout/arrival/return/service/cost proof with action buttons.',
    'Equipment accountability and job profitability connect.',
    'Damage/missing accessories stay hard to audit.',
    103,
    '{"build":"2026-06-09b","schema":141}'::jsonb,
    now()
  ),
  (
    'schema141_next_04',
    'next_20',
    4,
    'seo',
    'Add local SEO conversion evidence checks to smoke script',
    'planned',
    'medium',
    'TESTING_CHECKLIST.md',
    '/',
    'Smoke checks sitemap/robots/H1/meta/local wording/internal links/CTA targets together.',
    'Search visibility and conversion path stay connected.',
    'Public pages may rank but not convert.',
    104,
    '{"build":"2026-06-09b","schema":141}'::jsonb,
    now()
  ),
  (
    'schema141_next_05',
    'next_20',
    5,
    'runtime',
    'Create fallback event log table from UI and Edge Function failures',
    'planned',
    'medium',
    'KNOWN_ISSUES_AND_GAPS.md',
    '#admin',
    'Runtime fallback events persist with surface, payload, owner, and action.',
    'Repeated problems become measurable.',
    'Fallback issues stay anecdotal.',
    105,
    '{"build":"2026-06-09b","schema":141}'::jsonb,
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

drop view if exists public.v_app_release_handoff_queue;

create view public.v_app_release_handoff_queue as
select
  handoff_key,
  handoff_area,
  handoff_title,
  handoff_status,
  release_evidence_hint,
  deploy_action_hint,
  rollback_hint,
  fallback_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_release_handoff_queue
order by sort_order, handoff_key;

drop view if exists public.v_app_payment_posting_proof_queue;

create view public.v_app_payment_posting_proof_queue as
select
  proof_key,
  proof_area,
  payment_area,
  proof_title,
  proof_status,
  owner_role,
  source_rows_hint,
  proof_required_hint,
  posting_or_close_hint,
  fallback_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_payment_posting_proof_queue
order by sort_order, proof_key;

drop view if exists public.v_app_equipment_custody_evidence_queue;

create view public.v_app_equipment_custody_evidence_queue as
select
  evidence_key,
  custody_area,
  evidence_title,
  evidence_status,
  required_scan_or_signature,
  required_photo_or_note,
  accounting_or_service_link,
  fallback_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_equipment_custody_evidence_queue
order by sort_order, evidence_key;

drop view if exists public.v_app_seo_conversion_evidence_queue;

create view public.v_app_seo_conversion_evidence_queue as
select
  evidence_key,
  route_key,
  evidence_area,
  evidence_title,
  evidence_status,
  search_phrase_hint,
  page_evidence_hint,
  conversion_path_hint,
  fallback_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_seo_conversion_evidence_queue
order by sort_order, evidence_key;

drop view if exists public.v_app_runtime_fallback_event_log_queue;

create view public.v_app_runtime_fallback_event_log_queue as
select
  event_key,
  app_surface,
  event_title,
  event_status,
  detection_hint,
  log_payload_hint,
  owner_action_hint,
  fallback_hint,
  sort_order,
  checked_at,
  updated_at
from public.app_runtime_fallback_event_log_queue
order by sort_order, event_key;

drop view if exists public.v_schema_drift_status;

create view public.v_schema_drift_status as
select
  141::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 141
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 141
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 141.'
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
  141,
  '141_release_handoff_payment_proof_equipment_custody_seo_runtime_logging_controls',
  '141_release_handoff_payment_proof_equipment_custody_seo_runtime_logging_controls.sql',
  '2026-06-09b',
  'Adds release handoff, payment posting proof, equipment custody evidence, SEO conversion evidence, and runtime fallback event-log readiness queues.',
  'applied',
  'Also keeps the schema 140 canonical full schema repair visible so full-schema deploys do not reintroduce the VALUES-list mismatch. This repaired version is defensive against partial schema 141 attempts where queue tables already exist with proof_area and/or payment_area column variants.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_release_handoff_queue to authenticated;
grant select on public.app_payment_posting_proof_queue to authenticated;
grant select on public.app_equipment_custody_evidence_queue to authenticated;
grant select on public.app_seo_conversion_evidence_queue to authenticated;
grant select on public.app_runtime_fallback_event_log_queue to authenticated;

grant select on public.v_app_release_handoff_queue to authenticated;
grant select on public.v_app_payment_posting_proof_queue to authenticated;
grant select on public.v_app_equipment_custody_evidence_queue to authenticated;
grant select on public.v_app_seo_conversion_evidence_queue to authenticated;
grant select on public.v_app_runtime_fallback_event_log_queue to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
