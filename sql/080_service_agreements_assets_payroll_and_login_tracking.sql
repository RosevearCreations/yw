-- 080_service_agreements_assets_payroll_and_login_tracking.sql
-- Extends the landscaping/service-management backbone with:
-- - recurring service agreements and snow-trigger logs
-- - change orders for custom and active jobs
-- - customer assets and per-asset service history
-- - payroll export tracking and burden-aware review views
-- - login-event auditing for admin visibility
-- - material-to-job auto-cost rollups and route profitability summaries

create extension if not exists pgcrypto;

create table if not exists public.account_login_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  event_type text not null default 'login',
  auth_source text not null default 'session_restore',
  success boolean not null default true,
  route_fragment text,
  session_fingerprint text,
  ip_address text,
  user_agent text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table if exists public.account_login_events drop constraint if exists account_login_events_type_check;
alter table if exists public.account_login_events
  add constraint account_login_events_type_check
  check (event_type in ('login','session_restore','password_reset','logout','account_setup'));

create index if not exists idx_account_login_events_profile_id on public.account_login_events(profile_id, occurred_at desc);
create index if not exists idx_account_login_events_success on public.account_login_events(success, occurred_at desc);

create or replace view public.v_profile_access_rollups as
with latest as (
  select distinct on (ale.profile_id)
    ale.profile_id,
    ale.occurred_at as last_login_at,
    ale.auth_source as last_login_source,
    ale.route_fragment as last_login_route,
    ale.user_agent as last_login_user_agent
  from public.account_login_events ale
  where ale.success = true
  order by ale.profile_id, ale.occurred_at desc, ale.created_at desc
)
select
  p.id,
  count(ale.id)::int as login_event_count,
  count(*) filter (where ale.success = true)::int as successful_login_count,
  count(*) filter (where ale.success = false)::int as failed_login_count,
  max(ale.occurred_at) filter (where ale.success = true) as last_login_at,
  max(ale.occurred_at) as last_access_event_at,
  l.last_login_source,
  l.last_login_route,
  l.last_login_user_agent
from public.profiles p
left join public.account_login_events ale on ale.profile_id = p.id
left join latest l on l.profile_id = p.id
group by p.id, l.last_login_source, l.last_login_route, l.last_login_user_agent;

create table if not exists public.recurring_service_agreements (
  id uuid primary key default gen_random_uuid(),
  agreement_code text not null unique,
  client_id uuid references public.clients(id) on delete set null,
  client_site_id uuid references public.client_sites(id) on delete set null,
  service_pricing_template_id uuid references public.service_pricing_templates(id) on delete set null,
  route_id uuid references public.routes(id) on delete set null,
  crew_id uuid references public.crews(id) on delete set null,
  tax_code_id uuid references public.tax_codes(id) on delete set null,
  service_name text not null,
  agreement_status text not null default 'draft',
  billing_method text not null default 'per_visit',
  service_pattern text,
  recurrence_basis text,
  recurrence_rule text,
  recurrence_interval integer not null default 1,
  start_date date,
  end_date date,
  open_end_date boolean not null default false,
  visit_estimated_minutes integer,
  visit_estimated_duration_hours numeric(8,2),
  visit_cost_total numeric(12,2) not null default 0,
  visit_charge_total numeric(12,2) not null default 0,
  markup_percent numeric(7,2),
  discount_mode text not null default 'none',
  discount_value numeric(12,2) not null default 0,
  tiered_discount_notes text,
  event_trigger_type text,
  snow_trigger_threshold_cm numeric(8,2),
  trigger_notes text,
  pricing_notes text,
  service_notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.recurring_service_agreements drop constraint if exists recurring_service_agreements_status_check;
alter table if exists public.recurring_service_agreements
  add constraint recurring_service_agreements_status_check
  check (agreement_status in ('draft','active','paused','completed','cancelled'));

alter table if exists public.recurring_service_agreements drop constraint if exists recurring_service_agreements_billing_method_check;
alter table if exists public.recurring_service_agreements
  add constraint recurring_service_agreements_billing_method_check
  check (billing_method in ('per_visit','flat_period','seasonal','event_trigger','time_and_material'));

alter table if exists public.recurring_service_agreements drop constraint if exists recurring_service_agreements_discount_mode_check;
alter table if exists public.recurring_service_agreements
  add constraint recurring_service_agreements_discount_mode_check
  check (discount_mode in ('none','percent','fixed','tiered'));

alter table if exists public.recurring_service_agreements drop constraint if exists recurring_service_agreements_event_trigger_check;
alter table if exists public.recurring_service_agreements
  add constraint recurring_service_agreements_event_trigger_check
  check (event_trigger_type is null or event_trigger_type in ('snow_cm','snow_event','ice_event','manual'));

create index if not exists idx_recurring_service_agreements_client_site on public.recurring_service_agreements(client_site_id, agreement_status);
create index if not exists idx_recurring_service_agreements_route on public.recurring_service_agreements(route_id, agreement_status);

create table if not exists public.snow_event_triggers (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.recurring_service_agreements(id) on delete cascade,
  event_date date not null default current_date,
  event_label text,
  snowfall_cm numeric(8,2),
  threshold_cm numeric(8,2),
  trigger_met boolean not null default false,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_snow_event_triggers_agreement on public.snow_event_triggers(agreement_id, event_date desc);

create table if not exists public.change_orders (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references public.jobs(id) on delete cascade,
  agreement_id uuid references public.recurring_service_agreements(id) on delete set null,
  change_order_number text not null unique,
  status text not null default 'draft',
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by_profile_id uuid references public.profiles(id) on delete set null,
  scope_summary text not null,
  reason text,
  estimated_cost_delta numeric(12,2) not null default 0,
  estimated_charge_delta numeric(12,2) not null default 0,
  actual_cost_delta numeric(12,2) not null default 0,
  actual_charge_delta numeric(12,2) not null default 0,
  tax_code_id uuid references public.tax_codes(id) on delete set null,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.change_orders drop constraint if exists change_orders_status_check;
alter table if exists public.change_orders
  add constraint change_orders_status_check
  check (status in ('draft','requested','approved','rejected','completed','void'));

create index if not exists idx_change_orders_job on public.change_orders(job_id, requested_at desc);

create table if not exists public.customer_assets (
  id uuid primary key default gen_random_uuid(),
  asset_code text not null unique,
  client_id uuid references public.clients(id) on delete set null,
  client_site_id uuid references public.client_sites(id) on delete set null,
  asset_name text not null,
  asset_type text not null default 'site_feature',
  serial_number text,
  install_date date,
  warranty_expiry_date date,
  manufacturer text,
  model text,
  location_notes text,
  service_notes text,
  is_active boolean not null default true,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customer_assets_site on public.customer_assets(client_site_id, is_active);

create table if not exists public.customer_asset_job_links (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.customer_assets(id) on delete cascade,
  job_id bigint not null references public.jobs(id) on delete cascade,
  service_date date,
  event_type text not null default 'service',
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.customer_asset_job_links drop constraint if exists customer_asset_job_links_type_check;
alter table if exists public.customer_asset_job_links
  add constraint customer_asset_job_links_type_check
  check (event_type in ('service','inspection','repair','warranty','callback','installation','replacement'));

create index if not exists idx_customer_asset_job_links_asset on public.customer_asset_job_links(asset_id, service_date desc, created_at desc);
create index if not exists idx_customer_asset_job_links_job on public.customer_asset_job_links(job_id, service_date desc, created_at desc);

create table if not exists public.warranty_callback_events (
  id uuid primary key default gen_random_uuid(),
  job_id bigint references public.jobs(id) on delete set null,
  asset_id uuid references public.customer_assets(id) on delete set null,
  client_site_id uuid references public.client_sites(id) on delete set null,
  callback_number text not null unique,
  callback_type text not null default 'callback',
  status text not null default 'open',
  warranty_covered boolean not null default false,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  estimated_cost_total numeric(12,2) not null default 0,
  actual_cost_total numeric(12,2) not null default 0,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table if exists public.warranty_callback_events drop constraint if exists warranty_callback_events_type_check;
alter table if exists public.warranty_callback_events
  add constraint warranty_callback_events_type_check
  check (callback_type in ('callback','warranty','service_revisit','deficiency'));

alter table if exists public.warranty_callback_events drop constraint if exists warranty_callback_events_status_check;
alter table if exists public.warranty_callback_events
  add constraint warranty_callback_events_status_check
  check (status in ('open','scheduled','in_progress','closed','void'));

create table if not exists public.payroll_export_runs (
  id uuid primary key default gen_random_uuid(),
  run_code text not null unique,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft',
  exported_at timestamptz,
  exported_by_profile_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.payroll_export_runs drop constraint if exists payroll_export_runs_status_check;
alter table if exists public.payroll_export_runs
  add constraint payroll_export_runs_status_check
  check (status in ('draft','ready','exported','void'));

alter table if exists public.job_session_crew_hours
  add column if not exists payroll_export_run_id uuid references public.payroll_export_runs(id) on delete set null,
  add column if not exists payroll_exported_at timestamptz;

create or replace view public.v_payroll_review_detail as
select
  jh.id,
  jh.job_id,
  j.job_code,
  j.job_name,
  jh.job_session_id,
  js.session_date,
  jh.profile_id,
  p.full_name,
  p.employee_number,
  coalesce(jh.regular_hours, 0)::numeric(10,2) as regular_hours,
  coalesce(jh.overtime_hours, 0)::numeric(10,2) as overtime_hours,
  coalesce(jh.hours_worked, 0)::numeric(10,2) as hours_worked,
  coalesce(p.hourly_cost_rate, 0)::numeric(10,2) as hourly_cost_rate,
  coalesce(p.overtime_cost_rate, coalesce(p.hourly_cost_rate, 0) * 1.5, 0)::numeric(10,2) as overtime_cost_rate,
  coalesce(p.payroll_burden_percent, 0)::numeric(7,2) as payroll_burden_percent,
  (
    (coalesce(jh.regular_hours, 0) * coalesce(p.hourly_cost_rate, 0) * (1 + (coalesce(p.payroll_burden_percent, 0) / 100.0)))
    + (coalesce(jh.overtime_hours, 0) * coalesce(p.overtime_cost_rate, coalesce(p.hourly_cost_rate, 0) * 1.5, 0) * (1 + (coalesce(p.payroll_burden_percent, 0) / 100.0)))
  )::numeric(12,2) as payroll_cost_total,
  jh.payroll_export_run_id,
  per.run_code as payroll_export_run_code,
  jh.payroll_exported_at,
  (jh.payroll_export_run_id is null) as needs_export,
  jh.created_at,
  jh.updated_at
from public.job_session_crew_hours jh
left join public.jobs j on j.id = jh.job_id
left join public.job_sessions js on js.id = jh.job_session_id
left join public.profiles p on p.id = jh.profile_id
left join public.payroll_export_runs per on per.id = jh.payroll_export_run_id;

create or replace view public.v_payroll_review_summary as
select
  date_trunc('week', coalesce(js.session_date::timestamp, jh.created_at))::date as week_start,
  jh.profile_id,
  p.full_name,
  p.employee_number,
  count(*)::int as labor_entry_count,
  coalesce(sum(coalesce(jh.regular_hours, 0)), 0)::numeric(10,2) as regular_hours_total,
  coalesce(sum(coalesce(jh.overtime_hours, 0)), 0)::numeric(10,2) as overtime_hours_total,
  coalesce(sum(coalesce(jh.hours_worked, 0)), 0)::numeric(10,2) as hours_worked_total,
  coalesce(sum(
    (coalesce(jh.regular_hours, 0) * coalesce(p.hourly_cost_rate, 0) * (1 + (coalesce(p.payroll_burden_percent, 0) / 100.0)))
    + (coalesce(jh.overtime_hours, 0) * coalesce(p.overtime_cost_rate, coalesce(p.hourly_cost_rate, 0) * 1.5, 0) * (1 + (coalesce(p.payroll_burden_percent, 0) / 100.0)))
  ), 0)::numeric(12,2) as payroll_cost_total,
  count(*) filter (where jh.payroll_export_run_id is null)::int as unexported_entry_count,
  coalesce(sum(case when jh.payroll_export_run_id is null then coalesce(jh.hours_worked, 0) else 0 end), 0)::numeric(10,2) as unexported_hours_total,
  coalesce(sum(case when jh.payroll_export_run_id is null then (
    (coalesce(jh.regular_hours, 0) * coalesce(p.hourly_cost_rate, 0) * (1 + (coalesce(p.payroll_burden_percent, 0) / 100.0)))
    + (coalesce(jh.overtime_hours, 0) * coalesce(p.overtime_cost_rate, coalesce(p.hourly_cost_rate, 0) * 1.5, 0) * (1 + (coalesce(p.payroll_burden_percent, 0) / 100.0)))
  ) else 0 end), 0)::numeric(12,2) as unexported_payroll_cost_total,
  max(jh.payroll_exported_at) as last_exported_at
from public.job_session_crew_hours jh
left join public.job_sessions js on js.id = jh.job_session_id
left join public.profiles p on p.id = jh.profile_id
group by date_trunc('week', coalesce(js.session_date::timestamp, jh.created_at))::date, jh.profile_id, p.full_name, p.employee_number;

create or replace view public.v_job_material_rollups as
with receipt_rollup as (
  select
    wo.legacy_job_id::bigint as job_id,
    count(distinct mr.id)::int as receipt_count,
    coalesce(sum(coalesce(mrl.line_total, 0)), 0)::numeric(12,2) as receipt_cost_total,
    max(mr.receipt_date) as last_receipt_date
  from public.material_receipts mr
  join public.material_receipt_lines mrl on mrl.receipt_id = mr.id
  join public.work_orders wo on wo.id = mr.work_order_id
  where wo.legacy_job_id is not null
  group by wo.legacy_job_id
), issue_rollup as (
  select
    wo.legacy_job_id::bigint as job_id,
    count(distinct mi.id)::int as issue_count,
    coalesce(sum(coalesce(mil.line_total, 0)), 0)::numeric(12,2) as issue_cost_total,
    max(mi.issue_date) as last_issue_date
  from public.material_issues mi
  join public.material_issue_lines mil on mil.issue_id = mi.id
  join public.work_orders wo on wo.id = mi.work_order_id
  where wo.legacy_job_id is not null
  group by wo.legacy_job_id
)
select
  coalesce(rr.job_id, ir.job_id) as job_id,
  coalesce(rr.receipt_count, 0)::int as receipt_count,
  coalesce(rr.receipt_cost_total, 0)::numeric(12,2) as receipt_cost_total,
  rr.last_receipt_date,
  coalesce(ir.issue_count, 0)::int as issue_count,
  coalesce(ir.issue_cost_total, 0)::numeric(12,2) as issue_cost_total,
  ir.last_issue_date,
  case
    when coalesce(ir.issue_cost_total, 0) > 0 then coalesce(ir.issue_cost_total, 0)
    else coalesce(rr.receipt_cost_total, 0)
  end::numeric(12,2) as auto_material_cost_total
from receipt_rollup rr
full outer join issue_rollup ir on ir.job_id = rr.job_id;

create or replace view public.v_job_change_order_rollups as
select
  co.job_id,
  count(*)::int as change_order_count,
  count(*) filter (where co.status = 'approved')::int as approved_change_order_count,
  coalesce(sum(case when co.status = 'approved' then coalesce(co.estimated_cost_delta, 0) else 0 end), 0)::numeric(12,2) as approved_estimated_cost_delta_total,
  coalesce(sum(case when co.status = 'approved' then coalesce(co.estimated_charge_delta, 0) else 0 end), 0)::numeric(12,2) as approved_estimated_charge_delta_total,
  coalesce(sum(case when co.status = 'completed' then coalesce(co.actual_cost_delta, 0) else 0 end), 0)::numeric(12,2) as completed_actual_cost_delta_total,
  coalesce(sum(case when co.status = 'completed' then coalesce(co.actual_charge_delta, 0) else 0 end), 0)::numeric(12,2) as completed_actual_charge_delta_total,
  max(co.requested_at) as last_change_order_requested_at
from public.change_orders co
group by co.job_id;

create or replace view public.v_customer_asset_history as
select
  l.id,
  l.asset_id,
  a.asset_code,
  a.asset_name,
  a.asset_type,
  a.client_id,
  a.client_site_id,
  l.job_id,
  j.job_code,
  j.job_name,
  l.service_date,
  l.event_type,
  l.notes,
  l.created_by_profile_id,
  p.full_name as created_by_name,
  l.created_at,
  l.updated_at
from public.customer_asset_job_links l
left join public.customer_assets a on a.id = l.asset_id
left join public.jobs j on j.id = l.job_id
left join public.profiles p on p.id = l.created_by_profile_id;

create or replace view public.v_route_profitability_summary as
with job_route as (
  select
    wo.legacy_job_id::bigint as job_id,
    min(wo.route_id::text)::uuid as route_id
  from public.work_orders wo
  where wo.legacy_job_id is not null
    and wo.route_id is not null
  group by wo.legacy_job_id
)
select
  jr.route_id,
  r.route_code,
  r.name as route_name,
  jd.service_area_id,
  jd.service_area_name,
  jd.crew_id,
  jd.crew_name,
  count(*)::int as job_count,
  coalesce(sum(coalesce(jd.session_count, 0)), 0)::int as session_count,
  coalesce(sum(coalesce(jd.actual_cost_rollup_total, 0)), 0)::numeric(12,2) as actual_cost_rollup_total,
  coalesce(sum(coalesce(jd.actual_charge_rollup_total, 0)), 0)::numeric(12,2) as actual_charge_rollup_total,
  coalesce(sum(coalesce(jd.actual_profit_rollup_total, 0)), 0)::numeric(12,2) as actual_profit_rollup_total,
  case
    when coalesce(sum(coalesce(jd.actual_charge_rollup_total, 0)), 0) > 0
      then round(
        (
          coalesce(sum(coalesce(jd.actual_profit_rollup_total, 0)), 0)
          / coalesce(sum(coalesce(jd.actual_charge_rollup_total, 0)), 0)
        ) * 100.0,
        2
      )::numeric(7,2)
    else 0::numeric(7,2)
  end as actual_margin_percent,
  max(jd.last_activity_at) as last_activity_at
from public.v_jobs_directory jd
left join job_route jr on jr.job_id = jd.id
left join public.routes r on r.id = jr.route_id
group by
  jr.route_id,
  r.route_code,
  r.name,
  jd.service_area_id,
  jd.service_area_name,
  jd.crew_id,
  jd.crew_name;

create or replace view public.v_job_financial_rollups as
with session_rollup as (
  select
    js.job_id,
    count(*)::int as session_count,
    count(*) filter (where coalesce(js.session_status, '') in ('planned','in_progress','delayed','paused'))::int as open_session_count,
    count(*) filter (where js.site_supervisor_signed_off_at is null and coalesce(js.site_supervisor_signoff_name, '') = '')::int as unsigned_session_count,
    max(js.started_at) as last_session_started_at,
    max(js.ended_at) as last_session_ended_at,
    max(js.site_supervisor_signed_off_at) as last_supervisor_signoff_at
  from public.job_sessions js
  group by js.job_id
)
select
  j.id as job_id,
  coalesce(labor.labor_entry_count, 0)::int as labor_entry_count,
  coalesce(labor.regular_hours_total, 0)::numeric(10,2) as regular_hours_total,
  coalesce(labor.overtime_hours_total, 0)::numeric(10,2) as overtime_hours_total,
  coalesce(labor.hours_worked_total, 0)::numeric(10,2) as hours_worked_total,
  coalesce(labor.labor_cost_total, 0)::numeric(12,2) as labor_cost_total,
  coalesce(labor.labor_bill_total, 0)::numeric(12,2) as labor_bill_total,
  coalesce(fin.financial_event_count, 0)::int as financial_event_count,
  coalesce(fin.cost_event_count, 0)::int as cost_event_count,
  coalesce(fin.revenue_event_count, 0)::int as revenue_event_count,
  coalesce(fin.billable_event_count, 0)::int as billable_event_count,
  coalesce(fin.cost_total, 0)::numeric(12,2) as financial_event_cost_total,
  coalesce(fin.revenue_total, 0)::numeric(12,2) as financial_event_revenue_total,
  coalesce(sess.session_count, 0)::int as session_count,
  coalesce(sess.open_session_count, 0)::int as open_session_count,
  coalesce(sess.unsigned_session_count, 0)::int as unsigned_session_count,
  sess.last_session_started_at,
  sess.last_session_ended_at,
  sess.last_supervisor_signoff_at,
  (coalesce(j.actual_cost_total, 0) + coalesce(j.delay_cost_total, 0) + coalesce(j.equipment_repair_cost_total, 0) + coalesce(labor.labor_cost_total, 0) + coalesce(fin.cost_total, 0) + coalesce(mat.auto_material_cost_total, 0))::numeric(12,2) as actual_cost_rollup_total,
  (coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0))::numeric(12,2) as actual_charge_rollup_total,
  ((coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0))
    - (coalesce(j.actual_cost_total, 0) + coalesce(j.delay_cost_total, 0) + coalesce(j.equipment_repair_cost_total, 0) + coalesce(labor.labor_cost_total, 0) + coalesce(fin.cost_total, 0) + coalesce(mat.auto_material_cost_total, 0)))::numeric(12,2) as actual_profit_rollup_total,
  case
    when (coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0)) > 0
      then round((((coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0))
        - (coalesce(j.actual_cost_total, 0) + coalesce(j.delay_cost_total, 0) + coalesce(j.equipment_repair_cost_total, 0) + coalesce(labor.labor_cost_total, 0) + coalesce(fin.cost_total, 0) + coalesce(mat.auto_material_cost_total, 0)))
        / (coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0))) * 100.0, 2)::numeric(7,2)
    else 0::numeric(7,2)
  end as actual_margin_rollup_percent,
  ((coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0)) - coalesce(j.quoted_charge_total, 0))::numeric(12,2) as charge_vs_quote_variance_total,
  ((coalesce(j.actual_cost_total, 0) + coalesce(j.delay_cost_total, 0) + coalesce(j.equipment_repair_cost_total, 0) + coalesce(labor.labor_cost_total, 0) + coalesce(fin.cost_total, 0) + coalesce(mat.auto_material_cost_total, 0)) - coalesce(j.estimated_cost_total, 0))::numeric(12,2) as cost_vs_estimate_variance_total,
  coalesce(mat.receipt_count, 0)::int as material_receipt_count,
  coalesce(mat.receipt_cost_total, 0)::numeric(12,2) as material_receipt_cost_total,
  mat.last_receipt_date,
  coalesce(mat.issue_count, 0)::int as material_issue_count,
  coalesce(mat.issue_cost_total, 0)::numeric(12,2) as material_issue_cost_total,
  mat.last_issue_date,
  coalesce(mat.auto_material_cost_total, 0)::numeric(12,2) as auto_material_cost_total,
  coalesce(co.change_order_count, 0)::int as change_order_count,
  coalesce(co.approved_change_order_count, 0)::int as approved_change_order_count,
  coalesce(co.approved_estimated_cost_delta_total, 0)::numeric(12,2) as approved_change_order_estimated_cost_delta_total,
  coalesce(co.approved_estimated_charge_delta_total, 0)::numeric(12,2) as approved_change_order_estimated_charge_delta_total,
  coalesce(co.completed_actual_cost_delta_total, 0)::numeric(12,2) as completed_change_order_actual_cost_delta_total,
  coalesce(co.completed_actual_charge_delta_total, 0)::numeric(12,2) as completed_change_order_actual_charge_delta_total,
  co.last_change_order_requested_at
from public.jobs j
left join public.v_job_labor_rollups labor on labor.job_id = j.id
left join public.v_job_financial_event_rollups fin on fin.job_id = j.id
left join session_rollup sess on sess.job_id = j.id
left join public.v_job_material_rollups mat on mat.job_id = j.id
left join public.v_job_change_order_rollups co on co.job_id = j.id;

create or replace view public.v_accounting_review_summary as
with batch_rollup as (
  select
    count(*)::int as batch_count,
    count(*) filter (where coalesce(batch_status, '') <> 'posted')::int as unposted_batch_count,
    count(*) filter (where coalesce(is_balanced, false) = false)::int as unbalanced_batch_count,
    count(*) filter (where coalesce(source_sync_state, '') in ('stale', 'out_of_sync', 'needs_review'))::int as stale_source_batch_count,
    max(source_synced_at) as last_source_synced_at
  from public.v_gl_journal_batch_rollups
),
exception_rollup as (
  select
    count(*)::int as sync_exception_count,
    count(*) filter (where exception_status = 'open')::int as open_sync_exception_count,
    count(*) filter (where exception_status = 'open' and severity in ('warning','error'))::int as warning_or_error_sync_exception_count,
    max(last_seen_at) as last_sync_exception_at
  from public.v_gl_journal_sync_exceptions
),
ar_rollup as (
  select
    count(*) filter (where record_type = 'ar_invoice' and coalesce(balance_due, 0) > 0)::int as open_ar_record_count,
    coalesce(sum(case when record_type = 'ar_invoice' then balance_due else 0 end), 0)::numeric(12,2) as open_ar_balance
  from public.v_account_balance_rollups
),
ap_rollup as (
  select
    count(*) filter (where record_type = 'ap_bill' and coalesce(balance_due, 0) > 0)::int as open_ap_record_count,
    coalesce(sum(case when record_type = 'ap_bill' then balance_due else 0 end), 0)::numeric(12,2) as open_ap_balance
  from public.v_account_balance_rollups
),
traffic_rollup as (
  select
    max(event_date) as latest_daily_event_date,
    max(total_events) filter (where event_date = (select max(event_date) from public.v_app_traffic_daily_summary)) as latest_daily_total_events
  from public.v_app_traffic_daily_summary
),
job_rollup as (
  select
    count(*) filter (where coalesce(j.status, '') in ('completed','done','closed') and coalesce(j.invoice_number, '') = '')::int as completed_uninvoiced_job_count,
    count(*) filter (where coalesce(j.delayed_schedule, false) = true)::int as delayed_job_count,
    count(*) filter (where coalesce(jf.unsigned_session_count, 0) > 0)::int as unsigned_job_session_count,
    count(*) filter (where coalesce(jf.actual_profit_rollup_total, 0) < 0)::int as loss_making_job_count,
    count(*) filter (where coalesce(jf.financial_event_count, 0) > 0)::int as jobs_with_financial_events_count,
    coalesce(sum(coalesce(jf.actual_profit_rollup_total, 0)), 0)::numeric(12,2) as actual_rollup_profit_total,
    count(*) filter (where coalesce(jf.change_order_count, 0) > 0)::int as jobs_with_change_orders_count
  from public.jobs j
  left join public.v_job_financial_rollups jf on jf.job_id = j.id
),
payroll_rollup as (
  select
    count(*)::int as payroll_week_count,
    coalesce(sum(unexported_entry_count), 0)::int as unexported_payroll_entry_count,
    coalesce(sum(unexported_payroll_cost_total), 0)::numeric(12,2) as unexported_payroll_cost_total
  from public.v_payroll_review_summary
),
agreement_rollup as (
  select
    count(*) filter (where agreement_status = 'active')::int as active_recurring_agreement_count,
    count(*) filter (where coalesce(event_trigger_type, '') like 'snow%')::int as snow_trigger_agreement_count
  from public.recurring_service_agreements
),
callback_rollup as (
  select
    count(*) filter (where status <> 'closed')::int as open_callback_count,
    count(*) filter (where warranty_covered = true and status <> 'closed')::int as open_warranty_callback_count
  from public.warranty_callback_events
)
select
  br.batch_count,
  br.unposted_batch_count,
  br.unbalanced_batch_count,
  br.stale_source_batch_count,
  br.last_source_synced_at,
  er.sync_exception_count,
  er.open_sync_exception_count,
  er.warning_or_error_sync_exception_count,
  er.last_sync_exception_at,
  ar.open_ar_record_count,
  ar.open_ar_balance,
  ap.open_ap_record_count,
  ap.open_ap_balance,
  tr.latest_daily_event_date,
  tr.latest_daily_total_events,
  jr.completed_uninvoiced_job_count,
  jr.delayed_job_count,
  jr.unsigned_job_session_count,
  jr.loss_making_job_count,
  jr.jobs_with_financial_events_count,
  jr.actual_rollup_profit_total,
  pr.payroll_week_count,
  pr.unexported_payroll_entry_count,
  pr.unexported_payroll_cost_total,
  agr.active_recurring_agreement_count,
  agr.snow_trigger_agreement_count,
  jr.jobs_with_change_orders_count,
  cb.open_callback_count,
  cb.open_warranty_callback_count
from batch_rollup br
cross join exception_rollup er
cross join ar_rollup ar
cross join ap_rollup ap
cross join traffic_rollup tr
cross join job_rollup jr
cross join payroll_rollup pr
cross join agreement_rollup agr
cross join callback_rollup cb;
