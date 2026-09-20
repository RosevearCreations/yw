begin;

-- Schema 213 — Build 324 Estimate → Job → Invoice Workflow
-- Extends the canonical estimates/work_orders/change_orders flow. It does not create
-- a parallel invoice or payment authority. Finance candidate/posting controls remain unchanged.

alter table public.estimates
  add column if not exists service_pricing_template_id uuid references public.service_pricing_templates(id) on delete set null,
  add column if not exists estimated_labour_hours numeric(12,2),
  add column if not exists assumed_crew_size integer,
  add column if not exists markup_percent numeric(9,4),
  add column if not exists target_margin_percent numeric(9,4),
  add column if not exists deposit_required_amount numeric(12,2) not null default 0,
  add column if not exists deposit_required_percent numeric(9,4) not null default 0,
  add column if not exists assumption_version integer not null default 1,
  add column if not exists workflow_notes text,
  add column if not exists approval_notes text;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='estimates_build324_labour_hours_chk') then
    alter table public.estimates add constraint estimates_build324_labour_hours_chk
      check (estimated_labour_hours is null or estimated_labour_hours >= 0);
  end if;
  if not exists(select 1 from pg_constraint where conname='estimates_build324_crew_size_chk') then
    alter table public.estimates add constraint estimates_build324_crew_size_chk
      check (assumed_crew_size is null or assumed_crew_size between 1 and 100);
  end if;
  if not exists(select 1 from pg_constraint where conname='estimates_build324_markup_chk') then
    alter table public.estimates add constraint estimates_build324_markup_chk
      check (markup_percent is null or markup_percent between -100 and 10000);
  end if;
  if not exists(select 1 from pg_constraint where conname='estimates_build324_margin_chk') then
    alter table public.estimates add constraint estimates_build324_margin_chk
      check (target_margin_percent is null or target_margin_percent between -100 and 100);
  end if;
  if not exists(select 1 from pg_constraint where conname='estimates_build324_deposit_amount_chk') then
    alter table public.estimates add constraint estimates_build324_deposit_amount_chk
      check (deposit_required_amount >= 0);
  end if;
  if not exists(select 1 from pg_constraint where conname='estimates_build324_deposit_percent_chk') then
    alter table public.estimates add constraint estimates_build324_deposit_percent_chk
      check (deposit_required_percent between 0 and 100);
  end if;
  if not exists(select 1 from pg_constraint where conname='estimates_build324_assumption_version_chk') then
    alter table public.estimates add constraint estimates_build324_assumption_version_chk
      check (assumption_version >= 1);
  end if;
end $$;

create index if not exists estimates_service_pricing_template_idx
  on public.estimates(service_pricing_template_id)
  where service_pricing_template_id is not null;

create table if not exists public.estimate_workflow_assumptions (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  assumption_code text not null default ('ASM-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  assumption_type text not null default 'other',
  assumption_label text not null,
  quantity numeric(14,4) not null default 1,
  unit_label text,
  unit_cost numeric(14,4) not null default 0,
  estimated_cost numeric(14,2) not null default 0,
  estimated_charge numeric(14,2) not null default 0,
  optional_work boolean not null default false,
  selected boolean not null default true,
  source_template_id uuid references public.service_pricing_templates(id) on delete set null,
  source_estimate_line_id uuid references public.estimate_lines(id) on delete set null,
  notes text,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estimate_workflow_assumptions_type_chk check (
    assumption_type in ('labour','crew','material','equipment','subcontract','disposal','travel','other')
  ),
  constraint estimate_workflow_assumptions_quantity_chk check (quantity >= 0),
  constraint estimate_workflow_assumptions_unit_cost_chk check (unit_cost >= 0),
  constraint estimate_workflow_assumptions_cost_chk check (estimated_cost >= 0),
  constraint estimate_workflow_assumptions_charge_chk check (estimated_charge >= 0),
  constraint estimate_workflow_assumptions_sort_chk check (sort_order between 0 and 10000),
  constraint estimate_workflow_assumptions_estimate_code_uk unique(estimate_id,assumption_code)
);
create index if not exists estimate_workflow_assumptions_estimate_idx
  on public.estimate_workflow_assumptions(estimate_id,is_active,selected,sort_order);
create index if not exists estimate_workflow_assumptions_template_idx
  on public.estimate_workflow_assumptions(source_template_id)
  where source_template_id is not null;
create index if not exists estimate_workflow_assumptions_line_idx
  on public.estimate_workflow_assumptions(source_estimate_line_id)
  where source_estimate_line_id is not null;
create index if not exists estimate_workflow_assumptions_created_by_idx
  on public.estimate_workflow_assumptions(created_by_profile_id)
  where created_by_profile_id is not null;
create index if not exists estimate_workflow_assumptions_updated_by_idx
  on public.estimate_workflow_assumptions(updated_by_profile_id)
  where updated_by_profile_id is not null;
alter table public.estimate_workflow_assumptions enable row level security;
revoke all on table public.estimate_workflow_assumptions from public,anon,authenticated;
grant select,insert,update,delete on table public.estimate_workflow_assumptions to service_role;

alter table public.work_orders
  add column if not exists estimate_assumption_snapshot_version integer,
  add column if not exists estimate_baseline_cost_total numeric(14,2),
  add column if not exists estimate_baseline_charge_total numeric(14,2),
  add column if not exists estimate_baseline_markup_percent numeric(9,4),
  add column if not exists estimate_baseline_margin_percent numeric(9,4),
  add column if not exists estimate_baseline_captured_at timestamptz;

create table if not exists public.work_order_assumption_baselines (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete restrict,
  source_assumption_id uuid references public.estimate_workflow_assumptions(id) on delete set null,
  snapshot_version integer not null default 1,
  assumption_code text not null,
  assumption_type text not null,
  assumption_label text not null,
  quantity numeric(14,4) not null default 1,
  unit_label text,
  unit_cost numeric(14,4) not null default 0,
  baseline_cost numeric(14,2) not null default 0,
  baseline_charge numeric(14,2) not null default 0,
  optional_work boolean not null default false,
  selected boolean not null default true,
  notes text,
  snapshotted_by_profile_id uuid references public.profiles(id) on delete set null,
  snapshotted_at timestamptz not null default now(),
  constraint work_order_assumption_baselines_type_chk check (
    assumption_type in ('labour','crew','material','equipment','subcontract','disposal','travel','other')
  ),
  constraint work_order_assumption_baselines_version_chk check (snapshot_version >= 1)
);
create unique index if not exists work_order_assumption_baselines_source_uk
  on public.work_order_assumption_baselines(work_order_id,source_assumption_id)
  where source_assumption_id is not null;
create index if not exists work_order_assumption_baselines_work_order_idx
  on public.work_order_assumption_baselines(work_order_id,snapshot_version,assumption_type);
create index if not exists work_order_assumption_baselines_estimate_idx
  on public.work_order_assumption_baselines(estimate_id);
create index if not exists work_order_assumption_baselines_actor_idx
  on public.work_order_assumption_baselines(snapshotted_by_profile_id)
  where snapshotted_by_profile_id is not null;
alter table public.work_order_assumption_baselines enable row level security;
revoke all on table public.work_order_assumption_baselines from public,anon,authenticated;
grant select,insert,update,delete on table public.work_order_assumption_baselines to service_role;

alter table public.change_orders
  alter column job_id drop not null,
  add column if not exists work_order_id uuid references public.work_orders(id) on delete cascade,
  add column if not exists estimate_id uuid references public.estimates(id) on delete set null,
  add column if not exists customer_approval_reference text,
  add column if not exists customer_approved_at timestamptz,
  add column if not exists customer_approved_by_name text;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='change_orders_build324_identity_chk') then
    alter table public.change_orders add constraint change_orders_build324_identity_chk
      check (job_id is not null or work_order_id is not null);
  end if;
  if not exists(select 1 from pg_constraint where conname='change_orders_build324_customer_approval_chk') then
    alter table public.change_orders add constraint change_orders_build324_customer_approval_chk
      check (
        status <> 'approved'
        or nullif(btrim(coalesce(customer_approval_reference,'')),'') is not null
      );
  end if;
end $$;
create index if not exists change_orders_work_order_status_idx
  on public.change_orders(work_order_id,status,requested_at desc)
  where work_order_id is not null;
create index if not exists change_orders_estimate_idx
  on public.change_orders(estimate_id)
  where estimate_id is not null;

create or replace view public.v_estimate_workflow_assumption_directory
with (security_invoker=true)
as
select
  a.*,
  e.estimate_number,
  e.status as estimate_status,
  e.approval_status,
  e.client_id,
  e.client_site_id,
  coalesce(c.display_name,c.legal_name) as client_name,
  cs.site_name,
  spt.template_code as source_template_code,
  spt.template_name as source_template_name
from public.estimate_workflow_assumptions a
join public.estimates e on e.id=a.estimate_id
left join public.clients c on c.id=e.client_id
left join public.client_sites cs on cs.id=e.client_site_id
left join public.service_pricing_templates spt on spt.id=a.source_template_id;
revoke all on table public.v_estimate_workflow_assumption_directory from public,anon,authenticated;
grant select on table public.v_estimate_workflow_assumption_directory to service_role;

create or replace view public.v_estimate_job_invoice_workflow
with (security_invoker=true)
as
select
  e.id as estimate_id,
  e.estimate_number,
  e.quote_title,
  e.client_id,
  e.client_site_id,
  coalesce(c.display_name,c.legal_name) as client_name,
  cs.site_name,
  e.service_pricing_template_id,
  spt.template_code,
  spt.template_name,
  e.status as estimate_status,
  e.approval_required,
  e.approval_status,
  e.approved_at,
  e.valid_until,
  e.estimated_labour_hours,
  e.assumed_crew_size,
  e.markup_percent,
  e.target_margin_percent,
  e.subtotal as estimate_subtotal,
  e.tax_total as estimate_tax_total,
  e.total_amount as estimate_total_amount,
  e.total_cost as estimate_total_cost,
  e.margin_amount as estimate_margin_amount,
  e.margin_percent as estimate_margin_percent,
  e.deposit_required_amount,
  e.deposit_required_percent,
  e.assumption_version,
  coalesce(ar.active_assumption_count,0)::int as active_assumption_count,
  coalesce(ar.optional_assumption_count,0)::int as optional_assumption_count,
  coalesce(ar.selected_assumption_cost,0)::numeric(14,2) as selected_assumption_cost,
  coalesce(ar.selected_assumption_charge,0)::numeric(14,2) as selected_assumption_charge,
  qp.id as quote_package_id,
  qp.package_status as quote_package_status,
  qp.sent_at as quote_sent_at,
  qp.accepted_at as quote_accepted_at,
  qp.accepted_by_name,
  greatest(coalesce(e.deposit_required_amount,0),coalesce(qp.deposit_required_amount,0))::numeric(14,2) as effective_deposit_required_amount,
  coalesce(dp.paid_amount,0)::numeric(14,2) as deposit_paid_amount,
  case
    when greatest(coalesce(e.deposit_required_amount,0),coalesce(qp.deposit_required_amount,0))<=0 then 'not_required'
    when coalesce(dp.paid_amount,0)>=greatest(coalesce(e.deposit_required_amount,0),coalesce(qp.deposit_required_amount,0)) then 'paid'
    when coalesce(dp.paid_amount,0)>0 then 'partial'
    else coalesce(qp.deposit_status,'required')
  end as deposit_readiness,
  wo.id as work_order_id,
  wo.work_order_number,
  wo.legacy_job_id,
  wo.status as work_order_status,
  wo.completion_review_status,
  wo.completion_ready_for_accounting,
  wo.accounting_trigger_status,
  wo.estimate_assumption_snapshot_version,
  wo.estimate_baseline_cost_total,
  wo.estimate_baseline_charge_total,
  wo.total_cost as current_work_order_cost_total,
  wo.total_amount as current_work_order_charge_total,
  coalesce(co.approved_change_order_count,0)::int as approved_change_order_count,
  coalesce(co.approved_cost_delta,0)::numeric(14,2) as approved_change_order_cost_delta,
  coalesce(co.approved_charge_delta,0)::numeric(14,2) as approved_change_order_charge_delta,
  ic.id as invoice_candidate_id,
  ic.candidate_number as invoice_candidate_number,
  ic.candidate_status as invoice_candidate_status,
  ai.id as ar_invoice_id,
  ai.invoice_number as ar_invoice_number,
  ai.invoice_status as ar_invoice_status,
  (not e.approval_required or e.approval_status='approved') as internal_approval_ready,
  (e.status='accepted' or qp.accepted_at is not null) as customer_approval_ready,
  (
    greatest(coalesce(e.deposit_required_amount,0),coalesce(qp.deposit_required_amount,0))<=0
    or coalesce(dp.paid_amount,0)>=greatest(coalesce(e.deposit_required_amount,0),coalesce(qp.deposit_required_amount,0))
  ) as deposit_ready,
  (
    (not e.approval_required or e.approval_status='approved')
    and (e.status='accepted' or qp.accepted_at is not null)
    and (
      greatest(coalesce(e.deposit_required_amount,0),coalesce(qp.deposit_required_amount,0))<=0
      or coalesce(dp.paid_amount,0)>=greatest(coalesce(e.deposit_required_amount,0),coalesce(qp.deposit_required_amount,0))
    )
  ) as work_order_conversion_ready,
  case
    when wo.id is null and e.approval_required and e.approval_status<>'approved' then 'needs_internal_approval'
    when wo.id is null and not (e.status='accepted' or qp.accepted_at is not null) then 'needs_customer_approval'
    when wo.id is null and greatest(coalesce(e.deposit_required_amount,0),coalesce(qp.deposit_required_amount,0))>coalesce(dp.paid_amount,0) then 'needs_deposit'
    when wo.id is null then 'ready_to_convert'
    when not wo.completion_ready_for_accounting then 'work_or_closeout_in_progress'
    when ic.id is null then 'ready_for_finance_review'
    when ai.id is null then 'invoice_candidate_created'
    else 'invoice_materialized'
  end as workflow_stage,
  case
    when wo.id is not null and wo.completion_ready_for_accounting and ic.id is null then true
    else false
  end as finance_handoff_ready
from public.estimates e
left join public.clients c on c.id=e.client_id
left join public.client_sites cs on cs.id=e.client_site_id
left join public.service_pricing_templates spt on spt.id=e.service_pricing_template_id
left join lateral (
  select
    count(*) filter(where a.is_active)::int as active_assumption_count,
    count(*) filter(where a.is_active and a.optional_work)::int as optional_assumption_count,
    coalesce(sum(a.estimated_cost) filter(where a.is_active and a.selected),0) as selected_assumption_cost,
    coalesce(sum(a.estimated_charge) filter(where a.is_active and a.selected),0) as selected_assumption_charge
  from public.estimate_workflow_assumptions a
  where a.estimate_id=e.id
) ar on true
left join lateral (
  select q.*
  from public.estimate_quote_packages q
  where q.estimate_id=e.id
  order by q.created_at desc
  limit 1
) qp on true
left join lateral (
  select coalesce(sum(d.paid_amount) filter(where d.deposit_status='paid'),0) as paid_amount
  from public.customer_deposit_requests d
  where d.estimate_id=e.id
) dp on true
left join lateral (
  select w.*
  from public.work_orders w
  where w.estimate_id=e.id
  order by w.created_at desc
  limit 1
) wo on true
left join lateral (
  select
    count(*) filter(where ch.status='approved')::int as approved_change_order_count,
    coalesce(sum(ch.estimated_cost_delta) filter(where ch.status='approved'),0) as approved_cost_delta,
    coalesce(sum(ch.estimated_charge_delta) filter(where ch.status='approved'),0) as approved_charge_delta
  from public.change_orders ch
  where ch.estimate_id=e.id or (wo.id is not null and ch.work_order_id=wo.id)
) co on true
left join lateral (
  select x.*
  from public.job_invoice_candidates x
  where x.estimate_id=e.id or (wo.id is not null and x.work_order_id=wo.id)
  order by x.created_at desc
  limit 1
) ic on true
left join lateral (
  select x.*
  from public.ar_invoices x
  where wo.id is not null and x.work_order_id=wo.id
  order by x.created_at desc
  limit 1
) ai on true;
revoke all on table public.v_estimate_job_invoice_workflow from public,anon,authenticated;
grant select on table public.v_estimate_job_invoice_workflow to service_role;

create or replace view public.v_estimate_assumption_variance
with (security_invoker=true)
as
select
  wo.id as work_order_id,
  wo.work_order_number,
  wo.estimate_id,
  e.estimate_number,
  wo.estimate_assumption_snapshot_version,
  count(b.id)::int as baseline_assumption_count,
  coalesce(sum(b.baseline_cost) filter(where b.selected),0)::numeric(14,2) as baseline_assumption_cost_total,
  coalesce(sum(b.baseline_charge) filter(where b.selected),0)::numeric(14,2) as baseline_assumption_charge_total,
  coalesce(wo.total_cost,0)::numeric(14,2) as current_work_order_cost_total,
  coalesce(wo.total_amount,0)::numeric(14,2) as current_work_order_charge_total,
  (coalesce(wo.total_cost,0)-coalesce(sum(b.baseline_cost) filter(where b.selected),0))::numeric(14,2) as current_cost_variance,
  (coalesce(wo.total_amount,0)-coalesce(sum(b.baseline_charge) filter(where b.selected),0))::numeric(14,2) as current_charge_variance,
  coalesce(wo.actual_material_cost_total,0)::numeric(14,2) as actual_material_cost_evidence,
  coalesce(wo.received_cost_total,0)::numeric(14,2) as received_cost_evidence,
  (coalesce(wo.actual_material_cost_total,0)>0 or coalesce(wo.received_cost_total,0)>0) as production_actuals_started,
  jsonb_object_agg(
    b.assumption_type,
    jsonb_build_object(
      'baseline_cost',bucket.baseline_cost,
      'baseline_charge',bucket.baseline_charge,
      'assumption_count',bucket.assumption_count
    )
  ) filter(where b.assumption_type is not null) as baseline_by_type
from public.work_orders wo
join public.estimates e on e.id=wo.estimate_id
left join public.work_order_assumption_baselines b on b.work_order_id=wo.id
left join lateral (
  select
    bb.assumption_type,
    coalesce(sum(bb.baseline_cost) filter(where bb.selected),0) as baseline_cost,
    coalesce(sum(bb.baseline_charge) filter(where bb.selected),0) as baseline_charge,
    count(*)::int as assumption_count
  from public.work_order_assumption_baselines bb
  where bb.work_order_id=wo.id and bb.assumption_type=b.assumption_type
  group by bb.assumption_type
) bucket on true
group by
  wo.id,wo.work_order_number,wo.estimate_id,e.estimate_number,wo.estimate_assumption_snapshot_version,
  wo.total_cost,wo.total_amount,wo.actual_material_cost_total,wo.received_cost_total;
revoke all on table public.v_estimate_assumption_variance from public,anon,authenticated;
grant select on table public.v_estimate_assumption_variance to service_role;

create or replace function public.ywi_rpc_estimate_workflow_save(
  p_payload jsonb,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_id uuid := case when nullif(p_payload->>'id','') is null then null else (p_payload->>'id')::uuid end;
  v_client_id uuid := case when nullif(p_payload->>'client_id','') is null then null else (p_payload->>'client_id')::uuid end;
  v_site_id uuid := case when nullif(p_payload->>'client_site_id','') is null then null else (p_payload->>'client_site_id')::uuid end;
  v_template_id uuid := case when nullif(p_payload->>'service_pricing_template_id','') is null then null else (p_payload->>'service_pricing_template_id')::uuid end;
  v_est public.estimates;
  v_template public.service_pricing_templates;
  v_assumption jsonb := coalesce(p_payload->'assumption','{}'::jsonb);
  v_assumption_id uuid := case when nullif(v_assumption->>'id','') is null then null else (v_assumption->>'id')::uuid end;
  v_assumption_code text := upper(nullif(btrim(v_assumption->>'assumption_code'),''));
  v_assumption_type text := lower(coalesce(nullif(v_assumption->>'assumption_type',''),'other'));
  v_assumption_label text := nullif(btrim(v_assumption->>'assumption_label'),'');
  v_assumption_row public.estimate_workflow_assumptions;
  v_estimate_number text := upper(nullif(btrim(p_payload->>'estimate_number'),''));
  v_status text := lower(coalesce(nullif(p_payload->>'status',''),'draft'));
  v_deposit_amount numeric := coalesce(nullif(p_payload->>'deposit_required_amount','')::numeric,0);
  v_deposit_percent numeric := coalesce(nullif(p_payload->>'deposit_required_percent','')::numeric,0);
begin
  if v_id is not null then
    select * into v_est from public.estimates where id=v_id;
    if not found then raise exception 'Estimate % does not exist.',v_id using errcode='23503'; end if;
  end if;
  if v_status='accepted' and (v_id is null or coalesce(v_est.status,'')<>'accepted') then
    raise exception 'Customer acceptance status is controlled by the existing quote/portal authority.' using errcode='23514';
  end if;
  if v_status not in ('draft','sent','accepted','declined','expired','cancelled','approved') then
    raise exception 'Unsupported estimate status %.',v_status using errcode='23514';
  end if;
  if v_deposit_amount<0 or v_deposit_percent<0 or v_deposit_percent>100 then
    raise exception 'Deposit amount/percent is invalid.' using errcode='23514';
  end if;
  if v_site_id is not null then
    if v_client_id is null then
      select client_id into v_client_id from public.client_sites where id=v_site_id;
    elsif not exists(select 1 from public.client_sites where id=v_site_id and client_id=v_client_id) then
      raise exception 'Selected property does not belong to the selected customer.' using errcode='23514';
    end if;
  end if;
  if v_template_id is not null then
    select * into v_template from public.service_pricing_templates where id=v_template_id and is_active=true;
    if not found then raise exception 'Pricing template is unavailable.' using errcode='23503'; end if;
  end if;

  if v_id is null then
    if v_client_id is null then raise exception 'Customer is required.' using errcode='23514'; end if;
    v_estimate_number:=coalesce(v_estimate_number,'EST-'||to_char(current_date,'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
    insert into public.estimates(
      estimate_number,client_id,client_site_id,estimate_type,status,valid_until,quote_title,
      scope_notes,terms_notes,created_by_profile_id,pricing_basis_label,discount_mode,discount_value,
      approval_required,approval_status,client_notes,internal_notes,
      service_pricing_template_id,estimated_labour_hours,assumed_crew_size,markup_percent,target_margin_percent,
      deposit_required_amount,deposit_required_percent,assumption_version,workflow_notes,approval_notes
    ) values (
      v_estimate_number,v_client_id,v_site_id,coalesce(nullif(p_payload->>'estimate_type',''),'landscaping'),v_status,
      nullif(p_payload->>'valid_until','')::date,nullif(p_payload->>'quote_title',''),
      nullif(p_payload->>'scope_notes',''),nullif(p_payload->>'terms_notes',''),p_actor_profile_id,
      coalesce(nullif(p_payload->>'pricing_basis_label',''),v_template.template_name),
      coalesce(nullif(p_payload->>'discount_mode',''),'none'),coalesce(nullif(p_payload->>'discount_value','')::numeric,0),
      coalesce((p_payload->>'approval_required')::boolean,false),
      case when coalesce((p_payload->>'approval_required')::boolean,false) then 'draft' else coalesce(nullif(p_payload->>'approval_status',''),'draft') end,
      nullif(p_payload->>'client_notes',''),nullif(p_payload->>'internal_notes',''),
      v_template_id,
      coalesce(nullif(p_payload->>'estimated_labour_hours','')::numeric,v_template.default_estimated_duration_hours),
      nullif(p_payload->>'assumed_crew_size','')::integer,
      coalesce(nullif(p_payload->>'markup_percent','')::numeric,v_template.default_markup_percent),
      nullif(p_payload->>'target_margin_percent','')::numeric,
      v_deposit_amount,v_deposit_percent,1,nullif(p_payload->>'workflow_notes',''),nullif(p_payload->>'approval_notes','')
    ) returning * into v_est;
  else
    select * into v_est from public.estimates where id=v_id for update;
    if v_client_id is null then v_client_id:=v_est.client_id; end if;
    update public.estimates e set
      client_id=v_client_id,
      client_site_id=case when p_payload ? 'client_site_id' then v_site_id else e.client_site_id end,
      estimate_type=case when p_payload ? 'estimate_type' then coalesce(nullif(p_payload->>'estimate_type',''),'landscaping') else e.estimate_type end,
      status=case when p_payload ? 'status' then v_status else e.status end,
      valid_until=case when p_payload ? 'valid_until' then nullif(p_payload->>'valid_until','')::date else e.valid_until end,
      quote_title=case when p_payload ? 'quote_title' then nullif(p_payload->>'quote_title','') else e.quote_title end,
      scope_notes=case when p_payload ? 'scope_notes' then nullif(p_payload->>'scope_notes','') else e.scope_notes end,
      terms_notes=case when p_payload ? 'terms_notes' then nullif(p_payload->>'terms_notes','') else e.terms_notes end,
      pricing_basis_label=case when p_payload ? 'pricing_basis_label' then nullif(p_payload->>'pricing_basis_label','') else e.pricing_basis_label end,
      discount_mode=case when p_payload ? 'discount_mode' then coalesce(nullif(p_payload->>'discount_mode',''),'none') else e.discount_mode end,
      discount_value=case when p_payload ? 'discount_value' then coalesce(nullif(p_payload->>'discount_value','')::numeric,0) else e.discount_value end,
      approval_required=case when p_payload ? 'approval_required' then coalesce((p_payload->>'approval_required')::boolean,false) else e.approval_required end,
      client_notes=case when p_payload ? 'client_notes' then nullif(p_payload->>'client_notes','') else e.client_notes end,
      internal_notes=case when p_payload ? 'internal_notes' then nullif(p_payload->>'internal_notes','') else e.internal_notes end,
      service_pricing_template_id=case when p_payload ? 'service_pricing_template_id' then v_template_id else e.service_pricing_template_id end,
      estimated_labour_hours=case when p_payload ? 'estimated_labour_hours' then nullif(p_payload->>'estimated_labour_hours','')::numeric else e.estimated_labour_hours end,
      assumed_crew_size=case when p_payload ? 'assumed_crew_size' then nullif(p_payload->>'assumed_crew_size','')::integer else e.assumed_crew_size end,
      markup_percent=case when p_payload ? 'markup_percent' then nullif(p_payload->>'markup_percent','')::numeric else e.markup_percent end,
      target_margin_percent=case when p_payload ? 'target_margin_percent' then nullif(p_payload->>'target_margin_percent','')::numeric else e.target_margin_percent end,
      deposit_required_amount=case when p_payload ? 'deposit_required_amount' then v_deposit_amount else e.deposit_required_amount end,
      deposit_required_percent=case when p_payload ? 'deposit_required_percent' then v_deposit_percent else e.deposit_required_percent end,
      workflow_notes=case when p_payload ? 'workflow_notes' then nullif(p_payload->>'workflow_notes','') else e.workflow_notes end,
      approval_notes=case when p_payload ? 'approval_notes' then nullif(p_payload->>'approval_notes','') else e.approval_notes end,
      updated_at=now()
    where e.id=v_id
    returning e.* into v_est;
  end if;

  if jsonb_typeof(v_assumption)='object' and v_assumption_label is not null then
    if v_assumption_type not in ('labour','crew','material','equipment','subcontract','disposal','travel','other') then
      raise exception 'Unsupported assumption type %.',v_assumption_type using errcode='23514';
    end if;
    if v_assumption_id is null then
      v_assumption_code:=coalesce(v_assumption_code,'ASM-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)));
      insert into public.estimate_workflow_assumptions(
        estimate_id,assumption_code,assumption_type,assumption_label,quantity,unit_label,unit_cost,
        estimated_cost,estimated_charge,optional_work,selected,source_template_id,source_estimate_line_id,
        notes,sort_order,is_active,created_by_profile_id,updated_by_profile_id
      ) values (
        v_est.id,v_assumption_code,v_assumption_type,v_assumption_label,
        greatest(0,coalesce(nullif(v_assumption->>'quantity','')::numeric,1)),
        nullif(v_assumption->>'unit_label',''),
        greatest(0,coalesce(nullif(v_assumption->>'unit_cost','')::numeric,0)),
        greatest(0,coalesce(nullif(v_assumption->>'estimated_cost','')::numeric,0)),
        greatest(0,coalesce(nullif(v_assumption->>'estimated_charge','')::numeric,0)),
        coalesce((v_assumption->>'optional_work')::boolean,false),
        coalesce((v_assumption->>'selected')::boolean,true),
        case when nullif(v_assumption->>'source_template_id','') is null then v_est.service_pricing_template_id else (v_assumption->>'source_template_id')::uuid end,
        case when nullif(v_assumption->>'source_estimate_line_id','') is null then null else (v_assumption->>'source_estimate_line_id')::uuid end,
        nullif(v_assumption->>'notes',''),
        greatest(0,least(coalesce(nullif(v_assumption->>'sort_order','')::integer,100),10000)),
        coalesce((v_assumption->>'is_active')::boolean,true),
        p_actor_profile_id,p_actor_profile_id
      ) returning * into v_assumption_row;
    else
      update public.estimate_workflow_assumptions a set
        assumption_code=case when v_assumption ? 'assumption_code' then coalesce(v_assumption_code,a.assumption_code) else a.assumption_code end,
        assumption_type=case when v_assumption ? 'assumption_type' then v_assumption_type else a.assumption_type end,
        assumption_label=coalesce(v_assumption_label,a.assumption_label),
        quantity=case when v_assumption ? 'quantity' then greatest(0,coalesce(nullif(v_assumption->>'quantity','')::numeric,1)) else a.quantity end,
        unit_label=case when v_assumption ? 'unit_label' then nullif(v_assumption->>'unit_label','') else a.unit_label end,
        unit_cost=case when v_assumption ? 'unit_cost' then greatest(0,coalesce(nullif(v_assumption->>'unit_cost','')::numeric,0)) else a.unit_cost end,
        estimated_cost=case when v_assumption ? 'estimated_cost' then greatest(0,coalesce(nullif(v_assumption->>'estimated_cost','')::numeric,0)) else a.estimated_cost end,
        estimated_charge=case when v_assumption ? 'estimated_charge' then greatest(0,coalesce(nullif(v_assumption->>'estimated_charge','')::numeric,0)) else a.estimated_charge end,
        optional_work=case when v_assumption ? 'optional_work' then coalesce((v_assumption->>'optional_work')::boolean,false) else a.optional_work end,
        selected=case when v_assumption ? 'selected' then coalesce((v_assumption->>'selected')::boolean,true) else a.selected end,
        notes=case when v_assumption ? 'notes' then nullif(v_assumption->>'notes','') else a.notes end,
        sort_order=case when v_assumption ? 'sort_order' then greatest(0,least(coalesce(nullif(v_assumption->>'sort_order','')::integer,100),10000)) else a.sort_order end,
        is_active=case when v_assumption ? 'is_active' then coalesce((v_assumption->>'is_active')::boolean,true) else a.is_active end,
        updated_by_profile_id=p_actor_profile_id,
        updated_at=now()
      where a.id=v_assumption_id and a.estimate_id=v_est.id
      returning a.* into v_assumption_row;
      if v_assumption_row.id is null then raise exception 'Estimate assumption was not found.' using errcode='23503'; end if;
    end if;
    update public.estimates set assumption_version=assumption_version+1,updated_at=now() where id=v_est.id returning * into v_est;
  end if;

  update public.estimate_quote_packages
  set deposit_required_amount=greatest(v_est.deposit_required_amount,round(v_est.total_amount*v_est.deposit_required_percent/100.0,2)),
      deposit_status=case
        when greatest(v_est.deposit_required_amount,round(v_est.total_amount*v_est.deposit_required_percent/100.0,2))<=0 then 'not_required'
        when deposit_status='paid' then 'paid'
        else 'required'
      end,
      updated_at=now()
  where estimate_id=v_est.id and accepted_at is null;

  return jsonb_build_object('estimate',to_jsonb(v_est),'assumption',case when v_assumption_row.id is null then null else to_jsonb(v_assumption_row) end);
end;
$$;
revoke all on function public.ywi_rpc_estimate_workflow_save(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_estimate_workflow_save(jsonb,uuid) to service_role;

create or replace function public.ywi_rpc_estimate_approval_decision(
  p_estimate_id uuid,
  p_actor_profile_id uuid,
  p_decision text,
  p_note text default null
)
returns public.estimates
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_decision text := lower(trim(coalesce(p_decision,'')));
  v_est public.estimates;
begin
  if v_decision not in ('request','approve','reject','reopen') then
    raise exception 'Unsupported estimate approval decision.' using errcode='23514';
  end if;
  select * into v_est from public.estimates where id=p_estimate_id for update;
  if not found then raise exception 'Estimate was not found.' using errcode='23503'; end if;
  update public.estimates e set
    approval_required=true,
    approval_status=case v_decision when 'request' then 'pending' when 'approve' then 'approved' when 'reject' then 'rejected' else 'draft' end,
    approval_requested_at=case when v_decision='request' then now() when v_decision='reopen' then null else e.approval_requested_at end,
    approved_by_profile_id=case when v_decision='approve' then p_actor_profile_id when v_decision in ('reject','reopen') then null else e.approved_by_profile_id end,
    approved_at=case when v_decision='approve' then now() when v_decision in ('reject','reopen') then null else e.approved_at end,
    approval_notes=nullif(trim(coalesce(p_note,'')),''),
    updated_at=now()
  where e.id=p_estimate_id
  returning e.* into v_est;
  return v_est;
end;
$$;
revoke all on function public.ywi_rpc_estimate_approval_decision(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ywi_rpc_estimate_approval_decision(uuid,uuid,text,text) to service_role;

create or replace function public.ywi_rpc_estimate_convert_work_order(
  p_estimate_id uuid,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_est public.estimates;
  v_quote public.estimate_quote_packages;
  v_wo public.work_orders;
  v_required numeric := 0;
  v_paid numeric := 0;
  v_stable_number text;
  v_baseline_cost numeric := 0;
  v_baseline_charge numeric := 0;
  v_snapshot_count int := 0;
begin
  select * into v_est from public.estimates where id=p_estimate_id for update;
  if not found then raise exception 'Estimate was not found.' using errcode='23503'; end if;
  if v_est.approval_required and v_est.approval_status<>'approved' then
    raise exception 'Internal estimate approval is required before conversion.' using errcode='23514';
  end if;

  select * into v_quote from public.estimate_quote_packages
  where estimate_id=v_est.id order by created_at desc limit 1;
  if not (v_est.status='accepted' or v_quote.accepted_at is not null) then
    raise exception 'Customer approval is required before work-order conversion.' using errcode='23514';
  end if;
  v_required:=greatest(
    coalesce(v_est.deposit_required_amount,0),
    round(coalesce(v_est.total_amount,0)*coalesce(v_est.deposit_required_percent,0)/100.0,2),
    coalesce(v_quote.deposit_required_amount,0)
  );
  select coalesce(sum(paid_amount) filter(where deposit_status='paid'),0) into v_paid
  from public.customer_deposit_requests where estimate_id=v_est.id;
  if v_required>v_paid then
    raise exception 'Required customer deposit is not fully paid.' using errcode='23514';
  end if;

  select * into v_wo from public.work_orders where estimate_id=v_est.id order by created_at desc limit 1 for update;
  if v_wo.id is null then
    v_stable_number:=left('WO-'||regexp_replace(coalesce(v_est.estimate_number,v_est.id::text),'[^A-Za-z0-9-]+','-','g'),80);
    insert into public.work_orders(
      work_order_number,estimate_id,client_id,client_site_id,work_type,status,customer_notes,
      subtotal,tax_total,total_amount,total_cost,margin_amount,margin_percent,
      discount_mode,discount_value,pricing_basis_label,margin_estimate_total,margin_estimate_percent,
      approval_status,approval_required,approved_by_profile_id,approved_at,created_by_profile_id
    ) values (
      v_stable_number,v_est.id,v_est.client_id,v_est.client_site_id,'service','draft',
      'Converted from accepted estimate '||v_est.estimate_number||'.',
      v_est.subtotal,v_est.tax_total,v_est.total_amount,v_est.total_cost,v_est.margin_amount,v_est.margin_percent,
      v_est.discount_mode,v_est.discount_value,v_est.pricing_basis_label,v_est.margin_estimate_total,v_est.margin_estimate_percent,
      case when v_est.approval_required then v_est.approval_status else 'approved' end,
      v_est.approval_required,v_est.approved_by_profile_id,v_est.approved_at,p_actor_profile_id
    ) returning * into v_wo;

    insert into public.work_order_lines(
      work_order_id,line_order,line_type,description,cost_code_id,unit_id,quantity,unit_cost,unit_price,line_total,
      material_id,equipment_master_id,discount_percent,discount_amount,cost_total,margin_total,margin_percent,
      pricing_basis_label,client_visible
    )
    select
      v_wo.id,l.line_order,l.line_type,l.description,l.cost_code_id,l.unit_id,l.quantity,l.unit_cost,l.unit_price,l.line_total,
      l.material_id,l.equipment_master_id,l.discount_percent,l.discount_amount,l.cost_total,l.margin_total,l.margin_percent,
      l.pricing_basis_label,l.client_visible
    from public.estimate_lines l
    where l.estimate_id=v_est.id
    order by l.line_order,l.created_at;
  elsif not exists(select 1 from public.work_order_lines where work_order_id=v_wo.id) then
    insert into public.work_order_lines(
      work_order_id,line_order,line_type,description,cost_code_id,unit_id,quantity,unit_cost,unit_price,line_total,
      material_id,equipment_master_id,discount_percent,discount_amount,cost_total,margin_total,margin_percent,
      pricing_basis_label,client_visible
    )
    select
      v_wo.id,l.line_order,l.line_type,l.description,l.cost_code_id,l.unit_id,l.quantity,l.unit_cost,l.unit_price,l.line_total,
      l.material_id,l.equipment_master_id,l.discount_percent,l.discount_amount,l.cost_total,l.margin_total,l.margin_percent,
      l.pricing_basis_label,l.client_visible
    from public.estimate_lines l
    where l.estimate_id=v_est.id
    order by l.line_order,l.created_at;
  end if;

  select coalesce(sum(estimated_cost) filter(where is_active and selected),0),
         coalesce(sum(estimated_charge) filter(where is_active and selected),0)
  into v_baseline_cost,v_baseline_charge
  from public.estimate_workflow_assumptions
  where estimate_id=v_est.id;

  select count(*) into v_snapshot_count from public.work_order_assumption_baselines where work_order_id=v_wo.id;
  if v_snapshot_count=0 then
    insert into public.work_order_assumption_baselines(
      work_order_id,estimate_id,source_assumption_id,snapshot_version,assumption_code,assumption_type,assumption_label,
      quantity,unit_label,unit_cost,baseline_cost,baseline_charge,optional_work,selected,notes,snapshotted_by_profile_id
    )
    select
      v_wo.id,v_est.id,a.id,v_est.assumption_version,a.assumption_code,a.assumption_type,a.assumption_label,
      a.quantity,a.unit_label,a.unit_cost,a.estimated_cost,a.estimated_charge,a.optional_work,a.selected,a.notes,p_actor_profile_id
    from public.estimate_workflow_assumptions a
    where a.estimate_id=v_est.id and a.is_active
    order by a.sort_order,a.created_at;
  end if;

  update public.work_orders w set
    client_site_id=coalesce(w.client_site_id,v_est.client_site_id),
    estimate_assumption_snapshot_version=coalesce(w.estimate_assumption_snapshot_version,v_est.assumption_version),
    estimate_baseline_cost_total=coalesce(w.estimate_baseline_cost_total,v_baseline_cost),
    estimate_baseline_charge_total=coalesce(w.estimate_baseline_charge_total,v_baseline_charge),
    estimate_baseline_markup_percent=coalesce(w.estimate_baseline_markup_percent,v_est.markup_percent),
    estimate_baseline_margin_percent=coalesce(w.estimate_baseline_margin_percent,v_est.target_margin_percent,v_est.margin_percent),
    estimate_baseline_captured_at=coalesce(w.estimate_baseline_captured_at,now()),
    updated_at=now()
  where w.id=v_wo.id
  returning w.* into v_wo;

  update public.estimates
  set status='accepted',converted_work_order_id=v_wo.id,converted_at=coalesce(converted_at,now()),updated_at=now()
  where id=v_est.id
  returning * into v_est;

  return jsonb_build_object(
    'estimate',to_jsonb(v_est),
    'work_order',to_jsonb(v_wo),
    'baseline_cost',v_baseline_cost,
    'baseline_charge',v_baseline_charge,
    'deposit_required',v_required,
    'deposit_paid',v_paid
  );
end;
$$;
revoke all on function public.ywi_rpc_estimate_convert_work_order(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_estimate_convert_work_order(uuid,uuid) to service_role;

create or replace function public.ywi_rpc_change_order_save(
  p_payload jsonb,
  p_actor_profile_id uuid
)
returns public.change_orders
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_id uuid := case when nullif(p_payload->>'id','') is null then null else (p_payload->>'id')::uuid end;
  v_work_order_id uuid := case when nullif(p_payload->>'work_order_id','') is null then null else (p_payload->>'work_order_id')::uuid end;
  v_status text := lower(coalesce(nullif(p_payload->>'status',''),'draft'));
  v_wo public.work_orders;
  v_row public.change_orders;
  v_number text := upper(nullif(btrim(p_payload->>'change_order_number'),''));
  v_scope text := nullif(btrim(p_payload->>'scope_summary'),'');
  v_reference text := nullif(btrim(p_payload->>'customer_approval_reference'),'');
begin
  if v_status not in ('draft','requested','approved','rejected','completed','void') then
    raise exception 'Unsupported change-order status.' using errcode='23514';
  end if;
  if v_id is null and v_work_order_id is null then raise exception 'Work order is required.' using errcode='23514'; end if;
  if v_id is null and v_scope is null then raise exception 'Change-order scope is required.' using errcode='23514'; end if;
  if v_status='approved' and v_reference is null then
    raise exception 'Customer approval evidence/reference is required before approving a change order.' using errcode='23514';
  end if;

  if v_work_order_id is not null then
    select * into v_wo from public.work_orders where id=v_work_order_id;
    if not found then raise exception 'Work order was not found.' using errcode='23503'; end if;
  end if;

  if v_id is null then
    v_number:=coalesce(v_number,'CO-'||to_char(current_date,'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
    insert into public.change_orders(
      job_id,agreement_id,change_order_number,status,requested_at,approved_at,approved_by_profile_id,
      scope_summary,reason,estimated_cost_delta,estimated_charge_delta,actual_cost_delta,actual_charge_delta,
      tax_code_id,notes,created_by_profile_id,work_order_id,estimate_id,
      customer_approval_reference,customer_approved_at,customer_approved_by_name
    ) values (
      v_wo.legacy_job_id,
      case when nullif(p_payload->>'agreement_id','') is null then null else (p_payload->>'agreement_id')::uuid end,
      v_number,v_status,now(),
      case when v_status='approved' then now() else null end,
      case when v_status='approved' then p_actor_profile_id else null end,
      v_scope,nullif(p_payload->>'reason',''),
      coalesce(nullif(p_payload->>'estimated_cost_delta','')::numeric,0),
      coalesce(nullif(p_payload->>'estimated_charge_delta','')::numeric,0),
      coalesce(nullif(p_payload->>'actual_cost_delta','')::numeric,0),
      coalesce(nullif(p_payload->>'actual_charge_delta','')::numeric,0),
      case when nullif(p_payload->>'tax_code_id','') is null then null else (p_payload->>'tax_code_id')::uuid end,
      nullif(p_payload->>'notes',''),p_actor_profile_id,v_wo.id,v_wo.estimate_id,
      v_reference,
      case when v_status='approved' then coalesce(nullif(p_payload->>'customer_approved_at','')::timestamptz,now()) else null end,
      case when v_status='approved' then nullif(p_payload->>'customer_approved_by_name','') else null end
    ) returning * into v_row;
  else
    select * into v_row from public.change_orders where id=v_id for update;
    if not found then raise exception 'Change order was not found.' using errcode='23503'; end if;
    if v_work_order_id is null then v_work_order_id:=v_row.work_order_id; end if;
    if v_work_order_id is not null then select * into v_wo from public.work_orders where id=v_work_order_id; end if;
    update public.change_orders ch set
      work_order_id=coalesce(v_work_order_id,ch.work_order_id),
      estimate_id=coalesce(v_wo.estimate_id,ch.estimate_id),
      job_id=coalesce(v_wo.legacy_job_id,ch.job_id),
      status=v_status,
      scope_summary=coalesce(v_scope,ch.scope_summary),
      reason=case when p_payload ? 'reason' then nullif(p_payload->>'reason','') else ch.reason end,
      estimated_cost_delta=case when p_payload ? 'estimated_cost_delta' then coalesce(nullif(p_payload->>'estimated_cost_delta','')::numeric,0) else ch.estimated_cost_delta end,
      estimated_charge_delta=case when p_payload ? 'estimated_charge_delta' then coalesce(nullif(p_payload->>'estimated_charge_delta','')::numeric,0) else ch.estimated_charge_delta end,
      actual_cost_delta=case when p_payload ? 'actual_cost_delta' then coalesce(nullif(p_payload->>'actual_cost_delta','')::numeric,0) else ch.actual_cost_delta end,
      actual_charge_delta=case when p_payload ? 'actual_charge_delta' then coalesce(nullif(p_payload->>'actual_charge_delta','')::numeric,0) else ch.actual_charge_delta end,
      notes=case when p_payload ? 'notes' then nullif(p_payload->>'notes','') else ch.notes end,
      customer_approval_reference=case when p_payload ? 'customer_approval_reference' then v_reference else ch.customer_approval_reference end,
      customer_approved_at=case when v_status='approved' then coalesce(nullif(p_payload->>'customer_approved_at','')::timestamptz,ch.customer_approved_at,now()) else ch.customer_approved_at end,
      customer_approved_by_name=case when p_payload ? 'customer_approved_by_name' then nullif(p_payload->>'customer_approved_by_name','') else ch.customer_approved_by_name end,
      approved_at=case when v_status='approved' then coalesce(ch.approved_at,now()) when v_status in ('rejected','void','draft','requested') then null else ch.approved_at end,
      approved_by_profile_id=case when v_status='approved' then p_actor_profile_id when v_status in ('rejected','void','draft','requested') then null else ch.approved_by_profile_id end,
      updated_at=now()
    where ch.id=v_id
    returning ch.* into v_row;
  end if;
  return v_row;
end;
$$;
revoke all on function public.ywi_rpc_change_order_save(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_change_order_save(jsonb,uuid) to service_role;

insert into public.app_module_write_contracts(
  action_key,owner_module,minimum_access,boundary_mode,domain_key,event_key,cross_module_event,is_enabled,description
) values
  ('estimate_workflow_save','jobs','approve','write','commercial_workflow','jobs.estimate.saved',false,true,'Create/update landscaping estimate workflow assumptions without creating invoice/payment effects.'),
  ('estimate_approval_decision','jobs','approve','write','commercial_workflow','jobs.estimate.approval_decided',false,true,'Record internal estimate approval state; customer acceptance remains separate.'),
  ('estimate_convert_work_order','jobs','approve','write','commercial_workflow','jobs.estimate.converted',true,true,'Convert an accepted/deposit-ready estimate into the canonical work order and snapshot assumptions.'),
  ('change_order_save','jobs','approve','write','commercial_workflow','jobs.change_order.saved',false,true,'Create/update a canonical change order linked to the work order with customer-approval evidence.')
on conflict(action_key) do update set
  owner_module=excluded.owner_module,
  minimum_access=excluded.minimum_access,
  boundary_mode=excluded.boundary_mode,
  domain_key=excluded.domain_key,
  event_key=excluded.event_key,
  cross_module_event=excluded.cross_module_event,
  is_enabled=excluded.is_enabled,
  description=excluded.description,
  updated_at=now();

create or replace function public.ywi_module_write_boundary_security_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'operations_action_contract_count',
    case when (select count(*) from public.app_module_write_contracts where is_enabled)=46 then 'passed' else 'failed' end,
    'Exactly 46 explicitly handled operations-manage actions have enabled write-boundary contracts.'
  union all
  select 'cross_module_events_named',
    case when not exists (
      select 1 from public.app_module_write_contracts
      where is_enabled and cross_module_event and event_key is null
    ) then 'passed' else 'failed' end,
    'Every declared cross-module effect has a stable event key.'
  union all
  select 'manual_deposit_mutation_disabled',
    case when exists (
      select 1 from public.app_module_write_contracts
      where action_key='deposit_status_update' and owner_module='finance' and boundary_mode='disabled' and is_enabled
    ) then 'passed' else 'failed' end,
    'Hosted payment truth cannot be manually changed through operations-manage.'
  union all
  select 'boundary_control_plane_private',
    case when not exists (
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('app_module_write_contracts','module_boundary_events','v_module_boundary_event_contract_status','operations_attention_states')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Boundary contracts, emitted events and attention disposition state remain private server control-plane data.';
$$;
revoke all on function public.ywi_module_write_boundary_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_module_write_boundary_security_assertions() to service_role;

create or replace function public.ywi_estimate_job_invoice_security_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'canonical_commercial_tables_rls',
    case when not exists(
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public'
        and c.relname in ('estimates','estimate_lines','work_orders','work_order_lines','change_orders','job_invoice_candidates')
        and not c.relrowsecurity
    ) then 'passed' else 'failed' end,
    'Canonical estimate, work-order, change-order and invoice-candidate tables remain RLS-enabled.'
  union all
  select 'assumption_tables_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('estimate_workflow_assumptions','work_order_assumption_baselines')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Assumptions and work-order baseline snapshots are private service-role data.'
  union all
  select 'workflow_views_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('v_estimate_workflow_assumption_directory','v_estimate_job_invoice_workflow','v_estimate_assumption_variance')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Build 324 workflow/readiness views are server-only.'
  union all
  select 'workflow_rpcs_private',
    case when not exists(
      select 1 from information_schema.routine_privileges
      where specific_schema='public'
        and routine_name in ('ywi_rpc_estimate_workflow_save','ywi_rpc_estimate_approval_decision','ywi_rpc_estimate_convert_work_order','ywi_rpc_change_order_save')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Build 324 mutation RPCs are callable only through server authority.'
  union all
  select 'workflow_actions_registered',
    case when (select count(*) from public.app_module_write_contracts
      where action_key in ('estimate_workflow_save','estimate_approval_decision','estimate_convert_work_order','change_order_save')
        and owner_module='jobs' and minimum_access='approve' and boundary_mode='write' and is_enabled)=4
      then 'passed' else 'failed' end,
    'Estimate, approval, conversion and change-order writes are explicit Jobs-approve contracts.'
  union all
  select 'portal_acceptance_authority_preserved',
    case when to_regprocedure('public.ywi_rpc_accept_quote_package(uuid,text,text,boolean,text,text,text,text)') is not null
      then 'passed' else 'failed' end,
    'Existing customer portal acceptance remains the customer-approval authority.'
  union all
  select 'finance_candidate_authority_preserved',
    case when to_regclass('public.job_invoice_candidates') is not null
      and to_regclass('public.finance_job_completion_intake') is not null
      then 'passed' else 'failed' end,
    'Build 324 hands invoice readiness to the existing Finance candidate authority rather than posting invoices.'
  union all
  select 'finance_provider_execution_off',
    case when not exists(
      select 1 from public.finance_job_completion_posting_execution_controls
      where execution_enabled=true or provider_mutation_enabled=true
    ) then 'passed' else 'failed' end,
    'Build 324 does not enable Finance posting or payment-provider mutation.';
$$;
revoke all on function public.ywi_estimate_job_invoice_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_estimate_job_invoice_security_assertions() to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  213,'213_estimate_job_invoice_workflow',
  'Adds landscaping estimate assumptions, approval/deposit gates, work-order baseline snapshots, change-order linkage and invoice-readiness views while preserving Finance authority.',
  'applied',now(),'schema213',
  'Canonical estimates/work_orders/change_orders remain authoritative; customer portal acceptance and Finance candidate/posting authorities are preserved; provider execution remains disabled.',
  '213_estimate_job_invoice_workflow.sql','schema213'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true)
as
select
  213 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=213 then 'current'
    when coalesce(max(schema_version) filter(where status='applied'),0)>213 then 'ahead'
    else 'drift'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=213 then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter(where status='applied'),0)>213 then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
