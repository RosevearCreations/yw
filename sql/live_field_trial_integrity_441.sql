-- YW 441: bounded read-only, company-owner integrity and first-trial source audit.
-- Never returns client/employee names, addresses, wages, notes, financial amounts,
-- or raw field payloads. No trial acceptance, dispatch, invoice or Finance writes.
begin;

create or replace function public.ywi_rpc_live_field_trial_integrity_441(
 p_company_id uuid,p_work_order_id uuid default null
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
 v_order public.work_orders;
 v_orders jsonb:='[]'::jsonb;v_modules jsonb:='[]'::jsonb;
 v_count integer;v_modules_count integer;v_enabled boolean;
 v_linked boolean:=false;v_proofs integer:=0;v_dispatch integer:=0;
 v_qc integer:=0;v_field integer:=0;v_last timestamptz;
 v_max timestamptz;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select count(*) into v_modules_count from public.ywi_company_service_modules
  where company_id=p_company_id;
 if v_modules_count<>6 then raise exception '441 company service entitlement registry incomplete'; end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_modules from (
  select m.module_key,m.enabled from public.ywi_company_service_modules m
  where m.company_id=p_company_id order by m.module_key
 ) x;
 select count(*) into v_count from public.work_orders
  where company_id=p_company_id and service_module_key in
    ('landscape','construction','water_parks','snow_removal','snow_plowing','septic');
 if v_count>60 then raise exception '441 original company Jobs population exceeds reviewed 60-order cap'; end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_orders from (
  select id,work_order_number as number,service_module_key as service,status
  from public.work_orders where company_id=p_company_id and service_module_key in
    ('landscape','construction','water_parks','snow_removal','snow_plowing','septic')
  order by created_at desc,id limit 60
 ) x;
 if p_work_order_id is null then return jsonb_build_object(
  'company_id',p_company_id,'work_order_id',null,'state','choose_order',
  'complete',true,'source_limit',60,'captured_at',clock_timestamp(),
  'modules',v_modules,'orders',v_orders,'scoped_order_count',v_count,
  'privacy_minimized',true,'tenant_guard','owner_and_jobs_view_422',
  'trial_accepted',false,'release_green_verified',false,'mutation_authorized',false);
 end if;
 perform public.ywi_423_assert_order(p_company_id,p_work_order_id,false);
 select * into v_order from public.work_orders where id=p_work_order_id
  and company_id=p_company_id and service_module_key in
    ('landscape','construction','water_parks','snow_removal','snow_plowing','septic');
 if not found then raise exception '441 original company Jobs order not found'; end if;
 select enabled into v_enabled from public.ywi_company_service_modules
  where company_id=p_company_id and module_key=v_order.service_module_key;
 if v_enabled is null then raise exception '441 original service entitlement absent'; end if;
 -- The legacy CRM ID alone is not a company ownership proof.
 select exists (
  select 1 from public.ywi_company_client_links_422 c
  join public.ywi_company_site_links_422 s
   on s.company_id=c.company_id and s.client_id=c.client_id
  join public.client_sites cs on cs.id=s.client_site_id and cs.client_id=c.client_id and cs.is_active
  join public.clients cl on cl.id=c.client_id and cl.is_active
  where c.company_id=p_company_id and c.client_id=v_order.client_id
   and s.client_site_id=v_order.client_site_id
 ) into v_linked;
 select count(*),max(occurred_at) into v_proofs,v_max
  from public.work_order_execution_proofs where work_order_id=p_work_order_id;
 v_last:=greatest(v_last,v_max);
 select count(*),max(created_at) into v_dispatch,v_max
  from public.dispatch_schedule_items where work_order_id=p_work_order_id;
 v_last:=greatest(v_last,v_max);
 select count(*),max(created_at) into v_qc,v_max
  from public.work_order_quality_control_runs where work_order_id=p_work_order_id;
 v_last:=greatest(v_last,v_max);
 case v_order.service_module_key
  when 'landscape' then
   select count(*),max(attested_at) into v_field,v_max from public.ywi_landscape_field_receipts_424
    where company_id=p_company_id and work_order_id=p_work_order_id;
  when 'construction' then
   select count(*),max(recorded_at) into v_field,v_max from public.ywi_construction_permit_notes_425
    where company_id=p_company_id and work_order_id=p_work_order_id;
  when 'water_parks' then
   select count(*),max(recorded_at) into v_field,v_max from public.ywi_aquatic_inspections_426
    where company_id=p_company_id and work_order_id=p_work_order_id;
  when 'snow_removal','snow_plowing' then
   select count(*),max(recorded_at) into v_field,v_max from public.ywi_snow_service_receipts_427
    where company_id=p_company_id and work_order_id=p_work_order_id
      and service_module_key=v_order.service_module_key;
  when 'septic' then
   select count(*),max(recorded_at) into v_field,v_max from public.ywi_septic_disposal_receipts_428
    where company_id=p_company_id and work_order_id=p_work_order_id;
 end case;
 v_last:=greatest(v_last,v_max);
 if v_proofs>80 or v_dispatch>80 or v_qc>80 or v_field>80 then
  raise exception '441 original field/dispatch/QC evidence exceeds audited cap'; end if;
 return jsonb_build_object(
  'company_id',p_company_id,'work_order_id',p_work_order_id,
  'state','review_only','complete',true,'source_limit',60,'evidence_limit',80,
  'captured_at',clock_timestamp(),'source_last_at',v_last,
  'modules',v_modules,'orders',v_orders,'scoped_order_count',v_count,
  'order',jsonb_build_object('id',v_order.id,'number',v_order.work_order_number,
   'service',v_order.service_module_key,'status',v_order.status,
   'customer_present',v_order.client_id is not null,
   'property_present',v_order.client_site_id is not null,
   'verified_company_customer_property',v_linked,'service_enabled_now',v_enabled),
  'coverage',jsonb_build_object('original_proofs',v_proofs,
   'dispatch_records',v_dispatch,'qc_runs',v_qc,'specialist_receipts',v_field),
  'privacy_minimized',true,'tenant_guard','owner_and_jobs_view_422',
  'trial_accepted',false,'release_green_verified',false,'mutation_authorized',false);
end $$;
revoke all on function public.ywi_rpc_live_field_trial_integrity_441(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_live_field_trial_integrity_441(uuid,uuid)
 to authenticated;
comment on function public.ywi_rpc_live_field_trial_integrity_441(uuid,uuid) is
 '441 strict owner + original Jobs company, no customer PII, capped original source coverage; field and Production acceptance remain outside this review.';
commit;
