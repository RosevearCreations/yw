begin;

-- Schema 212 — Build 323 Property & Site Intelligence.
-- Canonical customer-property identity remains public.client_sites.
-- public.sites remains the legacy/operational Safety site authority; Build 323 links to it
-- through the existing client_sites.legacy_site_id instead of creating a competing site identity.

alter table public.client_sites
  add column if not exists approximate_serviceable_area numeric(12,2),
  add column if not exists area_unit text not null default 'sq_ft',
  add column if not exists gate_fence_summary text,
  add column if not exists parking_trailer_limits text,
  add column if not exists pet_notes text,
  add column if not exists irrigation_notes text,
  add column if not exists slope_notes text,
  add column if not exists drainage_wet_area_notes text,
  add column if not exists utility_locate_notes text,
  add column if not exists tree_brush_notes text,
  add column if not exists recurring_property_instructions text,
  add column if not exists access_last_verified_at timestamptz,
  add column if not exists access_last_verified_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists property_reviewed_at timestamptz,
  add column if not exists property_reviewed_by_profile_id uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='client_sites_serviceable_area_chk') then
    alter table public.client_sites add constraint client_sites_serviceable_area_chk
      check (approximate_serviceable_area is null or approximate_serviceable_area >= 0);
  end if;
  if not exists(select 1 from pg_constraint where conname='client_sites_area_unit_chk') then
    alter table public.client_sites add constraint client_sites_area_unit_chk
      check (area_unit in ('sq_ft','sq_m','acre','hectare'));
  end if;
end $$;

create index if not exists client_sites_access_verified_by_idx
  on public.client_sites(access_last_verified_by_profile_id)
  where access_last_verified_by_profile_id is not null;
create index if not exists client_sites_property_reviewed_by_idx
  on public.client_sites(property_reviewed_by_profile_id)
  where property_reviewed_by_profile_id is not null;
create index if not exists client_sites_legacy_site_idx
  on public.client_sites(legacy_site_id)
  where legacy_site_id is not null;

create table if not exists public.client_site_zones (
  id uuid primary key default gen_random_uuid(),
  client_site_id uuid not null references public.client_sites(id) on delete cascade,
  zone_code text not null default ('ZONE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  zone_name text not null,
  zone_type text not null default 'other',
  approximate_area numeric(12,2),
  area_unit text not null default 'sq_ft',
  service_priority text not null default 'normal',
  access_instructions text,
  irrigation_notes text,
  slope_notes text,
  drainage_wet_area_notes text,
  hazard_notes text,
  utility_locate_notes text,
  tree_brush_notes text,
  recurring_instructions text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_site_zones_type_chk check (
    zone_type in ('lawn','garden_bed','hedge_shrub','tree_brush','driveway_parking','access','utility','drainage','other')
  ),
  constraint client_site_zones_area_chk check (approximate_area is null or approximate_area >= 0),
  constraint client_site_zones_area_unit_chk check (area_unit in ('sq_ft','sq_m','acre','hectare')),
  constraint client_site_zones_priority_chk check (service_priority in ('low','normal','high','restricted')),
  constraint client_site_zones_sort_chk check (sort_order between 0 and 10000),
  constraint client_site_zones_site_code_uk unique(client_site_id,zone_code)
);
create index if not exists client_site_zones_site_active_idx
  on public.client_site_zones(client_site_id,is_active,sort_order);
create index if not exists client_site_zones_created_by_idx
  on public.client_site_zones(created_by_profile_id)
  where created_by_profile_id is not null;
create index if not exists client_site_zones_updated_by_idx
  on public.client_site_zones(updated_by_profile_id)
  where updated_by_profile_id is not null;
alter table public.client_site_zones enable row level security;
revoke all on table public.client_site_zones from public,anon,authenticated;
grant select,insert,update,delete on table public.client_site_zones to service_role;

create table if not exists public.client_site_photos (
  id uuid primary key default gen_random_uuid(),
  client_site_id uuid not null references public.client_sites(id) on delete cascade,
  zone_id uuid references public.client_site_zones(id) on delete set null,
  photo_kind text not null default 'overview',
  source_url text,
  storage_bucket text,
  storage_path text,
  caption text,
  captured_at timestamptz,
  recorded_by_profile_id uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_site_photos_kind_chk check (
    photo_kind in ('overview','access','gate_fence','parking_trailer','pet','irrigation','slope_drainage','hazard','utility_locate','tree_brush','zone','other')
  ),
  constraint client_site_photos_reference_chk check (
    nullif(btrim(coalesce(source_url,'')),'') is not null
    or (
      nullif(btrim(coalesce(storage_bucket,'')),'') is not null
      and nullif(btrim(coalesce(storage_path,'')),'') is not null
    )
  )
);
create index if not exists client_site_photos_site_active_idx
  on public.client_site_photos(client_site_id,is_active,created_at desc);
create index if not exists client_site_photos_zone_idx
  on public.client_site_photos(zone_id)
  where zone_id is not null;
create index if not exists client_site_photos_recorded_by_idx
  on public.client_site_photos(recorded_by_profile_id)
  where recorded_by_profile_id is not null;
alter table public.client_site_photos enable row level security;
revoke all on table public.client_site_photos from public,anon,authenticated;
grant select,insert,update,delete on table public.client_site_photos to service_role;

create or replace view public.v_property_site_zone_directory
with (security_invoker=true)
as
select
  z.*,
  cs.client_id,
  cs.site_code,
  cs.site_name,
  cs.service_address,
  cs.city,
  c.display_name as client_display_name,
  c.legal_name as client_legal_name
from public.client_site_zones z
join public.client_sites cs on cs.id=z.client_site_id
join public.clients c on c.id=cs.client_id;
revoke all on table public.v_property_site_zone_directory from public,anon,authenticated;
grant select on table public.v_property_site_zone_directory to service_role;

create or replace view public.v_property_site_photo_directory
with (security_invoker=true)
as
select
  p.*,
  cs.client_id,
  cs.site_code,
  cs.site_name,
  z.zone_code,
  z.zone_name,
  c.display_name as client_display_name,
  c.legal_name as client_legal_name,
  case
    when nullif(btrim(coalesce(p.storage_bucket,'')),'') is not null
      and nullif(btrim(coalesce(p.storage_path,'')),'') is not null then 'storage_reference'
    when nullif(btrim(coalesce(p.source_url,'')),'') is not null then 'url_reference'
    else 'missing_reference'
  end as reference_type
from public.client_site_photos p
join public.client_sites cs on cs.id=p.client_site_id
join public.clients c on c.id=cs.client_id
left join public.client_site_zones z on z.id=p.zone_id;
revoke all on table public.v_property_site_photo_directory from public,anon,authenticated;
grant select on table public.v_property_site_photo_directory to service_role;

create or replace view public.v_property_site_intelligence
with (security_invoker=true)
as
select
  cs.id,
  cs.client_id,
  cs.legacy_site_id,
  cs.site_code,
  cs.site_name,
  cs.service_address,
  cs.city,
  cs.province,
  cs.postal_code,
  cs.latitude,
  cs.longitude,
  cs.access_notes,
  cs.hazard_notes,
  cs.approximate_serviceable_area,
  cs.area_unit,
  cs.gate_fence_summary,
  cs.parking_trailer_limits,
  cs.pet_notes,
  cs.irrigation_notes,
  cs.slope_notes,
  cs.drainage_wet_area_notes,
  cs.utility_locate_notes,
  cs.tree_brush_notes,
  cs.recurring_property_instructions,
  cs.access_last_verified_at,
  cs.access_last_verified_by_profile_id,
  cs.property_reviewed_at,
  cs.property_reviewed_by_profile_id,
  cs.is_active,
  cs.created_at,
  cs.updated_at,
  coalesce(c.display_name,c.legal_name) as client_name,
  c.client_code,
  ls.site_code as legacy_site_code,
  ls.site_name as legacy_site_name,
  coalesce(z.zone_count,0)::int as zone_count,
  coalesce(z.active_zone_count,0)::int as active_zone_count,
  coalesce(z.zone_hazard_count,0)::int as zone_hazard_count,
  coalesce(p.active_photo_count,0)::int as active_photo_count,
  coalesce(r.recurring_program_count,0)::int as recurring_program_count,
  coalesce(w.open_work_order_count,0)::int as open_work_order_count,
  (
    nullif(btrim(coalesce(cs.hazard_notes,'')),'') is not null
    or coalesce(z.zone_hazard_count,0)>0
  ) as has_known_hazard_notes,
  (
    nullif(btrim(coalesce(cs.gate_fence_summary,'')),'') is not null
    or nullif(btrim(coalesce(cs.parking_trailer_limits,'')),'') is not null
    or nullif(btrim(coalesce(cs.access_notes,'')),'') is not null
  ) as has_access_constraints,
  (
    case when nullif(btrim(coalesce(cs.service_address,'')),'') is null then 1 else 0 end +
    case when cs.approximate_serviceable_area is null then 1 else 0 end +
    case when nullif(btrim(coalesce(cs.access_notes,'')),'') is null then 1 else 0 end +
    case when coalesce(z.active_zone_count,0)=0 then 1 else 0 end
  )::int as profile_gap_count,
  case
    when not cs.is_active then 'inactive'
    when nullif(btrim(coalesce(cs.service_address,'')),'') is null then 'needs_address'
    when cs.approximate_serviceable_area is null or coalesce(z.active_zone_count,0)=0 then 'needs_profile'
    else 'profiled'
  end as property_profile_status
from public.client_sites cs
join public.clients c on c.id=cs.client_id
left join public.sites ls on ls.id=cs.legacy_site_id
left join lateral (
  select
    count(*)::int as zone_count,
    count(*) filter(where zz.is_active)::int as active_zone_count,
    count(*) filter(where zz.is_active and nullif(btrim(coalesce(zz.hazard_notes,'')),'') is not null)::int as zone_hazard_count
  from public.client_site_zones zz
  where zz.client_site_id=cs.id
) z on true
left join lateral (
  select count(*) filter(where pp.is_active)::int as active_photo_count
  from public.client_site_photos pp
  where pp.client_site_id=cs.id
) p on true
left join lateral (
  select count(*) filter(where rr.agreement_status in ('draft','active','paused'))::int as recurring_program_count
  from public.recurring_service_agreements rr
  where rr.client_site_id=cs.id
) r on true
left join lateral (
  select count(*) filter(where ww.work_order_status not in ('completed','cancelled','closed'))::int as open_work_order_count
  from public.work_orders ww
  where ww.client_site_id=cs.id
) w on true;
revoke all on table public.v_property_site_intelligence from public,anon,authenticated;
grant select on table public.v_property_site_intelligence to service_role;

create or replace function public.ywi_rpc_property_site_save(
  p_payload jsonb,
  p_actor_profile_id uuid
)
returns public.client_sites
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_id uuid := case when nullif(p_payload->>'id','') is null then null else (p_payload->>'id')::uuid end;
  v_client_id uuid := case when nullif(p_payload->>'client_id','') is null then null else (p_payload->>'client_id')::uuid end;
  v_site_name text := nullif(btrim(p_payload->>'site_name'),'');
  v_site_code text := upper(nullif(btrim(p_payload->>'site_code'),''));
  v_area numeric := case when nullif(p_payload->>'approximate_serviceable_area','') is null then null else (p_payload->>'approximate_serviceable_area')::numeric end;
  v_area_unit text := lower(coalesce(nullif(p_payload->>'area_unit',''),'sq_ft'));
  v_row public.client_sites;
begin
  if v_id is null and v_client_id is null then
    raise exception 'A customer is required to create a property.' using errcode='23514';
  end if;
  if v_id is null and v_site_name is null then
    raise exception 'Property/site name is required.' using errcode='23514';
  end if;
  if v_area is not null and v_area < 0 then
    raise exception 'Approximate serviceable area cannot be negative.' using errcode='23514';
  end if;
  if v_area_unit not in ('sq_ft','sq_m','acre','hectare') then
    raise exception 'Unsupported property area unit %.',v_area_unit using errcode='23514';
  end if;
  if v_client_id is not null and not exists(select 1 from public.clients where id=v_client_id) then
    raise exception 'Customer % does not exist.',v_client_id using errcode='23503';
  end if;

  if v_id is null then
    v_site_code:=coalesce(v_site_code,'PROP-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)));
    insert into public.client_sites(
      client_id,legacy_site_id,site_code,site_name,service_address,city,province,postal_code,
      latitude,longitude,access_notes,hazard_notes,is_active,
      approximate_serviceable_area,area_unit,gate_fence_summary,parking_trailer_limits,pet_notes,
      irrigation_notes,slope_notes,drainage_wet_area_notes,utility_locate_notes,tree_brush_notes,
      recurring_property_instructions,access_last_verified_at,access_last_verified_by_profile_id,
      property_reviewed_at,property_reviewed_by_profile_id
    ) values (
      v_client_id,
      case when nullif(p_payload->>'legacy_site_id','') is null then null else (p_payload->>'legacy_site_id')::uuid end,
      v_site_code,v_site_name,
      nullif(p_payload->>'service_address',''),nullif(p_payload->>'city',''),nullif(p_payload->>'province',''),nullif(p_payload->>'postal_code',''),
      nullif(p_payload->>'latitude','')::numeric,nullif(p_payload->>'longitude','')::numeric,
      nullif(p_payload->>'access_notes',''),nullif(p_payload->>'hazard_notes',''),
      coalesce((p_payload->>'is_active')::boolean,true),
      v_area,v_area_unit,nullif(p_payload->>'gate_fence_summary',''),nullif(p_payload->>'parking_trailer_limits',''),nullif(p_payload->>'pet_notes',''),
      nullif(p_payload->>'irrigation_notes',''),nullif(p_payload->>'slope_notes',''),nullif(p_payload->>'drainage_wet_area_notes',''),
      nullif(p_payload->>'utility_locate_notes',''),nullif(p_payload->>'tree_brush_notes',''),nullif(p_payload->>'recurring_property_instructions',''),
      case when coalesce((p_payload->>'verify_access_now')::boolean,false) then now() else null end,
      case when coalesce((p_payload->>'verify_access_now')::boolean,false) then p_actor_profile_id else null end,
      now(),p_actor_profile_id
    ) returning * into v_row;
  else
    select * into v_row from public.client_sites where id=v_id for update;
    if not found then raise exception 'Property % does not exist.',v_id using errcode='23503'; end if;

    if v_client_id is null then v_client_id:=v_row.client_id; end if;
    update public.client_sites cs set
      client_id=v_client_id,
      legacy_site_id=case when p_payload ? 'legacy_site_id' then nullif(p_payload->>'legacy_site_id','')::uuid else cs.legacy_site_id end,
      site_code=case when p_payload ? 'site_code' then coalesce(v_site_code,cs.site_code) else cs.site_code end,
      site_name=coalesce(v_site_name,cs.site_name),
      service_address=case when p_payload ? 'service_address' then nullif(p_payload->>'service_address','') else cs.service_address end,
      city=case when p_payload ? 'city' then nullif(p_payload->>'city','') else cs.city end,
      province=case when p_payload ? 'province' then nullif(p_payload->>'province','') else cs.province end,
      postal_code=case when p_payload ? 'postal_code' then nullif(p_payload->>'postal_code','') else cs.postal_code end,
      latitude=case when p_payload ? 'latitude' then nullif(p_payload->>'latitude','')::numeric else cs.latitude end,
      longitude=case when p_payload ? 'longitude' then nullif(p_payload->>'longitude','')::numeric else cs.longitude end,
      access_notes=case when p_payload ? 'access_notes' then nullif(p_payload->>'access_notes','') else cs.access_notes end,
      hazard_notes=case when p_payload ? 'hazard_notes' then nullif(p_payload->>'hazard_notes','') else cs.hazard_notes end,
      is_active=case when p_payload ? 'is_active' then coalesce((p_payload->>'is_active')::boolean,true) else cs.is_active end,
      approximate_serviceable_area=case when p_payload ? 'approximate_serviceable_area' then v_area else cs.approximate_serviceable_area end,
      area_unit=case when p_payload ? 'area_unit' then v_area_unit else cs.area_unit end,
      gate_fence_summary=case when p_payload ? 'gate_fence_summary' then nullif(p_payload->>'gate_fence_summary','') else cs.gate_fence_summary end,
      parking_trailer_limits=case when p_payload ? 'parking_trailer_limits' then nullif(p_payload->>'parking_trailer_limits','') else cs.parking_trailer_limits end,
      pet_notes=case when p_payload ? 'pet_notes' then nullif(p_payload->>'pet_notes','') else cs.pet_notes end,
      irrigation_notes=case when p_payload ? 'irrigation_notes' then nullif(p_payload->>'irrigation_notes','') else cs.irrigation_notes end,
      slope_notes=case when p_payload ? 'slope_notes' then nullif(p_payload->>'slope_notes','') else cs.slope_notes end,
      drainage_wet_area_notes=case when p_payload ? 'drainage_wet_area_notes' then nullif(p_payload->>'drainage_wet_area_notes','') else cs.drainage_wet_area_notes end,
      utility_locate_notes=case when p_payload ? 'utility_locate_notes' then nullif(p_payload->>'utility_locate_notes','') else cs.utility_locate_notes end,
      tree_brush_notes=case when p_payload ? 'tree_brush_notes' then nullif(p_payload->>'tree_brush_notes','') else cs.tree_brush_notes end,
      recurring_property_instructions=case when p_payload ? 'recurring_property_instructions' then nullif(p_payload->>'recurring_property_instructions','') else cs.recurring_property_instructions end,
      access_last_verified_at=case when coalesce((p_payload->>'verify_access_now')::boolean,false) then now() else cs.access_last_verified_at end,
      access_last_verified_by_profile_id=case when coalesce((p_payload->>'verify_access_now')::boolean,false) then p_actor_profile_id else cs.access_last_verified_by_profile_id end,
      property_reviewed_at=now(),
      property_reviewed_by_profile_id=p_actor_profile_id,
      updated_at=now()
    where cs.id=v_id
    returning cs.* into v_row;
  end if;
  return v_row;
end;
$$;
revoke all on function public.ywi_rpc_property_site_save(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_property_site_save(jsonb,uuid) to service_role;

create or replace function public.ywi_rpc_property_zone_save(
  p_payload jsonb,
  p_actor_profile_id uuid
)
returns public.client_site_zones
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_id uuid := case when nullif(p_payload->>'id','') is null then null else (p_payload->>'id')::uuid end;
  v_site_id uuid := case when nullif(p_payload->>'client_site_id','') is null then null else (p_payload->>'client_site_id')::uuid end;
  v_name text := nullif(btrim(p_payload->>'zone_name'),'');
  v_type text := lower(coalesce(nullif(p_payload->>'zone_type',''),'other'));
  v_area numeric := case when nullif(p_payload->>'approximate_area','') is null then null else (p_payload->>'approximate_area')::numeric end;
  v_area_unit text := lower(coalesce(nullif(p_payload->>'area_unit',''),'sq_ft'));
  v_priority text := lower(coalesce(nullif(p_payload->>'service_priority',''),'normal'));
  v_row public.client_site_zones;
begin
  if v_site_id is null and v_id is null then raise exception 'Property is required.' using errcode='23514'; end if;
  if v_name is null and v_id is null then raise exception 'Zone name is required.' using errcode='23514'; end if;
  if v_type not in ('lawn','garden_bed','hedge_shrub','tree_brush','driveway_parking','access','utility','drainage','other') then
    raise exception 'Unsupported zone type %.',v_type using errcode='23514';
  end if;
  if v_area is not null and v_area<0 then raise exception 'Zone area cannot be negative.' using errcode='23514'; end if;
  if v_area_unit not in ('sq_ft','sq_m','acre','hectare') then raise exception 'Unsupported zone area unit.' using errcode='23514'; end if;
  if v_priority not in ('low','normal','high','restricted') then raise exception 'Unsupported zone priority.' using errcode='23514'; end if;

  if v_id is null then
    if not exists(select 1 from public.client_sites where id=v_site_id) then raise exception 'Property % does not exist.',v_site_id using errcode='23503'; end if;
    insert into public.client_site_zones(
      client_site_id,zone_code,zone_name,zone_type,approximate_area,area_unit,service_priority,
      access_instructions,irrigation_notes,slope_notes,drainage_wet_area_notes,hazard_notes,
      utility_locate_notes,tree_brush_notes,recurring_instructions,is_active,sort_order,
      created_by_profile_id,updated_by_profile_id
    ) values (
      v_site_id,
      upper(coalesce(nullif(btrim(p_payload->>'zone_code'),''),'ZONE-'||substr(replace(gen_random_uuid()::text,'-',''),1,10))),
      v_name,v_type,v_area,v_area_unit,v_priority,
      nullif(p_payload->>'access_instructions',''),nullif(p_payload->>'irrigation_notes',''),nullif(p_payload->>'slope_notes',''),
      nullif(p_payload->>'drainage_wet_area_notes',''),nullif(p_payload->>'hazard_notes',''),
      nullif(p_payload->>'utility_locate_notes',''),nullif(p_payload->>'tree_brush_notes',''),nullif(p_payload->>'recurring_instructions',''),
      coalesce((p_payload->>'is_active')::boolean,true),greatest(0,least(coalesce(nullif(p_payload->>'sort_order','')::integer,100),10000)),
      p_actor_profile_id,p_actor_profile_id
    ) returning * into v_row;
  else
    select * into v_row from public.client_site_zones where id=v_id for update;
    if not found then raise exception 'Property zone % does not exist.',v_id using errcode='23503'; end if;
    if v_site_id is null then v_site_id:=v_row.client_site_id; end if;
    update public.client_site_zones z set
      client_site_id=v_site_id,
      zone_code=case when p_payload ? 'zone_code' then upper(coalesce(nullif(btrim(p_payload->>'zone_code'),''),z.zone_code)) else z.zone_code end,
      zone_name=coalesce(v_name,z.zone_name),
      zone_type=case when p_payload ? 'zone_type' then v_type else z.zone_type end,
      approximate_area=case when p_payload ? 'approximate_area' then v_area else z.approximate_area end,
      area_unit=case when p_payload ? 'area_unit' then v_area_unit else z.area_unit end,
      service_priority=case when p_payload ? 'service_priority' then v_priority else z.service_priority end,
      access_instructions=case when p_payload ? 'access_instructions' then nullif(p_payload->>'access_instructions','') else z.access_instructions end,
      irrigation_notes=case when p_payload ? 'irrigation_notes' then nullif(p_payload->>'irrigation_notes','') else z.irrigation_notes end,
      slope_notes=case when p_payload ? 'slope_notes' then nullif(p_payload->>'slope_notes','') else z.slope_notes end,
      drainage_wet_area_notes=case when p_payload ? 'drainage_wet_area_notes' then nullif(p_payload->>'drainage_wet_area_notes','') else z.drainage_wet_area_notes end,
      hazard_notes=case when p_payload ? 'hazard_notes' then nullif(p_payload->>'hazard_notes','') else z.hazard_notes end,
      utility_locate_notes=case when p_payload ? 'utility_locate_notes' then nullif(p_payload->>'utility_locate_notes','') else z.utility_locate_notes end,
      tree_brush_notes=case when p_payload ? 'tree_brush_notes' then nullif(p_payload->>'tree_brush_notes','') else z.tree_brush_notes end,
      recurring_instructions=case when p_payload ? 'recurring_instructions' then nullif(p_payload->>'recurring_instructions','') else z.recurring_instructions end,
      is_active=case when p_payload ? 'is_active' then coalesce((p_payload->>'is_active')::boolean,true) else z.is_active end,
      sort_order=case when p_payload ? 'sort_order' then greatest(0,least(coalesce(nullif(p_payload->>'sort_order','')::integer,100),10000)) else z.sort_order end,
      updated_by_profile_id=p_actor_profile_id,
      updated_at=now()
    where z.id=v_id
    returning z.* into v_row;
  end if;
  return v_row;
end;
$$;
revoke all on function public.ywi_rpc_property_zone_save(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_property_zone_save(jsonb,uuid) to service_role;

create or replace function public.ywi_rpc_property_photo_register(
  p_payload jsonb,
  p_actor_profile_id uuid
)
returns public.client_site_photos
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_id uuid := case when nullif(p_payload->>'id','') is null then null else (p_payload->>'id')::uuid end;
  v_site_id uuid := case when nullif(p_payload->>'client_site_id','') is null then null else (p_payload->>'client_site_id')::uuid end;
  v_zone_id uuid := case when nullif(p_payload->>'zone_id','') is null then null else (p_payload->>'zone_id')::uuid end;
  v_kind text := lower(coalesce(nullif(p_payload->>'photo_kind',''),'overview'));
  v_url text := nullif(btrim(p_payload->>'source_url'),'');
  v_bucket text := nullif(btrim(p_payload->>'storage_bucket'),'');
  v_path text := nullif(btrim(p_payload->>'storage_path'),'');
  v_row public.client_site_photos;
begin
  if v_site_id is null and v_id is null then raise exception 'Property is required.' using errcode='23514'; end if;
  if v_kind not in ('overview','access','gate_fence','parking_trailer','pet','irrigation','slope_drainage','hazard','utility_locate','tree_brush','zone','other') then
    raise exception 'Unsupported property photo kind %.',v_kind using errcode='23514';
  end if;
  if v_id is null and v_url is null and (v_bucket is null or v_path is null) then
    raise exception 'A source URL or storage bucket/path is required.' using errcode='23514';
  end if;

  if v_id is null then
    if not exists(select 1 from public.client_sites where id=v_site_id) then raise exception 'Property % does not exist.',v_site_id using errcode='23503'; end if;
    if v_zone_id is not null and not exists(select 1 from public.client_site_zones where id=v_zone_id and client_site_id=v_site_id) then
      raise exception 'Photo zone must belong to the selected property.' using errcode='23514';
    end if;
    insert into public.client_site_photos(
      client_site_id,zone_id,photo_kind,source_url,storage_bucket,storage_path,caption,captured_at,
      recorded_by_profile_id,is_active,metadata
    ) values (
      v_site_id,v_zone_id,v_kind,v_url,v_bucket,v_path,nullif(p_payload->>'caption',''),
      nullif(p_payload->>'captured_at','')::timestamptz,p_actor_profile_id,
      coalesce((p_payload->>'is_active')::boolean,true),coalesce(p_payload->'metadata','{}'::jsonb)
    ) returning * into v_row;
  else
    select * into v_row from public.client_site_photos where id=v_id for update;
    if not found then raise exception 'Property photo % does not exist.',v_id using errcode='23503'; end if;
    if v_site_id is null then v_site_id:=v_row.client_site_id; end if;
    if v_zone_id is not null and not exists(select 1 from public.client_site_zones where id=v_zone_id and client_site_id=v_site_id) then
      raise exception 'Photo zone must belong to the selected property.' using errcode='23514';
    end if;
    update public.client_site_photos p set
      client_site_id=v_site_id,
      zone_id=case when p_payload ? 'zone_id' then v_zone_id else p.zone_id end,
      photo_kind=case when p_payload ? 'photo_kind' then v_kind else p.photo_kind end,
      source_url=case when p_payload ? 'source_url' then v_url else p.source_url end,
      storage_bucket=case when p_payload ? 'storage_bucket' then v_bucket else p.storage_bucket end,
      storage_path=case when p_payload ? 'storage_path' then v_path else p.storage_path end,
      caption=case when p_payload ? 'caption' then nullif(p_payload->>'caption','') else p.caption end,
      captured_at=case when p_payload ? 'captured_at' then nullif(p_payload->>'captured_at','')::timestamptz else p.captured_at end,
      recorded_by_profile_id=coalesce(p.recorded_by_profile_id,p_actor_profile_id),
      is_active=case when p_payload ? 'is_active' then coalesce((p_payload->>'is_active')::boolean,true) else p.is_active end,
      metadata=case when p_payload ? 'metadata' then coalesce(p_payload->'metadata','{}'::jsonb) else p.metadata end,
      updated_at=now()
    where p.id=v_id
    returning p.* into v_row;
  end if;
  return v_row;
end;
$$;
revoke all on function public.ywi_rpc_property_photo_register(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_property_photo_register(jsonb,uuid) to service_role;

insert into public.app_module_write_contracts(
  action_key,owner_module,minimum_access,boundary_mode,domain_key,event_key,cross_module_event,is_enabled,description
) values
  ('property_site_save','jobs','approve','write','property_site','jobs.property_site.saved',false,true,'Create or update canonical customer-property intelligence.'),
  ('property_zone_save','jobs','approve','write','property_site','jobs.property_site.zone_saved',false,true,'Create or update a lawn/garden/access/property zone.'),
  ('property_photo_register','jobs','approve','write','property_site','jobs.property_site.photo_registered',false,true,'Register or update a private property photo reference.')
on conflict(action_key) do update set
  owner_module=excluded.owner_module,
  minimum_access=excluded.minimum_access,
  boundary_mode=excluded.boundary_mode,
  domain_key=excluded.domain_key,
  event_key=excluded.event_key,
  cross_module_event=excluded.cross_module_event,
  is_enabled=excluded.is_enabled,
  description=excluded.description,
  updated_at=now();

create or replace function public.ywi_module_write_boundary_security_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'operations_action_contract_count',
    case when (select count(*) from public.app_module_write_contracts where is_enabled)=42 then 'passed' else 'failed' end,
    'Exactly 42 explicitly handled operations-manage actions have enabled write-boundary contracts.'
  union all
  select 'cross_module_events_named',
    case when not exists (
      select 1 from public.app_module_write_contracts
      where is_enabled and cross_module_event and event_key is null
    ) then 'passed' else 'failed' end,
    'Every declared cross-module effect has a stable event key.'
  union all
  select 'manual_deposit_mutation_disabled',
    case when exists (
      select 1 from public.app_module_write_contracts
      where action_key='deposit_status_update' and owner_module='finance' and boundary_mode='disabled' and is_enabled
    ) then 'passed' else 'failed' end,
    'Hosted payment truth cannot be manually changed through operations-manage.'
  union all
  select 'boundary_control_plane_private',
    case when not exists (
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('app_module_write_contracts','module_boundary_events','v_module_boundary_event_contract_status','operations_attention_states')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Boundary contracts, emitted events and attention disposition state remain private server control-plane data.';
$$;
revoke all on function public.ywi_module_write_boundary_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_module_write_boundary_security_assertions() to service_role;

create or replace function public.ywi_property_site_security_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'canonical_client_sites_rls_enabled',
    case when coalesce((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='client_sites'),false)
      then 'passed' else 'failed' end,
    'Canonical client_sites property identity remains RLS-enabled.'
  union all
  select 'canonical_client_sites_browser_fail_closed',
    case when not exists(
      select 1 from pg_policies
      where schemaname='public' and tablename='client_sites'
        and (roles && array['anon','authenticated','public']::name[])
    ) then 'passed' else 'failed' end,
    'Existing broad relation grants remain fail-closed because client_sites has no browser RLS policy.'
  union all
  select 'property_subordinates_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('client_site_zones','client_site_photos')
        and grantee in ('anon','authenticated','PUBLIC')
    ) and not exists(
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in ('client_site_zones','client_site_photos') and not c.relrowsecurity
    ) then 'passed' else 'failed' end,
    'Property zones and photo references are private service-role data with RLS enabled.'
  union all
  select 'property_views_browser_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('v_property_site_intelligence','v_property_site_zone_directory','v_property_site_photo_directory')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Property intelligence read models are server-only.'
  union all
  select 'property_rpcs_browser_private',
    case when not exists(
      select 1 from information_schema.routine_privileges
      where specific_schema='public'
        and routine_name in ('ywi_rpc_property_site_save','ywi_rpc_property_zone_save','ywi_rpc_property_photo_register')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Property mutation RPCs are callable only through server authority.'
  union all
  select 'property_actions_registered',
    case when (select count(*) from public.app_module_write_contracts
      where action_key in ('property_site_save','property_zone_save','property_photo_register')
        and owner_module='jobs' and minimum_access='approve' and boundary_mode='write' and is_enabled)=3
      then 'passed' else 'failed' end,
    'Property, zone and photo-reference writes are explicit Jobs-approve contracts.'
  union all
  select 'legacy_safety_site_authority_preserved',
    case when exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='client_sites' and column_name='legacy_site_id'
    ) and exists(
      select 1 from information_schema.tables
      where table_schema='public' and table_name='sites'
    ) then 'passed' else 'failed' end,
    'Build 323 enriches client_sites while preserving the separate legacy/Safety sites authority.'
  union all
  select 'finance_provider_execution_off',
    case when not exists(
      select 1 from public.finance_job_completion_posting_execution_controls
      where execution_enabled=true or provider_mutation_enabled=true
    ) then 'passed' else 'failed' end,
    'Build 323 does not enable Finance posting or payment-provider mutation.';
$$;
revoke all on function public.ywi_property_site_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_property_site_security_assertions() to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  212,'212_property_site_intelligence',
  'Makes client_sites a first-class landscaping property profile with zones, access/parking/pet/irrigation/slope/drainage/hazard/utility/tree notes and private photo references.',
  'applied',now(),'schema212',
  'Canonical property identity remains client_sites; separate sites Safety authority is preserved; Finance/provider execution remains disabled.',
  '212_property_site_intelligence.sql','schema212'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true)
as
select
  212 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=212 then 'current'
    when coalesce(max(schema_version) filter(where status='applied'),0)>212 then 'ahead'
    else 'drift'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=212 then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter(where status='applied'),0)>212 then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
