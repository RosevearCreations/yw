-- 063_workflow_rollups_posting_and_hse_closeout.sql
-- Workflow polish pass:
-- DB-side totals rollups, payment application logic,
-- receiving-to-costing linkage, and HSE packet progress/closeout fields.

create extension if not exists pgcrypto;

alter table if exists public.estimates
  add column if not exists line_count integer not null default 0,
  add column if not exists total_cost numeric(12,2) not null default 0,
  add column if not exists margin_amount numeric(12,2) not null default 0,
  add column if not exists margin_percent numeric(7,2) not null default 0,
  add column if not exists rollup_updated_at timestamptz;

alter table if exists public.work_orders
  add column if not exists line_count integer not null default 0,
  add column if not exists total_cost numeric(12,2) not null default 0,
  add column if not exists margin_amount numeric(12,2) not null default 0,
  add column if not exists margin_percent numeric(7,2) not null default 0,
  add column if not exists received_cost_total numeric(12,2) not null default 0,
  add column if not exists rollup_updated_at timestamptz;

alter table if exists public.work_order_lines
  add column if not exists received_quantity numeric(12,2) not null default 0,
  add column if not exists received_cost_total numeric(12,2) not null default 0;

alter table if exists public.material_receipts
  add column if not exists line_count integer not null default 0,
  add column if not exists total_amount numeric(12,2) not null default 0,
  add column if not exists rollup_updated_at timestamptz;

alter table if exists public.ar_invoices
  add column if not exists amount_paid numeric(12,2) not null default 0,
  add column if not exists payment_last_applied_at timestamptz;

alter table if exists public.ap_bills
  add column if not exists amount_paid numeric(12,2) not null default 0,
  add column if not exists payment_last_applied_at timestamptz;

alter table if exists public.linked_hse_packets
  add column if not exists briefing_completed boolean not null default false,
  add column if not exists inspection_completed boolean not null default false,
  add column if not exists emergency_review_completed boolean not null default false,
  add column if not exists field_signoff_completed boolean not null default false,
  add column if not exists closeout_completed boolean not null default false,
  add column if not exists closeout_notes text,
  add column if not exists required_item_count integer not null default 0,
  add column if not exists completed_item_count integer not null default 0,
  add column if not exists issued_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists ready_for_closeout_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists closeout_by_profile_id uuid references public.profiles(id) on delete set null;

create or replace function public.ywi_round_money(v numeric)
returns numeric
language sql
immutable
as $$
  select round(coalesce(v, 0)::numeric, 2)
$$;

create or replace function public.ywi_safe_percent(part numeric, whole numeric)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(whole, 0) = 0 then 0
    else round((coalesce(part, 0) / nullif(whole, 0)) * 100, 2)
  end
$$;

create or replace function public.ywi_before_estimate_line_write()
returns trigger
language plpgsql
as $$
declare
  v_material record;
  v_equipment record;
begin
  if new.material_id is not null then
    select unit_id, default_unit_cost, default_bill_rate
      into v_material
      from public.materials_catalog
     where id = new.material_id;
    if new.unit_id is null then new.unit_id := v_material.unit_id; end if;
    if coalesce(new.unit_cost, 0) = 0 then new.unit_cost := coalesce(v_material.default_unit_cost, 0); end if;
    if coalesce(new.unit_price, 0) = 0 then new.unit_price := coalesce(v_material.default_bill_rate, 0); end if;
  end if;

  if new.equipment_master_id is not null then
    select cost_rate_hourly, bill_rate_hourly
      into v_equipment
      from public.equipment_master
     where id = new.equipment_master_id;
    if coalesce(new.unit_cost, 0) = 0 then new.unit_cost := coalesce(v_equipment.cost_rate_hourly, 0); end if;
    if coalesce(new.unit_price, 0) = 0 then new.unit_price := coalesce(v_equipment.bill_rate_hourly, 0); end if;
  end if;

  if coalesce(new.line_order, 0) <= 0 then
    select coalesce(max(line_order), 0) + 10 into new.line_order from public.estimate_lines where estimate_id = new.estimate_id and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
  end if;

  new.quantity := coalesce(new.quantity, 0);
  new.unit_cost := public.ywi_round_money(new.unit_cost);
  new.unit_price := public.ywi_round_money(new.unit_price);
  new.line_total := public.ywi_round_money(new.quantity * new.unit_price);
  new.updated_at := now();
  return new;
end
$$;

create or replace function public.ywi_before_work_order_line_write()
returns trigger
language plpgsql
as $$
declare
  v_material record;
  v_equipment record;
begin
  if new.material_id is not null then
    select unit_id, default_unit_cost, default_bill_rate
      into v_material
      from public.materials_catalog
     where id = new.material_id;
    if new.unit_id is null then new.unit_id := v_material.unit_id; end if;
    if coalesce(new.unit_cost, 0) = 0 then new.unit_cost := coalesce(v_material.default_unit_cost, 0); end if;
    if coalesce(new.unit_price, 0) = 0 then new.unit_price := coalesce(v_material.default_bill_rate, 0); end if;
  end if;

  if new.equipment_master_id is not null then
    select cost_rate_hourly, bill_rate_hourly
      into v_equipment
      from public.equipment_master
     where id = new.equipment_master_id;
    if coalesce(new.unit_cost, 0) = 0 then new.unit_cost := coalesce(v_equipment.cost_rate_hourly, 0); end if;
    if coalesce(new.unit_price, 0) = 0 then new.unit_price := coalesce(v_equipment.bill_rate_hourly, 0); end if;
  end if;

  if coalesce(new.line_order, 0) <= 0 then
    select coalesce(max(line_order), 0) + 10 into new.line_order from public.work_order_lines where work_order_id = new.work_order_id and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
  end if;

  new.quantity := coalesce(new.quantity, 0);
  new.unit_cost := public.ywi_round_money(new.unit_cost);
  new.unit_price := public.ywi_round_money(new.unit_price);
  new.line_total := public.ywi_round_money(new.quantity * new.unit_price);
  new.updated_at := now();
  return new;
end
$$;

create or replace function public.ywi_before_material_receipt_line_write()
returns trigger
language plpgsql
as $$
declare
  v_material record;
begin
  if new.material_id is not null then
    select unit_id, default_unit_cost
      into v_material
      from public.materials_catalog
     where id = new.material_id;
    if new.unit_id is null then new.unit_id := v_material.unit_id; end if;
    if coalesce(new.unit_cost, 0) = 0 then new.unit_cost := coalesce(v_material.default_unit_cost, 0); end if;
  end if;

  if coalesce(new.line_order, 0) <= 0 then
    select coalesce(max(line_order), 0) + 10 into new.line_order from public.material_receipt_lines where receipt_id = new.receipt_id and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
  end if;

  new.quantity := coalesce(new.quantity, 0);
  new.unit_cost := public.ywi_round_money(new.unit_cost);
  new.line_total := public.ywi_round_money(new.quantity * new.unit_cost);
  new.updated_at := now();
  return new;
end
$$;

create or replace function public.ywi_rollup_estimate(p_estimate_id uuid)
returns void
language plpgsql
as $$
declare
  v_subtotal numeric := 0;
  v_cost numeric := 0;
  v_tax numeric := 0;
  v_count integer := 0;
begin
  if p_estimate_id is null then return; end if;

  select coalesce(sum(line_total), 0),
         coalesce(sum(quantity * unit_cost), 0),
         count(*)::integer
    into v_subtotal, v_cost, v_count
    from public.estimate_lines
   where estimate_id = p_estimate_id;

  select coalesce(tax_total, 0) into v_tax from public.estimates where id = p_estimate_id;

  update public.estimates
     set subtotal = public.ywi_round_money(v_subtotal),
         total_cost = public.ywi_round_money(v_cost),
         total_amount = public.ywi_round_money(v_subtotal + v_tax),
         line_count = v_count,
         margin_amount = public.ywi_round_money(v_subtotal - v_cost),
         margin_percent = public.ywi_safe_percent(v_subtotal - v_cost, v_subtotal),
         rollup_updated_at = now(),
         updated_at = now()
   where id = p_estimate_id;
end
$$;

create or replace function public.ywi_rollup_work_order_line_receipts(p_work_order_line_id uuid)
returns void
language plpgsql
as $$
declare
  v_qty numeric := 0;
  v_cost numeric := 0;
begin
  if p_work_order_line_id is null then return; end if;

  select coalesce(sum(quantity), 0), coalesce(sum(line_total), 0)
    into v_qty, v_cost
    from public.material_receipt_lines
   where work_order_line_id = p_work_order_line_id;

  update public.work_order_lines
     set received_quantity = public.ywi_round_money(v_qty),
         received_cost_total = public.ywi_round_money(v_cost),
         updated_at = now()
   where id = p_work_order_line_id;
end
$$;

create or replace function public.ywi_rollup_work_order(p_work_order_id uuid)
returns void
language plpgsql
as $$
declare
  v_subtotal numeric := 0;
  v_cost numeric := 0;
  v_tax numeric := 0;
  v_count integer := 0;
  v_received numeric := 0;
begin
  if p_work_order_id is null then return; end if;

  select coalesce(sum(line_total), 0),
         coalesce(sum(quantity * unit_cost), 0),
         count(*)::integer
    into v_subtotal, v_cost, v_count
    from public.work_order_lines
   where work_order_id = p_work_order_id;

  select coalesce(sum(
           case
             when mrl.work_order_line_id is not null and wol.work_order_id = p_work_order_id then mrl.line_total
             when mrl.work_order_line_id is null and mr.work_order_id = p_work_order_id then mrl.line_total
             else 0
           end
         ), 0)
    into v_received
    from public.material_receipt_lines mrl
    left join public.work_order_lines wol on wol.id = mrl.work_order_line_id
    left join public.material_receipts mr on mr.id = mrl.receipt_id;

  select coalesce(tax_total, 0) into v_tax from public.work_orders where id = p_work_order_id;

  update public.work_orders
     set subtotal = public.ywi_round_money(v_subtotal),
         total_cost = public.ywi_round_money(v_cost),
         total_amount = public.ywi_round_money(v_subtotal + v_tax),
         line_count = v_count,
         margin_amount = public.ywi_round_money(v_subtotal - v_cost),
         margin_percent = public.ywi_safe_percent(v_subtotal - v_cost, v_subtotal),
         received_cost_total = public.ywi_round_money(v_received),
         rollup_updated_at = now(),
         updated_at = now()
   where id = p_work_order_id;
end
$$;

create or replace function public.ywi_rollup_material_receipt(p_receipt_id uuid)
returns void
language plpgsql
as $$
declare
  v_total numeric := 0;
  v_count integer := 0;
begin
  if p_receipt_id is null then return; end if;

  select coalesce(sum(line_total), 0), count(*)::integer
    into v_total, v_count
    from public.material_receipt_lines
   where receipt_id = p_receipt_id;

  update public.material_receipts
     set total_amount = public.ywi_round_money(v_total),
         line_count = v_count,
         rollup_updated_at = now(),
         updated_at = now()
   where id = p_receipt_id;
end
$$;

create or replace function public.ywi_apply_ar_payment_rollup(p_invoice_id uuid)
returns void
language plpgsql
as $$
declare
  v_paid numeric := 0;
  v_total numeric := 0;
  v_status text;
begin
  if p_invoice_id is null then return; end if;

  select coalesce(sum(amount), 0) into v_paid from public.ar_payments where invoice_id = p_invoice_id;
  select coalesce(total_amount, 0), invoice_status into v_total, v_status from public.ar_invoices where id = p_invoice_id;

  update public.ar_invoices
     set amount_paid = public.ywi_round_money(v_paid),
         balance_due = public.ywi_round_money(v_total - v_paid),
         invoice_status = case
           when coalesce(v_status, 'draft') = 'void' then 'void'
           when public.ywi_round_money(v_total - v_paid) <= 0 and v_total > 0 then 'paid'
           when v_paid > 0 then 'partial'
           when coalesce(v_status, 'draft') = 'draft' then 'draft'
           else 'issued'
         end,
         payment_last_applied_at = case when v_paid > 0 then now() else payment_last_applied_at end,
         updated_at = now()
   where id = p_invoice_id;
end
$$;

create or replace function public.ywi_apply_ap_payment_rollup(p_bill_id uuid)
returns void
language plpgsql
as $$
declare
  v_paid numeric := 0;
  v_total numeric := 0;
  v_status text;
begin
  if p_bill_id is null then return; end if;

  select coalesce(sum(amount), 0) into v_paid from public.ap_payments where bill_id = p_bill_id;
  select coalesce(total_amount, 0), bill_status into v_total, v_status from public.ap_bills where id = p_bill_id;

  update public.ap_bills
     set amount_paid = public.ywi_round_money(v_paid),
         balance_due = public.ywi_round_money(v_total - v_paid),
         bill_status = case
           when coalesce(v_status, 'draft') = 'void' then 'void'
           when public.ywi_round_money(v_total - v_paid) <= 0 and v_total > 0 then 'paid'
           when v_paid > 0 then 'partial'
           when coalesce(v_status, 'draft') = 'draft' then 'draft'
           else 'received'
         end,
         payment_last_applied_at = case when v_paid > 0 then now() else payment_last_applied_at end,
         updated_at = now()
   where id = p_bill_id;
end
$$;

create or replace function public.ywi_before_ar_invoice_write()
returns trigger
language plpgsql
as $$
begin
  new.subtotal := public.ywi_round_money(new.subtotal);
  new.tax_total := public.ywi_round_money(new.tax_total);
  new.total_amount := public.ywi_round_money(coalesce(new.subtotal, 0) + coalesce(new.tax_total, 0));
  if tg_op = 'INSERT' and coalesce(new.balance_due, 0) = 0 then
    new.balance_due := new.total_amount;
  end if;
  new.updated_at := now();
  return new;
end
$$;

create or replace function public.ywi_before_ap_bill_write()
returns trigger
language plpgsql
as $$
begin
  new.subtotal := public.ywi_round_money(new.subtotal);
  new.tax_total := public.ywi_round_money(new.tax_total);
  new.total_amount := public.ywi_round_money(coalesce(new.subtotal, 0) + coalesce(new.tax_total, 0));
  if tg_op = 'INSERT' and coalesce(new.balance_due, 0) = 0 then
    new.balance_due := new.total_amount;
  end if;
  new.updated_at := now();
  return new;
end
$$;

create or replace function public.ywi_before_hse_packet_write()
returns trigger
language plpgsql
as $$
declare
  v_required integer := 0;
  v_completed integer := 0;
  v_pre_required integer := 0;
  v_pre_completed integer := 0;
  v_status text := 'draft';
  v_percent numeric := 0;
begin
  v_pre_required := (case when new.briefing_required then 1 else 0 end)
                  + (case when new.inspection_required then 1 else 0 end)
                  + (case when new.emergency_review_required then 1 else 0 end)
                  + 1;
  v_pre_completed := (case when new.briefing_required and new.briefing_completed then 1 else 0 end)
                   + (case when new.inspection_required and new.inspection_completed then 1 else 0 end)
                   + (case when new.emergency_review_required and new.emergency_review_completed then 1 else 0 end)
                   + (case when new.field_signoff_completed then 1 else 0 end);
  v_required := v_pre_required + 1;
  v_completed := v_pre_completed + (case when new.closeout_completed then 1 else 0 end);

  if new.closeout_completed or new.closed_at is not null then
    v_status := 'closed';
    v_percent := 100;
  elsif v_pre_completed >= v_pre_required and v_pre_required > 0 then
    v_status := 'ready_for_closeout';
    v_percent := 90;
  elsif v_pre_completed > 0 or new.started_at is not null then
    v_status := 'in_progress';
    v_percent := round(((v_pre_completed::numeric / nullif(v_pre_required, 0)) * 90), 2);
  elsif new.issued_at is not null then
    v_status := 'issued';
    v_percent := 10;
  else
    v_status := 'draft';
    v_percent := 0;
  end if;

  new.packet_status := v_status;
  new.required_item_count := v_required;
  new.completed_item_count := v_completed;
  new.completion_percent := v_percent;
  if v_status = 'ready_for_closeout' and new.ready_for_closeout_at is null then new.ready_for_closeout_at := now(); end if;
  if v_status <> 'ready_for_closeout' then new.ready_for_closeout_at := null; end if;
  if v_status in ('in_progress', 'ready_for_closeout', 'closed') and new.started_at is null then new.started_at := now(); end if;
  if v_status in ('issued', 'in_progress', 'ready_for_closeout', 'closed') and new.issued_at is null then new.issued_at := now(); end if;
  if v_status = 'closed' and new.closed_at is null then new.closed_at := now(); end if;
  if v_status <> 'closed' then new.closed_at := null; end if;
  new.updated_at := now();
  return new;
end
$$;

create or replace function public.ywi_after_estimate_line_write()
returns trigger
language plpgsql
as $$
declare
  v_new_estimate_id uuid := case when tg_op <> 'DELETE' then new.estimate_id else null end;
  v_old_estimate_id uuid := case when tg_op <> 'INSERT' then old.estimate_id else null end;
begin
  perform public.ywi_rollup_estimate(coalesce(v_new_estimate_id, v_old_estimate_id));
  if tg_op = 'UPDATE' and v_new_estimate_id is distinct from v_old_estimate_id then
    perform public.ywi_rollup_estimate(v_old_estimate_id);
  end if;
  return coalesce(new, old);
end
$$;

create or replace function public.ywi_after_work_order_line_write()
returns trigger
language plpgsql
as $$
declare
  v_new_work_order_id uuid := case when tg_op <> 'DELETE' then new.work_order_id else null end;
  v_old_work_order_id uuid := case when tg_op <> 'INSERT' then old.work_order_id else null end;
begin
  perform public.ywi_rollup_work_order(coalesce(v_new_work_order_id, v_old_work_order_id));
  if tg_op = 'UPDATE' and v_new_work_order_id is distinct from v_old_work_order_id then
    perform public.ywi_rollup_work_order(v_old_work_order_id);
  end if;
  return coalesce(new, old);
end
$$;

create or replace function public.ywi_after_material_receipt_line_write()
returns trigger
language plpgsql
as $$
declare
  v_receipt_id uuid := case when tg_op = 'DELETE' then old.receipt_id else coalesce(new.receipt_id, old.receipt_id) end;
  v_new_work_order_line_id uuid := case when tg_op <> 'DELETE' then new.work_order_line_id else null end;
  v_old_work_order_line_id uuid := case when tg_op <> 'INSERT' then old.work_order_line_id else null end;
  v_receipt_work_order_id uuid;
  v_new_line_work_order_id uuid;
  v_old_line_work_order_id uuid;
begin
  perform public.ywi_rollup_material_receipt(v_receipt_id);

  if v_new_work_order_line_id is not null then
    perform public.ywi_rollup_work_order_line_receipts(v_new_work_order_line_id);
  end if;
  if v_old_work_order_line_id is distinct from v_new_work_order_line_id then
    perform public.ywi_rollup_work_order_line_receipts(v_old_work_order_line_id);
  end if;

  select work_order_id into v_receipt_work_order_id from public.material_receipts where id = v_receipt_id;
  select work_order_id into v_new_line_work_order_id from public.work_order_lines where id = v_new_work_order_line_id;
  select work_order_id into v_old_line_work_order_id from public.work_order_lines where id = v_old_work_order_line_id;

  perform public.ywi_rollup_work_order(v_receipt_work_order_id);
  if v_new_line_work_order_id is distinct from v_receipt_work_order_id then
    perform public.ywi_rollup_work_order(v_new_line_work_order_id);
  end if;
  if v_old_line_work_order_id is distinct from v_receipt_work_order_id and v_old_line_work_order_id is distinct from v_new_line_work_order_id then
    perform public.ywi_rollup_work_order(v_old_line_work_order_id);
  end if;

  return coalesce(new, old);
end
$$;

create or replace function public.ywi_after_material_receipt_write()
returns trigger
language plpgsql
as $$
declare
  v_receipt_id uuid := case when tg_op = 'DELETE' then old.id else coalesce(new.id, old.id) end;
  v_new_work_order_id uuid := case when tg_op <> 'DELETE' then new.work_order_id else null end;
  v_old_work_order_id uuid := case when tg_op <> 'INSERT' then old.work_order_id else null end;
begin
  perform public.ywi_rollup_material_receipt(v_receipt_id);
  perform public.ywi_rollup_work_order(coalesce(v_new_work_order_id, v_old_work_order_id));
  if tg_op = 'UPDATE' and v_new_work_order_id is distinct from v_old_work_order_id then
    perform public.ywi_rollup_work_order(v_old_work_order_id);
  end if;
  return coalesce(new, old);
end
$$;

create or replace function public.ywi_after_ar_payment_write()
returns trigger
language plpgsql
as $$
declare
  v_new_invoice_id uuid := case when tg_op <> 'DELETE' then new.invoice_id else null end;
  v_old_invoice_id uuid := case when tg_op <> 'INSERT' then old.invoice_id else null end;
begin
  perform public.ywi_apply_ar_payment_rollup(v_new_invoice_id);
  if v_old_invoice_id is distinct from v_new_invoice_id then
    perform public.ywi_apply_ar_payment_rollup(v_old_invoice_id);
  end if;
  return coalesce(new, old);
end
$$;

create or replace function public.ywi_after_ap_payment_write()
returns trigger
language plpgsql
as $$
declare
  v_new_bill_id uuid := case when tg_op <> 'DELETE' then new.bill_id else null end;
  v_old_bill_id uuid := case when tg_op <> 'INSERT' then old.bill_id else null end;
begin
  perform public.ywi_apply_ap_payment_rollup(v_new_bill_id);
  if v_old_bill_id is distinct from v_new_bill_id then
    perform public.ywi_apply_ap_payment_rollup(v_old_bill_id);
  end if;
  return coalesce(new, old);
end
$$;

drop trigger if exists trg_ywi_before_estimate_line_write on public.estimate_lines;
create trigger trg_ywi_before_estimate_line_write
before insert or update on public.estimate_lines
for each row execute function public.ywi_before_estimate_line_write();

drop trigger if exists trg_ywi_after_estimate_line_write on public.estimate_lines;
create trigger trg_ywi_after_estimate_line_write
after insert or update or delete on public.estimate_lines
for each row execute function public.ywi_after_estimate_line_write();

drop trigger if exists trg_ywi_before_work_order_line_write on public.work_order_lines;
create trigger trg_ywi_before_work_order_line_write
before insert or update on public.work_order_lines
for each row execute function public.ywi_before_work_order_line_write();

drop trigger if exists trg_ywi_after_work_order_line_write on public.work_order_lines;
create trigger trg_ywi_after_work_order_line_write
after insert or update or delete on public.work_order_lines
for each row execute function public.ywi_after_work_order_line_write();

drop trigger if exists trg_ywi_before_material_receipt_line_write on public.material_receipt_lines;
create trigger trg_ywi_before_material_receipt_line_write
before insert or update on public.material_receipt_lines
for each row execute function public.ywi_before_material_receipt_line_write();

drop trigger if exists trg_ywi_after_material_receipt_line_write on public.material_receipt_lines;
create trigger trg_ywi_after_material_receipt_line_write
after insert or update or delete on public.material_receipt_lines
for each row execute function public.ywi_after_material_receipt_line_write();

drop trigger if exists trg_ywi_after_material_receipt_write on public.material_receipts;
create trigger trg_ywi_after_material_receipt_write
after insert or update or delete on public.material_receipts
for each row execute function public.ywi_after_material_receipt_write();

drop trigger if exists trg_ywi_before_ar_invoice_write on public.ar_invoices;
create trigger trg_ywi_before_ar_invoice_write
before insert or update on public.ar_invoices
for each row execute function public.ywi_before_ar_invoice_write();

drop trigger if exists trg_ywi_before_ap_bill_write on public.ap_bills;
create trigger trg_ywi_before_ap_bill_write
before insert or update on public.ap_bills
for each row execute function public.ywi_before_ap_bill_write();

drop trigger if exists trg_ywi_after_ar_payment_write on public.ar_payments;
create trigger trg_ywi_after_ar_payment_write
after insert or update or delete on public.ar_payments
for each row execute function public.ywi_after_ar_payment_write();

drop trigger if exists trg_ywi_after_ap_payment_write on public.ap_payments;
create trigger trg_ywi_after_ap_payment_write
after insert or update or delete on public.ap_payments
for each row execute function public.ywi_after_ap_payment_write();

drop trigger if exists trg_ywi_before_hse_packet_write on public.linked_hse_packets;
create trigger trg_ywi_before_hse_packet_write
before insert or update on public.linked_hse_packets
for each row execute function public.ywi_before_hse_packet_write();

update public.estimate_lines set updated_at = now();
update public.work_order_lines set updated_at = now();
update public.material_receipt_lines set updated_at = now();
update public.ar_invoices set updated_at = now();
update public.ap_bills set updated_at = now();
update public.linked_hse_packets set updated_at = now();

with q as (
  select distinct estimate_id from public.estimate_lines where estimate_id is not null
)
select public.ywi_rollup_estimate(estimate_id) from q;

with q as (
  select distinct work_order_id from public.work_order_lines where work_order_id is not null
  union
  select distinct work_order_id from public.material_receipts where work_order_id is not null
)
select public.ywi_rollup_work_order(work_order_id) from q;

with q as (
  select distinct receipt_id from public.material_receipt_lines where receipt_id is not null
)
select public.ywi_rollup_material_receipt(receipt_id) from q;


with q as (
  select distinct invoice_id from public.ar_payments where invoice_id is not null
)
select public.ywi_apply_ar_payment_rollup(invoice_id) from q;

with q as (
  select distinct bill_id from public.ap_payments where bill_id is not null
)
select public.ywi_apply_ap_payment_rollup(bill_id) from q;
