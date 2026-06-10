-- Schema 140: Release exit criteria, payment closeout, reconciliation exception workflow, equipment chain-of-custody, local SEO conversion, and fallback escalation controls.
-- Build 2026-06-09a.

begin;

create table if not exists public.app_release_exit_criteria_queue (
  criteria_key text primary key,
  criteria_area text not null,
  criteria_title text not null,
  criteria_status text not null default 'planned',
  evidence_hint text,
  blocker_hint text,
  owner_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_payment_closeout_action_queue (
  closeout_key text primary key,
  payment_area text not null,
  closeout_title text not null,
  closeout_status text not null default 'planned',
  source_rows_hint text,
  decision_hint text,
  posting_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_reconciliation_exception_workflow_queue (
  workflow_key text primary key,
  reconciliation_area text not null,
  workflow_title text not null,
  workflow_status text not null default 'planned',
  exception_hint text,
  reviewer_action_hint text,
  undo_or_lock_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_equipment_chain_of_custody_queue (
  custody_key text primary key,
  custody_area text not null,
  custody_title text not null,
  custody_status text not null default 'planned',
  scan_or_signature_hint text,
  verification_hint text,
  cost_or_service_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_local_seo_conversion_queue (
  conversion_key text primary key,
  route_key text,
  conversion_area text not null,
  conversion_title text not null,
  conversion_status text not null default 'planned',
  search_term_hint text,
  conversion_hint text,
  proof_or_link_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_runtime_fallback_escalation_queue (
  escalation_key text primary key,
  app_surface text not null,
  escalation_title text not null,
  escalation_status text not null default 'planned',
  detection_hint text,
  user_message_hint text,
  escalation_action_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_release_exit_criteria_queue (criteria_key, criteria_area, criteria_title, criteria_status, evidence_hint, blocker_hint, owner_hint, fallback_hint, sort_order, metadata, checked_at) values
('schema_140_exit_check','schema','Schema 140 applied and canonical full schema matches standalone migration','planned','Compare sql/140 file, sql/000_full_schema_reference.sql, v_schema_drift_status, and app_schema_versions row.','Block release if schema drift still expects an older version or full schema references retired columns.','Admin / developer','Apply standalone migrations first and use full schema only after smoke passes.',10,'{"build":"2026-06-09a","schema":140}'::jsonb,now()),
('edge_function_exit_check','edge_functions','admin-directory plus jobs functions deploy cleanly after schema 140','planned','Supabase deploy logs show parse-clean bundles and optional DB view fallback works.','Block release if admin-directory 500s or jobs-manage/jobs-directory bundle errors return.','Admin','Keep previous function deployed and show empty optional tables until redeployed.',20,'{"build":"2026-06-09a","schema":140}'::jsonb,now()),
('docs_seo_css_exit_check','docs_seo_css','Markdown, sitemap, robots, cache marker, one-H1, and CSS brace checks are current','in_progress','Active Markdown includes completed 20 and next 20; smoke confirms H1, sitemap, robots, CSS, and cache markers.','Block release if root helper docs/test files return or sitemap/cache marker is stale.','Admin / content','Use archive snapshots and NEW_CHAT_STATUS.md as recovery handoff.',30,'{"build":"2026-06-09a","schema":140}'::jsonb,now())
on conflict (criteria_key) do update set criteria_area=excluded.criteria_area, criteria_title=excluded.criteria_title, criteria_status=excluded.criteria_status, evidence_hint=excluded.evidence_hint, blocker_hint=excluded.blocker_hint, owner_hint=excluded.owner_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_payment_closeout_action_queue (closeout_key, payment_area, closeout_title, closeout_status, source_rows_hint, decision_hint, posting_hint, fallback_hint, sort_order, metadata, checked_at) values
('unapplied_cash_closeout','unapplied_cash','Close or document every unapplied cash row before month-end lock','planned','Payment applications, deposits, invoice balances, credits, refunds, write-offs, and overpayments.','Apply, hold, refund, reverse, write off, or export with reviewer reason.','Approved decisions post to journal/payment application candidates and lock after close.','Leave in exception queue and include accountant export if not resolved.',10,'{"build":"2026-06-09a","schema":140}'::jsonb,now()),
('refund_writeoff_approval','adjustments','Require approval trail for refunds, write-offs, discounts, and credit decisions','planned','Adjustment rows, customer account, invoice, payment source, and proof attachment.','Reviewer confirms reason, amount, tax handling, and close-period status.','Post only after approval; keep reversal row if changed later.','Hold adjustment in draft/review state until evidence is present.',20,'{"build":"2026-06-09a","schema":140}'::jsonb,now()),
('payment_export_reconciliation','accountant_export','Tie payment closeout decisions into the accountant export manifest','planned','Closed payment actions, unresolved exceptions, proof files, and export package.','Reviewer confirms package includes applied/unapplied cash, exceptions, and proof notes.','Export manifest becomes close-period evidence.','Generate CSV/JSON summary if final export packaging is incomplete.',30,'{"build":"2026-06-09a","schema":140}'::jsonb,now())
on conflict (closeout_key) do update set payment_area=excluded.payment_area, closeout_title=excluded.closeout_title, closeout_status=excluded.closeout_status, source_rows_hint=excluded.source_rows_hint, decision_hint=excluded.decision_hint, posting_hint=excluded.posting_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_reconciliation_exception_workflow_queue (workflow_key, reconciliation_area, workflow_title, workflow_status, exception_hint, reviewer_action_hint, undo_or_lock_hint, fallback_hint, sort_order, metadata, checked_at) values
('low_confidence_match_queue','match_scoring','Review low-confidence bank matches with reason and proof','planned','Bank CSV staging row, possible invoice/payment/journal matches, score, and duplicate flags.','Reviewer accepts, rejects, splits, or leaves unmatched with a note.','Accepted matches lock after close; rejected matches return to open pool.','Manual bank spreadsheet review remains fallback.',10,'{"build":"2026-06-09a","schema":140}'::jsonb,now()),
('split_match_exception_queue','split_matching','Handle split deposits and partial payments without losing audit trail','planned','One bank row mapped to multiple invoices/payments/adjustments or one payment split across bank rows.','Reviewer records split amounts and proof references.','Undo keeps split history and restores original open balance.','Export split details for accountant review if UI is not complete.',20,'{"build":"2026-06-09a","schema":140}'::jsonb,now()),
('unmatched_close_exception_queue','unmatched_close','Carry unresolved bank exceptions into close package with owner and due date','planned','Unmatched bank rows, duplicate rows, bad date/amount rows, and stale open exceptions.','Owner assigns due date, materiality, and next action.','Close can proceed only with reviewed exception note or approved blocker override.','Attach unresolved CSV to accountant package.',30,'{"build":"2026-06-09a","schema":140}'::jsonb,now())
on conflict (workflow_key) do update set reconciliation_area=excluded.reconciliation_area, workflow_title=excluded.workflow_title, workflow_status=excluded.workflow_status, exception_hint=excluded.exception_hint, reviewer_action_hint=excluded.reviewer_action_hint, undo_or_lock_hint=excluded.undo_or_lock_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_equipment_chain_of_custody_queue (custody_key, custody_area, custody_title, custody_status, scan_or_signature_hint, verification_hint, cost_or_service_hint, fallback_hint, sort_order, metadata, checked_at) values
('checkout_arrival_return_chain','chain_of_custody','Tie checkout, arrival, return, and return-to-service into one custody trail','in_progress','Equipment code/QR/barcode, worker/supervisor/admin signatures, site, job, and timestamps.','Each handoff confirms equipment identity, condition, accessories, and test result.','Failed tests open service task and possible recoverable cost review.','Manual equipment code entry and notes remain fallback.',10,'{"build":"2026-06-09a","schema":140}'::jsonb,now()),
('accessory_cost_recovery','accessory_costs','Turn missing/damaged accessory exceptions into cost recovery or write-off review','planned','Accessory checklist rows, missing/damaged notes, replacement cost, job/customer/internal decision.','Supervisor signs exception; admin/accounting decides billable/internal/write-off/warranty.','Decision links to job profitability and accountant export.','Keep exception visible until cost decision is recorded.',20,'{"build":"2026-06-09a","schema":140}'::jsonb,now()),
('return_to_service_override','lockout_override','Require admin override reason when locked-out equipment is returned to service without normal proof','planned','Open service task, lockout reason, proof gap, verifier role, override reason, and evidence.','Admin signs override and records risk/mitigation.','Override creates audit row and leaves follow-up service task if proof remains missing.','Keep equipment locked out if override is not approved.',30,'{"build":"2026-06-09a","schema":140}'::jsonb,now())
on conflict (custody_key) do update set custody_area=excluded.custody_area, custody_title=excluded.custody_title, custody_status=excluded.custody_status, scan_or_signature_hint=excluded.scan_or_signature_hint, verification_hint=excluded.verification_hint, cost_or_service_hint=excluded.cost_or_service_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_local_seo_conversion_queue (conversion_key, route_key, conversion_area, conversion_title, conversion_status, search_term_hint, conversion_hint, proof_or_link_hint, fallback_hint, sort_order, metadata, checked_at) values
('homepage_booking_cta_seo','home','homepage','Connect local service wording to a clear booking/contact action','in_progress','Use clear service and location terms in title, main heading, intro, and CTA anchor text.','CTA should lead to the most useful booking/contact path and not hide behind admin-only routes.','Proof block or service summary supports the local wording.','Keep generic CTA if public service routing is incomplete.',10,'{"build":"2026-06-09a","schema":140}'::jsonb,now()),
('service_area_internal_links','service_area','Add helpful internal links from approved local/service sections','planned','Use true service-area terms and avoid unsupported location pages.','Links should help users choose service, proof, pricing/quote, or contact paths.','Only approved sitemap routes should be linked from public copy.','Hold links in draft if proof or route is weak.',20,'{"build":"2026-06-09a","schema":140}'::jsonb,now()),
('seo_conversion_smoke','technical_seo','Smoke-test sitemap, robots, title/H1, meta, internal links, and conversion targets together','planned','Sitemap/robots, one-H1, title/meta, local terms, image alt, and CTA anchors.','Release check confirms public search wording and user action path are not disconnected.','Broken links or unsupported routes stay unpublished.','Static homepage remains fallback until route proof matures.',30,'{"build":"2026-06-09a","schema":140}'::jsonb,now())
on conflict (conversion_key) do update set route_key=excluded.route_key, conversion_area=excluded.conversion_area, conversion_title=excluded.conversion_title, conversion_status=excluded.conversion_status, search_term_hint=excluded.search_term_hint, conversion_hint=excluded.conversion_hint, proof_or_link_hint=excluded.proof_or_link_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_runtime_fallback_escalation_queue (escalation_key, app_surface, escalation_title, escalation_status, detection_hint, user_message_hint, escalation_action_hint, fallback_hint, sort_order, metadata, checked_at) values
('schema_view_missing_escalation','Admin readiness','Escalate repeated optional-view missing errors after schema deploy','covered','safeList missing-view errors continue after schema drift says current.','Show Apply schema/redeploy function message and name the missing view if known.','Redeploy admin-directory and compare full schema to standalone migration.','Keep empty tables and previous cached data where safe.',10,'{"build":"2026-06-09a","schema":140}'::jsonb,now()),
('payment_posting_blocked_escalation','Accounting workbench','Escalate payment/reconciliation rows blocked by proof or close-period lock','planned','Posting attempt fails because proof, approval, or period-open check is missing.','Explain missing blocker and leave action in review queue.','Admin/accountant attaches proof, reopens period with reason, or exports blocker.','Do not auto-retry accounting blockers.',20,'{"build":"2026-06-09a","schema":140}'::jsonb,now()),
('offline_draft_conflict_escalation','Mobile/offline forms','Escalate offline draft conflicts without discarding local work','review','Local draft conflicts with changed server row or failed network retry.','Offer Retry sync, Keep local copy, or Discard local after confirmation.','Supervisor reviews unresolved conflict queue before closeout.','Keep local draft until server acknowledges success.',30,'{"build":"2026-06-09a","schema":140}'::jsonb,now())
on conflict (escalation_key) do update set app_surface=excluded.app_surface, escalation_title=excluded.escalation_title, escalation_status=excluded.escalation_status, detection_hint=excluded.detection_hint, user_message_hint=excluded.user_message_hint, escalation_action_hint=excluded.escalation_action_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_roadmap_action_steps (step_key, step_batch, step_number, step_area, step_title, step_status, priority, source_doc, route_hint, acceptance_check, implementation_notes, risk_if_skipped, sort_order, metadata, checked_at) values
('schema140_done_01','completed_this_pass',1,'schema','Added schema 140 release-exit/control queues','completed','high','DEVELOPMENT_ROADMAP.md','#admin','Migration and full schema include schema 140.','Admin readiness can track release exit, payment closeout, reconciliation exceptions, equipment custody, SEO conversion, and fallback escalation.','Roadmap stays outside Admin readiness.',1,'{"build":"2026-06-09a","schema":140}'::jsonb,now()),
('schema140_done_02','completed_this_pass',2,'cleanup','Archived retired root Markdown and test_write files','completed','high','KNOWN_ISSUES_AND_GAPS.md','archive','Smoke root hygiene checks pass.','Active root stays clean and deployment bundle remains smaller.','Temporary files keep breaking smoke.',2,'{"build":"2026-06-09a","schema":140}'::jsonb,now()),
('schema140_done_03','completed_this_pass',3,'seo','Updated sitemap/cache marker and maintained one-H1 guardrail','completed','high','DEVELOPMENT_ROADMAP.md','/','Smoke checks confirm sitemap/robots/cache/H1 still pass.','Local SEO release checks stay aligned with public shell.','Stale assets may hide current copy or route changes.',3,'{"build":"2026-06-09a","schema":140}'::jsonb,now()),
('schema140_next_01','next_20',1,'accounting','Turn payment closeout queue rows into real Admin actions','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Apply/reverse/refund/write-off buttons update DB rows with approval reason.','Payment closeout becomes operational instead of queue-only.','Cash application remains manual.',101,'{"build":"2026-06-09a","schema":140}'::jsonb,now()),
('schema140_next_02','next_20',2,'reconciliation','Build split-match and unmatched exception UI with undo history','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Reviewer can split, undo, note, and export exceptions.','Bank reconciliation depth improves.','Unmatched rows stay spreadsheet-only.',102,'{"build":"2026-06-09a","schema":140}'::jsonb,now()),
('schema140_next_03','next_20',3,'equipment','Add chain-of-custody timeline and accessory cost recovery actions','planned','high','DEVELOPMENT_ROADMAP.md','#jobs','Equipment timeline shows checkout/arrival/return/service/cost rows.','Return accountability becomes easier to audit.','Missing accessories remain notes-only.',103,'{"build":"2026-06-09a","schema":140}'::jsonb,now()),
('schema140_next_04','next_20',4,'seo','Connect local SEO route proof to public conversion CTA checks','planned','medium','DEVELOPMENT_ROADMAP.md','/','Public links/CTA/sitemap/title/meta/local proof are checked together.','SEO work helps users act, not just find the site.','Search visibility and conversion stay disconnected.',104,'{"build":"2026-06-09a","schema":140}'::jsonb,now()),
('schema140_next_05','next_20',5,'runtime','Add fallback escalation event logging from UI and Edge Functions','planned','medium','KNOWN_ISSUES_AND_GAPS.md','#admin','Fallback events can be reviewed and counted.','Repeated deployment/schema/offline failures become visible.','Failures remain anecdotal.',105,'{"build":"2026-06-09a","schema":140}'::jsonb,now())
on conflict (step_key) do update set step_batch=excluded.step_batch, step_number=excluded.step_number, step_area=excluded.step_area, step_title=excluded.step_title, step_status=excluded.step_status, priority=excluded.priority, source_doc=excluded.source_doc, route_hint=excluded.route_hint, acceptance_check=excluded.acceptance_check, implementation_notes=excluded.implementation_notes, risk_if_skipped=excluded.risk_if_skipped, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

drop view if exists public.v_app_release_exit_criteria_queue;
create view public.v_app_release_exit_criteria_queue as select criteria_key, criteria_area, criteria_title, criteria_status, evidence_hint, blocker_hint, owner_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_release_exit_criteria_queue order by sort_order, criteria_key;

drop view if exists public.v_app_payment_closeout_action_queue;
create view public.v_app_payment_closeout_action_queue as select closeout_key, payment_area, closeout_title, closeout_status, source_rows_hint, decision_hint, posting_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_payment_closeout_action_queue order by sort_order, closeout_key;

drop view if exists public.v_app_reconciliation_exception_workflow_queue;
create view public.v_app_reconciliation_exception_workflow_queue as select workflow_key, reconciliation_area, workflow_title, workflow_status, exception_hint, reviewer_action_hint, undo_or_lock_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_reconciliation_exception_workflow_queue order by sort_order, workflow_key;

drop view if exists public.v_app_equipment_chain_of_custody_queue;
create view public.v_app_equipment_chain_of_custody_queue as select custody_key, custody_area, custody_title, custody_status, scan_or_signature_hint, verification_hint, cost_or_service_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_equipment_chain_of_custody_queue order by sort_order, custody_key;

drop view if exists public.v_app_local_seo_conversion_queue;
create view public.v_app_local_seo_conversion_queue as select conversion_key, route_key, conversion_area, conversion_title, conversion_status, search_term_hint, conversion_hint, proof_or_link_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_local_seo_conversion_queue order by sort_order, conversion_key;

drop view if exists public.v_app_runtime_fallback_escalation_queue;
create view public.v_app_runtime_fallback_escalation_queue as select escalation_key, app_surface, escalation_title, escalation_status, detection_hint, user_message_hint, escalation_action_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_runtime_fallback_escalation_queue order by sort_order, escalation_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  140::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 140 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 140 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through schema 140.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (140, '140_release_exit_payment_closeout_recon_equipment_seo_runtime_controls', '140_release_exit_payment_closeout_recon_equipment_seo_runtime_controls.sql', '2026-06-09a', 'Adds Admin-visible release exit criteria, payment closeout actions, reconciliation exception workflow, equipment chain-of-custody, local SEO conversion checks, and runtime fallback escalation queues.', 'applied', 'This pass keeps schema, Markdown, SEO assets, CSS/H1 checks, fallback escalation, and smoke checks aligned through schema 140.')
on conflict (schema_version) do update set migration_key=excluded.migration_key, schema_name=excluded.schema_name, release_label=excluded.release_label, description=excluded.description, status=excluded.status, notes=excluded.notes, applied_at=now();

grant select on public.app_release_exit_criteria_queue to authenticated;
grant select on public.app_payment_closeout_action_queue to authenticated;
grant select on public.app_reconciliation_exception_workflow_queue to authenticated;
grant select on public.app_equipment_chain_of_custody_queue to authenticated;
grant select on public.app_local_seo_conversion_queue to authenticated;
grant select on public.app_runtime_fallback_escalation_queue to authenticated;
grant select on public.v_app_release_exit_criteria_queue to authenticated;
grant select on public.v_app_payment_closeout_action_queue to authenticated;
grant select on public.v_app_reconciliation_exception_workflow_queue to authenticated;
grant select on public.v_app_equipment_chain_of_custody_queue to authenticated;
grant select on public.v_app_local_seo_conversion_queue to authenticated;
grant select on public.v_app_runtime_fallback_escalation_queue to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
