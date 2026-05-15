-- 079_job_financial_rollups_and_profit_review.sql
-- Adds labor-rate-aware job financial tracking, adjustment events, and accounting review rollups
-- for landscaping, recurring service, and custom project work.

create extension if not exists pgcrypto;

alter table if exists public.profiles
  add column if not exists hourly_cost_rate numeric(10,2),
  add column if not exists overtime_cost_rate numeric(10,2),
  add column if not exists hourly_bill_rate numeric(10,2),
  add column if not exists overtime_bill_rate numeric(10,2),
  add column if not exists payroll_burden_percent numeric(7,2);

create table if not exists public.job_financial_events (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references public.jobs(id) on delete cascade,
  job_session_id uuid references public.job_sessions(id) on delete set null,
  event_date date not null default current_date,
  event_type text not null default 'other',
  cost_amount numeric(12,2) not null default 0,
  revenue_amount numeric(12,2) not null default 0,
  quantity numeric(12,2),
  unit_cost numeric(12,2),
  unit_price numeric(12,2),
  is_billable boolean not null default false,
  vendor_id uuid references public.ap_vendors(id) on delete set null,
  tax_code_id uuid references public.tax_codes(id) on delete set null,
  gl_account_id uuid references public.chart_of_accounts(id) on delete set null,
  reference_number text,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.job_financial_events drop constraint if exists job_financial_events_type_check;
alter table if exists public.job_financial_events
  add constraint job_financial_events_type_check
  check (event_type in (
    'material',
    'equipment_repair',
    'delay',
    'fuel',
    'travel',
    'subcontract',
    'disposal',
    'permit',
    'revenue_adjustment',
    'discount_adjustment',
    'other'
  ));

create index if not exists idx_job_financial_events_job_id on public.job_financial_events(job_id, event_date desc, created_at desc);
create index if not exists idx_job_financial_events_session_id on public.job_financial_events(job_session_id, event_date desc);
create index if not exists idx_job_financial_events_type on public.job_financial_events(event_type, event_date desc);

create or replace view public.v_job_labor_rollups as
select
  jh.job_id,
  count(*)::int as labor_entry_count,
  coalesce(sum(jh.regular_hours), 0)::numeric(10,2) as regular_hours_total,
  coalesce(sum(jh.overtime_hours), 0)::numeric(10,2) as overtime_hours_total,
  coalesce(sum(jh.hours_worked), 0)::numeric(10,2) as hours_worked_total,
  coalesce(sum(
    (coalesce(jh.regular_hours, 0) * coalesce(p.hourly_cost_rate, 0) * (1 + (coalesce(p.payroll_burden_percent, 0) / 100.0)))
    + (coalesce(jh.overtime_hours, 0) * coalesce(p.overtime_cost_rate, p.hourly_cost_rate * 1.5, 0) * (1 + (coalesce(p.payroll_burden_percent, 0) / 100.0)))
  ), 0)::numeric(12,2) as labor_cost_total,
  coalesce(sum(
    (coalesce(jh.regular_hours, 0) * coalesce(p.hourly_bill_rate, 0))
    + (coalesce(jh.overtime_hours, 0) * coalesce(p.overtime_bill_rate, p.hourly_bill_rate * 1.5, 0))
  ), 0)::numeric(12,2) as labor_bill_total,
  max(jh.created_at) as last_labor_entry_at
from public.job_session_crew_hours jh
left join public.profiles p on p.id = jh.profile_id
group by jh.job_id;

create or replace view public.v_job_financial_event_rollups as
select
  jfe.job_id,
  count(*)::int as financial_event_count,
  count(*) filter (where coalesce(jfe.cost_amount, 0) > 0)::int as cost_event_count,
  count(*) filter (where coalesce(jfe.revenue_amount, 0) > 0)::int as revenue_event_count,
  count(*) filter (where jfe.is_billable = true and coalesce(jfe.revenue_amount, 0) > 0)::int as billable_event_count,
  coalesce(sum(coalesce(jfe.cost_amount, 0)), 0)::numeric(12,2) as cost_total,
  coalesce(sum(coalesce(jfe.revenue_amount, 0)), 0)::numeric(12,2) as revenue_total,
  max(jfe.event_date) as last_event_date,
  max(jfe.updated_at) as last_event_updated_at
from public.job_financial_events jfe
group by jfe.job_id;

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
  (coalesce(j.actual_cost_total, 0) + coalesce(j.delay_cost_total, 0) + coalesce(j.equipment_repair_cost_total, 0) + coalesce(labor.labor_cost_total, 0) + coalesce(fin.cost_total, 0))::numeric(12,2) as actual_cost_rollup_total,
  (coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0))::numeric(12,2) as actual_charge_rollup_total,
  ((coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0))
    - (coalesce(j.actual_cost_total, 0) + coalesce(j.delay_cost_total, 0) + coalesce(j.equipment_repair_cost_total, 0) + coalesce(labor.labor_cost_total, 0) + coalesce(fin.cost_total, 0)))::numeric(12,2) as actual_profit_rollup_total,
  case
    when (coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0)) > 0
      then round((((coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0))
        - (coalesce(j.actual_cost_total, 0) + coalesce(j.delay_cost_total, 0) + coalesce(j.equipment_repair_cost_total, 0) + coalesce(labor.labor_cost_total, 0) + coalesce(fin.cost_total, 0)))
        / (coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0))) * 100.0, 2)::numeric(7,2)
    else 0::numeric(7,2)
  end as actual_margin_rollup_percent,
  ((coalesce(j.actual_charge_total, 0) + coalesce(labor.labor_bill_total, 0) + coalesce(fin.revenue_total, 0)) - coalesce(j.quoted_charge_total, 0))::numeric(12,2) as charge_vs_quote_variance_total,
  ((coalesce(j.actual_cost_total, 0) + coalesce(j.delay_cost_total, 0) + coalesce(j.equipment_repair_cost_total, 0) + coalesce(labor.labor_cost_total, 0) + coalesce(fin.cost_total, 0)) - coalesce(j.estimated_cost_total, 0))::numeric(12,2) as cost_vs_estimate_variance_total
from public.jobs j
left join public.v_job_labor_rollups labor on labor.job_id = j.id
left join public.v_job_financial_event_rollups fin on fin.job_id = j.id
left join session_rollup sess on sess.job_id = j.id;

create or replace view public.v_job_financial_event_directory as
select
  jfe.id,
  jfe.job_id,
  j.job_code,
  j.job_name,
  jfe.job_session_id,
  js.session_date,
  jfe.event_date,
  jfe.event_type,
  jfe.cost_amount,
  jfe.revenue_amount,
  jfe.quantity,
  jfe.unit_cost,
  jfe.unit_price,
  jfe.is_billable,
  jfe.vendor_id,
  v.legal_name as vendor_name,
  jfe.tax_code_id,
  tc.code as tax_code,
  jfe.gl_account_id,
  coa.account_number,
  coa.account_name,
  jfe.reference_number,
  jfe.notes,
  jfe.created_by_profile_id,
  p.full_name as created_by_name,
  jfe.created_at,
  jfe.updated_at
from public.job_financial_events jfe
left join public.jobs j on j.id = jfe.job_id
left join public.job_sessions js on js.id = jfe.job_session_id
left join public.ap_vendors v on v.id = jfe.vendor_id
left join public.tax_codes tc on tc.id = jfe.tax_code_id
left join public.chart_of_accounts coa on coa.id = jfe.gl_account_id
left join public.profiles p on p.id = jfe.created_by_profile_id;

create or replace view public.v_jobs_directory as
select
  j.id,
  j.job_code,
  j.job_name,
  j.site_id,
  j.job_type,
  j.status,
  j.priority,
  j.client_name,
  j.start_date,
  j.end_date,
  j.site_supervisor_profile_id,
  j.signing_supervisor_profile_id,
  j.admin_profile_id,
  j.notes,
  j.created_by_profile_id,
  j.approval_status,
  j.approval_requested_at,
  j.approved_at,
  j.approved_by_profile_id,
  j.approval_notes,
  j.created_at,
  j.updated_at,
  s.site_code,
  s.site_name,
  sup.full_name as supervisor_name,
  signsup.full_name as signing_supervisor_name,
  adm.full_name as admin_name,
  j.crew_id,
  j.assigned_supervisor_profile_id,
  j.schedule_mode,
  j.recurrence_rule,
  j.recurrence_summary,
  j.recurrence_interval,
  j.recurrence_anchor_date,
  j.special_instructions,
  j.last_activity_at,
  crew.crew_name,
  assignedsup.full_name as assigned_supervisor_name,
  coalesce(crew_rollup.member_count, 0) as crew_member_count,
  coalesce(comment_rollup.comment_count, 0) as comment_count,
  coalesce(comment_rollup.photo_count, 0) as photo_count,
  crew.crew_code,
  j.job_family,
  j.project_scope,
  j.service_pattern,
  j.recurrence_basis,
  j.recurrence_custom_days,
  j.custom_schedule_notes,
  j.crew_lead_profile_id,
  j.equipment_planning_status,
  j.reservation_window_start,
  j.reservation_window_end,
  j.reservation_notes,
  j.estimated_visit_minutes,
  j.equipment_readiness_required,
  crew.crew_kind,
  crew.service_area_id,
  crew.default_equipment_notes,
  leadp.full_name as crew_lead_name,
  service_area.name as service_area_name,
  j.estimated_cost_total,
  j.quoted_charge_total,
  j.pricing_method,
  j.markup_percent,
  j.discount_mode,
  j.discount_value,
  j.tiered_discount_notes,
  j.estimated_profit_total,
  j.estimated_margin_percent,
  j.estimated_duration_hours,
  j.estimated_duration_days,
  j.open_end_date,
  j.delayed_schedule,
  j.delay_reason,
  j.delay_cost_total,
  j.equipment_repair_cost_total,
  j.actual_cost_total,
  j.actual_charge_total,
  j.actual_profit_total,
  j.actual_margin_percent,
  j.service_pricing_template_id,
  spt.template_code as service_pricing_template_code,
  spt.template_name as service_pricing_template_name,
  j.sales_tax_code_id,
  tc.code as sales_tax_code,
  tc.name as sales_tax_name,
  tc.tax_type as sales_tax_type,
  j.estimated_tax_rate_percent,
  j.estimated_tax_total,
  j.estimated_total_with_tax,
  j.pricing_basis_label,
  j.client_reference,
  j.service_contract_reference,
  j.billing_transaction_number,
  j.invoice_number,
  coalesce(session_rollup.session_count, 0)::int as session_count,
  coalesce(session_rollup.total_logged_minutes, 0)::int as total_logged_minutes,
  round(coalesce(session_rollup.total_logged_minutes, 0) / 60.0, 2) as total_logged_hours,
  session_rollup.last_session_started_at,
  session_rollup.last_session_ended_at,
  session_rollup.last_supervisor_signoff_at,
  coalesce(reassignment_rollup.reassignment_count, 0)::int as reassignment_count,
  coalesce(crew_hours_rollup.logged_hours_total, 0)::numeric(10,2) as logged_hours_total,
  coalesce(fin.labor_entry_count, 0)::int as labor_entry_count,
  coalesce(fin.regular_hours_total, 0)::numeric(10,2) as regular_hours_total,
  coalesce(fin.overtime_hours_total, 0)::numeric(10,2) as overtime_hours_total,
  coalesce(fin.labor_cost_total, 0)::numeric(12,2) as actual_labor_cost_total,
  coalesce(fin.labor_bill_total, 0)::numeric(12,2) as actual_labor_bill_total,
  coalesce(fin.financial_event_count, 0)::int as financial_event_count,
  coalesce(fin.financial_event_cost_total, 0)::numeric(12,2) as financial_event_cost_total,
  coalesce(fin.financial_event_revenue_total, 0)::numeric(12,2) as financial_event_revenue_total,
  coalesce(fin.open_session_count, 0)::int as open_job_session_count,
  coalesce(fin.unsigned_session_count, 0)::int as unsigned_job_session_count,
  coalesce(fin.actual_cost_rollup_total, 0)::numeric(12,2) as actual_cost_rollup_total,
  coalesce(fin.actual_charge_rollup_total, 0)::numeric(12,2) as actual_charge_rollup_total,
  coalesce(fin.actual_profit_rollup_total, 0)::numeric(12,2) as actual_profit_rollup_total,
  coalesce(fin.actual_margin_rollup_percent, 0)::numeric(7,2) as actual_margin_rollup_percent,
  coalesce(fin.charge_vs_quote_variance_total, 0)::numeric(12,2) as charge_vs_quote_variance_total,
  coalesce(fin.cost_vs_estimate_variance_total, 0)::numeric(12,2) as cost_vs_estimate_variance_total
from public.jobs j
left join public.sites s on s.id = j.site_id
left join public.profiles sup on sup.id = j.site_supervisor_profile_id
left join public.profiles signsup on signsup.id = j.signing_supervisor_profile_id
left join public.profiles adm on adm.id = j.admin_profile_id
left join public.crews crew on crew.id = j.crew_id
left join public.profiles assignedsup on assignedsup.id = j.assigned_supervisor_profile_id
left join public.profiles leadp on leadp.id = j.crew_lead_profile_id
left join public.service_areas service_area on service_area.id = crew.service_area_id
left join public.service_pricing_templates spt on spt.id = j.service_pricing_template_id
left join public.tax_codes tc on tc.id = j.sales_tax_code_id
left join (
  select crew_id, count(*)::int as member_count
  from public.crew_members
  group by crew_id
) crew_rollup on crew_rollup.crew_id = j.crew_id
left join (
  select jc.job_id, count(*)::int as comment_count, coalesce(sum(v.photo_count), 0)::int as photo_count
  from public.job_comments jc
  left join public.v_job_comment_activity v on v.id = jc.id
  group by jc.job_id
) comment_rollup on comment_rollup.job_id = j.id
left join (
  select job_id,
    count(*)::int as session_count,
    sum(coalesce(duration_minutes, 0))::int as total_logged_minutes,
    max(started_at) as last_session_started_at,
    max(ended_at) as last_session_ended_at,
    max(site_supervisor_signed_off_at) as last_supervisor_signoff_at
  from public.v_job_session_directory
  group by job_id
) session_rollup on session_rollup.job_id = j.id
left join (
  select job_id, sum(coalesce(hours_worked, 0))::numeric(10,2) as logged_hours_total
  from public.job_session_crew_hours
  group by job_id
) crew_hours_rollup on crew_hours_rollup.job_id = j.id
left join (
  select source_job_id as job_id, count(*)::int as reassignment_count
  from public.job_reassignment_events
  group by source_job_id
) reassignment_rollup on reassignment_rollup.job_id = j.id
left join public.v_job_financial_rollups fin on fin.job_id = j.id;

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
    count(*) filter (where coalesce(status, '') in ('completed','done','closed') and coalesce(invoice_number, '') = '')::int as completed_uninvoiced_job_count,
    count(*) filter (where coalesce(delayed_schedule, false) = true)::int as delayed_job_count,
    count(*) filter (where coalesce(unsigned_job_session_count, 0) > 0)::int as unsigned_job_session_count,
    count(*) filter (where coalesce(actual_profit_rollup_total, 0) < 0)::int as loss_making_job_count,
    count(*) filter (where coalesce(financial_event_count, 0) > 0)::int as jobs_with_financial_events_count,
    coalesce(sum(coalesce(actual_profit_rollup_total, 0)), 0)::numeric(12,2) as actual_rollup_profit_total
  from public.v_jobs_directory
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
  jr.actual_rollup_profit_total
from batch_rollup br
cross join exception_rollup er
cross join ar_rollup ar
cross join ap_rollup ap
cross join traffic_rollup tr
cross join job_rollup jr;
