-- Schema 139: Release finalization controls for accounting cutover, equipment scan asset rollout, local SEO prominence publication, CSS/mobile release guard, runtime support playbooks, and data source migration locks.
-- Build 2026-06-07b.

begin;

create table if not exists public.app_accounting_cutover_trial_balance_queue (
  cutover_key text primary key,
  cutover_area text not null,
  cutover_title text not null,
  cutover_status text not null default 'planned',
  source_balance_hint text,
  exception_hint text,
  posting_lock_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_equipment_scan_asset_rollout_queue (
  rollout_key text primary key,
  rollout_area text not null,
  rollout_title text not null,
  rollout_status text not null default 'planned',
  asset_tag_hint text,
  scan_test_hint text,
  verifier_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_local_seo_prominence_publication_queue (
  publication_key text primary key,
  route_key text,
  publication_area text not null,
  publication_title text not null,
  publication_status text not null default 'planned',
  prominence_hint text,
  evidence_hint text,
  internal_link_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_css_mobile_release_guard_queue (
  guard_key text primary key,
  guard_area text not null,
  guard_title text not null,
  guard_status text not null default 'review',
  selector_hint text,
  mobile_test_hint text,
  accessibility_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_runtime_support_playbook_queue (
  playbook_key text primary key,
  app_surface text not null,
  playbook_title text not null,
  playbook_status text not null default 'planned',
  detection_hint text,
  user_message_hint text,
  support_action_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_data_source_migration_lock_queue (
  lock_key text primary key,
  data_area text not null,
  lock_title text not null,
  lock_status text not null default 'planned',
  current_source_hint text,
  target_source_hint text,
  validation_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_accounting_cutover_trial_balance_queue (cutover_key, cutover_area, cutover_title, cutover_status, source_balance_hint, exception_hint, posting_lock_hint, fallback_hint, sort_order, metadata, checked_at) values
('payment_application_trial_balance','payments','Trial-balance payment application before release','planned','Compare deposits, invoice balances, credits, refunds, write-offs, and unapplied cash totals.','Flag overpayments, duplicate payment refs, negative balances, and unapproved adjustments.','Block month-end lock until payment application exceptions are closed or exported.','Export unresolved rows to accountant package and keep Admin warning visible.',10,'{"build":"2026-06-07b","schema":139}'::jsonb,now()),
('reconciliation_trial_balance','bank_reconciliation','Trial-balance bank reconciliation before close','planned','Compare bank staging total, matched payment total, journal total, and unmatched row total.','Flag low-confidence matches, splits without notes, and undo history gaps.','Prevent close signoff while unreconciled material differences remain.','Use manual bank spreadsheet package as fallback.',20,'{"build":"2026-06-07b","schema":139}'::jsonb,now()),
('remittance_trial_balance','remittances','Trial-balance HST/GST and payroll remittance proof before accountant export','planned','Compare tax collected, ITCs, payroll deductions, employer costs, filing rows, and payment proof.','Flag missing filed/remitted dates or proof attachments.','Lock remittance rows after reviewed export unless reopened with reason.','Attach manual proof notes to export manifest.',30,'{"build":"2026-06-07b","schema":139}'::jsonb,now())
on conflict (cutover_key) do update set cutover_area=excluded.cutover_area, cutover_title=excluded.cutover_title, cutover_status=excluded.cutover_status, source_balance_hint=excluded.source_balance_hint, exception_hint=excluded.exception_hint, posting_lock_hint=excluded.posting_lock_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_equipment_scan_asset_rollout_queue (rollout_key, rollout_area, rollout_title, rollout_status, asset_tag_hint, scan_test_hint, verifier_hint, fallback_hint, sort_order, metadata, checked_at) values
('equipment_qr_rollout','qr_barcode','Print/apply QR or barcode values for active equipment assets','planned','Use equipment_code, asset_tag, qr_code_value, barcode_value, and home/current site fields.','Test scan/manual entry at checkout, arrival, return, and service closeout.','Supervisor verifies asset identity; admin handles duplicate/missing codes.','Manual equipment-code entry remains fallback.',10,'{"build":"2026-06-07b","schema":139}'::jsonb,now()),
('accessory_template_rollout','accessories','Attach reusable accessory templates to equipment categories/pools','planned','Map required accessories to equipment_pool_key/category and expected return condition.','Compare checkout/arrival/return checklist rows and missing/damaged notes.','Supervisor signs missing accessory exceptions; accounting reviews recoverable costs.','Free-text checklist remains fallback until template is approved.',20,'{"build":"2026-06-07b","schema":139}'::jsonb,now()),
('return_service_scan_closeout','return_to_service','Require scan plus proof before locked-out equipment returns to service','planned','Open service task, failed test row, evidence files, asset code, and verifier role.','Scan must match the service task equipment item before closing.','Admin required for lockout override and return-to-service exception.','Keep equipment locked out and show service-task source rows.',30,'{"build":"2026-06-07b","schema":139}'::jsonb,now())
on conflict (rollout_key) do update set rollout_area=excluded.rollout_area, rollout_title=excluded.rollout_title, rollout_status=excluded.rollout_status, asset_tag_hint=excluded.asset_tag_hint, scan_test_hint=excluded.scan_test_hint, verifier_hint=excluded.verifier_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_local_seo_prominence_publication_queue (publication_key, route_key, publication_area, publication_title, publication_status, prominence_hint, evidence_hint, internal_link_hint, fallback_hint, sort_order, metadata, checked_at) values
('homepage_prominence_release','home','homepage','Publish homepage wording only after local prominence evidence check','in_progress','Use plain searched terms in title, H1, first paragraph, internal anchors, and service proof blocks.','Evidence must match real service area and current service offering.','Link only to useful approved public routes and proof/booking sections.','Keep generic homepage copy if route evidence is weak.',10,'{"build":"2026-06-07b","schema":139}'::jsonb,now()),
('service_route_prominence_release','services','service_pages','Prepare approved service-location route wording for sitemap publication','planned','Use service + town/region phrasing where coverage is true and useful.','Proof must include actual service, customer/job proof when available, and no overclaiming.','Suggest internal links from home, service summaries, and booking CTA.','Do not publish route until one-H1/meta/link checks pass.',20,'{"build":"2026-06-07b","schema":139}'::jsonb,now()),
('seo_asset_release','technical_seo','sitemap_robots','Refresh sitemap/robots and check lastmod after content release','in_progress','Sitemap includes only approved routes with current lastmod.','Robots references sitemap and no accidental blocks.','Internal links should match the sitemap route set.','Static sitemap and robots remain fallback.',30,'{"build":"2026-06-07b","schema":139}'::jsonb,now())
on conflict (publication_key) do update set route_key=excluded.route_key, publication_area=excluded.publication_area, publication_title=excluded.publication_title, publication_status=excluded.publication_status, prominence_hint=excluded.prominence_hint, evidence_hint=excluded.evidence_hint, internal_link_hint=excluded.internal_link_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_css_mobile_release_guard_queue (guard_key, guard_area, guard_title, guard_status, selector_hint, mobile_test_hint, accessibility_hint, fallback_hint, sort_order, metadata, checked_at) values
('admin_table_mobile_guard','admin_tables','Guard Admin readiness tables against horizontal overflow and cramped cards','review','table-scroll, admin-table-note, status-pill, readiness panel selectors.','Check 360px, 390px, 768px, and desktop widths.','Preserve readable text, tap targets, contrast, and focus outlines.','Use table-scroll and compact notes instead of hiding columns.',10,'{"build":"2026-06-07b","schema":139}'::jsonb,now()),
('equipment_mobile_guard','equipment_mobile','Guard scan/checklist/return-to-service mobile controls','planned','Equipment scan, accessory checklist, return test, proof upload, and verification controls.','Check one-handed field workflow and offline/manual entry fallback.','Labels must remain visible and button order must be predictable.','Manual code entry and simple checklist text remain fallback.',20,'{"build":"2026-06-07b","schema":139}'::jsonb,now()),
('public_seo_mobile_guard','public_shell','Guard public homepage SEO copy and CTA layout on mobile','review','Hero, H1, meta-linked content, CTA buttons, service/local proof sections.','Check mobile text wrapping and no duplicate H1.','Keep accessible heading hierarchy and clear CTA labels.','Collapse optional proof blocks if they crowd the page.',30,'{"build":"2026-06-07b","schema":139}'::jsonb,now())
on conflict (guard_key) do update set guard_area=excluded.guard_area, guard_title=excluded.guard_title, guard_status=excluded.guard_status, selector_hint=excluded.selector_hint, mobile_test_hint=excluded.mobile_test_hint, accessibility_hint=excluded.accessibility_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_runtime_support_playbook_queue (playbook_key, app_surface, playbook_title, playbook_status, detection_hint, user_message_hint, support_action_hint, fallback_hint, sort_order, metadata, checked_at) values
('edge_optional_view_playbook','Admin Edge Functions','Optional view missing or schema not yet applied','covered','safeList returns empty rows or schema drift view reports behind.','Show apply-schema message and keep the panel usable.','Apply missing migration, redeploy admin-directory, then hard-refresh.','Keep cached/empty table fallback live.',10,'{"build":"2026-06-07b","schema":139}'::jsonb,now()),
('service_worker_stale_playbook','Public shell','Stale service worker or asset cache mismatch','covered','Index marker and service-worker cache marker do not match current build.','Ask user to hard-refresh or clear site data.','Update cache marker, deploy assets, clear old worker, retest smoke.','Install assets one at a time and keep shell fallback.',20,'{"build":"2026-06-07b","schema":139}'::jsonb,now()),
('accounting_blocked_playbook','Accounting workbench','Accounting action blocked by missing proof/signoff/period lock','planned','Action row reports missing proof, reviewer, close-period, or exception closure.','Explain which proof/signoff is missing and leave row in queue.','Attach proof or reopen period with reason before retrying.','Export blocked row to accountant package.',30,'{"build":"2026-06-07b","schema":139}'::jsonb,now())
on conflict (playbook_key) do update set app_surface=excluded.app_surface, playbook_title=excluded.playbook_title, playbook_status=excluded.playbook_status, detection_hint=excluded.detection_hint, user_message_hint=excluded.user_message_hint, support_action_hint=excluded.support_action_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_data_source_migration_lock_queue (lock_key, data_area, lock_title, lock_status, current_source_hint, target_source_hint, validation_hint, fallback_hint, sort_order, metadata, checked_at) values
('roadmap_queue_db_lock','roadmap','Lock roadmap/action queues to DB-visible registry rows','in_progress','Markdown roadmap plus app_roadmap_action_steps and schema-specific queues.','DB tables/views for Admin display; Markdown remains narrative source.','Smoke checks confirm docs, schema, and Admin views stay aligned.','Markdown-only checklist remains fallback if DB view unavailable.',10,'{"build":"2026-06-07b","schema":139}'::jsonb,now()),
('equipment_accountability_db_lock','equipment','Move reusable equipment scan/accessory/accountability rules from free text to DB','planned','Equipment notes, signout checklist JSON, service tasks, and transfer events.','Equipment templates/asset registry/service work-order tables.','Validate no duplicate asset tags and verify return-to-service flow.','Manual notes remain fallback for one-off equipment.',20,'{"build":"2026-06-07b","schema":139}'::jsonb,now()),
('seo_publication_db_lock','seo','Move public route publish decisions from Markdown to DB registry','planned','Markdown SEO notes, sitemap.xml, robots.txt, route registry, and proof queues.','Route registry plus publication queue and smoke-check source rows.','Validate one-H1, title/meta, sitemap, broken links, and proof status.','Static sitemap and manual route notes remain fallback.',30,'{"build":"2026-06-07b","schema":139}'::jsonb,now())
on conflict (lock_key) do update set data_area=excluded.data_area, lock_title=excluded.lock_title, lock_status=excluded.lock_status, current_source_hint=excluded.current_source_hint, target_source_hint=excluded.target_source_hint, validation_hint=excluded.validation_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

drop view if exists public.v_app_accounting_cutover_trial_balance_queue;
create view public.v_app_accounting_cutover_trial_balance_queue as select cutover_key, cutover_area, cutover_title, cutover_status, source_balance_hint, exception_hint, posting_lock_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_accounting_cutover_trial_balance_queue order by sort_order, cutover_key;

drop view if exists public.v_app_equipment_scan_asset_rollout_queue;
create view public.v_app_equipment_scan_asset_rollout_queue as select rollout_key, rollout_area, rollout_title, rollout_status, asset_tag_hint, scan_test_hint, verifier_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_equipment_scan_asset_rollout_queue order by sort_order, rollout_key;

drop view if exists public.v_app_local_seo_prominence_publication_queue;
create view public.v_app_local_seo_prominence_publication_queue as select publication_key, route_key, publication_area, publication_title, publication_status, prominence_hint, evidence_hint, internal_link_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_local_seo_prominence_publication_queue order by sort_order, publication_key;

drop view if exists public.v_app_css_mobile_release_guard_queue;
create view public.v_app_css_mobile_release_guard_queue as select guard_key, guard_area, guard_title, guard_status, selector_hint, mobile_test_hint, accessibility_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_css_mobile_release_guard_queue order by sort_order, guard_key;

drop view if exists public.v_app_runtime_support_playbook_queue;
create view public.v_app_runtime_support_playbook_queue as select playbook_key, app_surface, playbook_title, playbook_status, detection_hint, user_message_hint, support_action_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_runtime_support_playbook_queue order by sort_order, playbook_key;

drop view if exists public.v_app_data_source_migration_lock_queue;
create view public.v_app_data_source_migration_lock_queue as select lock_key, data_area, lock_title, lock_status, current_source_hint, target_source_hint, validation_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_data_source_migration_lock_queue order by sort_order, lock_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  139::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 139 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 139 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through schema 139.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (139, '139_accounting_cutover_equipment_scan_seo_css_runtime_finalization_controls', '139_accounting_cutover_equipment_scan_seo_css_runtime_finalization_controls.sql', '2026-06-07b', 'Adds Admin-visible finalization queues for accounting cutover, equipment scan asset rollout, local SEO prominence publication, CSS/mobile release guard, runtime support playbooks, and data-source migration locks.', 'applied', 'This pass keeps schema, Markdown, SEO assets, CSS/mobile checks, fallback playbooks, and smoke checks aligned for release finalization.')
on conflict (schema_version) do update set migration_key=excluded.migration_key, schema_name=excluded.schema_name, release_label=excluded.release_label, description=excluded.description, status=excluded.status, notes=excluded.notes, applied_at=now();

grant select on public.app_accounting_cutover_trial_balance_queue to authenticated;
grant select on public.app_equipment_scan_asset_rollout_queue to authenticated;
grant select on public.app_local_seo_prominence_publication_queue to authenticated;
grant select on public.app_css_mobile_release_guard_queue to authenticated;
grant select on public.app_runtime_support_playbook_queue to authenticated;
grant select on public.app_data_source_migration_lock_queue to authenticated;
grant select on public.v_app_accounting_cutover_trial_balance_queue to authenticated;
grant select on public.v_app_equipment_scan_asset_rollout_queue to authenticated;
grant select on public.v_app_local_seo_prominence_publication_queue to authenticated;
grant select on public.v_app_css_mobile_release_guard_queue to authenticated;
grant select on public.v_app_runtime_support_playbook_queue to authenticated;
grant select on public.v_app_data_source_migration_lock_queue to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
