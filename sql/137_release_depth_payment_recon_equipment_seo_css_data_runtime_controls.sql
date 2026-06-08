-- Schema 137: Release depth controls for payments, reconciliation, equipment service cost recovery, local SEO prominence, CSS accessibility fallbacks, data migration validation, and runtime messages.
-- Build 2026-06-06d.

begin;

create table if not exists public.app_payment_reconciliation_cutover_drill_queue (
  drill_key text primary key,
  drill_area text not null,
  drill_title text not null,
  drill_status text not null default 'planned',
  validation_hint text,
  posting_hint text,
  signoff_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_equipment_service_cost_recovery_queue (
  recovery_key text primary key,
  recovery_area text not null,
  recovery_title text not null,
  recovery_status text not null default 'planned',
  source_cost_hint text,
  job_link_hint text,
  approval_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_local_seo_prominence_action_queue (
  action_key text primary key,
  route_key text,
  action_area text not null,
  action_title text not null,
  action_status text not null default 'planned',
  prominent_wording_hint text,
  proof_hint text,
  internal_link_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_css_accessibility_fallback_queue (
  check_key text primary key,
  component_area text not null,
  check_title text not null,
  check_status text not null default 'review',
  accessibility_hint text,
  selector_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_data_migration_validation_queue (
  validation_key text primary key,
  data_area text not null,
  validation_title text not null,
  validation_status text not null default 'review',
  current_source_hint text,
  target_source_hint text,
  validation_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_runtime_release_message_queue (
  message_key text primary key,
  app_surface text not null,
  message_title text not null,
  message_status text not null default 'planned',
  failure_hint text,
  user_message_hint text,
  operator_hint text,
  retry_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_payment_reconciliation_cutover_drill_queue (drill_key, drill_area, drill_title, drill_status, validation_hint, posting_hint, signoff_hint, fallback_hint, sort_order, metadata, checked_at) values
('payment_apply_cutover_drill','payment_application','Dry-run payment apply, reverse, credit, refund, and write-off decisions before live posting','planned','Use staged invoices, deposits, credits, refunds, and overpayments with expected balances.','Post only to test rows until reviewer acceptance matches expected totals.','Admin/accountant signs off the drill result and unresolved exceptions.','Keep payment actions read-only until drill proof is complete.',10,'{"build":"2026-06-06d","schema":137}'::jsonb,now()),
('bank_recon_cutover_drill','bank_reconciliation','Dry-run CSV import, match scoring, split match, manual match, undo, and review queue','planned','Validate headers, dates, duplicates, amount signs, confidence scores, and unmatched rows.','Block posting until low-confidence matches are accepted by reviewer.','Reviewer note is required for split/undo/low-confidence matches.','Export unmatched rows for manual review if scoring is unavailable.',20,'{"build":"2026-06-06d","schema":137}'::jsonb,now()),
('close_lock_cutover_drill','month_end_close','Test period lock, reopen reason, blocked posting, proof package, and accountant export','planned','Use a closed test period with pending proof rows and an attempted late posting.','Closed periods block posting unless reopened with reason.','Final close requires remittance, reconciliation, and export proof.','Leave period open until missing proof rows are resolved.',30,'{"build":"2026-06-06d","schema":137}'::jsonb,now())
on conflict (drill_key) do update set drill_area=excluded.drill_area, drill_title=excluded.drill_title, drill_status=excluded.drill_status, validation_hint=excluded.validation_hint, posting_hint=excluded.posting_hint, signoff_hint=excluded.signoff_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_equipment_service_cost_recovery_queue (recovery_key, recovery_area, recovery_title, recovery_status, source_cost_hint, job_link_hint, approval_hint, fallback_hint, sort_order, metadata, checked_at) values
('failed_return_cost_recovery','return_to_service','Failed return tests generate cost review before equipment becomes available','in_progress','Repair, replacement, accessory, labour, transport, and downtime cost fields are reviewed.','Cost row references source job, signout, equipment, and service task.','Supervisor verifies return-to-service; admin/accountant reviews billable treatment.','Keep item locked out and cost noted manually if financial event creation fails.',10,'{"build":"2026-06-06d","schema":137}'::jsonb,now()),
('accessory_replacement_cost','accessories','Missing or damaged accessories create replacement cost candidates','planned','Accessory template defines required kit and expected replacement price.','Replacement cost links to the job that returned the equipment if applicable.','Supervisor approves missing/damaged accessory exception.','Use manual exception note until accessory template is migrated to DB.',20,'{"build":"2026-06-06d","schema":137}'::jsonb,now()),
('site_transfer_delay_cost','site_transfer','Late or failed site arrival verification creates delay-cost review','planned','Late arrival, failed site test, transport issue, and downtime notes are source evidence.','Delay cost links to job profitability and transfer event.','Supervisor signs off delay reason before cost is billable/non-billable.','Show unresolved transfer exception in Equipment panel.',30,'{"build":"2026-06-06d","schema":137}'::jsonb,now())
on conflict (recovery_key) do update set recovery_area=excluded.recovery_area, recovery_title=excluded.recovery_title, recovery_status=excluded.recovery_status, source_cost_hint=excluded.source_cost_hint, job_link_hint=excluded.job_link_hint, approval_hint=excluded.approval_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_local_seo_prominence_action_queue (action_key, route_key, action_area, action_title, action_status, prominent_wording_hint, proof_hint, internal_link_hint, fallback_hint, sort_order, metadata, checked_at) values
('public_h1_title_alignment','home','title_h1','Public title, one H1, and first paragraph use plain local search wording','in_progress','Keep one clear H1 and use realistic service/location phrases in titles and first visible copy.','Route must have service proof, service area proof, or internal evidence before publication.','Link from home to service/location proof pages only when coverage is real.','Hold page in draft queue if proof or wording is weak.',10,'{"build":"2026-06-06d","schema":137}'::jsonb,now()),
('local_proof_block_depth','service_pages','local_proof','Add proof blocks for real local work, service boundaries, and before/after evidence','planned','Prominent copy should match actual service area and words customers use.','Use reviewed gallery, testimonial, job record, or service policy as proof.','Link proof blocks to relevant service and location routes.','Use generic service copy until proof is approved.',20,'{"build":"2026-06-06d","schema":137}'::jsonb,now()),
('schema_jsonld_review','public_routes','structured_data','Validate JSON-LD against approved business/service/location data before publishing','planned','Structured data should mirror visible page content and avoid overclaiming.','Approved route registry and business profile are the source of truth.','Internal links should support page relevance and not create thin doorway routes.','Use title/meta only until JSON-LD has proof.',30,'{"build":"2026-06-06d","schema":137}'::jsonb,now())
on conflict (action_key) do update set route_key=excluded.route_key, action_area=excluded.action_area, action_title=excluded.action_title, action_status=excluded.action_status, prominent_wording_hint=excluded.prominent_wording_hint, proof_hint=excluded.proof_hint, internal_link_hint=excluded.internal_link_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_css_accessibility_fallback_queue (check_key, component_area, check_title, check_status, accessibility_hint, selector_hint, fallback_hint, sort_order, metadata, checked_at) values
('admin_table_overflow_mobile','admin_tables','Admin readiness tables remain horizontally scrollable without breaking mobile layout','review','Tables must remain readable and keyboard-focusable on small screens.','.table-scroll, admin readiness table IDs','Collapse to card-style summaries if table overflow fails.',10,'{"build":"2026-06-06d","schema":137}'::jsonb,now()),
('status_pill_contrast','status_pills','Status pills keep readable contrast across warning, ok, and danger states','review','Text contrast should stay readable without relying on colour alone.','.pill, .status, renderStatusPill output','Use plain text status label if styling fails.',20,'{"build":"2026-06-06d","schema":137}'::jsonb,now()),
('offline_banner_visibility','runtime_banners','Offline/fallback banners stay visible above forms and tables','planned','Fallback copy must not be hidden behind sticky navigation or dense tables.','.offline-banner, .admin-error, .toast','Use inline panel error copy if toast/banner fails.',30,'{"build":"2026-06-06d","schema":137}'::jsonb,now())
on conflict (check_key) do update set component_area=excluded.component_area, check_title=excluded.check_title, check_status=excluded.check_status, accessibility_hint=excluded.accessibility_hint, selector_hint=excluded.selector_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_data_migration_validation_queue (validation_key, data_area, validation_title, validation_status, current_source_hint, target_source_hint, validation_hint, fallback_hint, sort_order, metadata, checked_at) values
('equipment_accessory_templates_json_to_db','equipment','Migrate accessory templates from free-text/JSON notes to DB templates','planned','Current source is equipment notes and free-text checkout/return JSON arrays.','Target source is DB accessory templates by pool/category.','Validate counts, required flags, and exception history before switching UI default.','Keep free-text checklist as fallback until templates are complete.',10,'{"build":"2026-06-06d","schema":137}'::jsonb,now()),
('public_route_registry_db_source','seo','Use DB route registry as the source for sitemap, robots, titles, and route proof','planned','Current source is static sitemap/robots plus Markdown route notes.','Target source is approved DB public route registry.','Validate route URL, title, H1, meta, proof, lastmod, and publish status.','Keep static sitemap/robots until DB generator is verified.',20,'{"build":"2026-06-06d","schema":137}'::jsonb,now()),
('accounting_export_manifest_db_source','accounting','Use DB manifest rows as source for accountant export packages','review','Current source includes Markdown/checklists and manually collected files.','Target source is close-period export package and proof manifest rows.','Validate file list, totals, hashes/IDs, reviewer signoff, and reopen state.','Manual accountant ZIP/list remains fallback.',30,'{"build":"2026-06-06d","schema":137}'::jsonb,now())
on conflict (validation_key) do update set data_area=excluded.data_area, validation_title=excluded.validation_title, validation_status=excluded.validation_status, current_source_hint=excluded.current_source_hint, target_source_hint=excluded.target_source_hint, validation_hint=excluded.validation_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_runtime_release_message_queue (message_key, app_surface, message_title, message_status, failure_hint, user_message_hint, operator_hint, retry_hint, fallback_hint, sort_order, metadata, checked_at) values
('schema_view_missing_message','admin_readiness','Optional schema view missing after partial deployment','covered','Admin Directory returns an empty list because a new view is not deployed yet.','This panel is waiting for the latest schema. Apply the newest SQL migration, then refresh.','Check schema drift and deploy the latest migration before treating it as data loss.','Retry after schema deploy and service-worker refresh.','Keep existing panels usable with empty tables.',10,'{"build":"2026-06-06d","schema":137}'::jsonb,now()),
('payment_blocked_message','accounting_workbench','Payment action blocked by missing proof, close lock, or review status','planned','Payment/reversal/write-off/refund action lacks proof or is inside a locked period.','This accounting action needs proof or reviewer signoff before posting.','Review proof, close-period status, and exception notes.','No automatic retry; user must correct proof/signoff first.','Leave action staged and visible in queue.',20,'{"build":"2026-06-06d","schema":137}'::jsonb,now()),
('equipment_release_blocked_message','equipment','Equipment cannot return to available because scan/accessories/service task are incomplete','planned','Equipment is pending return review, locked out, or has an open service task.','This item is not ready yet. Verify scan, accessories, service task, and supervisor signoff.','Check return-to-service gate and open service task rows.','Retry after the missing gate is completed.','Keep the item locked out or pending review.',30,'{"build":"2026-06-06d","schema":137}'::jsonb,now())
on conflict (message_key) do update set app_surface=excluded.app_surface, message_title=excluded.message_title, message_status=excluded.message_status, failure_hint=excluded.failure_hint, user_message_hint=excluded.user_message_hint, operator_hint=excluded.operator_hint, retry_hint=excluded.retry_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

drop view if exists public.v_app_payment_reconciliation_cutover_drill_queue;
create view public.v_app_payment_reconciliation_cutover_drill_queue as select drill_key, drill_area, drill_title, drill_status, validation_hint, posting_hint, signoff_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_payment_reconciliation_cutover_drill_queue order by sort_order, drill_key;

drop view if exists public.v_app_equipment_service_cost_recovery_queue;
create view public.v_app_equipment_service_cost_recovery_queue as select recovery_key, recovery_area, recovery_title, recovery_status, source_cost_hint, job_link_hint, approval_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_equipment_service_cost_recovery_queue order by sort_order, recovery_key;

drop view if exists public.v_app_local_seo_prominence_action_queue;
create view public.v_app_local_seo_prominence_action_queue as select action_key, route_key, action_area, action_title, action_status, prominent_wording_hint, proof_hint, internal_link_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_local_seo_prominence_action_queue order by sort_order, action_key;

drop view if exists public.v_app_css_accessibility_fallback_queue;
create view public.v_app_css_accessibility_fallback_queue as select check_key, component_area, check_title, check_status, accessibility_hint, selector_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_css_accessibility_fallback_queue order by sort_order, check_key;

drop view if exists public.v_app_data_migration_validation_queue;
create view public.v_app_data_migration_validation_queue as select validation_key, data_area, validation_title, validation_status, current_source_hint, target_source_hint, validation_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_data_migration_validation_queue order by sort_order, validation_key;

drop view if exists public.v_app_runtime_release_message_queue;
create view public.v_app_runtime_release_message_queue as select message_key, app_surface, message_title, message_status, failure_hint, user_message_hint, operator_hint, retry_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_runtime_release_message_queue order by sort_order, message_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  137::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 137 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 137 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through schema 137.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (137, '137_release_depth_payment_recon_equipment_seo_css_data_runtime_controls', '137_release_depth_payment_recon_equipment_seo_css_data_runtime_controls.sql', '2026-06-06d', 'Adds release depth controls for payment/reconciliation drills, equipment service cost recovery, local SEO prominence, CSS accessibility fallback, data migration validation, and runtime messages.', 'applied', 'This pass keeps schema, Markdown, Admin readiness, SEO/H1, CSS, fallback and smoke checks aligned.')
on conflict (schema_version) do update set migration_key=excluded.migration_key, schema_name=excluded.schema_name, release_label=excluded.release_label, description=excluded.description, status=excluded.status, notes=excluded.notes, applied_at=now();

grant select on public.app_payment_reconciliation_cutover_drill_queue to authenticated;
grant select on public.app_equipment_service_cost_recovery_queue to authenticated;
grant select on public.app_local_seo_prominence_action_queue to authenticated;
grant select on public.app_css_accessibility_fallback_queue to authenticated;
grant select on public.app_data_migration_validation_queue to authenticated;
grant select on public.app_runtime_release_message_queue to authenticated;
grant select on public.v_app_payment_reconciliation_cutover_drill_queue to authenticated;
grant select on public.v_app_equipment_service_cost_recovery_queue to authenticated;
grant select on public.v_app_local_seo_prominence_action_queue to authenticated;
grant select on public.v_app_css_accessibility_fallback_queue to authenticated;
grant select on public.v_app_data_migration_validation_queue to authenticated;
grant select on public.v_app_runtime_release_message_queue to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
