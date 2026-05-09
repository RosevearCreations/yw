-- 101_accounting_posting_automation_and_export_bundle.sql
-- Extends the accounting-close foundation into a more actionable workflow:
-- - job invoice postings can link to real AR invoices
-- - job journal postings can link to real GL journal batches
-- - sales tax prep and payroll remittance prep directories
-- - bank reconciliation match candidates
-- - accountant handoff export bundles and bundle items

alter table if exists public.job_invoice_postings
  add column if not exists ar_invoice_id uuid references public.ar_invoices(id) on delete set null,
  add column if not exists posting_message text;

alter table if exists public.job_journal_postings
  add column if not exists gl_batch_id uuid references public.gl_journal_batches(id) on delete set null,
  add column if not exists posting_message text;

alter table if exists public.accountant_handoff_exports
  add column if not exists bundle_kind text not null default 'management_close_bundle',
  add column if not exists delivery_channel text not null default 'manual',
  add column if not exists delivered_to_email text,
  add column if not exists bundle_item_count integer not null default 0,
  add column if not exists bundle_payload jsonb not null default '{}'::jsonb;

alter table if exists public.accountant_handoff_exports
  drop constraint if exists accountant_handoff_exports_bundle_kind_check;
alter table if exists public.accountant_handoff_exports
  add constraint accountant_handoff_exports_bundle_kind_check
  check (bundle_kind in ('management_close_bundle','corp_t2_bundle','llc_review_bundle','custom'));

alter table if exists public.accountant_handoff_exports
  drop constraint if exists accountant_handoff_exports_delivery_channel_check;
alter table if exists public.accountant_handoff_exports
  add constraint accountant_handoff_exports_delivery_channel_check
  check (delivery_channel in ('manual','email','download'));

create table if not exists public.accountant_handoff_export_items (
  id uuid primary key default gen_random_uuid(),
  export_id uuid not null references public.accountant_handoff_exports(id) on delete cascade,
  item_kind text not null,
  item_label text not null,
  source_type text,
  source_id text,
  item_order integer not null default 100,
  item_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_accountant_handoff_export_items_export
  on public.accountant_handoff_export_items(export_id, item_order, created_at);

create or replace view public.v_job_invoice_posting_automation_directory as
select
  p.id,
  p.invoice_candidate_id,
  c.completion_review_id,
  c.job_id,
  c.job_code,
  c.job_name,
  c.candidate_number,
  c.candidate_status,
  c.client_id,
  c.client_name,
  c.total_amount,
  p.ar_ap_queue_id,
  q.queue_status,
  p.posting_status,
  p.external_system,
  p.external_invoice_number,
  p.ar_invoice_id,
  ai.invoice_number,
  ai.invoice_status,
  ai.invoice_date,
  ai.due_date,
  ai.balance_due,
  p.posting_message,
  p.posting_payload,
  p.posted_by_profile_id,
  coalesce(pp.full_name, pp.email, '') as posted_by_name,
  p.posted_at,
  p.created_at,
  p.updated_at
from public.job_invoice_postings p
left join public.v_job_invoice_candidate_directory c on c.id = p.invoice_candidate_id
left join public.job_ar_ap_review_queue q on q.id = p.ar_ap_queue_id
left join public.ar_invoices ai on ai.id = p.ar_invoice_id
left join public.profiles pp on pp.id = p.posted_by_profile_id;

create or replace view public.v_job_journal_posting_automation_directory as
select
  p.id,
  p.journal_candidate_id,
  c.completion_review_id,
  c.job_id,
  c.job_code,
  c.job_name,
  c.candidate_status,
  c.journal_memo,
  p.ar_ap_queue_id,
  q.queue_status,
  p.posting_status,
  p.external_system,
  p.journal_entry_number,
  p.batch_number,
  p.gl_batch_id,
  gjb.batch_number as gl_batch_number,
  gjb.batch_status as gl_batch_status,
  gjb.batch_date,
  gjb.line_count,
  gjb.debit_total,
  gjb.credit_total,
  gjb.is_balanced,
  p.posting_message,
  p.posting_payload,
  p.posted_by_profile_id,
  coalesce(pp.full_name, pp.email, '') as posted_by_name,
  p.posted_at,
  p.created_at,
  p.updated_at
from public.job_journal_postings p
left join public.v_job_journal_candidate_directory c on c.id = p.journal_candidate_id
left join public.job_ar_ap_review_queue q on q.id = p.ar_ap_queue_id
left join public.gl_journal_batches gjb on gjb.id = p.gl_batch_id
left join public.profiles pp on pp.id = p.posted_by_profile_id;

create or replace view public.v_sales_tax_prep_directory as
with sales as (
  select
    date_trunc('month', invoice_date::timestamp)::date as period_start,
    (date_trunc('month', invoice_date::timestamp) + interval '1 month - 1 day')::date as period_end,
    count(*)::int as invoice_count,
    coalesce(sum(subtotal), 0)::numeric(12,2) as taxable_sales_total,
    coalesce(sum(tax_total), 0)::numeric(12,2) as tax_collected_total
  from public.ar_invoices
  group by 1,2
), purchases as (
  select
    date_trunc('month', bill_date::timestamp)::date as period_start,
    (date_trunc('month', bill_date::timestamp) + interval '1 month - 1 day')::date as period_end,
    count(*)::int as bill_count,
    coalesce(sum(subtotal), 0)::numeric(12,2) as taxable_purchase_total,
    coalesce(sum(tax_total), 0)::numeric(12,2) as tax_paid_total
  from public.ap_bills
  group by 1,2
)
select
  coalesce(s.period_start, p.period_start) as period_start,
  coalesce(s.period_end, p.period_end) as period_end,
  coalesce(s.invoice_count, 0) as invoice_count,
  coalesce(p.bill_count, 0) as bill_count,
  coalesce(s.taxable_sales_total, 0)::numeric(12,2) as taxable_sales_total,
  coalesce(s.tax_collected_total, 0)::numeric(12,2) as tax_collected_total,
  coalesce(p.taxable_purchase_total, 0)::numeric(12,2) as taxable_purchase_total,
  coalesce(p.tax_paid_total, 0)::numeric(12,2) as tax_paid_total,
  (coalesce(s.tax_collected_total, 0) - coalesce(p.tax_paid_total, 0))::numeric(12,2) as suggested_net_remittance_total
from sales s
full outer join purchases p
  on p.period_start = s.period_start and p.period_end = s.period_end;

create or replace view public.v_payroll_remittance_prep_directory as
select
  per.period_start,
  per.period_end,
  count(*)::int as export_run_count,
  coalesce(sum(per.exported_entry_count), 0)::int as exported_entry_count,
  coalesce(sum(per.exported_hours_total), 0)::numeric(10,2) as exported_hours_total,
  coalesce(sum(per.exported_payroll_cost_total), 0)::numeric(12,2) as exported_payroll_cost_total,
  max(per.exported_at) as last_exported_at,
  max(per.delivery_confirmed_at) as last_delivery_confirmed_at
from public.payroll_export_runs per
group by per.period_start, per.period_end;

create or replace view public.v_bank_reconciliation_match_candidate_directory as
with unmatched as (
  select *
  from public.bank_reconciliation_items
  where coalesce(match_status, 'unmatched') <> 'matched'
)
select
  a.reconciliation_session_id,
  a.id as bank_item_id,
  a.item_source_type as bank_item_source_type,
  a.item_source_id as bank_item_source_id,
  a.item_date as bank_item_date,
  a.item_description as bank_item_description,
  a.amount as bank_item_amount,
  b.id as candidate_item_id,
  b.item_source_type as candidate_source_type,
  b.item_source_id as candidate_source_id,
  b.item_date as candidate_item_date,
  b.item_description as candidate_item_description,
  b.amount as candidate_amount,
  abs(coalesce(a.amount,0) - coalesce(b.amount,0))::numeric(12,2) as amount_difference,
  case
    when a.item_source_type = 'bank_statement_line' and b.item_source_type <> 'bank_statement_line' and a.amount = b.amount then 'exact_amount'
    when a.item_source_type = 'bank_statement_line' and b.item_source_type <> 'bank_statement_line' and abs(coalesce(a.amount,0) - coalesce(b.amount,0)) <= 1.00 then 'near_amount'
    else 'review'
  end as match_reason
from unmatched a
join unmatched b
  on b.reconciliation_session_id = a.reconciliation_session_id
 and b.id <> a.id
 and (
   (a.item_source_type = 'bank_statement_line' and b.item_source_type <> 'bank_statement_line')
   or
   (b.item_source_type = 'bank_statement_line' and a.item_source_type <> 'bank_statement_line')
 )
 and abs(coalesce(a.amount,0) - coalesce(b.amount,0)) <= 1.00;

create or replace view public.v_accountant_handoff_bundle_directory as
with item_rollup as (
  select
    export_id,
    count(*)::int as item_count,
    max(created_at) as last_item_at
  from public.accountant_handoff_export_items
  group by export_id
)
select
  ah.id,
  ah.export_kind,
  ah.entity_scope,
  ah.entity_id,
  ah.business_tax_setting_id,
  bts.profile_name as tax_profile_name,
  bts.legal_entity_type,
  bts.legal_entity_name,
  bts.federal_return_type,
  bts.provincial_return_type,
  bts.usa_tax_classification,
  ah.export_status,
  ah.bundle_kind,
  ah.delivery_channel,
  ah.delivered_to_email,
  ah.export_title,
  ah.generated_by_profile_id,
  p.full_name as generated_by_name,
  ah.generated_at,
  ah.delivered_at,
  coalesce(ir.item_count, ah.bundle_item_count, 0)::int as bundle_item_count,
  ir.last_item_at,
  ah.bundle_payload,
  ah.export_payload,
  ah.created_at,
  ah.updated_at
from public.accountant_handoff_exports ah
left join public.business_tax_settings bts on bts.id = ah.business_tax_setting_id
left join public.profiles p on p.id = ah.generated_by_profile_id
left join item_rollup ir on ir.export_id = ah.id;
