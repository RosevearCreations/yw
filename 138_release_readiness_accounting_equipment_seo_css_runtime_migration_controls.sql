-- Schema 138: Release readiness controls for accounting exception closure, equipment service verification, local SEO refresh, CSS/mobile regression, runtime observability, and data migration closeout.
-- Build 2026-06-07a.

begin;

create table if not exists public.app_release_readiness_signoff_queue (
  signoff_key text primary key,
  signoff_area text not null,
  signoff_title text not null,
  signoff_status text not null default 'planned',
  evidence_hint text,
  verifier_hint text,
  release_block_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_accounting_exception_closure_queue (
  exception_key text primary key,
  exception_area text not null,
  exception_title text not null,
  closure_status text not null default 'planned',
  source_rows_hint text,
  decision_hint text,
  posting_or_lock_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_equipment_service_verification_queue (
  verification_key text primary key,
  equipment_area text not null,
  verification_title text not null,
  verification_status text not null default 'planned',
  scan_or_asset_hint text,
  service_proof_hint text,
  role_gate_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_local_seo_refresh_queue (
  refresh_key text primary key,
  route_key text,
  refresh_area text not null,
  refresh_title text not null,
  refresh_status text not null default 'planned',
  keyword_hint text,
  proof_hint text,
  internal_link_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_css_mobile_regression_queue (
  regression_key text primary key,
  component_area text not null,
  regression_title text not null,
  regression_status text not null default 'review',
  breakpoint_hint text,
  selector_hint text,
  test_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_runtime_observability_release_queue (
  observability_key text primary key,
  app_surface text not null,
  observability_title text not null,
  observability_status text not null default 'planned',
  signal_hint text,
  user_message_hint text,
  operator_action_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_release_readiness_signoff_queue (signoff_key, signoff_area, signoff_title, signoff_status, evidence_hint, verifier_hint, release_block_hint, fallback_hint, sort_order, metadata, checked_at) values
('schema_full_reference_rebuild','schema','Canonical full schema matches standalone migrations through schema 138','in_progress','Compare sql/000_full_schema_reference.sql against standalone migrations and schema drift view.','Admin or developer verifies before deploy.','Block release if canonical schema still references retired columns or older schema drift.','Apply standalone migrations only if full schema confidence is not ready.',10,'{"build":"2026-06-07a","schema":138}'::jsonb,now()),
('edge_function_redeploy_window','deployment','Redeploy Edge Functions after schema 138 and verify optional-view fallbacks','planned','admin-directory should load schema 138 views while jobs-manage/jobs-directory remain parse-clean.','Admin verifies Supabase deploy logs and dashboard load.','Block release if an Edge Function bundle parse error or 500 appears.','Keep previous Edge Function live and use optional empty-table fallback.',20,'{"build":"2026-06-07a","schema":138}'::jsonb,now()),
('markdown_schema_sync_signoff','documentation','Markdown roadmap/issues/schema notes match release 2026-06-07a','completed','Active Markdown includes completed 20 and next 20 steps plus schema 138 notes.','Project maintainer reviews docs before next upload.','Block if roadmap points to already-completed steps only.','Use NEW_CHAT_STATUS.md as short recovery handoff.',30,'{"build":"2026-06-07a","schema":138}'::jsonb,now())
on conflict (signoff_key) do update set signoff_area=excluded.signoff_area, signoff_title=excluded.signoff_title, signoff_status=excluded.signoff_status, evidence_hint=excluded.evidence_hint, verifier_hint=excluded.verifier_hint, release_block_hint=excluded.release_block_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_accounting_exception_closure_queue (exception_key, exception_area, exception_title, closure_status, source_rows_hint, decision_hint, posting_or_lock_hint, fallback_hint, sort_order, metadata, checked_at) values
('unapplied_cash_review','payment_application','Close unapplied cash, overpayment, credit, refund, write-off, and reversal exceptions','planned','AR/AP payments, invoices, deposits, credits, refunds, and open adjustment rows.','Reviewer chooses apply, hold, refund, write off, or reverse with reason.','Post only after close-period check passes and proof is attached.','Keep exception in review queue and export to accountant package.',10,'{"build":"2026-06-07a","schema":138}'::jsonb,now()),
('low_confidence_recon_match','bank_reconciliation','Resolve low-confidence and unmatched bank rows before close','planned','Bank staging rows, scoring rules, possible invoice/payment matches, and unmatched exports.','Reviewer accepts match, split, undo, or leaves unmatched with note.','Matched rows lock after month-end close; unmatched rows stay open.','CSV export of unresolved rows remains manual fallback.',20,'{"build":"2026-06-07a","schema":138}'::jsonb,now()),
('remittance_proof_gap','tax_payroll_remittance','Close HST/GST and payroll remittance proof gaps','planned','Source totals, adjustments, filing dates, remittance payment proof, and reviewer notes.','Reviewer signs proof or records missing evidence.','Closed remittance blocks edits unless reopened with reason.','Manual accountant proof package remains fallback.',30,'{"build":"2026-06-07a","schema":138}'::jsonb,now())
on conflict (exception_key) do update set exception_area=excluded.exception_area, exception_title=excluded.exception_title, closure_status=excluded.closure_status, source_rows_hint=excluded.source_rows_hint, decision_hint=excluded.decision_hint, posting_or_lock_hint=excluded.posting_or_lock_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_equipment_service_verification_queue (verification_key, equipment_area, verification_title, verification_status, scan_or_asset_hint, service_proof_hint, role_gate_hint, fallback_hint, sort_order, metadata, checked_at) values
('return_to_service_scan_gate','equipment_return','Scan/enter equipment code before return-to-service signoff','planned','Use QR/barcode/manual code and compare to open service task equipment id.','Service proof includes return test, accessory checklist, and repair notes.','Supervisor+ verifies; admin required for lockout override.','Keep equipment locked out if scan or proof fails.',10,'{"build":"2026-06-07a","schema":138}'::jsonb,now()),
('accessory_kit_closeout','equipment_accessories','Verify required accessories before returned equipment is available','planned','Accessory template, checkout list, arrival list, return list, and missing/damaged notes.','Proof records all required accessories complete or replacement cost created.','Supervisor signs exception; admin/accounting reviews cost recovery.','Manual accessory note remains fallback until templates are fully live.',20,'{"build":"2026-06-07a","schema":138}'::jsonb,now()),
('failed_test_cost_link','equipment_costs','Link failed tests and service tasks to job profitability','in_progress','Failed arrival/return tests, service task cost, downtime, transport, replacement, and repair amounts.','Proof shows whether cost is billable, internal, warranty, or write-off.','Admin/accounting reviews cost treatment before close.','Show source rows if rollup cannot post automatically.',30,'{"build":"2026-06-07a","schema":138}'::jsonb,now())
on conflict (verification_key) do update set equipment_area=excluded.equipment_area, verification_title=excluded.verification_title, verification_status=excluded.verification_status, scan_or_asset_hint=excluded.scan_or_asset_hint, service_proof_hint=excluded.service_proof_hint, role_gate_hint=excluded.role_gate_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_local_seo_refresh_queue (refresh_key, route_key, refresh_area, refresh_title, refresh_status, keyword_hint, proof_hint, internal_link_hint, fallback_hint, sort_order, metadata, checked_at) values
('homepage_local_terms_refresh','home','homepage','Refresh homepage title/H1/intro with clear local service wording','in_progress','Use plain searched terms in title, main heading, first paragraph, and internal link anchors.','Proof must match actual service area and real service offering.','Link to service-area, proof, and booking/admin routes only when useful.','Keep generic copy if proof is not ready.',10,'{"build":"2026-06-07a","schema":138}'::jsonb,now()),
('service_page_proof_depth','service_pages','service_depth','Add service proof blocks without creating thin doorway pages','planned','Use customer-language phrases but avoid overclaiming locations.','Proof from job records, approved media, service policy, or local evidence.','Internal links should help users choose the right service path.','Hold route in draft queue when proof is weak.',20,'{"build":"2026-06-07a","schema":138}'::jsonb,now()),
('seo_asset_refresh','sitemap_robots','technical_seo','Refresh sitemap/robots and local route smoke checks each release','completed','Sitemap lastmod and robots sitemap pointer remain current.','Only approved public routes should be included.','Internal links should not point to unpublished/unsupported pages.','Keep route unpublished until smoke passes.',30,'{"build":"2026-06-07a","schema":138}'::jsonb,now())
on conflict (refresh_key) do update set route_key=excluded.route_key, refresh_area=excluded.refresh_area, refresh_title=excluded.refresh_title, refresh_status=excluded.refresh_status, keyword_hint=excluded.keyword_hint, proof_hint=excluded.proof_hint, internal_link_hint=excluded.internal_link_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_css_mobile_regression_queue (regression_key, component_area, regression_title, regression_status, breakpoint_hint, selector_hint, test_hint, fallback_hint, sort_order, metadata, checked_at) values
('admin_readiness_table_wrap','admin_readiness','Admin readiness tables stay scrollable and readable on mobile','review','320px, 390px, 768px widths.','.table-scroll, admin readiness tables, status pills','Confirm no horizontal layout break outside intended scroll containers.','Card-style stacked rows can replace dense tables later.',10,'{"build":"2026-06-07a","schema":138}'::jsonb,now()),
('equipment_action_button_spacing','equipment_mobile','Equipment checkout/arrival/return actions remain tap-safe','review','Touch targets at mobile widths and zoomed text.','.equipment-actions, .admin-inline-actions, .btn','Check scan/manual-entry buttons do not overlap form controls.','Use full-width button stack on narrow screens.',20,'{"build":"2026-06-07a","schema":138}'::jsonb,now()),
('offline_banner_contrast','runtime_messages','Fallback/offline banners remain visible in dark and light sections','planned','Mobile and desktop, high contrast mode.','.offline-banner, .toast, .admin-alert','Check fallback text is readable and does not hide primary action.','Use plain alert block if toast styling fails.',30,'{"build":"2026-06-07a","schema":138}'::jsonb,now())
on conflict (regression_key) do update set component_area=excluded.component_area, regression_title=excluded.regression_title, regression_status=excluded.regression_status, breakpoint_hint=excluded.breakpoint_hint, selector_hint=excluded.selector_hint, test_hint=excluded.test_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_runtime_observability_release_queue (observability_key, app_surface, observability_title, observability_status, signal_hint, user_message_hint, operator_action_hint, fallback_hint, sort_order, metadata, checked_at) values
('edge_optional_view_fallback','admin_directory','Optional view failures return empty arrays with deployment hints','covered','safeList errors, missing views, schema drift status, and Edge Function logs.','Show Apply schema / redeploy function message without crashing dashboard.','Apply missing schema then redeploy admin-directory.','Keep previous rows or empty table as safe fallback.',10,'{"build":"2026-06-07a","schema":138}'::jsonb,now()),
('service_worker_cache_mismatch','public_shell','Service worker cache marker mismatch is visible and recoverable','covered','Index marker, service-worker cache name, and stale asset reports.','Ask for hard refresh or service worker clear when old assets remain.','Bump marker and verify server-worker install uses per-asset fallback.','Network-first shell fallback remains available.',20,'{"build":"2026-06-07a","schema":138}'::jsonb,now()),
('offline_draft_sync_conflict','mobile_forms','Offline draft sync conflicts preserve local data and explain choices','review','Local draft count, failed sync timestamp, conflict response, and retry result.','Offer Retry, Keep local, or Discard local options.','Supervisor reviews unresolved conflicts.','Keep local draft until server acknowledges success.',30,'{"build":"2026-06-07a","schema":138}'::jsonb,now())
on conflict (observability_key) do update set app_surface=excluded.app_surface, observability_title=excluded.observability_title, observability_status=excluded.observability_status, signal_hint=excluded.signal_hint, user_message_hint=excluded.user_message_hint, operator_action_hint=excluded.operator_action_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

drop view if exists public.v_app_release_readiness_signoff_queue;
create view public.v_app_release_readiness_signoff_queue as
select signoff_key, signoff_area, signoff_title, signoff_status, evidence_hint, verifier_hint, release_block_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_release_readiness_signoff_queue
order by sort_order, signoff_key;

drop view if exists public.v_app_accounting_exception_closure_queue;
create view public.v_app_accounting_exception_closure_queue as
select exception_key, exception_area, exception_title, closure_status, source_rows_hint, decision_hint, posting_or_lock_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_accounting_exception_closure_queue
order by sort_order, exception_key;

drop view if exists public.v_app_equipment_service_verification_queue;
create view public.v_app_equipment_service_verification_queue as
select verification_key, equipment_area, verification_title, verification_status, scan_or_asset_hint, service_proof_hint, role_gate_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_equipment_service_verification_queue
order by sort_order, verification_key;

drop view if exists public.v_app_local_seo_refresh_queue;
create view public.v_app_local_seo_refresh_queue as
select refresh_key, route_key, refresh_area, refresh_title, refresh_status, keyword_hint, proof_hint, internal_link_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_local_seo_refresh_queue
order by sort_order, refresh_key;

drop view if exists public.v_app_css_mobile_regression_queue;
create view public.v_app_css_mobile_regression_queue as
select regression_key, component_area, regression_title, regression_status, breakpoint_hint, selector_hint, test_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_css_mobile_regression_queue
order by sort_order, regression_key;

drop view if exists public.v_app_runtime_observability_release_queue;
create view public.v_app_runtime_observability_release_queue as
select observability_key, app_surface, observability_title, observability_status, signal_hint, user_message_hint, operator_action_hint, fallback_hint, sort_order, checked_at, updated_at
from public.app_runtime_observability_release_queue
order by sort_order, observability_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  138::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 138 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 138 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through schema 138.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (138, '138_release_readiness_accounting_equipment_seo_css_runtime_migration_controls', '138_release_readiness_accounting_equipment_seo_css_runtime_migration_controls.sql', '2026-06-07a', 'Adds release readiness signoff, accounting exception closure, equipment service verification, local SEO refresh, CSS/mobile regression, and runtime observability release queues.', 'applied', 'This pass keeps schema, Markdown, Admin readiness, SEO/H1, CSS, fallback and smoke checks aligned through schema 138.')
on conflict (schema_version) do update set migration_key=excluded.migration_key, schema_name=excluded.schema_name, release_label=excluded.release_label, description=excluded.description, status=excluded.status, notes=excluded.notes, applied_at=now();

grant select on public.app_release_readiness_signoff_queue to authenticated;
grant select on public.app_accounting_exception_closure_queue to authenticated;
grant select on public.app_equipment_service_verification_queue to authenticated;
grant select on public.app_local_seo_refresh_queue to authenticated;
grant select on public.app_css_mobile_regression_queue to authenticated;
grant select on public.app_runtime_observability_release_queue to authenticated;
grant select on public.v_app_release_readiness_signoff_queue to authenticated;
grant select on public.v_app_accounting_exception_closure_queue to authenticated;
grant select on public.v_app_equipment_service_verification_queue to authenticated;
grant select on public.v_app_local_seo_refresh_queue to authenticated;
grant select on public.v_app_css_mobile_regression_queue to authenticated;
grant select on public.v_app_runtime_observability_release_queue to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
