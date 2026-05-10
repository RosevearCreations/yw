-- 103_accounting_close_admin_ui_controls.sql
-- Admin-facing controls for the end-to-end accounting close workflow.
-- Adds close/reopen audit fields, package delivery metadata, and dashboard views
-- consumed by the Admin Backbone manager.

alter table if exists public.accounting_period_closes
  add column if not exists reopened_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists reopened_at timestamptz,
  add column if not exists reopen_reason text,
  add column if not exists close_ready_override boolean not null default false,
  add column if not exists lock_notes text;

alter table if exists public.accountant_handoff_exports
  add column if not exists delivery_status text not null default 'pending',
  add column if not exists delivery_reference text,
  add column if not exists delivery_notes text;

alter table if exists public.accountant_handoff_exports
  drop constraint if exists accountant_handoff_exports_delivery_status_check;

alter table if exists public.accountant_handoff_exports
  add constraint accountant_handoff_exports_delivery_status_check
  check (delivery_status in ('pending','delivered','confirmed','failed','cancelled'));

create or replace view public.v_accounting_close_admin_control_dashboard as
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
  apc.close_ready_override,
  apc.closed_by_profile_id,
  closer.full_name as closed_by_name,
  apc.closed_at,
  apc.reopened_by_profile_id,
  reopener.full_name as reopened_by_name,
  apc.reopened_at,
  apc.reopen_reason,
  apc.close_notes,
  apc.lock_notes,
  coalesce(tax.open_tax_filing_count, 0)::int as open_tax_filing_count,
  coalesce(payroll.open_payroll_remittance_count, 0)::int as open_payroll_remittance_count,
  coalesce(recon.open_reconciliation_count, 0)::int as open_reconciliation_count,
  coalesce(recon.open_reconciliation_difference_total, 0)::numeric(12,2) as open_reconciliation_difference_total,
  coalesce(pkg.package_count, 0)::int as package_count,
  case
    when apc.close_ready_override then true
    when coalesce(tax.open_tax_filing_count, 0) = 0
      and coalesce(payroll.open_payroll_remittance_count, 0) = 0
      and coalesce(recon.open_reconciliation_count, 0) = 0
      and coalesce(recon.open_reconciliation_difference_total, 0) = 0
    then true
    else false
  end as close_ready
from public.accounting_period_closes apc
left join public.profiles closer on closer.id = apc.closed_by_profile_id
left join public.profiles reopener on reopener.id = apc.reopened_by_profile_id
left join lateral (
  select count(*) as open_tax_filing_count
  from public.sales_tax_filings f
  where f.filing_period_start >= apc.period_start
    and f.filing_period_end <= apc.period_end
    and coalesce(f.review_status, 'draft') not in ('filed','paid')
) tax on true
left join lateral (
  select count(*) as open_payroll_remittance_count
  from public.payroll_remittance_runs r
  where r.remittance_period_start >= apc.period_start
    and r.remittance_period_end <= apc.period_end
    and coalesce(r.review_status, 'draft') <> 'remitted'
) payroll on true
left join lateral (
  select
    count(*) filter (where coalesce(s.reconciliation_status, 'draft') <> 'closed') as open_reconciliation_count,
    coalesce(sum(coalesce(s.difference_amount, 0)) filter (where coalesce(s.reconciliation_status, 'draft') <> 'closed'), 0) as open_reconciliation_difference_total
  from public.bank_reconciliation_sessions s
  where coalesce(s.period_start, apc.period_start) >= apc.period_start
    and coalesce(s.period_end, apc.period_end) <= apc.period_end
) recon on true
left join lateral (
  select count(*) as package_count
  from public.accountant_handoff_exports e
  where e.entity_scope in ('accounting_period_close','period_close','accounting_close')
    and e.entity_id = apc.id::text
) pkg on true;

create or replace view public.v_accounting_reconciliation_manual_review_queue as
select
  brs.id as reconciliation_session_id,
  brs.session_code,
  brs.period_start,
  brs.period_end,
  brs.reconciliation_status,
  brs.bank_account_id,
  ba.account_name,
  brs.book_balance,
  brs.bank_balance,
  brs.difference_amount,
  bri.id as reconciliation_item_id,
  bri.item_date,
  bri.item_description,
  bri.amount,
  bri.match_status,
  bri.clearing_status,
  bri.difference_reason,
  case
    when bri.match_status = 'exception' or coalesce(brs.difference_amount, 0) <> 0 then 10
    when bri.match_status = 'partial' then 20
    when bri.match_status = 'unmatched' then 30
    when brs.reconciliation_status in ('draft','in_review','difference_pending') then 40
    else 90
  end as review_priority
from public.bank_reconciliation_sessions brs
left join public.bank_accounts ba on ba.id = brs.bank_account_id
left join public.bank_reconciliation_items bri on bri.reconciliation_session_id = brs.id
where brs.reconciliation_status in ('draft','in_review','difference_pending')
   or coalesce(bri.match_status, 'unmatched') in ('unmatched','partial','exception')
   or coalesce(bri.clearing_status, 'open') = 'open';

create or replace view public.v_accounting_close_package_delivery_queue as
select
  e.id,
  e.export_title,
  e.export_kind,
  e.entity_scope,
  e.entity_id,
  e.business_tax_setting_id,
  e.bundle_kind,
  e.package_status,
  e.delivery_channel,
  e.delivery_status,
  e.delivery_reference,
  e.delivered_to_email,
  e.delivered_at,
  e.finalised_at,
  e.generated_at,
  e.updated_at,
  coalesce(items.item_count, 0)::int as item_count,
  case
    when e.package_status = 'finalized' and e.delivery_status in ('pending','failed') then true
    when e.package_status = 'delivered' and e.delivery_status <> 'confirmed' then true
    else false
  end as needs_delivery_attention
from public.accountant_handoff_exports e
left join lateral (
  select count(*) as item_count
  from public.accountant_handoff_export_items i
  where i.export_id = e.id
) items on true
where e.package_status in ('prepared','reviewed','finalized','delivered')
   or e.delivery_status in ('pending','failed');
