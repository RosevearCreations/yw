-- Item 431: strictly owner-scoped, read-only bridge to ORIGINAL client_sites.
-- Apply after Items 212, 420 and 422. No table, entitlement, CRM, Safety or Jobs writes.
-- Canonical property/site detail is intentionally service_role-only in Schema 212;
-- this narrow SECURITY DEFINER RPC has the same owner/Jobs/linked-site guards as 422.
begin;

create or replace function public.ywi_rpc_site_intake_431(
  p_company_id uuid,p_client_id uuid,p_site_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_site public.client_sites%rowtype; v_zones jsonb;
begin
  perform public.ywi_422_assert_link(p_company_id,p_client_id,p_site_id);
  select cs.* into v_site
  from public.client_sites cs
  join public.ywi_company_site_links_422 sl
    on sl.client_site_id=cs.id and sl.client_id=cs.client_id
    and sl.company_id=p_company_id
  where cs.id=p_site_id and cs.client_id=p_client_id and cs.is_active is true;
  if not found then raise exception '431 active verified canonical property required'; end if;

  -- A cap sentinel is failure, never a silently complete truncated zone list.
  select coalesce(jsonb_agg(to_jsonb(z) order by z.zone_name,z.id),'[]'::jsonb)
    into v_zones from (
      select id,zone_name,zone_type,approximate_area,area_unit,
       access_instructions,hazard_notes,utility_locate_notes,service_priority
      from public.client_site_zones
      where client_site_id=p_site_id and is_active is true
      order by zone_name,id limit 51
    ) z;
  if jsonb_array_length(v_zones)>50 then raise exception '431 property zone source exceeds bounded coverage'; end if;

  return jsonb_build_object(
    'company_id',p_company_id,'client_id',p_client_id,'site_id',v_site.id,
    'canonical_source','client_sites_212','is_active',v_site.is_active,
    'name',v_site.site_name,'address',v_site.service_address,
    'updated_at',v_site.updated_at,'property_reviewed_at',v_site.property_reviewed_at,
    'access_last_verified_at',v_site.access_last_verified_at,
    'approximate_serviceable_area',v_site.approximate_serviceable_area,
    'area_unit',v_site.area_unit,'access_notes',v_site.access_notes,
    'hazard_notes',v_site.hazard_notes,'gate_fence_summary',v_site.gate_fence_summary,
    'parking_trailer_limits',v_site.parking_trailer_limits,
    'pet_notes',v_site.pet_notes,'irrigation_notes',v_site.irrigation_notes,
    'slope_notes',v_site.slope_notes,'drainage_wet_area_notes',v_site.drainage_wet_area_notes,
    'utility_locate_notes',v_site.utility_locate_notes,'tree_brush_notes',v_site.tree_brush_notes,
    'recurring_property_instructions',v_site.recurring_property_instructions,
    'zones',v_zones,'safety_evidence_source','NOT_QUERIED',
    'safety_approval','UNVERIFIED');
end $$;

revoke all on function public.ywi_rpc_site_intake_431(uuid,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.ywi_rpc_site_intake_431(uuid,uuid,uuid) to authenticated;
comment on function public.ywi_rpc_site_intake_431(uuid,uuid,uuid) is
 'Read-only 422 owner/Jobs/linked-site guarded original client_sites intake. Safety evidence never inferred.';
commit;
