-- Schema 124: Accounting depth and equipment accountability pass.
-- Adds deeper job-cost categories, payment application review fields,
-- reconciliation review workbench metadata, remittance/filing signoff proof,
-- month-end lock/reopen handoff fields, QR/barcode equipment lookup,
-- accessory checklist tracking, and automatic service-task candidates.

begin;

create extension if not exists pgcrypto;

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

alter table if exists public.job_financial_events
  add column if not exists cost_category text,
  add column if not exists billable_charge_status text not null default 'not_billable',
  add column if not exists source_equipment_item_id bigint references public.equipment_items(id) on delete set null,
  add column if not exists source_signout_id bigint references public.equipment_signouts(id) on delete set null,
  add column if not exists accounting_period_close_id uuid references public.accounting_period_closes(id) on delete set null,
  add column if not exists posting_status text not null default 'draft',
  add column if not exists profitability_notes text;

alter table if exists public.job_financial_events drop constraint if exists job_financial_events_type_check;
alter table if exists public.job_financial_events
  add constraint job_financial_events_type_check
  check (event_type in (
    'material',
    'equipment_usage',
    'equipment_repair',
    'equipment_replacement',
    'delay',
    'fuel',
    'travel',
    'subcontract',
    'disposal',
    'permit',
    'revenue_adjustment',
    'discount_adjustment',
    'writeoff_adjustment',
    'other'
  ));

alter table if exists public.job_financial_events drop constraint if exists job_financial_events_billable_charge_status_check;
alter table if exists public.job_financial_events
  add constraint job_financial_events_billable_charge_status_check
  check (billable_charge_status in ('not_billable','billable','billed','written_off','review'));

alter table if exists public.job_financial_events drop constraint if exists job_financial_events_posting_status_check;
alter table if exists public.job_financial_events
  add constraint job_financial_events_posting_status_check
  check (posting_status in ('draft','review','approved','posted','void'));

create index if not exists idx_job_financial_events_cost_category
  on public.job_financial_events(cost_category, event_type, event_date desc);
create index if not exists idx_job_financial_events_source_equipment
  on public.job_financial_events(source_equipment_item_id, event_date desc);
create index if not exists idx_job_financial_events_period
  on public.job_financial_events(accounting_period_close_id, posting_status, event_date desc);

alter table if exists public.ar_payment_applications
  add column if not exists application_type text not null default 'invoice_payment',
  add column if not exists credit_amount numeric(12,2) not null default 0,
  add column if not exists discount_amount numeric(12,2) not null default 0,
  add column if not exists writeoff_amount numeric(12,2) not null default 0,
  add column if not exists overpayment_amount numeric(12,2) not null default 0,
  add column if not exists review_status text not null default 'draft',
  add column if not exists reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists source_reconciliation_item_id uuid references public.bank_reconciliation_items(id) on delete set null,
  add column if not exists application_payload jsonb not null default '{}'::jsonb;

alter table if exists public.ar_payment_applications drop constraint if exists ar_payment_applications_application_type_check;
alter table if exists public.ar_payment_applications
  add constraint ar_payment_applications_application_type_check
  check (application_type in ('invoice_payment','deposit','credit','discount','writeoff','overpayment','refund','other'));

alter table if exists public.ar_payment_applications drop constraint if exists ar_payment_applications_review_status_check;
alter table if exists public.ar_payment_applications
  add constraint ar_payment_applications_review_status_check
  check (review_status in ('draft','review','approved','posted','reversed','exception'));

alter table if exists public.ap_payment_applications
  add column if not exists application_type text not null default 'bill_payment',
  add column if not exists credit_amount numeric(12,2) not null default 0,
  add column if not exists discount_amount numeric(12,2) not null default 0,
  add column if not exists writeoff_amount numeric(12,2) not null default 0,
  add column if not exists overpayment_amount numeric(12,2) not null default 0,
  add column if not exists review_status text not null default 'draft',
  add column if not exists reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists source_reconciliation_item_id uuid references public.bank_reconciliation_items(id) on delete set null,
  add column if not exists application_payload jsonb not null default '{}'::jsonb;

alter table if exists public.ap_payment_applications drop constraint if exists ap_payment_applications_application_type_check;
alter table if exists public.ap_payment_applications
  add constraint ap_payment_applications_application_type_check
  check (application_type in ('bill_payment','deposit','credit','discount','writeoff','overpayment','refund','other'));

alter table if exists public.ap_payment_applications drop constraint if exists ap_payment_applications_review_status_check;
alter table if exists public.ap_payment_applications
  add constraint ap_payment_applications_review_status_check
  check (review_status in ('draft','review','approved','posted','reversed','exception'));

create index if not exists idx_ar_payment_applications_review
  on public.ar_payment_applications(review_status, application_date desc, created_at desc);
create index if not exists idx_ap_payment_applications_review
  on public.ap_payment_applications(review_status, application_date desc, created_at desc);

alter table if exists public.bank_reconciliation_items
  add column if not exists import_row_number integer,
  add column if not exists raw_description text,
  add column if not exists suggested_match_source_table text,
  add column if not exists suggested_match_source_id text,
  add column if not exists suggested_match_score numeric(7,2),
  add column if not exists suggested_match_reason text,
  add column if not exists manual_review_status text not null default 'needs_review',
  add column if not exists reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists undo_of_item_id uuid references public.bank_reconciliation_items(id) on delete set null,
  add column if not exists review_notes text;

alter table if exists public.bank_reconciliation_items drop constraint if exists bank_reconciliation_items_manual_review_status_check;
alter table if exists public.bank_reconciliation_items
  add constraint bank_reconciliation_items_manual_review_status_check
  check (manual_review_status in ('needs_review','suggested','manual_match','approved','undo','exception','ignored'));

create index if not exists idx_bank_reconciliation_items_manual_review
  on public.bank_reconciliation_items(manual_review_status, match_status, item_date desc);

alter table if exists public.sales_tax_filings
  add column if not exists source_totals_jsonb jsonb not null default '{}'::jsonb,
  add column if not exists adjustment_notes text,
  add column if not exists export_proof_url text,
  add column if not exists signed_off_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists signed_off_at timestamptz,
  add column if not exists filed_reference text,
  add column if not exists filing_review_step text not null default 'source_review';

alter table if exists public.sales_tax_filings drop constraint if exists sales_tax_filings_review_step_check;
alter table if exists public.sales_tax_filings
  add constraint sales_tax_filings_review_step_check
  check (filing_review_step in ('source_review','adjustment_review','approved','filed','paid','exception'));

alter table if exists public.payroll_remittance_runs
  add column if not exists source_totals_jsonb jsonb not null default '{}'::jsonb,
  add column if not exists adjustment_notes text,
  add column if not exists export_proof_url text,
  add column if not exists signed_off_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists signed_off_at timestamptz,
  add column if not exists filed_reference text,
  add column if not exists remittance_review_step text not null default 'source_review';

alter table if exists public.payroll_remittance_runs drop constraint if exists payroll_remittance_runs_review_step_check;
alter table if exists public.payroll_remittance_runs
  add constraint payroll_remittance_runs_review_step_check
  check (remittance_review_step in ('source_review','adjustment_review','approved','remitted','paid','exception'));

alter table if exists public.accounting_period_closes
  add column if not exists period_lock_status text not null default 'open',
  add column if not exists locked_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists locked_at timestamptz,
  add column if not exists reopened_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reopened_at timestamptz,
  add column if not exists reopen_reason text,
  add column if not exists accountant_package_export_id uuid references public.accountant_handoff_exports(id) on delete set null,
  add column if not exists close_package_manifest jsonb not null default '{}'::jsonb;

alter table if exists public.accounting_period_closes drop constraint if exists accounting_period_closes_period_lock_status_check;
alter table if exists public.accounting_period_closes
  add constraint accounting_period_closes_period_lock_status_check
  check (period_lock_status in ('open','soft_locked','locked','reopened'));

alter table if exists public.accountant_handoff_exports
  add column if not exists source_period_close_id uuid references public.accounting_period_closes(id) on delete set null,
  add column if not exists exported_file_manifest jsonb not null default '[]'::jsonb,
  add column if not exists package_delivery_reference text,
  add column if not exists finalized_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists delivered_by_profile_id uuid references public.profiles(id) on delete set null;

alter table if exists public.equipment_items
  add column if not exists qr_code_value text,
  add column if not exists barcode_value text,
  add column if not exists verifier_role_required text not null default 'supervisor',
  add column if not exists accessory_checklist_required boolean not null default false;

alter table if exists public.equipment_items drop constraint if exists equipment_items_verifier_role_required_check;
alter table if exists public.equipment_items
  add constraint equipment_items_verifier_role_required_check
  check (verifier_role_required in ('site_leader','supervisor','job_admin','admin'));

create unique index if not exists idx_equipment_items_qr_code_value
  on public.equipment_items(qr_code_value) where qr_code_value is not null;
create unique index if not exists idx_equipment_items_barcode_value
  on public.equipment_items(barcode_value) where barcode_value is not null;

create table if not exists public.equipment_accessory_checklists (
  id uuid primary key default gen_random_uuid(),
  equipment_item_id bigint references public.equipment_items(id) on delete cascade,
  equipment_pool_key text,
  checklist_name text not null,
  required_accessories jsonb not null default '[]'::jsonb,
  safety_items jsonb not null default '[]'::jsonb,
  default_notes text,
  is_active boolean not null default true,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_equipment_accessory_checklists_equipment
  on public.equipment_accessory_checklists(equipment_item_id, is_active, checklist_name);
create index if not exists idx_equipment_accessory_checklists_pool
  on public.equipment_accessory_checklists(equipment_pool_key, is_active, checklist_name);

alter table if exists public.equipment_signouts
  add column if not exists checkout_accessory_checklist jsonb not null default '[]'::jsonb,
  add column if not exists arrival_accessory_checklist jsonb not null default '[]'::jsonb,
  add column if not exists return_accessory_checklist jsonb not null default '[]'::jsonb,
  add column if not exists checkout_accessory_status text not null default 'not_recorded',
  add column if not exists arrival_accessory_status text not null default 'not_recorded',
  add column if not exists return_accessory_status text not null default 'not_recorded',
  add column if not exists accessory_missing_notes text;

alter table if exists public.equipment_signouts drop constraint if exists equipment_signouts_checkout_accessory_status_check;
alter table if exists public.equipment_signouts
  add constraint equipment_signouts_checkout_accessory_status_check
  check (checkout_accessory_status in ('not_recorded','complete','missing','damaged','not_required'));

alter table if exists public.equipment_signouts drop constraint if exists equipment_signouts_arrival_accessory_status_check;
alter table if exists public.equipment_signouts
  add constraint equipment_signouts_arrival_accessory_status_check
  check (arrival_accessory_status in ('not_recorded','complete','missing','damaged','not_required'));

alter table if exists public.equipment_signouts drop constraint if exists equipment_signouts_return_accessory_status_check;
alter table if exists public.equipment_signouts
  add constraint equipment_signouts_return_accessory_status_check
  check (return_accessory_status in ('not_recorded','complete','missing','damaged','not_required'));

create table if not exists public.equipment_service_tasks (
  id uuid primary key default gen_random_uuid(),
  equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  source_signout_id bigint references public.equipment_signouts(id) on delete set null,
  source_event_id bigint references public.equipment_transfer_verification_events(id) on delete set null,
  job_id bigint references public.jobs(id) on delete set null,
  task_type text not null default 'return_test_followup',
  task_status text not null default 'open',
  priority text not null default 'normal',
  failure_reason text,
  estimated_cost numeric(12,2) not null default 0,
  actual_cost numeric(12,2) not null default 0,
  assigned_to_profile_id uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  resolved_at timestamptz,
  resolved_by_profile_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.equipment_service_tasks drop constraint if exists equipment_service_tasks_type_check;
alter table if exists public.equipment_service_tasks
  add constraint equipment_service_tasks_type_check
  check (task_type in ('arrival_test_followup','return_test_followup','repair','cleaning','inspection','replacement','accessory_missing','custom'));

alter table if exists public.equipment_service_tasks drop constraint if exists equipment_service_tasks_status_check;
alter table if exists public.equipment_service_tasks
  add constraint equipment_service_tasks_status_check
  check (task_status in ('open','assigned','waiting_parts','in_progress','resolved','cancelled'));

create index if not exists idx_equipment_service_tasks_equipment
  on public.equipment_service_tasks(equipment_item_id, task_status, created_at desc);
create index if not exists idx_equipment_service_tasks_job
  on public.equipment_service_tasks(job_id, task_status, created_at desc);

create or replace view public.v_job_cost_depth_directory as
with cost_rollup as (
  select
    job_id,
    coalesce(sum(cost_amount) filter (where event_type = 'equipment_usage'), 0)::numeric(12,2) as equipment_usage_cost_total,
    coalesce(sum(cost_amount) filter (where event_type = 'equipment_repair'), 0)::numeric(12,2) as equipment_repair_event_cost_total,
    coalesce(sum(cost_amount) filter (where event_type = 'equipment_replacement'), 0)::numeric(12,2) as equipment_replacement_cost_total,
    coalesce(sum(cost_amount) filter (where event_type = 'delay'), 0)::numeric(12,2) as delay_event_cost_total,
    coalesce(sum(cost_amount) filter (where event_type = 'fuel'), 0)::numeric(12,2) as fuel_cost_total,
    coalesce(sum(cost_amount) filter (where event_type = 'disposal'), 0)::numeric(12,2) as disposal_cost_total,
    coalesce(sum(cost_amount) filter (where event_type = 'subcontract'), 0)::numeric(12,2) as subcontract_cost_total,
    coalesce(sum(cost_amount) filter (where event_type = 'material'), 0)::numeric(12,2) as material_cost_total,
    coalesce(sum(cost_amount), 0)::numeric(12,2) as financial_event_cost_total,
    coalesce(sum(revenue_amount), 0)::numeric(12,2) as financial_event_revenue_total,
    count(*)::int as cost_event_count
  from public.job_financial_events
  group by job_id
)
select
  j.id as job_id,
  j.job_code,
  j.job_name,
  j.client_name,
  j.status,
  j.start_date,
  j.end_date,
  coalesce(j.estimated_cost_total, 0)::numeric(12,2) as estimated_cost_total,
  coalesce(j.quoted_charge_total, 0)::numeric(12,2) as quoted_charge_total,
  coalesce(j.actual_cost_total, 0)::numeric(12,2) as actual_cost_total,
  coalesce(j.actual_charge_total, 0)::numeric(12,2) as actual_charge_total,
  coalesce(j.delay_cost_total, 0)::numeric(12,2) as job_delay_cost_total,
  coalesce(j.equipment_repair_cost_total, 0)::numeric(12,2) as job_equipment_repair_cost_total,
  coalesce(cr.equipment_usage_cost_total, 0)::numeric(12,2) as equipment_usage_cost_total,
  coalesce(cr.equipment_repair_event_cost_total, 0)::numeric(12,2) as equipment_repair_event_cost_total,
  coalesce(cr.equipment_replacement_cost_total, 0)::numeric(12,2) as equipment_replacement_cost_total,
  coalesce(cr.delay_event_cost_total, 0)::numeric(12,2) as delay_event_cost_total,
  coalesce(cr.fuel_cost_total, 0)::numeric(12,2) as fuel_cost_total,
  coalesce(cr.disposal_cost_total, 0)::numeric(12,2) as disposal_cost_total,
  coalesce(cr.subcontract_cost_total, 0)::numeric(12,2) as subcontract_cost_total,
  coalesce(cr.material_cost_total, 0)::numeric(12,2) as material_cost_total,
  (coalesce(j.actual_cost_total, 0) + coalesce(j.delay_cost_total, 0) + coalesce(j.equipment_repair_cost_total, 0) + coalesce(cr.financial_event_cost_total, 0))::numeric(12,2) as total_known_cost,
  (coalesce(j.actual_charge_total, 0) + coalesce(cr.financial_event_revenue_total, 0))::numeric(12,2) as total_known_revenue,
  ((coalesce(j.actual_charge_total, 0) + coalesce(cr.financial_event_revenue_total, 0)) - (coalesce(j.actual_cost_total, 0) + coalesce(j.delay_cost_total, 0) + coalesce(j.equipment_repair_cost_total, 0) + coalesce(cr.financial_event_cost_total, 0)))::numeric(12,2) as known_profit_total,
  coalesce(cr.cost_event_count, 0)::int as cost_event_count
from public.jobs j
left join cost_rollup cr on cr.job_id = j.id;

create or replace view public.v_payment_application_workbench_directory as
select
  'ar'::text as ledger_side,
  a.id,
  a.payment_id,
  a.invoice_id as target_id,
  i.invoice_number as target_number,
  c.legal_name as party_name,
  p.payment_number,
  p.payment_date,
  p.amount as payment_amount,
  a.applied_amount,
  a.credit_amount,
  a.discount_amount,
  a.writeoff_amount,
  a.overpayment_amount,
  a.application_type,
  a.application_status,
  a.review_status,
  a.application_date,
  a.notes,
  reviewer.full_name as reviewed_by_name,
  a.reviewed_at
from public.ar_payment_applications a
left join public.ar_payments p on p.id = a.payment_id
left join public.ar_invoices i on i.id = a.invoice_id
left join public.clients c on c.id = p.client_id
left join public.profiles reviewer on reviewer.id = a.reviewed_by_profile_id
union all
select
  'ap'::text as ledger_side,
  a.id,
  a.payment_id,
  a.bill_id as target_id,
  b.bill_number as target_number,
  v.legal_name as party_name,
  p.payment_number,
  p.payment_date,
  p.amount as payment_amount,
  a.applied_amount,
  a.credit_amount,
  a.discount_amount,
  a.writeoff_amount,
  a.overpayment_amount,
  a.application_type,
  a.application_status,
  a.review_status,
  a.application_date,
  a.notes,
  reviewer.full_name as reviewed_by_name,
  a.reviewed_at
from public.ap_payment_applications a
left join public.ap_payments p on p.id = a.payment_id
left join public.ap_bills b on b.id = a.bill_id
left join public.ap_vendors v on v.id = p.vendor_id
left join public.profiles reviewer on reviewer.id = a.reviewed_by_profile_id;

create or replace view public.v_bank_reconciliation_review_workbench as
select
  i.id,
  s.session_code,
  ba.account_name,
  i.item_date,
  i.item_description,
  coalesce(i.raw_description, i.item_description) as raw_description,
  i.amount,
  i.item_source_type,
  i.match_status,
  i.clearing_status,
  i.suggested_match_score,
  i.suggested_match_reason,
  i.suggested_match_source_table,
  i.suggested_match_source_id,
  i.manual_review_status,
  i.review_notes,
  reviewer.full_name as reviewed_by_name,
  i.reviewed_at,
  i.import_row_number,
  i.reconciliation_session_id
from public.bank_reconciliation_items i
left join public.bank_reconciliation_sessions s on s.id = i.reconciliation_session_id
left join public.bank_accounts ba on ba.id = s.bank_account_id
left join public.profiles reviewer on reviewer.id = i.reviewed_by_profile_id;

create or replace view public.v_remittance_filing_review_workbench as
select
  'sales_tax'::text as review_kind,
  s.id,
  s.filing_code as record_code,
  s.filing_period_start as period_start,
  s.filing_period_end as period_end,
  s.due_date,
  s.filing_status as status,
  s.review_status,
  s.filing_review_step as review_step,
  s.taxable_sales_total as source_base_total,
  s.tax_collected_total,
  s.tax_paid_total,
  s.adjustment_total,
  s.net_remittance_total,
  s.reference_number,
  s.filed_reference,
  s.export_proof_url,
  reviewer.full_name as reviewed_by_name,
  s.reviewed_at,
  signer.full_name as signed_off_by_name,
  s.signed_off_at,
  s.review_notes,
  s.adjustment_notes
from public.sales_tax_filings s
left join public.profiles reviewer on reviewer.id = s.reviewed_by_profile_id
left join public.profiles signer on signer.id = s.signed_off_by_profile_id
union all
select
  'payroll'::text as review_kind,
  r.id,
  r.remittance_code as record_code,
  r.remittance_period_start as period_start,
  r.remittance_period_end as period_end,
  r.due_date,
  r.remittance_status as status,
  r.review_status,
  r.remittance_review_step as review_step,
  r.gross_pay_total as source_base_total,
  0::numeric(12,2) as tax_collected_total,
  0::numeric(12,2) as tax_paid_total,
  0::numeric(12,2) as adjustment_total,
  r.net_remittance_total,
  r.reference_number,
  r.filed_reference,
  r.export_proof_url,
  reviewer.full_name as reviewed_by_name,
  r.reviewed_at,
  signer.full_name as signed_off_by_name,
  r.signed_off_at,
  r.review_notes,
  r.adjustment_notes
from public.payroll_remittance_runs r
left join public.profiles reviewer on reviewer.id = r.reviewed_by_profile_id
left join public.profiles signer on signer.id = r.signed_off_by_profile_id;

create or replace view public.v_month_end_close_workbench as
select
  c.id,
  c.period_code,
  c.period_start,
  c.period_end,
  c.close_scope,
  c.close_status,
  c.period_lock_status,
  c.ar_locked,
  c.ap_locked,
  c.gl_locked,
  c.payroll_locked,
  c.tax_locked,
  c.close_notes,
  c.close_package_manifest,
  c.locked_at,
  locker.full_name as locked_by_name,
  c.reopened_at,
  reopener.full_name as reopened_by_name,
  c.reopen_reason,
  c.closed_at,
  closer.full_name as closed_by_name,
  c.accountant_package_export_id,
  ah.export_title as accountant_package_title,
  ah.package_status as accountant_package_status
from public.accounting_period_closes c
left join public.profiles locker on locker.id = c.locked_by_profile_id
left join public.profiles reopener on reopener.id = c.reopened_by_profile_id
left join public.profiles closer on closer.id = c.closed_by_profile_id
left join public.accountant_handoff_exports ah on ah.id = c.accountant_package_export_id;

create or replace view public.v_equipment_accountability_workbench as
select
  e.id as equipment_item_id,
  e.equipment_code,
  e.equipment_name,
  e.status,
  e.qr_code_value,
  e.barcode_value,
  e.verifier_role_required,
  e.accessory_checklist_required,
  e.last_transfer_status,
  e.last_return_test_status,
  e.is_locked_out,
  coalesce(ac.checklist_count, 0)::int as active_checklist_count,
  coalesce(st.open_service_task_count, 0)::int as open_service_task_count,
  coalesce(st.open_estimated_cost_total, 0)::numeric(12,2) as open_estimated_service_cost_total,
  cur.site_name as current_site_name,
  target.site_name as target_site_name
from public.equipment_items e
left join public.sites cur on cur.id = e.current_site_id
left join public.sites target on target.id = e.target_site_id
left join (
  select equipment_item_id, count(*)::int as checklist_count
  from public.equipment_accessory_checklists
  where is_active = true and equipment_item_id is not null
  group by equipment_item_id
) ac on ac.equipment_item_id = e.id
left join (
  select equipment_item_id, count(*)::int as open_service_task_count, coalesce(sum(estimated_cost), 0)::numeric(12,2) as open_estimated_cost_total
  from public.equipment_service_tasks
  where task_status in ('open','assigned','waiting_parts','in_progress')
  group by equipment_item_id
) st on st.equipment_item_id = e.id;

create or replace view public.v_equipment_service_task_directory as
select
  t.id,
  t.equipment_item_id,
  e.equipment_code,
  e.equipment_name,
  t.source_signout_id,
  t.job_id,
  j.job_code,
  j.job_name,
  t.task_type,
  t.task_status,
  t.priority,
  t.failure_reason,
  t.estimated_cost,
  t.actual_cost,
  assignee.full_name as assigned_to_name,
  t.due_at,
  t.resolved_at,
  resolver.full_name as resolved_by_name,
  t.notes,
  t.created_at,
  t.updated_at
from public.equipment_service_tasks t
left join public.equipment_items e on e.id = t.equipment_item_id
left join public.jobs j on j.id = t.job_id
left join public.profiles assignee on assignee.id = t.assigned_to_profile_id
left join public.profiles resolver on resolver.id = t.resolved_by_profile_id;

insert into public.app_operational_depth_gates (
  gate_key,
  gate_area,
  gate_title,
  gate_status,
  owner_hint,
  route_hint,
  test_hint,
  failure_hint,
  sort_order,
  checked_at
)
values
  ('accounting_job_cost_depth_breakdown', 'accounting', 'Job profitability includes usage, repair, replacement, fuel, disposal, materials, delay, and subcontract cost buckets', 'passed', 'Admin / Accountant', '#jobs', 'Load Jobs and review the Job Cost Depth table.', 'Do not close month-end until each cost bucket has a source and review status.', 61, now()),
  ('payment_application_workbench_review', 'accounting', 'Payment application review can separate invoices/bills, deposits, credits, discounts, write-offs, and overpayments', 'passed', 'Admin / Accountant', '#jobs', 'Load the Accounting Depth tables and review payment application rows.', 'Unreviewed or exception applications should block period close.', 62, now()),
  ('bank_reconciliation_manual_review', 'accounting', 'Bank reconciliation rows have match score, manual review, undo, and exception metadata', 'passed', 'Admin / Accountant', '#jobs', 'Review the Bank Reconciliation table for suggested score and manual review status.', 'Rows in needs_review/exception should remain close blockers.', 63, now()),
  ('tax_payroll_review_signoff', 'accounting', 'HST/GST and payroll remittance rows capture source totals, adjustment notes, signoff, filing/remittance reference, and export proof', 'passed', 'Admin / Accountant', '#jobs', 'Review the Remittance and Filing table before final package export.', 'Missing proof or signoff should block close.', 64, now()),
  ('month_end_lock_and_package', 'accounting', 'Month-end close has lock/reopen status and accountant package linkage', 'passed', 'Admin / Accountant', '#jobs', 'Review the Month-End Close table for lock status and export package.', 'Reopened periods need reason and reviewer.', 65, now()),
  ('equipment_qr_accessory_service_tasks', 'equipment', 'Equipment supports QR/barcode lookup, accessory checklist status, verifier role requirement, and service-task follow-up', 'passed', 'Supervisor / Site Leader', '#equipment', 'Review the Equipment Accountability and Service Task tables after a failed arrival/return test.', 'Failed tests should keep equipment locked out until a service task is resolved.', 66, now())
on conflict (gate_key) do update set
  gate_area = excluded.gate_area,
  gate_title = excluded.gate_title,
  gate_status = excluded.gate_status,
  owner_hint = excluded.owner_hint,
  route_hint = excluded.route_hint,
  test_hint = excluded.test_hint,
  failure_hint = excluded.failure_hint,
  sort_order = excluded.sort_order,
  checked_at = excluded.checked_at,
  updated_at = now();

drop view if exists public.v_schema_drift_status;
create view public.v_schema_drift_status as
select
  124::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status = 'applied'), 0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 124
      then 'current'
    else 'behind'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter (where status = 'applied'), 0) >= 124
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 124.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions (
  schema_version,
  migration_key,
  schema_name,
  release_label,
  description,
  status,
  notes
)
values (
  124,
  '124_accounting_cost_payment_reconciliation_remittance_equipment_depth',
  '124_accounting_cost_payment_reconciliation_remittance_equipment_depth.sql',
  '2026-05-30a',
  'Adds deeper accounting cost buckets, payment application review, reconciliation review, tax/payroll signoff proof, month-end close lock/package fields, and equipment QR/accessory/service-task accountability.',
  'applied',
  'This pass makes the remaining depth gaps visible in workbench views and prepares UI/API surfaces for payment application, reconciliation review, remittance signoff, month-end close, and equipment service follow-up.'
)
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

grant select on public.v_job_cost_depth_directory to authenticated;
grant select on public.v_payment_application_workbench_directory to authenticated;
grant select on public.v_bank_reconciliation_review_workbench to authenticated;
grant select on public.v_remittance_filing_review_workbench to authenticated;
grant select on public.v_month_end_close_workbench to authenticated;
grant select on public.v_equipment_accountability_workbench to authenticated;
grant select on public.v_equipment_service_task_directory to authenticated;
grant select on public.equipment_accessory_checklists to authenticated;
grant select on public.equipment_service_tasks to authenticated;
grant select on public.v_schema_drift_status to authenticated;

commit;
