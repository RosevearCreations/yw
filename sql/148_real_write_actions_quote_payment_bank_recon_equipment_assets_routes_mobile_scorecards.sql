-- Schema 148: Real write-action layer for quote/contact intake, payment requests,
-- bank CSV previews, reconciliation actions, equipment scan/custody events,
-- visual asset approvals, public route approvals, mobile offline conflicts, and Admin scorecards.
-- Build 2026-06-14b.

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

create table if not exists public.quote_contact_requests (
  id uuid primary key default gen_random_uuid(),
  request_status text not null default 'new',
  request_source text not null default 'public_website',
  full_name text not null,
  contact_value text not null,
  service_type text,
  service_area text,
  message text,
  preferred_contact_method text,
  page_path text,
  user_agent text,
  ip_hint text,
  spam_score integer not null default 0,
  privacy_consent boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.quote_contact_requests add column if not exists request_status text not null default 'new';
alter table public.quote_contact_requests add column if not exists request_source text not null default 'public_website';
alter table public.quote_contact_requests add column if not exists full_name text not null default 'Unknown';
alter table public.quote_contact_requests add column if not exists contact_value text not null default 'not-provided';
alter table public.quote_contact_requests add column if not exists service_type text;
alter table public.quote_contact_requests add column if not exists service_area text;
alter table public.quote_contact_requests add column if not exists message text;
alter table public.quote_contact_requests add column if not exists preferred_contact_method text;
alter table public.quote_contact_requests add column if not exists page_path text;
alter table public.quote_contact_requests add column if not exists user_agent text;
alter table public.quote_contact_requests add column if not exists ip_hint text;
alter table public.quote_contact_requests add column if not exists spam_score integer not null default 0;
alter table public.quote_contact_requests add column if not exists privacy_consent boolean not null default true;
alter table public.quote_contact_requests add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.quote_contact_requests add column if not exists created_at timestamptz not null default now();
alter table public.quote_contact_requests add column if not exists updated_at timestamptz not null default now();

create table if not exists public.quote_contact_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.quote_contact_requests(id) on delete cascade,
  event_type text not null default 'created',
  event_note text,
  actor_profile_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.quote_contact_request_events add column if not exists request_id uuid;
alter table public.quote_contact_request_events add column if not exists event_type text not null default 'created';
alter table public.quote_contact_request_events add column if not exists event_note text;
alter table public.quote_contact_request_events add column if not exists actor_profile_id uuid;
alter table public.quote_contact_request_events add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.quote_contact_request_events add column if not exists created_at timestamptz not null default now();

create table if not exists public.payment_action_requests (
  id uuid primary key default gen_random_uuid(),
  action_key text unique not null default ('pay_' || gen_random_uuid()::text),
  action_type text not null,
  action_status text not null default 'draft',
  customer_or_vendor_name text,
  invoice_reference text,
  payment_reference text,
  amount numeric(12,2) not null default 0,
  currency_code text not null default 'CAD',
  reason text,
  proof_required boolean not null default true,
  proof_reference text,
  requested_by_profile_id uuid,
  approved_by_profile_id uuid,
  approved_at timestamptz,
  posted_at timestamptz,
  rollback_hint text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payment_action_requests add column if not exists action_key text;
alter table public.payment_action_requests add column if not exists action_type text not null default 'apply_payment';
alter table public.payment_action_requests add column if not exists action_status text not null default 'draft';
alter table public.payment_action_requests add column if not exists customer_or_vendor_name text;
alter table public.payment_action_requests add column if not exists invoice_reference text;
alter table public.payment_action_requests add column if not exists payment_reference text;
alter table public.payment_action_requests add column if not exists amount numeric(12,2) not null default 0;
alter table public.payment_action_requests add column if not exists currency_code text not null default 'CAD';
alter table public.payment_action_requests add column if not exists reason text;
alter table public.payment_action_requests add column if not exists proof_required boolean not null default true;
alter table public.payment_action_requests add column if not exists proof_reference text;
alter table public.payment_action_requests add column if not exists requested_by_profile_id uuid;
alter table public.payment_action_requests add column if not exists approved_by_profile_id uuid;
alter table public.payment_action_requests add column if not exists approved_at timestamptz;
alter table public.payment_action_requests add column if not exists posted_at timestamptz;
alter table public.payment_action_requests add column if not exists rollback_hint text;
alter table public.payment_action_requests add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.payment_action_requests add column if not exists created_at timestamptz not null default now();
alter table public.payment_action_requests add column if not exists updated_at timestamptz not null default now();
create unique index if not exists payment_action_requests_action_key_uidx on public.payment_action_requests(action_key);

create table if not exists public.bank_csv_import_previews (
  id uuid primary key default gen_random_uuid(),
  import_key text unique not null default ('bank_' || gen_random_uuid()::text),
  original_filename text,
  bank_account_hint text,
  preview_status text not null default 'preview',
  header_json jsonb not null default '[]'::jsonb,
  total_rows integer not null default 0,
  accepted_rows integer not null default 0,
  rejected_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  validation_summary jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bank_csv_import_previews add column if not exists import_key text;
alter table public.bank_csv_import_previews add column if not exists original_filename text;
alter table public.bank_csv_import_previews add column if not exists bank_account_hint text;
alter table public.bank_csv_import_previews add column if not exists preview_status text not null default 'preview';
alter table public.bank_csv_import_previews add column if not exists header_json jsonb not null default '[]'::jsonb;
alter table public.bank_csv_import_previews add column if not exists total_rows integer not null default 0;
alter table public.bank_csv_import_previews add column if not exists accepted_rows integer not null default 0;
alter table public.bank_csv_import_previews add column if not exists rejected_rows integer not null default 0;
alter table public.bank_csv_import_previews add column if not exists duplicate_rows integer not null default 0;
alter table public.bank_csv_import_previews add column if not exists validation_summary jsonb not null default '{}'::jsonb;
alter table public.bank_csv_import_previews add column if not exists created_by_profile_id uuid;
alter table public.bank_csv_import_previews add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.bank_csv_import_previews add column if not exists created_at timestamptz not null default now();
alter table public.bank_csv_import_previews add column if not exists updated_at timestamptz not null default now();
create unique index if not exists bank_csv_import_previews_import_key_uidx on public.bank_csv_import_previews(import_key);

create table if not exists public.bank_csv_import_preview_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid references public.bank_csv_import_previews(id) on delete cascade,
  row_number integer not null default 0,
  row_status text not null default 'accepted',
  transaction_date date,
  description text,
  amount numeric(12,2),
  debit_amount numeric(12,2),
  credit_amount numeric(12,2),
  reference text,
  duplicate_key text,
  rejection_reason text,
  raw_row jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.bank_csv_import_preview_rows add column if not exists import_id uuid;
alter table public.bank_csv_import_preview_rows add column if not exists row_number integer not null default 0;
alter table public.bank_csv_import_preview_rows add column if not exists row_status text not null default 'accepted';
alter table public.bank_csv_import_preview_rows add column if not exists transaction_date date;
alter table public.bank_csv_import_preview_rows add column if not exists description text;
alter table public.bank_csv_import_preview_rows add column if not exists amount numeric(12,2);
alter table public.bank_csv_import_preview_rows add column if not exists debit_amount numeric(12,2);
alter table public.bank_csv_import_preview_rows add column if not exists credit_amount numeric(12,2);
alter table public.bank_csv_import_preview_rows add column if not exists reference text;
alter table public.bank_csv_import_preview_rows add column if not exists duplicate_key text;
alter table public.bank_csv_import_preview_rows add column if not exists rejection_reason text;
alter table public.bank_csv_import_preview_rows add column if not exists raw_row jsonb not null default '{}'::jsonb;
alter table public.bank_csv_import_preview_rows add column if not exists created_at timestamptz not null default now();

create table if not exists public.reconciliation_action_requests (
  id uuid primary key default gen_random_uuid(),
  action_type text not null,
  action_status text not null default 'draft',
  import_id uuid,
  bank_row_id uuid,
  target_reference text,
  split_json jsonb not null default '[]'::jsonb,
  signoff_note text,
  undo_of_action_id uuid,
  requested_by_profile_id uuid,
  signed_off_by_profile_id uuid,
  signed_off_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.reconciliation_action_requests add column if not exists action_type text not null default 'match';
alter table public.reconciliation_action_requests add column if not exists action_status text not null default 'draft';
alter table public.reconciliation_action_requests add column if not exists import_id uuid;
alter table public.reconciliation_action_requests add column if not exists bank_row_id uuid;
alter table public.reconciliation_action_requests add column if not exists target_reference text;
alter table public.reconciliation_action_requests add column if not exists split_json jsonb not null default '[]'::jsonb;
alter table public.reconciliation_action_requests add column if not exists signoff_note text;
alter table public.reconciliation_action_requests add column if not exists undo_of_action_id uuid;
alter table public.reconciliation_action_requests add column if not exists requested_by_profile_id uuid;
alter table public.reconciliation_action_requests add column if not exists signed_off_by_profile_id uuid;
alter table public.reconciliation_action_requests add column if not exists signed_off_at timestamptz;
alter table public.reconciliation_action_requests add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.reconciliation_action_requests add column if not exists created_at timestamptz not null default now();
alter table public.reconciliation_action_requests add column if not exists updated_at timestamptz not null default now();

create table if not exists public.equipment_scan_events (
  id uuid primary key default gen_random_uuid(),
  scan_code text not null,
  scan_source text not null default 'manual',
  scan_stage text not null default 'field_check',
  scan_status text not null default 'captured',
  equipment_reference text,
  job_reference text,
  actor_profile_id uuid,
  location_hint text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.equipment_scan_events add column if not exists scan_code text not null default 'manual';
alter table public.equipment_scan_events add column if not exists scan_source text not null default 'manual';
alter table public.equipment_scan_events add column if not exists scan_stage text not null default 'field_check';
alter table public.equipment_scan_events add column if not exists scan_status text not null default 'captured';
alter table public.equipment_scan_events add column if not exists equipment_reference text;
alter table public.equipment_scan_events add column if not exists job_reference text;
alter table public.equipment_scan_events add column if not exists actor_profile_id uuid;
alter table public.equipment_scan_events add column if not exists location_hint text;
alter table public.equipment_scan_events add column if not exists notes text;
alter table public.equipment_scan_events add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.equipment_scan_events add column if not exists created_at timestamptz not null default now();

create table if not exists public.equipment_custody_timeline_events (
  id uuid primary key default gen_random_uuid(),
  equipment_reference text not null,
  custody_stage text not null,
  custody_status text not null default 'captured',
  job_reference text,
  condition_summary text,
  accessory_summary text,
  signer_name text,
  actor_profile_id uuid,
  scan_event_id uuid,
  service_required boolean not null default false,
  cost_recovery_required boolean not null default false,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.equipment_custody_timeline_events add column if not exists equipment_reference text not null default 'unknown';
alter table public.equipment_custody_timeline_events add column if not exists custody_stage text not null default 'field_check';
alter table public.equipment_custody_timeline_events add column if not exists custody_status text not null default 'captured';
alter table public.equipment_custody_timeline_events add column if not exists job_reference text;
alter table public.equipment_custody_timeline_events add column if not exists condition_summary text;
alter table public.equipment_custody_timeline_events add column if not exists accessory_summary text;
alter table public.equipment_custody_timeline_events add column if not exists signer_name text;
alter table public.equipment_custody_timeline_events add column if not exists actor_profile_id uuid;
alter table public.equipment_custody_timeline_events add column if not exists scan_event_id uuid;
alter table public.equipment_custody_timeline_events add column if not exists service_required boolean not null default false;
alter table public.equipment_custody_timeline_events add column if not exists cost_recovery_required boolean not null default false;
alter table public.equipment_custody_timeline_events add column if not exists notes text;
alter table public.equipment_custody_timeline_events add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.equipment_custody_timeline_events add column if not exists created_at timestamptz not null default now();

create table if not exists public.visual_asset_approval_items (
  id uuid primary key default gen_random_uuid(),
  asset_key text unique not null default ('asset_' || gen_random_uuid()::text),
  asset_status text not null default 'draft',
  surface_area text not null default 'public',
  image_role text not null default 'placeholder_replacement',
  source_url text,
  alt_text text,
  consent_status text not null default 'not_required',
  compression_status text not null default 'pending',
  route_key text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.visual_asset_approval_items add column if not exists asset_key text;
alter table public.visual_asset_approval_items add column if not exists asset_status text not null default 'draft';
alter table public.visual_asset_approval_items add column if not exists surface_area text not null default 'public';
alter table public.visual_asset_approval_items add column if not exists image_role text not null default 'placeholder_replacement';
alter table public.visual_asset_approval_items add column if not exists source_url text;
alter table public.visual_asset_approval_items add column if not exists alt_text text;
alter table public.visual_asset_approval_items add column if not exists consent_status text not null default 'not_required';
alter table public.visual_asset_approval_items add column if not exists compression_status text not null default 'pending';
alter table public.visual_asset_approval_items add column if not exists route_key text;
alter table public.visual_asset_approval_items add column if not exists notes text;
alter table public.visual_asset_approval_items add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.visual_asset_approval_items add column if not exists created_at timestamptz not null default now();
alter table public.visual_asset_approval_items add column if not exists updated_at timestamptz not null default now();
create unique index if not exists visual_asset_approval_items_asset_key_uidx on public.visual_asset_approval_items(asset_key);

create table if not exists public.public_route_approval_items (
  id uuid primary key default gen_random_uuid(),
  route_key text unique not null,
  route_status text not null default 'draft',
  route_path text not null,
  page_title text not null,
  h1_text text not null,
  meta_description text,
  local_proof_hint text,
  primary_cta_path text,
  visual_asset_key text,
  sitemap_ready boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.public_route_approval_items add column if not exists route_key text;
alter table public.public_route_approval_items add column if not exists route_status text not null default 'draft';
alter table public.public_route_approval_items add column if not exists route_path text not null default '/';
alter table public.public_route_approval_items add column if not exists page_title text not null default 'Page title required';
alter table public.public_route_approval_items add column if not exists h1_text text not null default 'Main heading required';
alter table public.public_route_approval_items add column if not exists meta_description text;
alter table public.public_route_approval_items add column if not exists local_proof_hint text;
alter table public.public_route_approval_items add column if not exists primary_cta_path text;
alter table public.public_route_approval_items add column if not exists visual_asset_key text;
alter table public.public_route_approval_items add column if not exists sitemap_ready boolean not null default false;
alter table public.public_route_approval_items add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.public_route_approval_items add column if not exists created_at timestamptz not null default now();
alter table public.public_route_approval_items add column if not exists updated_at timestamptz not null default now();
create unique index if not exists public_route_approval_items_route_key_uidx on public.public_route_approval_items(route_key);

create table if not exists public.mobile_offline_conflict_cards (
  id uuid primary key default gen_random_uuid(),
  conflict_key text unique not null default ('conflict_' || gen_random_uuid()::text),
  entity_type text not null,
  entity_reference text,
  conflict_status text not null default 'open',
  local_payload jsonb not null default '{}'::jsonb,
  server_payload jsonb not null default '{}'::jsonb,
  recommended_action text not null default 'review',
  resolution_action text,
  resolved_by_profile_id uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mobile_offline_conflict_cards add column if not exists conflict_key text;
alter table public.mobile_offline_conflict_cards add column if not exists entity_type text not null default 'draft';
alter table public.mobile_offline_conflict_cards add column if not exists entity_reference text;
alter table public.mobile_offline_conflict_cards add column if not exists conflict_status text not null default 'open';
alter table public.mobile_offline_conflict_cards add column if not exists local_payload jsonb not null default '{}'::jsonb;
alter table public.mobile_offline_conflict_cards add column if not exists server_payload jsonb not null default '{}'::jsonb;
alter table public.mobile_offline_conflict_cards add column if not exists recommended_action text not null default 'review';
alter table public.mobile_offline_conflict_cards add column if not exists resolution_action text;
alter table public.mobile_offline_conflict_cards add column if not exists resolved_by_profile_id uuid;
alter table public.mobile_offline_conflict_cards add column if not exists resolved_at timestamptz;
alter table public.mobile_offline_conflict_cards add column if not exists created_at timestamptz not null default now();
alter table public.mobile_offline_conflict_cards add column if not exists updated_at timestamptz not null default now();
create unique index if not exists mobile_offline_conflict_cards_conflict_key_uidx on public.mobile_offline_conflict_cards(conflict_key);

create table if not exists public.admin_scorecard_progress_rails (
  rail_key text primary key,
  rail_area text not null default 'admin',
  rail_title text not null,
  rail_status text not null default 'active',
  progress_percent integer not null default 0,
  current_value numeric(12,2),
  target_value numeric(12,2),
  next_action_hint text,
  owner_hint text,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.admin_scorecard_progress_rails add column if not exists rail_area text not null default 'admin';
alter table public.admin_scorecard_progress_rails add column if not exists rail_title text not null default 'Progress rail';
alter table public.admin_scorecard_progress_rails add column if not exists rail_status text not null default 'active';
alter table public.admin_scorecard_progress_rails add column if not exists progress_percent integer not null default 0;
alter table public.admin_scorecard_progress_rails add column if not exists current_value numeric(12,2);
alter table public.admin_scorecard_progress_rails add column if not exists target_value numeric(12,2);
alter table public.admin_scorecard_progress_rails add column if not exists next_action_hint text;
alter table public.admin_scorecard_progress_rails add column if not exists owner_hint text;
alter table public.admin_scorecard_progress_rails add column if not exists sort_order integer not null default 100;
alter table public.admin_scorecard_progress_rails add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.admin_scorecard_progress_rails add column if not exists updated_at timestamptz not null default now();

insert into public.admin_scorecard_progress_rails (rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,next_action_hint,owner_hint,sort_order,metadata) values
('quote_intake_live','growth','Quote/contact intake live write path','active',65,1,2,'Deploy quote-contact-submit function and confirm a live request row appears.','Admin',10,'{"build":"2026-06-14b","schema":148}'::jsonb),
('payment_actions_live','accounting','Payment action request write path','active',35,1,5,'Connect UI action buttons to operations-manage payment_action_request.','Admin / accounting',20,'{"build":"2026-06-14b","schema":148}'::jsonb),
('bank_csv_preview_live','accounting','Bank CSV preview and rejected-row handling','active',40,1,4,'Upload/preview a sample bank CSV and inspect rejected rows.','Admin / accounting',30,'{"build":"2026-06-14b","schema":148}'::jsonb),
('equipment_scan_custody_live','field_mobile','Equipment scan and custody timeline','active',35,1,4,'Use manual scan fallback, then add barcode/QR camera scanning.','Supervisor',40,'{"build":"2026-06-14b","schema":148}'::jsonb),
('route_asset_approval_live','seo_visual','Route and visual asset approval before publishing','active',45,1,3,'Approve assets/routes before replacing placeholders or expanding sitemap.','Content / admin',50,'{"build":"2026-06-14b","schema":148}'::jsonb)
on conflict (rail_key) do update set rail_area=excluded.rail_area, rail_title=excluded.rail_title, rail_status=excluded.rail_status, progress_percent=excluded.progress_percent, current_value=excluded.current_value, target_value=excluded.target_value, next_action_hint=excluded.next_action_hint, owner_hint=excluded.owner_hint, sort_order=excluded.sort_order, metadata=excluded.metadata, updated_at=now();

drop view if exists public.v_quote_contact_requests;
create view public.v_quote_contact_requests as select id, request_status, request_source, full_name, contact_value, service_type, service_area, message, preferred_contact_method, page_path, spam_score, created_at, updated_at from public.quote_contact_requests order by created_at desc;
drop view if exists public.v_payment_action_requests;
create view public.v_payment_action_requests as select id, action_key, action_type, action_status, customer_or_vendor_name, invoice_reference, payment_reference, amount, currency_code, reason, proof_required, proof_reference, created_at, updated_at from public.payment_action_requests order by created_at desc;
drop view if exists public.v_bank_csv_import_previews;
create view public.v_bank_csv_import_previews as select id, import_key, original_filename, bank_account_hint, preview_status, total_rows, accepted_rows, rejected_rows, duplicate_rows, validation_summary, created_at, updated_at from public.bank_csv_import_previews order by created_at desc;
drop view if exists public.v_bank_csv_import_preview_rows;
create view public.v_bank_csv_import_preview_rows as select id, import_id, row_number, row_status, transaction_date, description, amount, debit_amount, credit_amount, reference, duplicate_key, rejection_reason, created_at from public.bank_csv_import_preview_rows order by created_at desc, row_number;
drop view if exists public.v_reconciliation_action_requests;
create view public.v_reconciliation_action_requests as select id, action_type, action_status, import_id, bank_row_id, target_reference, split_json, signoff_note, signed_off_at, created_at, updated_at from public.reconciliation_action_requests order by created_at desc;
drop view if exists public.v_equipment_scan_events;
create view public.v_equipment_scan_events as select id, scan_code, scan_source, scan_stage, scan_status, equipment_reference, job_reference, location_hint, notes, created_at from public.equipment_scan_events order by created_at desc;
drop view if exists public.v_equipment_custody_timeline_events;
create view public.v_equipment_custody_timeline_events as select id, equipment_reference, custody_stage, custody_status, job_reference, condition_summary, accessory_summary, signer_name, service_required, cost_recovery_required, notes, created_at from public.equipment_custody_timeline_events order by created_at desc;
drop view if exists public.v_visual_asset_approval_items;
create view public.v_visual_asset_approval_items as select id, asset_key, asset_status, surface_area, image_role, source_url, alt_text, consent_status, compression_status, route_key, notes, created_at, updated_at from public.visual_asset_approval_items order by created_at desc;
drop view if exists public.v_public_route_approval_items;
create view public.v_public_route_approval_items as select id, route_key, route_status, route_path, page_title, h1_text, meta_description, local_proof_hint, primary_cta_path, visual_asset_key, sitemap_ready, created_at, updated_at from public.public_route_approval_items order by created_at desc;
drop view if exists public.v_mobile_offline_conflict_cards;
create view public.v_mobile_offline_conflict_cards as select id, conflict_key, entity_type, entity_reference, conflict_status, recommended_action, resolution_action, resolved_at, created_at, updated_at from public.mobile_offline_conflict_cards order by created_at desc;
drop view if exists public.v_admin_scorecard_progress_rails;
create view public.v_admin_scorecard_progress_rails as select rail_key, rail_area, rail_title, rail_status, progress_percent, current_value, target_value, next_action_hint, owner_hint, sort_order, updated_at from public.admin_scorecard_progress_rails order by sort_order, rail_key;

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select 148::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 148 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 148 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through schema 148.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values (148, '148_real_write_actions_quote_payment_bank_recon_equipment_assets_routes_mobile_scorecards', '148_real_write_actions_quote_payment_bank_recon_equipment_assets_routes_mobile_scorecards.sql', '2026-06-14b', 'Adds real write-action tables and views for quote/contact intake, payment requests, bank CSV previews, reconciliation, equipment scan/custody, visual assets, public routes, mobile conflicts, and Admin scorecards.', 'applied', 'This pass shifts the app from readiness queues into operational write paths while keeping visual placeholders, local SEO approval gates, and desktop/mobile parity in place.')
on conflict (schema_version) do update set migration_key=excluded.migration_key, schema_name=excluded.schema_name, release_label=excluded.release_label, description=excluded.description, status=excluded.status, notes=excluded.notes, applied_at=now();

grant insert on public.quote_contact_requests to anon, authenticated;
grant insert on public.quote_contact_request_events to anon, authenticated;
grant select on public.v_quote_contact_requests to authenticated;
grant select, insert, update on public.payment_action_requests to authenticated;
grant select, insert, update on public.bank_csv_import_previews to authenticated;
grant select, insert, update on public.bank_csv_import_preview_rows to authenticated;
grant select, insert, update on public.reconciliation_action_requests to authenticated;
grant select, insert, update on public.equipment_scan_events to authenticated;
grant select, insert, update on public.equipment_custody_timeline_events to authenticated;
grant select, insert, update on public.visual_asset_approval_items to authenticated;
grant select, insert, update on public.public_route_approval_items to authenticated;
grant select, insert, update on public.mobile_offline_conflict_cards to authenticated;
grant select, insert, update on public.admin_scorecard_progress_rails to authenticated;
grant select on public.v_payment_action_requests, public.v_bank_csv_import_previews, public.v_bank_csv_import_preview_rows, public.v_reconciliation_action_requests, public.v_equipment_scan_events, public.v_equipment_custody_timeline_events, public.v_visual_asset_approval_items, public.v_public_route_approval_items, public.v_mobile_offline_conflict_cards, public.v_admin_scorecard_progress_rails, public.v_schema_drift_status to authenticated;

commit;
