-- Schema 136: release cutover, payment exceptions, equipment return-to-service, local SEO evidence, CSS drift, runtime fallback, and JSON/DB source-of-truth controls.
-- Build 2026-06-06c.
-- This pass keeps schema, Markdown, CSS/SEO/H1, fallback, and Admin readiness queues aligned after schema 135.

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

create table if not exists public.app_release_cutover_checklist (
  cutover_key text primary key,
  cutover_area text not null,
  cutover_title text not null,
  cutover_status text not null default 'planned',
  preflight_hint text,
  deploy_hint text,
  rollback_hint text,
  owner_hint text,
  route_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_payment_exception_decision_queue (
  decision_key text primary key,
  exception_area text not null,
  decision_title text not null,
  decision_status text not null default 'planned',
  validation_hint text,
  posting_hint text,
  approval_hint text,
  rollback_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_equipment_return_to_service_gate_queue (
  gate_key text primary key,
  gate_area text not null,
  gate_title text not null,
  gate_status text not null default 'planned',
  scan_requirement_hint text,
  accessory_requirement_hint text,
  verifier_requirement_hint text,
  service_task_requirement_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_local_search_evidence_queue (
  evidence_key text primary key,
  route_key text,
  evidence_area text not null,
  evidence_title text not null,
  evidence_status text not null default 'planned',
  phrase_hint text,
  proof_hint text,
  internal_link_hint text,
  publication_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_css_drift_watchlist (
  watch_key text primary key,
  component_area text not null,
  component_title text not null,
  watch_status text not null default 'review',
  token_hint text,
  selector_hint text,
  drift_risk_hint text,
  test_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_runtime_fallback_test_plan (
  test_key text primary key,
  app_surface text not null,
  test_title text not null,
  test_status text not null default 'planned',
  failure_mode text,
  user_copy_hint text,
  telemetry_hint text,
  retry_hint text,
  owner_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_json_db_source_of_truth_queue (
  source_key text primary key,
  data_area text not null,
  source_title text not null,
  source_status text not null default 'review',
  current_source_hint text,
  target_source_hint text,
  migration_rule_hint text,
  validation_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_release_cutover_checklist (cutover_key, cutover_area, cutover_title, cutover_status, preflight_hint, deploy_hint, rollback_hint, owner_hint, route_hint, sort_order, metadata, checked_at) values
('schema136_full_schema_marker','schema','Full schema and migration file both include schema 136','completed','Run repo smoke and confirm drift view expects 136.','Apply schema 136 after schema 135.','Reapply schema 135 zip if 136 deploy is stopped before app code deploy.','Admin / Developer','#admin',10,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('schema136_edge_function_scope','edge_functions','Redeploy only Admin Directory unless live Jobs functions are behind','completed','Check admin-directory references schema 136 views.','Deploy admin-directory first, then jobs-manage/jobs-directory only if stale.','Keep previous function version if Admin readiness view fetch fails.','Admin / Developer','#admin',20,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('schema136_browser_cache_clear','runtime','Hard-refresh or clear service worker after cache marker 2026-06-06c','completed','Index and service worker markers match.','Clear browser cache after deploy.','Use old 2026-06-06b build zip if new shell fails.','Admin','/',30,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('schema136_markdown_schema_sync','documentation','Markdown, schema docs, and known gaps include schema 136 next steps','completed','Active Markdown references schema 136 completed and next 20 items.','Ship docs with zip.','Do not deploy without roadmap continuity.','Admin','docs',40,'{"build":"2026-06-06c","schema":136}'::jsonb,now())
on conflict (cutover_key) do update set cutover_area=excluded.cutover_area, cutover_title=excluded.cutover_title, cutover_status=excluded.cutover_status, preflight_hint=excluded.preflight_hint, deploy_hint=excluded.deploy_hint, rollback_hint=excluded.rollback_hint, owner_hint=excluded.owner_hint, route_hint=excluded.route_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_payment_exception_decision_queue (decision_key, exception_area, decision_title, decision_status, validation_hint, posting_hint, approval_hint, rollback_hint, fallback_hint, sort_order, metadata, checked_at) values
('overpayment_decision','payment_application','Overpayment can be held, refunded, or moved to customer credit','planned','Validate customer, source payment, open balance, and overpayment amount.','Post to credit/refund queue only after reviewer decision.','Admin/accountant signs off disposition.','Reverse credit/refund decision with linked reason.','Keep unapplied payment visible until decision exists.',10,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('writeoff_decision','adjustments','Write-off requires reason, threshold, tax impact review, and approval','planned','Validate invoice balance, close period, and write-off category.','Stage adjustment before ledger posting.','Require admin/accountant approval above threshold.','Reverse with audit reason and restore invoice balance.','Keep invoice in review queue if proof is missing.',20,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('refund_decision','refunds','Refund decision links original payment, customer, proof, and settlement status','planned','Validate original payment, refund amount, and proof.','Do not mark complete until settlement/reference exists.','Reviewer approves customer-facing refund note.','Reopen refund only with admin reason.','Export pending refund list to accountant package.',30,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('recon_exception_escalation','bank_reconciliation','Low-confidence reconciliation matches escalate instead of posting automatically','planned','Require score, reason, source row, and candidate row.','Block posting until reviewer accepts.','Reviewer must sign off low-confidence and split matches.','Undo moves back to unmatched queue.','Manual export remains fallback.',40,'{"build":"2026-06-06c","schema":136}'::jsonb,now())
on conflict (decision_key) do update set exception_area=excluded.exception_area, decision_title=excluded.decision_title, decision_status=excluded.decision_status, validation_hint=excluded.validation_hint, posting_hint=excluded.posting_hint, approval_hint=excluded.approval_hint, rollback_hint=excluded.rollback_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_equipment_return_to_service_gate_queue (gate_key, gate_area, gate_title, gate_status, scan_requirement_hint, accessory_requirement_hint, verifier_requirement_hint, service_task_requirement_hint, fallback_hint, sort_order, metadata, checked_at) values
('return_service_scan_required','scan','Return-to-service requires scan or manually entered asset confirmation','planned','QR/barcode/coded manual fallback must identify the same equipment record.','Confirm expected accessories before release.','Supervisor+ verifier before available.','Open service tasks must be closed or waived.','Keep item locked out if identity cannot be verified.',10,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('return_service_accessory_complete','accessories','Accessory checklist must be complete or exceptioned before equipment is available','planned','Scan/manual equipment code starts checklist.','Required accessories load by equipment pool/category.','Supervisor signs missing/damaged accessory exceptions.','Missing accessories generate service/replacement task.','Keep pending return review until complete.',20,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('return_service_service_task_closed','service_tasks','Failed arrival/return test must create and close a service task','in_progress','Equipment ID and failed test status create service work.','Accessory status is attached to closeout.','Admin/supervisor verifies task closure.','Service task must have evidence/cost/notes before release.','Keep locked out until task is closed.',30,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('return_service_cost_link','job_costs','Repair/replacement cost must link back to job profitability when applicable','planned','Equipment service task references source job/signout.','Accessory replacement costs become cost rows.','Admin/accountant reviews billable/non-billable treatment.','Service task creates financial event if cost exists.','Show cost note manually if rollup unavailable.',40,'{"build":"2026-06-06c","schema":136}'::jsonb,now())
on conflict (gate_key) do update set gate_area=excluded.gate_area, gate_title=excluded.gate_title, gate_status=excluded.gate_status, scan_requirement_hint=excluded.scan_requirement_hint, accessory_requirement_hint=excluded.accessory_requirement_hint, verifier_requirement_hint=excluded.verifier_requirement_hint, service_task_requirement_hint=excluded.service_task_requirement_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_local_search_evidence_queue (evidence_key, route_key, evidence_area, evidence_title, evidence_status, phrase_hint, proof_hint, internal_link_hint, publication_hint, fallback_hint, sort_order, metadata, checked_at) values
('home_local_service_phrase','/','local_phrase','Home page keeps one clear local service H1 and truthful service-area wording','completed','Use plain search wording in title/H1/body.','Business/service area proof must match real coverage.','Link to approved service/area pages only.','One H1 and meta description required.','Keep general homepage if location proof is incomplete.',10,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('sitemap_route_evidence','/sitemap.xml','technical_seo','Sitemap should only include approved public routes','in_progress','Route rows must include title/meta/H1/local terms.','Proof required before local route enters sitemap.','Internal links should point from related service/location pages.','Generate lastmod on release date.','Static sitemap remains fallback.',20,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('service_page_depth','/services','content_depth','Service pages need cost/value/process/FAQ proof before publication','planned','Use words people search for naturally.','Proof may include photos, actual work examples, town coverage, and service details.','Link from homepage and related service pages.','Block page if content is thin.','Keep draft hidden until proof exists.',30,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('image_alt_local_proof','/gallery','image_alt','Gallery images need descriptive alt text and local proof status','planned','Alt describes real image content, not keyword stuffing.','Proof source and consent/trust status recorded before public use.','Link images to relevant service/story routes.','Hide weak gallery block until evidence passes.','Use placeholder copy without local claim if proof is missing.',40,'{"build":"2026-06-06c","schema":136}'::jsonb,now())
on conflict (evidence_key) do update set route_key=excluded.route_key, evidence_area=excluded.evidence_area, evidence_title=excluded.evidence_title, evidence_status=excluded.evidence_status, phrase_hint=excluded.phrase_hint, proof_hint=excluded.proof_hint, internal_link_hint=excluded.internal_link_hint, publication_hint=excluded.publication_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_css_drift_watchlist (watch_key, component_area, component_title, watch_status, token_hint, selector_hint, drift_risk_hint, test_hint, fallback_hint, sort_order, metadata, checked_at) values
('admin_table_density','admin','Admin readiness tables keep readable density on desktop and mobile','review','Use shared table spacing tokens.','table-scroll, admin-table-note, status-pill.','New schema queues can create cramped columns.','Visual check Admin Production Readiness after each schema pass.','Allow horizontal scroll instead of overflowing page.',10,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('mobile_quick_nav_spacing','mobile','Mobile quick nav keeps tap targets large and non-overlapping','review','Use mobile quick nav spacing variables.','mobile-quick-nav, mobile-quick-action, mobile-quick-badge.','Extra badges can crowd the phone footer.','Check 360px width and safe-area spacing.','Keep default Today route accessible from header.',20,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('form_stepper_assist','mobile_forms','Form stepper/draft panels keep contrast and spacing','review','Use existing mobile form assist rules.','mobile-form-assist, mobile-form-stepper, mobile-form-controls.','Field helper copy can make forms too tall.','Check HSE forms and offline draft screens.','Collapse helper copy if content grows.',30,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('readiness_status_pills','readiness','Status pills stay consistent across new queue types','completed','Use renderStatusPill states.','status-pill, ok, warning, error.','New statuses can look unstyled.','Smoke and visual spot-check new tables.','Render unknown statuses as warning.',40,'{"build":"2026-06-06c","schema":136}'::jsonb,now())
on conflict (watch_key) do update set component_area=excluded.component_area, component_title=excluded.component_title, watch_status=excluded.watch_status, token_hint=excluded.token_hint, selector_hint=excluded.selector_hint, drift_risk_hint=excluded.drift_risk_hint, test_hint=excluded.test_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_runtime_fallback_test_plan (test_key, app_surface, test_title, test_status, failure_mode, user_copy_hint, telemetry_hint, retry_hint, owner_hint, sort_order, metadata, checked_at) values
('admin_directory_optional_view_missing','Admin Directory','Optional readiness view missing should show empty table and schema hint','covered','Schema partially deployed or view missing.','No rows loaded yet. Apply the latest schema.','Capture view name and status in function diagnostics when available.','Retry after schema deploy.','Admin / Developer',10,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('service_worker_stale_cache','Public Shell','Stale service worker should not hide fresh assets permanently','covered','Old cache serves previous build marker.','Hard-refresh or clear old service worker cache.','Compare cache marker to index marker.','Reinstall shell assets one at a time.','Admin',20,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('mobile_offline_submit_conflict','Mobile Forms','Offline form submit conflict keeps local draft until operator chooses action','planned','Server rejects stale/offline payload.','Keep local draft, retry sync, or discard local copy.','Track draft key and last failed sync time locally.','Retry only the failed payload.','Supervisor',30,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('equipment_scan_unsupported','Equipment Mobile','Camera scan unavailable falls back to manual equipment code entry','covered','Browser lacks camera or BarcodeDetector.','Enter QR/barcode/equipment code manually.','Track manual fallback count when telemetry is available.','No retry loop; use manual field.','Supervisor',40,'{"build":"2026-06-06c","schema":136}'::jsonb,now())
on conflict (test_key) do update set app_surface=excluded.app_surface, test_title=excluded.test_title, test_status=excluded.test_status, failure_mode=excluded.failure_mode, user_copy_hint=excluded.user_copy_hint, telemetry_hint=excluded.telemetry_hint, retry_hint=excluded.retry_hint, owner_hint=excluded.owner_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_json_db_source_of_truth_queue (source_key, data_area, source_title, source_status, current_source_hint, target_source_hint, migration_rule_hint, validation_hint, fallback_hint, sort_order, metadata, checked_at) values
('equipment_accessory_templates_source','equipment','Equipment accessory templates should become DB-owned','planned','Free-text checklist fields and UI hints.','DB template rows by equipment pool/category.','Migrate repeated checklists first, keep manual exception notes.','Compare checkout/arrival/return accessory rows to expected template.','Manual checklist remains fallback until coverage is complete.',10,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('seo_route_registry_source','seo','Public SEO route registry should become DB-approved source for sitemap/robots','review','Static sitemap/robots and route guardrail tables.','Approved DB route rows with title/meta/H1/local proof.','Only export routes marked approved/public.','Smoke sitemap, robots, title, meta, H1, and broken links.','Keep static files until generator passes.',20,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('runtime_message_catalog_source','runtime','Runtime fallback copy should become reviewed DB/admin catalog','planned','Hard-coded UI and function fallback strings.','DB-backed reviewed message catalog.','Start with Admin/accounting/equipment messages.','Verify no screen loses fallback if catalog is empty.','Hard-coded fallback remains fallback.',30,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('payment_exception_policy_source','accounting','Payment exception policy should be DB-reviewed instead of scattered UI notes','planned','Manual policy notes in Markdown and queue rows.','DB exception decision registry with thresholds/roles.','Migrate overpayment/writeoff/refund decisions first.','Payment actions must reference approved policy row.','Keep admin review queue if policy is missing.',40,'{"build":"2026-06-06c","schema":136}'::jsonb,now())
on conflict (source_key) do update set data_area=excluded.data_area, source_title=excluded.source_title, source_status=excluded.source_status, current_source_hint=excluded.current_source_hint, target_source_hint=excluded.target_source_hint, migration_rule_hint=excluded.migration_rule_hint, validation_hint=excluded.validation_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_roadmap_action_steps (step_key, step_batch, step_number, step_area, step_title, step_status, priority, source_doc, route_hint, acceptance_check, implementation_notes, risk_if_skipped, sort_order, metadata, checked_at) values
('schema136_done_01','completed_this_pass',1,'schema','Added schema 136 release cutover and source-of-truth queues','completed','high','DEVELOPMENT_ROADMAP.md','#admin','Migration and full schema include schema 136.','Cutover, payment exceptions, equipment service gates, SEO evidence, CSS drift, runtime fallback, and JSON/DB source-of-truth queues are DB-visible.','Release controls remain scattered.',1,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('schema136_done_02','completed_this_pass',2,'admin','Exposed schema 136 queues in Admin readiness','completed','high','DEVELOPMENT_ROADMAP.md','#admin','admin-directory and admin-ui reference schema 136 views.','Operators can inspect new queue rows from Admin.','Rows remain hidden.',2,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('schema136_done_03','completed_this_pass',3,'seo','Kept one-H1, sitemap, robots, and local SEO evidence guardrails current','completed','high','DEVELOPMENT_ROADMAP.md','/','Smoke confirms one H1 and SEO assets remain present/fresh.','Public local-search quality gates continue each pass.','SEO drift can hurt clarity.',3,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('schema136_done_04','completed_this_pass',4,'css','Added CSS drift watchlist for admin/mobile/form/readiness surfaces','completed','medium','KNOWN_ISSUES_AND_GAPS.md','#admin','CSS drift rows are visible and smoke keeps brace balance clean.','Recurring CSS drift gets an explicit review queue.','Mobile/admin layout regressions are missed.',4,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('schema136_done_05','completed_this_pass',5,'data_migration','Added JSON/DB source-of-truth queue for duplicate-risk data','completed','medium','KNOWN_ISSUES_AND_GAPS.md','#admin','Queue lists equipment templates, SEO routes, runtime messages, and payment exception policy.','Data migration decisions are clearer.','JSON/DB duplication keeps expanding.',5,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('schema136_next_01','next_20',1,'accounting','Implement staged payment application write path with reversal audit','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Apply/reverse payment actions create auditable rows.','Payment application becomes usable.','Cash matching stays manual.',101,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('schema136_next_02','next_20',2,'accounting','Implement bank CSV preview with duplicate/date/sign validation','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Bad rows are rejected before staging.','Reconciliation data quality improves.','Bad imports enter review.',102,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('schema136_next_03','next_20',3,'equipment','Implement return-to-service gate enforcement server-side','planned','high','DEVELOPMENT_ROADMAP.md','#jobs','Locked equipment cannot become available until service gates pass.','Equipment accountability is safer.','Failed equipment can re-enter service too soon.',103,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('schema136_next_04','next_20',4,'seo','Generate sitemap/robots from approved DB route evidence rows','planned','medium','DEVELOPMENT_ROADMAP.md','/','Sitemap/robots source is DB-approved routes.','Public SEO assets match evidence.','Static route list drifts.',104,'{"build":"2026-06-06c","schema":136}'::jsonb,now()),
('schema136_next_05','next_20',5,'runtime','Run fallback drills for missing views, stale cache, offline conflicts, and scan unsupported','planned','medium','KNOWN_ISSUES_AND_GAPS.md','#admin','Fallback drill rows move from planned to completed.','Error handling is tested instead of assumed.','Fallbacks can fail silently.',105,'{"build":"2026-06-06c","schema":136}'::jsonb,now())
on conflict (step_key) do update set step_batch=excluded.step_batch, step_number=excluded.step_number, step_area=excluded.step_area, step_title=excluded.step_title, step_status=excluded.step_status, priority=excluded.priority, source_doc=excluded.source_doc, route_hint=excluded.route_hint, acceptance_check=excluded.acceptance_check, implementation_notes=excluded.implementation_notes, risk_if_skipped=excluded.risk_if_skipped, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

drop view if exists public.v_app_release_cutover_checklist;
create view public.v_app_release_cutover_checklist as
select cutover_key, cutover_area, cutover_title, cutover_status, preflight_hint, deploy_hint, rollback_hint, owner_hint, route_hint, sort_order, checked_at, updated_at
from public.app_release_cutover_checklist
order by sort_order, cutover_key;

drop view if exists public.v_app_payment_exception_decision_queue;
create view public.v_app_payment_exception_decision_queue as
select decision_key, exception_area, decision_title, decision_status, validation_hint, posting_hint, approval_hint, rollback_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_payment_exception_decision_queue
order by sort_order, decision_key;

drop view if exists public.v_app_equipment_return_to_service_gate_queue;
create view public.v_app_equipment_return_to_service_gate_queue as
select gate_key, gate_area, gate_title, gate_status, scan_requirement_hint, accessory_requirement_hint, verifier_requirement_hint, service_task_requirement_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_equipment_return_to_service_gate_queue
order by sort_order, gate_key;

drop view if exists public.v_app_local_search_evidence_queue;
create view public.v_app_local_search_evidence_queue as
select evidence_key, route_key, evidence_area, evidence_title, evidence_status, phrase_hint, proof_hint, internal_link_hint, publication_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_local_search_evidence_queue
order by sort_order, evidence_key;

drop view if exists public.v_app_css_drift_watchlist;
create view public.v_app_css_drift_watchlist as
select watch_key, component_area, component_title, watch_status, token_hint, selector_hint, drift_risk_hint, test_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_css_drift_watchlist
order by sort_order, watch_key;

drop view if exists public.v_app_runtime_fallback_test_plan;
create view public.v_app_runtime_fallback_test_plan as
select test_key, app_surface, test_title, test_status, failure_mode, user_copy_hint, telemetry_hint, retry_hint, owner_hint, sort_order, checked_at, updated_at
from public.app_runtime_fallback_test_plan
order by sort_order, test_key;

drop view if exists public.v_app_json_db_source_of_truth_queue;
create view public.v_app_json_db_source_of_truth_queue as
select source_key, data_area, source_title, source_status, current_source_hint, target_source_hint, migration_rule_hint, validation_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_json_db_source_of_truth_queue
order by sort_order, source_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  136::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 136 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 136 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through schema 136.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (136, '136_release_cutover_payment_exception_equipment_service_seo_css_runtime_controls', '136_release_cutover_payment_exception_equipment_service_seo_css_runtime_controls.sql', '2026-06-06c', 'Adds release cutover, payment exception, equipment return-to-service, local SEO evidence, CSS drift, runtime fallback, and JSON/DB source-of-truth queues.', 'applied', 'This pass keeps schema/docs/cache/smoke guardrails aligned and records the next 20 work items in DB-visible queues.')
on conflict (schema_version) do update set migration_key=excluded.migration_key, schema_name=excluded.schema_name, release_label=excluded.release_label, description=excluded.description, status=excluded.status, notes=excluded.notes, applied_at=now();

grant select on public.app_release_cutover_checklist to authenticated;
grant select on public.app_payment_exception_decision_queue to authenticated;
grant select on public.app_equipment_return_to_service_gate_queue to authenticated;
grant select on public.app_local_search_evidence_queue to authenticated;
grant select on public.app_css_drift_watchlist to authenticated;
grant select on public.app_runtime_fallback_test_plan to authenticated;
grant select on public.app_json_db_source_of_truth_queue to authenticated;
grant select on public.v_app_release_cutover_checklist to authenticated;
grant select on public.v_app_payment_exception_decision_queue to authenticated;
grant select on public.v_app_equipment_return_to_service_gate_queue to authenticated;
grant select on public.v_app_local_search_evidence_queue to authenticated;
grant select on public.v_app_css_drift_watchlist to authenticated;
grant select on public.v_app_runtime_fallback_test_plan to authenticated;
grant select on public.v_app_json_db_source_of_truth_queue to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
