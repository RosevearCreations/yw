-- Schema 135: release validation, payment/reconciliation execution, equipment scan, local SEO, fallback message, and JSON/DB migration controls.
-- Build 2026-06-06b.
-- This pass keeps schema, Markdown, CSS/SEO/H1, fallback, and Admin readiness queues aligned after schema 134.

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

create table if not exists public.app_release_validation_queue (
  validation_key text primary key,
  validation_area text not null,
  validation_title text not null,
  validation_status text not null default 'planned',
  required_evidence text,
  preflight_hint text,
  failure_response_hint text,
  owner_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_payment_reconciliation_execution_queue (
  execution_key text primary key,
  execution_area text not null,
  execution_title text not null,
  execution_status text not null default 'planned',
  input_validation_hint text,
  posting_or_match_hint text,
  approval_hint text,
  rollback_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_equipment_mobile_scan_validation_queue (
  validation_key text primary key,
  equipment_area text not null,
  validation_title text not null,
  validation_status text not null default 'planned',
  scan_hint text,
  accessory_hint text,
  verifier_hint text,
  service_task_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_local_seo_release_validation_queue (
  seo_key text primary key,
  route_key text,
  seo_area text not null,
  seo_title text not null,
  seo_status text not null default 'planned',
  phrase_hint text,
  one_h1_hint text,
  structured_data_hint text,
  internal_link_hint text,
  proof_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_runtime_fallback_message_queue (
  message_key text primary key,
  app_surface text not null,
  message_title text not null,
  message_status text not null default 'planned',
  trigger_hint text,
  user_copy_hint text,
  operator_copy_hint text,
  recovery_hint text,
  telemetry_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_json_db_migration_execution_queue (
  migration_key text primary key,
  data_area text not null,
  migration_title text not null,
  migration_status text not null default 'review',
  current_source_hint text,
  target_source_hint text,
  duplication_risk_hint text,
  execution_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_release_validation_queue (validation_key, validation_area, validation_title, validation_status, required_evidence, preflight_hint, failure_response_hint, owner_hint, sort_order, metadata, checked_at) values
('schema135_full_schema_sync','schema','Full schema and migration file both include schema 135','completed','sql/135 file and sql/000_full_schema_reference.sql contain the same schema 135 marker.','Run repo smoke before deploy.','Block deployment if schema drift view does not expect 135.','Admin / Developer',10,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('schema135_markdown_sync','documentation','Active Markdown files document completed and next 20 steps','completed','Development Roadmap, Known Issues and Gaps, Project State, New Chat Status, Deployment Guide, Testing Checklist, and Changelog updated.','Confirm Markdown contains schema 135 and next 20 section.','Do not ship without roadmap continuity.','Admin',20,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('schema135_public_seo_shell','seo','Public shell passes one-H1, sitemap, robots, and local wording checks','completed','index.html has one H1 and sitemap/robots remain present.','Run smoke and spot-check public title/meta/H1.','Hold public SEO release if H1/title/local wording drifts.','Content / SEO',30,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('schema135_css_fallback','runtime','CSS brace balance and service-worker fallback remain clean','completed','style.css brace balance is zero and service worker installs assets one at a time.','Run CSS and service worker syntax checks.','Keep previous stable build if cache install fails.','Admin / Developer',40,'{"build":"2026-06-06b","schema":135}'::jsonb,now())
on conflict (validation_key) do update set validation_area=excluded.validation_area, validation_title=excluded.validation_title, validation_status=excluded.validation_status, required_evidence=excluded.required_evidence, preflight_hint=excluded.preflight_hint, failure_response_hint=excluded.failure_response_hint, owner_hint=excluded.owner_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_payment_reconciliation_execution_queue (execution_key, execution_area, execution_title, execution_status, input_validation_hint, posting_or_match_hint, approval_hint, rollback_hint, fallback_hint, sort_order, metadata, checked_at) values
('payment_apply_screen_rules','payment_application','Payment apply screen requires customer, invoice, amount, source, date, and open period','planned','Validate positive amount, available unapplied balance, invoice balance, customer match, and open period.','Create staged application row before posting ledger effects.','Admin/accountant review when amount exceeds threshold or closed-period reopen is required.','Reverse through linked reversal action, never delete posted payment proof.','Keep action in review queue if posting tables are unavailable.',10,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('recon_csv_preview_rules','bank_reconciliation','Bank CSV preview blocks bad headers, duplicates, bad dates, and invalid amount signs','planned','Preview imported rows and classify accepted/rejected before staging.','Only accepted rows become reconciliation candidates.','Reviewer confirms import source and duplicate handling.','Undo import batch if accepted rows prove wrong before close.','Manual spreadsheet review remains fallback.',20,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('recon_match_exception_rules','bank_reconciliation','Reconciliation match workbench supports match, split, undo, and exception notes','planned','Require score, candidate source, reviewer decision, and exact split total.','Matched rows post only after balanced and approved.','Reviewer signs low-confidence matches and category assignments.','Undo returns rows to unmatched review state with audit reason.','Export exception list to accountant package.',30,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('close_period_payment_lock','month_end_close','Closed-period guard blocks payment and reconciliation changes without reopen reason','planned','Check period status before payment apply, adjustment, reversal, or reconciliation posting.','Block posting when close period is locked.','Reopen requires admin/accountant reason.','Reclose records who reopened and what changed.','Display blocked action message and keep staged row.',40,'{"build":"2026-06-06b","schema":135}'::jsonb,now())
on conflict (execution_key) do update set execution_area=excluded.execution_area, execution_title=excluded.execution_title, execution_status=excluded.execution_status, input_validation_hint=excluded.input_validation_hint, posting_or_match_hint=excluded.posting_or_match_hint, approval_hint=excluded.approval_hint, rollback_hint=excluded.rollback_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_equipment_mobile_scan_validation_queue (validation_key, equipment_area, validation_title, validation_status, scan_hint, accessory_hint, verifier_hint, service_task_hint, fallback_hint, sort_order, metadata, checked_at) values
('equipment_scan_manual_fallback','scan','Equipment checkout, arrival, return, and service closeout support scan plus manual entry','in_progress','Use BarcodeDetector/camera on HTTPS devices when available.','Load DB accessory template after the equipment code resolves.','Server verifies required role before status changes.','Failed tests create service task with equipment code prefilled.','Manual Scan / Enter Code remains visible when camera is unavailable.',10,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('equipment_accessory_template_enforcement','accessories','Accessory checklist compares expected, received, missing, damaged, and not-required items','planned','Scan or manual code selects equipment pool/category.','Expected accessory list comes from DB template, not free-text only.','Supervisor signs missing/damaged exception.','Missing/damaged accessory can create service task or return exception.','Free-text checklist remains fallback.',20,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('equipment_return_to_service_gate','lockout','Return-to-service requires service task proof before locked-out equipment becomes available','planned','Scan confirms the same equipment item before clearing.','Accessory status must be complete or explicitly not required.','Admin/supervisor role required based on verifier rule.','Service task closeout evidence and cost are linked to job profitability.','Keep locked out until proof exists.',30,'{"build":"2026-06-06b","schema":135}'::jsonb,now())
on conflict (validation_key) do update set equipment_area=excluded.equipment_area, validation_title=excluded.validation_title, validation_status=excluded.validation_status, scan_hint=excluded.scan_hint, accessory_hint=excluded.accessory_hint, verifier_hint=excluded.verifier_hint, service_task_hint=excluded.service_task_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_local_seo_release_validation_queue (seo_key, route_key, seo_area, seo_title, seo_status, phrase_hint, one_h1_hint, structured_data_hint, internal_link_hint, proof_hint, sort_order, metadata, checked_at) values
('seo_home_shell_validation','home_shell','technical_seo','Home shell title, meta, H1, sitemap, robots, and canonical local wording','completed','Use words real users search for in title/H1/body without stuffing.','One clear H1 only.','JSON-LD should match real business/service data only.','Link to real approved service/location pages.','Smoke check plus manual content review before publishing.',10,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('seo_service_location_depth','service_routes','local_content','Build approved service/location content only where service proof exists','planned','Target truthful local phrases for actual coverage areas.','Each route gets one clear H1 matching the page purpose.','Structured data must not overclaim service area.','Use internal links between related service and location pages.','Require photos/testimonials/work proof before publishing.',20,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('seo_asset_alt_link_check','assets','asset_quality','Image alt text, internal links, sitemap entries, and broken assets are checked before release','planned','Use descriptive alt text for real images and local proof.','H1 check remains global for public pages.','Structured data parses before publish.','Broken link/image smoke check runs before release.','Hide weak gallery blocks until proof is complete.',30,'{"build":"2026-06-06b","schema":135}'::jsonb,now())
on conflict (seo_key) do update set route_key=excluded.route_key, seo_area=excluded.seo_area, seo_title=excluded.seo_title, seo_status=excluded.seo_status, phrase_hint=excluded.phrase_hint, one_h1_hint=excluded.one_h1_hint, structured_data_hint=excluded.structured_data_hint, internal_link_hint=excluded.internal_link_hint, proof_hint=excluded.proof_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_runtime_fallback_message_queue (message_key, app_surface, message_title, message_status, trigger_hint, user_copy_hint, operator_copy_hint, recovery_hint, telemetry_hint, sort_order, metadata, checked_at) values
('msg_optional_view_missing','Admin readiness','Optional schema view missing after partial deploy','covered','Edge Function receives missing relation/view error.','This section is waiting for the latest schema. Apply the newest migration and refresh.','Missing readiness view; verify schema 135 applied before redeploying admin-directory.','Return empty table and keep the rest of Admin alive.','Capture view name and scope when telemetry is enabled.',10,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('msg_payment_blocked','Accounting workbench','Payment or reconciliation action blocked by missing proof or locked period','planned','Payment/reconciliation write action fails validation.','This action needs proof, review, or an open accounting period before it can post.','Check period lock, proof attachment, reviewer, and posting queue state.','Keep action staged and show missing requirement list.','Log action key, period id, and missing proof count.',20,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('msg_scan_unsupported','Equipment mobile','Camera scan unavailable on this device','covered','BarcodeDetector or camera permission is unavailable.','Camera scan is not available here. Please enter or paste the equipment code instead.','Manual fallback used; check device HTTPS/camera permissions before reporting bug.','Show manual entry dialog and continue workflow.','Track manual fallback count when telemetry exists.',30,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('msg_offline_conflict','Mobile forms','Offline draft conflicts with newer server state','review','Saved local draft is older/different than server row.','We found a saved draft and newer server data. Choose keep draft, use server copy, or review before syncing.','Conflict resolver must preserve both payloads until user chooses.','Do not discard local draft automatically.','Log form key, draft timestamp, and server timestamp.',40,'{"build":"2026-06-06b","schema":135}'::jsonb,now())
on conflict (message_key) do update set app_surface=excluded.app_surface, message_title=excluded.message_title, message_status=excluded.message_status, trigger_hint=excluded.trigger_hint, user_copy_hint=excluded.user_copy_hint, operator_copy_hint=excluded.operator_copy_hint, recovery_hint=excluded.recovery_hint, telemetry_hint=excluded.telemetry_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_json_db_migration_execution_queue (migration_key, data_area, migration_title, migration_status, current_source_hint, target_source_hint, duplication_risk_hint, execution_hint, fallback_hint, sort_order, metadata, checked_at) values
('json_to_db_equipment_templates','equipment','Move repeated accessory checklist definitions from UI/free text toward DB templates','planned','Manual/free-text accessory fields and equipment pool hints.','DB accessory template rows linked to equipment pool/category.','Free text can drift and make returns inconsistent.','Create templates, map equipment pools, then compare checkout/return rows to expected accessories.','Keep free-text checklist as fallback until templates are complete.',10,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('json_to_db_seo_routes','seo','Move public route SEO registry and sitemap source from static-only data toward DB-approved route rows','review','Static sitemap/robots and route guardrail rows.','Approved public route registry with title/meta/H1/local terms/proof status.','Static-only route files can publish unsupported local pages.','Generate sitemap/robots from approved DB route rows after proof checks pass.','Keep current static sitemap/robots until generator is tested.',20,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('json_to_db_error_messages','runtime','Move runtime error and fallback copy into reviewed DB/admin catalog','planned','Hard-coded UI fallback messages and function error strings.','Reviewed runtime message catalog with user copy and operator guidance.','Different screens can show confusing or conflicting recovery text.','Start with Admin/accounting/equipment messages, then expand to forms.','Keep hard-coded copy as fallback if catalog is unavailable.',30,'{"build":"2026-06-06b","schema":135}'::jsonb,now())
on conflict (migration_key) do update set data_area=excluded.data_area, migration_title=excluded.migration_title, migration_status=excluded.migration_status, current_source_hint=excluded.current_source_hint, target_source_hint=excluded.target_source_hint, duplication_risk_hint=excluded.duplication_risk_hint, execution_hint=excluded.execution_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_roadmap_action_steps (step_key, step_batch, step_number, step_area, step_title, step_status, priority, source_doc, route_hint, acceptance_check, implementation_notes, risk_if_skipped, sort_order, metadata, checked_at) values
('schema135_done_01','completed_this_pass',1,'schema','Added schema 135 release validation queues','completed','high','DEVELOPMENT_ROADMAP.md','#admin','Schema 135 migration and canonical full schema include release validation queues.','DB-visible validation rows now track payment/recon, equipment scan, SEO, runtime messages, and JSON/DB migration candidates.','Roadmap remains disconnected from deploy checks.',1,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('schema135_done_02','completed_this_pass',2,'admin','Exposed schema 135 queues in Admin readiness','completed','high','DEVELOPMENT_ROADMAP.md','#admin','admin-directory and admin-ui reference schema 135 views.','Operators can see new validation and migration queues.','New rows stay hidden.',2,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('schema135_done_03','completed_this_pass',3,'seo','Kept one-H1, sitemap, robots, and local SEO guardrails current','completed','high','DEVELOPMENT_ROADMAP.md','/','Smoke checks confirm one H1 and fresh SEO assets.','Search visibility guardrails stay in every pass.','SEO drift can hurt clarity.',3,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('schema135_done_04','completed_this_pass',4,'fallback','Added reviewed runtime fallback message queue','completed','medium','KNOWN_ISSUES_AND_GAPS.md','#admin','Runtime message rows include trigger, user copy, operator copy, recovery, and telemetry hints.','Fallback messaging becomes easier to standardize.','Users see inconsistent errors.',4,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('schema135_done_05','completed_this_pass',5,'data_migration','Added JSON/DB migration execution queue','completed','medium','KNOWN_ISSUES_AND_GAPS.md','#admin','Queue identifies equipment templates, SEO routes, and runtime messages as migration candidates.','Data duplication risks are visible.','Duplicate JSON/DB sources keep drifting.',5,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('schema135_next_01','next_20',1,'accounting','Build actual payment apply/reverse buttons against staged payment rows','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Admin can apply and reverse payments with audit reason.','Payment workflow becomes usable.','Payments remain manual.',101,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('schema135_next_02','next_20',2,'accounting','Build bank CSV preview, duplicate detector, and rejected-row report','planned','high','DEVELOPMENT_ROADMAP.md','#admin','CSV import preview blocks bad rows before staging.','Bank imports become safer.','Bad imports can enter review.',102,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('schema135_next_03','next_20',3,'accounting','Build match/split/undo reconciliation workbench','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Reviewer can match, split, undo, and sign off.','Bank reconciliation becomes auditable.','Unmatched rows stay manual.',103,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('schema135_next_04','next_20',4,'equipment','Build DB-backed accessory template editor','planned','high','DEVELOPMENT_ROADMAP.md','#jobs','Admin can manage expected accessories by equipment pool.','Checkout and return become clearer.','Accessory drift continues.',104,'{"build":"2026-06-06b","schema":135}'::jsonb,now()),
('schema135_next_05','next_20',5,'seo','Generate sitemap and robots from approved route registry','planned','medium','DEVELOPMENT_ROADMAP.md','/','Sitemap/robots generation reads approved DB route rows.','SEO assets match approved content.','Static assets drift.',105,'{"build":"2026-06-06b","schema":135}'::jsonb,now())
on conflict (step_key) do update set step_batch=excluded.step_batch, step_number=excluded.step_number, step_area=excluded.step_area, step_title=excluded.step_title, step_status=excluded.step_status, priority=excluded.priority, source_doc=excluded.source_doc, route_hint=excluded.route_hint, acceptance_check=excluded.acceptance_check, implementation_notes=excluded.implementation_notes, risk_if_skipped=excluded.risk_if_skipped, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

drop view if exists public.v_app_release_validation_queue;
create view public.v_app_release_validation_queue as
select validation_key, validation_area, validation_title, validation_status, required_evidence, preflight_hint, failure_response_hint, owner_hint, sort_order, checked_at, updated_at
from public.app_release_validation_queue
order by sort_order, validation_key;

drop view if exists public.v_app_payment_reconciliation_execution_queue;
create view public.v_app_payment_reconciliation_execution_queue as
select execution_key, execution_area, execution_title, execution_status, input_validation_hint, posting_or_match_hint, approval_hint, rollback_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_payment_reconciliation_execution_queue
order by sort_order, execution_key;

drop view if exists public.v_app_equipment_mobile_scan_validation_queue;
create view public.v_app_equipment_mobile_scan_validation_queue as
select validation_key, equipment_area, validation_title, validation_status, scan_hint, accessory_hint, verifier_hint, service_task_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_equipment_mobile_scan_validation_queue
order by sort_order, validation_key;

drop view if exists public.v_app_local_seo_release_validation_queue;
create view public.v_app_local_seo_release_validation_queue as
select seo_key, route_key, seo_area, seo_title, seo_status, phrase_hint, one_h1_hint, structured_data_hint, internal_link_hint, proof_hint, sort_order, checked_at, updated_at
from public.app_local_seo_release_validation_queue
order by sort_order, seo_key;

drop view if exists public.v_app_runtime_fallback_message_queue;
create view public.v_app_runtime_fallback_message_queue as
select message_key, app_surface, message_title, message_status, trigger_hint, user_copy_hint, operator_copy_hint, recovery_hint, telemetry_hint, sort_order, checked_at, updated_at
from public.app_runtime_fallback_message_queue
order by sort_order, message_key;

drop view if exists public.v_app_json_db_migration_execution_queue;
create view public.v_app_json_db_migration_execution_queue as
select migration_key, data_area, migration_title, migration_status, current_source_hint, target_source_hint, duplication_risk_hint, execution_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_json_db_migration_execution_queue
order by sort_order, migration_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  135::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 135 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 135 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through schema 135.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (
  135,
  '135_release_validation_payment_recon_equipment_seo_data_migration_controls',
  '135_release_validation_payment_recon_equipment_seo_data_migration_controls.sql',
  '2026-06-06b',
  'Adds Admin-visible release validation, payment/reconciliation execution, equipment scan validation, local SEO release validation, runtime fallback messaging, and JSON/DB migration execution queues.',
  'applied',
  'This pass keeps schema/docs/cache/smoke guardrails aligned while making the next payment, reconciliation, equipment, SEO, fallback, and data migration steps visible in Admin.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_release_validation_queue to authenticated;
grant select on public.app_payment_reconciliation_execution_queue to authenticated;
grant select on public.app_equipment_mobile_scan_validation_queue to authenticated;
grant select on public.app_local_seo_release_validation_queue to authenticated;
grant select on public.app_runtime_fallback_message_queue to authenticated;
grant select on public.app_json_db_migration_execution_queue to authenticated;
grant select on public.v_app_release_validation_queue to authenticated;
grant select on public.v_app_payment_reconciliation_execution_queue to authenticated;
grant select on public.v_app_equipment_mobile_scan_validation_queue to authenticated;
grant select on public.v_app_local_seo_release_validation_queue to authenticated;
grant select on public.v_app_runtime_fallback_message_queue to authenticated;
grant select on public.v_app_json_db_migration_execution_queue to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
