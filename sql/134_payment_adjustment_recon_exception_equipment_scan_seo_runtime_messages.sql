-- Schema 134: payment adjustment, reconciliation exception, equipment scan rollout, SEO content depth, and runtime message controls.
-- Build 2026-06-06a.
-- This pass keeps the schema, Markdown, CSS/SEO/H1, fallback, and Admin readiness queues aligned after schema 133.

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

create table if not exists public.app_payment_adjustment_workflow_queue (
  workflow_key text primary key,
  workflow_area text not null,
  workflow_title text not null,
  workflow_status text not null default 'planned',
  required_role text not null default 'admin',
  validation_hint text,
  posting_hint text,
  reversal_hint text,
  evidence_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_reconciliation_exception_resolution_queue (
  exception_key text primary key,
  exception_area text not null,
  exception_title text not null,
  exception_status text not null default 'planned',
  match_score_hint text,
  human_review_hint text,
  posting_block_hint text,
  undo_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_equipment_scan_rollout_queue (
  rollout_key text primary key,
  rollout_area text not null,
  rollout_title text not null,
  rollout_status text not null default 'planned',
  device_requirement_hint text,
  manual_fallback_hint text,
  accessory_template_hint text,
  verifier_role_hint text,
  service_task_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_local_seo_content_depth_queue (
  content_key text primary key,
  route_key text,
  content_area text not null,
  content_title text not null,
  content_status text not null default 'planned',
  primary_local_phrase text,
  proof_requirement_hint text,
  internal_link_hint text,
  publication_gate_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_runtime_error_message_catalog (
  message_key text primary key,
  app_surface text not null,
  error_title text not null,
  error_status text not null default 'review',
  user_message text,
  operator_hint text,
  telemetry_hint text,
  retry_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_payment_adjustment_workflow_queue (workflow_key, workflow_area, workflow_title, workflow_status, required_role, validation_hint, posting_hint, reversal_hint, evidence_hint, fallback_hint, sort_order, metadata, checked_at) values
('payment_apply_deposit_to_invoice','payment_application','Apply deposit to invoice with remaining balance preview','planned','admin','Require invoice, customer, deposit source, amount, date, and reviewer note before save.','Post only after amount <= unapplied deposit and period is open.','Reverse with reason and linked reversal row, not delete.','Keep payment source, invoice, reviewer, and period evidence together.','Keep as staged review row if posting tables are unavailable.',10,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('payment_credit_writeoff_overpayment','adjustments','Handle credit, write-off, refund, and overpayment from one adjustment workflow','planned','admin','Require adjustment type, reason, customer, source transaction, and approval threshold.','Post to mapped GL account only after reason and permission pass.','Undo by reversing adjustment and retaining original proof.','Attach approval and customer communication notes where applicable.','Export manual adjustment packet for accountant review.',20,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('payment_closed_period_guard','period_lock','Block payment changes against locked month-end periods','planned','admin','Check accounting period close status before any apply/reverse action.','Posting blocked when close period is locked unless reopened with reason.','Reversal requires reopen reason if original period is closed.','Store period id and reopen reason on the action row.','Show warning and keep action pending.',30,'{"build":"2026-06-06a","schema":134}'::jsonb,now())
on conflict (workflow_key) do update set workflow_area=excluded.workflow_area, workflow_title=excluded.workflow_title, workflow_status=excluded.workflow_status, required_role=excluded.required_role, validation_hint=excluded.validation_hint, posting_hint=excluded.posting_hint, reversal_hint=excluded.reversal_hint, evidence_hint=excluded.evidence_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_reconciliation_exception_resolution_queue (exception_key, exception_area, exception_title, exception_status, match_score_hint, human_review_hint, posting_block_hint, undo_hint, fallback_hint, sort_order, metadata, checked_at) values
('recon_duplicate_bank_row','bank_import','Resolve duplicate or near-duplicate bank rows before matching','planned','Score by same date, amount, memo fingerprint, and import source.','Reviewer chooses keep, reject, or merge with note.','Rejected/duplicate rows cannot post.','Undo restores row to review state with previous reason.','Keep duplicate report for manual review.',10,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('recon_split_payment','matching','Support one bank row split across multiple invoices or deposits','planned','Score based on customer, total amount, memo, invoice refs, and date proximity.','Reviewer adds split rows and confirms total equals bank amount.','Block posting until split total balances exactly.','Undo removes split bundle and reopens bank row.','Keep unmatched row in review queue.',20,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('recon_no_match_exception','exceptions','Escalate low-confidence or no-match transactions','planned','Low score when amount/date/ref/customer do not align.','Reviewer can assign category, vendor/customer, or mark research-needed.','No GL posting without category or reviewer decision.','Undo returns row to unmatched state.','Export exception list to accountant packet.',30,'{"build":"2026-06-06a","schema":134}'::jsonb,now())
on conflict (exception_key) do update set exception_area=excluded.exception_area, exception_title=excluded.exception_title, exception_status=excluded.exception_status, match_score_hint=excluded.match_score_hint, human_review_hint=excluded.human_review_hint, posting_block_hint=excluded.posting_block_hint, undo_hint=excluded.undo_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_equipment_scan_rollout_queue (rollout_key, rollout_area, rollout_title, rollout_status, device_requirement_hint, manual_fallback_hint, accessory_template_hint, verifier_role_hint, service_task_hint, sort_order, metadata, checked_at) values
('scan_checkout_arrival_return','camera_scan','Use scan/manual entry for checkout, arrival, return, and service closeout','planned','Prefer BarcodeDetector/camera where supported over HTTPS on mobile.','Manual Scan / Enter Code stays visible for unsupported devices.','Load expected accessories after equipment code resolves.','Verifier role check should happen server-side before status changes.','Failed scan/test can create service task with equipment code already filled.',10,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('accessory_template_db','accessories','Move accessory checklists from free text to DB-backed templates','planned','No device requirement; templates load from equipment pool/category.','Allow typed accessory notes when template is missing.','Compare checkout, arrival, and return accessories against expected list.','Supervisor verifies missing/damaged accessories.','Missing/damaged items create service task or exception.',20,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('return_to_service_lock','lockout','Keep failed equipment locked until return-to-service proof is complete','planned','No device requirement.','Manual verifier can enter evidence reference when scan unavailable.','Accessory issues must be resolved or waived.','Admin/supervisor role required based on equipment verifier role setting.','Closing service task updates return-to-service evidence.',30,'{"build":"2026-06-06a","schema":134}'::jsonb,now())
on conflict (rollout_key) do update set rollout_area=excluded.rollout_area, rollout_title=excluded.rollout_title, rollout_status=excluded.rollout_status, device_requirement_hint=excluded.device_requirement_hint, manual_fallback_hint=excluded.manual_fallback_hint, accessory_template_hint=excluded.accessory_template_hint, verifier_role_hint=excluded.verifier_role_hint, service_task_hint=excluded.service_task_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_local_seo_content_depth_queue (content_key, route_key, content_area, content_title, content_status, primary_local_phrase, proof_requirement_hint, internal_link_hint, publication_gate_hint, fallback_hint, sort_order, metadata, checked_at) values
('home_local_service_depth','home','local_home','Strengthen homepage local service language without adding a second H1','in_progress','Ontario workplace safety app and job operations tracking','Use true app capabilities and avoid unsupported location claims.','Link to safety, jobs, equipment, accounting, and mobile workflow sections.','One H1, clear title/meta, sitemap/robots present, no broken core assets.','Keep current homepage copy until content proof is approved.',10,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('accounting_content_depth','accounting','local_service_depth','Explain accounting close, payment application, and reconciliation benefits clearly','planned','Ontario small business accounting close workflow','Use features actually present in Admin queues and docs.','Link from Admin/readiness/accounting sections.','Do not publish service claims beyond built workflow state.','Keep as internal Admin text until proof gates pass.',20,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('equipment_accountability_depth','equipment','local_service_depth','Explain equipment checkout, arrival, return, scan, and lockout workflow','planned','equipment accountability and return signoff workflow','Use screenshots/evidence only after consent and actual use.','Link equipment docs with jobs and mobile Today workflow.','Require image alt text and one-H1 check before publishing.','Keep as internal ops docs until public proof is ready.',30,'{"build":"2026-06-06a","schema":134}'::jsonb,now())
on conflict (content_key) do update set route_key=excluded.route_key, content_area=excluded.content_area, content_title=excluded.content_title, content_status=excluded.content_status, primary_local_phrase=excluded.primary_local_phrase, proof_requirement_hint=excluded.proof_requirement_hint, internal_link_hint=excluded.internal_link_hint, publication_gate_hint=excluded.publication_gate_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_runtime_error_message_catalog (message_key, app_surface, error_title, error_status, user_message, operator_hint, telemetry_hint, retry_hint, fallback_hint, sort_order, metadata, checked_at) values
('schema_view_missing','Admin readiness','Optional schema view missing','covered','This panel is waiting for a database migration. Apply the latest schema and refresh.','Check v_schema_drift_status and the missing view name in the Edge Function response.','Log scope, view, and schema drift status.','Retry after schema deploy; keep cached data if safe.','Show empty table with apply-schema message.',10,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('edge_function_bundle_error','Deployment','Edge Function bundle/parse error','covered','The function did not deploy. Use the smoke check and repair the file named in the deploy error.','Run repo smoke check and deploy only after TypeScript parse passes.','Record function name, error text, and build marker.','Do not retry unchanged code.','Keep previous deployed function live.',20,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('offline_draft_conflict','Mobile offline forms','Offline draft conflicts with server record','review','A saved draft may conflict with a newer server record. Choose keep local, reload server, or merge manually.','Show draft timestamp, server timestamp, and form id.','Track local draft id, form type, and retry count.','Retry the failed payload only after user choice.','Never delete local draft until acknowledged.',30,'{"build":"2026-06-06a","schema":134}'::jsonb,now())
on conflict (message_key) do update set app_surface=excluded.app_surface, error_title=excluded.error_title, error_status=excluded.error_status, user_message=excluded.user_message, operator_hint=excluded.operator_hint, telemetry_hint=excluded.telemetry_hint, retry_hint=excluded.retry_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_roadmap_action_steps (step_key, step_batch, step_number, step_area, step_title, step_status, priority, source_doc, route_hint, acceptance_check, implementation_notes, risk_if_skipped, sort_order, metadata, checked_at) values
('schema134_done_01','completed_this_pass',1,'schema','Added schema 134 execution-control queues','completed','high','DEVELOPMENT_ROADMAP.md','#admin','Schema 134 migration and canonical full schema contain new queues/views.','Payment adjustment, reconciliation exception, equipment scan, SEO content depth, and runtime message queues are DB-visible.','Roadmap depth remains Markdown-only.',1,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('schema134_done_02','completed_this_pass',2,'admin','Exposed schema 134 queues in Admin readiness','completed','high','DEVELOPMENT_ROADMAP.md','#admin','admin-directory and admin-ui reference schema 134 views.','Admin can see the new execution queues.','New rows stay hidden from operators.',2,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('schema134_done_03','completed_this_pass',3,'seo','Updated sitemap lastmod and preserved one-H1/public asset checks','completed','medium','DEVELOPMENT_ROADMAP.md','/','sitemap lastmod is current and smoke checks still verify one H1.','SEO asset freshness stays visible.','Search assets drift quietly.',3,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('schema134_done_04','completed_this_pass',4,'fallback','Added runtime error-message catalog for clearer recovery text','completed','high','KNOWN_ISSUES_AND_GAPS.md','#admin','Runtime message rows exist and are visible in readiness.','Operators get clearer fallback wording.','Errors remain confusing in the field.',4,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('schema134_done_05','completed_this_pass',5,'cleanup','Archived current Markdown and retired root test files','completed','medium','DEVELOPMENT_ROADMAP.md','archive','Archive snapshots exist and root test files are retired.','Smoke hygiene is restored.','Old test files keep polluting releases.',5,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('schema134_next_01','next_20',1,'accounting','Turn payment adjustment queues into working apply/reverse buttons','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Admin can apply, reverse, refund, credit, write off, and overpayment decisions with proof.','Moves from visibility to usable accounting workflow.','Cash application remains manual.',101,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('schema134_next_02','next_20',2,'accounting','Build reconciliation exception action buttons','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Duplicate, split, no-match, and research-needed rows can be resolved and undone.','Bank review becomes auditable.','Unmatched rows accumulate.',102,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('schema134_next_03','next_20',3,'equipment','Implement camera scan where supported and keep manual fallback','planned','high','DEVELOPMENT_ROADMAP.md','#jobs','Phone scan fills checkout, arrival, return, and service-task equipment code.','Field workflow becomes faster.','Manual entry stays error-prone.',103,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('schema134_next_04','next_20',4,'equipment','Create DB-backed accessory templates and compare on return','planned','high','DEVELOPMENT_ROADMAP.md','#jobs','Expected accessories load by pool/category and mismatch rows become exceptions.','Equipment accountability improves.','Missing accessories are missed.',104,'{"build":"2026-06-06a","schema":134}'::jsonb,now()),
('schema134_next_05','next_20',5,'seo','Publish only approved local SEO route content with proof gates','planned','medium','DEVELOPMENT_ROADMAP.md','/','Route content requires one H1, title/meta, internal links, image alt, and truthful local wording.','Public SEO quality improves.','Pages can overclaim or drift.',105,'{"build":"2026-06-06a","schema":134}'::jsonb,now())
on conflict (step_key) do update set step_batch=excluded.step_batch, step_number=excluded.step_number, step_area=excluded.step_area, step_title=excluded.step_title, step_status=excluded.step_status, priority=excluded.priority, source_doc=excluded.source_doc, route_hint=excluded.route_hint, acceptance_check=excluded.acceptance_check, implementation_notes=excluded.implementation_notes, risk_if_skipped=excluded.risk_if_skipped, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

drop view if exists public.v_app_payment_adjustment_workflow_queue;
create view public.v_app_payment_adjustment_workflow_queue as
select workflow_key, workflow_area, workflow_title, workflow_status, required_role, validation_hint, posting_hint, reversal_hint, evidence_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_payment_adjustment_workflow_queue
order by sort_order, workflow_key;

drop view if exists public.v_app_reconciliation_exception_resolution_queue;
create view public.v_app_reconciliation_exception_resolution_queue as
select exception_key, exception_area, exception_title, exception_status, match_score_hint, human_review_hint, posting_block_hint, undo_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_reconciliation_exception_resolution_queue
order by sort_order, exception_key;

drop view if exists public.v_app_equipment_scan_rollout_queue;
create view public.v_app_equipment_scan_rollout_queue as
select rollout_key, rollout_area, rollout_title, rollout_status, device_requirement_hint, manual_fallback_hint, accessory_template_hint, verifier_role_hint, service_task_hint, sort_order, checked_at, updated_at
from public.app_equipment_scan_rollout_queue
order by sort_order, rollout_key;

drop view if exists public.v_app_local_seo_content_depth_queue;
create view public.v_app_local_seo_content_depth_queue as
select content_key, route_key, content_area, content_title, content_status, primary_local_phrase, proof_requirement_hint, internal_link_hint, publication_gate_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_local_seo_content_depth_queue
order by sort_order, content_key;

drop view if exists public.v_app_runtime_error_message_catalog;
create view public.v_app_runtime_error_message_catalog as
select message_key, app_surface, error_title, error_status, user_message, operator_hint, telemetry_hint, retry_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_runtime_error_message_catalog
order by sort_order, message_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  134::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 134 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 134 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through schema 134.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (
  134,
  '134_payment_adjustment_recon_exception_equipment_scan_seo_runtime_messages',
  '134_payment_adjustment_recon_exception_equipment_scan_seo_runtime_messages.sql',
  '2026-06-06a',
  'Adds Admin-visible execution controls for payment adjustments, reconciliation exception resolution, equipment scan rollout, local SEO content depth, and runtime error messages.',
  'applied',
  'This pass keeps schema/docs/cache/smoke guardrails aligned while preparing write-path, scan, SEO, and recovery workflows for deeper implementation.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.app_payment_adjustment_workflow_queue to authenticated;
grant select on public.app_reconciliation_exception_resolution_queue to authenticated;
grant select on public.app_equipment_scan_rollout_queue to authenticated;
grant select on public.app_local_seo_content_depth_queue to authenticated;
grant select on public.app_runtime_error_message_catalog to authenticated;
grant select on public.v_app_payment_adjustment_workflow_queue to authenticated;
grant select on public.v_app_reconciliation_exception_resolution_queue to authenticated;
grant select on public.v_app_equipment_scan_rollout_queue to authenticated;
grant select on public.v_app_local_seo_content_depth_queue to authenticated;
grant select on public.v_app_runtime_error_message_catalog to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
