-- Item 421: guarded rollback planning only. Never run automatically.
-- Do not drop the columns/triggers until scoped rows and receipt history are reviewed.
do $$
begin
 if exists (select 1 from public.estimates where company_id is not null)
 or exists (select 1 from public.work_orders where company_id is not null)
 or exists (select 1 from public.ywi_new_work_gate_receipts_421) then
  raise exception 'Refused: scoped work or authorization receipts must be preserved; use forward repair';
 end if;
end $$;
drop trigger if exists ywi_421_audit_estimate on public.estimates;
drop trigger if exists ywi_421_audit_work_order on public.work_orders;
drop trigger if exists ywi_421_guard_estimate on public.estimates;
drop trigger if exists ywi_421_guard_work_order on public.work_orders;
drop function if exists public.ywi_rpc_create_scoped_estimate_421(uuid,text,text);
drop function if exists public.ywi_rpc_create_scoped_work_order_421(uuid,text,text,uuid);
drop function if exists public.ywi_421_before_new_work();
drop function if exists public.ywi_421_receipt_new_work();
drop function if exists public.ywi_421_assert_company_new_work(uuid,text,uuid,uuid);
alter table public.estimates drop constraint if exists ywi_421_estimate_registry_fkey;
alter table public.work_orders drop constraint if exists ywi_421_work_order_registry_fkey;
alter table public.estimates drop constraint if exists ywi_421_estimate_company_service_pair;
alter table public.work_orders drop constraint if exists ywi_421_work_order_company_service_pair;
alter table public.estimates drop column if exists company_id;
alter table public.estimates drop column if exists service_module_key;
alter table public.work_orders drop column if exists company_id;
alter table public.work_orders drop column if exists service_module_key;
drop table if exists public.ywi_new_work_gate_receipts_421;
