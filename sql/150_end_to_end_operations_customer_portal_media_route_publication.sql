-- Schema 150: End-to-end operations execution, customer portal, media pipeline,
-- approved route publication, live queues, and exact reconciliation controls.
-- Build 2026-06-17b.

begin;

-- ---------------------------------------------------------------------------
-- Quote/contact ownership, alerts, and follow-up history
-- ---------------------------------------------------------------------------
alter table public.quote_contact_requests add column if not exists first_response_at timestamptz;
alter table public.quote_contact_requests add column if not exists last_contacted_at timestamptz;
alter table public.quote_contact_requests add column if not exists response_status text not null default 'awaiting_response';
alter table public.quote_contact_requests add column if not exists converted_estimate_id uuid references public.estimates(id) on delete set null;
alter table public.quote_contact_requests add column if not exists converted_client_id uuid references public.clients(id) on delete set null;
alter table public.quote_contact_requests add column if not exists owner_assigned_at timestamptz;
alter table public.quote_contact_requests add column if not exists owner_assigned_by_profile_id uuid references public.profiles(id) on delete set null;
create index if not exists quote_contact_requests_owner_due_idx on public.quote_contact_requests(assigned_to_profile_id, request_status, followup_due_at);

create table if not exists public.quote_followup_alerts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.quote_contact_requests(id) on delete cascade,
  alert_type text not null default 'followup_due',
  alert_status text not null default 'open',
  due_at timestamptz,
  assigned_to_profile_id uuid references public.profiles(id) on delete set null,
  alert_message text,
  delivery_channels jsonb not null default '["in_app"]'::jsonb,
  delivered_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quote_followup_alerts_open_idx on public.quote_followup_alerts(alert_status, due_at, assigned_to_profile_id);

-- ---------------------------------------------------------------------------
-- Real payment application and journal posting linkage
-- ---------------------------------------------------------------------------
alter table public.payment_action_requests add column if not exists ledger_side text;
alter table public.payment_action_requests add column if not exists bank_account_id uuid references public.bank_accounts(id) on delete set null;
alter table public.payment_action_requests add column if not exists bank_account_hint text;
alter table public.payment_action_requests add column if not exists transaction_date date not null default current_date;
alter table public.payment_action_requests add column if not exists ar_invoice_id uuid references public.ar_invoices(id) on delete set null;
alter table public.payment_action_requests add column if not exists ap_bill_id uuid references public.ap_bills(id) on delete set null;
alter table public.payment_action_requests add column if not exists ar_payment_id uuid references public.ar_payments(id) on delete set null;
alter table public.payment_action_requests add column if not exists ap_payment_id uuid references public.ap_payments(id) on delete set null;
alter table public.payment_action_requests add column if not exists ar_application_id uuid references public.ar_payment_applications(id) on delete set null;
alter table public.payment_action_requests add column if not exists ap_application_id uuid references public.ap_payment_applications(id) on delete set null;
alter table public.payment_action_requests add column if not exists gl_batch_id uuid references public.gl_journal_batches(id) on delete set null;
alter table public.payment_action_requests add column if not exists posting_status text not null default 'not_posted';
alter table public.payment_action_requests add column if not exists posting_message text;
alter table public.payment_action_requests add column if not exists posting_payload jsonb not null default '{}'::jsonb;
alter table public.payment_action_requests add column if not exists posted_by_profile_id uuid references public.profiles(id) on delete set null;
alter table public.payment_action_requests add column if not exists reversal_of_request_id uuid references public.payment_action_requests(id) on delete set null;
create index if not exists payment_action_requests_posting_idx on public.payment_action_requests(action_status, posting_status, created_at desc);

-- ---------------------------------------------------------------------------
-- Confirmed bank rows promoted to the reconciliation workbench
-- ---------------------------------------------------------------------------
alter table public.bank_csv_import_previews add column if not exists bank_account_id uuid references public.bank_accounts(id) on delete set null;
alter table public.bank_csv_import_previews add column if not exists statement_import_id uuid references public.bank_statement_imports(id) on delete set null;
alter table public.bank_csv_import_previews add column if not exists reconciliation_session_id uuid references public.bank_reconciliation_sessions(id) on delete set null;
alter table public.bank_csv_import_previews add column if not exists promoted_at timestamptz;
alter table public.bank_csv_import_previews add column if not exists promoted_by_profile_id uuid references public.profiles(id) on delete set null;
alter table public.bank_csv_import_previews add column if not exists promotion_message text;

alter table public.bank_csv_import_preview_rows add column if not exists promoted_reconciliation_item_id uuid references public.bank_reconciliation_items(id) on delete set null;
alter table public.bank_csv_import_preview_rows add column if not exists promoted_at timestamptz;
create index if not exists bank_csv_preview_rows_promotion_idx on public.bank_csv_import_preview_rows(import_id, row_status, promoted_at);

-- ---------------------------------------------------------------------------
-- Explainable scoring, exact splits, and reversible match allocations
-- ---------------------------------------------------------------------------
alter table public.reconciliation_action_requests add column if not exists reconciliation_item_id uuid references public.bank_reconciliation_items(id) on delete set null;
alter table public.reconciliation_action_requests add column if not exists match_score numeric(5,2);
alter table public.reconciliation_action_requests add column if not exists match_explanation jsonb not null default '{}'::jsonb;
alter table public.reconciliation_action_requests add column if not exists source_amount numeric(12,2);
alter table public.reconciliation_action_requests add column if not exists split_total numeric(12,2);
alter table public.reconciliation_action_requests add column if not exists balance_difference numeric(12,2);
alter table public.reconciliation_action_requests add column if not exists processed_by_profile_id uuid references public.profiles(id) on delete set null;
alter table public.reconciliation_action_requests add column if not exists processed_at timestamptz;

create table if not exists public.reconciliation_match_allocations (
  id uuid primary key default gen_random_uuid(),
  action_request_id uuid not null references public.reconciliation_action_requests(id) on delete cascade,
  reconciliation_item_id uuid not null references public.bank_reconciliation_items(id) on delete cascade,
  target_type text not null,
  target_id text,
  target_reference text,
  allocated_amount numeric(12,2) not null,
  match_score numeric(5,2),
  match_explanation jsonb not null default '{}'::jsonb,
  allocation_status text not null default 'active',
  reversed_at timestamptz,
  reversed_by_profile_id uuid references public.profiles(id) on delete set null,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists reconciliation_match_allocations_item_idx on public.reconciliation_match_allocations(reconciliation_item_id, allocation_status, created_at desc);

-- ---------------------------------------------------------------------------
-- Equipment identity resolution, service work, and cost recovery
-- ---------------------------------------------------------------------------
alter table public.equipment_scan_events add column if not exists equipment_item_id bigint references public.equipment_items(id) on delete set null;
alter table public.equipment_scan_events add column if not exists equipment_master_id uuid references public.equipment_master(id) on delete set null;
alter table public.equipment_scan_events add column if not exists resolution_status text not null default 'unresolved';
alter table public.equipment_scan_events add column if not exists resolved_equipment_name text;
alter table public.equipment_scan_events add column if not exists resolved_equipment_status text;

alter table public.equipment_custody_timeline_events add column if not exists equipment_item_id bigint references public.equipment_items(id) on delete set null;
alter table public.equipment_custody_timeline_events add column if not exists equipment_master_id uuid references public.equipment_master(id) on delete set null;
alter table public.equipment_custody_timeline_events add column if not exists job_id bigint references public.jobs(id) on delete set null;
alter table public.equipment_custody_timeline_events add column if not exists service_task_id uuid references public.equipment_service_tasks(id) on delete set null;

create table if not exists public.equipment_cost_recovery_actions (
  id uuid primary key default gen_random_uuid(),
  custody_event_id uuid references public.equipment_custody_timeline_events(id) on delete set null,
  service_task_id uuid references public.equipment_service_tasks(id) on delete set null,
  equipment_item_id bigint references public.equipment_items(id) on delete set null,
  equipment_master_id uuid references public.equipment_master(id) on delete set null,
  job_id bigint references public.jobs(id) on delete set null,
  action_status text not null default 'review',
  recovery_decision text not null default 'pending',
  estimated_cost numeric(12,2) not null default 0,
  actual_cost numeric(12,2) not null default 0,
  recoverable_amount numeric(12,2) not null default 0,
  customer_billable boolean not null default false,
  financial_event_id uuid references public.job_financial_events(id) on delete set null,
  decision_note text,
  decided_by_profile_id uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists equipment_cost_recovery_actions_open_idx on public.equipment_cost_recovery_actions(action_status, job_id, created_at desc);
alter table public.equipment_custody_timeline_events add column if not exists cost_recovery_action_id uuid references public.equipment_cost_recovery_actions(id) on delete set null;

-- Public optimized media bucket. Edge Functions use the service role for writes;
-- approved files are public so generated route pages can be crawled and cached.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-assets', 'public-assets', true, 8388608, array['image/webp','image/jpeg','image/png','image/avif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Real image upload metadata and approved placeholder replacement
-- ---------------------------------------------------------------------------
alter table public.visual_asset_approval_items add column if not exists storage_bucket text;
alter table public.visual_asset_approval_items add column if not exists storage_path text;
alter table public.visual_asset_approval_items add column if not exists thumbnail_path text;
alter table public.visual_asset_approval_items add column if not exists public_url text;
alter table public.visual_asset_approval_items add column if not exists thumbnail_url text;
alter table public.visual_asset_approval_items add column if not exists pixel_width integer;
alter table public.visual_asset_approval_items add column if not exists pixel_height integer;
alter table public.visual_asset_approval_items add column if not exists thumbnail_width integer;
alter table public.visual_asset_approval_items add column if not exists thumbnail_height integer;
alter table public.visual_asset_approval_items add column if not exists file_size_bytes bigint;
alter table public.visual_asset_approval_items add column if not exists mime_type text;
alter table public.visual_asset_approval_items add column if not exists original_file_name text;
alter table public.visual_asset_approval_items add column if not exists checksum_sha256 text;
alter table public.visual_asset_approval_items add column if not exists placeholder_selector text;
alter table public.visual_asset_approval_items add column if not exists replacement_status text not null default 'not_replaced';
create index if not exists visual_asset_route_status_idx on public.visual_asset_approval_items(route_key, asset_status, replacement_status);

-- ---------------------------------------------------------------------------
-- Approved public page and sitemap registry
-- ---------------------------------------------------------------------------
alter table public.public_route_approval_items add column if not exists route_type text not null default 'service';
alter table public.public_route_approval_items add column if not exists service_name text;
alter table public.public_route_approval_items add column if not exists location_name text;
alter table public.public_route_approval_items add column if not exists page_intro text;
alter table public.public_route_approval_items add column if not exists page_body_markdown text;
alter table public.public_route_approval_items add column if not exists page_body_html text;
alter table public.public_route_approval_items add column if not exists canonical_url text;
alter table public.public_route_approval_items add column if not exists published_at timestamptz;
alter table public.public_route_approval_items add column if not exists published_by_profile_id uuid references public.profiles(id) on delete set null;
alter table public.public_route_approval_items add column if not exists generated_page_json jsonb not null default '{}'::jsonb;

create table if not exists public.public_sitemap_entries (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.public_route_approval_items(id) on delete cascade,
  route_path text not null unique,
  canonical_url text,
  last_modified date not null default current_date,
  change_frequency text not null default 'monthly',
  priority numeric(2,1) not null default 0.6,
  entry_status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists public_sitemap_entries_status_idx on public.public_sitemap_entries(entry_status, last_modified desc);
alter table public.public_route_approval_items add column if not exists sitemap_entry_id uuid references public.public_sitemap_entries(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Customer portal, quote acceptance, deposit, dispatch, and live job-costing
-- ---------------------------------------------------------------------------
alter table public.estimate_quote_packages add column if not exists portal_enabled boolean not null default true;
alter table public.estimate_quote_packages add column if not exists deposit_required_amount numeric(12,2) not null default 0;
alter table public.estimate_quote_packages add column if not exists deposit_status text not null default 'not_required';
alter table public.estimate_quote_packages add column if not exists portal_last_viewed_at timestamptz;
alter table public.estimate_quote_packages add column if not exists portal_terms_version text;
alter table public.estimate_quote_packages add column if not exists portal_acceptance_ip_hash text;

create table if not exists public.customer_portal_events (
  id uuid primary key default gen_random_uuid(),
  quote_package_id uuid references public.estimate_quote_packages(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  event_type text not null,
  event_status text not null default 'completed',
  customer_name text,
  customer_email text,
  event_note text,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists customer_portal_events_quote_idx on public.customer_portal_events(quote_package_id, created_at desc);

create table if not exists public.customer_deposit_requests (
  id uuid primary key default gen_random_uuid(),
  quote_package_id uuid not null references public.estimate_quote_packages(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  requested_amount numeric(12,2) not null,
  currency_code text not null default 'CAD',
  deposit_status text not null default 'requested',
  checkout_provider text,
  checkout_session_id text,
  checkout_url text,
  payment_reference text,
  paid_amount numeric(12,2) not null default 0,
  paid_at timestamptz,
  receipt_url text,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customer_deposit_requests_quote_idx on public.customer_deposit_requests(quote_package_id, deposit_status, created_at desc);

create table if not exists public.dispatch_schedule_items (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid references public.work_orders(id) on delete cascade,
  job_id bigint references public.jobs(id) on delete set null,
  schedule_status text not null default 'draft',
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  assigned_supervisor_profile_id uuid references public.profiles(id) on delete set null,
  assigned_crew_profile_ids jsonb not null default '[]'::jsonb,
  route_id uuid references public.routes(id) on delete set null,
  dispatch_notes text,
  customer_notification_status text not null default 'pending',
  crew_notification_status text not null default 'pending',
  dispatched_at timestamptz,
  dispatched_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dispatch_schedule_items_start_idx on public.dispatch_schedule_items(schedule_status, scheduled_start);

create table if not exists public.job_cost_live_snapshots (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references public.jobs(id) on delete cascade,
  work_order_id uuid references public.work_orders(id) on delete set null,
  estimate_total numeric(12,2) not null default 0,
  revenue_total numeric(12,2) not null default 0,
  labour_cost_total numeric(12,2) not null default 0,
  material_cost_total numeric(12,2) not null default 0,
  equipment_cost_total numeric(12,2) not null default 0,
  subcontract_cost_total numeric(12,2) not null default 0,
  other_cost_total numeric(12,2) not null default 0,
  total_cost numeric(12,2) generated always as (labour_cost_total + material_cost_total + equipment_cost_total + subcontract_cost_total + other_cost_total) stored,
  margin_amount numeric(12,2) not null default 0,
  margin_percent numeric(8,2) not null default 0,
  snapshot_status text not null default 'current',
  snapshot_payload jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists job_cost_live_snapshots_job_idx on public.job_cost_live_snapshots(job_id, calculated_at desc);

-- ---------------------------------------------------------------------------
-- Operational queue views
-- ---------------------------------------------------------------------------
drop view if exists public.v_quote_contact_followup_queue;
create view public.v_quote_contact_followup_queue as
select q.id, q.request_status, q.response_status, q.full_name, q.contact_value,
       q.service_type, q.service_area, q.preferred_contact_method,
       q.assigned_to_profile_id, p.full_name as assigned_owner_name,
       q.followup_due_at, q.first_response_at, q.last_contacted_at,
       case when q.followup_due_at is not null and q.followup_due_at < now() then true else false end as overdue,
       extract(epoch from (coalesce(q.first_response_at, now()) - q.created_at))/60.0 as response_minutes,
       q.spam_score, q.created_at, q.updated_at
from public.quote_contact_requests q
left join public.profiles p on p.id = q.assigned_to_profile_id
where q.request_status in ('new','review','contacted')
order by coalesce(q.followup_due_at, q.created_at), q.created_at;

drop view if exists public.v_payment_action_workbench;
create view public.v_payment_action_workbench as
select id, action_key, action_type, action_status, ledger_side, bank_account_id, bank_account_hint, transaction_date,
       customer_or_vendor_name, invoice_reference, payment_reference,
       amount, currency_code, reason, proof_required, proof_reference,
       period_lock_checked, decision_note, rejection_reason,
       posting_status, posting_message, ar_invoice_id, ap_bill_id,
       ar_payment_id, ap_payment_id, ar_application_id, ap_application_id,
       gl_batch_id, posted_by_profile_id, posted_at, created_at, updated_at
from public.payment_action_requests
order by created_at desc;

drop view if exists public.v_bank_csv_import_workbench;
create view public.v_bank_csv_import_workbench as
select p.id, p.import_key, p.original_filename, p.bank_account_hint, p.bank_account_id,
       ba.account_name as bank_account_name, p.preview_status,
       p.total_rows, p.accepted_rows, p.rejected_rows, p.duplicate_rows,
       p.confirmed_at, p.promoted_at, p.statement_import_id, p.reconciliation_session_id,
       p.confirmation_note, p.promotion_message, p.created_at,
       count(r.id) filter (where r.row_status = 'accepted') as accepted_row_count,
       count(r.id) filter (where r.row_status = 'rejected') as rejected_row_count,
       count(r.id) filter (where r.promoted_at is not null) as promoted_row_count
from public.bank_csv_import_previews p
left join public.bank_accounts ba on ba.id = p.bank_account_id
left join public.bank_csv_import_preview_rows r on r.import_id = p.id
group by p.id, ba.account_name
order by p.created_at desc;

drop view if exists public.v_reconciliation_action_workbench;
create view public.v_reconciliation_action_workbench as
select r.id, r.action_type, r.action_status, r.import_id, r.bank_row_id,
       r.reconciliation_item_id, bi.item_date, bi.item_description, bi.amount as bank_amount,
       r.target_reference, r.split_json, r.match_score, r.match_explanation,
       r.source_amount, r.split_total, r.balance_difference,
       r.signoff_note, r.decision_note, r.processed_at, r.signed_off_at,
       r.created_at, r.updated_at
from public.reconciliation_action_requests r
left join public.bank_reconciliation_items bi on bi.id = r.reconciliation_item_id
order by r.created_at desc;

drop view if exists public.v_equipment_scan_resolution_queue;
create view public.v_equipment_scan_resolution_queue as
select s.id, s.scan_code, s.scan_source, s.scan_stage, s.scan_status,
       s.resolution_status, s.equipment_item_id, s.equipment_master_id,
       coalesce(ei.equipment_code, em.equipment_code, s.equipment_reference) as equipment_code,
       coalesce(ei.equipment_name, em.item_name, s.resolved_equipment_name) as equipment_name,
       coalesce(ei.status, case when em.is_active then 'active' else 'inactive' end, s.resolved_equipment_status) as equipment_status,
       ei.is_locked_out, ei.defect_status, s.job_reference, s.created_at
from public.equipment_scan_events s
left join public.equipment_items ei on ei.id = s.equipment_item_id
left join public.equipment_master em on em.id = s.equipment_master_id
order by s.created_at desc;

drop view if exists public.v_equipment_service_cost_recovery_queue;
create view public.v_equipment_service_cost_recovery_queue as
select c.id as custody_event_id, c.equipment_reference, c.custody_stage,
       c.equipment_item_id, c.equipment_master_id, c.job_id, c.job_reference,
       c.service_required, c.cost_recovery_required, c.service_task_id,
       t.task_status as service_task_status, t.priority as service_priority,
       t.failure_reason, t.estimated_cost, t.actual_cost,
       c.cost_recovery_action_id, a.action_status as recovery_status,
       a.recovery_decision, a.recoverable_amount, a.customer_billable,
       c.condition_summary, c.accessory_summary, c.notes, c.created_at
from public.equipment_custody_timeline_events c
left join public.equipment_service_tasks t on t.id = c.service_task_id
left join public.equipment_cost_recovery_actions a on a.id = c.cost_recovery_action_id
where c.service_required = true or c.cost_recovery_required = true
order by c.created_at desc;

drop view if exists public.v_visual_asset_publication_readiness;
create view public.v_visual_asset_publication_readiness as
select id, asset_key, asset_status, surface_area, image_role, source_url, public_url,
       thumbnail_url, alt_text, consent_status, compression_status, route_key,
       pixel_width, pixel_height, file_size_bytes, mime_type, placeholder_selector,
       replacement_status, readiness_score,
       case when coalesce(public_url, source_url) is not null
              and length(coalesce(alt_text,'')) >= 12
              and consent_status in ('approved','not_required')
              and compression_status in ('ready','optimized')
              and coalesce(pixel_width, 0) >= 800
              and coalesce(pixel_height, 0) >= 450
            then true else false end as publication_ready,
       created_at, updated_at
from public.visual_asset_approval_items
order by updated_at desc;

drop view if exists public.v_public_route_publication_readiness;
create view public.v_public_route_publication_readiness as
select r.id, r.route_key, r.route_status, r.route_type, r.route_path,
       r.service_name, r.location_name, r.page_title, r.h1_text,
       r.meta_description, r.page_intro, r.local_proof_hint,
       r.primary_cta_path, r.visual_asset_key, r.canonical_url,
       r.sitemap_ready, r.seo_readiness_score, r.validation_json,
       r.published_at, r.sitemap_entry_id,
       case when r.route_status = 'approved'
              and length(coalesce(r.page_title,'')) between 20 and 70
              and length(coalesce(r.h1_text,'')) between 10 and 120
              and length(coalesce(r.meta_description,'')) between 70 and 170
              and length(coalesce(r.local_proof_hint,'')) >= 20
              and coalesce(r.primary_cta_path,'') <> ''
              and exists (
                select 1 from public.visual_asset_approval_items a
                where a.asset_key = r.visual_asset_key
                  and a.asset_status = 'approved'
                  and coalesce(a.public_url, a.source_url) is not null
              )
            then true else false end as publication_ready,
       r.created_at, r.updated_at
from public.public_route_approval_items r
order by r.updated_at desc;

drop view if exists public.v_customer_portal_quote_directory;
create view public.v_customer_portal_quote_directory as
select qp.id as quote_package_id, qp.public_token, qp.portal_enabled,
       qp.package_status, qp.send_status, qp.client_email, qp.rendered_title,
       qp.first_viewed_at, qp.last_viewed_at, qp.open_count, qp.last_client_action,
       qp.rendered_html, qp.rendered_markdown, qp.accepted_at, qp.accepted_by_name,
       qp.accepted_by_email, qp.deposit_required_amount, qp.deposit_status,
       e.id as estimate_id, e.estimate_number, e.status as estimate_status,
       e.subtotal, e.tax_total, e.total_amount, e.valid_until,
       c.id as client_id, c.legal_name as client_name,
       wo.id as work_order_id, wo.work_order_number, wo.status as work_order_status,
       wo.scheduled_start, wo.scheduled_end,
       ds.schedule_status, ds.customer_notification_status,
       d.id as latest_deposit_request_id, d.deposit_status as latest_deposit_status,
       d.requested_amount as latest_deposit_amount, d.paid_amount as latest_paid_amount,
       d.receipt_url
from public.estimate_quote_packages qp
join public.estimates e on e.id = qp.estimate_id
left join public.clients c on c.id = e.client_id
left join lateral (
  select w.* from public.work_orders w where w.estimate_id = e.id order by w.created_at desc limit 1
) wo on true
left join lateral (
  select s.* from public.dispatch_schedule_items s where s.work_order_id = wo.id order by s.created_at desc limit 1
) ds on true
left join lateral (
  select dep.* from public.customer_deposit_requests dep where dep.quote_package_id = qp.id order by dep.created_at desc limit 1
) d on true;

drop view if exists public.v_live_job_cost_dashboard;
create view public.v_live_job_cost_dashboard as
select distinct on (s.job_id)
       s.id, s.job_id, j.job_code, j.job_name, s.work_order_id,
       s.estimate_total, s.revenue_total, s.labour_cost_total,
       s.material_cost_total, s.equipment_cost_total, s.subcontract_cost_total,
       s.other_cost_total, s.total_cost, s.margin_amount, s.margin_percent,
       s.snapshot_status, s.calculated_at
from public.job_cost_live_snapshots s
join public.jobs j on j.id = s.job_id
order by s.job_id, s.calculated_at desc;

-- Scorecard movement after implementation depth.
update public.admin_scorecard_progress_rails
set progress_percent = case rail_key
  when 'quote_intake_live' then greatest(progress_percent, 90)
  when 'payment_actions_live' then greatest(progress_percent, 85)
  when 'bank_csv_preview_live' then greatest(progress_percent, 85)
  when 'equipment_scan_custody_live' then greatest(progress_percent, 85)
  when 'route_asset_approval_live' then greatest(progress_percent, 85)
  when 'operations_cockpit_live' then greatest(progress_percent, 88)
  else progress_percent end,
  metadata = coalesce(metadata, '{}'::jsonb) || '{"build":"2026-06-17b","schema":150,"end_to_end":true}'::jsonb,
  updated_at = now();

insert into public.admin_scorecard_progress_rails (
  rail_key, rail_area, rail_title, rail_status, progress_percent,
  current_value, target_value, next_action_hint, owner_hint, sort_order, metadata
) values
('customer_portal_live','growth','Customer portal, acceptance, deposit, dispatch, and job cost','active',75,5,7,'Configure Stripe secrets, test portal acceptance, create a deposit checkout, dispatch a work order, and refresh live job cost.','Admin / sales / dispatch',60,'{"build":"2026-06-17b","schema":150}'::jsonb),
('approved_route_generation','seo_visual','Approved route page and sitemap generation','active',80,4,5,'Approve one route with an approved visual, publish it, then run the sitemap generator during deployment.','Content / admin',70,'{"build":"2026-06-17b","schema":150}'::jsonb)
on conflict (rail_key) do update set
  rail_area=excluded.rail_area, rail_title=excluded.rail_title,
  rail_status=excluded.rail_status, progress_percent=excluded.progress_percent,
  current_value=excluded.current_value, target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint, owner_hint=excluded.owner_hint,
  sort_order=excluded.sort_order, metadata=excluded.metadata, updated_at=now();

-- Schema marker.
drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select 150::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 150 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 150
       then 'Live database is at or ahead of the repo schema marker.'
       else 'Live database is behind the deployed app. Apply migrations through schema 150.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version, migration_key, schema_name, release_label, description, status, notes
) values (
  150,
  '150_end_to_end_operations_customer_portal_media_route_publication',
  '150_end_to_end_operations_customer_portal_media_route_publication.sql',
  '2026-06-17b',
  'Adds live queues, real AR/AP and journal posting linkage, bank promotion, explainable reconciliation, equipment service/cost recovery, image metadata, route/sitemap publication, quote ownership, customer portal, deposits, dispatch, and live job-cost snapshots.',
  'applied',
  'This pass closes the highest-value schema 149 gaps while preserving approval, proof, period-lock, mobile fallback, and SEO publication gates.'
)
on conflict (schema_version) do update set
  migration_key=excluded.migration_key, schema_name=excluded.schema_name,
  release_label=excluded.release_label, description=excluded.description,
  status=excluded.status, notes=excluded.notes, applied_at=now();

-- Access is primarily through Edge Functions; authenticated read access supports Admin views.
grant select on public.quote_followup_alerts to authenticated;
grant select on public.reconciliation_match_allocations to authenticated;
grant select on public.equipment_cost_recovery_actions to authenticated;
grant select on public.public_sitemap_entries to authenticated, anon;
grant select on public.customer_portal_events to authenticated;
grant select on public.customer_deposit_requests to authenticated;
grant select on public.dispatch_schedule_items to authenticated;
grant select on public.job_cost_live_snapshots to authenticated;
grant select on public.v_quote_contact_followup_queue to authenticated;
grant select on public.v_payment_action_workbench to authenticated;
grant select on public.v_bank_csv_import_workbench to authenticated;
grant select on public.v_reconciliation_action_workbench to authenticated;
grant select on public.v_equipment_scan_resolution_queue to authenticated;
grant select on public.v_equipment_service_cost_recovery_queue to authenticated;
grant select on public.v_visual_asset_publication_readiness to authenticated;
grant select on public.v_public_route_publication_readiness to authenticated;
grant select on public.v_customer_portal_quote_directory to authenticated;
grant select on public.v_live_job_cost_dashboard to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
