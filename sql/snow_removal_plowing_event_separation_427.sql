-- Build 427: shared, ORIGINAL storm history; separate snow-removal and plowing
-- service receipts. No weather override, dispatch, work completion or billing.

create table if not exists public.ywi_snow_service_receipts_427 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 work_order_id uuid not null references public.work_orders(id) on delete restrict,
 service_module_key text not null check (service_module_key in ('snow_removal','snow_plowing')),
 storm_event_id uuid not null references public.seasonal_storm_events(id) on delete restrict,
 dispatch_id uuid not null unique references public.dispatch_schedule_items(id) on delete restrict,
 receipt_key text not null check (receipt_key ~ '^[a-z0-9_]{3,50}$'),
 surface_kind text not null check (surface_kind in
  ('sidewalk','walkway','entrance','steps','driveway','parking_area','roadway')),
 observed_on date not null,
 reported_passes integer not null check (reported_passes between 1 and 20),
 source_reference text not null check (length(btrim(source_reference)) between 8 and 400),
 factual_notes text not null check (length(btrim(factual_notes)) between 20 and 1000),
 workability_observation_id uuid references public.workability_observations(id) on delete restrict,
 safety_plan_id uuid references public.job_hazard_site_safety_plans(id) on delete restrict,
 fleet_readiness_id uuid references public.fleet_readiness_checks(id) on delete restrict,
 original_source_fingerprint text not null check (length(original_source_fingerprint)=64),
 recorded_by uuid not null references auth.users(id) on delete restrict,
 recorded_at timestamptz not null default now(),
 unique(work_order_id,receipt_key),
 check ((service_module_key='snow_removal' and surface_kind in ('sidewalk','walkway','entrance','steps'))
     or (service_module_key='snow_plowing' and surface_kind in ('driveway','parking_area','roadway'))),
 check (service_module_key='snow_plowing' or fleet_readiness_id is null)
);
create index if not exists ywi_427_receipts_company_storm_idx
 on public.ywi_snow_service_receipts_427(company_id,storm_event_id,service_module_key,observed_on desc);
alter table public.ywi_snow_service_receipts_427 enable row level security;
revoke all on public.ywi_snow_service_receipts_427 from public,anon,authenticated;
grant select on public.ywi_snow_service_receipts_427 to authenticated;
drop policy if exists ywi_427_owner_read on public.ywi_snow_service_receipts_427;
create policy ywi_427_owner_read on public.ywi_snow_service_receipts_427 for select to authenticated
 using (exists(select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));

create or replace function public.ywi_427_forbid_rewrite()
returns trigger language plpgsql security definer set search_path='' as $$
begin raise exception '427 storm/service receipt is immutable; reconcile original Dispatch/Safety'; end $$;
revoke all on function public.ywi_427_forbid_rewrite() from public,anon,authenticated;
drop trigger if exists ywi_427_receipt_immutable on public.ywi_snow_service_receipts_427;
create trigger ywi_427_receipt_immutable before update or delete on public.ywi_snow_service_receipts_427
 for each row execute function public.ywi_427_forbid_rewrite();

-- All source references are checked against the SAME original, linked company
-- work order; storm route activation is never treated as dispatch authority.
create or replace function public.ywi_427_assert_sources(
 p_company_id uuid,p_work_order_id uuid,p_storm_id uuid,p_dispatch_id uuid,
 p_workability_id uuid,p_safety_id uuid,p_fleet_id uuid,p_write boolean default false
) returns text language plpgsql security definer set search_path='' as $$
declare v_wo public.work_orders;v_d public.dispatch_schedule_items;
 v_storm public.seasonal_storm_events;v_payload jsonb;
begin
 perform public.ywi_423_assert_order(p_company_id,p_work_order_id,p_write);
 select * into v_wo from public.work_orders where id=p_work_order_id and company_id=p_company_id;
 if not found or v_wo.service_module_key not in ('snow_removal','snow_plowing') then
  raise exception '427 original snow removal or plowing company work order required'; end if;
 select * into v_d from public.dispatch_schedule_items where id=p_dispatch_id and work_order_id=p_work_order_id;
 if not found or v_d.route_id is null or
  (v_d.client_site_id is not null and v_d.client_site_id<>v_wo.client_site_id) or
  (v_d.job_id is not null and v_d.job_id is distinct from v_wo.legacy_job_id) then
  raise exception '427 original dispatch, route and company property must match'; end if;
 select * into v_storm from public.seasonal_storm_events where id=p_storm_id;
 if not found or not exists(select 1 from public.seasonal_storm_route_activations a
  where a.storm_event_id=p_storm_id and a.route_id=v_d.route_id) then
  raise exception '427 original storm must contain the dispatched route'; end if;
 if p_workability_id is not null and not exists (
  select 1 from public.workability_observations w where w.id=p_workability_id
   and w.service_context='snow_clearing_removal' and w.season_context='winter'
   and (w.work_order_id is null or w.work_order_id=p_work_order_id)
   and (w.client_site_id is null or w.client_site_id=v_wo.client_site_id)
   and (w.dispatch_schedule_item_id is null or w.dispatch_schedule_item_id=p_dispatch_id)
   and (w.route_id is null or w.route_id=v_d.route_id)) then
  raise exception '427 original winter Workability observation mismatches site/dispatch'; end if;
 if p_safety_id is not null and not exists (
  select 1 from public.job_hazard_site_safety_plans sp where sp.id=p_safety_id
   and sp.work_order_id=p_work_order_id and sp.client_site_id=v_wo.client_site_id) then
  raise exception '427 original Safety plan mismatches work order/property'; end if;
 if p_fleet_id is not null and (v_wo.service_module_key<>'snow_plowing' or not exists (
  select 1 from public.fleet_readiness_checks f where f.id=p_fleet_id
   and f.equipment_item_id=v_d.assigned_truck_equipment_item_id
   and (f.job_id is null or f.job_id=v_wo.legacy_job_id))) then
  raise exception '427 original truck Fleet readiness mismatches dispatch'; end if;
 select jsonb_build_object(
  'order',jsonb_build_object('id',v_wo.id,'company',v_wo.company_id,'module',v_wo.service_module_key,
   'client',v_wo.client_id,'site',v_wo.client_site_id,'status',v_wo.status),
  'dispatch',to_jsonb(v_d),'storm',to_jsonb(v_storm),
  'activation',(select to_jsonb(a) from public.seasonal_storm_route_activations a
   where a.storm_event_id=p_storm_id and a.route_id=v_d.route_id),
  'workability',(select to_jsonb(w) from public.workability_observations w where w.id=p_workability_id),
  'decision',(select to_jsonb(x) from public.workability_decisions x
   where x.observation_id=p_workability_id order by x.decision_at desc,x.id desc limit 1),
  'safety',(select to_jsonb(s) from public.job_hazard_site_safety_plans s where s.id=p_safety_id),
  'fleet',(select to_jsonb(f) from public.fleet_readiness_checks f where f.id=p_fleet_id),
  'truck',(select jsonb_build_object('asset',e.id,'locked',e.is_locked_out,'defect',e.defect_status,
   'fleet_status',fp.operational_status,'damage',fp.damage_status)
   from public.equipment_items e left join public.equipment_fleet_profiles fp on fp.equipment_item_id=e.id
   where e.id=v_d.assigned_truck_equipment_item_id)) into v_payload;
 return encode(extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex');
end $$;
revoke all on function public.ywi_427_assert_sources(uuid,uuid,uuid,uuid,uuid,uuid,uuid,boolean)
 from public,anon,authenticated;

create or replace function public.ywi_rpc_record_snow_service_427(
 p_company_id uuid,p_work_order_id uuid,p_storm_id uuid,p_dispatch_id uuid,p_key text,
 p_surface text,p_observed_on date,p_passes integer,p_source_reference text,p_notes text,
 p_workability_id uuid default null,p_safety_id uuid default null,p_fleet_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_old public.ywi_snow_service_receipts_427;v_wo public.work_orders;
 v_hash text;v_id uuid;v_key text:=lower(btrim(coalesce(p_key,'')));
 v_source text:=btrim(coalesce(p_source_reference,''));v_notes text:=btrim(coalesce(p_notes,''));
begin
 v_hash:=public.ywi_427_assert_sources(p_company_id,p_work_order_id,p_storm_id,p_dispatch_id,
  p_workability_id,p_safety_id,p_fleet_id,true);
 select * into v_wo from public.work_orders where id=p_work_order_id;
 if v_key !~ '^[a-z0-9_]{3,50}$' or p_observed_on is null or
  p_observed_on<date '2000-01-01' or p_observed_on>current_date or
  p_passes not between 1 and 20 or length(v_source) not between 8 and 400 or
  length(v_notes) not between 20 and 1000 or not (
   (v_wo.service_module_key='snow_removal' and p_surface in ('sidewalk','walkway','entrance','steps')) or
   (v_wo.service_module_key='snow_plowing' and p_surface in ('driveway','parking_area','roadway'))) or
  (v_wo.service_module_key='snow_removal' and p_fleet_id is not null) then
  raise exception '427 dated source, correct separate surface and observed passes required'; end if;
 select * into v_old from public.ywi_snow_service_receipts_427 where dispatch_id=p_dispatch_id;
 if found then
  if v_old.company_id=p_company_id and v_old.work_order_id=p_work_order_id and
   v_old.storm_event_id=p_storm_id and v_old.receipt_key=v_key and
   v_old.surface_kind=p_surface and v_old.observed_on=p_observed_on and
   v_old.reported_passes=p_passes and v_old.source_reference=v_source and
   v_old.factual_notes=v_notes and
   v_old.workability_observation_id is not distinct from p_workability_id and
   v_old.safety_plan_id is not distinct from p_safety_id and
   v_old.fleet_readiness_id is not distinct from p_fleet_id and
   v_old.original_source_fingerprint=v_hash then return v_old.id; end if;
  raise exception '427 dispatch source already evidenced; no double attribution/billing'; end if;
 insert into public.ywi_snow_service_receipts_427(company_id,work_order_id,service_module_key,
  storm_event_id,dispatch_id,receipt_key,surface_kind,observed_on,reported_passes,
  source_reference,factual_notes,workability_observation_id,safety_plan_id,
  fleet_readiness_id,original_source_fingerprint,recorded_by)
 values(p_company_id,p_work_order_id,v_wo.service_module_key,p_storm_id,p_dispatch_id,v_key,
  p_surface,p_observed_on,p_passes,v_source,v_notes,p_workability_id,p_safety_id,p_fleet_id,
  v_hash,auth.uid()) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.ywi_rpc_record_snow_service_427(uuid,uuid,uuid,uuid,text,text,date,integer,text,text,uuid,uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_record_snow_service_427(uuid,uuid,uuid,uuid,text,text,date,integer,text,text,uuid,uuid,uuid)
 to authenticated;

create or replace function public.ywi_rpc_snow_service_dashboard_427(
 p_company_id uuid,p_work_order_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_orders jsonb:='[]'::jsonb;v_sources jsonb:='[]'::jsonb;v_receipts jsonb:='[]'::jsonb;
 v_workability jsonb:='[]'::jsonb;v_safety jsonb:='[]'::jsonb;v_fleet jsonb:='[]'::jsonb;
 v_count int;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select count(*) into v_count from public.work_orders
  where company_id=p_company_id and service_module_key in ('snow_removal','snow_plowing');
 if v_count>60 then raise exception '427 original snow orders over audited source cap'; end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_orders from (
  select id,work_order_number as number,service_module_key as service,status
  from public.work_orders where company_id=p_company_id
   and service_module_key in ('snow_removal','snow_plowing')
  order by created_at desc,id limit 60) x;
 if p_work_order_id is null then return jsonb_build_object('company_id',p_company_id,
  'work_order_id',null,'orders',v_orders,'sources',v_sources,'receipts',v_receipts,
  'workability',v_workability,'safety',v_safety,'fleet',v_fleet,
  'complete',true,'source_limit',80,'no_automatic_dispatch',true,'no_double_billing',true,
  'state','choose_order'); end if;
 perform public.ywi_423_assert_order(p_company_id,p_work_order_id,false);
 if not exists(select 1 from public.work_orders where id=p_work_order_id
   and service_module_key in ('snow_removal','snow_plowing')) then
  raise exception '427 snow service order required'; end if;
 select (select count(*) from public.dispatch_schedule_items d
  join public.seasonal_storm_route_activations a on a.route_id=d.route_id
  where d.work_order_id=p_work_order_id)
  +(select count(*) from public.job_hazard_site_safety_plans where work_order_id=p_work_order_id)
  +(select count(*) from public.workability_observations where work_order_id=p_work_order_id)
  +(select count(*) from public.fleet_readiness_checks f
   join public.dispatch_schedule_items d on d.assigned_truck_equipment_item_id=f.equipment_item_id
   where d.work_order_id=p_work_order_id and (f.job_id is null or f.job_id=d.job_id))
 into v_count;
 if v_count>80 then raise exception '427 storm dispatch source exceeds audited cap'; end if;
 select count(*) into v_count from public.ywi_snow_service_receipts_427 where work_order_id=p_work_order_id;
 if v_count>80 then raise exception '427 receipts exceed audited cap'; end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_sources from (
  select d.id as dispatch_id,d.schedule_status,d.dispatched_at,d.workability_state,
   d.assigned_truck_equipment_item_id, a.id as activation_id,a.activation_status,
   a.storm_event_id,s.storm_code,s.storm_name,s.storm_status,
   (select count(*) from public.ywi_snow_service_receipts_427 r where r.dispatch_id=d.id) as receipt_count
  from public.dispatch_schedule_items d join public.seasonal_storm_route_activations a
   on a.route_id=d.route_id join public.seasonal_storm_events s on s.id=a.storm_event_id
  where d.work_order_id=p_work_order_id order by d.created_at desc,a.created_at desc,d.id limit 80) x;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_workability from (
  select id,observation_code,service_date from public.workability_observations
  where work_order_id=p_work_order_id and service_context='snow_clearing_removal'
   and season_context='winter' order by observed_at desc,id limit 80) x;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_safety from (
  select s.id,s.plan_number,s.supervisor_review_status,s.stop_work_required
  from public.job_hazard_site_safety_plans s join public.work_orders wo on wo.id=p_work_order_id
  where s.work_order_id=p_work_order_id and s.client_site_id=wo.client_site_id
  order by s.field_date desc,s.id limit 80) x;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_fleet from (
  select distinct f.id,f.equipment_item_id,f.readiness_status,f.checked_at
  from public.fleet_readiness_checks f join public.dispatch_schedule_items d
   on d.assigned_truck_equipment_item_id=f.equipment_item_id
  join public.work_orders wo on wo.id=p_work_order_id
  where d.work_order_id=p_work_order_id and (f.job_id is null or f.job_id=wo.legacy_job_id)
  order by f.checked_at desc,f.id limit 80) x;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_receipts from (
  select r.id,r.storm_event_id,r.dispatch_id,r.service_module_key,r.receipt_key,
   r.surface_kind,r.observed_on,r.reported_passes,r.source_reference,r.factual_notes,r.recorded_at,
   case when r.original_source_fingerprint is distinct from public.ywi_427_assert_sources(
    r.company_id,r.work_order_id,r.storm_event_id,r.dispatch_id,
    r.workability_observation_id,r.safety_plan_id,r.fleet_readiness_id,false)
    then 'source_changed_hold' else 'reported_unverified' end as evidence_state,
   case when r.original_source_fingerprint is distinct from public.ywi_427_assert_sources(
    r.company_id,r.work_order_id,r.storm_event_id,r.dispatch_id,
    r.workability_observation_id,r.safety_plan_id,r.fleet_readiness_id,false)
    or d.schedule_status not in ('dispatched','completed') or d.dispatched_at is null
    or d.workability_state in ('not_assessed','delayed','blocked')
    or a.activation_status not in ('active','complete')
    or s.storm_status not in ('active','complete')
    or sp.id is null or sp.stop_work_required or
      sp.supervisor_review_status<>'approved' or sp.plan_status not in ('ready_for_signoff','closed')
    or w.id is null or w.service_context<>'snow_clearing_removal' or
      exists(select 1 from public.workability_decisions wd where wd.observation_id=w.id
       and wd.workability_state in ('delayed','blocked'))
    or (r.service_module_key='snow_plowing' and
      (f.id is null or f.readiness_status<>'ready' or
       f.registration_verified is not true or f.insurance_verified is not true or
       f.vehicle_inspection_verified is not true or
       e.is_locked_out is distinct from false or fp.operational_status not in ('ready','assigned')))
    then 'hold' else 'independent_dispatch_safety_review_required' end as source_gate
  from public.ywi_snow_service_receipts_427 r
  join public.dispatch_schedule_items d on d.id=r.dispatch_id
  join public.seasonal_storm_events s on s.id=r.storm_event_id
  join public.seasonal_storm_route_activations a on a.storm_event_id=s.id and a.route_id=d.route_id
  left join public.job_hazard_site_safety_plans sp on sp.id=r.safety_plan_id
  left join public.workability_observations w on w.id=r.workability_observation_id
  left join public.fleet_readiness_checks f on f.id=r.fleet_readiness_id
  left join public.equipment_items e on e.id=d.assigned_truck_equipment_item_id
  left join public.equipment_fleet_profiles fp on fp.equipment_item_id=e.id
  where r.company_id=p_company_id and r.work_order_id=p_work_order_id
  order by r.observed_on desc,r.id limit 80) x;
 return jsonb_build_object('company_id',p_company_id,'work_order_id',p_work_order_id,
  'orders',v_orders,'sources',v_sources,'receipts',v_receipts,
  'workability',v_workability,'safety',v_safety,'fleet',v_fleet,'source_limit',80,
  'complete',true,'no_automatic_dispatch',true,'no_double_billing',true,'state','review_only');
end $$;
revoke all on function public.ywi_rpc_snow_service_dashboard_427(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_snow_service_dashboard_427(uuid,uuid) to authenticated;
