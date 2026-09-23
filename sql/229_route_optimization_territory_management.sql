begin;

-- Schema 229 — Build 341 Route Optimization & Territory Management.
-- Existing authorities remain canonical:
--   route identity/order = public.routes + public.route_stops
--   actual schedule/dispatch = public.dispatch_schedule_items
--   recurring frequency/windows/duration = public.recurring_service_agreements
--   property coordinates/access = public.client_sites / v_property_site_intelligence
-- Build 341 adds territory ownership and advisory optimization proposals only.

create table if not exists public.route_territories (
  id uuid primary key default gen_random_uuid(),
  territory_code text not null unique default ('TERR-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  territory_name text not null,
  service_area_id uuid references public.service_areas(id) on delete set null,
  season_context text not null default 'four_season',
  territory_status text not null default 'active',
  owner_profile_id uuid references public.profiles(id) on delete set null,
  owner_crew_id uuid references public.crews(id) on delete set null,
  centre_latitude numeric(10,7),
  centre_longitude numeric(10,7),
  radius_km numeric(10,2),
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint route_territories_season_chk check (season_context in ('spring_summer','fall','winter','four_season')),
  constraint route_territories_status_chk check (territory_status in ('active','inactive','archived')),
  constraint route_territories_lat_chk check (centre_latitude is null or centre_latitude between -90 and 90),
  constraint route_territories_lon_chk check (centre_longitude is null or centre_longitude between -180 and 180),
  constraint route_territories_radius_chk check (radius_km is null or radius_km between 0 and 500)
);

create table if not exists public.route_territory_sites (
  id uuid primary key default gen_random_uuid(),
  territory_id uuid not null references public.route_territories(id) on delete cascade,
  client_site_id uuid not null references public.client_sites(id) on delete cascade,
  service_priority text not null default 'normal',
  preferred_route_id uuid references public.routes(id) on delete set null,
  assignment_note text,
  is_active boolean not null default true,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint route_territory_sites_priority_chk check (service_priority in ('low','normal','high','critical')),
  constraint route_territory_sites_uk unique(territory_id,client_site_id)
);

alter table public.routes
  add column if not exists territory_id uuid references public.route_territories(id) on delete set null,
  add column if not exists season_context text not null default 'four_season',
  add column if not exists default_crew_id uuid references public.crews(id) on delete set null,
  add column if not exists daily_capacity_minutes integer,
  add column if not exists service_priority text not null default 'normal',
  add column if not exists storm_event_capable boolean not null default false,
  add column if not exists default_equipment_requirements text,
  add column if not exists optimization_notes text;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='routes_season_context_chk') then
    alter table public.routes add constraint routes_season_context_chk
      check (season_context in ('spring_summer','fall','winter','four_season'));
  end if;
  if not exists(select 1 from pg_constraint where conname='routes_daily_capacity_chk') then
    alter table public.routes add constraint routes_daily_capacity_chk
      check (daily_capacity_minutes is null or daily_capacity_minutes between 30 and 1440);
  end if;
  if not exists(select 1 from pg_constraint where conname='routes_service_priority_chk') then
    alter table public.routes add constraint routes_service_priority_chk
      check (service_priority in ('low','normal','high','critical'));
  end if;
end $$;

create table if not exists public.route_optimization_runs (
  id uuid primary key default gen_random_uuid(),
  run_code text not null unique default ('ROPT-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
  route_id uuid not null references public.routes(id) on delete cascade,
  territory_id uuid references public.route_territories(id) on delete set null,
  service_date date not null,
  season_context text not null,
  optimization_goal text not null default 'travel_efficiency',
  run_status text not null default 'generated',
  storm_event_active boolean not null default false,
  storm_event_key text,
  service_priority_context text not null default 'normal',
  assumed_average_speed_kph numeric(8,2) not null default 35,
  capacity_minutes integer,
  proposed_stop_count integer not null default 0,
  proposed_service_minutes integer not null default 0,
  proposed_travel_minutes integer not null default 0,
  proposal_note text,
  decision_note text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  decided_by_profile_id uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint route_optimization_runs_season_chk check (season_context in ('spring_summer','fall','winter','four_season')),
  constraint route_optimization_runs_goal_chk check (optimization_goal in ('travel_efficiency','capacity_balance','time_windows','service_priority','storm_priority')),
  constraint route_optimization_runs_status_chk check (run_status in ('generated','reviewed','accepted','rejected','superseded')),
  constraint route_optimization_runs_priority_chk check (service_priority_context in ('low','normal','high','critical')),
  constraint route_optimization_runs_speed_chk check (assumed_average_speed_kph between 5 and 120),
  constraint route_optimization_runs_capacity_chk check (capacity_minutes is null or capacity_minutes between 30 and 1440)
);

create table if not exists public.route_optimization_stop_proposals (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.route_optimization_runs(id) on delete cascade,
  route_stop_id uuid references public.route_stops(id) on delete set null,
  client_site_id uuid not null references public.client_sites(id) on delete cascade,
  recurring_service_agreement_id uuid references public.recurring_service_agreements(id) on delete set null,
  dispatch_schedule_item_id uuid references public.dispatch_schedule_items(id) on delete set null,
  current_order integer,
  proposed_order integer not null,
  service_priority text not null default 'normal',
  estimated_service_minutes integer,
  proximity_travel_minutes_estimate integer not null default 0,
  distance_from_territory_centre_km numeric(10,2),
  service_window_start time,
  service_window_end time,
  recurrence_frequency text,
  required_equipment_summary text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  proposal_reason text,
  data_quality text not null default 'complete',
  created_at timestamptz not null default now(),
  constraint route_opt_stops_order_chk check (proposed_order between 1 and 999),
  constraint route_opt_stops_priority_chk check (service_priority in ('low','normal','high','critical')),
  constraint route_opt_stops_duration_chk check (estimated_service_minutes is null or estimated_service_minutes between 1 and 1440),
  constraint route_opt_stops_travel_chk check (proximity_travel_minutes_estimate between 0 and 1440),
  constraint route_opt_stops_quality_chk check (data_quality in ('complete','missing_coordinates','missing_duration','missing_window','partial')),
  constraint route_opt_stops_run_order_uk unique(run_id,proposed_order)
);

create index if not exists route_territories_area_season_idx on public.route_territories(service_area_id,season_context,territory_status);
create index if not exists route_territory_sites_site_idx on public.route_territory_sites(client_site_id,is_active);
create index if not exists routes_territory_season_idx on public.routes(territory_id,season_context,is_active);
create index if not exists route_optimization_runs_route_date_idx on public.route_optimization_runs(route_id,service_date,created_at desc);
create index if not exists route_optimization_runs_status_idx on public.route_optimization_runs(run_status,service_date);
create index if not exists route_opt_stops_run_order_idx on public.route_optimization_stop_proposals(run_id,proposed_order);
create index if not exists route_opt_stops_site_idx on public.route_optimization_stop_proposals(client_site_id,created_at desc);

alter table public.route_territories enable row level security;
alter table public.route_territory_sites enable row level security;
alter table public.route_optimization_runs enable row level security;
alter table public.route_optimization_stop_proposals enable row level security;
revoke all on table public.route_territories from public,anon,authenticated;
revoke all on table public.route_territory_sites from public,anon,authenticated;
revoke all on table public.route_optimization_runs from public,anon,authenticated;
revoke all on table public.route_optimization_stop_proposals from public,anon,authenticated;
grant select,insert,update,delete on table public.route_territories to service_role;
grant select,insert,update,delete on table public.route_territory_sites to service_role;
grant select,insert,update on table public.route_optimization_runs to service_role;
grant select,insert on table public.route_optimization_stop_proposals to service_role;

create or replace function public.ywi_route_distance_km(
  p_lat1 numeric,p_lon1 numeric,p_lat2 numeric,p_lon2 numeric
)
returns numeric
language sql
immutable
security invoker
set search_path=public
as $$
  select case
    when p_lat1 is null or p_lon1 is null or p_lat2 is null or p_lon2 is null then null
    else round((
      6371 * 2 * asin(sqrt(
        power(sin(radians((p_lat2-p_lat1)::double precision)/2),2) +
        cos(radians(p_lat1::double precision))*cos(radians(p_lat2::double precision))*
        power(sin(radians((p_lon2-p_lon1)::double precision)/2),2)
      ))
    )::numeric,2)
  end;
$$;
revoke all on function public.ywi_route_distance_km(numeric,numeric,numeric,numeric) from public,anon,authenticated;
grant execute on function public.ywi_route_distance_km(numeric,numeric,numeric,numeric) to service_role;

create or replace view public.v_route_territory_directory
with (security_invoker=true)
as
select
  t.*,sa.name as service_area_name,p.full_name as owner_name,c.crew_name as owner_crew_name,
  coalesce(s.site_count,0)::int as site_count,
  coalesce(r.route_count,0)::int as route_count
from public.route_territories t
left join public.service_areas sa on sa.id=t.service_area_id
left join public.profiles p on p.id=t.owner_profile_id
left join public.crews c on c.id=t.owner_crew_id
left join lateral (
  select count(*) filter(where x.is_active)::int as site_count
  from public.route_territory_sites x where x.territory_id=t.id
) s on true
left join lateral (
  select count(*) filter(where rr.is_active)::int as route_count
  from public.routes rr where rr.territory_id=t.id
) r on true;
revoke all on table public.v_route_territory_directory from public,anon,authenticated;
grant select on table public.v_route_territory_directory to service_role;

create or replace view public.v_route_territory_site_directory
with (security_invoker=true)
as
select
  x.*,t.territory_code,t.territory_name,t.season_context,
  cs.client_id,cs.site_code,cs.site_name,cs.service_address,cs.city,cs.latitude,cs.longitude,
  coalesce(cl.display_name,cl.legal_name) as client_name,
  r.route_code as preferred_route_code,r.name as preferred_route_name
from public.route_territory_sites x
join public.route_territories t on t.id=x.territory_id
join public.client_sites cs on cs.id=x.client_site_id
join public.clients cl on cl.id=cs.client_id
left join public.routes r on r.id=x.preferred_route_id;
revoke all on table public.v_route_territory_site_directory from public,anon,authenticated;
grant select on table public.v_route_territory_site_directory to service_role;

create or replace view public.v_route_planning_directory
with (security_invoker=true)
as
select
  r.id as route_id,r.route_code,r.name as route_name,r.route_type,r.day_of_week,r.service_area_id,sa.name as service_area_name,
  r.territory_id,t.territory_code,t.territory_name,r.season_context,r.default_crew_id,c.crew_name as default_crew_name,
  r.daily_capacity_minutes,r.service_priority,r.storm_event_capable,r.default_equipment_requirements,r.optimization_notes,r.is_active,
  coalesce(rs.stop_count,0)::int as canonical_stop_count,
  coalesce(rs.estimated_service_minutes,0)::int as canonical_service_minutes,
  'public.dispatch_schedule_items'::text as dispatch_authority,
  'optimization_is_advisory'::text as optimization_boundary
from public.routes r
left join public.service_areas sa on sa.id=r.service_area_id
left join public.route_territories t on t.id=r.territory_id
left join public.crews c on c.id=r.default_crew_id
left join lateral (
  select count(*) filter(where s.is_active)::int as stop_count,
    coalesce(sum(s.planned_duration_minutes) filter(where s.is_active),0)::int as estimated_service_minutes
  from public.route_stops s where s.route_id=r.id
) rs on true;
revoke all on table public.v_route_planning_directory from public,anon,authenticated;
grant select on table public.v_route_planning_directory to service_role;

create or replace view public.v_route_optimization_run_directory
with (security_invoker=true)
as
select
  o.*,r.route_code,r.name as route_name,r.route_type,r.day_of_week,
  t.territory_code,t.territory_name,c.crew_name as default_crew_name,
  case
    when o.capacity_minutes is null then 'capacity_not_set'
    when o.proposed_service_minutes+o.proposed_travel_minutes > o.capacity_minutes then 'over_capacity'
    else 'within_capacity'
  end as capacity_status,
  'advisory_only_operator_dispatch_required'::text as dispatch_application_status
from public.route_optimization_runs o
join public.routes r on r.id=o.route_id
left join public.route_territories t on t.id=o.territory_id
left join public.crews c on c.id=r.default_crew_id;
revoke all on table public.v_route_optimization_run_directory from public,anon,authenticated;
grant select on table public.v_route_optimization_run_directory to service_role;

create or replace view public.v_route_optimization_stop_directory
with (security_invoker=true)
as
select
  p.*,o.run_code,o.service_date,o.season_context,o.run_status,o.storm_event_active,o.storm_event_key,
  cs.site_code,cs.site_name,cs.service_address,cs.city,coalesce(cl.display_name,cl.legal_name) as client_name,
  a.agreement_code,a.service_name,a.service_program_type,
  d.schedule_status as dispatch_schedule_status,d.scheduled_start as dispatch_scheduled_start,d.scheduled_end as dispatch_scheduled_end,
  'proposal_only'::text as authority_state
from public.route_optimization_stop_proposals p
join public.route_optimization_runs o on o.id=p.run_id
join public.client_sites cs on cs.id=p.client_site_id
join public.clients cl on cl.id=cs.client_id
left join public.recurring_service_agreements a on a.id=p.recurring_service_agreement_id
left join public.dispatch_schedule_items d on d.id=p.dispatch_schedule_item_id;
revoke all on table public.v_route_optimization_stop_directory from public,anon,authenticated;
grant select on table public.v_route_optimization_stop_directory to service_role;

create or replace function public.ywi_rpc_route_territory_save(p_payload jsonb,p_actor_profile_id uuid)
returns public.route_territories
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_id uuid := nullif(p_payload->>'id','')::uuid;
  v_name text := nullif(btrim(p_payload->>'territory_name'),'');
  v_season text := lower(coalesce(nullif(p_payload->>'season_context',''),'four_season'));
  v_status text := lower(coalesce(nullif(p_payload->>'territory_status',''),'active'));
  v_route_id uuid := nullif(p_payload->>'route_id','')::uuid;
  v_row public.route_territories;
begin
  if v_name is null then raise exception 'Territory name is required.' using errcode='23514'; end if;
  if v_season not in ('spring_summer','fall','winter','four_season') then raise exception 'Unsupported season context.' using errcode='23514'; end if;
  if v_status not in ('active','inactive','archived') then raise exception 'Unsupported territory status.' using errcode='23514'; end if;

  if v_id is null then
    insert into public.route_territories(
      territory_code,territory_name,service_area_id,season_context,territory_status,owner_profile_id,owner_crew_id,
      centre_latitude,centre_longitude,radius_km,notes,created_by_profile_id,updated_by_profile_id
    ) values(
      coalesce(nullif(upper(btrim(p_payload->>'territory_code')),''),'TERR-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
      v_name,nullif(p_payload->>'service_area_id','')::uuid,v_season,v_status,
      nullif(p_payload->>'owner_profile_id','')::uuid,nullif(p_payload->>'owner_crew_id','')::uuid,
      nullif(p_payload->>'centre_latitude','')::numeric,nullif(p_payload->>'centre_longitude','')::numeric,
      nullif(p_payload->>'radius_km','')::numeric,nullif(btrim(p_payload->>'notes'),''),
      p_actor_profile_id,p_actor_profile_id
    ) returning * into v_row;
  else
    update public.route_territories t set
      territory_name=v_name,
      service_area_id=case when p_payload?'service_area_id' then nullif(p_payload->>'service_area_id','')::uuid else t.service_area_id end,
      season_context=v_season,territory_status=v_status,
      owner_profile_id=case when p_payload?'owner_profile_id' then nullif(p_payload->>'owner_profile_id','')::uuid else t.owner_profile_id end,
      owner_crew_id=case when p_payload?'owner_crew_id' then nullif(p_payload->>'owner_crew_id','')::uuid else t.owner_crew_id end,
      centre_latitude=case when p_payload?'centre_latitude' then nullif(p_payload->>'centre_latitude','')::numeric else t.centre_latitude end,
      centre_longitude=case when p_payload?'centre_longitude' then nullif(p_payload->>'centre_longitude','')::numeric else t.centre_longitude end,
      radius_km=case when p_payload?'radius_km' then nullif(p_payload->>'radius_km','')::numeric else t.radius_km end,
      notes=case when p_payload?'notes' then nullif(btrim(p_payload->>'notes'),'') else t.notes end,
      updated_by_profile_id=p_actor_profile_id,updated_at=now()
    where t.id=v_id returning * into v_row;
    if not found then raise exception 'Territory does not exist.' using errcode='23503'; end if;
  end if;

  if v_route_id is not null then
    update public.routes r set
      territory_id=v_row.id,
      season_context=coalesce(nullif(p_payload->>'route_season_context',''),r.season_context),
      default_crew_id=case when p_payload?'route_default_crew_id' then nullif(p_payload->>'route_default_crew_id','')::uuid else r.default_crew_id end,
      daily_capacity_minutes=case when p_payload?'route_capacity_minutes' then nullif(p_payload->>'route_capacity_minutes','')::integer else r.daily_capacity_minutes end,
      service_priority=coalesce(nullif(p_payload->>'route_service_priority',''),r.service_priority),
      storm_event_capable=case when p_payload?'storm_event_capable' then coalesce((p_payload->>'storm_event_capable')::boolean,false) else r.storm_event_capable end,
      default_equipment_requirements=case when p_payload?'default_equipment_requirements' then nullif(btrim(p_payload->>'default_equipment_requirements'),'') else r.default_equipment_requirements end,
      optimization_notes=case when p_payload?'optimization_notes' then nullif(btrim(p_payload->>'optimization_notes'),'') else r.optimization_notes end,
      updated_at=now()
    where r.id=v_route_id;
    if not found then raise exception 'Route does not exist.' using errcode='23503'; end if;
  end if;
  return v_row;
end;
$$;

create or replace function public.ywi_rpc_route_territory_site_save(p_payload jsonb,p_actor_profile_id uuid)
returns public.route_territory_sites
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_territory uuid := nullif(p_payload->>'territory_id','')::uuid;
  v_site uuid := nullif(p_payload->>'client_site_id','')::uuid;
  v_priority text := lower(coalesce(nullif(p_payload->>'service_priority',''),'normal'));
  v_row public.route_territory_sites;
begin
  if v_territory is null or v_site is null then raise exception 'Territory and property are required.' using errcode='23514'; end if;
  if v_priority not in ('low','normal','high','critical') then raise exception 'Unsupported service priority.' using errcode='23514'; end if;
  insert into public.route_territory_sites(
    territory_id,client_site_id,service_priority,preferred_route_id,assignment_note,is_active,created_by_profile_id,updated_by_profile_id
  ) values(
    v_territory,v_site,v_priority,nullif(p_payload->>'preferred_route_id','')::uuid,nullif(btrim(p_payload->>'assignment_note'),''),
    coalesce((p_payload->>'is_active')::boolean,true),p_actor_profile_id,p_actor_profile_id
  )
  on conflict(territory_id,client_site_id) do update set
    service_priority=excluded.service_priority,
    preferred_route_id=excluded.preferred_route_id,
    assignment_note=excluded.assignment_note,
    is_active=excluded.is_active,
    updated_by_profile_id=p_actor_profile_id,
    updated_at=now()
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.ywi_rpc_route_optimization_generate(p_payload jsonb,p_actor_profile_id uuid)
returns public.route_optimization_runs
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_route uuid := nullif(p_payload->>'route_id','')::uuid;
  v_date date := nullif(p_payload->>'service_date','')::date;
  v_goal text := lower(coalesce(nullif(p_payload->>'optimization_goal',''),'travel_efficiency'));
  v_season text;
  v_storm boolean := coalesce((p_payload->>'storm_event_active')::boolean,false);
  v_storm_key text := nullif(btrim(p_payload->>'storm_event_key'),'');
  v_speed numeric := coalesce(nullif(p_payload->>'assumed_average_speed_kph','')::numeric,35);
  v_route_row public.routes;
  v_territory public.route_territories;
  v_run public.route_optimization_runs;
begin
  if v_route is null or v_date is null then raise exception 'Route and service date are required.' using errcode='23514'; end if;
  if v_goal not in ('travel_efficiency','capacity_balance','time_windows','service_priority','storm_priority') then
    raise exception 'Unsupported optimization goal.' using errcode='23514';
  end if;
  if v_speed<5 or v_speed>120 then raise exception 'Average speed must be between 5 and 120 km/h.' using errcode='23514'; end if;

  select * into v_route_row from public.routes where id=v_route and is_active for share;
  if not found then raise exception 'Active route does not exist.' using errcode='23503'; end if;
  if v_route_row.territory_id is not null then
    select * into v_territory from public.route_territories where id=v_route_row.territory_id;
  end if;
  v_season := coalesce(nullif(p_payload->>'season_context',''),v_route_row.season_context,'four_season');
  if v_season not in ('spring_summer','fall','winter','four_season') then raise exception 'Unsupported season context.' using errcode='23514'; end if;
  if v_storm and v_season<>'winter' then raise exception 'Storm-event activation is reserved for winter routing context.' using errcode='23514'; end if;
  if v_storm and not coalesce(v_route_row.storm_event_capable,false) then raise exception 'This route is not marked storm-event capable.' using errcode='23514'; end if;

  update public.route_optimization_runs
  set run_status='superseded',updated_at=now()
  where route_id=v_route and service_date=v_date and run_status in ('generated','reviewed');

  insert into public.route_optimization_runs(
    route_id,territory_id,service_date,season_context,optimization_goal,run_status,storm_event_active,storm_event_key,
    service_priority_context,assumed_average_speed_kph,capacity_minutes,proposal_note,created_by_profile_id
  ) values(
    v_route,v_route_row.territory_id,v_date,v_season,v_goal,'generated',v_storm,v_storm_key,
    case when v_storm then 'critical' else v_route_row.service_priority end,v_speed,v_route_row.daily_capacity_minutes,
    'Advisory route proposal only. Operators retain dispatch authority.',p_actor_profile_id
  ) returning * into v_run;

  with candidates as (
    select
      rs.id as route_stop_id,rs.client_site_id,rs.stop_order as current_order,
      coalesce(ts.service_priority,v_route_row.service_priority,'normal') as service_priority,
      coalesce(rs.planned_duration_minutes,a.visit_estimated_minutes) as estimated_service_minutes,
      a.id as agreement_id,a.service_window_start,a.service_window_end,a.recurrence_frequency,
      cs.latitude,cs.longitude,
      public.ywi_route_distance_km(v_territory.centre_latitude,v_territory.centre_longitude,cs.latitude,cs.longitude) as distance_km,
      d.id as dispatch_id,
      case
        when cs.latitude is null or cs.longitude is null then 'missing_coordinates'
        when coalesce(rs.planned_duration_minutes,a.visit_estimated_minutes) is null then 'missing_duration'
        when a.service_window_start is null and a.service_window_end is null then 'missing_window'
        else 'complete'
      end as data_quality
    from public.route_stops rs
    join public.client_sites cs on cs.id=rs.client_site_id
    left join public.route_territory_sites ts
      on ts.territory_id=v_route_row.territory_id and ts.client_site_id=rs.client_site_id and ts.is_active
    left join lateral (
      select a.*
      from public.recurring_service_agreements a
      where a.client_site_id=rs.client_site_id
        and a.agreement_status in ('active','paused')
        and (a.route_id=v_route or a.route_id is null)
      order by (a.route_id=v_route) desc,a.updated_at desc
      limit 1
    ) a on true
    left join lateral (
      select dd.id
      from public.dispatch_schedule_items dd
      where dd.route_id=v_route
        and coalesce(dd.client_site_id,(select wo.client_site_id from public.work_orders wo where wo.id=dd.work_order_id))=rs.client_site_id
        and dd.scheduled_start::date=v_date
        and dd.schedule_status not in ('cancelled','superseded')
      order by dd.scheduled_start
      limit 1
    ) d on true
    where rs.route_id=v_route and rs.is_active and cs.is_active
      and (
        v_route_row.territory_id is null
        or exists(select 1 from public.route_territory_sites x where x.territory_id=v_route_row.territory_id and x.client_site_id=rs.client_site_id and x.is_active)
        or not exists(select 1 from public.route_territory_sites x where x.territory_id=v_route_row.territory_id and x.is_active)
      )
  ), ranked as (
    select c.*,
      row_number() over(order by
        case c.service_priority when 'critical' then 1 when 'high' then 2 when 'normal' then 3 else 4 end,
        case when v_goal='time_windows' then c.service_window_start end nulls last,
        case when c.distance_km is null then 1 else 0 end,
        c.distance_km nulls last,
        c.current_order
      )::int as proposed_order
    from candidates c
  )
  insert into public.route_optimization_stop_proposals(
    run_id,route_stop_id,client_site_id,recurring_service_agreement_id,dispatch_schedule_item_id,current_order,proposed_order,
    service_priority,estimated_service_minutes,proximity_travel_minutes_estimate,distance_from_territory_centre_km,
    service_window_start,service_window_end,recurrence_frequency,required_equipment_summary,latitude,longitude,proposal_reason,data_quality
  )
  select
    v_run.id,c.route_stop_id,c.client_site_id,c.agreement_id,c.dispatch_id,c.current_order,c.proposed_order,c.service_priority,
    c.estimated_service_minutes,
    case when c.distance_km is null then 0 else greatest(0,round((c.distance_km/v_speed)*60)::int) end,
    c.distance_km,c.service_window_start,c.service_window_end,c.recurrence_frequency,
    v_route_row.default_equipment_requirements,c.latitude,c.longitude,
    case
      when v_storm then 'Winter storm-event proposal: service priority first, then available proximity evidence.'
      when v_goal='time_windows' then 'Time-window priority followed by proximity evidence.'
      when v_goal='capacity_balance' then 'Capacity-aware review order using service priority and proximity evidence.'
      else 'Service priority followed by proximity evidence from the territory centre.'
    end,
    c.data_quality
  from ranked c;

  update public.route_optimization_runs o set
    proposed_stop_count=x.stop_count,
    proposed_service_minutes=x.service_minutes,
    proposed_travel_minutes=x.travel_minutes,
    updated_at=now()
  from (
    select count(*)::int as stop_count,
      coalesce(sum(estimated_service_minutes),0)::int as service_minutes,
      coalesce(sum(proximity_travel_minutes_estimate),0)::int as travel_minutes
    from public.route_optimization_stop_proposals where run_id=v_run.id
  ) x
  where o.id=v_run.id
  returning o.* into v_run;

  return v_run;
end;
$$;

create or replace function public.ywi_rpc_route_optimization_decision(p_payload jsonb,p_actor_profile_id uuid)
returns public.route_optimization_runs
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_id uuid := nullif(p_payload->>'id','')::uuid;
  v_status text := lower(coalesce(nullif(p_payload->>'run_status',''),'reviewed'));
  v_note text := nullif(btrim(p_payload->>'decision_note'),'');
  v_row public.route_optimization_runs;
begin
  if v_id is null then raise exception 'Optimization run id is required.' using errcode='23514'; end if;
  if v_status not in ('reviewed','accepted','rejected') then raise exception 'Decision must be reviewed, accepted or rejected.' using errcode='23514'; end if;
  update public.route_optimization_runs o set
    run_status=v_status,decision_note=v_note,decided_by_profile_id=p_actor_profile_id,decided_at=now(),updated_at=now()
  where o.id=v_id and o.run_status in ('generated','reviewed','accepted')
  returning * into v_row;
  if not found then raise exception 'Optimization run is unavailable for decision.' using errcode='23503'; end if;
  return v_row;
end;
$$;

revoke all on function public.ywi_rpc_route_territory_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_route_territory_site_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_route_optimization_generate(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_route_optimization_decision(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_route_territory_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_route_territory_site_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_route_optimization_generate(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_route_optimization_decision(jsonb,uuid) to service_role;

insert into public.app_module_write_contracts(
  action_key,owner_module,minimum_access,boundary_mode,domain_key,event_key,cross_module_event,is_enabled,description
) values
  ('route_territory_save','jobs','approve','write','route_optimization','jobs.route.territory_saved',false,true,'Manage territory ownership and explicit route planning settings without scheduling work.'),
  ('route_territory_site_save','jobs','approve','write','route_optimization','jobs.route.territory_site_saved',false,true,'Assign canonical properties to a route territory with service priority metadata.'),
  ('route_optimization_generate','jobs','approve','write','route_optimization','jobs.route.optimization_generated',false,true,'Generate an advisory route-order proposal from canonical route/property/service-plan evidence.'),
  ('route_optimization_decision','jobs','approve','write','route_optimization','jobs.route.optimization_decided',false,true,'Record operator review/acceptance/rejection of an advisory proposal; does not mutate dispatch.')
on conflict(action_key) do update set
  owner_module=excluded.owner_module,minimum_access=excluded.minimum_access,boundary_mode=excluded.boundary_mode,
  domain_key=excluded.domain_key,event_key=excluded.event_key,cross_module_event=excluded.cross_module_event,
  is_enabled=excluded.is_enabled,description=excluded.description,updated_at=now();

create or replace function public.ywi_module_write_boundary_security_assertions()
returns table(assertion_key text,assertion_status text,details text)
language sql stable security invoker set search_path=public as $$
  select 'operations_action_contract_count',
    case when (select count(*) from public.app_module_write_contracts where is_enabled)=66 then 'passed' else 'failed' end,
    'Exactly 66 explicitly handled operations-manage actions have enabled write-boundary contracts.'
  union all
  select 'cross_module_events_named',
    case when not exists(select 1 from public.app_module_write_contracts where is_enabled and cross_module_event and event_key is null) then 'passed' else 'failed' end,
    'Every declared cross-module effect has a stable event key.'
  union all
  select 'manual_deposit_mutation_disabled',
    case when exists(select 1 from public.app_module_write_contracts where action_key='deposit_status_update' and owner_module='finance' and boundary_mode='disabled' and is_enabled) then 'passed' else 'failed' end,
    'Hosted payment truth cannot be manually changed through operations-manage.'
  union all
  select 'route_optimization_jobs_boundary',
    case when (select count(*) from public.app_module_write_contracts where action_key in ('route_territory_save','route_territory_site_save','route_optimization_generate','route_optimization_decision')
      and owner_module='jobs' and minimum_access='approve' and boundary_mode='write' and is_enabled)=4 then 'passed' else 'failed' end,
    'Build 341 routing writes are explicit Jobs-approve contracts.'
  union all
  select 'boundary_control_plane_private',
    case when not exists(select 1 from information_schema.table_privileges where table_schema='public'
      and table_name in ('app_module_write_contracts','module_boundary_events','v_module_boundary_event_contract_status','operations_attention_states')
      and grantee in ('anon','authenticated','PUBLIC')) then 'passed' else 'failed' end,
    'Boundary contracts, events and attention state remain private server control-plane data.';
$$;
revoke all on function public.ywi_module_write_boundary_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_module_write_boundary_security_assertions() to service_role;

create or replace function public.ywi_route_optimization_security_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql stable security invoker set search_path=public as $$
  select 'canonical_route_dispatch_authority_preserved',
    case when to_regclass('public.routes') is not null and to_regclass('public.route_stops') is not null and to_regclass('public.dispatch_schedule_items') is not null
    then 'passed' else 'failed' end,
    'Build 341 reuses canonical route structure and dispatch authority.'
  union all
  select 'optimization_evidence_private',
    case when not exists(select 1 from information_schema.table_privileges where table_schema='public'
      and table_name in ('route_territories','route_territory_sites','route_optimization_runs','route_optimization_stop_proposals')
      and grantee in ('anon','authenticated','PUBLIC')) then 'passed' else 'failed' end,
    'Territory and optimization evidence is private server-side operational data.'
  union all
  select 'optimization_decision_does_not_dispatch',
    case when position('dispatch_schedule_items' in pg_get_functiondef('public.ywi_rpc_route_optimization_decision(jsonb,uuid)'::regprocedure))=0
      and position('route_stops' in pg_get_functiondef('public.ywi_rpc_route_optimization_decision(jsonb,uuid)'::regprocedure))=0
    then 'passed' else 'failed' end,
    'Accept/reject records operator judgment only; it cannot rewrite canonical dispatch or route stops.'
  union all
  select 'winter_storm_context_explicit',
    case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='route_optimization_runs' and column_name='storm_event_active')
      and exists(select 1 from information_schema.columns where table_schema='public' and table_name='routes' and column_name='storm_event_capable')
    then 'passed' else 'failed' end,
    'Winter storm-event activation and route capability are explicit, operator-controlled context.';
$$;
revoke all on function public.ywi_route_optimization_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_route_optimization_security_assertions() to service_role;

insert into public.app_schema_versions(schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label)
values(
  229,'route_optimization_territory_management',
  'Build 341 adds territory ownership and advisory route-order optimization around canonical routes, properties, recurring plans and dispatch.',
  'applied',now(),'schema229',
  'Four-season Ontario routing supports mowing/landscaping, fall cleanup and winter storm-event snow routes while operators retain dispatch authority.',
  '229_route_optimization_territory_management.sql','schema229'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true) as
select 229 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)=229 then 'current'
       when coalesce(max(schema_version) filter(where status='applied'),0)>229 then 'ahead' else 'drift' end as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)=229 then 'Live database matches the repository schema marker.'
       when coalesce(max(schema_version) filter(where status='applied'),0)>229 then 'Live database is ahead of the repository schema marker.'
       else 'Live database is behind the repository schema marker.' end as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
