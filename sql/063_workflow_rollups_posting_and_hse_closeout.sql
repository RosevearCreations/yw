-- 063_workflow_rollups_posting_and_hse_closeout.sql
-- Workflow polish pass focused on database-enforced totals, payment posting,
-- receiving-to-costing flow, and linked HSE packet progress / closeout.

create extension if not exists pgcrypto;

alter table if exists public.work_order_lines
  add column if not exists actual_quantity_received numeric(12,2) not null default 0,
  add column if not exists actual_material_cost numeric(12,2) not null default 0;

alter table if exists public.work_orders
  add column if not exists actual_material_cost_total numeric(12,2) not null default 0;

alter table if exists public.linked_hse_packets
  add column if not exists briefing_completed boolean not null default false,
  add column if not exists inspection_completed boolean not null default false,
  add column if not exists emergency_review_completed boolean not null default false,
  add column if not exists ready_for_closeout_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists closeout_notes text;

create or replace function public.ywi_normalize_money(value numeric)
returns numeric
language sql
immutable
as $$
  select round(coalesce(value, 0)::numeric, 2)
$$;

create or replace function public.ywi_next_line_order(parent_table regclass, parent_column text, parent_id uuid, current_id uuid default null)
returns integer
language plpgsql
as $$
declare
  v_sql text;
  v_next integer;
begin
  if parent_id is null then
    return 10;
  end if;

  v_sql := format(
    'select coalesce(max(line_order), 0) + 10 from %s where %I = $1 and ($2 is null or id <> $2)',
    parent_table,
    parent_column
  );

  execute v_sql into v_next using parent_id, current_id;
  return coalesce(v_next, 10);
end;
$$;

create or replace function public.ywi_next_stop_order(route_id uuid, current_id uuid default null)
returns integer
language plpgsql
as $$
declare
  v_next integer;
begin
  if route_id is null then
    return 10;
  end if;

  select coalesce(max(stop_order), 0) + 10
    into v_next
  from public.route_stops
  where route_stops.route_id = ywi_next_stop_order.route_id
    and (current_id is null or id <> current_id);

  return coalesce(v_next, 10);
end;
$$;

create or replace function public.ywi_before_route_stop()
returns trigger
language plpgsql
as $$
begin
  if new.stop_order is null or new.stop_order <= 0 then
    new.stop_order := public.ywi_next_stop_order(new.route_id, new.id);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ywi_before_route_stop on public.route_stops;
create trigger trg_ywi_before_route_stop
before insert or update on public.route_stops
for each row execute function public.ywi_before_route_stop();

create or replace function public.ywi_before_estimate_line()
returns trigger
language plpgsql
as $$
begin
  if new.line_order is null or new.line_order <= 0 then
    new.line_order := public.ywi_next_line_order('public.estimate_lines'::regclass, 'estimate_id', new.estimate_id, new.id);
  end if;
  new.quantity := coalesce(new.quantity, 1);
  new.unit_cost := public.ywi_normalize_money(new.unit_cost);
  new.unit_price := public.ywi_normalize_money(new.unit_price);
  new.line_total := public.ywi_normalize_money(coalesce(new.quantity, 0) * coalesce(new.unit_price, 0));
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ywi_before_estimate_line on public.estimate_lines;
create trigger trg_ywi_before_estimate_line
before insert or update on public.estimate_lines
for each row execute function public.ywi_before_estimate_line();

create or replace function public.ywi_before_work_order_line()
returns trigger
language plpgsql
as $$
begin
  if new.line_order is null or new.line_order <= 0 then
    new.line_order := public.ywi_next_line_order('public.work_order_lines'::regclass, 'work_order_id', new.work_order_id, new.id);
  end if;
  new.quantity := coalesce(new.quantity, 1);
  new.unit_cost := public.ywi_normalize_money(new.unit_cost);
  new.unit_price := public.ywi_normalize_money(new.unit_price);
  new.line_total := public.ywi_normalize_money(coalesce(new.quantity, 0) * coalesce(new.unit_price, 0));
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ywi_before_work_order_line on public.work_order_lines;
create trigger trg_ywi_before_work_order_line
before insert or update on public.work_order_lines
for each row execute function public.ywi_before_work_order_line();

create or replace function public.ywi_before_material_receipt_line()
returns trigger
language plpgsql
as $$
begin
  if new.line_order is null or new.line_order <= 0 then
    new.line_order := public.ywi_next_line_order('public.material_receipt_lines'::regclass, 'receipt_id', new.receipt_id, new.id);
  end if;
  new.quantity := coalesce(new.quantity, 0);
  new.unit_cost := public.ywi_normalize_money(new.unit_cost);
  new.line_total := public.ywi_normalize_money(coalesce(new.quantity, 0) * coalesce(new.unit_cost, 0));
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ywi_before_material_receipt_line on public.material_receipt_lines;
create trigger trg_ywi_before_material_receipt_line
before insert or update on public.material_receipt_lines
for each row execute function public.ywi_before_material_receipt_line();

create or replace function public.ywi_recalc_estimate_totals(p_estimate_id uuid)
returns void
language plpgsql
as $$
declare
  v_subtotal numeric := 0;
  v_tax numeric := 0;
begin
  if p_estimate_id is null then
    return;
  end if;

  select coalesce(sum(line_total), 0)
    into v_subtotal
  from public.estimate_lines
  where estimate_id = p_estimate_id;

  select coalesce(tax_total, 0)
    into v_tax
  from public.estimates
  where id = p_estimate_id;

  update public.estimates
  set subtotal = public.ywi_normalize_money(v_subtotal),
      total_amount = public.ywi_normalize_money(v_subtotal + v_tax),
      updated_at = now()
  where id = p_estimate_id;
end;
$$;

create or replace function public.ywi_recalc_work_order_totals(p_work_order_id uuid)
returns void
language plpgsql
as $$
declare
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_actual_material_cost numeric := 0;
begin
  if p_work_order_id is null then
    return;
  end if;

  select coalesce(sum(line_total), 0), coalesce(sum(actual_material_cost), 0)
    into v_subtotal, v_actual_material_cost
  from public.work_order_lines
  where work_order_id = p_work_order_id;

  select coalesce(tax_total, 0)
    into v_tax
  from public.work_orders
  where id = p_work_order_id;

  update public.work_orders
  set subtotal = public.ywi_normalize_money(v_subtotal),
      total_amount = public.ywi_normalize_money(v_subtotal + v_tax),
      actual_material_cost_total = public.ywi_normalize_money(v_actual_material_cost),
      updated_at = now()
  where id = p_work_order_id;
end;
$$;

create or replace function public.ywi_after_estimate_line_recalc()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.ywi_recalc_estimate_totals(new.estimate_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.ywi_recalc_estimate_totals(old.estimate_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_ywi_after_estimate_line_recalc on public.estimate_lines;
create trigger trg_ywi_after_estimate_line_recalc
after insert or update or delete on public.estimate_lines
for each row execute function public.ywi_after_estimate_line_recalc();

create or replace function public.ywi_after_work_order_line_recalc()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.ywi_recalc_work_order_totals(new.work_order_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.ywi_recalc_work_order_totals(old.work_order_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_ywi_after_work_order_line_recalc on public.work_order_lines;
create trigger trg_ywi_after_work_order_line_recalc
after insert or update or delete on public.work_order_lines
for each row execute function public.ywi_after_work_order_line_recalc();

create or replace function public.ywi_sync_work_order_line_actuals(p_work_order_line_id uuid)
returns void
language plpgsql
as $$
declare
  v_work_order_id uuid;
  v_qty numeric := 0;
  v_cost numeric := 0;
begin
  if p_work_order_line_id is null then
    return;
  end if;

  select coalesce(sum(quantity), 0), coalesce(sum(line_total), 0)
    into v_qty, v_cost
  from public.material_receipt_lines
  where work_order_line_id = p_work_order_line_id;

  update public.work_order_lines
  set actual_quantity_received = public.ywi_normalize_money(v_qty),
      actual_material_cost = public.ywi_normalize_money(v_cost),
      updated_at = now()
  where id = p_work_order_line_id;

  select work_order_id into v_work_order_id
  from public.work_order_lines
  where id = p_work_order_line_id;

  perform public.ywi_recalc_work_order_totals(v_work_order_id);
end;
$$;

create or replace function public.ywi_after_material_receipt_line_sync()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.ywi_sync_work_order_line_actuals(new.work_order_line_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.ywi_sync_work_order_line_actuals(old.work_order_line_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_ywi_after_material_receipt_line_sync on public.material_receipt_lines;
create trigger trg_ywi_after_material_receipt_line_sync
after insert or update or delete on public.material_receipt_lines
for each row execute function public.ywi_after_material_receipt_line_sync();

create or replace function public.ywi_recalc_ar_invoice_balance(p_invoice_id uuid)
returns void
language plpgsql
as $$
declare
  v_total numeric := 0;
  v_paid numeric := 0;
  v_balance numeric := 0;
  v_status text;
begin
  if p_invoice_id is null then
    return;
  end if;

  select coalesce(total_amount, 0), invoice_status
    into v_total, v_status
  from public.ar_invoices
  where id = p_invoice_id;

  select coalesce(sum(amount), 0)
    into v_paid
  from public.ar_payments
  where invoice_id = p_invoice_id;

  v_balance := greatest(v_total - v_paid, 0);

  update public.ar_invoices
  set balance_due = public.ywi_normalize_money(v_balance),
      invoice_status = case
        when invoice_status = 'void' then 'void'
        when public.ywi_normalize_money(v_total) <= 0 then invoice_status
        when public.ywi_normalize_money(v_balance) = 0 then 'paid'
        when public.ywi_normalize_money(v_paid) > 0 then 'partial'
        when invoice_status in ('paid', 'partial') then 'issued'
        else invoice_status
      end,
      updated_at = now()
  where id = p_invoice_id;
end;
$$;

create or replace function public.ywi_after_ar_payment_recalc()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.ywi_recalc_ar_invoice_balance(new.invoice_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.ywi_recalc_ar_invoice_balance(old.invoice_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_ywi_after_ar_payment_recalc on public.ar_payments;
create trigger trg_ywi_after_ar_payment_recalc
after insert or update or delete on public.ar_payments
for each row execute function public.ywi_after_ar_payment_recalc();

create or replace function public.ywi_recalc_ap_bill_balance(p_bill_id uuid)
returns void
language plpgsql
as $$
declare
  v_total numeric := 0;
  v_paid numeric := 0;
  v_balance numeric := 0;
begin
  if p_bill_id is null then
    return;
  end if;

  select coalesce(total_amount, 0)
    into v_total
  from public.ap_bills
  where id = p_bill_id;

  select coalesce(sum(amount), 0)
    into v_paid
  from public.ap_payments
  where bill_id = p_bill_id;

  v_balance := greatest(v_total - v_paid, 0);

  update public.ap_bills
  set balance_due = public.ywi_normalize_money(v_balance),
      bill_status = case
        when bill_status = 'void' then 'void'
        when public.ywi_normalize_money(v_total) <= 0 then bill_status
        when public.ywi_normalize_money(v_balance) = 0 then 'paid'
        when public.ywi_normalize_money(v_paid) > 0 then 'partial'
        when bill_status in ('paid', 'partial') then 'scheduled'
        else bill_status
      end,
      updated_at = now()
  where id = p_bill_id;
end;
$$;

create or replace function public.ywi_after_ap_payment_recalc()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.ywi_recalc_ap_bill_balance(new.bill_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.ywi_recalc_ap_bill_balance(old.bill_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_ywi_after_ap_payment_recalc on public.ap_payments;
create trigger trg_ywi_after_ap_payment_recalc
after insert or update or delete on public.ap_payments
for each row execute function public.ywi_after_ap_payment_recalc();

create or replace function public.ywi_before_linked_hse_packet()
returns trigger
language plpgsql
as $$
declare
  v_required_count integer := 0;
  v_completed_count integer := 0;
begin
  v_required_count :=
      (case when coalesce(new.briefing_required, false) then 1 else 0 end)
    + (case when coalesce(new.inspection_required, false) then 1 else 0 end)
    + (case when coalesce(new.emergency_review_required, false) then 1 else 0 end);

  v_completed_count :=
      (case when coalesce(new.briefing_required, false) and coalesce(new.briefing_completed, false) then 1 else 0 end)
    + (case when coalesce(new.inspection_required, false) and coalesce(new.inspection_completed, false) then 1 else 0 end)
    + (case when coalesce(new.emergency_review_required, false) and coalesce(new.emergency_review_completed, false) then 1 else 0 end);

  if coalesce(new.packet_status, '') = 'closed' then
    new.completion_percent := 100;
    new.ready_for_closeout_at := coalesce(new.ready_for_closeout_at, now());
    new.closed_at := coalesce(new.closed_at, now());
  else
    if v_required_count <= 0 then
      new.completion_percent := 100;
      new.packet_status := 'ready_for_closeout';
      new.ready_for_closeout_at := coalesce(new.ready_for_closeout_at, now());
    else
      new.completion_percent := round((v_completed_count::numeric / v_required_count::numeric) * 100, 2);
      if v_completed_count = v_required_count then
        new.packet_status := 'ready_for_closeout';
        new.ready_for_closeout_at := coalesce(new.ready_for_closeout_at, now());
      elsif v_completed_count > 0 then
        if coalesce(new.packet_status, '') not in ('closed') then
          new.packet_status := 'in_progress';
        end if;
        new.ready_for_closeout_at := null;
        new.closed_at := null;
      else
        new.packet_status := 'draft';
        new.ready_for_closeout_at := null;
        new.closed_at := null;
      end if;
    end if;
  end if;

  if coalesce(new.packet_status, '') <> 'closed' then
    new.closed_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ywi_before_linked_hse_packet on public.linked_hse_packets;
create trigger trg_ywi_before_linked_hse_packet
before insert or update on public.linked_hse_packets
for each row execute function public.ywi_before_linked_hse_packet();

create or replace view public.v_route_rollups as
select
  r.id,
  r.route_code,
  r.name,
  r.route_type,
  count(rs.id) as stop_count,
  count(*) filter (where rs.is_active is true) as active_stop_count,
  coalesce(sum(rs.planned_duration_minutes), 0) as planned_minutes_total,
  min(rs.planned_arrival_time) as first_planned_arrival,
  max(rs.planned_arrival_time) as last_planned_arrival
from public.routes r
left join public.route_stops rs on rs.route_id = r.id
group by r.id, r.route_code, r.name, r.route_type;

create or replace view public.v_estimate_rollups as
select
  e.id,
  e.estimate_number,
  e.status,
  e.client_id,
  count(el.id) as line_count,
  coalesce(sum(el.line_total), 0) as rolled_subtotal,
  e.tax_total,
  public.ywi_normalize_money(coalesce(sum(el.line_total), 0) + coalesce(e.tax_total, 0)) as rolled_total
from public.estimates e
left join public.estimate_lines el on el.estimate_id = e.id
group by e.id, e.estimate_number, e.status, e.client_id, e.tax_total;

create or replace view public.v_work_order_rollups as
select
  wo.id,
  wo.work_order_number,
  wo.status,
  wo.client_id,
  count(wol.id) as line_count,
  coalesce(sum(wol.line_total), 0) as rolled_subtotal,
  coalesce(sum(wol.actual_material_cost), 0) as actual_material_cost_total,
  wo.tax_total,
  public.ywi_normalize_money(coalesce(sum(wol.line_total), 0) + coalesce(wo.tax_total, 0)) as rolled_total,
  count(lhp.id) filter (where lhp.packet_status in ('draft', 'in_progress')) as open_hse_packets,
  count(lhp.id) filter (where lhp.packet_status = 'ready_for_closeout') as ready_hse_packets,
  count(lhp.id) filter (where lhp.packet_status = 'closed') as closed_hse_packets
from public.work_orders wo
left join public.work_order_lines wol on wol.work_order_id = wo.id
left join public.linked_hse_packets lhp on lhp.work_order_id = wo.id
group by wo.id, wo.work_order_number, wo.status, wo.client_id, wo.tax_total;

create or replace view public.v_material_receipt_rollups as
select
  mr.id,
  mr.receipt_number,
  mr.receipt_status,
  mr.vendor_id,
  mr.work_order_id,
  count(mrl.id) as line_count,
  coalesce(sum(mrl.quantity), 0) as quantity_total,
  coalesce(sum(mrl.line_total), 0) as receipt_total
from public.material_receipts mr
left join public.material_receipt_lines mrl on mrl.receipt_id = mr.id
group by mr.id, mr.receipt_number, mr.receipt_status, mr.vendor_id, mr.work_order_id;

create or replace view public.v_hse_packet_progress as
select
  lhp.id,
  lhp.packet_number,
  lhp.packet_type,
  lhp.packet_status,
  lhp.work_order_id,
  lhp.dispatch_id,
  ((case when lhp.briefing_required then 1 else 0 end)
    + (case when lhp.inspection_required then 1 else 0 end)
    + (case when lhp.emergency_review_required then 1 else 0 end)) as required_step_count,
  ((case when lhp.briefing_required and lhp.briefing_completed then 1 else 0 end)
    + (case when lhp.inspection_required and lhp.inspection_completed then 1 else 0 end)
    + (case when lhp.emergency_review_required and lhp.emergency_review_completed then 1 else 0 end)) as completed_step_count,
  lhp.completion_percent,
  lhp.ready_for_closeout_at,
  lhp.closed_at
from public.linked_hse_packets lhp;

create or replace view public.v_account_balance_rollups as
select
  'ar_invoice'::text as record_type,
  ai.id,
  ai.invoice_number as record_number,
  ai.client_id,
  ai.total_amount,
  coalesce(sum(ap.amount), 0) as posted_amount,
  ai.balance_due,
  ai.invoice_status as status
from public.ar_invoices ai
left join public.ar_payments ap on ap.invoice_id = ai.id
group by ai.id, ai.invoice_number, ai.client_id, ai.total_amount, ai.balance_due, ai.invoice_status
union all
select
  'ap_bill'::text as record_type,
  ab.id,
  ab.bill_number as record_number,
  ab.vendor_id as client_id,
  ab.total_amount,
  coalesce(sum(app.amount), 0) as posted_amount,
  ab.balance_due,
  ab.bill_status as status
from public.ap_bills ab
left join public.ap_payments app on app.bill_id = ab.id
group by ab.id, ab.bill_number, ab.vendor_id, ab.total_amount, ab.balance_due, ab.bill_status;

create index if not exists idx_material_receipt_lines_work_order_line_id on public.material_receipt_lines(work_order_line_id);
create index if not exists idx_linked_hse_packets_status on public.linked_hse_packets(packet_status);
