-- 081_contract_conversion_payroll_exports_and_snow_invoice_automation.sql
-- Adds:
-- - estimate -> agreement conversion support
-- - printable service contract / application records
-- - payroll export file generation storage
-- - agreement profitability and snow-event invoice automation
-- - callback / warranty dashboard summaries

create extension if not exists pgcrypto;

alter table if exists public.recurring_service_agreements
  add column if not exists estimate_id uuid references public.estimates(id) on delete set null,
  add column if not exists contract_document_id uuid,
  add column if not exists agreement_notes text;

create table if not exists public.service_contract_documents (
  id uuid primary key default gen_random_uuid(),
  document_number text not null unique,
  source_entity text not null,
  source_id text not null,
  estimate_id uuid references public.estimates(id) on delete set null,
  agreement_id uuid references public.recurring_service_agreements(id) on delete set null,
  job_id bigint references public.jobs(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  client_site_id uuid references public.client_sites(id) on delete set null,
  document_kind text not null default 'contract',
  document_status text not null default 'draft',
  title text not null,
  contract_reference text,
  effective_date date,
  expiry_date date,
  rendered_html text,
  rendered_text text,
  payload jsonb not null default '{}'::jsonb,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.service_contract_documents drop constraint if exists service_contract_documents_source_entity_check;
alter table if exists public.service_contract_documents
  add constraint service_contract_documents_source_entity_check
  check (source_entity in ('estimate','recurring_service_agreement','job','manual'));

alter table if exists public.service_contract_documents drop constraint if exists service_contract_documents_kind_check;
alter table if exists public.service_contract_documents
  add constraint service_contract_documents_kind_check
  check (document_kind in ('application','contract','change_order','service_summary','payroll_export_cover'));

alter table if exists public.service_contract_documents drop constraint if exists service_contract_documents_status_check;
alter table if exists public.service_contract_documents
  add constraint service_contract_documents_status_check
  check (document_status in ('draft','issued','signed','archived','void'));

alter table if exists public.recurring_service_agreements
  drop constraint if exists recurring_service_agreements_contract_document_fk;
alter table if exists public.recurring_service_agreements
  add constraint recurring_service_agreements_contract_document_fk
  foreign key (contract_document_id) references public.service_contract_documents(id) on delete set null;

alter table if exists public.payroll_export_runs
  add column if not exists export_format text not null default 'csv',
  add column if not exists export_file_name text,
  add column if not exists export_file_content text,
  add column if not exists exported_entry_count integer not null default 0,
  add column if not exists exported_hours_total numeric(10,2) not null default 0,
  add column if not exists exported_payroll_cost_total numeric(12,2) not null default 0;

alter table if exists public.payroll_export_runs drop constraint if exists payroll_export_runs_export_format_check;
alter table if exists public.payroll_export_runs
  add constraint payroll_export_runs_export_format_check
  check (export_format in ('csv','json'));

alter table if exists public.ar_invoices
  add column if not exists recurring_service_agreement_id uuid references public.recurring_service_agreements(id) on delete set null,
  add column if not exists snow_event_trigger_id uuid references public.snow_event_triggers(id) on delete set null,
  add column if not exists service_contract_document_id uuid references public.service_contract_documents(id) on delete set null,
  add column if not exists invoice_source text not null default 'manual';

alter table if exists public.ar_invoices drop constraint if exists ar_invoices_invoice_source_check;
alter table if exists public.ar_invoices
  add constraint ar_invoices_invoice_source_check
  check (invoice_source in ('manual','job','agreement_visit','agreement_snow','change_order','callback','contract'));

create index if not exists idx_service_contract_documents_source on public.service_contract_documents(source_entity, source_id, created_at desc);
create index if not exists idx_service_contract_documents_agreement on public.service_contract_documents(agreement_id, created_at desc);
create index if not exists idx_ar_invoices_agreement on public.ar_invoices(recurring_service_agreement_id, invoice_date desc);
create index if not exists idx_ar_invoices_snow_trigger on public.ar_invoices(snow_event_trigger_id);

create or replace view public.v_estimate_conversion_candidates as
select
  e.id,
  e.estimate_number,
  e.client_id,
  c.legal_name as client_name,
  e.client_site_id,
  cs.site_name as client_site_name,
  e.estimate_type,
  e.status,
  e.valid_until,
  e.subtotal,
  e.tax_total,
  e.total_amount,
  count(distinct a.id)::int as linked_agreement_count,
  count(distinct d.id)::int as linked_document_count,
  max(a.updated_at) as last_agreement_update_at,
  max(d.updated_at) as last_document_update_at
from public.estimates e
left join public.clients c on c.id = e.client_id
left join public.client_sites cs on cs.id = e.client_site_id
left join public.recurring_service_agreements a on a.estimate_id = e.id
left join public.service_contract_documents d on d.estimate_id = e.id
group by e.id, e.estimate_number, e.client_id, c.legal_name, e.client_site_id, cs.site_name, e.estimate_type, e.status, e.valid_until, e.subtotal, e.tax_total, e.total_amount;

create or replace view public.v_service_agreement_profitability_summary as
with agreement_jobs as (
  select
    a.id as agreement_id,
    j.id as job_id
  from public.recurring_service_agreements a
  left join public.jobs j on coalesce(j.service_contract_reference, '') = coalesce(a.agreement_code, '')
),
job_rollup as (
  select
    aj.agreement_id,
    count(distinct aj.job_id)::int as linked_job_count,
    coalesce(sum(coalesce(jf.session_count, 0)), 0)::int as linked_session_count,
    coalesce(sum(coalesce(jf.actual_cost_rollup_total, 0)), 0)::numeric(12,2) as actual_cost_rollup_total,
    coalesce(sum(coalesce(jf.actual_charge_rollup_total, 0)), 0)::numeric(12,2) as actual_charge_rollup_total,
    coalesce(sum(coalesce(jf.actual_profit_rollup_total, 0)), 0)::numeric(12,2) as actual_profit_rollup_total,
    max(jf.last_session_ended_at) as last_job_activity_at
  from agreement_jobs aj
  left join public.v_job_financial_rollups jf on jf.job_id = aj.job_id
  group by aj.agreement_id
),
invoice_rollup as (
  select
    ai.recurring_service_agreement_id as agreement_id,
    count(*)::int as invoice_count,
    count(*) filter (where coalesce(ai.invoice_source, '') = 'agreement_snow')::int as snow_invoice_count,
    coalesce(sum(coalesce(ai.total_amount, 0)), 0)::numeric(12,2) as invoiced_total,
    coalesce(sum(coalesce(ai.balance_due, 0)), 0)::numeric(12,2) as open_invoice_balance,
    max(ai.invoice_date) as last_invoice_date
  from public.ar_invoices ai
  where ai.recurring_service_agreement_id is not null
  group by ai.recurring_service_agreement_id
),
trigger_rollup as (
  select
    st.agreement_id,
    count(*)::int as snow_event_count,
    count(*) filter (where st.trigger_met = true)::int as triggered_snow_event_count,
    max(st.event_date) as last_snow_event_date
  from public.snow_event_triggers st
  group by st.agreement_id
)
select
  a.id,
  a.agreement_code,
  a.service_name,
  a.agreement_status,
  a.client_id,
  c.legal_name as client_name,
  a.client_site_id,
  cs.site_name as client_site_name,
  a.route_id,
  r.name as route_name,
  a.crew_id,
  cr.crew_name,
  a.billing_method,
  a.start_date,
  a.end_date,
  a.open_end_date,
  a.visit_cost_total,
  a.visit_charge_total,
  coalesce(jr.linked_job_count, 0)::int as linked_job_count,
  coalesce(jr.linked_session_count, 0)::int as linked_session_count,
  coalesce(jr.actual_cost_rollup_total, 0)::numeric(12,2) as actual_cost_rollup_total,
  coalesce(jr.actual_charge_rollup_total, 0)::numeric(12,2) as actual_charge_rollup_total,
  coalesce(jr.actual_profit_rollup_total, 0)::numeric(12,2) as actual_profit_rollup_total,
  case
    when coalesce(jr.actual_charge_rollup_total, 0) > 0 then round((coalesce(jr.actual_profit_rollup_total, 0) / coalesce(jr.actual_charge_rollup_total, 0)) * 100.0, 2)::numeric(7,2)
    else 0::numeric(7,2)
  end as actual_margin_percent,
  coalesce(ir.invoice_count, 0)::int as invoice_count,
  coalesce(ir.snow_invoice_count, 0)::int as snow_invoice_count,
  coalesce(ir.invoiced_total, 0)::numeric(12,2) as invoiced_total,
  coalesce(ir.open_invoice_balance, 0)::numeric(12,2) as open_invoice_balance,
  ir.last_invoice_date,
  coalesce(tr.snow_event_count, 0)::int as snow_event_count,
  coalesce(tr.triggered_snow_event_count, 0)::int as triggered_snow_event_count,
  tr.last_snow_event_date,
  jr.last_job_activity_at
from public.recurring_service_agreements a
left join public.clients c on c.id = a.client_id
left join public.client_sites cs on cs.id = a.client_site_id
left join public.routes r on r.id = a.route_id
left join public.crews cr on cr.id = a.crew_id
left join job_rollup jr on jr.agreement_id = a.id
left join invoice_rollup ir on ir.agreement_id = a.id
left join trigger_rollup tr on tr.agreement_id = a.id;

create or replace view public.v_snow_event_invoice_candidates as
select
  st.id,
  st.agreement_id,
  a.agreement_code,
  a.service_name,
  a.client_id,
  c.legal_name as client_name,
  a.client_site_id,
  cs.site_name as client_site_name,
  st.event_date,
  st.event_label,
  st.snowfall_cm,
  coalesce(st.threshold_cm, a.snow_trigger_threshold_cm) as threshold_cm,
  st.trigger_met,
  a.visit_charge_total,
  coalesce(tc.rate_percent, 0)::numeric(7,3) as tax_rate_percent,
  round(coalesce(a.visit_charge_total, 0) * (coalesce(tc.rate_percent, 0) / 100.0), 2)::numeric(12,2) as estimated_tax_total,
  round(coalesce(a.visit_charge_total, 0) * (1 + (coalesce(tc.rate_percent, 0) / 100.0)), 2)::numeric(12,2) as estimated_total_with_tax,
  ai.id as existing_invoice_id,
  ai.invoice_number as existing_invoice_number,
  ai.invoice_status as existing_invoice_status,
  ai.invoice_date as existing_invoice_date
from public.snow_event_triggers st
join public.recurring_service_agreements a on a.id = st.agreement_id
left join public.clients c on c.id = a.client_id
left join public.client_sites cs on cs.id = a.client_site_id
left join public.tax_codes tc on tc.id = a.tax_code_id
left join public.ar_invoices ai on ai.snow_event_trigger_id = st.id
where st.trigger_met = true;

create or replace view public.v_callback_warranty_dashboard_summary as
select
  count(*)::int as total_callback_count,
  count(*) filter (where status <> 'closed')::int as open_callback_count,
  count(*) filter (where callback_type = 'warranty' and status <> 'closed')::int as open_warranty_callback_count,
  count(*) filter (where callback_type = 'callback' and status <> 'closed')::int as open_standard_callback_count,
  coalesce(sum(case when status <> 'closed' then coalesce(actual_cost_total, 0) else 0 end), 0)::numeric(12,2) as open_callback_cost_total,
  max(opened_at) as last_callback_opened_at
from public.warranty_callback_events;
