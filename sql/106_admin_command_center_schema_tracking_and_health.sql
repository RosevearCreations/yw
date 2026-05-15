-- 106_admin_command_center_schema_tracking_and_health.sql
-- Admin Command Center, app health center, schema version tracking, role dashboard presets, and DB-backed task inbox.
-- This migration makes the app feel more production-ready by exposing live operational status to the Admin UI.

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  migration_key text not null unique,
  release_label text,
  status text not null default 'applied' check (status in ('planned','applied','failed','rolled_back')),
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

insert into public.app_schema_versions (schema_version, migration_key, release_label, status, notes)
values
  (105, '105_repo_cleanup_and_roadmap_refresh', '2026-05-10a', 'applied', 'Baseline marker preserved for the cleaned Markdown and roadmap pass before schema tracking was introduced.'),
  (106, '106_admin_command_center_schema_tracking_and_health', '2026-05-15a', 'applied', 'Adds Admin Home Command Center, app health/schema views, role dashboard presets, and DB-backed task inbox views.')
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  release_label = excluded.release_label,
  status = excluded.status,
  applied_at = coalesce(public.app_schema_versions.applied_at, now()),
  notes = excluded.notes;

create or replace view public.v_app_schema_version_status as
select
  schema_version,
  migration_key,
  release_label,
  status,
  applied_at,
  applied_by,
  notes,
  schema_version = max(schema_version) over () as is_latest
from public.app_schema_versions
order by schema_version desc;

create or replace view public.v_role_dashboard_presets as
select * from (values
  ('admin'::text, 10::int, 'Admin Command Center'::text, 'Open Command Center, App Health and Schema Center, Admin Task Inbox, Close Center, Jobs, HSE Ops, and Approvals.'::text, 'home'::text),
  ('supervisor'::text, 20::int, 'Supervisor Operations'::text, 'Open Jobs, HSE Review, crew time, route execution, evidence review, and worker follow-up.'::text, 'operations'::text),
  ('hse'::text, 30::int, 'HSE Review Center'::text, 'Open HSE Ops, incidents, inspections, corrective actions, training/SDS, and evidence proof.'::text, 'safety'::text),
  ('job_admin'::text, 40::int, 'Jobs and Accounting Prep'::text, 'Open estimates, work orders, invoice candidates, job journals, bank reconciliation, and accountant package prep.'::text, 'accounting'::text),
  ('accountant'::text, 50::int, 'Accounting Close Review'::text, 'Open close status, trial balance support, tax/remittance review, reconciliation exceptions, and handoff exports.'::text, 'accounting'::text),
  ('employee'::text, 60::int, 'Worker Self-Service'::text, 'Open assigned forms, training/SDS prompts, time clock, and personal profile recovery details.'::text, 'self'::text)
) as presets(role_key, sort_order, preset_title, preset_summary, default_admin_section);

create or replace view public.v_admin_home_command_center as
select
  now() as checked_at,
  (select count(*) from public.admin_notifications n where coalesce(n.decision_status, n.status, 'pending') in ('pending','needs_review','failed','dead_letter'))::int as pending_notification_count,
  (select count(*) from public.admin_notifications n where coalesce(n.email_status, '') in ('failed','dead_letter'))::int as failed_notification_count,
  (select count(*) from public.jobs j where coalesce(j.job_status, 'open') not in ('complete','completed','closed','cancelled','canceled'))::int as open_job_count,
  (select count(*) from public.accounting_period_closes c where coalesce(c.close_status, 'open') <> 'closed')::int as open_accounting_period_count,
  (select count(*) from public.bank_reconciliation_sessions s where coalesce(s.reconciliation_status, 'draft') <> 'closed')::int as open_reconciliation_count,
  (select count(*) from public.bank_reconciliation_items i where coalesce(i.match_status, 'unmatched') in ('unmatched','partial','exception'))::int as reconciliation_review_count,
  (select count(*) from public.sales_tax_filings f where coalesce(f.review_status, f.filing_status, 'draft') not in ('filed','paid'))::int as open_tax_filing_count,
  (select count(*) from public.payroll_remittance_runs r where coalesce(r.review_status, r.remittance_status, 'draft') <> 'remitted')::int as open_payroll_remittance_count,
  (select count(*) from public.ar_payment_applications a where coalesce(a.application_status, 'draft') in ('draft','review','exception'))::int
    + (select count(*) from public.ap_payment_applications a where coalesce(a.application_status, 'draft') in ('draft','review','exception'))::int as payment_application_attention_count,
  (select count(*) from public.accountant_handoff_exports e where coalesce(e.package_status, 'prepared') in ('prepared','reviewed','finalized') and coalesce(e.delivery_status, 'pending') <> 'confirmed')::int as package_delivery_attention_count,
  (select coalesce(max(schema_version), 0) from public.app_schema_versions where status = 'applied')::int as latest_schema_version;

create or replace view public.v_admin_error_health_center as
select * from (
  select
    'notification_delivery'::text as source,
    case when coalesce(n.email_status, '') in ('failed','dead_letter') then 'error' else 'warning' end as severity,
    case when coalesce(n.email_status, '') in ('failed','dead_letter') then 1 else 2 end as severity_rank,
    'Notification delivery needs review'::text as title,
    concat(coalesce(n.title, n.notification_type, 'Notification'), ' · ', coalesce(n.email_status, n.status, 'pending')) as message,
    n.created_at as last_seen_at,
    'messaging'::text as route_hint
  from public.admin_notifications n
  where coalesce(n.email_status, '') in ('failed','dead_letter')
     or coalesce(n.decision_status, n.status, 'pending') in ('failed','dead_letter')

  union all

  select
    'bank_reconciliation'::text as source,
    'warning'::text as severity,
    2::int as severity_rank,
    'Bank reconciliation exception'::text as title,
    concat(coalesce(i.item_description, 'Bank item'), ' · ', coalesce(i.match_status, 'unmatched')) as message,
    coalesce(i.updated_at, i.created_at, i.item_date::timestamptz) as last_seen_at,
    'accounting'::text as route_hint
  from public.bank_reconciliation_items i
  where coalesce(i.match_status, 'unmatched') in ('unmatched','partial','exception')

  union all

  select
    'accounting_close'::text as source,
    case when coalesce(c.close_status, 'open') = 'blocked' then 'error' else 'warning' end as severity,
    case when coalesce(c.close_status, 'open') = 'blocked' then 1 else 2 end as severity_rank,
    'Accounting period still open'::text as title,
    concat(coalesce(c.period_code, 'Period'), ' · ', coalesce(c.close_status, 'open')) as message,
    coalesce(c.updated_at, c.created_at, c.period_end::timestamptz) as last_seen_at,
    'accounting'::text as route_hint
  from public.accounting_period_closes c
  where coalesce(c.close_status, 'open') <> 'closed'

  union all

  select
    'schema'::text as source,
    case when status = 'applied' then 'ok' else 'warning' end as severity,
    case when status = 'applied' then 9 else 2 end as severity_rank,
    'Schema migration marker'::text as title,
    concat(schema_version::text, ' · ', migration_key, ' · ', status) as message,
    applied_at as last_seen_at,
    'health'::text as route_hint
  from public.app_schema_versions
  where schema_version = (select max(schema_version) from public.app_schema_versions)
) health
order by severity_rank asc, last_seen_at desc nulls last;

create or replace view public.v_admin_task_inbox as
select * from (
  select
    10::int as priority_rank,
    'High'::text as priority_label,
    'Notification needs approval or delivery review'::text as task_title,
    coalesce(n.title, n.message, n.notification_type, 'Admin notification') as task_summary,
    'messaging'::text as source_area,
    n.created_at as due_at,
    'admin'::text as route_hint,
    'admin_notification'::text as entity_hint,
    n.id as entity_id
  from public.admin_notifications n
  where coalesce(n.decision_status, n.status, 'pending') in ('pending','needs_review','failed','dead_letter')

  union all

  select
    15::int as priority_rank,
    'High'::text as priority_label,
    'Bank reconciliation item needs manual review'::text as task_title,
    concat(coalesce(i.item_description, 'Bank item'), ' · ', coalesce(i.match_status, 'unmatched')) as task_summary,
    'accounting'::text as source_area,
    coalesce(i.item_date::timestamptz, i.created_at) as due_at,
    'admin'::text as route_hint,
    'bank_reconciliation_item'::text as entity_hint,
    i.id as entity_id
  from public.bank_reconciliation_items i
  where coalesce(i.match_status, 'unmatched') in ('unmatched','partial','exception')

  union all

  select
    20::int as priority_rank,
    'High'::text as priority_label,
    'Accounting close needs attention'::text as task_title,
    concat(coalesce(c.period_code, 'Period'), ' · ', coalesce(c.close_status, 'open')) as task_summary,
    'accounting'::text as source_area,
    coalesce(c.period_end::timestamptz, c.updated_at, c.created_at) as due_at,
    'admin'::text as route_hint,
    'accounting_period_close'::text as entity_hint,
    c.id as entity_id
  from public.accounting_period_closes c
  where coalesce(c.close_status, 'open') <> 'closed'

  union all

  select
    30::int as priority_rank,
    'Review'::text as priority_label,
    'Sales tax filing review'::text as task_title,
    concat(coalesce(f.filing_code, 'Sales tax filing'), ' · ', coalesce(f.review_status, f.filing_status, 'draft')) as task_summary,
    'accounting'::text as source_area,
    coalesce(f.due_date::timestamptz, f.filing_period_end::timestamptz, f.updated_at) as due_at,
    'admin'::text as route_hint,
    'sales_tax_filing'::text as entity_hint,
    f.id as entity_id
  from public.sales_tax_filings f
  where coalesce(f.review_status, f.filing_status, 'draft') not in ('filed','paid')

  union all

  select
    35::int as priority_rank,
    'Review'::text as priority_label,
    'Payroll remittance review'::text as task_title,
    concat(coalesce(r.remittance_code, 'Payroll remittance'), ' · ', coalesce(r.review_status, r.remittance_status, 'draft')) as task_summary,
    'accounting'::text as source_area,
    coalesce(r.due_date::timestamptz, r.remittance_period_end::timestamptz, r.updated_at) as due_at,
    'admin'::text as route_hint,
    'payroll_remittance_run'::text as entity_hint,
    r.id as entity_id
  from public.payroll_remittance_runs r
  where coalesce(r.review_status, r.remittance_status, 'draft') <> 'remitted'

  union all

  select
    40::int as priority_rank,
    'Review'::text as priority_label,
    'Corrective action follow-up'::text as task_title,
    concat(coalesce(t.task_title, 'Corrective action'), ' · ', coalesce(t.status, 'open')) as task_summary,
    'hse'::text as source_area,
    coalesce(t.due_date::timestamptz, t.updated_at, t.created_at) as due_at,
    'hseops'::text as route_hint,
    'corrective_action_task'::text as entity_hint,
    t.id as entity_id
  from public.corrective_action_tasks t
  where coalesce(t.status, 'open') not in ('closed','complete','completed','cancelled','canceled')

  union all

  select
    45::int as priority_rank,
    'Review'::text as priority_label,
    'Training record expired or missing review'::text as task_title,
    concat(coalesce(c.course_name, 'Training'), ' · ', coalesce(r.completion_status, 'needs review')) as task_summary,
    'hse'::text as source_area,
    coalesce(r.expires_at, r.updated_at, r.created_at) as due_at,
    'reports'::text as route_hint,
    'training_record'::text as entity_hint,
    r.id as entity_id
  from public.training_records r
  left join public.training_courses c on c.id = r.course_id
  where coalesce(r.completion_status, 'active') in ('expired','scheduled','in_progress')
     or (r.expires_at is not null and r.expires_at < now())
) tasks
order by priority_rank asc, due_at asc nulls last;

create or replace view public.v_schema_106_admin_command_center_health as
select
  now() as checked_at,
  '106_admin_command_center_schema_tracking_and_health'::text as schema_marker,
  'ok'::text as status,
  'Admin Command Center, App Health and Schema Center, task inbox, schema tracking, role dashboard presets, refreshed docs, and cleanup guardrails are installed.'::text as note;

comment on table public.app_schema_versions is
  'Tracks applied schema/version markers so the Admin UI can show live DB migration status instead of relying only on repository files.';

comment on view public.v_admin_home_command_center is
  'High-level Admin Home Command Center counts for open jobs, HSE review, accounting close, reconciliation, payment applications, package delivery, and schema status.';

comment on view public.v_admin_error_health_center is
  'Central admin health feed for delivery failures, reconciliation exceptions, open accounting close work, and schema status.';

comment on view public.v_admin_task_inbox is
  'DB-backed admin task inbox for notifications, accounting close/reconciliation/tax/remittance review, corrective actions, and training follow-up.';
