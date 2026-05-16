-- Schema 106: admin command center, schema tracking, and health center.
-- 106_admin_command_center_schema_tracking_and_health.sql
-- Repaired in the 2026-05-14b pass so it creates schema tracking before views read it
-- and uses jobs.status instead of assuming jobs.job_status exists.

create table if not exists public.app_schema_versions (
  schema_version integer primary key,
  migration_key text,
  schema_name text,
  release_label text,
  description text,
  status text not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by text,
  notes text
);

alter table public.app_schema_versions add column if not exists migration_key text;
alter table public.app_schema_versions add column if not exists schema_name text;
alter table public.app_schema_versions add column if not exists release_label text;
alter table public.app_schema_versions add column if not exists description text;
alter table public.app_schema_versions add column if not exists status text not null default 'applied';
alter table public.app_schema_versions add column if not exists applied_at timestamptz not null default now();
alter table public.app_schema_versions add column if not exists applied_by text;
alter table public.app_schema_versions add column if not exists notes text;

insert into public.app_schema_versions (schema_version, migration_key, schema_name, release_label, description, status, notes)
values
  (105, '105_repo_cleanup_and_roadmap_refresh', '105_repo_cleanup_and_roadmap_refresh.sql', '2026-05-10a', 'Repo cleanup and roadmap refresh marker.', 'applied', 'Preserved baseline marker before schema tracking.'),
  (106, '106_admin_command_center_schema_tracking_and_health', '106_admin_command_center_schema_tracking_and_health.sql', '2026-05-15a', 'Admin command center, health dashboard, task inbox, and schema tracking support.', 'applied', 'Creates schema tracking before command/health views read it.')
on conflict (schema_version) do update set
  migration_key = excluded.migration_key,
  schema_name = excluded.schema_name,
  release_label = excluded.release_label,
  description = excluded.description,
  status = excluded.status,
  notes = excluded.notes,
  applied_at = coalesce(public.app_schema_versions.applied_at, now());

create or replace view public.v_app_schema_version_status as
select
  schema_version,
  coalesce(migration_key, regexp_replace(coalesce(schema_name, ''), '\.sql$', '')) as migration_key,
  schema_name,
  release_label,
  description,
  status,
  applied_at,
  applied_by,
  notes,
  schema_version = max(schema_version) over () as is_latest
from public.app_schema_versions
order by schema_version desc;

drop view if exists public.v_admin_home_command_center;
create view public.v_admin_home_command_center as
select
  now() as checked_at,
  (select count(*) from public.admin_notifications n where coalesce(n.decision_status, n.status, 'pending') in ('pending','needs_review','failed','dead_letter'))::int as pending_notification_count,
  (select count(*) from public.admin_notifications n where coalesce(n.email_status, '') in ('failed','dead_letter'))::int as failed_notification_count,
  (select count(*) from public.jobs j where coalesce(j.status, 'open') not in ('complete','completed','closed','cancelled','canceled'))::int as open_job_count,
  (select count(*) from public.accounting_period_closes c where coalesce(c.close_status, 'open') <> 'closed')::int as open_accounting_period_count,
  (select count(*) from public.bank_reconciliation_sessions s where coalesce(s.reconciliation_status, 'draft') <> 'closed')::int as open_reconciliation_count,
  (select count(*) from public.bank_reconciliation_items i where coalesce(i.match_status, 'unmatched') in ('unmatched','partial','exception'))::int as reconciliation_review_count,
  (select count(*) from public.sales_tax_filings f where coalesce(f.review_status, f.filing_status, 'draft') not in ('filed','paid'))::int as open_tax_filing_count,
  (select count(*) from public.payroll_remittance_runs r where coalesce(r.review_status, r.remittance_status, 'draft') <> 'remitted')::int as open_payroll_remittance_count,
  ((select count(*) from public.ar_payment_applications a where coalesce(a.application_status, 'draft') in ('draft','review','exception'))::int +
   (select count(*) from public.ap_payment_applications a where coalesce(a.application_status, 'draft') in ('draft','review','exception'))::int) as payment_application_attention_count,
  (select count(*) from public.accountant_handoff_exports e where coalesce(e.package_status, 'prepared') in ('prepared','reviewed','finalized') and coalesce(e.delivery_status, 'pending') <> 'confirmed')::int as package_delivery_attention_count,
  (select coalesce(max(schema_version), 0) from public.app_schema_versions where status = 'applied')::int as latest_schema_version;

drop view if exists public.v_admin_error_health_center;
create view public.v_admin_error_health_center as
select 'warning'::text as severity, 'schema'::text as source, 'Latest schema marker'::text as title,
       concat(schema_version::text, ' · ', coalesce(migration_key, schema_name, 'unknown'), ' · ', status) as message,
       applied_at as last_seen_at, 'health'::text as route_hint
from public.app_schema_versions
where schema_version = (select max(schema_version) from public.app_schema_versions)
union all
select 'warning', 'notifications', 'Failed notification delivery', concat(count(*)::text, ' failed/dead-letter notification(s).'), now(), 'notifications'
from public.admin_notifications
where coalesce(email_status, '') in ('failed','dead_letter')
having count(*) > 0
union all
select 'warning', 'accounting', 'Bank reconciliation review', concat(count(*)::text, ' reconciliation item(s) need review.'), now(), 'bank_reconciliation_item'
from public.bank_reconciliation_items
where coalesce(match_status, 'unmatched') in ('unmatched','partial','exception')
having count(*) > 0;

drop view if exists public.v_admin_task_inbox;
create view public.v_admin_task_inbox as
select 10::int as priority_rank, 'High'::text as priority_label, 'Failed notification delivery'::text as task_title,
       concat(title, ': ', message) as task_summary, 'messaging'::text as source_area, created_at as due_at,
       'notifications'::text as route_hint, id::text as entity_hint
from public.admin_notifications
where coalesce(email_status, '') in ('failed','dead_letter')
union all
select 20, 'High', 'Reconcile bank item', coalesce(item_description, 'Bank item needs manual review'),
       'accounting', created_at, 'bank_reconciliation_item', id::text
from public.bank_reconciliation_items
where coalesce(match_status, 'unmatched') in ('unmatched','partial','exception')
union all
select 30, 'Review', 'Accounting period still open', concat(period_code, ' · ', close_status),
       'accounting', period_end::timestamptz, 'accounting_period_close', id::text
from public.accounting_period_closes
where coalesce(close_status, 'open') <> 'closed';

drop view if exists public.v_role_dashboard_presets;
create view public.v_role_dashboard_presets as
select * from (values
  (1, 'admin', 'Command Center', 'home', 'Full command center, health, accounting, operations, and messaging.'),
  (2, 'supervisor', 'Supervisor Daily Dashboard', 'operations', 'Jobs, crews, attendance, HSE review, and evidence.'),
  (3, 'hse', 'Safety Review Dashboard', 'safety', 'Corrective actions, training, SDS, HSE proof, and incidents.'),
  (4, 'employee', 'Worker Mobile Dashboard', 'profile', 'Assigned forms, clock/outbox, training, and self-service records.')
) as t(sort_order, role_key, dashboard_label, default_section, notes);

drop view if exists public.v_schema_106_admin_command_center_health;
create view public.v_schema_106_admin_command_center_health as
select 106::int as schema_version, '106_admin_command_center_schema_tracking_and_health'::text as schema_marker, now() as checked_at,
       'Admin Command Center, App Health and Schema Center, task inbox, schema tracking, role dashboard presets, and live-schema fixes are installed.'::text as note;

grant select on public.app_schema_versions to authenticated;
grant select on public.v_app_schema_version_status to authenticated;
grant select on public.v_admin_home_command_center to authenticated;
grant select on public.v_admin_error_health_center to authenticated;
grant select on public.v_admin_task_inbox to authenticated;
grant select on public.v_role_dashboard_presets to authenticated;
grant select on public.v_schema_106_admin_command_center_health to authenticated;
