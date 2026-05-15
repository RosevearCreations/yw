-- 100_accounting_close_reconciliation_and_tax_filing_foundation.sql
-- Adds backend accounting-close foundations so the quote -> release -> completion -> posting path
-- can move into real close, remittance, reconciliation, and accountant handoff workflows.

alter table if exists public.chart_of_accounts
  add column if not exists gifi_code text,
  add column if not exists gifi_description text,
  add column if not exists tax_export_group text,
  add column if not exists accountant_export_group text,
  add column if not exists normal_balance text,
  add column if not exists is_control_account boolean not null default false;

alter table if exists public.chart_of_accounts
  drop constraint if exists chart_of_accounts_normal_balance_check;

alter table if exists public.chart_of_accounts
  add constraint chart_of_accounts_normal_balance_check
  check (normal_balance in ('debit','credit') or normal_balance is null);

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  institution_name text,
  currency_code text not null default 'CAD',
  account_mask text,
  transit_number text,
  institution_number text,
  account_number_last4 text,
  account_status text not null default 'open',
  gl_account_id uuid references public.chart_of_accounts(id) on delete set null,
  is_default boolean not null default false,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.bank_accounts
  drop constraint if exists bank_accounts_status_check;

alter table if exists public.bank_accounts
  add constraint bank_accounts_status_check
  check (account_status in ('open','inactive','closed'));

create index if not exists idx_bank_accounts_status
  on public.bank_accounts(account_status, is_default, account_name);

alter table if exists public.business_tax_settings
  add column if not exists filing_country_code text not null default 'CA',
  add column if not exists filing_region_code text,
  add column if not exists accountant_export_style text not null default 'management',
  add column if not exists default_bank_account_id uuid references public.bank_accounts(id) on delete set null;

alter table if exists public.business_tax_settings
  drop constraint if exists business_tax_settings_accountant_export_style_check;

alter table if exists public.business_tax_settings
  add constraint business_tax_settings_accountant_export_style_check
  check (accountant_export_style in ('management','t2_gifi','llc_review','corp_review','custom'));

create table if not exists public.accounting_period_closes (
  id uuid primary key default gen_random_uuid(),
  period_code text not null unique,
  period_start date not null,
  period_end date not null,
  close_scope text not null default 'month_end',
  close_status text not null default 'open',
  ar_locked boolean not null default false,
  ap_locked boolean not null default false,
  gl_locked boolean not null default false,
  payroll_locked boolean not null default false,
  tax_locked boolean not null default false,
  close_checklist jsonb not null default '{}'::jsonb,
  close_notes text,
  closed_by_profile_id uuid references public.profiles(id) on delete set null,
  closed_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

alter table if exists public.accounting_period_closes
  drop constraint if exists accounting_period_closes_scope_check;

alter table if exists public.accounting_period_closes
  add constraint accounting_period_closes_scope_check
  check (close_scope in ('month_end','quarter_end','year_end','custom'));

alter table if exists public.accounting_period_closes
  drop constraint if exists accounting_period_closes_status_check;

alter table if exists public.accounting_period_closes
  add constraint accounting_period_closes_status_check
  check (close_status in ('open','in_review','closed','reopened'));

create index if not exists idx_accounting_period_closes_range
  on public.accounting_period_closes(period_start, period_end, close_status);

create table if not exists public.sales_tax_filings (
  id uuid primary key default gen_random_uuid(),
  filing_code text not null unique,
  business_tax_setting_id uuid references public.business_tax_settings(id) on delete set null,
  tax_code_id uuid references public.tax_codes(id) on delete set null,
  filing_scope text not null default 'hst_return',
  filing_period_start date not null,
  filing_period_end date not null,
  due_date date,
  filing_status text not null default 'draft',
  taxable_sales_total numeric(12,2) not null default 0,
  tax_collected_total numeric(12,2) not null default 0,
  tax_paid_total numeric(12,2) not null default 0,
  adjustment_total numeric(12,2) not null default 0,
  net_remittance_total numeric(12,2) not null default 0,
  reference_number text,
  notes text,
  filed_by_profile_id uuid references public.profiles(id) on delete set null,
  filed_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (filing_period_end >= filing_period_start)
);

alter table if exists public.sales_tax_filings
  drop constraint if exists sales_tax_filings_scope_check;

alter table if exists public.sales_tax_filings
  add constraint sales_tax_filings_scope_check
  check (filing_scope in ('hst_return','gst_return','pst_return','sales_tax_custom'));

alter table if exists public.sales_tax_filings
  drop constraint if exists sales_tax_filings_status_check;

alter table if exists public.sales_tax_filings
  add constraint sales_tax_filings_status_check
  check (filing_status in ('draft','prepared','filed','paid','amended'));

create index if not exists idx_sales_tax_filings_period
  on public.sales_tax_filings(filing_period_start, filing_period_end, filing_status);

create table if not exists public.payroll_remittance_runs (
  id uuid primary key default gen_random_uuid(),
  remittance_code text not null unique,
  payroll_export_run_id uuid references public.payroll_export_runs(id) on delete set null,
  remittance_type text not null default 'source_deductions',
  remittance_period_start date not null,
  remittance_period_end date not null,
  due_date date,
  remittance_status text not null default 'draft',
  gross_pay_total numeric(12,2) not null default 0,
  employee_deduction_total numeric(12,2) not null default 0,
  employer_contribution_total numeric(12,2) not null default 0,
  net_remittance_total numeric(12,2) not null default 0,
  reference_number text,
  notes text,
  remitted_by_profile_id uuid references public.profiles(id) on delete set null,
  remitted_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (remittance_period_end >= remittance_period_start)
);

alter table if exists public.payroll_remittance_runs
  drop constraint if exists payroll_remittance_runs_type_check;

alter table if exists public.payroll_remittance_runs
  add constraint payroll_remittance_runs_type_check
  check (remittance_type in ('source_deductions','wsib','benefits','custom'));

alter table if exists public.payroll_remittance_runs
  drop constraint if exists payroll_remittance_runs_status_check;

alter table if exists public.payroll_remittance_runs
  add constraint payroll_remittance_runs_status_check
  check (remittance_status in ('draft','prepared','remitted','adjusted'));

create index if not exists idx_payroll_remittance_runs_period
  on public.payroll_remittance_runs(remittance_period_start, remittance_period_end, remittance_status);

create table if not exists public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  import_code text not null unique,
  statement_start date,
  statement_end date,
  import_status text not null default 'draft',
  opening_balance numeric(12,2),
  closing_balance numeric(12,2),
  transaction_count integer not null default 0,
  source_file_name text,
  source_format text,
  import_payload jsonb not null default '{}'::jsonb,
  imported_by_profile_id uuid references public.profiles(id) on delete set null,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.bank_statement_imports
  drop constraint if exists bank_statement_imports_status_check;

alter table if exists public.bank_statement_imports
  add constraint bank_statement_imports_status_check
  check (import_status in ('draft','imported','reviewed','reconciled','rejected'));

create table if not exists public.bank_reconciliation_sessions (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  statement_import_id uuid references public.bank_statement_imports(id) on delete set null,
  session_code text not null unique,
  period_start date,
  period_end date,
  reconciliation_status text not null default 'draft',
  book_balance numeric(12,2),
  bank_balance numeric(12,2),
  difference_amount numeric(12,2),
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.bank_reconciliation_sessions
  drop constraint if exists bank_reconciliation_sessions_status_check;

alter table if exists public.bank_reconciliation_sessions
  add constraint bank_reconciliation_sessions_status_check
  check (reconciliation_status in ('draft','in_review','balanced','closed','difference_pending'));

create table if not exists public.bank_reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  reconciliation_session_id uuid not null references public.bank_reconciliation_sessions(id) on delete cascade,
  item_source_type text not null,
  item_source_id text,
  item_date date,
  item_description text,
  amount numeric(12,2) not null default 0,
  match_status text not null default 'unmatched',
  clearing_status text not null default 'open',
  difference_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.bank_reconciliation_items
  drop constraint if exists bank_reconciliation_items_source_check;

alter table if exists public.bank_reconciliation_items
  add constraint bank_reconciliation_items_source_check
  check (item_source_type in ('bank_statement_line','ar_payment','ap_payment','gl_journal_entry','processor_payout','adjustment','other'));

alter table if exists public.bank_reconciliation_items
  drop constraint if exists bank_reconciliation_items_match_status_check;

alter table if exists public.bank_reconciliation_items
  add constraint bank_reconciliation_items_match_status_check
  check (match_status in ('unmatched','matched','partial','exception'));

alter table if exists public.bank_reconciliation_items
  drop constraint if exists bank_reconciliation_items_clearing_status_check;

alter table if exists public.bank_reconciliation_items
  add constraint bank_reconciliation_items_clearing_status_check
  check (clearing_status in ('open','cleared','void','ignored'));

create index if not exists idx_bank_reconciliation_items_session
  on public.bank_reconciliation_items(reconciliation_session_id, match_status, clearing_status, item_date);

create or replace view public.v_ar_invoice_aging_detail as
select
  ai.id,
  ai.invoice_number,
  ai.client_id,
  c.legal_name as client_name,
  ai.invoice_status,
  ai.invoice_date,
  ai.due_date,
  ai.total_amount,
  ai.balance_due,
  greatest((current_date - coalesce(ai.due_date, ai.invoice_date)), 0) as days_past_due,
  case
    when coalesce(ai.balance_due, 0) <= 0 then 'paid'
    when coalesce(ai.due_date, ai.invoice_date) >= current_date then 'current'
    when current_date - coalesce(ai.due_date, ai.invoice_date) between 1 and 30 then '1_30'
    when current_date - coalesce(ai.due_date, ai.invoice_date) between 31 and 60 then '31_60'
    when current_date - coalesce(ai.due_date, ai.invoice_date) between 61 and 90 then '61_90'
    else '90_plus'
  end as aging_bucket,
  ai.work_order_id,
  ai.created_at,
  ai.updated_at
from public.ar_invoices ai
left join public.clients c on c.id = ai.client_id;

create or replace view public.v_ap_bill_aging_detail as
select
  ab.id,
  ab.bill_number,
  ab.vendor_id,
  v.legal_name as vendor_name,
  ab.bill_status,
  ab.bill_date,
  ab.due_date,
  ab.total_amount,
  ab.balance_due,
  greatest((current_date - coalesce(ab.due_date, ab.bill_date)), 0) as days_past_due,
  case
    when coalesce(ab.balance_due, 0) <= 0 then 'paid'
    when coalesce(ab.due_date, ab.bill_date) >= current_date then 'current'
    when current_date - coalesce(ab.due_date, ab.bill_date) between 1 and 30 then '1_30'
    when current_date - coalesce(ab.due_date, ab.bill_date) between 31 and 60 then '31_60'
    when current_date - coalesce(ab.due_date, ab.bill_date) between 61 and 90 then '61_90'
    else '90_plus'
  end as aging_bucket,
  ab.created_at,
  ab.updated_at
from public.ap_bills ab
left join public.ap_vendors v on v.id = ab.vendor_id;

create or replace view public.v_gl_trial_balance_summary as
select
  coa.id as account_id,
  coa.account_number,
  coa.account_name,
  coa.account_type,
  coa.system_code,
  coa.gifi_code,
  coa.gifi_description,
  coa.tax_export_group,
  coa.accountant_export_group,
  coa.normal_balance,
  coa.is_control_account,
  coalesce(sum(gle.debit_amount), 0)::numeric(12,2) as debit_total,
  coalesce(sum(gle.credit_amount), 0)::numeric(12,2) as credit_total,
  (coalesce(sum(gle.debit_amount), 0) - coalesce(sum(gle.credit_amount), 0))::numeric(12,2) as net_movement
from public.chart_of_accounts coa
left join public.gl_journal_entries gle on gle.account_id = coa.id
group by coa.id, coa.account_number, coa.account_name, coa.account_type, coa.system_code, coa.gifi_code, coa.gifi_description, coa.tax_export_group, coa.accountant_export_group, coa.normal_balance, coa.is_control_account;

create or replace view public.v_sales_tax_filing_summary as
select
  stf.id,
  stf.filing_code,
  stf.business_tax_setting_id,
  bts.profile_name as business_tax_profile_name,
  stf.tax_code_id,
  tc.code as tax_code,
  stf.filing_scope,
  stf.filing_period_start,
  stf.filing_period_end,
  stf.due_date,
  stf.filing_status,
  stf.taxable_sales_total,
  stf.tax_collected_total,
  stf.tax_paid_total,
  stf.adjustment_total,
  stf.net_remittance_total,
  stf.reference_number,
  stf.filed_at,
  stf.created_at,
  stf.updated_at
from public.sales_tax_filings stf
left join public.business_tax_settings bts on bts.id = stf.business_tax_setting_id
left join public.tax_codes tc on tc.id = stf.tax_code_id;

create or replace view public.v_payroll_remittance_summary as
select
  pr.id,
  pr.remittance_code,
  pr.payroll_export_run_id,
  per.export_provider,
  pr.remittance_type,
  pr.remittance_period_start,
  pr.remittance_period_end,
  pr.due_date,
  pr.remittance_status,
  pr.gross_pay_total,
  pr.employee_deduction_total,
  pr.employer_contribution_total,
  pr.net_remittance_total,
  pr.reference_number,
  pr.remitted_at,
  pr.created_at,
  pr.updated_at
from public.payroll_remittance_runs pr
left join public.payroll_export_runs per on per.id = pr.payroll_export_run_id;

create or replace view public.v_bank_reconciliation_summary as
with item_rollup as (
  select
    bri.reconciliation_session_id,
    count(*)::int as item_count,
    count(*) filter (where bri.match_status = 'matched')::int as matched_count,
    count(*) filter (where bri.match_status = 'unmatched')::int as unmatched_count,
    count(*) filter (where bri.match_status = 'exception')::int as exception_count,
    count(*) filter (where bri.clearing_status = 'cleared')::int as cleared_count,
    coalesce(sum(case when bri.clearing_status = 'cleared' then bri.amount else 0 end), 0)::numeric(12,2) as cleared_amount_total
  from public.bank_reconciliation_items bri
  group by bri.reconciliation_session_id
)
select
  brs.id,
  brs.bank_account_id,
  ba.account_name,
  ba.institution_name,
  brs.statement_import_id,
  bsi.import_code,
  brs.session_code,
  brs.period_start,
  brs.period_end,
  brs.reconciliation_status,
  brs.book_balance,
  brs.bank_balance,
  brs.difference_amount,
  coalesce(ir.item_count, 0) as item_count,
  coalesce(ir.matched_count, 0) as matched_count,
  coalesce(ir.unmatched_count, 0) as unmatched_count,
  coalesce(ir.exception_count, 0) as exception_count,
  coalesce(ir.cleared_count, 0) as cleared_count,
  coalesce(ir.cleared_amount_total, 0) as cleared_amount_total,
  brs.reviewed_at,
  brs.created_at,
  brs.updated_at
from public.bank_reconciliation_sessions brs
left join public.bank_accounts ba on ba.id = brs.bank_account_id
left join public.bank_statement_imports bsi on bsi.id = brs.statement_import_id
left join item_rollup ir on ir.reconciliation_session_id = brs.id;

create or replace view public.v_accounting_period_close_directory as
select
  apc.id,
  apc.period_code,
  apc.period_start,
  apc.period_end,
  apc.close_scope,
  apc.close_status,
  apc.ar_locked,
  apc.ap_locked,
  apc.gl_locked,
  apc.payroll_locked,
  apc.tax_locked,
  apc.close_checklist,
  apc.close_notes,
  apc.closed_by_profile_id,
  p.full_name as closed_by_name,
  apc.closed_at,
  apc.created_at,
  apc.updated_at
from public.accounting_period_closes apc
left join public.profiles p on p.id = apc.closed_by_profile_id;

create or replace view public.v_accounting_close_dashboard as
with ar as (
  select
    count(*) filter (where coalesce(balance_due, 0) > 0)::int as open_invoice_count,
    coalesce(sum(balance_due) filter (where coalesce(balance_due, 0) > 0), 0)::numeric(12,2) as open_invoice_balance,
    coalesce(sum(balance_due) filter (where aging_bucket = '90_plus'), 0)::numeric(12,2) as ar_90_plus_balance
  from public.v_ar_invoice_aging_detail
), ap as (
  select
    count(*) filter (where coalesce(balance_due, 0) > 0)::int as open_bill_count,
    coalesce(sum(balance_due) filter (where coalesce(balance_due, 0) > 0), 0)::numeric(12,2) as open_bill_balance,
    coalesce(sum(balance_due) filter (where aging_bucket = '90_plus'), 0)::numeric(12,2) as ap_90_plus_balance
  from public.v_ap_bill_aging_detail
), tax as (
  select
    count(*) filter (where filing_status in ('draft','prepared'))::int as open_tax_filing_count,
    coalesce(sum(net_remittance_total) filter (where filing_status in ('draft','prepared')), 0)::numeric(12,2) as open_tax_remittance_total
  from public.sales_tax_filings
), payroll as (
  select
    count(*) filter (where remittance_status in ('draft','prepared'))::int as open_payroll_remittance_count,
    coalesce(sum(net_remittance_total) filter (where remittance_status in ('draft','prepared')), 0)::numeric(12,2) as open_payroll_remittance_total
  from public.payroll_remittance_runs
), bank as (
  select
    count(*) filter (where reconciliation_status in ('draft','in_review','difference_pending'))::int as open_bank_reconciliation_count,
    coalesce(sum(difference_amount) filter (where reconciliation_status in ('draft','in_review','difference_pending')), 0)::numeric(12,2) as open_bank_difference_total
  from public.bank_reconciliation_sessions
), periods as (
  select
    count(*) filter (where close_status in ('open','in_review','reopened'))::int as open_period_count,
    count(*) filter (where close_status = 'closed')::int as closed_period_count
  from public.accounting_period_closes
)
select
  ar.open_invoice_count,
  ar.open_invoice_balance,
  ar.ar_90_plus_balance,
  ap.open_bill_count,
  ap.open_bill_balance,
  ap.ap_90_plus_balance,
  tax.open_tax_filing_count,
  tax.open_tax_remittance_total,
  payroll.open_payroll_remittance_count,
  payroll.open_payroll_remittance_total,
  bank.open_bank_reconciliation_count,
  bank.open_bank_difference_total,
  periods.open_period_count,
  periods.closed_period_count
from ar
cross join ap
cross join tax
cross join payroll
cross join bank
cross join periods;
