-- Schema 223 — Build 335 Fuel, Consumables & Materials Control
-- Reuses canonical materials_catalog, material_receipts, material_issues and fleet_fuel_logs.

begin;

alter table public.materials_catalog
  add column if not exists preferred_vendor_id uuid references public.ap_vendors(id) on delete set null,
  add column if not exists supplier_sku text,
  add column if not exists storage_location text,
  add column if not exists opening_quantity numeric(14,2) not null default 0,
  add column if not exists target_stock_quantity numeric(14,2),
  add column if not exists last_counted_at timestamptz,
  add column if not exists last_counted_by_profile_id uuid references public.profiles(id) on delete set null;

alter table public.materials_catalog drop constraint if exists materials_catalog_opening_quantity_check;
alter table public.materials_catalog add constraint materials_catalog_opening_quantity_check check (opening_quantity >= 0);
alter table public.materials_catalog drop constraint if exists materials_catalog_target_stock_quantity_check;
alter table public.materials_catalog add constraint materials_catalog_target_stock_quantity_check check (target_stock_quantity is null or target_stock_quantity >= 0);

alter table public.material_issue_lines
  add column if not exists usage_type text not null default 'job_use',
  add column if not exists planned_quantity numeric(14,2),
  add column if not exists waste_reason text;

alter table public.material_issue_lines drop constraint if exists material_issue_lines_usage_type_check;
alter table public.material_issue_lines add constraint material_issue_lines_usage_type_check
  check (usage_type in ('job_use','waste','internal_use','adjustment'));
alter table public.material_issue_lines drop constraint if exists material_issue_lines_planned_quantity_check;
alter table public.material_issue_lines add constraint material_issue_lines_planned_quantity_check
  check (planned_quantity is null or planned_quantity >= 0);

create table if not exists public.material_stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials_catalog(id) on delete cascade,
  adjustment_type text not null,
  quantity_delta numeric(14,2) not null,
  unit_cost numeric(12,2),
  work_order_id uuid references public.work_orders(id) on delete set null,
  job_id bigint references public.jobs(id) on delete set null,
  reason text not null,
  recorded_by_profile_id uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (adjustment_type in ('cycle_count','receipt_correction','issue_correction','damage_loss','found','transfer','other')),
  check (quantity_delta <> 0),
  check (unit_cost is null or unit_cost >= 0)
);

create index if not exists material_stock_adjustments_material_idx
  on public.material_stock_adjustments(material_id,recorded_at desc);
create index if not exists material_stock_adjustments_work_order_idx
  on public.material_stock_adjustments(work_order_id,recorded_at desc);
create index if not exists materials_catalog_preferred_vendor_idx
  on public.materials_catalog(preferred_vendor_id);
create index if not exists material_issue_lines_usage_type_idx
  on public.material_issue_lines(material_id,usage_type);

alter table public.material_stock_adjustments enable row level security;
revoke all on table public.material_stock_adjustments from public,anon,authenticated;
grant select,insert,update,delete on table public.material_stock_adjustments to service_role;

create or replace view public.v_material_stock_control
with (security_invoker=true)
as
with receipt_rollup as (
  select
    mrl.material_id,
    coalesce(sum(mrl.quantity) filter(where coalesce(mr.receipt_status,'draft') not in ('draft','void','cancelled')),0)::numeric(14,2) as received_quantity,
    coalesce(sum(mrl.line_total) filter(where coalesce(mr.receipt_status,'draft') not in ('draft','void','cancelled')),0)::numeric(14,2) as received_cost_total,
    max(mr.receipt_date) filter(where coalesce(mr.receipt_status,'draft') not in ('draft','void','cancelled')) as last_receipt_date
  from public.material_receipt_lines mrl
  join public.material_receipts mr on mr.id=mrl.receipt_id
  where mrl.material_id is not null
  group by mrl.material_id
), latest_receipt_cost as (
  select distinct on (mrl.material_id)
    mrl.material_id,
    mrl.unit_cost as last_unit_cost,
    mr.vendor_id as last_vendor_id
  from public.material_receipt_lines mrl
  join public.material_receipts mr on mr.id=mrl.receipt_id
  where mrl.material_id is not null
    and coalesce(mr.receipt_status,'draft') not in ('draft','void','cancelled')
  order by mrl.material_id,mr.receipt_date desc,mrl.created_at desc
), issue_rollup as (
  select
    mil.material_id,
    coalesce(sum(mil.quantity) filter(where coalesce(mi.issue_status,'draft') not in ('draft','void')),0)::numeric(14,2) as issued_quantity,
    coalesce(sum(mil.quantity) filter(where coalesce(mi.issue_status,'draft') not in ('draft','void') and mil.usage_type='job_use'),0)::numeric(14,2) as job_use_quantity,
    coalesce(sum(mil.quantity) filter(where coalesce(mi.issue_status,'draft') not in ('draft','void') and mil.usage_type='waste'),0)::numeric(14,2) as waste_quantity,
    coalesce(sum(mil.quantity) filter(where coalesce(mi.issue_status,'draft') not in ('draft','void') and mil.usage_type='internal_use'),0)::numeric(14,2) as internal_use_quantity,
    coalesce(sum(mil.line_total) filter(where coalesce(mi.issue_status,'draft') not in ('draft','void')),0)::numeric(14,2) as issued_cost_total,
    coalesce(sum(mil.quantity-coalesce(mil.planned_quantity,mil.quantity)) filter(where coalesce(mi.issue_status,'draft') not in ('draft','void') and mil.usage_type='job_use'),0)::numeric(14,2) as usage_variance_quantity,
    max(mi.issue_date) filter(where coalesce(mi.issue_status,'draft') not in ('draft','void')) as last_issue_date
  from public.material_issue_lines mil
  join public.material_issues mi on mi.id=mil.issue_id
  where mil.material_id is not null
  group by mil.material_id
), adjustment_rollup as (
  select material_id,
    coalesce(sum(quantity_delta),0)::numeric(14,2) as adjustment_quantity,
    max(recorded_at) as last_adjustment_at
  from public.material_stock_adjustments
  group by material_id
)
select
  mc.id,
  mc.sku,
  mc.item_name,
  mc.material_category,
  mc.unit_id,
  u.code as unit_code,
  u.name as unit_name,
  mc.default_unit_cost,
  coalesce(lrc.last_unit_cost,mc.default_unit_cost,0)::numeric(12,2) as current_unit_cost,
  mc.default_bill_rate,
  mc.inventory_tracked,
  mc.reorder_point,
  mc.reorder_quantity,
  mc.target_stock_quantity,
  mc.opening_quantity,
  mc.preferred_vendor_id,
  coalesce(v.display_name,v.legal_name) as preferred_vendor_name,
  mc.supplier_sku,
  mc.storage_location,
  mc.is_active,
  coalesce(rr.received_quantity,0)::numeric(14,2) as received_quantity,
  coalesce(ir.issued_quantity,0)::numeric(14,2) as issued_quantity,
  coalesce(ir.job_use_quantity,0)::numeric(14,2) as job_use_quantity,
  coalesce(ir.waste_quantity,0)::numeric(14,2) as waste_quantity,
  coalesce(ir.internal_use_quantity,0)::numeric(14,2) as internal_use_quantity,
  coalesce(ar.adjustment_quantity,0)::numeric(14,2) as adjustment_quantity,
  (mc.opening_quantity+coalesce(rr.received_quantity,0)+coalesce(ar.adjustment_quantity,0)-coalesce(ir.issued_quantity,0))::numeric(14,2) as stock_on_hand,
  ((mc.opening_quantity+coalesce(rr.received_quantity,0)+coalesce(ar.adjustment_quantity,0)-coalesce(ir.issued_quantity,0))*coalesce(lrc.last_unit_cost,mc.default_unit_cost,0))::numeric(14,2) as stock_value,
  coalesce(ir.usage_variance_quantity,0)::numeric(14,2) as usage_variance_quantity,
  case
    when not mc.inventory_tracked or mc.reorder_point is null then false
    when (mc.opening_quantity+coalesce(rr.received_quantity,0)+coalesce(ar.adjustment_quantity,0)-coalesce(ir.issued_quantity,0)) <= mc.reorder_point then true
    else false
  end as reorder_required,
  case
    when not mc.inventory_tracked then 'not_tracked'
    when mc.reorder_point is not null and (mc.opening_quantity+coalesce(rr.received_quantity,0)+coalesce(ar.adjustment_quantity,0)-coalesce(ir.issued_quantity,0)) <= mc.reorder_point then 'reorder'
    when mc.target_stock_quantity is not null and (mc.opening_quantity+coalesce(rr.received_quantity,0)+coalesce(ar.adjustment_quantity,0)-coalesce(ir.issued_quantity,0)) < mc.target_stock_quantity then 'below_target'
    else 'ok'
  end as stock_status,
  rr.last_receipt_date,
  ir.last_issue_date,
  ar.last_adjustment_at,
  mc.last_counted_at,
  lrc.last_vendor_id,
  coalesce(lv.display_name,lv.legal_name) as last_vendor_name
from public.materials_catalog mc
left join public.units_of_measure u on u.id=mc.unit_id
left join public.ap_vendors v on v.id=mc.preferred_vendor_id
left join receipt_rollup rr on rr.material_id=mc.id
left join latest_receipt_cost lrc on lrc.material_id=mc.id
left join public.ap_vendors lv on lv.id=lrc.last_vendor_id
left join issue_rollup ir on ir.material_id=mc.id
left join adjustment_rollup ar on ar.material_id=mc.id;

create or replace view public.v_material_control_summary
with (security_invoker=true)
as
select
  count(*) filter(where is_active)::int as active_material_count,
  count(*) filter(where is_active and inventory_tracked)::int as tracked_material_count,
  count(*) filter(where is_active and reorder_required)::int as reorder_required_count,
  coalesce(sum(stock_value) filter(where is_active and inventory_tracked),0)::numeric(14,2) as stock_value_total,
  coalesce(sum(job_use_quantity) filter(where is_active),0)::numeric(14,2) as job_use_quantity_total,
  coalesce(sum(waste_quantity) filter(where is_active),0)::numeric(14,2) as waste_quantity_total,
  coalesce(sum(usage_variance_quantity) filter(where is_active),0)::numeric(14,2) as usage_variance_quantity_total
from public.v_material_stock_control;

create or replace view public.v_fuel_consumables_summary
with (security_invoker=true)
as
select
  coalesce(nullif(trim(fuel_type),''),'unspecified') as fuel_type,
  count(*)::int as fuel_event_count,
  coalesce(sum(quantity_litres),0)::numeric(14,2) as quantity_litres,
  coalesce(sum(total_cost),0)::numeric(14,2) as total_cost,
  case when coalesce(sum(quantity_litres),0)>0 then (coalesce(sum(total_cost),0)/sum(quantity_litres))::numeric(12,4) else 0::numeric end as average_cost_per_litre,
  max(fueled_at) as last_fueled_at
from public.fleet_fuel_logs
group by coalesce(nullif(trim(fuel_type),''),'unspecified');

revoke all on table public.v_material_stock_control from public,anon,authenticated;
revoke all on table public.v_material_control_summary from public,anon,authenticated;
revoke all on table public.v_fuel_consumables_summary from public,anon,authenticated;
grant select on table public.v_material_stock_control to service_role;
grant select on table public.v_material_control_summary to service_role;
grant select on table public.v_fuel_consumables_summary to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  223,'fuel_consumables_materials_control',
  'Build 335 extends the canonical material catalog, receipts and issues with supplier, stock, reorder, waste, job-use and variance controls while reusing fleet fuel logs.',
  'applied',now(),'schema223',
  'No parallel inventory authority: stock is derived from opening quantity + canonical receipts + adjustments - canonical issues. Fleet fuel remains fleet_fuel_logs.',
  '223_fuel_consumables_materials_control.sql','schema223'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true)
as
select
  223 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=223 then 'current'
    when coalesce(max(schema_version) filter(where status='applied'),0)>223 then 'ahead'
    else 'drift'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=223 then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter(where status='applied'),0)>223 then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
