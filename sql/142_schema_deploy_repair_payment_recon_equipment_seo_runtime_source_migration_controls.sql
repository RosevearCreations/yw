-- Schema 142: Full-schema repair verification, payment/reconciliation proof closeout, equipment return exceptions, local-search prominence evidence, runtime observability, and JSON/DB source migration controls.
-- Build 2026-06-11a.
--
-- Purpose:
-- 1. Locks in the repaired schema 141 shape after partial deploy attempts.
-- 2. Adds Admin-visible queues for the next execution pass without reusing ambiguous column names.
-- 3. Keeps schema/full-schema/Markdown/cache/SEO smoke markers aligned.

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
alter table public.app_roadmap_action_steps add constraint app_roadmap_action_steps_step_batch_check check (step_batch in ('completed_this_pass','next_20'));
alter table public.app_roadmap_action_steps drop constraint if exists app_roadmap_action_steps_step_status_check;
alter table public.app_roadmap_action_steps add constraint app_roadmap_action_steps_step_status_check check (step_status in ('completed','in_progress','planned','blocked','review'));

create table if not exists public.app_schema_deploy_repair_queue (
  repair_key text primary key,
  repair_area text not null default 'schema',
  repair_title text not null default 'Schema deploy repair',
  repair_status text not null default 'planned',
  detected_issue_hint text,
  repair_action_hint text,
  verification_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_schema_deploy_repair_queue add column if not exists repair_area text not null default 'schema';
alter table public.app_schema_deploy_repair_queue add column if not exists repair_title text not null default 'Schema deploy repair';
alter table public.app_schema_deploy_repair_queue add column if not exists repair_status text not null default 'planned';
alter table public.app_schema_deploy_repair_queue add column if not exists detected_issue_hint text;
alter table public.app_schema_deploy_repair_queue add column if not exists repair_action_hint text;
alter table public.app_schema_deploy_repair_queue add column if not exists verification_hint text;
alter table public.app_schema_deploy_repair_queue add column if not exists fallback_hint text;
alter table public.app_schema_deploy_repair_queue add column if not exists sort_order integer not null default 100;
alter table public.app_schema_deploy_repair_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_schema_deploy_repair_queue add column if not exists checked_at timestamptz;
alter table public.app_schema_deploy_repair_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_payment_reconciliation_proof_closeout_queue (
  closeout_key text primary key,
  closeout_area text not null default 'accounting',
  closeout_title text not null default 'Payment reconciliation proof closeout',
  closeout_status text not null default 'planned',
  source_evidence_hint text,
  approval_hint text,
  posting_or_export_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_payment_reconciliation_proof_closeout_queue add column if not exists closeout_area text not null default 'accounting';
alter table public.app_payment_reconciliation_proof_closeout_queue add column if not exists closeout_title text not null default 'Payment reconciliation proof closeout';
alter table public.app_payment_reconciliation_proof_closeout_queue add column if not exists closeout_status text not null default 'planned';
alter table public.app_payment_reconciliation_proof_closeout_queue add column if not exists source_evidence_hint text;
alter table public.app_payment_reconciliation_proof_closeout_queue add column if not exists approval_hint text;
alter table public.app_payment_reconciliation_proof_closeout_queue add column if not exists posting_or_export_hint text;
alter table public.app_payment_reconciliation_proof_closeout_queue add column if not exists fallback_hint text;
alter table public.app_payment_reconciliation_proof_closeout_queue add column if not exists sort_order integer not null default 100;
alter table public.app_payment_reconciliation_proof_closeout_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_payment_reconciliation_proof_closeout_queue add column if not exists checked_at timestamptz;
alter table public.app_payment_reconciliation_proof_closeout_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_equipment_return_exception_action_queue (
  action_key text primary key,
  exception_area text not null default 'equipment',
  action_title text not null default 'Equipment return exception action',
  action_status text not null default 'planned',
  evidence_hint text,
  decision_hint text,
  service_or_cost_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_equipment_return_exception_action_queue add column if not exists exception_area text not null default 'equipment';
alter table public.app_equipment_return_exception_action_queue add column if not exists action_title text not null default 'Equipment return exception action';
alter table public.app_equipment_return_exception_action_queue add column if not exists action_status text not null default 'planned';
alter table public.app_equipment_return_exception_action_queue add column if not exists evidence_hint text;
alter table public.app_equipment_return_exception_action_queue add column if not exists decision_hint text;
alter table public.app_equipment_return_exception_action_queue add column if not exists service_or_cost_hint text;
alter table public.app_equipment_return_exception_action_queue add column if not exists fallback_hint text;
alter table public.app_equipment_return_exception_action_queue add column if not exists sort_order integer not null default 100;
alter table public.app_equipment_return_exception_action_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_equipment_return_exception_action_queue add column if not exists checked_at timestamptz;
alter table public.app_equipment_return_exception_action_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_local_search_prominence_evidence_queue (
  evidence_key text primary key,
  route_key text,
  prominence_area text not null default 'local_search',
  evidence_title text not null default 'Local search prominence evidence',
  evidence_status text not null default 'planned',
  query_hint text,
  page_signal_hint text,
  conversion_signal_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_local_search_prominence_evidence_queue add column if not exists route_key text;
alter table public.app_local_search_prominence_evidence_queue add column if not exists prominence_area text not null default 'local_search';
alter table public.app_local_search_prominence_evidence_queue add column if not exists evidence_title text not null default 'Local search prominence evidence';
alter table public.app_local_search_prominence_evidence_queue add column if not exists evidence_status text not null default 'planned';
alter table public.app_local_search_prominence_evidence_queue add column if not exists query_hint text;
alter table public.app_local_search_prominence_evidence_queue add column if not exists page_signal_hint text;
alter table public.app_local_search_prominence_evidence_queue add column if not exists conversion_signal_hint text;
alter table public.app_local_search_prominence_evidence_queue add column if not exists fallback_hint text;
alter table public.app_local_search_prominence_evidence_queue add column if not exists sort_order integer not null default 100;
alter table public.app_local_search_prominence_evidence_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_local_search_prominence_evidence_queue add column if not exists checked_at timestamptz;
alter table public.app_local_search_prominence_evidence_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_runtime_fallback_observability_queue (
  observability_key text primary key,
  app_surface text not null default 'app',
  observability_title text not null default 'Runtime fallback observability',
  observability_status text not null default 'planned',
  detection_hint text,
  logging_hint text,
  review_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_runtime_fallback_observability_queue add column if not exists app_surface text not null default 'app';
alter table public.app_runtime_fallback_observability_queue add column if not exists observability_title text not null default 'Runtime fallback observability';
alter table public.app_runtime_fallback_observability_queue add column if not exists observability_status text not null default 'planned';
alter table public.app_runtime_fallback_observability_queue add column if not exists detection_hint text;
alter table public.app_runtime_fallback_observability_queue add column if not exists logging_hint text;
alter table public.app_runtime_fallback_observability_queue add column if not exists review_hint text;
alter table public.app_runtime_fallback_observability_queue add column if not exists fallback_hint text;
alter table public.app_runtime_fallback_observability_queue add column if not exists sort_order integer not null default 100;
alter table public.app_runtime_fallback_observability_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_runtime_fallback_observability_queue add column if not exists checked_at timestamptz;
alter table public.app_runtime_fallback_observability_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_json_db_source_migration_queue (
  migration_key text primary key,
  source_area text not null default 'data_source',
  migration_title text not null default 'JSON/DB source migration',
  migration_status text not null default 'planned',
  current_source_hint text,
  target_source_hint text,
  validation_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_json_db_source_migration_queue add column if not exists source_area text not null default 'data_source';
alter table public.app_json_db_source_migration_queue add column if not exists migration_title text not null default 'JSON/DB source migration';
alter table public.app_json_db_source_migration_queue add column if not exists migration_status text not null default 'planned';
alter table public.app_json_db_source_migration_queue add column if not exists current_source_hint text;
alter table public.app_json_db_source_migration_queue add column if not exists target_source_hint text;
alter table public.app_json_db_source_migration_queue add column if not exists validation_hint text;
alter table public.app_json_db_source_migration_queue add column if not exists fallback_hint text;
alter table public.app_json_db_source_migration_queue add column if not exists sort_order integer not null default 100;
alter table public.app_json_db_source_migration_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_json_db_source_migration_queue add column if not exists checked_at timestamptz;
alter table public.app_json_db_source_migration_queue add column if not exists updated_at timestamptz not null default now();

insert into public.app_schema_deploy_repair_queue (repair_key, repair_area, repair_title, repair_status, detected_issue_hint, repair_action_hint, verification_hint, fallback_hint, sort_order, metadata, checked_at) values
('full_schema_141_repair_lock','schema','Lock repaired schema 141 into canonical full schema','completed','Full schema carried an older compact schema 141 insert that did not include proof_area/payment_area and evidence_area variants.','Replace canonical schema 141 block with the verified standalone schema 141 migration and keep schema 142 as the forward marker.','Full schema contains proof_area/payment_area, service_area evidence_area, and schema 142 drift marker.','Use standalone migrations only if full schema restore is not needed.',10,'{"build":"2026-06-11a","schema":142}'::jsonb,now()),
('partial_deploy_shape_guard','schema','Guard partial table shapes before inserts','completed','Failed partial deploys can leave tables created with old NOT NULL columns.','Use defensive ALTER TABLE blocks before all insert/upsert statements.','Schema deploy can be rerun without proof_area or values-list errors.','Run a repair-only migration if any prior partial table shape remains.',20,'{"build":"2026-06-11a","schema":142}'::jsonb,now()),
('smoke_order_guard','testing','Keep schema 141 and later smoke checks before final exit','in_progress','The smoke script had schema 141 checks after the early failed/success exit block.','Move final success/failure exit to the end and add schema 142 checks before it.','Smoke report includes schema 141 and 142 checks.','Manual grep remains fallback if smoke script is edited incorrectly.',30,'{"build":"2026-06-11a","schema":142}'::jsonb,now())
on conflict (repair_key) do update set repair_area=excluded.repair_area, repair_title=excluded.repair_title, repair_status=excluded.repair_status, detected_issue_hint=excluded.detected_issue_hint, repair_action_hint=excluded.repair_action_hint, verification_hint=excluded.verification_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_payment_reconciliation_proof_closeout_queue (closeout_key, closeout_area, closeout_title, closeout_status, source_evidence_hint, approval_hint, posting_or_export_hint, fallback_hint, sort_order, metadata, checked_at) values
('payment_proof_closeout_action','payment_application','Close payment proof blockers with reviewer action','planned','Payment posting proof rows, bank match proof, invoice balance, and adjustment reason.','Reviewer confirms proof, reason, tax treatment, and close-period status.','Approved rows can post; unresolved rows flow into accountant export.','Leave unresolved blockers visible in exception queue.',10,'{"build":"2026-06-11a","schema":142}'::jsonb,now()),
('recon_split_export_action','reconciliation','Close split/unmatched reconciliation rows into export-ready state','planned','Bank CSV staging rows, split details, match score, duplicate flags, and undo history.','Reviewer chooses accept, split, reject, or unresolved with note.','Accepted rows lock after close; unresolved rows export with owner and due date.','Manual CSV package remains fallback.',20,'{"build":"2026-06-11a","schema":142}'::jsonb,now()),
('month_end_payment_exception_action','month_end_close','Require approved owner for material payment exceptions before close','planned','Open payment/reconciliation exceptions, materiality, owner, due date, and evidence reference.','Admin/accountant signs off exception package before close.','Close package records unresolved rows and next action.','Keep period in review if material exceptions have no owner.',30,'{"build":"2026-06-11a","schema":142}'::jsonb,now())
on conflict (closeout_key) do update set closeout_area=excluded.closeout_area, closeout_title=excluded.closeout_title, closeout_status=excluded.closeout_status, source_evidence_hint=excluded.source_evidence_hint, approval_hint=excluded.approval_hint, posting_or_export_hint=excluded.posting_or_export_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_equipment_return_exception_action_queue (action_key, exception_area, action_title, action_status, evidence_hint, decision_hint, service_or_cost_hint, fallback_hint, sort_order, metadata, checked_at) values
('return_scan_mismatch_action','return_verification','Resolve return scan mismatch before equipment is available again','planned','Return scan/manual code differs from checkout record or expected accessory set.','Supervisor confirms identity, condition, missing accessories, and reason.','Mismatch can create service task, cost recovery, or write-off decision.','Keep equipment unavailable until resolved.',10,'{"build":"2026-06-11a","schema":142}'::jsonb,now()),
('failed_service_test_action','return_to_service','Route failed return-to-service tests to service and cost decision','planned','Failed test, photo/note, verifier role, service task, and replacement cost estimate.','Admin decides repair, warranty, internal cost, billable damage, or write-off.','Decision links to equipment history and job profitability.','Keep lockout until decision is complete.',20,'{"build":"2026-06-11a","schema":142}'::jsonb,now()),
('missing_accessory_followup_action','accessory_exception','Require follow-up for missing accessory before closeout','planned','Accessory checklist, missing item, replacement cost, responsible job, and proof note.','Supervisor signs exception and admin/accounting decides recovery path.','Decision appears in closeout/accountant export when material.','Keep exception open if owner is missing.',30,'{"build":"2026-06-11a","schema":142}'::jsonb,now())
on conflict (action_key) do update set exception_area=excluded.exception_area, action_title=excluded.action_title, action_status=excluded.action_status, evidence_hint=excluded.evidence_hint, decision_hint=excluded.decision_hint, service_or_cost_hint=excluded.service_or_cost_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_local_search_prominence_evidence_queue (evidence_key, route_key, prominence_area, evidence_title, evidence_status, query_hint, page_signal_hint, conversion_signal_hint, fallback_hint, sort_order, metadata, checked_at) values
('home_local_prominence_path','home','homepage','Home page uses honest local terms and conversion path','in_progress','Use words customers search for in title, one H1, intro, and CTA text.','Meta, sitemap, internal links, proof block, image alt, and clear service-area wording.','CTA routes to quote/contact/booking path without dead links.','Keep generic CTA until route proof exists.',10,'{"build":"2026-06-11a","schema":142}'::jsonb,now()),
('service_area_prominence_path','service_area','service_area','Service-area pages need proof before prominent linking','planned','Use real served areas and services only; avoid unsupported location pages.','Page title/meta/H1/body/internal links match actual service coverage and proof.','Link to pricing/quote/contact/proof sections so users can act.','Hold route out of sitemap if proof is weak.',20,'{"build":"2026-06-11a","schema":142}'::jsonb,now()),
('seo_asset_prominence_smoke','technical_seo','technical_seo','Smoke sitemap, robots, H1/title/meta, internal links, and CTA targets together','planned','Local search terms, title/H1 clarity, sitemap, robots, image alt, and dead-link checks.','Smoke confirms technical SEO and user conversion path are aligned.','Failed targets stay unpublished.','Static homepage remains fallback.',30,'{"build":"2026-06-11a","schema":142}'::jsonb,now())
on conflict (evidence_key) do update set route_key=excluded.route_key, prominence_area=excluded.prominence_area, evidence_title=excluded.evidence_title, evidence_status=excluded.evidence_status, query_hint=excluded.query_hint, page_signal_hint=excluded.page_signal_hint, conversion_signal_hint=excluded.conversion_signal_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_runtime_fallback_observability_queue (observability_key, app_surface, observability_title, observability_status, detection_hint, logging_hint, review_hint, fallback_hint, sort_order, metadata, checked_at) values
('admin_optional_view_observability','admin_directory','Track optional-view fallback repeats','planned','safeList catches missing optional view after schema/function mismatch.','Log view name, scope, schema drift status, cache marker, and actor role.','Admin reviews repeats and redeploys schema/function as needed.','Show empty readiness table with apply schema hint.',10,'{"build":"2026-06-11a","schema":142}'::jsonb,now()),
('accounting_blocker_observability','accounting','Track accounting blockers without unsafe retry','planned','Payment/reconciliation posting blocked by proof, approval, or close-period lock.','Log blocker, source rows, reviewer, and next safe action.','Accountant/admin resolves proof or exports blocker.','Do not auto-retry accounting blockers.',20,'{"build":"2026-06-11a","schema":142}'::jsonb,now()),
('mobile_offline_conflict_observability','mobile_offline','Track offline sync conflicts until acknowledged','review','Local draft conflicts with server change or retry failure.','Log draft key, entity, local/server timestamps, and chosen resolution.','Supervisor reviews unresolved conflicts before closeout.','Keep local draft until server acknowledges success.',30,'{"build":"2026-06-11a","schema":142}'::jsonb,now())
on conflict (observability_key) do update set app_surface=excluded.app_surface, observability_title=excluded.observability_title, observability_status=excluded.observability_status, detection_hint=excluded.detection_hint, logging_hint=excluded.logging_hint, review_hint=excluded.review_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_json_db_source_migration_queue (migration_key, source_area, migration_title, migration_status, current_source_hint, target_source_hint, validation_hint, fallback_hint, sort_order, metadata, checked_at) values
('seo_route_registry_source_migration','seo_routes','Move repeated SEO route configuration toward DB registry','planned','Sitemap/static route lists and Markdown route notes can drift.','DB-backed approved route registry with generated sitemap/robots candidates.','Smoke compares DB registry, sitemap, public links, and one-H1/meta checks.','Keep static sitemap as fallback until generator is proven.',10,'{"build":"2026-06-11a","schema":142}'::jsonb,now()),
('equipment_accessory_template_migration','equipment_templates','Move repeated accessory checklist templates toward DB registry','planned','Accessory lists repeated across jobs, equipment notes, and Markdown.','DB-backed equipment accessory template registry with mobile scan fallback.','Compare generated checklist with existing job/equipment records.','Keep manual checklist notes until DB registry is complete.',20,'{"build":"2026-06-11a","schema":142}'::jsonb,now()),
('fallback_message_catalog_migration','runtime_messages','Move repeated fallback messages toward DB-backed catalog','planned','Runtime fallback messages are repeated in UI, Edge Functions, and Markdown.','Central fallback/error message catalog with surface, severity, and next action.','Smoke checks message keys and UI fallback text.','Keep hardcoded UI copy as fallback until catalog lookup is reliable.',30,'{"build":"2026-06-11a","schema":142}'::jsonb,now())
on conflict (migration_key) do update set source_area=excluded.source_area, migration_title=excluded.migration_title, migration_status=excluded.migration_status, current_source_hint=excluded.current_source_hint, target_source_hint=excluded.target_source_hint, validation_hint=excluded.validation_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_roadmap_action_steps (step_key, step_batch, step_number, step_area, step_title, step_status, priority, source_doc, route_hint, acceptance_check, implementation_notes, risk_if_skipped, sort_order, metadata, checked_at) values
('schema142_done_01','completed_this_pass',1,'schema','Repaired canonical full schema 141 section and added schema 142','completed','high','DEVELOPMENT_ROADMAP.md','sql/000_full_schema_reference.sql','Full schema includes repaired schema 141 and schema 142 drift marker.','This prevents prior proof_area/payment_area and VALUES-list regressions during full-schema deploys.','Full-schema deploy can fail on old schema 141 block.',1,'{"build":"2026-06-11a","schema":142}'::jsonb,now()),
('schema142_done_02','completed_this_pass',2,'testing','Moved smoke checks so schema 141 and 142 checks run before exit','completed','high','TESTING_CHECKLIST.md','scripts/repo-smoke-check.mjs','Smoke report includes schema 141 and 142 checks.','Smoke is now less likely to falsely pass before latest schema checks.','Latest schema checks may be skipped.',2,'{"build":"2026-06-11a","schema":142}'::jsonb,now()),
('schema142_done_03','completed_this_pass',3,'cleanup','Archived retired helper Markdown and root test files','completed','high','KNOWN_ISSUES_AND_GAPS.md','archive','Root hygiene checks pass.','Deployment root stays clean.','Temporary files keep breaking smoke.',3,'{"build":"2026-06-11a","schema":142}'::jsonb,now()),
('schema142_next_01','next_20',1,'admin','Build repair/deploy checklist actions from schema 142 queues','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Admin can mark schema repair, function redeploy, cache clear, and smoke verification steps.','Schema repair flow becomes operational.','Deploy repair remains manual.',101,'{"build":"2026-06-11a","schema":142}'::jsonb,now()),
('schema142_next_02','next_20',2,'accounting','Create proof closeout write actions for payment/reconciliation blockers','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Buttons update proof status, reviewer, reason, export owner, and closeout state.','Accounting blockers become actionable.','Accounting proof remains read-only.',102,'{"build":"2026-06-11a","schema":142}'::jsonb,now()),
('schema142_next_03','next_20',3,'equipment','Create return exception action workflow for scan mismatches and failed tests','planned','high','DEVELOPMENT_ROADMAP.md','#jobs','Return exceptions can create service, cost, or write-off decisions.','Equipment custody becomes auditable.','Damaged/missing equipment remains notes-only.',103,'{"build":"2026-06-11a","schema":142}'::jsonb,now()),
('schema142_next_04','next_20',4,'seo','Generate local-search route checks from approved DB registry','planned','medium','DEVELOPMENT_ROADMAP.md','/','Sitemap/internal links/CTA checks are generated from approved routes.','Local SEO stays honest and easier to maintain.','Static route lists drift.',104,'{"build":"2026-06-11a","schema":142}'::jsonb,now()),
('schema142_next_05','next_20',5,'runtime','Persist fallback observability events from UI and Edge Functions','planned','medium','KNOWN_ISSUES_AND_GAPS.md','#admin','Fallback events are stored with surface, payload, owner, and resolution.','Recurring errors become measurable.','Fallback issues stay anecdotal.',105,'{"build":"2026-06-11a","schema":142}'::jsonb,now())
on conflict (step_key) do update set step_batch=excluded.step_batch, step_number=excluded.step_number, step_area=excluded.step_area, step_title=excluded.step_title, step_status=excluded.step_status, priority=excluded.priority, source_doc=excluded.source_doc, route_hint=excluded.route_hint, acceptance_check=excluded.acceptance_check, implementation_notes=excluded.implementation_notes, risk_if_skipped=excluded.risk_if_skipped, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

drop view if exists public.v_app_schema_deploy_repair_queue;
create view public.v_app_schema_deploy_repair_queue as select repair_key, repair_area, repair_title, repair_status, detected_issue_hint, repair_action_hint, verification_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_schema_deploy_repair_queue order by sort_order, repair_key;

drop view if exists public.v_app_payment_reconciliation_proof_closeout_queue;
create view public.v_app_payment_reconciliation_proof_closeout_queue as select closeout_key, closeout_area, closeout_title, closeout_status, source_evidence_hint, approval_hint, posting_or_export_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_payment_reconciliation_proof_closeout_queue order by sort_order, closeout_key;

drop view if exists public.v_app_equipment_return_exception_action_queue;
create view public.v_app_equipment_return_exception_action_queue as select action_key, exception_area, action_title, action_status, evidence_hint, decision_hint, service_or_cost_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_equipment_return_exception_action_queue order by sort_order, action_key;

drop view if exists public.v_app_local_search_prominence_evidence_queue;
create view public.v_app_local_search_prominence_evidence_queue as select evidence_key, route_key, prominence_area, evidence_title, evidence_status, query_hint, page_signal_hint, conversion_signal_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_local_search_prominence_evidence_queue order by sort_order, evidence_key;

drop view if exists public.v_app_runtime_fallback_observability_queue;
create view public.v_app_runtime_fallback_observability_queue as select observability_key, app_surface, observability_title, observability_status, detection_hint, logging_hint, review_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_runtime_fallback_observability_queue order by sort_order, observability_key;

drop view if exists public.v_app_json_db_source_migration_queue;
create view public.v_app_json_db_source_migration_queue as select migration_key, source_area, migration_title, migration_status, current_source_hint, target_source_hint, validation_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_json_db_source_migration_queue order by sort_order, migration_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  142::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 142 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 142 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through schema 142.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (142, '142_schema_deploy_repair_payment_recon_equipment_seo_runtime_source_migration_controls', '142_schema_deploy_repair_payment_recon_equipment_seo_runtime_source_migration_controls.sql', '2026-06-11a', 'Repairs canonical schema 141 full-schema block and adds deploy repair, payment/reconciliation proof closeout, equipment return exception, local-search prominence, runtime observability, and JSON/DB source migration queues.', 'applied', 'Use after schema 141 repair. This schema is additive and defensive after partial schema 141 attempts.')
on conflict (schema_version) do update set migration_key=excluded.migration_key, schema_name=excluded.schema_name, release_label=excluded.release_label, description=excluded.description, status=excluded.status, notes=excluded.notes, applied_at=now();

grant select on public.app_schema_deploy_repair_queue to authenticated;
grant select on public.app_payment_reconciliation_proof_closeout_queue to authenticated;
grant select on public.app_equipment_return_exception_action_queue to authenticated;
grant select on public.app_local_search_prominence_evidence_queue to authenticated;
grant select on public.app_runtime_fallback_observability_queue to authenticated;
grant select on public.app_json_db_source_migration_queue to authenticated;
grant select on public.v_app_schema_deploy_repair_queue to authenticated;
grant select on public.v_app_payment_reconciliation_proof_closeout_queue to authenticated;
grant select on public.v_app_equipment_return_exception_action_queue to authenticated;
grant select on public.v_app_local_search_prominence_evidence_queue to authenticated;
grant select on public.v_app_runtime_fallback_observability_queue to authenticated;
grant select on public.v_app_json_db_source_migration_queue to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
