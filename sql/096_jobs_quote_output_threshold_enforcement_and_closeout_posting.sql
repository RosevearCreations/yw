-- 096_jobs_quote_output_threshold_enforcement_and_closeout_posting.sql
-- Extends the commercial Jobs workflow with:
-- - branded printable/email quote output
-- - automatic threshold evaluations
-- - completion closeout evidence linkage
-- - invoice/journal candidate posting rules
-- - accountant handoff exports
-- - profitability/variance scorecards

alter table if exists public.estimate_quote_packages
  add column if not exists brand_name text,
  add column if not exists brand_tagline text,
  add column if not exists brand_email text,
  add column if not exists brand_phone text,
  add column if not exists brand_address text,
  add column if not exists printable_html text,
  add column if not exists email_subject text,
  add column if not exists email_body text,
  add column if not exists last_rendered_at timestamptz,
  add column if not exists last_sent_via text,
  add column if not exists accepted_signature_name text,
  add column if not exists render_payload jsonb not null default '{}'::jsonb;

create table if not exists public.quote_package_output_events (
  id uuid primary key default gen_random_uuid(),
  quote_package_id uuid not null references public.estimate_quote_packages(id) on delete cascade,
  output_type text not null default 'printable_html',
  output_status text not null default 'rendered',
  recipient_email text,
  email_subject text,
  output_payload jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.quote_package_output_events
  drop constraint if exists quote_package_output_events_type_check;
alter table if exists public.quote_package_output_events
  add constraint quote_package_output_events_type_check
  check (output_type in ('printable_html','email','client_acceptance'));

alter table if exists public.quote_package_output_events
  drop constraint if exists quote_package_output_events_status_check;
alter table if exists public.quote_package_output_events
  add constraint quote_package_output_events_status_check
  check (output_status in ('rendered','sent','accepted','failed'));

create table if not exists public.work_order_release_threshold_evaluations (
  id uuid primary key default gen_random_uuid(),
  work_order_release_review_id uuid references public.work_order_release_reviews(id) on delete cascade,
  threshold_id uuid references public.commercial_approval_thresholds(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,
  evaluated_status text not null default 'pass',
  evaluation_message text,
  discount_percent numeric(7,2) not null default 0,
  margin_percent numeric(7,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  required_signoff_role text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table if exists public.work_order_release_threshold_evaluations
  drop constraint if exists work_order_release_threshold_evaluations_status_check;
alter table if exists public.work_order_release_threshold_evaluations
  add constraint work_order_release_threshold_evaluations_status_check
  check (evaluated_status in ('pass','warn','block'));

create table if not exists public.job_completion_closeout_assets (
  id uuid primary key default gen_random_uuid(),
  closeout_item_id uuid not null references public.job_completion_closeout_items(id) on delete cascade,
  asset_kind text not null default 'url',
  label text,
  asset_url text,
  source_table text,
  source_id text,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.job_completion_closeout_assets
  drop constraint if exists job_completion_closeout_assets_kind_check;
alter table if exists public.job_completion_closeout_assets
  add constraint job_completion_closeout_assets_kind_check
  check (asset_kind in ('url','job_comment_attachment','submission_image','equipment_evidence','signature','file'));

create table if not exists public.invoice_candidate_posting_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null,
  applies_to_scope text not null default 'global',
  applies_to_value text,
  require_approved_completion boolean not null default true,
  require_released_work_order boolean not null default true,
  require_closeout_complete boolean not null default true,
  ar_account_id uuid references public.chart_of_accounts(id) on delete set null,
  offset_account_id uuid references public.chart_of_accounts(id) on delete set null,
  tax_liability_account_id uuid references public.chart_of_accounts(id) on delete set null,
  is_active boolean not null default true,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journal_candidate_posting_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null,
  applies_to_scope text not null default 'global',
  applies_to_value text,
  require_approved_completion boolean not null default true,
  require_closeout_complete boolean not null default true,
  revenue_account_id uuid references public.chart_of_accounts(id) on delete set null,
  cogs_account_id uuid references public.chart_of_accounts(id) on delete set null,
  wip_account_id uuid references public.chart_of_accounts(id) on delete set null,
  variance_account_id uuid references public.chart_of_accounts(id) on delete set null,
  is_active boolean not null default true,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accountant_handoff_exports (
  id uuid primary key default gen_random_uuid(),
  export_kind text not null default 'closeout_bundle',
  entity_scope text not null default 'completion_review',
  entity_id text not null,
  business_tax_setting_id uuid references public.business_tax_settings(id) on delete set null,
  export_status text not null default 'draft',
  export_title text,
  export_markdown text,
  export_payload jsonb not null default '{}'::jsonb,
  generated_by_profile_id uuid references public.profiles(id) on delete set null,
  generated_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.accountant_handoff_exports
  drop constraint if exists accountant_handoff_exports_kind_check;
alter table if exists public.accountant_handoff_exports
  add constraint accountant_handoff_exports_kind_check
  check (export_kind in ('t2_package','llc_package','closeout_bundle','invoice_review','journal_review'));

alter table if exists public.accountant_handoff_exports
  drop constraint if exists accountant_handoff_exports_status_check;
alter table if exists public.accountant_handoff_exports
  add constraint accountant_handoff_exports_status_check
  check (export_status in ('draft','generated','delivered','archived'));

create or replace view public.v_quote_package_output_directory as
select
  qp.id,
  qp.estimate_id,
  e.estimate_number,
  e.quote_title,
  qp.business_tax_setting_id,
  bts.profile_name as tax_profile_name,
  bts.legal_entity_type,
  qp.package_status,
  qp.rendered_title,
  qp.client_email,
  qp.brand_name,
  qp.brand_tagline,
  qp.email_subject,
  qp.last_rendered_at,
  qp.sent_at,
  qp.accepted_at,
  qp.last_sent_via,
  qp.accepted_signature_name,
  qp.public_token,
  coalesce(count(qoe.id), 0)::int as output_event_count,
  max(qoe.created_at) as last_output_event_at,
  qp.created_at,
  qp.updated_at
from public.estimate_quote_packages qp
left join public.estimates e on e.id = qp.estimate_id
left join public.business_tax_settings bts on bts.id = qp.business_tax_setting_id
left join public.quote_package_output_events qoe on qoe.quote_package_id = qp.id
group by qp.id, e.estimate_number, e.quote_title, bts.profile_name, bts.legal_entity_type;

create or replace view public.v_work_order_threshold_evaluation_directory as
select
  te.id,
  te.work_order_release_review_id,
  te.threshold_id,
  cat.threshold_name,
  te.work_order_id,
  wo.work_order_number,
  te.estimate_id,
  e.estimate_number,
  te.evaluated_status,
  te.evaluation_message,
  te.discount_percent,
  te.margin_percent,
  te.total_amount,
  te.required_signoff_role,
  te.created_by_profile_id,
  coalesce(p.full_name, p.email, '') as created_by_name,
  te.created_at
from public.work_order_release_threshold_evaluations te
left join public.commercial_approval_thresholds cat on cat.id = te.threshold_id
left join public.work_orders wo on wo.id = te.work_order_id
left join public.estimates e on e.id = te.estimate_id
left join public.profiles p on p.id = te.created_by_profile_id;

create or replace view public.v_job_closeout_evidence_directory as
select
  ca.id,
  ca.closeout_item_id,
  ci.completion_review_id,
  cr.job_id,
  j.job_code,
  j.job_name,
  cr.work_order_id,
  wo.work_order_number,
  ca.asset_kind,
  ca.label,
  ca.asset_url,
  ca.source_table,
  ca.source_id,
  ca.notes,
  ca.created_by_profile_id,
  coalesce(p.full_name, p.email, '') as created_by_name,
  ca.created_at,
  ca.updated_at
from public.job_completion_closeout_assets ca
left join public.job_completion_closeout_items ci on ci.id = ca.closeout_item_id
left join public.job_completion_reviews cr on cr.id = ci.completion_review_id
left join public.jobs j on j.id = cr.job_id
left join public.work_orders wo on wo.id = cr.work_order_id
left join public.profiles p on p.id = ca.created_by_profile_id;

create or replace view public.v_invoice_candidate_posting_rule_directory as
select
  r.id,
  r.rule_name,
  r.applies_to_scope,
  r.applies_to_value,
  r.require_approved_completion,
  r.require_released_work_order,
  r.require_closeout_complete,
  r.ar_account_id,
  coa.account_number as ar_account_number,
  coa.account_name as ar_account_name,
  r.offset_account_id,
  offa.account_number as offset_account_number,
  offa.account_name as offset_account_name,
  r.tax_liability_account_id,
  taxa.account_number as tax_account_number,
  taxa.account_name as tax_account_name,
  r.is_active,
  r.notes,
  r.created_at,
  r.updated_at
from public.invoice_candidate_posting_rules r
left join public.chart_of_accounts coa on coa.id = r.ar_account_id
left join public.chart_of_accounts offa on offa.id = r.offset_account_id
left join public.chart_of_accounts taxa on taxa.id = r.tax_liability_account_id;

create or replace view public.v_journal_candidate_posting_rule_directory as
select
  r.id,
  r.rule_name,
  r.applies_to_scope,
  r.applies_to_value,
  r.require_approved_completion,
  r.require_closeout_complete,
  r.revenue_account_id,
  rev.account_number as revenue_account_number,
  rev.account_name as revenue_account_name,
  r.cogs_account_id,
  cogs.account_number as cogs_account_number,
  cogs.account_name as cogs_account_name,
  r.wip_account_id,
  wip.account_number as wip_account_number,
  wip.account_name as wip_account_name,
  r.variance_account_id,
  var.account_number as variance_account_number,
  var.account_name as variance_account_name,
  r.is_active,
  r.notes,
  r.created_at,
  r.updated_at
from public.journal_candidate_posting_rules r
left join public.chart_of_accounts rev on rev.id = r.revenue_account_id
left join public.chart_of_accounts cogs on cogs.id = r.cogs_account_id
left join public.chart_of_accounts wip on wip.id = r.wip_account_id
left join public.chart_of_accounts var on var.id = r.variance_account_id;

create or replace view public.v_accountant_handoff_export_directory as
select
  ah.id,
  ah.export_kind,
  ah.entity_scope,
  ah.entity_id,
  ah.business_tax_setting_id,
  bts.profile_name as tax_profile_name,
  bts.legal_entity_type,
  bts.federal_return_type,
  bts.provincial_return_type,
  bts.usa_tax_classification,
  ah.export_status,
  ah.export_title,
  ah.generated_by_profile_id,
  coalesce(p.full_name, p.email, '') as generated_by_name,
  ah.generated_at,
  ah.delivered_at,
  ah.created_at,
  ah.updated_at
from public.accountant_handoff_exports ah
left join public.business_tax_settings bts on bts.id = ah.business_tax_setting_id
left join public.profiles p on p.id = ah.generated_by_profile_id;

create or replace view public.v_job_profitability_variance_directory as
with base as (
  select
    j.id as job_id,
    j.job_code,
    j.job_name,
    coalesce(j.job_family, 'unclassified') as job_family,
    coalesce(st.site_code, st.site_name, 'No site') as site_label,
    coalesce(sp.full_name, sup.full_name, 'Unassigned') as supervisor_label,
    coalesce(rt.route_code, rt.name, 'No route') as route_label,
    coalesce(j.quoted_charge_total, 0)::numeric(12,2) as quoted_total,
    coalesce(j.estimated_cost_total, 0)::numeric(12,2) as estimated_cost_total,
    coalesce(j.actual_charge_rollup_total, j.actual_charge_total, 0)::numeric(12,2) as actual_revenue_total,
    coalesce(j.actual_cost_rollup_total, j.actual_cost_total, 0)::numeric(12,2) as actual_cost_total,
    coalesce(j.actual_profit_rollup_total, j.actual_profit_total, 0)::numeric(12,2) as actual_profit_total
  from public.v_jobs_directory j
  left join public.work_orders wo on wo.legacy_job_id = j.id
  left join public.routes rt on rt.id = wo.route_id
  left join public.sites st on st.id = j.site_id
  left join public.profiles sp on sp.id = j.assigned_supervisor_profile_id
  left join public.profiles sup on sup.id = j.site_supervisor_profile_id
)
select
  'job'::text as group_type,
  job_code as group_key,
  job_name as group_label,
  count(*)::int as job_count,
  sum(quoted_total)::numeric(12,2) as quoted_total,
  sum(estimated_cost_total)::numeric(12,2) as estimated_cost_total,
  sum(actual_revenue_total)::numeric(12,2) as actual_revenue_total,
  sum(actual_cost_total)::numeric(12,2) as actual_cost_total,
  sum(actual_profit_total)::numeric(12,2) as actual_profit_total,
  sum(actual_revenue_total - quoted_total)::numeric(12,2) as revenue_variance_total,
  sum(actual_cost_total - estimated_cost_total)::numeric(12,2) as cost_variance_total
from base group by job_code, job_name
union all
select
  'site', site_label, site_label, count(*)::int,
  sum(quoted_total)::numeric(12,2), sum(estimated_cost_total)::numeric(12,2),
  sum(actual_revenue_total)::numeric(12,2), sum(actual_cost_total)::numeric(12,2),
  sum(actual_profit_total)::numeric(12,2),
  sum(actual_revenue_total - quoted_total)::numeric(12,2),
  sum(actual_cost_total - estimated_cost_total)::numeric(12,2)
from base group by site_label
union all
select
  'supervisor', supervisor_label, supervisor_label, count(*)::int,
  sum(quoted_total)::numeric(12,2), sum(estimated_cost_total)::numeric(12,2),
  sum(actual_revenue_total)::numeric(12,2), sum(actual_cost_total)::numeric(12,2),
  sum(actual_profit_total)::numeric(12,2),
  sum(actual_revenue_total - quoted_total)::numeric(12,2),
  sum(actual_cost_total - estimated_cost_total)::numeric(12,2)
from base group by supervisor_label
union all
select
  'route', route_label, route_label, count(*)::int,
  sum(quoted_total)::numeric(12,2), sum(estimated_cost_total)::numeric(12,2),
  sum(actual_revenue_total)::numeric(12,2), sum(actual_cost_total)::numeric(12,2),
  sum(actual_profit_total)::numeric(12,2),
  sum(actual_revenue_total - quoted_total)::numeric(12,2),
  sum(actual_cost_total - estimated_cost_total)::numeric(12,2)
from base group by route_label
union all
select
  'job_family', job_family, job_family, count(*)::int,
  sum(quoted_total)::numeric(12,2), sum(estimated_cost_total)::numeric(12,2),
  sum(actual_revenue_total)::numeric(12,2), sum(actual_cost_total)::numeric(12,2),
  sum(actual_profit_total)::numeric(12,2),
  sum(actual_revenue_total - quoted_total)::numeric(12,2),
  sum(actual_cost_total - estimated_cost_total)::numeric(12,2)
from base group by job_family;
