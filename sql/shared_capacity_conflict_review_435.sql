-- Item 435: bounded, read-only shared-resource and original cost-source review.
-- Install only after 433 and 434 have reached protected main + Production.
-- Reuses 422 active-owner + Jobs-read authorization. No stock, Dispatch or GL writes.
begin;

create or replace function public.ywi_rpc_shared_capacity_review_435(
  p_company_id uuid, p_window_start timestamptz, p_window_end timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_dispatch public.dispatch_schedule_items%rowtype;
  v_count integer;
  v_dispatches jsonb := '[]'::jsonb;
  v_assets jsonb;
  v_members jsonb;
  v_signouts jsonb := '[]'::jsonb;
  v_materials jsonb := '[]'::jsonb;
begin
  perform public.ywi_422_assert_owner(p_company_id);
  if p_window_start is null or p_window_end is null or
     p_window_end<=p_window_start or p_window_end>p_window_start+interval '14 days' or
     p_window_start<now()-interval '366 days' or p_window_end>now()+interval '180 days' then
    raise exception '435 review window invalid or outside bounded 14-day horizon';
  end if;

  select count(*) into v_count from public.dispatch_schedule_items d
  join public.work_orders w on w.id=d.work_order_id and w.company_id=p_company_id
  where d.scheduled_start<p_window_end and d.scheduled_end>p_window_start;
  if v_count>80 then raise exception '435 dispatch window capped at 80 records'; end if;

  for v_dispatch in
    select d.* from public.dispatch_schedule_items d
    join public.work_orders w on w.id=d.work_order_id and w.company_id=p_company_id
    where d.scheduled_start<p_window_end and d.scheduled_end>p_window_start
    order by d.scheduled_start,d.id limit 81
  loop
    if jsonb_typeof(v_dispatch.assigned_crew_profile_ids)<>'array' or
       jsonb_typeof(v_dispatch.assigned_equipment_item_ids)<>'array' or
       jsonb_array_length(v_dispatch.assigned_crew_profile_ids)>30 or
       jsonb_array_length(v_dispatch.assigned_equipment_item_ids)>20 then
      raise exception '435 malformed or capped original Dispatch resource list';
    end if;

    select coalesce(jsonb_agg(cm.profile_id order by cm.profile_id),'[]'::jsonb)
      into v_members from public.crew_members cm
    join public.profiles p on p.id=cm.profile_id and p.is_active is true
    where cm.crew_id=v_dispatch.crew_id and cm.membership_status='active'
      and (cm.active_from is null or cm.active_from<=v_dispatch.scheduled_start::date)
      and (cm.active_until is null or cm.active_until>=v_dispatch.scheduled_start::date);
    if jsonb_array_length(v_members)>30 then
      raise exception '435 crew membership source capped at 30';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'name',e.equipment_name,'status',e.status,
      'locked_out',e.is_locked_out,'fleet_status',f.operational_status,
      'fleet_readiness',f.latest_readiness_status,
      'fleet_checked_at',f.latest_readiness_checked_at,
      'fleet_downtime',f.open_downtime_count,
      'registration_expiry',f.registration_expiry,
      'insurance_expiry',f.insurance_expiry,
      'inspection_due',f.annual_vehicle_inspection_due
      ) order by e.id),'[]'::jsonb) into v_assets
    from public.equipment_items e
    left join public.v_fleet_vehicle_operations f on f.equipment_item_id=e.id
    where e.id in (v_dispatch.assigned_truck_equipment_item_id,
                   v_dispatch.assigned_trailer_equipment_item_id)
       or exists(select 1 from jsonb_array_elements_text(v_dispatch.assigned_equipment_item_ids) a
                 where a.value=e.id::text);

    v_dispatches := v_dispatches || jsonb_build_array(jsonb_build_object(
      'id',v_dispatch.id,'work_order_id',v_dispatch.work_order_id,
      'status',v_dispatch.schedule_status,
      'start',v_dispatch.scheduled_start,'end',v_dispatch.scheduled_end,
      'crew_id',v_dispatch.crew_id,'crew_member_ids',v_members,
      'lead_id',v_dispatch.lead_profile_id,
      'supervisor_id',v_dispatch.assigned_supervisor_profile_id,
      'profile_ids',v_dispatch.assigned_crew_profile_ids,
      'truck_id',v_dispatch.assigned_truck_equipment_item_id,
      'trailer_id',v_dispatch.assigned_trailer_equipment_item_id,
      'equipment_ids',v_dispatch.assigned_equipment_item_ids,
      'assets',v_assets,
      'work_order_number',(select w.work_order_number from public.work_orders w where w.id=v_dispatch.work_order_id),
      'service',(select w.service_module_key from public.work_orders w where w.id=v_dispatch.work_order_id)
    ));
  end loop;

  -- Original checkouts can begin before the selected Dispatch dates and remain
  -- in custody. Never infer a second asset expense from another checkout.
  select count(*) into v_count from public.equipment_signouts es
  join public.work_orders w on w.id=es.work_order_id and w.company_id=p_company_id
  where es.checked_out_at<p_window_end and
        coalesce(es.returned_at,'infinity'::timestamptz)>p_window_start;
  if v_count>120 then raise exception '435 original equipment custody capped at 120'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',es.id,'work_order_id',es.work_order_id,'asset_id',es.equipment_item_id,
    'out',es.checked_out_at,'returned',es.returned_at,
    'verification',es.verification_status,
    'proof_id',p.id,'proof_work_order_id',p.work_order_id,
    'proof_matches',case when p.id is null then null else
      p.source_fingerprint=public.ywi_423_source_fingerprint('equipment',es.id::text) end
  ) order by es.checked_out_at,es.id),'[]'::jsonb) into v_signouts
  from public.equipment_signouts es
  join public.work_orders w on w.id=es.work_order_id and w.company_id=p_company_id
  left join public.ywi_work_order_allocation_proofs_423 p
    on p.equipment_signout_id=es.id and p.company_id=p_company_id
  where es.checked_out_at<p_window_end and
        coalesce(es.returned_at,'infinity'::timestamptz)>p_window_start;

  -- Material issue lines have an *original* job-cost amount. Do not total it
  -- here or mirror it to inventory, GL, cost ledger or invoice lines.
  select count(*) into v_count from public.material_issue_lines ml
  join public.material_issues mi on mi.id=ml.issue_id
  join public.work_orders w on w.id=mi.work_order_id and w.company_id=p_company_id
  where exists(select 1 from public.dispatch_schedule_items d
    where d.work_order_id=w.id and d.scheduled_start<p_window_end
      and d.scheduled_end>p_window_start);
  if v_count>120 then raise exception '435 original material issues capped at 120'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',ml.id,'issue_id',mi.id,'work_order_id',mi.work_order_id,
    'site_id',mi.client_site_id,'original_site_id',w.client_site_id,
    'material_id',ml.material_id,'description',ml.description,
    'issue_number',mi.issue_number,'issue_status',mi.issue_status,
    'issue_date',mi.issue_date,'usage_type',ml.usage_type,
    'quantity',ml.quantity,'source_amount',ml.line_total,
    'proof_id',p.id,'proof_work_order_id',p.work_order_id,
    'proof_matches',case when p.id is null then null else
      p.source_fingerprint=public.ywi_423_source_fingerprint('material',ml.id::text) end
  ) order by mi.issue_date,ml.id),'[]'::jsonb) into v_materials
  from public.material_issue_lines ml
  join public.material_issues mi on mi.id=ml.issue_id
  join public.work_orders w on w.id=mi.work_order_id and w.company_id=p_company_id
  left join public.ywi_work_order_allocation_proofs_423 p
    on p.material_issue_line_id=ml.id and p.company_id=p_company_id
  where exists(select 1 from public.dispatch_schedule_items d
    where d.work_order_id=w.id and d.scheduled_start<p_window_end
      and d.scheduled_end>p_window_start);

  return jsonb_build_object(
    'company_id',p_company_id,'window_start',p_window_start,'window_end',p_window_end,
    'canonical_source','original_dispatch_fleet_equipment_material_423_435',
    'retrieved_at',now(),'dispatch_count',jsonb_array_length(v_dispatches),
    'signout_count',jsonb_array_length(v_signouts),
    'material_count',jsonb_array_length(v_materials),
    'dispatches',v_dispatches,'signouts',v_signouts,'materials',v_materials,
    'company_scope_only',true,'sources_complete',true,
    'cost_posting',false,'stock_adjustment',false,'automatic_reallocation',false,
    'dispatch_authorized',false);
end $$;

revoke all on function public.ywi_rpc_shared_capacity_review_435(uuid,timestamptz,timestamptz)
  from public,anon,authenticated;
grant execute on function public.ywi_rpc_shared_capacity_review_435(uuid,timestamptz,timestamptz)
  to authenticated;
comment on function public.ywi_rpc_shared_capacity_review_435(uuid,timestamptz,timestamptz) is
  'Owner+Jobs read guarded company-only bounded original resource conflict/provenance review. No business writes.';
commit;
