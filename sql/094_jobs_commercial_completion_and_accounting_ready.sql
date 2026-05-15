-- 094_jobs_commercial_completion_and_accounting_ready.sql
-- Expands Jobs into a fuller commercial workflow:
-- - quote / estimate approval discipline
-- - estimate and work-order costing support
-- - completion review and accounting-ready queue
-- - commercial approval history and closeout evaluation

alter table if exists public.estimates
  add column if not exists quote_title text,
  add column if not exists pricing_basis_label text,
  add column if not exists discount_mode text not null default 'none',
  add column if not exists discount_value numeric(12,2) not null default 0,
  add column if not exists margin_estimate_total numeric(12,2) not null default 0,
  add column if not exists margin_estimate_percent numeric(7,2) not null default 0,
  add column if not exists approval_status text not null default 'draft',
  add column if not exists approval_required boolean not null default false,
  add column if not exists approval_requested_at timestamptz,
  add column if not exists approved_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists client_notes text,
  add column if not exists internal_notes text,
  add column if not exists converted_job_id bigint references public.jobs(id) on delete set null,
  add column if not exists converted_work_order_id uuid references public.work_orders(id) on delete set null,
  add column if not exists converted_at timestamptz;

alter table if exists public.estimates
  drop constraint if exists estimates_discount_mode_check;
alter table if exists public.estimates
  add constraint estimates_discount_mode_check
  check (discount_mode in ('none','percent','fixed','tiered'));

alter table if exists public.estimates
  drop constraint if exists estimates_approval_status_check;
alter table if exists public.estimates
  add constraint estimates_approval_status_check
  check (approval_status in ('draft','pending','approved','rejected','converted'));

alter table if exists public.estimate_lines
  add column if not exists discount_percent numeric(7,2) not null default 0,
  add column if not exists discount_amount numeric(12,2) not null default 0,
  add column if not exists cost_total numeric(12,2) not null default 0,
  add column if not exists margin_total numeric(12,2) not null default 0,
  add column if not exists margin_percent numeric(7,2) not null default 0,
  add column if not exists pricing_basis_label text,
  add column if not exists client_visible boolean not null default true;

alter table if exists public.work_orders
  add column if not exists discount_mode text not null default 'none',
  add column if not exists discount_value numeric(12,2) not null default 0,
  add column if not exists pricing_basis_label text,
  add column if not exists margin_estimate_total numeric(12,2) not null default 0,
  add column if not exists margin_estimate_percent numeric(7,2) not null default 0,
  add column if not exists approval_status text not null default 'draft',
  add column if not exists approval_required boolean not null default false,
  add column if not exists approval_requested_at timestamptz,
  add column if not exists approved_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists internal_notes text,
  add column if not exists completion_review_status text not null default 'draft',
  add column if not exists completion_ready_for_accounting boolean not null default false,
  add column if not exists completion_ready_at timestamptz,
  add column if not exists accounting_trigger_status text not null default 'pending';

alter table if exists public.work_orders
  drop constraint if exists work_orders_discount_mode_check;
alter table if exists public.work_orders
  add constraint work_orders_discount_mode_check
  check (discount_mode in ('none','percent','fixed','tiered'));

alter table if exists public.work_orders
  drop constraint if exists work_orders_approval_status_check;
alter table if exists public.work_orders
  add constraint work_orders_approval_status_check
  check (approval_status in ('draft','pending','approved','rejected','released','completed'));

alter table if exists public.work_orders
  drop constraint if exists work_orders_completion_review_status_check;
alter table if exists public.work_orders
  add constraint work_orders_completion_review_status_check
  check (completion_review_status in ('draft','pending','approved','rejected','ready_for_accounting'));

alter table if exists public.work_orders
  drop constraint if exists work_orders_accounting_trigger_status_check;
alter table if exists public.work_orders
  add constraint work_orders_accounting_trigger_status_check
  check (accounting_trigger_status in ('pending','queued','posted','failed','not_required'));

alter table if exists public.work_order_lines
  add column if not exists discount_percent numeric(7,2) not null default 0,
  add column if not exists discount_amount numeric(12,2) not null default 0,
  add column if not exists cost_total numeric(12,2) not null default 0,
  add column if not exists margin_total numeric(12,2) not null default 0,
  add column if not exists margin_percent numeric(7,2) not null default 0,
  add column if not exists pricing_basis_label text,
  add column if not exists client_visible boolean not null default true;

create table if not exists public.commercial_approval_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  approval_action text not null,
  approval_status text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

alter table if exists public.commercial_approval_events
  drop constraint if exists commercial_approval_events_entity_type_check;
alter table if exists public.commercial_approval_events
  add constraint commercial_approval_events_entity_type_check
  check (entity_type in ('estimate','work_order','job'));

alter table if exists public.commercial_approval_events
  drop constraint if exists commercial_approval_events_action_check;
alter table if exists public.commercial_approval_events
  add constraint commercial_approval_events_action_check
  check (approval_action in ('request_approval','approve','reject','release','mark_converted','mark_completed'));

create index if not exists idx_commercial_approval_events_entity
  on public.commercial_approval_events(entity_type, entity_id, created_at desc);

create table if not exists public.job_completion_reviews (
  id uuid primary key default gen_random_uuid(),
  job_id bigint not null references public.jobs(id) on delete cascade,
  work_order_id uuid references public.work_orders(id) on delete set null,
  estimate_id uuid references public.estimates(id) on delete set null,
  review_status text not null default 'draft',
  completion_date date,
  completion_notes text,
  closeout_evidence_complete boolean not null default false,
  supervisor_signoff_complete boolean not null default false,
  client_signoff_complete boolean not null default false,
  all_sessions_signed_off boolean not null default false,
  revenue_total numeric(12,2) not null default 0,
  cost_total numeric(12,2) not null default 0,
  profit_total numeric(12,2) not null default 0,
  margin_percent numeric(7,2) not null default 0,
  variance_summary text,
  accounting_ready boolean not null default false,
  accounting_ready_at timestamptz,
  accounting_trigger_status text not null default 'pending',
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  approved_by_profile_id uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id)
);

alter table if exists public.job_completion_reviews
  drop constraint if exists job_completion_reviews_status_check;
alter table if exists public.job_completion_reviews
  add constraint job_completion_reviews_status_check
  check (review_status in ('draft','pending','approved','rejected','ready_for_accounting','posted'));

alter table if exists public.job_completion_reviews
  drop constraint if exists job_completion_reviews_trigger_status_check;
alter table if exists public.job_completion_reviews
  add constraint job_completion_reviews_trigger_status_check
  check (accounting_trigger_status in ('pending','queued','posted','failed','not_required'));

create table if not exists public.job_completion_accounting_events (
  id uuid primary key default gen_random_uuid(),
  completion_review_id uuid not null references public.job_completion_reviews(id) on delete cascade,
  job_id bigint not null references public.jobs(id) on delete cascade,
  accounting_action text not null,
  event_status text not null default 'queued',
  memo text,
  payload jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table if exists public.job_completion_accounting_events
  drop constraint if exists job_completion_accounting_events_action_check;
alter table if exists public.job_completion_accounting_events
  add constraint job_completion_accounting_events_action_check
  check (accounting_action in ('queue_review','create_invoice_candidate','create_journal_candidate','mark_posted','mark_failed'));

alter table if exists public.job_completion_accounting_events
  drop constraint if exists job_completion_accounting_events_status_check;
alter table if exists public.job_completion_accounting_events
  add constraint job_completion_accounting_events_status_check
  check (event_status in ('queued','completed','failed'));

create or replace view public.v_estimate_commercial_directory as
with line_rollup as (
  select
    estimate_id,
    count(*)::int as line_count,
    coalesce(sum(coalesce(cost_total, quantity * unit_cost, 0)), 0)::numeric(12,2) as line_cost_total,
    coalesce(sum(coalesce(line_total, quantity * unit_price, 0)), 0)::numeric(12,2) as line_price_total,
    coalesce(sum(coalesce(discount_amount, 0)), 0)::numeric(12,2) as line_discount_total,
    coalesce(sum(coalesce(margin_total, coalesce(line_total, quantity * unit_price, 0) - coalesce(cost_total, quantity * unit_cost, 0))), 0)::numeric(12,2) as line_margin_total
  from public.estimate_lines
  group by estimate_id
)
select
  e.id,
  e.estimate_number,
  e.quote_title,
  e.client_id,
  c.client_code,
  coalesce(c.display_name, c.legal_name, '') as client_name,
  e.client_site_id,
  cs.site_code,
  cs.site_name,
  e.estimate_type,
  e.status,
  e.valid_until,
  e.subtotal,
  e.tax_total,
  e.total_amount,
  e.discount_mode,
  e.discount_value,
  e.pricing_basis_label,
  e.margin_estimate_total,
  e.margin_estimate_percent,
  e.approval_status,
  e.approval_required,
  e.approval_requested_at,
  e.approved_at,
  e.approved_by_profile_id,
  coalesce(ap.full_name, ap.email, '') as approved_by_name,
  e.scope_notes,
  e.terms_notes,
  e.client_notes,
  e.internal_notes,
  e.converted_job_id,
  j.job_code as converted_job_code,
  e.converted_work_order_id,
  wo.work_order_number as converted_work_order_number,
  e.converted_at,
  coalesce(lr.line_count, 0) as line_count,
  coalesce(lr.line_cost_total, 0)::numeric(12,2) as line_cost_total,
  coalesce(lr.line_price_total, 0)::numeric(12,2) as line_price_total,
  coalesce(lr.line_discount_total, 0)::numeric(12,2) as line_discount_total,
  coalesce(lr.line_margin_total, 0)::numeric(12,2) as line_margin_total,
  e.created_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as created_by_name,
  e.created_at,
  e.updated_at
from public.estimates e
left join public.clients c on c.id = e.client_id
left join public.client_sites cs on cs.id = e.client_site_id
left join public.profiles cp on cp.id = e.created_by_profile_id
left join public.profiles ap on ap.id = e.approved_by_profile_id
left join public.jobs j on j.id = e.converted_job_id
left join public.work_orders wo on wo.id = e.converted_work_order_id
left join line_rollup lr on lr.estimate_id = e.id;

create or replace view public.v_work_order_commercial_directory as
with line_rollup as (
  select
    work_order_id,
    count(*)::int as line_count,
    coalesce(sum(coalesce(cost_total, quantity * unit_cost, 0)), 0)::numeric(12,2) as line_cost_total,
    coalesce(sum(coalesce(line_total, quantity * unit_price, 0)), 0)::numeric(12,2) as line_price_total,
    coalesce(sum(coalesce(discount_amount, 0)), 0)::numeric(12,2) as line_discount_total,
    coalesce(sum(coalesce(margin_total, coalesce(line_total, quantity * unit_price, 0) - coalesce(cost_total, quantity * unit_cost, 0))), 0)::numeric(12,2) as line_margin_total
  from public.work_order_lines
  group by work_order_id
)
select
  wo.id,
  wo.work_order_number,
  wo.estimate_id,
  e.estimate_number,
  wo.client_id,
  c.client_code,
  coalesce(c.display_name, c.legal_name, '') as client_name,
  wo.client_site_id,
  cs.site_code,
  cs.site_name,
  wo.legacy_job_id,
  j.job_code,
  j.job_name,
  wo.work_type,
  wo.status,
  wo.scheduled_start,
  wo.scheduled_end,
  wo.route_id,
  r.route_code,
  r.name as route_name,
  wo.service_area_id,
  sa.area_code,
  sa.name as service_area_name,
  wo.supervisor_profile_id,
  coalesce(sp.full_name, sp.email, '') as supervisor_name,
  wo.subtotal,
  wo.tax_total,
  wo.total_amount,
  wo.discount_mode,
  wo.discount_value,
  wo.pricing_basis_label,
  wo.margin_estimate_total,
  wo.margin_estimate_percent,
  wo.approval_status,
  wo.approval_required,
  wo.approval_requested_at,
  wo.approved_at,
  wo.completion_review_status,
  wo.completion_ready_for_accounting,
  wo.completion_ready_at,
  wo.accounting_trigger_status,
  wo.customer_notes,
  wo.internal_notes,
  wo.safety_notes,
  wo.crew_notes,
  coalesce(lr.line_count, 0) as line_count,
  coalesce(lr.line_cost_total, 0)::numeric(12,2) as line_cost_total,
  coalesce(lr.line_price_total, 0)::numeric(12,2) as line_price_total,
  coalesce(lr.line_discount_total, 0)::numeric(12,2) as line_discount_total,
  coalesce(lr.line_margin_total, 0)::numeric(12,2) as line_margin_total,
  wo.created_by_profile_id,
  coalesce(cp.full_name, cp.email, '') as created_by_name,
  wo.created_at,
  wo.updated_at
from public.work_orders wo
left join public.estimates e on e.id = wo.estimate_id
left join public.clients c on c.id = wo.client_id
left join public.client_sites cs on cs.id = wo.client_site_id
left join public.jobs j on j.id = wo.legacy_job_id
left join public.routes r on r.id = wo.route_id
left join public.service_areas sa on sa.id = wo.service_area_id
left join public.profiles sp on sp.id = wo.supervisor_profile_id
left join public.profiles cp on cp.id = wo.created_by_profile_id
left join line_rollup lr on lr.work_order_id = wo.id;

create or replace view public.v_job_completion_review_directory as
with session_rollup as (
  select
    job_id,
    count(*)::int as session_count,
    count(*) filter (where site_supervisor_signed_off_at is not null or coalesce(site_supervisor_signoff_name, '') <> '')::int as signed_session_count
  from public.job_sessions
  group by job_id
)
select
  cr.id,
  cr.job_id,
  j.job_code,
  j.job_name,
  cr.work_order_id,
  wo.work_order_number,
  cr.estimate_id,
  e.estimate_number,
  cr.review_status,
  cr.completion_date,
  cr.completion_notes,
  cr.closeout_evidence_complete,
  cr.supervisor_signoff_complete,
  cr.client_signoff_complete,
  cr.all_sessions_signed_off,
  cr.revenue_total,
  cr.cost_total,
  cr.profit_total,
  cr.margin_percent,
  cr.variance_summary,
  cr.accounting_ready,
  cr.accounting_ready_at,
  cr.accounting_trigger_status,
  cr.reviewed_by_profile_id,
  coalesce(rp.full_name, rp.email, '') as reviewed_by_name,
  cr.approved_by_profile_id,
  coalesce(ap.full_name, ap.email, '') as approved_by_name,
  cr.approved_at,
  coalesce(sr.session_count, 0) as session_count,
  coalesce(sr.signed_session_count, 0) as signed_session_count,
  cr.created_at,
  cr.updated_at
from public.job_completion_reviews cr
left join public.jobs j on j.id = cr.job_id
left join public.work_orders wo on wo.id = cr.work_order_id
left join public.estimates e on e.id = cr.estimate_id
left join public.profiles rp on rp.id = cr.reviewed_by_profile_id
left join public.profiles ap on ap.id = cr.approved_by_profile_id
left join session_rollup sr on sr.job_id = cr.job_id;

create or replace view public.v_job_accounting_ready_queue as
select
  cr.id,
  cr.job_id,
  j.job_code,
  j.job_name,
  cr.work_order_id,
  wo.work_order_number,
  cr.estimate_id,
  e.estimate_number,
  cr.review_status,
  cr.completion_date,
  cr.revenue_total,
  cr.cost_total,
  cr.profit_total,
  cr.margin_percent,
  cr.accounting_ready,
  cr.accounting_ready_at,
  cr.accounting_trigger_status,
  count(ev.id)::int as accounting_event_count,
  max(ev.created_at) as last_accounting_event_at,
  (array_agg(ev.event_status order by ev.created_at desc nulls last))[1] as last_accounting_event_status,
  (array_agg(ev.accounting_action order by ev.created_at desc nulls last))[1] as last_accounting_action,
  cr.variance_summary,
  cr.created_at,
  cr.updated_at
from public.job_completion_reviews cr
left join public.jobs j on j.id = cr.job_id
left join public.work_orders wo on wo.id = cr.work_order_id
left join public.estimates e on e.id = cr.estimate_id
left join public.job_completion_accounting_events ev on ev.completion_review_id = cr.id
where cr.accounting_ready = true or cr.review_status in ('ready_for_accounting','posted') or cr.accounting_trigger_status <> 'pending'
group by cr.id, j.job_code, j.job_name, wo.work_order_number, e.estimate_number;
