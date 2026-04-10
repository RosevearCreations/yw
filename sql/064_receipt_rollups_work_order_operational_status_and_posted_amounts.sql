-- 064_receipt_rollups_work_order_operational_status_and_posted_amounts.sql
-- Follow-up polish on top of 063:
-- - clearer receipt allocation rollups
-- - work-order operational visibility for receiving + HSE linkage
-- - posted/open amount visibility for AR/AP records

create extension if not exists pgcrypto;

create or replace view public.v_material_receipt_rollups as
with receipt_rollups as (
  select
    mr.id,
    mr.receipt_number,
    mr.receipt_status,
    mr.vendor_id,
    mr.work_order_id,
    count(mrl.id) as line_count,
    coalesce(sum(mrl.quantity), 0) as quantity_total,
    coalesce(sum(mrl.line_total), 0) as receipt_total,
    coalesce(sum(case when mrl.work_order_line_id is not null then mrl.line_total else 0 end), 0) as allocated_receipt_total,
    coalesce(sum(case when mrl.work_order_line_id is null then mrl.line_total else 0 end), 0) as unallocated_receipt_total,
    count(distinct mrl.work_order_line_id) filter (where mrl.work_order_line_id is not null) as linked_work_order_line_count
  from public.material_receipts mr
  left join public.material_receipt_lines mrl on mrl.receipt_id = mr.id
  group by mr.id, mr.receipt_number, mr.receipt_status, mr.vendor_id, mr.work_order_id
)
select * from receipt_rollups;

create or replace view public.v_work_order_rollups as
with line_rollups as (
  select
    wo.id,
    count(wol.id) as line_count,
    coalesce(sum(wol.line_total), 0) as rolled_subtotal,
    coalesce(sum(wol.actual_material_cost), 0) as actual_material_cost_total
  from public.work_orders wo
  left join public.work_order_lines wol on wol.work_order_id = wo.id
  group by wo.id
),
receipt_rollups as (
  select
    mr.work_order_id,
    count(distinct mr.id) as receipt_count,
    coalesce(sum(mrl.quantity), 0) as received_material_quantity_total,
    coalesce(sum(mrl.line_total), 0) as received_material_cost_total,
    coalesce(sum(case when mrl.work_order_line_id is not null then mrl.line_total else 0 end), 0) as allocated_receipt_cost_total,
    coalesce(sum(case when mrl.work_order_line_id is null then mrl.line_total else 0 end), 0) as unallocated_receipt_cost_total
  from public.material_receipts mr
  left join public.material_receipt_lines mrl on mrl.receipt_id = mr.id
  where mr.work_order_id is not null
  group by mr.work_order_id
),
hse_rollups as (
  select
    lhp.work_order_id,
    count(lhp.id) filter (where lhp.packet_status in ('draft', 'in_progress')) as open_hse_packets,
    count(lhp.id) filter (where lhp.packet_status = 'ready_for_closeout') as ready_hse_packets,
    count(lhp.id) filter (where lhp.packet_status = 'closed') as closed_hse_packets
  from public.linked_hse_packets lhp
  where lhp.work_order_id is not null
  group by lhp.work_order_id
)
select
  wo.id,
  wo.work_order_number,
  wo.status,
  wo.client_id,
  coalesce(lr.line_count, 0) as line_count,
  coalesce(lr.rolled_subtotal, 0) as rolled_subtotal,
  coalesce(lr.actual_material_cost_total, 0) as actual_material_cost_total,
  wo.tax_total,
  public.ywi_normalize_money(coalesce(lr.rolled_subtotal, 0) + coalesce(wo.tax_total, 0)) as rolled_total,
  coalesce(hr.open_hse_packets, 0) as open_hse_packets,
  coalesce(hr.ready_hse_packets, 0) as ready_hse_packets,
  coalesce(hr.closed_hse_packets, 0) as closed_hse_packets,
  coalesce(rr.receipt_count, 0) as receipt_count,
  coalesce(rr.received_material_quantity_total, 0) as received_material_quantity_total,
  coalesce(rr.received_material_cost_total, 0) as received_material_cost_total,
  coalesce(rr.allocated_receipt_cost_total, 0) as allocated_receipt_cost_total,
  coalesce(rr.unallocated_receipt_cost_total, 0) as unallocated_receipt_cost_total,
  case
    when wo.status = 'closed' then 'closed'
    when wo.status = 'completed' and coalesce(hr.open_hse_packets, 0) = 0 then 'ready_for_billing'
    when wo.status in ('in_progress', 'completed') or coalesce(rr.receipt_count, 0) > 0 or coalesce(hr.open_hse_packets, 0) > 0 then 'active'
    when wo.status = 'scheduled' then 'scheduled'
    else 'draft'
  end as operational_status
from public.work_orders wo
left join line_rollups lr on lr.id = wo.id
left join receipt_rollups rr on rr.work_order_id = wo.id
left join hse_rollups hr on hr.work_order_id = wo.id;

create or replace view public.v_account_balance_rollups as
select
  'ar_invoice'::text as record_type,
  ai.id,
  ai.invoice_number as record_number,
  ai.client_id,
  ai.total_amount,
  public.ywi_normalize_money(coalesce(ai.total_amount, 0) - coalesce(ai.balance_due, 0)) as posted_amount,
  ai.balance_due,
  ai.invoice_status as status,
  public.ywi_normalize_money(coalesce(ai.balance_due, 0)) as open_amount,
  case
    when coalesce(ai.total_amount, 0) <= 0 then 0
    else round(((coalesce(ai.total_amount, 0) - coalesce(ai.balance_due, 0)) / nullif(ai.total_amount, 0)) * 100, 2)
  end as posted_percent
from public.ar_invoices ai
union all
select
  'ap_bill'::text as record_type,
  ab.id,
  ab.bill_number as record_number,
  ab.vendor_id as client_id,
  ab.total_amount,
  public.ywi_normalize_money(coalesce(ab.total_amount, 0) - coalesce(ab.balance_due, 0)) as posted_amount,
  ab.balance_due,
  ab.bill_status as status,
  public.ywi_normalize_money(coalesce(ab.balance_due, 0)) as open_amount,
  case
    when coalesce(ab.total_amount, 0) <= 0 then 0
    else round(((coalesce(ab.total_amount, 0) - coalesce(ab.balance_due, 0)) / nullif(ab.total_amount, 0)) * 100, 2)
  end as posted_percent
from public.ap_bills ab;

create index if not exists idx_material_receipt_lines_material_id on public.material_receipt_lines(material_id);
create index if not exists idx_work_orders_route_id on public.work_orders(route_id);
