-- 095_jobs_quote_approval_release_and_accounting_candidates.sql
-- Adds the next commercial layer for Jobs:
-- - client-ready quote package rendering
-- - approval thresholds and release controls
-- - completion package drilldown
-- - invoice / journal candidates and AR/AP review coordination
-- - business-entity and tax profile mapping for corporation / LLC style filings

alter table if exists public.business_tax_settings
  add column if not exists legal_entity_type text not null default 'corp_canada',
  add column if not exists legal_entity_name text,
  add column if not exists federal_return_type text,
  add column if not exists provincial_return_type text,
  add column if not exists usa_entity_type text,
  add column if not exists usa_tax_classification text,
  add column if not exists business_number text,
  add column if not exists corporation_number text,
  add column if not exists ein text,
  add column if not exists state_filing_state text,
  add column if not exists llc_tax_election text,
  add column if not exists default_ar_account_id uuid references public.chart_of_accounts(id) on delete set null,
  add column if not exists default_unbilled_revenue_account_id uuid references public.chart_of_accounts(id) on delete set null,
  add column if not exists default_deferred_revenue_account_id uuid references public.chart_of_accounts(id) on delete set null,
  add column if not exists default_wip_account_id uuid references public.chart_of_accounts(id) on delete set null,
  add column if not exists default_job_cogs_account_id uuid references public.chart_of_accounts(id) on delete set null,
  add column if not exists default_tax_liability_account_id uuid references public.chart_of_accounts(id) on delete set null;

alter table if exists public.business_tax_settings
  drop constraint if exists business_tax_settings_entity_type_check;
alter table if exists public.business_tax_settings
  add constraint business_tax_settings_entity_type_check
  check (legal_entity_type in ('corp_canada','corp_us','llc_us','sole_prop','partnership','other'));

create table if not exists public.commercial_approval_thresholds (
  id uuid primary key default gen_random_uuid(),
  threshold_name text not null,
  entity_type text not null default 'estimate',
  applies_to_scope text not null default 'global',
  applies_to_value text,
  discount_percent_cap numeric(7,2),
  fixed_discount_cap numeric(12,2),
  minimum_margin_percent numeric(7,2),
  maximum_total_without_approval numeric(12,2),
  required_signoff_role text not null default 'supervisor',
  hard_block boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.commercial_approval_thresholds
  drop constraint if exists commercial_approval_thresholds_entity_type_check;
alter table if exists public.commercial_approval_thresholds
  add constraint commercial_approval_thresholds_entity_type_check
  check (entity_type in ('estimate','work_order','job_completion_review'));

alter table if exists public.commercial_approval_thresholds
  drop constraint if exists commercial_approval_thresholds_scope_check;
alter table if exists public.commercial_approval_thresholds
  add constraint commercial_approval_thresholds_scope_check
  check (applies_to_scope in ('global','job_family','service_pattern','client','site','route','job'));

create index if not exists idx_commercial_approval_thresholds_active
  on public.commercial_approval_thresholds(entity_type, is_active, applies_to_scope, applies_to_value);

create table if not exists public.estimate_quote_packages (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  business_tax_setting_id uuid references public.business_tax_settings(id) on delete set null,
  package_status text not null default 'draft',
  render_version text,
  rendered_title text,
  rendered_markdown text,
  rendered_html text,
  public_token text not null default encode(gen_random_bytes(12), 'hex'),
  client_email text,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  accepted_by_name text,
  acceptance_notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(estimate_id)
);

alter table if exists public.estimate_quote_packages
  drop constraint if exists estimate_quote_packages_status_check;
alter table if exists public.estimate_quote_packages
  add constraint estimate_quote_packages_status_check
  check (package_status in ('draft','rendered','sent','accepted','expired'));

create index if not exists idx_estimate_quote_packages_status
  on public.estimate_quote_packages(package_status, sent_at desc, accepted_at desc);

create table if not exists public.work_order_release_reviews (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,
  release_status text not null default 'draft',
  threshold_status text not null default 'pass',
  discount_percent numeric(7,2) not null default 0,
  margin_percent numeric(7,2) not null default 0,
  required_signoff_role text,
  release_notes text,
  signoff_profile_id uuid references public.profiles(id) on delete set null,
  signoff_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(work_order_id)
);

alter table if exists public.work_order_release_reviews
  drop constraint if exists work_order_release_reviews_status_check;
alter table if exists public.work_order_release_reviews
  add constraint work_order_release_reviews_status_check
  check (release_status in ('draft','pending','approved','rejected','released','blocked'));

alter table if exists public.work_order_release_reviews
  drop constraint if exists work_order_release_reviews_threshold_check;
alter table if exists public.work_order_release_reviews
  add constraint work_order_release_reviews_threshold_check
  check (threshold_status in ('pass','warn','block'));

create table if not exists public.job_completion_closeout_items (
  id uuid primary key default gen_random_uuid(),
  completion_review_id uuid not null references public.job_completion_reviews(id) on delete cascade,
  item_type text not null default 'evidence',
  item_status text not null default 'pending',
  label text not null,
  notes text,
  due_at timestamptz,
  completed_at timestamptz,
  completed_by_profile_id uuid references public.profiles(id) on delete set null,
  required_item boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.job_completion_closeout_items
  drop constraint if exists job_completion_closeout_items_type_check;
alter table if exists public.job_completion_closeout_items
  add constraint job_completion_closeout_items_type_check
  check (item_type in ('evidence','supervisor_signoff','client_signoff','variance_explanation','session_closeout','materials','equipment','other'));

alter table if exists public.job_completion_closeout_items
  drop constraint if exists job_completion_closeout_items_status_check;
alter table if exists public.job_completion_closeout_items
  add constraint job_completion_closeout_items_status_check
  check (item_status in ('pending','complete','rejected','waived'));

create table if not exists public.job_invoice_candidates (
  id uuid primary key default gen_random_uuid(),
  completion_review_id uuid not null references public.job_completion_reviews(id) on delete cascade,
  job_id bigint not null references public.jobs(id) on delete cascade,
  work_order_id uuid references public.work_orders(id) on delete set null,
  estimate_id uuid references public.estimates(id) on delete set null,
  business_tax_setting_id uuid references public.business_tax_settings(id) on delete set null,
  candidate_status text not null default 'draft',
  candidate_number text,
  client_id uuid references public.clients(id) on delete set null,
  client_site_id uuid references public.client_sites(id) on delete set null,
  subtotal numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  memo text,
  payload jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.job_invoice_candidates
  drop constraint if exists job_invoice_candidates_status_check;
alter table if exists public.job_invoice_candidates
  add constraint job_invoice_candidates_status_check
  check (candidate_status in ('draft','ready','reviewed','posted','rejected'));

create table if not exists public.job_journal_candidates (
  id uuid primary key default gen_random_uuid(),
  completion_review_id uuid not null references public.job_completion_reviews(id) on delete cascade,
  job_id bigint not null references public.jobs(id) on delete cascade,
  business_tax_setting_id uuid references public.business_tax_settings(id) on delete set null,
  candidate_status text not null default 'draft',
  journal_memo text,
  ledger_summary jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.job_journal_candidates
  drop constraint if exists job_journal_candidates_status_check;
alter table if exists public.job_journal_candidates
  add constraint job_journal_candidates_status_check
  check (candidate_status in ('draft','ready','reviewed','posted','rejected'));

create table if not exists public.job_ar_ap_review_queue (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id text not null,
  job_id bigint references public.jobs(id) on delete set null,
  queue_status text not null default 'open',
  assigned_profile_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.job_ar_ap_review_queue
  drop constraint if exists job_ar_ap_review_queue_source_check;
alter table if exists public.job_ar_ap_review_queue
  add constraint job_ar_ap_review_queue_source_check
  check (source_type in ('invoice_candidate','journal_candidate','completion_review','work_order'));

alter table if exists public.job_ar_ap_review_queue
  drop constraint if exists job_ar_ap_review_queue_status_check;
alter table if exists public.job_ar_ap_review_queue
  add constraint job_ar_ap_review_queue_status_check
  check (queue_status in ('open','in_review','approved','rejected','posted'));

create index if not exists idx_job_ar_ap_review_queue_status
  on public.job_ar_ap_review_queue(queue_status, created_at desc);

create or replace view public.v_commercial_approval_threshold_directory as
select
  t.id,
  t.threshold_name,
  t.entity_type,
  t.applies_to_scope,
  t.applies_to_value,
  t.discount_percent_cap,
  t.fixed_discount_cap,
  t.minimum_margin_percent,
  t.maximum_total_without_approval,
  t.required_signoff_role,
  t.hard_block,
  t.is_active,
  t.notes,
  t.created_by_profile_id,
  coalesce(p.full_name, p.email, '') as created_by_name,
  t.created_at,
  t.updated_at
from public.commercial_approval_thresholds t
left join public.profiles p on p.id = t.created_by_profile_id;

create or replace view public.v_estimate_quote_package_directory as
select
  qp.id,
  qp.estimate_id,
  e.estimate_number,
  e.quote_title,
  e.client_id,
  c.client_code,
  coalesce(c.display_name, c.legal_name, '') as client_name,
  e.client_site_id,
  cs.site_code,
  cs.site_name,
  qp.business_tax_setting_id,
  bts.profile_name as tax_profile_name,
  bts.legal_entity_type,
  bts.federal_return_type,
  bts.provincial_return_type,
  bts.usa_tax_classification,
  qp.package_status,
  qp.render_version,
  qp.rendered_title,
  qp.public_token,
  qp.client_email,
  qp.sent_at,
  qp.viewed_at,
  qp.accepted_at,
  qp.accepted_by_name,
  qp.acceptance_notes,
  qp.created_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as created_by_name,
  qp.created_at,
  qp.updated_at
from public.estimate_quote_packages qp
left join public.estimates e on e.id = qp.estimate_id
left join public.clients c on c.id = e.client_id
left join public.client_sites cs on cs.id = e.client_site_id
left join public.business_tax_settings bts on bts.id = qp.business_tax_setting_id
left join public.profiles cp on cp.id = qp.created_by_profile_id;

create or replace view public.v_work_order_release_review_directory as
select
  rr.id,
  rr.work_order_id,
  wo.work_order_number,
  rr.estimate_id,
  e.estimate_number,
  wo.legacy_job_id as job_id,
  j.job_code,
  j.job_name,
  rr.release_status,
  rr.threshold_status,
  rr.discount_percent,
  rr.margin_percent,
  rr.required_signoff_role,
  rr.release_notes,
  rr.signoff_profile_id,
  coalesce(sp.full_name, sp.email, '') as signoff_name,
  rr.signoff_at,
  rr.created_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as created_by_name,
  rr.created_at,
  rr.updated_at
from public.work_order_release_reviews rr
left join public.work_orders wo on wo.id = rr.work_order_id
left join public.estimates e on e.id = rr.estimate_id
left join public.jobs j on j.id = wo.legacy_job_id
left join public.profiles sp on sp.id = rr.signoff_profile_id
left join public.profiles cp on cp.id = rr.created_by_profile_id;

create or replace view public.v_job_completion_package_directory as
select
  ci.id,
  ci.completion_review_id,
  cr.job_id,
  j.job_code,
  j.job_name,
  cr.work_order_id,
  wo.work_order_number,
  ci.item_type,
  ci.item_status,
  ci.label,
  ci.notes,
  ci.required_item,
  ci.sort_order,
  ci.due_at,
  ci.completed_at,
  ci.completed_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as completed_by_name,
  cr.review_status,
  cr.completion_date,
  cr.accounting_ready,
  ci.created_at,
  ci.updated_at
from public.job_completion_closeout_items ci
left join public.job_completion_reviews cr on cr.id = ci.completion_review_id
left join public.jobs j on j.id = cr.job_id
left join public.work_orders wo on wo.id = cr.work_order_id
left join public.profiles cp on cp.id = ci.completed_by_profile_id;

create or replace view public.v_job_invoice_candidate_directory as
select
  ic.id,
  ic.completion_review_id,
  ic.job_id,
  j.job_code,
  j.job_name,
  ic.work_order_id,
  wo.work_order_number,
  ic.estimate_id,
  e.estimate_number,
  ic.business_tax_setting_id,
  bts.profile_name as tax_profile_name,
  bts.legal_entity_type,
  ic.candidate_status,
  ic.candidate_number,
  ic.client_id,
  c.client_code,
  coalesce(c.display_name, c.legal_name, '') as client_name,
  ic.client_site_id,
  cs.site_code,
  cs.site_name,
  ic.subtotal,
  ic.tax_total,
  ic.total_amount,
  ic.memo,
  ic.created_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as created_by_name,
  ic.created_at,
  ic.updated_at
from public.job_invoice_candidates ic
left join public.jobs j on j.id = ic.job_id
left join public.work_orders wo on wo.id = ic.work_order_id
left join public.estimates e on e.id = ic.estimate_id
left join public.clients c on c.id = ic.client_id
left join public.client_sites cs on cs.id = ic.client_site_id
left join public.business_tax_settings bts on bts.id = ic.business_tax_setting_id
left join public.profiles cp on cp.id = ic.created_by_profile_id;

create or replace view public.v_job_journal_candidate_directory as
select
  jc.id,
  jc.completion_review_id,
  jc.job_id,
  j.job_code,
  j.job_name,
  jc.business_tax_setting_id,
  bts.profile_name as tax_profile_name,
  bts.legal_entity_type,
  jc.candidate_status,
  jc.journal_memo,
  jc.ledger_summary,
  jc.created_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as created_by_name,
  jc.created_at,
  jc.updated_at
from public.job_journal_candidates jc
left join public.jobs j on j.id = jc.job_id
left join public.business_tax_settings bts on bts.id = jc.business_tax_setting_id
left join public.profiles cp on cp.id = jc.created_by_profile_id;

create or replace view public.v_job_ar_ap_review_queue_directory as
select
  q.id,
  q.source_type,
  q.source_id,
  q.job_id,
  j.job_code,
  j.job_name,
  q.queue_status,
  q.assigned_profile_id,
  coalesce(ap.full_name, ap.email, '') as assigned_name,
  q.notes,
  q.created_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as created_by_name,
  q.created_at,
  q.updated_at
from public.job_ar_ap_review_queue q
left join public.jobs j on j.id = q.job_id
left join public.profiles ap on ap.id = q.assigned_profile_id
left join public.profiles cp on cp.id = q.created_by_profile_id;

create or replace view public.v_job_profitability_scorecard_directory as
with base as (
  select
    j.id as job_id,
    j.job_code,
    j.job_name,
    coalesce(j.job_family, 'unclassified') as job_family,
    coalesce(j.assigned_supervisor_profile_id::text, j.site_supervisor_profile_id::text, 'unassigned') as supervisor_key,
    coalesce(sp.full_name, sup.full_name, 'Unassigned') as supervisor_name,
    coalesce(j.site_id::text, 'no-site') as site_key,
    coalesce(st.site_code, st.site_name, 'No site') as site_name,
    coalesce(wo.route_id::text, 'no-route') as route_key,
    coalesce(rt.route_code, rt.name, 'No route') as route_name,
    coalesce(cr.revenue_total, j.actual_charge_rollup_total, j.actual_charge_total, j.quoted_charge_total, 0)::numeric(12,2) as revenue_total,
    coalesce(cr.cost_total, j.actual_cost_rollup_total, j.actual_cost_total, j.estimated_cost_total, 0)::numeric(12,2) as cost_total,
    coalesce(cr.profit_total, (coalesce(cr.revenue_total, j.actual_charge_rollup_total, j.actual_charge_total, j.quoted_charge_total, 0) - coalesce(cr.cost_total, j.actual_cost_rollup_total, j.actual_cost_total, j.estimated_cost_total, 0)))::numeric(12,2) as profit_total
  from public.v_jobs_directory j
  left join public.job_completion_reviews cr on cr.job_id = j.id
  left join public.work_orders wo on wo.legacy_job_id = j.id
  left join public.routes rt on rt.id = wo.route_id
  left join public.sites st on st.id = j.site_id
  left join public.profiles sp on sp.id = j.assigned_supervisor_profile_id
  left join public.profiles sup on sup.id = j.site_supervisor_profile_id
)
select
  'site'::text as group_type,
  site_key as group_key,
  site_name as group_label,
  count(*)::int as job_count,
  coalesce(sum(revenue_total),0)::numeric(12,2) as revenue_total,
  coalesce(sum(cost_total),0)::numeric(12,2) as cost_total,
  coalesce(sum(profit_total),0)::numeric(12,2) as profit_total,
  case when coalesce(sum(revenue_total),0) > 0 then round((coalesce(sum(profit_total),0) / sum(revenue_total)) * 100.0, 2)::numeric(7,2) else 0::numeric(7,2) end as margin_percent
from base group by site_key, site_name
union all
select
  'supervisor'::text,
  supervisor_key,
  supervisor_name,
  count(*)::int,
  coalesce(sum(revenue_total),0)::numeric(12,2),
  coalesce(sum(cost_total),0)::numeric(12,2),
  coalesce(sum(profit_total),0)::numeric(12,2),
  case when coalesce(sum(revenue_total),0) > 0 then round((coalesce(sum(profit_total),0) / sum(revenue_total)) * 100.0, 2)::numeric(7,2) else 0::numeric(7,2) end
from base group by supervisor_key, supervisor_name
union all
select
  'route'::text,
  route_key,
  route_name,
  count(*)::int,
  coalesce(sum(revenue_total),0)::numeric(12,2),
  coalesce(sum(cost_total),0)::numeric(12,2),
  coalesce(sum(profit_total),0)::numeric(12,2),
  case when coalesce(sum(revenue_total),0) > 0 then round((coalesce(sum(profit_total),0) / sum(revenue_total)) * 100.0, 2)::numeric(7,2) else 0::numeric(7,2) end
from base group by route_key, route_name
union all
select
  'job_family'::text,
  job_family,
  job_family,
  count(*)::int,
  coalesce(sum(revenue_total),0)::numeric(12,2),
  coalesce(sum(cost_total),0)::numeric(12,2),
  coalesce(sum(profit_total),0)::numeric(12,2),
  case when coalesce(sum(revenue_total),0) > 0 then round((coalesce(sum(profit_total),0) / sum(revenue_total)) * 100.0, 2)::numeric(7,2) else 0::numeric(7,2) end
from base group by job_family;
