-- Schema 149: Operations cockpit write controls, idempotency, approvals,
-- fallback audit events, quote deduplication, bank import confirmation,
-- and route/visual publication readiness.
-- Build 2026-06-17a.

begin;

create table if not exists public.operation_write_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_key text unique not null default ('op_' || gen_random_uuid()::text),
  operation_action text not null,
  operation_status text not null default 'captured',
  entity_type text,
  entity_id uuid,
  actor_profile_id uuid,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);
alter table public.operation_write_audit_events add column if not exists event_key text;
alter table public.operation_write_audit_events add column if not exists operation_action text not null default 'unknown';
alter table public.operation_write_audit_events add column if not exists operation_status text not null default 'captured';
alter table public.operation_write_audit_events add column if not exists entity_type text;
alter table public.operation_write_audit_events add column if not exists entity_id uuid;
alter table public.operation_write_audit_events add column if not exists actor_profile_id uuid;
alter table public.operation_write_audit_events add column if not exists request_payload jsonb not null default '{}'::jsonb;
alter table public.operation_write_audit_events add column if not exists response_payload jsonb not null default '{}'::jsonb;
alter table public.operation_write_audit_events add column if not exists error_message text;
alter table public.operation_write_audit_events add column if not exists created_at timestamptz not null default now();
create unique index if not exists operation_write_audit_events_event_key_uidx on public.operation_write_audit_events(event_key);
create index if not exists operation_write_audit_events_action_created_idx on public.operation_write_audit_events(operation_action, created_at desc);

alter table public.quote_contact_requests add column if not exists duplicate_fingerprint text;
alter table public.quote_contact_requests add column if not exists assigned_to_profile_id uuid;
alter table public.quote_contact_requests add column if not exists followup_due_at timestamptz;
alter table public.quote_contact_requests add column if not exists last_event_at timestamptz not null default now();
create index if not exists quote_contact_requests_duplicate_fingerprint_idx on public.quote_contact_requests(duplicate_fingerprint, created_at desc);
create index if not exists quote_contact_requests_followup_idx on public.quote_contact_requests(request_status, followup_due_at);

alter table public.payment_action_requests add column if not exists idempotency_key text;
alter table public.payment_action_requests add column if not exists decision_note text;
alter table public.payment_action_requests add column if not exists period_lock_checked boolean not null default false;
alter table public.payment_action_requests add column if not exists rejected_by_profile_id uuid;
alter table public.payment_action_requests add column if not exists rejected_at timestamptz;
alter table public.payment_action_requests add column if not exists rejection_reason text;
create unique index if not exists payment_action_requests_idempotency_uidx on public.payment_action_requests(idempotency_key) where idempotency_key is not null;
create index if not exists payment_action_requests_status_created_idx on public.payment_action_requests(action_status, created_at desc);

alter table public.bank_csv_import_previews add column if not exists idempotency_key text;
alter table public.bank_csv_import_previews add column if not exists confirmed_at timestamptz;
alter table public.bank_csv_import_previews add column if not exists confirmed_by_profile_id uuid;
alter table public.bank_csv_import_previews add column if not exists confirmation_note text;
create unique index if not exists bank_csv_import_previews_idempotency_uidx on public.bank_csv_import_previews(idempotency_key) where idempotency_key is not null;

alter table public.reconciliation_action_requests add column if not exists idempotency_key text;
alter table public.reconciliation_action_requests add column if not exists decision_note text;
create unique index if not exists reconciliation_action_requests_idempotency_uidx on public.reconciliation_action_requests(idempotency_key) where idempotency_key is not null;

alter table public.equipment_scan_events add column if not exists idempotency_key text;
create unique index if not exists equipment_scan_events_idempotency_uidx on public.equipment_scan_events(idempotency_key) where idempotency_key is not null;

alter table public.visual_asset_approval_items add column if not exists approved_by_profile_id uuid;
alter table public.visual_asset_approval_items add column if not exists approved_at timestamptz;
alter table public.visual_asset_approval_items add column if not exists rejection_reason text;
alter table public.visual_asset_approval_items add column if not exists readiness_score integer not null default 0;

alter table public.public_route_approval_items add column if not exists approved_by_profile_id uuid;
alter table public.public_route_approval_items add column if not exists approved_at timestamptz;
alter table public.public_route_approval_items add column if not exists rejection_reason text;
alter table public.public_route_approval_items add column if not exists seo_readiness_score integer not null default 0;
alter table public.public_route_approval_items add column if not exists validation_json jsonb not null default '{}'::jsonb;

alter table public.mobile_offline_conflict_cards add column if not exists resolution_note text;
alter table public.mobile_offline_conflict_cards add column if not exists retry_count integer not null default 0;

update public.admin_scorecard_progress_rails
set progress_percent = case rail_key
  when 'quote_intake_live' then greatest(progress_percent, 80)
  when 'payment_actions_live' then greatest(progress_percent, 60)
  when 'bank_csv_preview_live' then greatest(progress_percent, 65)
  when 'equipment_scan_custody_live' then greatest(progress_percent, 60)
  when 'route_asset_approval_live' then greatest(progress_percent, 65)
  else progress_percent end,
  metadata = coalesce(metadata, '{}'::jsonb) || '{"build":"2026-06-17a","schema":149,"operations_cockpit":true}'::jsonb,
  updated_at = now();

insert into public.admin_scorecard_progress_rails (
  rail_key, rail_area, rail_title, rail_status, progress_percent,
  current_value, target_value, next_action_hint, owner_hint, sort_order, metadata
) values (
  'operations_cockpit_live', 'admin', 'Operations cockpit write forms', 'active', 75,
  6, 8, 'Deploy operations-manage and test payment, CSV, reconciliation, equipment, visual, and route actions.',
  'Admin / operations', 5, '{"build":"2026-06-17a","schema":149}'::jsonb
)
on conflict (rail_key) do update set
  rail_area = excluded.rail_area,
  rail_title = excluded.rail_title,
  rail_status = excluded.rail_status,
  progress_percent = excluded.progress_percent,
  current_value = excluded.current_value,
  target_value = excluded.target_value,
  next_action_hint = excluded.next_action_hint,
  owner_hint = excluded.owner_hint,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  updated_at = now();

drop view if exists public.v_operation_write_audit_events;
create view public.v_operation_write_audit_events as
select id, event_key, operation_action, operation_status, entity_type, entity_id,
       actor_profile_id, error_message, created_at
from public.operation_write_audit_events
order by created_at desc;

drop view if exists public.v_quote_contact_followup_queue;
create view public.v_quote_contact_followup_queue as
select id, request_status, full_name, contact_value, service_type, service_area,
       preferred_contact_method, assigned_to_profile_id, followup_due_at,
       spam_score, created_at, updated_at
from public.quote_contact_requests
where request_status in ('new','review','contacted')
order by coalesce(followup_due_at, created_at), created_at;

drop view if exists public.v_payment_action_workbench;
create view public.v_payment_action_workbench as
select id, action_key, action_type, action_status, customer_or_vendor_name,
       invoice_reference, payment_reference, amount, currency_code, reason,
       proof_required, proof_reference, period_lock_checked, decision_note,
       rejection_reason, created_at, updated_at
from public.payment_action_requests
order by created_at desc;

drop view if exists public.v_bank_csv_import_workbench;
create view public.v_bank_csv_import_workbench as
select p.id, p.import_key, p.original_filename, p.bank_account_hint, p.preview_status,
       p.total_rows, p.accepted_rows, p.rejected_rows, p.duplicate_rows,
       p.confirmed_at, p.confirmation_note, p.created_at,
       count(r.id) filter (where r.row_status = 'accepted') as accepted_row_count,
       count(r.id) filter (where r.row_status = 'rejected') as rejected_row_count
from public.bank_csv_import_previews p
left join public.bank_csv_import_preview_rows r on r.import_id = p.id
group by p.id
order by p.created_at desc;

drop view if exists public.v_visual_asset_publication_readiness;
create view public.v_visual_asset_publication_readiness as
select id, asset_key, asset_status, surface_area, image_role, source_url, alt_text,
       consent_status, compression_status, route_key, readiness_score,
       case when source_url is not null
              and length(coalesce(alt_text,'')) >= 12
              and consent_status in ('approved','not_required')
              and compression_status in ('ready','optimized')
            then true else false end as publication_ready,
       created_at, updated_at
from public.visual_asset_approval_items
order by updated_at desc;

drop view if exists public.v_public_route_publication_readiness;
create view public.v_public_route_publication_readiness as
select id, route_key, route_status, route_path, page_title, h1_text,
       meta_description, local_proof_hint, primary_cta_path, visual_asset_key,
       sitemap_ready, seo_readiness_score, validation_json,
       case when length(coalesce(page_title,'')) between 20 and 70
              and length(coalesce(h1_text,'')) between 10 and 120
              and length(coalesce(meta_description,'')) between 70 and 170
              and coalesce(local_proof_hint,'') <> ''
              and coalesce(primary_cta_path,'') <> ''
            then true else false end as publication_ready,
       created_at, updated_at
from public.public_route_approval_items
order by updated_at desc;

drop view if exists public.v_admin_operations_cockpit_scorecards;
create view public.v_admin_operations_cockpit_scorecards as
select 'quotes_open'::text as metric_key, 'Open quote/contact requests'::text as metric_title,
       count(*)::numeric as metric_value, 0::numeric as target_value,
       'growth'::text as metric_area
from public.quote_contact_requests where request_status in ('new','review','contacted')
union all
select 'payments_open', 'Open payment actions', count(*)::numeric, 0::numeric, 'accounting'
from public.payment_action_requests where action_status in ('draft','submitted','approved')
union all
select 'bank_preview_open', 'Bank CSV previews awaiting confirmation', count(*)::numeric, 0::numeric, 'accounting'
from public.bank_csv_import_previews where preview_status in ('preview','review')
union all
select 'reconciliation_open', 'Reconciliation actions awaiting signoff', count(*)::numeric, 0::numeric, 'accounting'
from public.reconciliation_action_requests where action_status in ('draft','submitted','review')
union all
select 'equipment_service', 'Equipment events requiring service', count(*)::numeric, 0::numeric, 'equipment'
from public.equipment_custody_timeline_events where service_required = true
union all
select 'visual_assets_pending', 'Visual assets awaiting approval', count(*)::numeric, 0::numeric, 'visual'
from public.visual_asset_approval_items where asset_status in ('draft','review')
union all
select 'routes_pending', 'Public routes awaiting approval', count(*)::numeric, 0::numeric, 'seo'
from public.public_route_approval_items where route_status in ('draft','review');

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  149::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 149 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 149
       then 'Live database is at or ahead of the repo schema marker.'
       else 'Live database is behind the deployed app. Apply migrations through schema 149.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version, migration_key, schema_name, release_label, description, status, notes
) values (
  149,
  '149_operations_cockpit_write_controls_and_competitive_workflow_depth',
  '149_operations_cockpit_write_controls_and_competitive_workflow_depth.sql',
  '2026-06-17a',
  'Adds operational write audit events, idempotency and decision controls, quote follow-up fields, bank confirmation, asset/route readiness, and Admin operations cockpit scorecards.',
  'applied',
  'This pass converts schema 148 write targets into a usable desktop/mobile Admin operations cockpit with retry and manual scanner fallback.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.operation_write_audit_events to authenticated;
grant select on public.v_operation_write_audit_events to authenticated;
grant select on public.v_quote_contact_followup_queue to authenticated;
grant select on public.v_payment_action_workbench to authenticated;
grant select on public.v_bank_csv_import_workbench to authenticated;
grant select on public.v_visual_asset_publication_readiness to authenticated;
grant select on public.v_public_route_publication_readiness to authenticated;
grant select on public.v_admin_operations_cockpit_scorecards to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
