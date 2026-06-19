-- Schema 146: Highest-value execution layer: payment actions, bank CSV preview,
-- reconciliation match/split/undo/signoff, equipment scan custody, visual asset approvals,
-- public route registry, quote/contact intake, mobile offline conflict cards, and Admin scorecard rails.
-- Build 2026-06-13b.
--
-- Purpose:
-- Move the application beyond passive readiness queues by adding the DB-backed
-- registries/workbench rows needed for real workflow buttons, preview cards,
-- public intake, and control-center scorecards.

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

create table if not exists public.app_payment_action_workbench_queue (
  action_key text primary key,
  action_area text not null default 'payment',
  action_title text not null default 'Payment action',
  action_status text not null default 'planned',
  action_type text not null default 'apply',
  required_fields_hint text,
  validation_hint text,
  posting_hint text,
  reversal_or_undo_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.app_payment_action_workbench_queue add column if not exists action_area text not null default 'payment';
alter table public.app_payment_action_workbench_queue add column if not exists action_title text not null default 'Payment action';
alter table public.app_payment_action_workbench_queue add column if not exists action_status text not null default 'planned';
alter table public.app_payment_action_workbench_queue add column if not exists action_type text not null default 'apply';
alter table public.app_payment_action_workbench_queue add column if not exists required_fields_hint text;
alter table public.app_payment_action_workbench_queue add column if not exists validation_hint text;
alter table public.app_payment_action_workbench_queue add column if not exists posting_hint text;
alter table public.app_payment_action_workbench_queue add column if not exists reversal_or_undo_hint text;
alter table public.app_payment_action_workbench_queue add column if not exists fallback_hint text;
alter table public.app_payment_action_workbench_queue add column if not exists sort_order integer not null default 100;
alter table public.app_payment_action_workbench_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_payment_action_workbench_queue add column if not exists checked_at timestamptz;
alter table public.app_payment_action_workbench_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_bank_csv_import_preview_queue (
  preview_key text primary key,
  import_area text not null default 'bank_csv',
  preview_title text not null default 'Bank CSV import preview',
  preview_status text not null default 'planned',
  header_validation_hint text,
  rejected_row_hint text,
  duplicate_detection_hint text,
  staging_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.app_bank_csv_import_preview_queue add column if not exists import_area text not null default 'bank_csv';
alter table public.app_bank_csv_import_preview_queue add column if not exists preview_title text not null default 'Bank CSV import preview';
alter table public.app_bank_csv_import_preview_queue add column if not exists preview_status text not null default 'planned';
alter table public.app_bank_csv_import_preview_queue add column if not exists header_validation_hint text;
alter table public.app_bank_csv_import_preview_queue add column if not exists rejected_row_hint text;
alter table public.app_bank_csv_import_preview_queue add column if not exists duplicate_detection_hint text;
alter table public.app_bank_csv_import_preview_queue add column if not exists staging_hint text;
alter table public.app_bank_csv_import_preview_queue add column if not exists fallback_hint text;
alter table public.app_bank_csv_import_preview_queue add column if not exists sort_order integer not null default 100;
alter table public.app_bank_csv_import_preview_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_bank_csv_import_preview_queue add column if not exists checked_at timestamptz;
alter table public.app_bank_csv_import_preview_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_reconciliation_match_action_queue (
  match_key text primary key,
  match_area text not null default 'reconciliation',
  match_title text not null default 'Reconciliation match action',
  match_status text not null default 'planned',
  match_type text not null default 'match',
  scoring_hint text,
  split_hint text,
  undo_hint text,
  signoff_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.app_reconciliation_match_action_queue add column if not exists match_area text not null default 'reconciliation';
alter table public.app_reconciliation_match_action_queue add column if not exists match_title text not null default 'Reconciliation match action';
alter table public.app_reconciliation_match_action_queue add column if not exists match_status text not null default 'planned';
alter table public.app_reconciliation_match_action_queue add column if not exists match_type text not null default 'match';
alter table public.app_reconciliation_match_action_queue add column if not exists scoring_hint text;
alter table public.app_reconciliation_match_action_queue add column if not exists split_hint text;
alter table public.app_reconciliation_match_action_queue add column if not exists undo_hint text;
alter table public.app_reconciliation_match_action_queue add column if not exists signoff_hint text;
alter table public.app_reconciliation_match_action_queue add column if not exists fallback_hint text;
alter table public.app_reconciliation_match_action_queue add column if not exists sort_order integer not null default 100;
alter table public.app_reconciliation_match_action_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_reconciliation_match_action_queue add column if not exists checked_at timestamptz;
alter table public.app_reconciliation_match_action_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_equipment_scan_custody_workbench_queue (
  custody_key text primary key,
  custody_area text not null default 'equipment',
  custody_title text not null default 'Equipment scan custody action',
  custody_status text not null default 'planned',
  scan_mode_hint text,
  timeline_hint text,
  verifier_hint text,
  service_or_cost_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.app_equipment_scan_custody_workbench_queue add column if not exists custody_area text not null default 'equipment';
alter table public.app_equipment_scan_custody_workbench_queue add column if not exists custody_title text not null default 'Equipment scan custody action';
alter table public.app_equipment_scan_custody_workbench_queue add column if not exists custody_status text not null default 'planned';
alter table public.app_equipment_scan_custody_workbench_queue add column if not exists scan_mode_hint text;
alter table public.app_equipment_scan_custody_workbench_queue add column if not exists timeline_hint text;
alter table public.app_equipment_scan_custody_workbench_queue add column if not exists verifier_hint text;
alter table public.app_equipment_scan_custody_workbench_queue add column if not exists service_or_cost_hint text;
alter table public.app_equipment_scan_custody_workbench_queue add column if not exists fallback_hint text;
alter table public.app_equipment_scan_custody_workbench_queue add column if not exists sort_order integer not null default 100;
alter table public.app_equipment_scan_custody_workbench_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_equipment_scan_custody_workbench_queue add column if not exists checked_at timestamptz;
alter table public.app_equipment_scan_custody_workbench_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_visual_asset_approval_registry (
  asset_key text primary key,
  asset_area text not null default 'visual_asset',
  asset_title text not null default 'Visual asset approval',
  asset_status text not null default 'draft',
  source_hint text,
  consent_hint text,
  alt_text_hint text,
  compression_hint text,
  publish_route_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.app_visual_asset_approval_registry add column if not exists asset_area text not null default 'visual_asset';
alter table public.app_visual_asset_approval_registry add column if not exists asset_title text not null default 'Visual asset approval';
alter table public.app_visual_asset_approval_registry add column if not exists asset_status text not null default 'draft';
alter table public.app_visual_asset_approval_registry add column if not exists source_hint text;
alter table public.app_visual_asset_approval_registry add column if not exists consent_hint text;
alter table public.app_visual_asset_approval_registry add column if not exists alt_text_hint text;
alter table public.app_visual_asset_approval_registry add column if not exists compression_hint text;
alter table public.app_visual_asset_approval_registry add column if not exists publish_route_hint text;
alter table public.app_visual_asset_approval_registry add column if not exists fallback_hint text;
alter table public.app_visual_asset_approval_registry add column if not exists sort_order integer not null default 100;
alter table public.app_visual_asset_approval_registry add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_visual_asset_approval_registry add column if not exists checked_at timestamptz;
alter table public.app_visual_asset_approval_registry add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_public_route_publication_registry (
  route_key text primary key,
  route_path text not null default '/',
  route_title text not null default 'Public route',
  route_status text not null default 'draft',
  h1_hint text,
  local_phrase_hint text,
  proof_hint text,
  internal_link_hint text,
  conversion_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.app_public_route_publication_registry add column if not exists route_path text not null default '/';
alter table public.app_public_route_publication_registry add column if not exists route_title text not null default 'Public route';
alter table public.app_public_route_publication_registry add column if not exists route_status text not null default 'draft';
alter table public.app_public_route_publication_registry add column if not exists h1_hint text;
alter table public.app_public_route_publication_registry add column if not exists local_phrase_hint text;
alter table public.app_public_route_publication_registry add column if not exists proof_hint text;
alter table public.app_public_route_publication_registry add column if not exists internal_link_hint text;
alter table public.app_public_route_publication_registry add column if not exists conversion_hint text;
alter table public.app_public_route_publication_registry add column if not exists fallback_hint text;
alter table public.app_public_route_publication_registry add column if not exists sort_order integer not null default 100;
alter table public.app_public_route_publication_registry add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_public_route_publication_registry add column if not exists checked_at timestamptz;
alter table public.app_public_route_publication_registry add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_quote_contact_intake_registry (
  intake_key text primary key,
  intake_area text not null default 'quote_contact',
  intake_title text not null default 'Quote/contact intake',
  intake_status text not null default 'planned',
  public_form_hint text,
  required_field_hint text,
  routing_hint text,
  spam_or_privacy_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.app_quote_contact_intake_registry add column if not exists intake_area text not null default 'quote_contact';
alter table public.app_quote_contact_intake_registry add column if not exists intake_title text not null default 'Quote/contact intake';
alter table public.app_quote_contact_intake_registry add column if not exists intake_status text not null default 'planned';
alter table public.app_quote_contact_intake_registry add column if not exists public_form_hint text;
alter table public.app_quote_contact_intake_registry add column if not exists required_field_hint text;
alter table public.app_quote_contact_intake_registry add column if not exists routing_hint text;
alter table public.app_quote_contact_intake_registry add column if not exists spam_or_privacy_hint text;
alter table public.app_quote_contact_intake_registry add column if not exists fallback_hint text;
alter table public.app_quote_contact_intake_registry add column if not exists sort_order integer not null default 100;
alter table public.app_quote_contact_intake_registry add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_quote_contact_intake_registry add column if not exists checked_at timestamptz;
alter table public.app_quote_contact_intake_registry add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_mobile_offline_conflict_card_queue (
  conflict_key text primary key,
  conflict_area text not null default 'mobile_offline',
  conflict_title text not null default 'Mobile offline conflict card',
  conflict_status text not null default 'planned',
  detection_hint text,
  card_copy_hint text,
  resolution_hint text,
  audit_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.app_mobile_offline_conflict_card_queue add column if not exists conflict_area text not null default 'mobile_offline';
alter table public.app_mobile_offline_conflict_card_queue add column if not exists conflict_title text not null default 'Mobile offline conflict card';
alter table public.app_mobile_offline_conflict_card_queue add column if not exists conflict_status text not null default 'planned';
alter table public.app_mobile_offline_conflict_card_queue add column if not exists detection_hint text;
alter table public.app_mobile_offline_conflict_card_queue add column if not exists card_copy_hint text;
alter table public.app_mobile_offline_conflict_card_queue add column if not exists resolution_hint text;
alter table public.app_mobile_offline_conflict_card_queue add column if not exists audit_hint text;
alter table public.app_mobile_offline_conflict_card_queue add column if not exists fallback_hint text;
alter table public.app_mobile_offline_conflict_card_queue add column if not exists sort_order integer not null default 100;
alter table public.app_mobile_offline_conflict_card_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_mobile_offline_conflict_card_queue add column if not exists checked_at timestamptz;
alter table public.app_mobile_offline_conflict_card_queue add column if not exists updated_at timestamptz not null default now();

create table if not exists public.app_admin_scorecard_progress_rail_queue (
  scorecard_key text primary key,
  scorecard_area text not null default 'admin_scorecard',
  scorecard_title text not null default 'Admin scorecard progress rail',
  scorecard_status text not null default 'planned',
  metric_hint text,
  progress_hint text,
  drilldown_hint text,
  visual_hint text,
  fallback_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.app_admin_scorecard_progress_rail_queue add column if not exists scorecard_area text not null default 'admin_scorecard';
alter table public.app_admin_scorecard_progress_rail_queue add column if not exists scorecard_title text not null default 'Admin scorecard progress rail';
alter table public.app_admin_scorecard_progress_rail_queue add column if not exists scorecard_status text not null default 'planned';
alter table public.app_admin_scorecard_progress_rail_queue add column if not exists metric_hint text;
alter table public.app_admin_scorecard_progress_rail_queue add column if not exists progress_hint text;
alter table public.app_admin_scorecard_progress_rail_queue add column if not exists drilldown_hint text;
alter table public.app_admin_scorecard_progress_rail_queue add column if not exists visual_hint text;
alter table public.app_admin_scorecard_progress_rail_queue add column if not exists fallback_hint text;
alter table public.app_admin_scorecard_progress_rail_queue add column if not exists sort_order integer not null default 100;
alter table public.app_admin_scorecard_progress_rail_queue add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.app_admin_scorecard_progress_rail_queue add column if not exists checked_at timestamptz;
alter table public.app_admin_scorecard_progress_rail_queue add column if not exists updated_at timestamptz not null default now();

insert into public.app_payment_action_workbench_queue (action_key, action_area, action_title, action_status, action_type, required_fields_hint, validation_hint, posting_hint, reversal_or_undo_hint, fallback_hint, sort_order, metadata, checked_at)
values ('payment_actions_apply_reverse_refund_writeoff_overpayment','payment_closeout','Build apply, reverse, refund, write-off, and overpayment actions','planned','multi_action','invoice/customer/payment/refund/writeoff reason, amount, tax handling, reviewer, proof file/reference','Block posting until balance, period, proof, role, and duplicate checks pass.','Create immutable action event then downstream journal/payment application candidate.','Every action needs a reversal/undo action with original action reference.','Keep manual closeout queue and accountant export package until Edge write action is live.',10,'{"build":"2026-06-13b","schema":146}'::jsonb,now())
on conflict (action_key) do update set action_area=excluded.action_area, action_title=excluded.action_title, action_status=excluded.action_status, action_type=excluded.action_type, required_fields_hint=excluded.required_fields_hint, validation_hint=excluded.validation_hint, posting_hint=excluded.posting_hint, reversal_or_undo_hint=excluded.reversal_or_undo_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_bank_csv_import_preview_queue (preview_key, import_area, preview_title, preview_status, header_validation_hint, rejected_row_hint, duplicate_detection_hint, staging_hint, fallback_hint, sort_order, metadata, checked_at)
values ('bank_csv_preview_validate_reject_stage','bank_csv','Build bank CSV import preview with validation and rejected-row handling','planned','Map Date, Description, Debit, Credit, Amount, Balance, Reference, and Bank Account columns before import.','Show rejected rows with reason, row number, raw value, and suggested correction.','Detect duplicate date+amount+reference/description fingerprints before staging.','Stage accepted rows separately from posted reconciliation items.','Keep manual CSV review/export if upload parser fails.',20,'{"build":"2026-06-13b","schema":146}'::jsonb,now())
on conflict (preview_key) do update set import_area=excluded.import_area, preview_title=excluded.preview_title, preview_status=excluded.preview_status, header_validation_hint=excluded.header_validation_hint, rejected_row_hint=excluded.rejected_row_hint, duplicate_detection_hint=excluded.duplicate_detection_hint, staging_hint=excluded.staging_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_reconciliation_match_action_queue (match_key, match_area, match_title, match_status, match_type, scoring_hint, split_hint, undo_hint, signoff_hint, fallback_hint, sort_order, metadata, checked_at)
values ('recon_match_split_undo_signoff','reconciliation','Add reconciliation match, split, undo, and signoff workflow','planned','match_split_undo_signoff','Score by date window, amount, customer/vendor, invoice/reference, description, and previous confirmed patterns.','Allow one bank row to split across many invoices or one payment to map to many bank rows.','Undo preserves original candidates, reviewer, reason, and previous match state.','Reviewer signoff required before close lock/export.','Keep unresolved exceptions in accountant package with owner/due date.',30,'{"build":"2026-06-13b","schema":146}'::jsonb,now())
on conflict (match_key) do update set match_area=excluded.match_area, match_title=excluded.match_title, match_status=excluded.match_status, match_type=excluded.match_type, scoring_hint=excluded.scoring_hint, split_hint=excluded.split_hint, undo_hint=excluded.undo_hint, signoff_hint=excluded.signoff_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_equipment_scan_custody_workbench_queue (custody_key, custody_area, custody_title, custody_status, scan_mode_hint, timeline_hint, verifier_hint, service_or_cost_hint, fallback_hint, sort_order, metadata, checked_at)
values ('equipment_scan_custody_timeline','equipment','Add QR/barcode scanning with manual fallback and custody timeline','planned','Camera scan first, manual asset code fallback, photo/note fallback when camera permission fails.','Timeline must show checkout, site arrival, job use, return, failed test, service task, and return-to-service.','Supervisor/admin verifies exceptions and lockout overrides.','Missing/damaged accessory creates cost recovery, write-off, or service decision.','Manual equipment code entry remains supported for older devices.',40,'{"build":"2026-06-13b","schema":146}'::jsonb,now())
on conflict (custody_key) do update set custody_area=excluded.custody_area, custody_title=excluded.custody_title, custody_status=excluded.custody_status, scan_mode_hint=excluded.scan_mode_hint, timeline_hint=excluded.timeline_hint, verifier_hint=excluded.verifier_hint, service_or_cost_hint=excluded.service_or_cost_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_visual_asset_approval_registry (asset_key, asset_area, asset_title, asset_status, source_hint, consent_hint, alt_text_hint, compression_hint, publish_route_hint, fallback_hint, sort_order, metadata, checked_at)
values ('approved_visual_registry_before_gallery','visual_assets','Create visual asset approval registry before real galleries','planned','Every image/video needs source, owner, capture date, and intended route/use.','Require consent/proof status before publishing workers, job sites, vehicles, or customer property.','Alt text should describe the service proof and local context without keyword stuffing.','Compress and store responsive size hints before release.','Only approved sitemap/public routes can consume the asset.','Use CSS-only visual cards until real approved assets exist.',50,'{"build":"2026-06-13b","schema":146}'::jsonb,now())
on conflict (asset_key) do update set asset_area=excluded.asset_area, asset_title=excluded.asset_title, asset_status=excluded.asset_status, source_hint=excluded.source_hint, consent_hint=excluded.consent_hint, alt_text_hint=excluded.alt_text_hint, compression_hint=excluded.compression_hint, publish_route_hint=excluded.publish_route_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_public_route_publication_registry (route_key, route_path, route_title, route_status, h1_hint, local_phrase_hint, proof_hint, internal_link_hint, conversion_hint, fallback_hint, sort_order, metadata, checked_at)
values ('public_quote_contact_route','/','#quote-intake','draft','Keep the single public H1 on the page; use H2/H3 for quote/contact intake.','Southern Ontario service words belong in title, intro, service cards, and CTA copy only when true.','Publish route only with proof, clear service area, and useful contact path.','Link from home/value section and future service pages only after proof is ready.','Quote/contact CTA should be visible on desktop and mobile.','Keep route in same shell until dedicated static route registry is finished.',60,'{"build":"2026-06-13b","schema":146}'::jsonb,now())
on conflict (route_key) do update set route_path=excluded.route_path, route_title=excluded.route_title, route_status=excluded.route_status, h1_hint=excluded.h1_hint, local_phrase_hint=excluded.local_phrase_hint, proof_hint=excluded.proof_hint, internal_link_hint=excluded.internal_link_hint, conversion_hint=excluded.conversion_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_quote_contact_intake_registry (intake_key, intake_area, intake_title, intake_status, public_form_hint, required_field_hint, routing_hint, spam_or_privacy_hint, fallback_hint, sort_order, metadata, checked_at)
values ('public_quote_contact_intake_shell','quote_contact','Add quote/contact intake on the public website','in_progress','Static public shell now has name, contact, service type, location, timing, and message fields ready for Edge submit wiring.','Require contact method, service area, job type, and consent/privacy acknowledgement before submission.','Route valid requests to lead/quote queue, Admin notification, and optional email copy.','Add honeypot/rate-limit/privacy copy before live write action.','Fallback is mail/phone CTA until Edge submit is connected.',70,'{"build":"2026-06-13b","schema":146}'::jsonb,now())
on conflict (intake_key) do update set intake_area=excluded.intake_area, intake_title=excluded.intake_title, intake_status=excluded.intake_status, public_form_hint=excluded.public_form_hint, required_field_hint=excluded.required_field_hint, routing_hint=excluded.routing_hint, spam_or_privacy_hint=excluded.spam_or_privacy_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_mobile_offline_conflict_card_queue (conflict_key, conflict_area, conflict_title, conflict_status, detection_hint, card_copy_hint, resolution_hint, audit_hint, fallback_hint, sort_order, metadata, checked_at)
values ('mobile_offline_conflict_cards','mobile_offline','Add mobile offline conflict cards','in_progress','Detect local draft newer than server row, server row newer than local draft, failed sync retry, and duplicate form submission.','Show plain choices: Retry Sync, Keep Local Copy, Replace with Server, or Save as New Draft.','Require confirmation before destructive actions.','Persist actor, timestamps, old/new hash, and chosen resolution.','Keep local copy until server acknowledgement.',80,'{"build":"2026-06-13b","schema":146}'::jsonb,now())
on conflict (conflict_key) do update set conflict_area=excluded.conflict_area, conflict_title=excluded.conflict_title, conflict_status=excluded.conflict_status, detection_hint=excluded.detection_hint, card_copy_hint=excluded.card_copy_hint, resolution_hint=excluded.resolution_hint, audit_hint=excluded.audit_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_admin_scorecard_progress_rail_queue (scorecard_key, scorecard_area, scorecard_title, scorecard_status, metric_hint, progress_hint, drilldown_hint, visual_hint, fallback_hint, sort_order, metadata, checked_at)
values ('admin_scorecards_progress_rails','admin_control_center','Add Admin scorecards and progress rails','in_progress','Track open payment exceptions, unreconciled bank rows, equipment lockouts, unpublished SEO routes, visual approvals, offline conflicts, and fallback events.','Use percentage rails and status chips before showing raw tables.','Each scorecard should drill into its queue/table and owner.','CSS-only rails keep the control center polished without chart dependencies.','Fallback to raw readiness tables if summary query is empty.',90,'{"build":"2026-06-13b","schema":146}'::jsonb,now())
on conflict (scorecard_key) do update set scorecard_area=excluded.scorecard_area, scorecard_title=excluded.scorecard_title, scorecard_status=excluded.scorecard_status, metric_hint=excluded.metric_hint, progress_hint=excluded.progress_hint, drilldown_hint=excluded.drilldown_hint, visual_hint=excluded.visual_hint, fallback_hint=excluded.fallback_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

insert into public.app_roadmap_action_steps (step_key, step_batch, step_number, step_area, step_title, step_status, priority, source_doc, route_hint, acceptance_check, implementation_notes, risk_if_skipped, sort_order, metadata, checked_at) values
('schema146_done_01','completed_this_pass',1,'payment','Added payment action workbench registry for apply/reverse/refund/write-off/overpayment','completed','high','DEVELOPMENT_ROADMAP.md','#admin','Schema 146 includes app_payment_action_workbench_queue and view.','Moves payment closeout toward real write actions with proof, validation, posting, and undo requirements.','Payment work remains passive queue-only.',1,'{"build":"2026-06-13b","schema":146}'::jsonb,now()),
('schema146_done_02','completed_this_pass',2,'banking','Added bank CSV preview and rejected-row validation queue','completed','high','DEVELOPMENT_ROADMAP.md','#admin','Schema 146 includes app_bank_csv_import_preview_queue and view.','Defines header mapping, reject reasons, duplicate detection, and staging behavior.','CSV imports remain risky/manual.',2,'{"build":"2026-06-13b","schema":146}'::jsonb,now()),
('schema146_done_03','completed_this_pass',3,'reconciliation','Added reconciliation match/split/undo/signoff action queue','completed','high','DEVELOPMENT_ROADMAP.md','#admin','Schema 146 includes app_reconciliation_match_action_queue and view.','Defines match scoring, split handling, undo, and signoff requirements.','Reconciliation cannot be safely closed.',3,'{"build":"2026-06-13b","schema":146}'::jsonb,now()),
('schema146_done_04','completed_this_pass',4,'equipment','Added equipment scan/custody workbench queue','completed','high','DEVELOPMENT_ROADMAP.md','#equipment','Schema 146 includes app_equipment_scan_custody_workbench_queue and view.','Defines scan, manual fallback, custody timeline, verifier, service and cost decisions.','Equipment accountability remains incomplete.',4,'{"build":"2026-06-13b","schema":146}'::jsonb,now()),
('schema146_done_05','completed_this_pass',5,'visuals','Added visual asset approval registry before real galleries','completed','medium','DEVELOPMENT_ROADMAP.md','/','Schema 146 includes app_visual_asset_approval_registry and view.','Visual publishing now has source, consent, alt, compression, route, and fallback requirements.','Unapproved images could be published.',5,'{"build":"2026-06-13b","schema":146}'::jsonb,now()),
('schema146_done_06','completed_this_pass',6,'seo','Added public route publication registry','completed','high','DEVELOPMENT_ROADMAP.md','/','Schema 146 includes app_public_route_publication_registry and view.','Routes need H1, title/meta, local phrase, proof, internal links, and conversion readiness before sitemap growth.','SEO pages may be thin or unsupported.',6,'{"build":"2026-06-13b","schema":146}'::jsonb,now()),
('schema146_done_07','completed_this_pass',7,'public','Added public quote/contact intake shell','completed','high','DEVELOPMENT_ROADMAP.md','#quote-intake','index.html contains the quote/contact intake shell without adding another H1.','Public website now has a visible conversion path to evolve into lead/quote writes.','Visitors may not know what action to take.',7,'{"build":"2026-06-13b","schema":146}'::jsonb,now()),
('schema146_done_08','completed_this_pass',8,'mobile','Added mobile offline conflict card preview','completed','medium','DEVELOPMENT_ROADMAP.md','#quote-intake','index.html contains mobile conflict card preview and schema 146 conflict queue.','Offline conflict decisions are now visible as UX cards and trackable in DB.','Offline conflicts risk data loss.',8,'{"build":"2026-06-13b","schema":146}'::jsonb,now()),
('schema146_done_09','completed_this_pass',9,'admin','Added Admin scorecard/progress rail registry and public preview strip','completed','medium','DEVELOPMENT_ROADMAP.md','#admin','Schema 146 includes scorecard/progress rail view and index has progress preview.','Admin direction shifts from raw tables to control-center progress.','Admin remains too table-heavy.',9,'{"build":"2026-06-13b","schema":146}'::jsonb,now()),
('schema146_done_10','completed_this_pass',10,'docs','Updated Markdown and smoke checks for highest-value additions','completed','high','KNOWN_ISSUES_AND_GAPS.md','docs/SCHEMA_146_HIGHEST_VALUE_EXECUTION_LAYER.md','Docs and smoke checks mention schema 146 and the ten value items.','Build intent remains clear for next pass.','The next pass may drift away from the priority list.',10,'{"build":"2026-06-13b","schema":146}'::jsonb,now()),
('schema146_next_01','next_20',1,'payment','Build Edge write action for payment apply/reverse/refund/write-off/overpayment','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Action button creates audited payment action event and returns updated balance.','Turns payment queue into working transaction flow.','Payments remain manual.',101,'{"build":"2026-06-13b","schema":146}'::jsonb,now()),
('schema146_next_02','next_20',2,'banking','Build CSV parser and preview modal with rejected rows','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Upload shows accepted/rejected rows before staging.','Prevents bad bank imports.','Bad CSV rows can pollute reconciliation.',102,'{"build":"2026-06-13b","schema":146}'::jsonb,now()),
('schema146_next_03','next_20',3,'reconciliation','Build match/split/undo/signoff buttons','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Reviewer can accept, split, undo, sign off, and export exceptions.','Makes reconciliation operational.','Close remains fragile.',103,'{"build":"2026-06-13b","schema":146}'::jsonb,now()),
('schema146_next_04','next_20',4,'equipment','Implement browser camera QR/barcode scan with manual fallback','planned','high','DEVELOPMENT_ROADMAP.md','#equipment','Mobile scan fills equipment code and still supports manual entry.','Speeds field custody proof.','Field teams may skip custody entries.',104,'{"build":"2026-06-13b","schema":146}'::jsonb,now()),
('schema146_next_05','next_20',5,'equipment','Build custody timeline from checkout to return-to-service','planned','high','DEVELOPMENT_ROADMAP.md','#equipment','Timeline shows checkout, arrival, use, return, test, service, and return-to-service.','Improves accountability and cost recovery.','Equipment exceptions stay hard to investigate.',105,'{"build":"2026-06-13b","schema":146}'::jsonb,now()),
('schema146_next_06','next_20',6,'visuals','Create Admin visual asset approval screen','planned','medium','DEVELOPMENT_ROADMAP.md','#admin','Admin can approve/hold/archive visual assets with consent, alt, compression, and route.','Prevents messy/unapproved galleries.','Images may hurt trust or compliance.',106,'{"build":"2026-06-13b","schema":146}'::jsonb,now()),
('schema146_next_07','next_20',7,'seo','Create public route approval screen before expanding sitemap','planned','high','DEVELOPMENT_ROADMAP.md','#admin','Admin publishes only routes with H1/title/meta/local proof/CTA/internal links.','Protects local SEO quality.','Thin pages can harm trust.',107,'{"build":"2026-06-13b","schema":146}'::jsonb,now()),
('schema146_next_08','next_20',8,'public','Connect quote/contact intake to a real Edge submit path','planned','high','DEVELOPMENT_ROADMAP.md','#quote-intake','Form writes lead/quote row, validates spam/privacy, and notifies Admin.','Creates real conversion.','Public CTA remains decorative.',108,'{"build":"2026-06-13b","schema":146}'::jsonb,now()),
('schema146_next_09','next_20',9,'mobile','Connect offline conflict cards to real sync conflict store','planned','medium','DEVELOPMENT_ROADMAP.md','#today','Conflict choices persist audit and avoid local data loss.','Improves mobile reliability.','Offline data can be overwritten.',109,'{"build":"2026-06-13b","schema":146}'::jsonb,now()),
('schema146_next_10','next_20',10,'admin','Build scorecard/progress rails above Admin readiness tables','planned','medium','DEVELOPMENT_ROADMAP.md','#admin','Admin shows progress rails before raw tables with drilldowns.','Control center feels professional.','Admin stays overwhelming.',110,'{"build":"2026-06-13b","schema":146}'::jsonb,now())
on conflict (step_key) do update set step_batch=excluded.step_batch, step_number=excluded.step_number, step_area=excluded.step_area, step_title=excluded.step_title, step_status=excluded.step_status, priority=excluded.priority, source_doc=excluded.source_doc, route_hint=excluded.route_hint, acceptance_check=excluded.acceptance_check, implementation_notes=excluded.implementation_notes, risk_if_skipped=excluded.risk_if_skipped, sort_order=excluded.sort_order, metadata=excluded.metadata, checked_at=excluded.checked_at, updated_at=now();

drop view if exists public.v_app_payment_action_workbench_queue;
create view public.v_app_payment_action_workbench_queue as select action_key, action_area, action_title, action_status, action_type, required_fields_hint, validation_hint, posting_hint, reversal_or_undo_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_payment_action_workbench_queue order by sort_order, action_key;
drop view if exists public.v_app_bank_csv_import_preview_queue;
create view public.v_app_bank_csv_import_preview_queue as select preview_key, import_area, preview_title, preview_status, header_validation_hint, rejected_row_hint, duplicate_detection_hint, staging_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_bank_csv_import_preview_queue order by sort_order, preview_key;
drop view if exists public.v_app_reconciliation_match_action_queue;
create view public.v_app_reconciliation_match_action_queue as select match_key, match_area, match_title, match_status, match_type, scoring_hint, split_hint, undo_hint, signoff_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_reconciliation_match_action_queue order by sort_order, match_key;
drop view if exists public.v_app_equipment_scan_custody_workbench_queue;
create view public.v_app_equipment_scan_custody_workbench_queue as select custody_key, custody_area, custody_title, custody_status, scan_mode_hint, timeline_hint, verifier_hint, service_or_cost_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_equipment_scan_custody_workbench_queue order by sort_order, custody_key;
drop view if exists public.v_app_visual_asset_approval_registry;
create view public.v_app_visual_asset_approval_registry as select asset_key, asset_area, asset_title, asset_status, source_hint, consent_hint, alt_text_hint, compression_hint, publish_route_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_visual_asset_approval_registry order by sort_order, asset_key;
drop view if exists public.v_app_public_route_publication_registry;
create view public.v_app_public_route_publication_registry as select route_key, route_path, route_title, route_status, h1_hint, local_phrase_hint, proof_hint, internal_link_hint, conversion_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_public_route_publication_registry order by sort_order, route_key;
drop view if exists public.v_app_quote_contact_intake_registry;
create view public.v_app_quote_contact_intake_registry as select intake_key, intake_area, intake_title, intake_status, public_form_hint, required_field_hint, routing_hint, spam_or_privacy_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_quote_contact_intake_registry order by sort_order, intake_key;
drop view if exists public.v_app_mobile_offline_conflict_card_queue;
create view public.v_app_mobile_offline_conflict_card_queue as select conflict_key, conflict_area, conflict_title, conflict_status, detection_hint, card_copy_hint, resolution_hint, audit_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_mobile_offline_conflict_card_queue order by sort_order, conflict_key;
drop view if exists public.v_app_admin_scorecard_progress_rail_queue;
create view public.v_app_admin_scorecard_progress_rail_queue as select scorecard_key, scorecard_area, scorecard_title, scorecard_status, metric_hint, progress_hint, drilldown_hint, visual_hint, fallback_hint, sort_order, checked_at, updated_at from public.app_admin_scorecard_progress_rail_queue order by sort_order, scorecard_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select 146::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 146 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 146 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through schema 146.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (146, '146_high_value_execution_layer_payment_bank_recon_equipment_visual_route_quote_mobile_admin_controls', '146_high_value_execution_layer_payment_bank_recon_equipment_visual_route_quote_mobile_admin_controls.sql', '2026-06-13b', 'Adds DB-backed highest-value execution layer for payment actions, bank CSV preview, reconciliation actions, equipment scan custody, visual asset approvals, public route registry, quote/contact intake, mobile offline conflict cards, and Admin scorecard rails.', 'applied', 'This schema moves the sanity-check next additions toward real workflow scaffolding while preserving Markdown, SEO, CSS, desktop/mobile, fallback, and source-of-truth discipline.')
on conflict (schema_version) do update set migration_key=excluded.migration_key, schema_name=excluded.schema_name, release_label=excluded.release_label, description=excluded.description, status=excluded.status, notes=excluded.notes, applied_at=now();

grant select on public.app_payment_action_workbench_queue to authenticated;
grant select on public.app_bank_csv_import_preview_queue to authenticated;
grant select on public.app_reconciliation_match_action_queue to authenticated;
grant select on public.app_equipment_scan_custody_workbench_queue to authenticated;
grant select on public.app_visual_asset_approval_registry to authenticated;
grant select on public.app_public_route_publication_registry to authenticated;
grant select on public.app_quote_contact_intake_registry to authenticated;
grant select on public.app_mobile_offline_conflict_card_queue to authenticated;
grant select on public.app_admin_scorecard_progress_rail_queue to authenticated;
grant select on public.v_app_payment_action_workbench_queue to authenticated;
grant select on public.v_app_bank_csv_import_preview_queue to authenticated;
grant select on public.v_app_reconciliation_match_action_queue to authenticated;
grant select on public.v_app_equipment_scan_custody_workbench_queue to authenticated;
grant select on public.v_app_visual_asset_approval_registry to authenticated;
grant select on public.v_app_public_route_publication_registry to authenticated;
grant select on public.v_app_quote_contact_intake_registry to authenticated;
grant select on public.v_app_mobile_offline_conflict_card_queue to authenticated;
grant select on public.v_app_admin_scorecard_progress_rail_queue to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
