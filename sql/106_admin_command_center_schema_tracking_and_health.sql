-- Patch: create the schema tracking table expected by schema 106.
-- Safe to run before re-running the v_admin_home_command_center view.

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  schema_name text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

insert into public.app_schema_versions (
  schema_version,
  schema_name,
  description,
  status,
  notes
)
values (
  106,
  '106_admin_command_center_schema_tracking_and_health.sql',
  'Admin command center, health dashboard, task inbox, and schema tracking support.',
  'applied',
  'Created after live database was missing public.app_schema_versions.'
)
on conflict (schema_version) do update
set
  schema_name = excluded.schema_name,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = now();

drop view if exists public.v_admin_home_command_center;

create view public.v_admin_home_command_center as
select
  now() as checked_at,

  (
    select count(*)
    from public.admin_notifications n
    where coalesce(n.decision_status, n.status, 'pending')
      in ('pending','needs_review','failed','dead_letter')
  )::int as pending_notification_count,

  (
    select count(*)
    from public.admin_notifications n
    where coalesce(n.email_status, '') in ('failed','dead_letter')
  )::int as failed_notification_count,

  (
    select count(*)
    from public.jobs j
    where coalesce(j.status, 'open')
      not in ('complete','completed','closed','cancelled','canceled')
  )::int as open_job_count,

  (
    select count(*)
    from public.accounting_period_closes c
    where coalesce(c.close_status, 'open') <> 'closed'
  )::int as open_accounting_period_count,

  (
    select count(*)
    from public.bank_reconciliation_sessions s
    where coalesce(s.reconciliation_status, 'draft') <> 'closed'
  )::int as open_reconciliation_count,

  (
    select count(*)
    from public.bank_reconciliation_items i
    where coalesce(i.match_status, 'unmatched') in ('unmatched','partial','exception')
  )::int as reconciliation_review_count,

  (
    select count(*)
    from public.sales_tax_filings f
    where coalesce(f.review_status, f.filing_status, 'draft') not in ('filed','paid')
  )::int as open_tax_filing_count,

  (
    select count(*)
    from public.payroll_remittance_runs r
    where coalesce(r.review_status, r.remittance_status, 'draft') <> 'remitted'
  )::int as open_payroll_remittance_count,

  (
    select count(*)
    from public.ar_payment_applications a
    where coalesce(a.application_status, 'draft') in ('draft','review','exception')
  )::int
  +
  (
    select count(*)
    from public.ap_payment_applications a
    where coalesce(a.application_status, 'draft') in ('draft','review','exception')
  )::int as payment_application_attention_count,

  (
    select count(*)
    from public.accountant_handoff_exports e
    where coalesce(e.package_status, 'prepared') in ('prepared','reviewed','finalized')
      and coalesce(e.delivery_status, 'pending') <> 'confirmed'
  )::int as package_delivery_attention_count,

  (
    select coalesce(max(schema_version), 0)
    from public.app_schema_versions
    where status = 'applied'
  )::int as latest_schema_version;

grant select on public.v_admin_home_command_center to authenticated;
grant select on public.app_schema_versions to authenticated;
