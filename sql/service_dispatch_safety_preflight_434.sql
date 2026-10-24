-- Item 434: read-only, owner-linked original Jobs/Dispatch/Workability/Fleet/HSE preflight.
-- Requires the 420/421/422 owner and Jobs-read boundaries. No operational writes.
begin;

create or replace function public.ywi_rpc_job_dispatch_preflight_434(
  p_company_id uuid, p_client_id uuid, p_site_id uuid, p_work_order_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_job public.work_orders%rowtype;
  v_dispatch public.dispatch_schedule_items%rowtype;
  v_observation public.workability_observations%rowtype;
  v_decision public.workability_decisions%rowtype;
  v_packet public.linked_hse_packets%rowtype;
  v_release public.work_order_release_reviews%rowtype;
  v_crew record;
  v_conflict record;
  v_equipment jsonb;
  v_dispatches jsonb := '[]'::jsonb;
  v_dispatch_count integer;
  v_enabled boolean;
  v_crew_members integer;
  v_packet_count integer;
begin
  -- This also checks signed-in owner identity, Jobs read permission and canonical
  -- owner-company/customer/site linkage. It rejects foreign and unlinked sites.
  perform public.ywi_422_assert_link(p_company_id,p_client_id,p_site_id);
  select * into v_job from public.work_orders w
    where w.id=p_work_order_id and w.company_id=p_company_id
      and w.client_id=p_client_id and w.client_site_id=p_site_id;
  if not found then raise exception '434 original owner-linked Jobs record unavailable'; end if;
  select m.enabled into v_enabled from public.ywi_company_service_modules m
    where m.company_id=p_company_id and m.module_key=v_job.service_module_key;
  select * into v_release from public.work_order_release_reviews r
    where r.work_order_id=v_job.id limit 1;

  select count(*) into v_dispatch_count from public.dispatch_schedule_items d
    where d.work_order_id=v_job.id;
  if v_dispatch_count>20 then raise exception '434 dispatch source exceeds 20-record limit'; end if;
  for v_dispatch in select d.* from public.dispatch_schedule_items d
    where d.work_order_id=v_job.id
    order by d.scheduled_start desc nulls last,d.id desc limit 21
  loop
    if jsonb_typeof(v_dispatch.assigned_equipment_item_ids)<>'array'
       or jsonb_array_length(v_dispatch.assigned_equipment_item_ids)>20 then
      raise exception '434 malformed or capped assigned equipment IDs';
    end if;
    select c.id,c.crew_status into v_crew from public.crews c
      where c.id=v_dispatch.crew_id;
    select count(*) into v_crew_members from public.crew_members cm
      where cm.crew_id=v_dispatch.crew_id;
    select s.conflict_count,s.dispatch_readiness into v_conflict
      from public.v_crew_dispatch_schedule s where s.id=v_dispatch.id;
    select * into v_observation from public.workability_observations o
      where o.dispatch_schedule_item_id=v_dispatch.id and o.work_order_id=v_job.id
      order by o.observed_at desc,o.id desc limit 1;
    v_decision := null;
    if v_observation.id is not null then
      select * into v_decision from public.workability_decisions d
        where d.observation_id=v_observation.id
        order by d.decision_at desc,d.id desc limit 1;
    end if;
    select count(*) into v_packet_count from public.linked_hse_packets p
      where p.work_order_id=v_job.id;
    select * into v_packet from public.linked_hse_packets p
      where p.work_order_id=v_job.id
      order by (p.id=v_observation.linked_hse_packet_id) desc,p.created_at desc,p.id desc limit 1;

    -- One original equipment item per ID, with latest original Fleet readiness.
    -- Malformed IDs remain visible as an unmatched count, never cast blindly.
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'name',e.equipment_name,'status',e.status,
      'locked_out',coalesce((to_jsonb(e)->>'is_locked_out')::boolean,false),
      'fleet_status',f.operational_status,'fleet_readiness',f.latest_readiness_status,
      'fleet_checked_at',f.latest_readiness_checked_at,
      'fleet_downtime',f.open_downtime_count,
      'registration_expiry',f.registration_expiry,'insurance_expiry',f.insurance_expiry,
      'inspection_due',f.annual_vehicle_inspection_due
    ) order by e.id),'[]'::jsonb) into v_equipment
    from public.equipment_items e
    left join public.v_fleet_vehicle_operations f on f.equipment_item_id=e.id
    where e.id=v_dispatch.assigned_truck_equipment_item_id
       or e.id=v_dispatch.assigned_trailer_equipment_item_id
       or exists(select 1 from jsonb_array_elements_text(v_dispatch.assigned_equipment_item_ids) item
                 where item.value=e.id::text);

    v_dispatches:=v_dispatches||jsonb_build_array(jsonb_build_object(
      'id',v_dispatch.id,'work_order_id',v_dispatch.work_order_id,
      'site_matches',v_dispatch.client_site_id is null or v_dispatch.client_site_id=p_site_id,
      'status',v_dispatch.schedule_status,'start',v_dispatch.scheduled_start,
      'end',v_dispatch.scheduled_end,'workability_state',v_dispatch.workability_state,
      'crew_id',v_dispatch.crew_id,'crew_status',v_crew.crew_status,
      'crew_members',v_crew_members,'lead_recorded',v_dispatch.lead_profile_id is not null,
      'supervisor_recorded',v_dispatch.assigned_supervisor_profile_id is not null,
      'crew_profile_count',jsonb_array_length(v_dispatch.assigned_crew_profile_ids),
      'conflicts_checked',v_conflict.dispatch_readiness is not null,
      'conflict_count',v_conflict.conflict_count,
      'truck_id',v_dispatch.assigned_truck_equipment_item_id,
      'trailer_id',v_dispatch.assigned_trailer_equipment_item_id,
      'equipment_ids',v_dispatch.assigned_equipment_item_ids,
      'equipment',v_equipment,
      'observation',case when v_observation.id is null then null else jsonb_build_object(
        'id',v_observation.id,'dispatch_id',v_observation.dispatch_schedule_item_id,
        'observed_at',v_observation.observed_at,'service_date',v_observation.service_date,
        'weather_condition',v_observation.weather_condition,'condition_tags',v_observation.condition_tags,
        'ground_state',v_observation.ground_state,'ice_state',v_observation.freezing_rain_ice_state,
        'storm_state',v_observation.lightning_storm_state,
        'linked_packet_id',v_observation.linked_hse_packet_id) end,
      'decision',case when v_decision.id is null then null else jsonb_build_object(
        'id',v_decision.id,'observation_id',v_decision.observation_id,
        'state',v_decision.decision_state,'decision_at',v_decision.decision_at,
        'by_recorded',v_decision.decided_by_profile_id is not null) end,
      'hse_packet_count',v_packet_count,
      'hse',case when v_packet.id is null then null else jsonb_build_object(
        'id',v_packet.id,'work_order_id',v_packet.work_order_id,
        'status',v_packet.packet_status,'briefing_required',v_packet.briefing_required,
        'inspection_required',v_packet.inspection_required,
        'weather_required',v_packet.weather_monitoring_required,
        'weather_done',v_packet.weather_monitoring_completed,
        'heat_required',v_packet.heat_monitoring_required,
        'heat_done',v_packet.heat_monitoring_completed,
        'field_signoff_required',v_packet.field_signoff_required,
        'field_signoff_done',v_packet.field_signoff_completed) end));
  end loop;

  return jsonb_build_object('company_id',p_company_id,'client_id',p_client_id,
    'site_id',p_site_id,'work_order_id',v_job.id,'work_order_number',v_job.work_order_number,
    'service',v_job.service_module_key,'work_order_status',v_job.status,
    'service_enabled',coalesce(v_enabled,false),
    'release_signed',v_release.release_status='released' and
      v_release.threshold_status='pass' and v_release.signoff_at is not null and
      v_release.signoff_profile_id is not null,
    'dispatch_count',v_dispatch_count,'dispatches',v_dispatches,
    'canonical_source','original_jobs_dispatch_workability_fleet_hse_434',
    'retrieved_at',now(),'business_mutations',false,'dispatch_authorized',false);
end $$;

revoke all on function public.ywi_rpc_job_dispatch_preflight_434(uuid,uuid,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.ywi_rpc_job_dispatch_preflight_434(uuid,uuid,uuid,uuid)
  to authenticated;
comment on function public.ywi_rpc_job_dispatch_preflight_434(uuid,uuid,uuid,uuid) is
  'Read-only 422-guarded original per-job crew/Fleet/weather/HSE dispatch review; no scheduling, Safety clearance or work authorization.';
commit;
