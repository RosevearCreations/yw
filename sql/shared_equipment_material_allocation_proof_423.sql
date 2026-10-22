-- YW Item 423: append-only allocation evidence for existing canonical sources.
-- The receipt is NOT an inventory movement, time booking, cost posting or
-- replacement for material_issue_lines / equipment_signouts.

create table if not exists public.ywi_work_order_allocation_proofs_423 (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.ywi_companies(id) on delete restrict,
  work_order_id uuid not null references public.work_orders(id) on delete restrict,
  material_issue_line_id uuid unique references public.material_issue_lines(id) on delete restrict,
  equipment_signout_id bigint unique references public.equipment_signouts(id) on delete restrict,
  source_fingerprint text not null check (length(source_fingerprint)=64),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  constraint ywi_423_exact_one_source check (
    (material_issue_line_id is not null and equipment_signout_id is null) or
    (material_issue_line_id is null and equipment_signout_id is not null)
  )
);
create index if not exists ywi_423_proof_company_work_order_idx
 on public.ywi_work_order_allocation_proofs_423(company_id,work_order_id,recorded_at desc);

alter table public.ywi_work_order_allocation_proofs_423 enable row level security;
revoke all on public.ywi_work_order_allocation_proofs_423 from public,anon,authenticated;
grant select on public.ywi_work_order_allocation_proofs_423 to authenticated;
drop policy if exists ywi_423_owner_proof_read on public.ywi_work_order_allocation_proofs_423;
create policy ywi_423_owner_proof_read on public.ywi_work_order_allocation_proofs_423
 for select to authenticated using (exists (
  select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())
 ));

create or replace function public.ywi_423_reject_receipt_mutation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 raise exception '423 allocation evidence is append-only; source corrections require manual review';
end $$;
revoke all on function public.ywi_423_reject_receipt_mutation() from public,anon,authenticated;
drop trigger if exists ywi_423_proof_no_rewrite on public.ywi_work_order_allocation_proofs_423;
create trigger ywi_423_proof_no_rewrite before update or delete
 on public.ywi_work_order_allocation_proofs_423
 for each row execute function public.ywi_423_reject_receipt_mutation();

-- Privileged writes must pass the separate Jobs and canonical company checks.
-- This source signature intentionally includes the originating work order and
-- critical evidence, so a later source edit turns the proof into HOLD.
create or replace function public.ywi_423_source_fingerprint(
 p_kind text,p_source_id text
) returns text language plpgsql security definer set search_path='' as $$
declare v_payload jsonb;
begin
 if p_kind='material' then
  select jsonb_build_object('id',ml.id,'issue',ml.issue_id,'order',mi.work_order_id,
   'site',mi.client_site_id,'status',mi.issue_status,'material',ml.material_id,
   'line',ml.work_order_line_id,'usage',ml.usage_type,'qty',ml.quantity,
   'unit_cost',ml.unit_cost,'amount',ml.line_total)
  into v_payload from public.material_issue_lines ml
  join public.material_issues mi on mi.id=ml.issue_id
  where ml.id=p_source_id::uuid;
 elsif p_kind='equipment' then
  select jsonb_build_object('id',es.id,'order',es.work_order_id,
   'legacy_job',es.job_id,'asset',es.equipment_item_id,
   'out',es.checked_out_at,'back',es.returned_at,
   'verification',es.verification_status,
   'safety',es.checkout_safety_test_status,'lockout',ei.is_locked_out,
   'defect',ei.defect_status)
  into v_payload from public.equipment_signouts es
  join public.equipment_items ei on ei.id=es.equipment_item_id
  where es.id=p_source_id::bigint;
 else
  raise exception '423 unknown source kind';
 end if;
 if v_payload is null then raise exception '423 canonical source missing'; end if;
 return encode(extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
end $$;
revoke all on function public.ywi_423_source_fingerprint(text,text) from public,anon,authenticated;

create or replace function public.ywi_423_assert_order(
 p_company_id uuid,p_work_order_id uuid,p_new_proof boolean default false
) returns void language plpgsql security definer set search_path='' as $$
declare v_order record;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select company_id,service_module_key,client_id,client_site_id into v_order
 from public.work_orders where id=p_work_order_id;
 if not found or v_order.company_id is distinct from p_company_id then
  raise exception '423 company work order missing or foreign';
 end if;
 perform public.ywi_422_assert_link(p_company_id,v_order.client_id,v_order.client_site_id);
 if p_new_proof then
  perform public.ywi_422_assert_jobs_create();
  if not exists (select 1 from public.ywi_company_service_modules
   where company_id=p_company_id and module_key=v_order.service_module_key and enabled is true) then
   raise exception '423 disabled specialist service cannot receive new proof';
  end if;
 end if;
end $$;
revoke all on function public.ywi_423_assert_order(uuid,uuid,boolean) from public,anon,authenticated;

create or replace function public.ywi_rpc_record_allocation_proof_423(
 p_company_id uuid,p_work_order_id uuid,p_kind text,p_source_id text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_existing record;v_source record;v_fingerprint text;
begin
 perform public.ywi_423_assert_order(p_company_id,p_work_order_id,true);
 if p_kind not in ('material','equipment') or p_kind is null or
    p_source_id is null or length(p_source_id)>36 then
  raise exception '423 invalid canonical source selector';
 end if;
 if p_kind='material' then
  if p_source_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
   raise exception '423 material source ID invalid';
  end if;
  select ml.id,ml.quantity,ml.line_total,ml.usage_type,ml.material_id,
   ml.work_order_line_id,mi.issue_status,mi.work_order_id,mi.client_site_id
  into v_source from public.material_issue_lines ml
  join public.material_issues mi on mi.id=ml.issue_id
  where ml.id=p_source_id::uuid for share of ml,mi;
  if not found or v_source.work_order_id is distinct from p_work_order_id or
    v_source.issue_status not in ('issued','partial','closed') or
    v_source.usage_type is distinct from 'job_use' or
    v_source.material_id is null or v_source.quantity<=0 or
    v_source.line_total is null or v_source.line_total<0 or
    v_source.client_site_id is distinct from
      (select client_site_id from public.work_orders where id=p_work_order_id) then
   raise exception '423 unissued, wrong-work-order or incomplete material source';
  end if;
  if v_source.work_order_line_id is not null and not exists (
   select 1 from public.work_order_lines wol where wol.id=v_source.work_order_line_id
    and wol.work_order_id=p_work_order_id and wol.material_id=v_source.material_id
  ) then raise exception '423 material plan line mismatch'; end if;
 else
  if p_source_id !~ '^[0-9]{1,18}$' then raise exception '423 equipment source ID invalid'; end if;
  select es.id,es.work_order_id,es.job_id,es.equipment_item_id,
   es.checked_out_at,es.returned_at,es.verification_status,
   es.checkout_safety_test_status,ei.is_locked_out,ei.defect_status,
   wo.legacy_job_id
  into v_source from public.equipment_signouts es
  join public.equipment_items ei on ei.id=es.equipment_item_id
  join public.work_orders wo on wo.id=p_work_order_id
  where es.id=p_source_id::bigint for share of es,ei;
  if not found or v_source.work_order_id is distinct from p_work_order_id or
   v_source.verification_status not in ('arrived_verified','return_verified') or
   v_source.checkout_safety_test_status not in ('passed','not_required') or
   v_source.is_locked_out is distinct from false or
   v_source.checked_out_at>now() or
   (v_source.returned_at is not null and v_source.returned_at<v_source.checked_out_at) or
   (v_source.job_id is not null and v_source.legacy_job_id is distinct from v_source.job_id) then
   raise exception '423 equipment checkout unverified, locked or wrong work order';
  end if;
  if exists (select 1 from public.equipment_signouts other
   where other.equipment_item_id=v_source.equipment_item_id and other.id<>v_source.id
    and other.checked_out_at<coalesce(v_source.returned_at,'infinity'::timestamptz)
    and v_source.checked_out_at<coalesce(other.returned_at,'infinity'::timestamptz)) then
   raise exception '423 overlapping asset checkouts require manual reconciliation';
  end if;
 end if;
 v_fingerprint:=public.ywi_423_source_fingerprint(p_kind,p_source_id);
 if p_kind='material' then
  select id,company_id,work_order_id,source_fingerprint into v_existing
   from public.ywi_work_order_allocation_proofs_423
   where material_issue_line_id=p_source_id::uuid;
 else
  select id,company_id,work_order_id,source_fingerprint into v_existing
   from public.ywi_work_order_allocation_proofs_423
   where equipment_signout_id=p_source_id::bigint;
 end if;
 if found then
  if v_existing.company_id=p_company_id and v_existing.work_order_id=p_work_order_id
    and v_existing.source_fingerprint=v_fingerprint then return v_existing.id; end if;
  raise exception '423 source already attributed or stale: manual review required';
 end if;
 insert into public.ywi_work_order_allocation_proofs_423
  (company_id,work_order_id,material_issue_line_id,equipment_signout_id,source_fingerprint,recorded_by)
 values (p_company_id,p_work_order_id,
  case when p_kind='material' then p_source_id::uuid end,
  case when p_kind='equipment' then p_source_id::bigint end,
  v_fingerprint,auth.uid()) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.ywi_rpc_record_allocation_proof_423(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ywi_rpc_record_allocation_proof_423(uuid,uuid,text,text) to authenticated;

-- A read-only, owner-scoped dashboard. Original sources remain authoritative;
-- proof rows are NEVER joined into GL posting or material stock adjustment.
create or replace function public.ywi_rpc_allocation_dashboard_423(
 p_company_id uuid,p_work_order_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_orders jsonb;v_sources jsonb:='[]'::jsonb;v_proofs jsonb:='[]'::jsonb;
 v_count integer;v_hold boolean:=false;v_total numeric(12,2):=0;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select count(*) into v_count from public.work_orders where company_id=p_company_id;
 if v_count>60 then raise exception '423 company work order listing capped; refine in a later release'; end if;
 select coalesce(jsonb_agg(x), '[]'::jsonb) into v_orders from (
  select id,work_order_number as number,service_module_key as service,status,
   client_id,client_site_id from public.work_orders
  where company_id=p_company_id order by created_at desc,id limit 60
 ) x;
 if p_work_order_id is null then return jsonb_build_object('company_id',p_company_id,
  'work_order_id',null,'orders',v_orders,'sources',v_sources,'proofs',v_proofs,
  'source_limit',80,'complete',true,'no_stock_or_cost_posting',true,'state','choose_order'); end if;
 perform public.ywi_423_assert_order(p_company_id,p_work_order_id,false);
 -- The canonical candidate sources are material lines and signouts, each with its own ID domain.
 select (select count(*) from public.material_issue_lines ml
         join public.material_issues mi on mi.id=ml.issue_id where mi.work_order_id=p_work_order_id)
      +(select count(*) from public.equipment_signouts where work_order_id=p_work_order_id)
 into v_count;
 if v_count>80 then raise exception '423 source list capped: manual review required'; end if;
 select coalesce(jsonb_agg(src order by source_kind,source_id),'[]'::jsonb) into v_sources from (
  select 'material'::text source_kind,ml.id::text source_id,
   mc.item_name source_name,mi.issue_number source_number,ml.quantity quantity,
   ml.line_total source_amount,
   (mi.issue_status in ('issued','partial','closed') and ml.usage_type='job_use' and
    ml.material_id is not null and ml.quantity>0 and ml.line_total>=0 and
    mi.client_site_id=(select client_site_id from public.work_orders where id=p_work_order_id) and
    (ml.work_order_line_id is null or exists
     (select 1 from public.work_order_lines w where w.id=ml.work_order_line_id and
      w.work_order_id=p_work_order_id and w.material_id=ml.material_id))) eligible,
   (p.id is not null) already_proven
  from public.material_issue_lines ml join public.material_issues mi on mi.id=ml.issue_id
  left join public.materials_catalog mc on mc.id=ml.material_id
  left join public.ywi_work_order_allocation_proofs_423 p on p.material_issue_line_id=ml.id
  where mi.work_order_id=p_work_order_id
  union all
  select 'equipment',es.id::text,ei.equipment_name,ei.equipment_code,1::numeric,
   null::numeric,
   (es.verification_status in ('arrived_verified','return_verified') and
    es.checkout_safety_test_status in ('passed','not_required') and
    ei.is_locked_out is false and es.checked_out_at<=now() and
    (es.returned_at is null or es.returned_at>=es.checked_out_at) and
    (es.job_id is null or es.job_id=(select legacy_job_id from public.work_orders where id=p_work_order_id)) and
    not exists (select 1 from public.equipment_signouts o where o.id<>es.id and
      o.equipment_item_id=es.equipment_item_id and
      o.checked_out_at<coalesce(es.returned_at,'infinity'::timestamptz) and
      es.checked_out_at<coalesce(o.returned_at,'infinity'::timestamptz))),
   (p.id is not null)
  from public.equipment_signouts es join public.equipment_items ei on ei.id=es.equipment_item_id
  left join public.ywi_work_order_allocation_proofs_423 p on p.equipment_signout_id=es.id
  where es.work_order_id=p_work_order_id
 ) src;
 select count(*) into v_count from public.ywi_work_order_allocation_proofs_423
 where company_id=p_company_id and work_order_id=p_work_order_id;
 if v_count>80 then raise exception '423 evidence listing capped'; end if;
 select coalesce(jsonb_agg(x order by x.recorded_at,x.id),'[]'::jsonb),
        coalesce(bool_or(x.state='hold'),false),
        coalesce(sum(case when x.state='verified' and x.source_kind='material'
               then x.source_amount else 0 end),0)
 into v_proofs,v_hold,v_total from (
  select p.id,p.recorded_at,
    case when p.material_issue_line_id is not null then 'material' else 'equipment' end source_kind,
    coalesce(p.material_issue_line_id::text,p.equipment_signout_id::text) source_id,
    case when p.material_issue_line_id is not null then ml.line_total end source_amount,
    case when p.source_fingerprint=public.ywi_423_source_fingerprint(
      case when p.material_issue_line_id is not null then 'material' else 'equipment' end,
      coalesce(p.material_issue_line_id::text,p.equipment_signout_id::text))
     then 'verified' else 'hold' end state
  from public.ywi_work_order_allocation_proofs_423 p
  left join public.material_issue_lines ml on ml.id=p.material_issue_line_id
  where p.company_id=p_company_id and p.work_order_id=p_work_order_id
 ) x;
 return jsonb_build_object('company_id',p_company_id,'work_order_id',p_work_order_id,
  'orders',v_orders,'sources',v_sources,'proofs',v_proofs,
  'source_limit',80,'complete',true,'no_stock_or_cost_posting',true,
  'state',case when v_hold then 'hold' when v_count=0 then 'no_record' else 'recorded' end,
  'material_issued_source_amount',v_total);
end $$;
revoke all on function public.ywi_rpc_allocation_dashboard_423(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_allocation_dashboard_423(uuid,uuid) to authenticated;
