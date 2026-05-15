-- 102_accounting_close_end_to_end_workflow.sql
-- Finishes the accounting-close workflow with:
-- - AR/AP payment application
-- - fuller journal-line automation support
-- - better reconciliation matching scores
-- - filing/remittance review flow
-- - final accountant export packaging metadata

alter table if exists public.ar_payments
  add column if not exists unapplied_amount numeric(12,2) not null default 0,
  add column if not exists application_status text not null default 'unapplied',
  add column if not exists last_applied_at timestamptz,
  add column if not exists last_application_notes text;

alter table if exists public.ar_payments
  drop constraint if exists ar_payments_application_status_check;
alter table if exists public.ar_payments
  add constraint ar_payments_application_status_check
  check (application_status in ('unapplied','partial','applied'));

alter table if exists public.ap_payments
  add column if not exists unapplied_amount numeric(12,2) not null default 0,
  add column if not exists application_status text not null default 'unapplied',
  add column if not exists last_applied_at timestamptz,
  add column if not exists last_application_notes text;

alter table if exists public.ap_payments
  drop constraint if exists ap_payments_application_status_check;
alter table if exists public.ap_payments
  add constraint ap_payments_application_status_check
  check (application_status in ('unapplied','partial','applied'));

create table if not exists public.ar_payment_applications (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.ar_payments(id) on delete cascade,
  invoice_id uuid not null references public.ar_invoices(id) on delete cascade,
  applied_amount numeric(12,2) not null default 0,
  application_date date not null default current_date,
  application_status text not null default 'applied',
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.ar_payment_applications
  drop constraint if exists ar_payment_applications_status_check;
alter table if exists public.ar_payment_applications
  add constraint ar_payment_applications_status_check
  check (application_status in ('applied','reversed','void'));

create index if not exists idx_ar_payment_applications_payment
  on public.ar_payment_applications(payment_id, application_date desc, created_at desc);
create index if not exists idx_ar_payment_applications_invoice
  on public.ar_payment_applications(invoice_id, application_date desc, created_at desc);

create table if not exists public.ap_payment_applications (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.ap_payments(id) on delete cascade,
  bill_id uuid not null references public.ap_bills(id) on delete cascade,
  applied_amount numeric(12,2) not null default 0,
  application_date date not null default current_date,
  application_status text not null default 'applied',
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.ap_payment_applications
  drop constraint if exists ap_payment_applications_status_check;
alter table if exists public.ap_payment_applications
  add constraint ap_payment_applications_status_check
  check (application_status in ('applied','reversed','void'));

create index if not exists idx_ap_payment_applications_payment
  on public.ap_payment_applications(payment_id, application_date desc, created_at desc);
create index if not exists idx_ap_payment_applications_bill
  on public.ap_payment_applications(bill_id, application_date desc, created_at desc);

update public.ar_payments p
set
  unapplied_amount = greatest(coalesce(p.amount, 0) - coalesce(a.applied_total, 0), 0)::numeric(12,2),
  application_status = case
    when coalesce(a.applied_total, 0) <= 0 then 'unapplied'
    when coalesce(a.applied_total, 0) < coalesce(p.amount, 0) then 'partial'
    else 'applied'
  end,
  last_applied_at = a.last_applied_at
from (
  select payment_id, coalesce(sum(applied_amount), 0)::numeric(12,2) as applied_total, max(created_at) as last_applied_at
  from public.ar_payment_applications
  where coalesce(application_status, 'applied') <> 'void'
  group by payment_id
) a
where a.payment_id = p.id;

update public.ap_payments p
set
  unapplied_amount = greatest(coalesce(p.amount, 0) - coalesce(a.applied_total, 0), 0)::numeric(12,2),
  application_status = case
    when coalesce(a.applied_total, 0) <= 0 then 'unapplied'
    when coalesce(a.applied_total, 0) < coalesce(p.amount, 0) then 'partial'
    else 'applied'
  end,
  last_applied_at = a.last_applied_at
from (
  select payment_id, coalesce(sum(applied_amount), 0)::numeric(12,2) as applied_total, max(created_at) as last_applied_at
  from public.ap_payment_applications
  where coalesce(application_status, 'applied') <> 'void'
  group by payment_id
) a
where a.payment_id = p.id;

update public.sales_tax_filings
set filing_status = coalesce(filing_status, 'draft')
where filing_status is null;

alter table if exists public.sales_tax_filings
  add column if not exists review_status text not null default 'draft',
  add column if not exists review_notes text,
  add column if not exists reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists payment_reference text,
  add column if not exists paid_at timestamptz;

alter table if exists public.sales_tax_filings
  drop constraint if exists sales_tax_filings_review_status_check;
alter table if exists public.sales_tax_filings
  add constraint sales_tax_filings_review_status_check
  check (review_status in ('draft','prepared','reviewed','approved','filed','paid'));

alter table if exists public.payroll_remittance_runs
  add column if not exists review_status text not null default 'draft',
  add column if not exists review_notes text,
  add column if not exists reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists payment_reference text;

alter table if exists public.payroll_remittance_runs
  drop constraint if exists payroll_remittance_runs_review_status_check;
alter table if exists public.payroll_remittance_runs
  add constraint payroll_remittance_runs_review_status_check
  check (review_status in ('draft','prepared','reviewed','approved','remitted'));

alter table if exists public.accountant_handoff_exports
  add column if not exists package_status text not null default 'draft',
  add column if not exists package_manifest jsonb not null default '{}'::jsonb,
  add column if not exists package_markdown text,
  add column if not exists package_json jsonb not null default '{}'::jsonb,
  add column if not exists reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists finalised_at timestamptz;

alter table if exists public.accountant_handoff_exports
  drop constraint if exists accountant_handoff_exports_package_status_check;
alter table if exists public.accountant_handoff_exports
  add constraint accountant_handoff_exports_package_status_check
  check (package_status in ('draft','prepared','reviewed','finalized','delivered'));

create or replace view public.v_ar_payment_application_directory as
with applied_by_payment as (
  select payment_id, coalesce(sum(applied_amount), 0)::numeric(12,2) as applied_total
  from public.ar_payment_applications
  where coalesce(application_status, 'applied') <> 'void'
  group by payment_id
), applied_by_invoice as (
  select invoice_id, coalesce(sum(applied_amount), 0)::numeric(12,2) as applied_total
  from public.ar_payment_applications
  where coalesce(application_status, 'applied') <> 'void'
  group by invoice_id
)
select
  a.id,
  a.payment_id,
  p.payment_number,
  p.payment_date,
  p.payment_method,
  p.reference_number,
  p.client_id,
  c.legal_name as client_name,
  p.amount as payment_amount,
  coalesce(pb.applied_total, 0)::numeric(12,2) as payment_applied_total,
  greatest(coalesce(p.amount, 0) - coalesce(pb.applied_total, 0), 0)::numeric(12,2) as payment_unapplied_amount,
  p.application_status as payment_application_status,
  a.invoice_id,
  i.invoice_number,
  i.invoice_date,
  i.due_date,
  i.invoice_status,
  i.total_amount as invoice_total_amount,
  i.balance_due as invoice_balance_due,
  coalesce(ib.applied_total, 0)::numeric(12,2) as invoice_applied_total,
  a.applied_amount,
  a.application_date,
  a.application_status,
  a.notes,
  a.created_by_profile_id,
  pr.full_name as created_by_name,
  a.created_at,
  a.updated_at
from public.ar_payment_applications a
left join public.ar_payments p on p.id = a.payment_id
left join public.clients c on c.id = p.client_id
left join public.ar_invoices i on i.id = a.invoice_id
left join public.profiles pr on pr.id = a.created_by_profile_id
left join applied_by_payment pb on pb.payment_id = a.payment_id
left join applied_by_invoice ib on ib.invoice_id = a.invoice_id;

create or replace view public.v_ap_payment_application_directory as
with applied_by_payment as (
  select payment_id, coalesce(sum(applied_amount), 0)::numeric(12,2) as applied_total
  from public.ap_payment_applications
  where coalesce(application_status, 'applied') <> 'void'
  group by payment_id
), applied_by_bill as (
  select bill_id, coalesce(sum(applied_amount), 0)::numeric(12,2) as applied_total
  from public.ap_payment_applications
  where coalesce(application_status, 'applied') <> 'void'
  group by bill_id
)
select
  a.id,
  a.payment_id,
  p.payment_number,
  p.payment_date,
  p.payment_method,
  p.reference_number,
  p.vendor_id,
  v.legal_name as vendor_name,
  p.amount as payment_amount,
  coalesce(pb.applied_total, 0)::numeric(12,2) as payment_applied_total,
  greatest(coalesce(p.amount, 0) - coalesce(pb.applied_total, 0), 0)::numeric(12,2) as payment_unapplied_amount,
  p.application_status as payment_application_status,
  a.bill_id,
  b.bill_number,
  b.bill_date,
  b.due_date,
  b.bill_status,
  b.total_amount as bill_total_amount,
  b.balance_due as bill_balance_due,
  coalesce(bb.applied_total, 0)::numeric(12,2) as bill_applied_total,
  a.applied_amount,
  a.application_date,
  a.application_status,
  a.notes,
  a.created_by_profile_id,
  pr.full_name as created_by_name,
  a.created_at,
  a.updated_at
from public.ap_payment_applications a
left join public.ap_payments p on p.id = a.payment_id
left join public.ap_vendors v on v.id = p.vendor_id
left join public.ap_bills b on b.id = a.bill_id
left join public.profiles pr on pr.id = a.created_by_profile_id
left join applied_by_payment pb on pb.payment_id = a.payment_id
left join applied_by_bill bb on bb.bill_id = a.bill_id;

create or replace view public.v_gl_journal_generated_line_directory as
with base as (
  select
    p.id as posting_id,
    p.journal_candidate_id,
    p.gl_batch_id,
    c.job_id,
    c.job_code,
    c.job_name,
    c.journal_memo,
    coalesce(c.ledger_summary, '{}'::jsonb) as ls,
    coalesce((c.ledger_summary ->> 'revenue_total')::numeric, 0)::numeric(12,2) as revenue_total,
    coalesce((c.ledger_summary ->> 'cost_total')::numeric, 0)::numeric(12,2) as cost_total,
    nullif(coalesce(c.ledger_summary ->> 'revenue_account_id', ''), '') as revenue_account_id,
    nullif(coalesce(c.ledger_summary ->> 'cogs_account_id', ''), '') as cogs_account_id,
    nullif(coalesce(c.ledger_summary ->> 'wip_account_id', ''), '') as wip_account_id,
    nullif(coalesce(c.ledger_summary ->> 'variance_account_id', ''), '') as variance_account_id
  from public.job_journal_postings p
  left join public.v_job_journal_candidate_directory c on c.id = p.journal_candidate_id
), generated as (
  select posting_id, journal_candidate_id, gl_batch_id, job_id, job_code, job_name, journal_memo, 10 as line_sort, 'revenue_offset_debit'::text as line_role, coalesce(wip_account_id, revenue_account_id) as account_id, revenue_total as debit_amount, 0::numeric(12,2) as credit_amount, 'Generated offset for revenue recognition.'::text as line_note
  from base where revenue_total > 0 and coalesce(wip_account_id, revenue_account_id) is not null
  union all
  select posting_id, journal_candidate_id, gl_batch_id, job_id, job_code, job_name, journal_memo, 20, 'revenue_credit', revenue_account_id, 0::numeric(12,2), revenue_total, 'Generated revenue line.' from base where revenue_total > 0 and revenue_account_id is not null
  union all
  select posting_id, journal_candidate_id, gl_batch_id, job_id, job_code, job_name, journal_memo, 30, 'cost_debit', cogs_account_id, cost_total, 0::numeric(12,2), 'Generated cost recognition line.' from base where cost_total > 0 and cogs_account_id is not null
  union all
  select posting_id, journal_candidate_id, gl_batch_id, job_id, job_code, job_name, journal_memo, 40, 'cost_offset_credit', coalesce(wip_account_id, cogs_account_id), 0::numeric(12,2), cost_total, 'Generated offset for cost recognition.' from base where cost_total > 0 and coalesce(wip_account_id, cogs_account_id) is not null
)
select
  g.posting_id,
  g.journal_candidate_id,
  g.gl_batch_id,
  g.job_id,
  g.job_code,
  g.job_name,
  g.journal_memo,
  g.line_sort,
  g.line_role,
  g.account_id,
  coa.account_number,
  coa.account_name,
  g.debit_amount,
  g.credit_amount,
  g.line_note
from generated g
left join public.chart_of_accounts coa on coa.id::text = g.account_id;

create or replace view public.v_bank_reconciliation_match_scored_directory as
with base as (
  select *
  from public.v_bank_reconciliation_match_candidate_directory
  where coalesce(bank_item_source_type, '') = 'bank_statement_line'
), scored as (
  select
    b.*,
    abs(coalesce(bank_item_date, candidate_item_date) - coalesce(candidate_item_date, bank_item_date)) as date_difference_days,
    case when lower(coalesce(bank_item_description, '')) like '%' || split_part(lower(coalesce(candidate_item_description, '')), ' ', 1) || '%' then true else false end as description_hint,
    (
      case when coalesce(amount_difference, 0) = 0 then 70
           when coalesce(amount_difference, 0) <= 0.10 then 55
           when coalesce(amount_difference, 0) <= 1.00 then 40
           else 10 end
      + case when abs(coalesce(bank_item_date, candidate_item_date) - coalesce(candidate_item_date, bank_item_date)) <= 2 then 20
             when abs(coalesce(bank_item_date, candidate_item_date) - coalesce(candidate_item_date, bank_item_date)) <= 7 then 10
             else 0 end
      + case when lower(coalesce(bank_item_description, '')) like '%' || split_part(lower(coalesce(candidate_item_description, '')), ' ', 1) || '%' then 10 else 0 end
    )::int as match_score
  from base b
)
select
  scored.*,
  case when match_score >= 90 then 'auto_match'
       when match_score >= 70 then 'likely_match'
       else 'review' end as recommendation
from scored;

create or replace view public.v_sales_tax_filing_review_directory as
select
  s.id,
  s.filing_code,
  s.business_tax_setting_id,
  bts.profile_name as business_tax_profile_name,
  bts.legal_entity_type,
  bts.legal_entity_name,
  bts.federal_return_type,
  bts.provincial_return_type,
  s.tax_code_id,
  tc.code as tax_code,
  s.filing_scope,
  s.filing_period_start,
  s.filing_period_end,
  s.due_date,
  s.filing_status,
  s.review_status,
  s.review_notes,
  s.reviewed_by_profile_id,
  p.full_name as reviewed_by_name,
  s.reviewed_at,
  s.taxable_sales_total,
  s.tax_collected_total,
  s.tax_paid_total,
  s.adjustment_total,
  s.net_remittance_total,
  prep.suggested_net_remittance_total,
  (coalesce(s.net_remittance_total, 0) - coalesce(prep.suggested_net_remittance_total, 0))::numeric(12,2) as net_difference_total,
  s.reference_number,
  s.payment_reference,
  s.filed_at,
  s.paid_at,
  s.created_at,
  s.updated_at
from public.sales_tax_filings s
left join public.business_tax_settings bts on bts.id = s.business_tax_setting_id
left join public.tax_codes tc on tc.id = s.tax_code_id
left join public.profiles p on p.id = s.reviewed_by_profile_id
left join public.v_sales_tax_prep_directory prep on prep.period_start = s.filing_period_start and prep.period_end = s.filing_period_end;

create or replace view public.v_payroll_remittance_review_directory as
select
  r.id,
  r.remittance_code,
  r.payroll_export_run_id,
  r.remittance_type,
  r.remittance_period_start,
  r.remittance_period_end,
  r.due_date,
  r.remittance_status,
  r.review_status,
  r.review_notes,
  r.reviewed_by_profile_id,
  p.full_name as reviewed_by_name,
  r.reviewed_at,
  r.gross_pay_total,
  r.employee_deduction_total,
  r.employer_contribution_total,
  r.net_remittance_total,
  prep.exported_payroll_cost_total as prepared_payroll_cost_total,
  r.reference_number,
  r.payment_reference,
  r.remitted_at,
  r.created_at,
  r.updated_at
from public.payroll_remittance_runs r
left join public.profiles p on p.id = r.reviewed_by_profile_id
left join public.v_payroll_remittance_prep_directory prep on prep.period_start = r.remittance_period_start and prep.period_end = r.remittance_period_end;

create or replace view public.v_accountant_handoff_package_directory as
with item_rollup as (
  select
    export_id,
    count(*)::int as item_count,
    count(*) filter (where item_kind = 'trial_balance')::int as trial_balance_item_count,
    count(*) filter (where item_kind = 'ar_aging')::int as ar_aging_item_count,
    count(*) filter (where item_kind = 'ap_aging')::int as ap_aging_item_count,
    count(*) filter (where item_kind = 'sales_tax_prep')::int as sales_tax_item_count,
    count(*) filter (where item_kind = 'payroll_remittance_prep')::int as payroll_item_count,
    max(created_at) as last_item_at
  from public.accountant_handoff_export_items
  group by export_id
)
select
  e.id,
  e.export_kind,
  e.entity_scope,
  e.entity_id,
  e.business_tax_setting_id,
  bts.profile_name as tax_profile_name,
  bts.legal_entity_type,
  bts.legal_entity_name,
  bts.federal_return_type,
  bts.provincial_return_type,
  bts.usa_tax_classification,
  e.export_status,
  e.bundle_kind,
  e.delivery_channel,
  e.delivered_to_email,
  e.package_status,
  e.package_manifest,
  e.package_markdown,
  e.package_json,
  e.bundle_item_count,
  coalesce(ir.item_count, e.bundle_item_count, 0)::int as resolved_item_count,
  coalesce(ir.trial_balance_item_count, 0)::int as trial_balance_item_count,
  coalesce(ir.ar_aging_item_count, 0)::int as ar_aging_item_count,
  coalesce(ir.ap_aging_item_count, 0)::int as ap_aging_item_count,
  coalesce(ir.sales_tax_item_count, 0)::int as sales_tax_item_count,
  coalesce(ir.payroll_item_count, 0)::int as payroll_item_count,
  e.export_title,
  e.generated_by_profile_id,
  pg.full_name as generated_by_name,
  e.generated_at,
  e.reviewed_by_profile_id,
  pr.full_name as reviewed_by_name,
  e.reviewed_at,
  e.finalised_at,
  e.delivered_at,
  ir.last_item_at,
  e.bundle_payload,
  e.export_payload,
  e.created_at,
  e.updated_at
from public.accountant_handoff_exports e
left join public.business_tax_settings bts on bts.id = e.business_tax_setting_id
left join public.profiles pg on pg.id = e.generated_by_profile_id
left join public.profiles pr on pr.id = e.reviewed_by_profile_id
left join item_rollup ir on ir.export_id = e.id;

create or replace view public.v_accounting_payment_application_dashboard as
with ar as (
  select
    count(*)::int as application_count,
    coalesce(sum(applied_amount), 0)::numeric(12,2) as applied_total,
    count(distinct payment_id)::int as payment_count,
    count(distinct invoice_id)::int as invoice_count
  from public.ar_payment_applications
  where coalesce(application_status, 'applied') <> 'void'
), ap as (
  select
    count(*)::int as application_count,
    coalesce(sum(applied_amount), 0)::numeric(12,2) as applied_total,
    count(distinct payment_id)::int as payment_count,
    count(distinct bill_id)::int as bill_count
  from public.ap_payment_applications
  where coalesce(application_status, 'applied') <> 'void'
)
select
  'ar'::text as application_type,
  ar.application_count,
  ar.applied_total,
  ar.payment_count,
  ar.invoice_count as linked_document_count
from ar
union all
select
  'ap'::text,
  ap.application_count,
  ap.applied_total,
  ap.payment_count,
  ap.bill_count
from ap;
