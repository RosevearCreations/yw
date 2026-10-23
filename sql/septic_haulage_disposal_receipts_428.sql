-- Item 428: operator-reported septic haul and independent disposal artifact.
-- Physical/regulated disposal is NEVER certified or performed by this evidence.

create table if not exists public.ywi_septic_disposal_receipts_428 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 work_order_id uuid not null references public.work_orders(id) on delete restrict,
 dispatch_id uuid not null references public.dispatch_schedule_items(id) on delete restrict,
 operator_profile_id uuid not null references public.profiles(id) on delete restrict,
 receipt_key text not null check(receipt_key ~ '^[a-z0-9_]{3,50}$'),
 collected_on date not null,
 waste_stream text not null check(waste_stream in ('septic','holding_tank','vacuum_waste')),
 measured_volume_l numeric(12,2) not null check(measured_volume_l>0 and measured_volume_l<=100000),
 measurement_method text not null check(measurement_method in ('meter','tank_gauge','weighbridge_conversion')),
 measurement_source text not null check(length(btrim(measurement_source)) between 8 and 300),
 disposal_facility text not null check(length(btrim(disposal_facility)) between 4 and 180),
 disposal_receipt_number text not null check(length(btrim(disposal_receipt_number)) between 4 and 100),
 disposed_on date not null,
 original_proof_media_id uuid not null unique references public.work_order_execution_proof_media(id) on delete restrict,
 fleet_readiness_id uuid references public.fleet_readiness_checks(id) on delete restrict,
 safety_plan_id uuid references public.job_hazard_site_safety_plans(id) on delete restrict,
 factual_notes text not null check(length(btrim(factual_notes)) between 20 and 1000),
 original_source_fingerprint text not null check(length(original_source_fingerprint)=64),
 recorded_by uuid not null references auth.users(id) on delete restrict,
 recorded_at timestamptz not null default now(),
 unique(work_order_id,receipt_key),
 unique(company_id,disposal_facility,disposal_receipt_number),
 check(disposed_on>=collected_on)
);
create index if not exists ywi_428_disposal_company_order_idx
 on public.ywi_septic_disposal_receipts_428(company_id,work_order_id,collected_on desc);
create unique index if not exists ywi_428_disposal_facility_ticket_ci
 on public.ywi_septic_disposal_receipts_428(company_id,lower(btrim(disposal_facility)),lower(btrim(disposal_receipt_number)));
alter table public.ywi_septic_disposal_receipts_428 enable row level security;
revoke all on public.ywi_septic_disposal_receipts_428 from public,anon,authenticated;
grant select on public.ywi_septic_disposal_receipts_428 to authenticated;
drop policy if exists ywi_428_owner_read on public.ywi_septic_disposal_receipts_428;
create policy ywi_428_owner_read on public.ywi_septic_disposal_receipts_428 for select to authenticated
 using(exists(select 1 from public.ywi_companies c where c.id=company_id and c.owner_user_id=(select auth.uid())));

create or replace function public.ywi_428_refuse_rewrite()
returns trigger language plpgsql security definer set search_path='' as $$
begin raise exception '428 septic disposal evidence is immutable; original-source manual review required'; end $$;
revoke all on function public.ywi_428_refuse_rewrite() from public,anon,authenticated;
drop trigger if exists ywi_428_receipt_immutable on public.ywi_septic_disposal_receipts_428;
create trigger ywi_428_receipt_immutable before update or delete on public.ywi_septic_disposal_receipts_428
 for each row execute function public.ywi_428_refuse_rewrite();

-- Auth, company offering, Jobs permission and original customer/site remain
-- independently enforced by Item 423. The media record must be an uploaded
-- artifact linked to the SAME original work order and dispatch, not a typed URL.
create or replace function public.ywi_428_assert_sources(
 p_company_id uuid,p_work_order_id uuid,p_dispatch_id uuid,p_operator_id uuid,
 p_proof_media_id uuid,p_fleet_id uuid,p_safety_id uuid,p_write boolean default false
) returns text language plpgsql security definer set search_path='' as $$
declare v_wo public.work_orders;v_d public.dispatch_schedule_items;
 v_payload jsonb;v_valid_media boolean;
begin
 perform public.ywi_423_assert_order(p_company_id,p_work_order_id,p_write);
 select * into v_wo from public.work_orders where id=p_work_order_id and company_id=p_company_id;
 if not found or v_wo.service_module_key<>'septic' then
  raise exception '428 original septic company Jobs work order required'; end if;
 select * into v_d from public.dispatch_schedule_items
 where id=p_dispatch_id and work_order_id=p_work_order_id;
 if not found or (v_d.client_site_id is not null and v_d.client_site_id<>v_wo.client_site_id)
   or (v_d.job_id is not null and v_d.job_id is distinct from v_wo.legacy_job_id) then
  raise exception '428 original Dispatch must match septic property and Jobs'; end if;
 if not exists(select 1 from public.profiles p where p.id=p_operator_id and p.is_active is true)
  or not (coalesce(p_operator_id=v_d.assigned_supervisor_profile_id,false)
   or coalesce(p_operator_id=v_d.lead_profile_id,false)
   or coalesce(jsonb_typeof(v_d.assigned_crew_profile_ids)='array'
    and v_d.assigned_crew_profile_ids @> jsonb_build_array(p_operator_id::text),false)) then
  raise exception '428 active operator must be named on original Dispatch crew/supervisor'; end if;
 select exists(select 1 from public.work_order_execution_proof_media pm
  join public.work_order_execution_proofs ep on ep.id=pm.execution_proof_id
  join public.visual_asset_approval_items a on a.id=pm.visual_asset_id
  where pm.id=p_proof_media_id and ep.work_order_id=p_work_order_id
   and (ep.dispatch_schedule_item_id is null or ep.dispatch_schedule_item_id=p_dispatch_id)
   and nullif(btrim(a.storage_path),'') is not null) into v_valid_media;
 if not v_valid_media then
  raise exception '428 stored original Jobs proof-media receipt artifact required; no URL-only receipt'; end if;
 if p_fleet_id is not null and not exists(select 1 from public.fleet_readiness_checks f
  where f.id=p_fleet_id and f.equipment_item_id=v_d.assigned_truck_equipment_item_id
   and (f.job_id is null or f.job_id=v_wo.legacy_job_id)) then
  raise exception '428 original truck Fleet readiness does not match septic dispatch'; end if;
 if p_safety_id is not null and not exists(select 1 from public.job_hazard_site_safety_plans sp
  where sp.id=p_safety_id and sp.work_order_id=p_work_order_id
   and sp.client_site_id=v_wo.client_site_id) then
  raise exception '428 original site Safety plan does not match septic property'; end if;
 select jsonb_build_object(
  'order',jsonb_build_object('id',v_wo.id,'company',v_wo.company_id,'module',v_wo.service_module_key,
   'client',v_wo.client_id,'site',v_wo.client_site_id,'status',v_wo.status,
   'approval',v_wo.approval_status),
  'dispatch',to_jsonb(v_d),
  'operator',(select jsonb_build_object('id',p.id,'active',p.is_active,'name',p.full_name,
   'employment',p.employment_status) from public.profiles p where p.id=p_operator_id),
  'proof',(select to_jsonb(ep) from public.work_order_execution_proofs ep
   join public.work_order_execution_proof_media pm on pm.execution_proof_id=ep.id
   where pm.id=p_proof_media_id),
  'proof_media',(select to_jsonb(pm) from public.work_order_execution_proof_media pm where pm.id=p_proof_media_id),
  'asset',(select jsonb_build_object('id',a.id,'path',a.storage_path,'updated',a.updated_at)
   from public.visual_asset_approval_items a join public.work_order_execution_proof_media pm
    on pm.visual_asset_id=a.id where pm.id=p_proof_media_id),
  'fleet',(select to_jsonb(f) from public.fleet_readiness_checks f where f.id=p_fleet_id),
  'safety',(select to_jsonb(sp) from public.job_hazard_site_safety_plans sp where sp.id=p_safety_id),
  'truck',(select jsonb_build_object('id',e.id,'locked',e.is_locked_out,'defect',e.defect_status,
   'status',fp.operational_status) from public.equipment_items e
   left join public.equipment_fleet_profiles fp on fp.equipment_item_id=e.id
   where e.id=v_d.assigned_truck_equipment_item_id)) into v_payload;
 return encode(extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
end $$;
revoke all on function public.ywi_428_assert_sources(uuid,uuid,uuid,uuid,uuid,uuid,uuid,boolean)
 from public,anon,authenticated;

-- Historical origin deletions/changes must display HOLD, never erase the readback.
create or replace function public.ywi_428_safe_fingerprint(
 p_company_id uuid,p_work_order_id uuid,p_dispatch_id uuid,p_operator_id uuid,
 p_proof_media_id uuid,p_fleet_id uuid,p_safety_id uuid
) returns text language plpgsql security definer set search_path='' as $$
begin
 return public.ywi_428_assert_sources(p_company_id,p_work_order_id,p_dispatch_id,
  p_operator_id,p_proof_media_id,p_fleet_id,p_safety_id,false);
exception when others then return null;
end $$;
revoke all on function public.ywi_428_safe_fingerprint(uuid,uuid,uuid,uuid,uuid,uuid,uuid)
 from public,anon,authenticated;

create or replace function public.ywi_rpc_record_septic_disposal_428(
 p_company_id uuid,p_work_order_id uuid,p_dispatch_id uuid,p_operator_id uuid,
 p_key text,p_collected_on date,p_waste_stream text,p_volume_l numeric,
 p_measurement_method text,p_measurement_source text,p_facility text,p_receipt_number text,
 p_disposed_on date,p_proof_media_id uuid,p_notes text,
 p_fleet_id uuid default null,p_safety_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_old public.ywi_septic_disposal_receipts_428;v_id uuid;v_hash text;
 v_key text:=lower(btrim(coalesce(p_key,'')));
 v_measure text:=btrim(coalesce(p_measurement_source,''));
 v_facility text:=btrim(coalesce(p_facility,''));
 v_number text:=btrim(coalesce(p_receipt_number,''));v_notes text:=btrim(coalesce(p_notes,''));
begin
 v_hash:=public.ywi_428_assert_sources(p_company_id,p_work_order_id,p_dispatch_id,
  p_operator_id,p_proof_media_id,p_fleet_id,p_safety_id,true);
 if v_key !~ '^[a-z0-9_]{3,50}$' or
  p_collected_on is null or p_disposed_on is null or
  p_collected_on<date '2000-01-01' or p_disposed_on>current_date or
  p_disposed_on<p_collected_on or
  p_waste_stream not in ('septic','holding_tank','vacuum_waste') or
  p_volume_l is null or p_volume_l<=0 or p_volume_l>100000 or
  p_measurement_method not in ('meter','tank_gauge','weighbridge_conversion') or
  length(v_measure) not between 8 and 300 or length(v_facility) not between 4 and 180 or
  length(v_number) not between 4 and 100 or length(v_notes) not between 20 and 1000 then
  raise exception '428 measured volume, assigned operator, dated original disposal artifact and factual evidence required'; end if;
 select * into v_old from public.ywi_septic_disposal_receipts_428
  where original_proof_media_id=p_proof_media_id or (work_order_id=p_work_order_id and receipt_key=v_key)
   or (company_id=p_company_id and lower(btrim(disposal_facility))=lower(v_facility)
    and lower(btrim(disposal_receipt_number))=lower(v_number));
 if found then
  if v_old.company_id=p_company_id and v_old.work_order_id=p_work_order_id and
   v_old.dispatch_id=p_dispatch_id and v_old.operator_profile_id=p_operator_id and
   v_old.receipt_key=v_key and v_old.collected_on=p_collected_on and
   v_old.waste_stream=p_waste_stream and v_old.measured_volume_l=p_volume_l and
   v_old.measurement_method=p_measurement_method and v_old.measurement_source=v_measure and
   v_old.disposal_facility=v_facility and v_old.disposal_receipt_number=v_number and
   v_old.disposed_on=p_disposed_on and v_old.original_proof_media_id=p_proof_media_id and
   v_old.fleet_readiness_id is not distinct from p_fleet_id and
   v_old.safety_plan_id is not distinct from p_safety_id and
   v_old.factual_notes=v_notes and v_old.original_source_fingerprint=v_hash then return v_old.id; end if;
  raise exception '428 original document/receipt already attributed or source changed; no duplicate disposal proof'; end if;
 insert into public.ywi_septic_disposal_receipts_428(
  company_id,work_order_id,dispatch_id,operator_profile_id,receipt_key,collected_on,
  waste_stream,measured_volume_l,measurement_method,measurement_source,
  disposal_facility,disposal_receipt_number,disposed_on,original_proof_media_id,
  fleet_readiness_id,safety_plan_id,factual_notes,original_source_fingerprint,recorded_by)
 values(p_company_id,p_work_order_id,p_dispatch_id,p_operator_id,v_key,p_collected_on,
  p_waste_stream,p_volume_l,p_measurement_method,v_measure,v_facility,v_number,p_disposed_on,
  p_proof_media_id,p_fleet_id,p_safety_id,v_notes,v_hash,auth.uid()) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.ywi_rpc_record_septic_disposal_428(uuid,uuid,uuid,uuid,text,date,text,numeric,text,text,text,text,date,uuid,text,uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_record_septic_disposal_428(uuid,uuid,uuid,uuid,text,date,text,numeric,text,text,text,text,date,uuid,text,uuid,uuid)
 to authenticated;

create or replace function public.ywi_rpc_septic_disposal_dashboard_428(
 p_company_id uuid,p_work_order_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_orders jsonb:='[]'::jsonb;v_dispatch jsonb:='[]'::jsonb;
 v_artifacts jsonb:='[]'::jsonb;v_fleet jsonb:='[]'::jsonb;v_safety jsonb:='[]'::jsonb;
 v_receipts jsonb:='[]'::jsonb;v_count int;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select count(*) into v_count from public.work_orders
  where company_id=p_company_id and service_module_key='septic';
 if v_count>60 then raise exception '428 septic order list exceeds source cap'; end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_orders from (
  select id,work_order_number as number,status from public.work_orders
  where company_id=p_company_id and service_module_key='septic'
  order by created_at desc,id limit 60) x;
 if p_work_order_id is null then return jsonb_build_object(
  'company_id',p_company_id,'work_order_id',null,'orders',v_orders,'dispatch',v_dispatch,
  'artifacts',v_artifacts,'fleet',v_fleet,'safety',v_safety,'receipts',v_receipts,
  'source_limit',80,'complete',true,'no_auto_disposal',true,'no_compliance_certification',true,
  'no_billing',true,'state','choose_order'); end if;
 perform public.ywi_423_assert_order(p_company_id,p_work_order_id,false);
 if not exists(select 1 from public.work_orders
  where id=p_work_order_id and service_module_key='septic') then
  raise exception '428 septic order required'; end if;
 select (select count(*) from public.dispatch_schedule_items where work_order_id=p_work_order_id)
  +(select count(*) from public.work_order_execution_proof_media pm
   join public.work_order_execution_proofs ep on ep.id=pm.execution_proof_id
   where ep.work_order_id=p_work_order_id)
  +(select count(*) from public.job_hazard_site_safety_plans where work_order_id=p_work_order_id)
  +(select count(*) from public.fleet_readiness_checks f join public.dispatch_schedule_items d
   on d.assigned_truck_equipment_item_id=f.equipment_item_id
   where d.work_order_id=p_work_order_id)
  +(select count(*) from public.ywi_septic_disposal_receipts_428 where work_order_id=p_work_order_id)
 into v_count;
 if v_count>80 then raise exception '428 septic work-source cap exceeded; partial read withheld'; end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_dispatch from (
  select d.id,d.schedule_status,d.dispatched_at,d.assigned_truck_equipment_item_id,
   d.assigned_supervisor_profile_id,d.lead_profile_id,d.assigned_crew_profile_ids
  from public.dispatch_schedule_items d join public.work_orders w on w.id=d.work_order_id
  where d.work_order_id=p_work_order_id and
   (d.client_site_id is null or d.client_site_id=w.client_site_id)
  order by d.created_at desc,d.id limit 80) x;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_artifacts from (
  select pm.id,ep.dispatch_schedule_item_id as dispatch_id,
   a.asset_key,pm.execution_proof_id
  from public.work_order_execution_proof_media pm
  join public.work_order_execution_proofs ep on ep.id=pm.execution_proof_id
  join public.visual_asset_approval_items a on a.id=pm.visual_asset_id
  where ep.work_order_id=p_work_order_id and nullif(btrim(a.storage_path),'') is not null
  order by pm.created_at desc,pm.id limit 80) x;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_fleet from (
  select distinct f.id,f.equipment_item_id,f.readiness_status,f.checked_at
  from public.fleet_readiness_checks f join public.dispatch_schedule_items d
   on d.assigned_truck_equipment_item_id=f.equipment_item_id
  join public.work_orders w on w.id=d.work_order_id
  where d.work_order_id=p_work_order_id and (f.job_id is null or f.job_id=w.legacy_job_id)
  order by f.checked_at desc,f.id limit 80) x;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_safety from (
  select sp.id,sp.plan_number,sp.supervisor_review_status,sp.stop_work_required,sp.plan_status
  from public.job_hazard_site_safety_plans sp join public.work_orders w on w.id=sp.work_order_id
  where sp.work_order_id=p_work_order_id and sp.client_site_id=w.client_site_id
  order by sp.field_date desc,sp.id limit 80) x;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_receipts from (
  select r.id,r.receipt_key,r.dispatch_id,r.operator_profile_id,r.original_proof_media_id,
   r.collected_on,r.disposed_on,r.waste_stream,r.measured_volume_l,r.measurement_method,
   r.measurement_source,r.disposal_facility,r.disposal_receipt_number,r.factual_notes,
   r.recorded_at,case when r.original_source_fingerprint is distinct from
    public.ywi_428_safe_fingerprint(r.company_id,r.work_order_id,r.dispatch_id,
     r.operator_profile_id,r.original_proof_media_id,r.fleet_readiness_id,r.safety_plan_id)
    then 'source_changed_hold' else 'operator_reported_unverified' end as evidence_state,
   case when r.fleet_readiness_id is null or f.readiness_status<>'ready' or
     r.safety_plan_id is null or sp.stop_work_required is distinct from false or
     sp.supervisor_review_status<>'approved' or
     sp.plan_status not in ('ready_for_signoff','closed') or
     d.schedule_status not in ('dispatched','in_progress','completed') or
     r.original_source_fingerprint is distinct from
      public.ywi_428_safe_fingerprint(r.company_id,r.work_order_id,r.dispatch_id,
       r.operator_profile_id,r.original_proof_media_id,r.fleet_readiness_id,r.safety_plan_id)
    then 'hold' else 'independent_disposal_safety_review_required' end as review_gate
  from public.ywi_septic_disposal_receipts_428 r
  join public.dispatch_schedule_items d on d.id=r.dispatch_id
  left join public.fleet_readiness_checks f on f.id=r.fleet_readiness_id
  left join public.job_hazard_site_safety_plans sp on sp.id=r.safety_plan_id
  where r.work_order_id=p_work_order_id order by r.recorded_at desc,r.id limit 80) x;
 return jsonb_build_object('company_id',p_company_id,'work_order_id',p_work_order_id,
  'orders',v_orders,'dispatch',v_dispatch,'artifacts',v_artifacts,'fleet',v_fleet,
  'safety',v_safety,'receipts',v_receipts,'source_limit',80,'complete',true,
  'no_auto_disposal',true,'no_compliance_certification',true,'no_billing',true,'state','review_only');
end $$;
revoke all on function public.ywi_rpc_septic_disposal_dashboard_428(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_septic_disposal_dashboard_428(uuid,uuid) to authenticated;
