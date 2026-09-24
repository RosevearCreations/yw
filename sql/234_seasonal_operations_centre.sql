begin;

-- Schema 234 — Build 346 Seasonal Operations Centre
-- Coordinates the existing recurring-service, workforce, equipment, materials, route and workability authorities.
-- Winter snow-clearing/removal is a core operating season and cannot be marked optional here.

create table if not exists public.seasonal_operations_cycles (
  id uuid primary key default gen_random_uuid(),
  cycle_code text not null unique default ('SEAS-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
  season_year integer not null,
  season_context text not null,
  cycle_name text not null,
  cycle_status text not null default 'planning',
  operating_priority text not null default 'core',
  start_date date not null,
  end_date date not null,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  operations_note text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seasonal_operations_cycles_year_chk check (season_year between 2020 and 2100),
  constraint seasonal_operations_cycles_season_chk check (season_context in ('spring_summer','fall','winter','four_season')),
  constraint seasonal_operations_cycles_status_chk check (cycle_status in ('planning','readiness','ready','active','closeout','complete','archived')),
  constraint seasonal_operations_cycles_priority_chk check (operating_priority in ('core','supporting')),
  constraint seasonal_operations_cycles_winter_core_chk check (season_context<>'winter' or operating_priority='core'),
  constraint seasonal_operations_cycles_dates_chk check (end_date>=start_date),
  constraint seasonal_operations_cycles_uk unique(season_year,season_context)
);

create table if not exists public.seasonal_operations_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  season_context text not null,
  item_key text not null,
  category text not null,
  item_label text not null,
  guidance text,
  default_due_offset_days integer not null default 0,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seasonal_ops_checklist_template_season_chk check (season_context in ('spring_summer','fall','winter','four_season')),
  constraint seasonal_ops_checklist_template_category_chk check (category in ('customer_rollover','staffing','equipment','materials','routes','workability','safety','communications','operations')),
  constraint seasonal_ops_checklist_template_sort_chk check (sort_order between 0 and 10000),
  constraint seasonal_ops_checklist_template_uk unique(season_context,item_key)
);

create table if not exists public.seasonal_operations_checklist_items (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.seasonal_operations_cycles(id) on delete cascade,
  item_key text not null,
  category text not null,
  item_label text not null,
  item_status text not null default 'pending',
  due_date date,
  canonical_source text,
  canonical_entity_id text,
  item_note text,
  completed_by_profile_id uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seasonal_ops_checklist_category_chk check (category in ('customer_rollover','staffing','equipment','materials','routes','workability','safety','communications','operations')),
  constraint seasonal_ops_checklist_status_chk check (item_status in ('pending','ready','blocked','not_applicable','complete')),
  constraint seasonal_ops_checklist_complete_chk check ((item_status='complete' and completed_at is not null) or item_status<>'complete'),
  constraint seasonal_ops_checklist_uk unique(cycle_id,item_key)
);

create table if not exists public.seasonal_operations_readiness_reviews (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.seasonal_operations_cycles(id) on delete cascade,
  readiness_type text not null,
  readiness_status text not null default 'pending',
  recurring_service_agreement_id uuid references public.recurring_service_agreements(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  crew_id uuid references public.crews(id) on delete set null,
  equipment_item_id bigint references public.equipment_items(id) on delete set null,
  material_id uuid references public.materials_catalog(id) on delete set null,
  route_id uuid references public.routes(id) on delete set null,
  entity_label text,
  review_note text,
  next_action text,
  target_date date,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seasonal_ops_readiness_type_chk check (readiness_type in ('customer_rollover','staffing','equipment','material','route','safety','communications','general')),
  constraint seasonal_ops_readiness_status_chk check (readiness_status in ('pending','ready','monitor','blocked','not_applicable')),
  constraint seasonal_ops_readiness_single_ref_chk check (
    num_nonnulls(recurring_service_agreement_id,profile_id,crew_id,equipment_item_id,material_id,route_id)<=1
  )
);

create table if not exists public.seasonal_operations_rollover_decisions (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.seasonal_operations_cycles(id) on delete cascade,
  recurring_service_agreement_id uuid not null references public.recurring_service_agreements(id) on delete cascade,
  rollover_state text not null default 'review',
  effective_start_date date,
  decision_note text,
  decided_by_profile_id uuid references public.profiles(id) on delete set null,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seasonal_ops_rollover_state_chk check (rollover_state in ('review','continue','hold','end','renewal_contact_needed')),
  constraint seasonal_ops_rollover_uk unique(cycle_id,recurring_service_agreement_id)
);

create table if not exists public.seasonal_storm_events (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.seasonal_operations_cycles(id) on delete cascade,
  storm_code text not null unique default ('STORM-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
  storm_name text not null,
  storm_status text not null default 'watch',
  planned_start timestamptz,
  planned_end timestamptz,
  workability_observation_id uuid references public.workability_observations(id) on delete set null,
  activation_note text,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seasonal_storm_events_status_chk check (storm_status in ('watch','ready','active','paused','complete','cancelled')),
  constraint seasonal_storm_events_window_chk check (planned_end is null or planned_start is null or planned_end>planned_start)
);

create table if not exists public.seasonal_storm_route_activations (
  id uuid primary key default gen_random_uuid(),
  storm_event_id uuid not null references public.seasonal_storm_events(id) on delete cascade,
  route_id uuid not null references public.routes(id) on delete cascade,
  crew_id uuid references public.crews(id) on delete set null,
  activation_status text not null default 'staged',
  service_priority text not null default 'high',
  activation_note text,
  activated_by_profile_id uuid references public.profiles(id) on delete set null,
  activated_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seasonal_storm_route_status_chk check (activation_status in ('staged','active','paused','complete','cancelled')),
  constraint seasonal_storm_route_priority_chk check (service_priority in ('normal','high','critical')),
  constraint seasonal_storm_route_active_chk check ((activation_status='active' and activated_at is not null) or activation_status<>'active'),
  constraint seasonal_storm_route_complete_chk check ((activation_status='complete' and completed_at is not null) or activation_status<>'complete'),
  constraint seasonal_storm_route_uk unique(storm_event_id,route_id)
);

create index if not exists seasonal_operations_cycles_status_idx on public.seasonal_operations_cycles(season_year,season_context,cycle_status);
create index if not exists seasonal_ops_checklist_cycle_idx on public.seasonal_operations_checklist_items(cycle_id,item_status,category);
create index if not exists seasonal_ops_readiness_cycle_idx on public.seasonal_operations_readiness_reviews(cycle_id,readiness_status,readiness_type);
create index if not exists seasonal_ops_rollover_cycle_idx on public.seasonal_operations_rollover_decisions(cycle_id,rollover_state);
create index if not exists seasonal_ops_rollover_agreement_idx on public.seasonal_operations_rollover_decisions(recurring_service_agreement_id,decided_at desc);
create index if not exists seasonal_storm_events_cycle_idx on public.seasonal_storm_events(cycle_id,storm_status,planned_start);
create index if not exists seasonal_storm_route_event_idx on public.seasonal_storm_route_activations(storm_event_id,activation_status);
create index if not exists seasonal_storm_route_route_idx on public.seasonal_storm_route_activations(route_id,created_at desc);

alter table public.seasonal_operations_cycles enable row level security;
alter table public.seasonal_operations_checklist_templates enable row level security;
alter table public.seasonal_operations_checklist_items enable row level security;
alter table public.seasonal_operations_readiness_reviews enable row level security;
alter table public.seasonal_operations_rollover_decisions enable row level security;
alter table public.seasonal_storm_events enable row level security;
alter table public.seasonal_storm_route_activations enable row level security;

revoke all on table public.seasonal_operations_cycles from public,anon,authenticated;
revoke all on table public.seasonal_operations_checklist_templates from public,anon,authenticated;
revoke all on table public.seasonal_operations_checklist_items from public,anon,authenticated;
revoke all on table public.seasonal_operations_readiness_reviews from public,anon,authenticated;
revoke all on table public.seasonal_operations_rollover_decisions from public,anon,authenticated;
revoke all on table public.seasonal_storm_events from public,anon,authenticated;
revoke all on table public.seasonal_storm_route_activations from public,anon,authenticated;

grant select,insert,update,delete on table public.seasonal_operations_cycles to service_role;
grant select,insert,update,delete on table public.seasonal_operations_checklist_templates to service_role;
grant select,insert,update,delete on table public.seasonal_operations_checklist_items to service_role;
grant select,insert,update,delete on table public.seasonal_operations_readiness_reviews to service_role;
grant select,insert,update,delete on table public.seasonal_operations_rollover_decisions to service_role;
grant select,insert,update,delete on table public.seasonal_storm_events to service_role;
grant select,insert,update,delete on table public.seasonal_storm_route_activations to service_role;

insert into public.seasonal_operations_checklist_templates(season_context,item_key,category,item_label,guidance,default_due_offset_days,sort_order) values
('spring_summer','customer_rollover','customer_rollover','Review recurring customer rollover','Confirm continuing services, holds, ended programs and customer contact needs without silently changing canonical agreements.',-30,10),
('spring_summer','staffing_ready','staffing','Confirm spring/summer staffing and crew coverage','Use the existing workforce/crew authority; record readiness and gaps here.',-21,20),
('spring_summer','equipment_conversion','equipment','Complete spring equipment setup and service','Review preventive maintenance, blades, belts, batteries, tires and preseason setup.',-21,30),
('spring_summer','materials_ready','materials','Confirm spring/summer materials and consumables','Review canonical stock and purchasing needs before the operating cycle begins.',-14,40),
('spring_summer','routes_ready','routes','Review mowing/landscaping territories and routes','Use canonical route planning and dispatch for actual route changes.',-14,50),
('spring_summer','workability_ready','workability','Review seasonal weather/workability rules','Confirm rain, saturated ground, heat, wind and lightning guidance is current.',-7,60),
('spring_summer','safety_ready','safety','Review seasonal safety readiness','Confirm required training, PPE and job-hazard expectations.',-7,70),
('spring_summer','operations_launch','operations','Open spring/summer operations','Confirm unresolved blockers are visible before activation.',0,80),

('fall','customer_rollover','customer_rollover','Review fall cleanup customer rollover','Identify active fall cleanup/leaf collection customers and contact gaps.',-30,10),
('fall','staffing_ready','staffing','Confirm fall cleanup staffing and crew coverage','Use existing workforce/crew authority; record readiness and gaps here.',-21,20),
('fall','equipment_conversion','equipment','Prepare blowers, vacuums, trailers and fall equipment','Use preventive maintenance/service authority for actual maintenance work.',-21,30),
('fall','materials_ready','materials','Confirm bags, disposal and fall consumables','Review canonical materials stock and disposal needs.',-14,40),
('fall','routes_ready','routes','Review fall cleanup territories and routes','Use canonical route planning/dispatch for actual route changes.',-14,50),
('fall','workability_ready','workability','Review fall weather/workability controls','Confirm rain, wind, temperature and visibility guidance.',-7,60),
('fall','safety_ready','safety','Review fall safety readiness','Confirm PPE, traffic/site hazards and training coverage.',-7,70),
('fall','operations_launch','operations','Open fall cleanup operations','Confirm outstanding blockers before activation.',0,80),

('winter','customer_rollover','customer_rollover','Review winter snow-service customer rollover','Confirm winter recurring customers, holds and contact needs. Winter service is a core season.',-45,10),
('winter','staffing_ready','staffing','Confirm winter staffing, on-call and storm coverage','Record crew/person readiness without replacing workforce authority.',-30,20),
('winter','equipment_conversion','equipment','Complete winter equipment conversion and service','Review plows, blowers, spreaders, tires, batteries, lighting and preventive maintenance.',-30,30),
('winter','materials_ready','materials','Confirm salt, de-icer and traction-material stock','Use canonical materials stock; record shortages and next actions here.',-21,40),
('winter','routes_ready','routes','Confirm storm-capable routes and priorities','Only routes marked storm-event capable in canonical route planning may activate.',-21,50),
('winter','workability_ready','workability','Review winter workability and weather rules','Confirm snowfall, freezing rain/ice, visibility, cold and wind controls.',-14,60),
('winter','communications_ready','communications','Confirm storm communications and customer notification readiness','Coordinate notification readiness without sending hidden customer messages.',-7,70),
('winter','safety_ready','safety','Review winter safety readiness','Confirm winter PPE, slip/ice hazards, vehicle/equipment and training controls.',-7,80),
('winter','operations_launch','operations','Open winter operations','Winter snow-clearing/removal is core operations, not optional.',0,90),

('four_season','customer_rollover','customer_rollover','Review recurring customer continuity','Coordinate rollover reviews while canonical recurring agreements remain authoritative.',-30,10),
('four_season','staffing_ready','staffing','Confirm four-season staffing readiness','Surface workforce gaps without duplicating employee/crew authority.',-21,20),
('four_season','equipment_ready','equipment','Confirm equipment readiness','Surface preventive-maintenance blockers.',-14,30),
('four_season','materials_ready','materials','Confirm materials readiness','Surface stock blockers from canonical materials control.',-14,40),
('four_season','routes_ready','routes','Confirm route readiness','Surface route/territory blockers from canonical route planning.',-7,50),
('four_season','workability_ready','workability','Confirm workability controls','Surface weather/workability blockers before activation.',-7,60),
('four_season','operations_ready','operations','Confirm seasonal operating readiness','Close or explicitly carry all outstanding blockers.',0,70)
on conflict(season_context,item_key) do update set
  category=excluded.category,item_label=excluded.item_label,guidance=excluded.guidance,
  default_due_offset_days=excluded.default_due_offset_days,sort_order=excluded.sort_order,is_active=true,updated_at=now();

create or replace view public.v_seasonal_operations_cycle_directory
with (security_invoker=true) as
select
  c.*,
  (select count(*) from public.seasonal_operations_checklist_items i where i.cycle_id=c.id)::int as checklist_total,
  (select count(*) from public.seasonal_operations_checklist_items i where i.cycle_id=c.id and i.item_status in ('complete','ready','not_applicable'))::int as checklist_ready,
  (select count(*) from public.seasonal_operations_checklist_items i where i.cycle_id=c.id and i.item_status='blocked')::int as checklist_blocked,
  (select count(*) from public.seasonal_operations_readiness_reviews r where r.cycle_id=c.id and r.readiness_status='blocked')::int as readiness_blocked,
  (select count(*) from public.seasonal_operations_readiness_reviews r where r.cycle_id=c.id and r.readiness_status in ('pending','monitor'))::int as readiness_open,
  (select count(*) from public.seasonal_operations_rollover_decisions d where d.cycle_id=c.id and d.rollover_state in ('review','renewal_contact_needed'))::int as rollover_open,
  (select count(*) from public.seasonal_storm_events s where s.cycle_id=c.id and s.storm_status in ('watch','ready','active','paused'))::int as storm_events_open,
  case when c.season_context='winter' then true else false end as winter_core_season
from public.seasonal_operations_cycles c;

create or replace view public.v_seasonal_operations_readiness_directory
with (security_invoker=true) as
select
  r.*,c.cycle_code,c.season_year,c.season_context,c.cycle_name,c.cycle_status
from public.seasonal_operations_readiness_reviews r
join public.seasonal_operations_cycles c on c.id=r.cycle_id;

create or replace view public.v_seasonal_operations_rollover_directory
with (security_invoker=true) as
select
  d.*,c.cycle_code,c.season_year,c.season_context,c.cycle_name,c.cycle_status
from public.seasonal_operations_rollover_decisions d
join public.seasonal_operations_cycles c on c.id=d.cycle_id;

create or replace view public.v_seasonal_storm_route_directory
with (security_invoker=true) as
select
  a.*,s.cycle_id,s.storm_code,s.storm_name,s.storm_status,s.planned_start,s.planned_end,
  c.season_year,c.season_context,c.cycle_name
from public.seasonal_storm_route_activations a
join public.seasonal_storm_events s on s.id=a.storm_event_id
join public.seasonal_operations_cycles c on c.id=s.cycle_id;

create or replace view public.v_seasonal_operations_outstanding_work
with (security_invoker=true) as
select c.id as cycle_id,'checklist'::text as item_type,i.id::text as item_id,i.category,i.item_status as status,
       i.item_label as label,i.due_date,i.item_note as detail
from public.seasonal_operations_checklist_items i
join public.seasonal_operations_cycles c on c.id=i.cycle_id
where i.item_status in ('pending','blocked')
union all
select c.id,'readiness',r.id::text,r.readiness_type,r.readiness_status,
       coalesce(r.entity_label,r.readiness_type),r.target_date,coalesce(r.next_action,r.review_note)
from public.seasonal_operations_readiness_reviews r
join public.seasonal_operations_cycles c on c.id=r.cycle_id
where r.readiness_status in ('pending','monitor','blocked')
union all
select c.id,'rollover',d.id::text,'customer_rollover',d.rollover_state,
       'Recurring agreement '||d.recurring_service_agreement_id::text,d.effective_start_date,d.decision_note
from public.seasonal_operations_rollover_decisions d
join public.seasonal_operations_cycles c on c.id=d.cycle_id
where d.rollover_state in ('review','hold','renewal_contact_needed')
union all
select c.id,'storm_route',a.id::text,'routes',a.activation_status,
       'Storm route '||a.route_id::text,s.planned_start::date,a.activation_note
from public.seasonal_storm_route_activations a
join public.seasonal_storm_events s on s.id=a.storm_event_id
join public.seasonal_operations_cycles c on c.id=s.cycle_id
where a.activation_status in ('staged','paused');

revoke all on table public.v_seasonal_operations_cycle_directory from public,anon,authenticated;
revoke all on table public.v_seasonal_operations_readiness_directory from public,anon,authenticated;
revoke all on table public.v_seasonal_operations_rollover_directory from public,anon,authenticated;
revoke all on table public.v_seasonal_storm_route_directory from public,anon,authenticated;
revoke all on table public.v_seasonal_operations_outstanding_work from public,anon,authenticated;
grant select on table public.v_seasonal_operations_cycle_directory to service_role;
grant select on table public.v_seasonal_operations_readiness_directory to service_role;
grant select on table public.v_seasonal_operations_rollover_directory to service_role;
grant select on table public.v_seasonal_storm_route_directory to service_role;
grant select on table public.v_seasonal_operations_outstanding_work to service_role;

create or replace function public.ywi_rpc_seasonal_cycle_save(p_payload jsonb,p_actor_profile_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_id uuid:=nullif(p_payload->>'id','')::uuid;
  v_year integer:=coalesce(nullif(p_payload->>'season_year','')::integer,extract(year from current_date)::integer);
  v_season text:=coalesce(nullif(lower(p_payload->>'season_context'),''),'four_season');
  v_status text:=coalesce(nullif(lower(p_payload->>'cycle_status'),''),'planning');
  v_priority text:=coalesce(nullif(lower(p_payload->>'operating_priority'),''),'core');
  v_start date;
  v_end date;
  v_name text;
begin
  if p_actor_profile_id is null then raise exception 'Actor profile is required.'; end if;
  if v_year<2020 or v_year>2100 then raise exception 'Season year is outside the supported range.'; end if;
  if v_season not in ('spring_summer','fall','winter','four_season') then raise exception 'Unsupported season context.'; end if;
  if v_status not in ('planning','readiness','ready','active','closeout','complete','archived') then raise exception 'Unsupported cycle status.'; end if;
  if v_season='winter' then v_priority:='core'; end if;

  v_start:=coalesce(nullif(p_payload->>'start_date','')::date,
    case v_season when 'spring_summer' then make_date(v_year,4,1)
                  when 'fall' then make_date(v_year,9,15)
                  when 'winter' then make_date(v_year,11,1)
                  else make_date(v_year,1,1) end);
  v_end:=coalesce(nullif(p_payload->>'end_date','')::date,
    case v_season when 'spring_summer' then make_date(v_year,9,30)
                  when 'fall' then make_date(v_year,12,15)
                  when 'winter' then make_date(v_year+1,3,31)
                  else make_date(v_year,12,31) end);
  if v_end<v_start then raise exception 'Season end date must be on or after its start date.'; end if;
  v_name:=coalesce(nullif(trim(p_payload->>'cycle_name'),''),
    case v_season when 'spring_summer' then 'Spring / Summer '||v_year
                  when 'fall' then 'Fall Cleanup '||v_year
                  when 'winter' then 'Winter Snow Operations '||v_year||'–'||(v_year+1)
                  else 'Four-Season Operations '||v_year end);

  if v_id is not null then
    update public.seasonal_operations_cycles set
      season_year=v_year,season_context=v_season,cycle_name=v_name,cycle_status=v_status,
      operating_priority=v_priority,start_date=v_start,end_date=v_end,
      owner_profile_id=coalesce(nullif(p_payload->>'owner_profile_id','')::uuid,owner_profile_id),
      operations_note=nullif(trim(p_payload->>'operations_note'),''),
      updated_by_profile_id=p_actor_profile_id,updated_at=now()
    where id=v_id;
    if not found then raise exception 'Seasonal operations cycle was not found.'; end if;
  else
    insert into public.seasonal_operations_cycles(
      season_year,season_context,cycle_name,cycle_status,operating_priority,start_date,end_date,
      owner_profile_id,operations_note,created_by_profile_id,updated_by_profile_id
    ) values(
      v_year,v_season,v_name,v_status,v_priority,v_start,v_end,
      nullif(p_payload->>'owner_profile_id','')::uuid,nullif(trim(p_payload->>'operations_note'),''),
      p_actor_profile_id,p_actor_profile_id
    )
    on conflict(season_year,season_context) do update set
      cycle_name=excluded.cycle_name,cycle_status=excluded.cycle_status,operating_priority=excluded.operating_priority,
      start_date=excluded.start_date,end_date=excluded.end_date,
      owner_profile_id=coalesce(excluded.owner_profile_id,seasonal_operations_cycles.owner_profile_id),
      operations_note=excluded.operations_note,updated_by_profile_id=excluded.updated_by_profile_id,updated_at=now()
    returning id into v_id;
  end if;

  insert into public.seasonal_operations_checklist_items(
    cycle_id,item_key,category,item_label,item_status,due_date,item_note,updated_by_profile_id
  )
  select
    v_id,t.item_key,t.category,t.item_label,'pending',
    v_start+t.default_due_offset_days,
    t.guidance,p_actor_profile_id
  from public.seasonal_operations_checklist_templates t
  where t.is_active and t.season_context=v_season
  on conflict(cycle_id,item_key) do nothing;

  return (select to_jsonb(c) from public.v_seasonal_operations_cycle_directory c where c.id=v_id);
end;
$$;

create or replace function public.ywi_rpc_seasonal_checklist_save(p_payload jsonb,p_actor_profile_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_cycle uuid:=nullif(p_payload->>'cycle_id','')::uuid;
  v_id uuid:=nullif(p_payload->>'id','')::uuid;
  v_key text:=lower(regexp_replace(coalesce(p_payload->>'item_key',''),'[^a-zA-Z0-9]+','_','g'));
  v_status text:=coalesce(nullif(lower(p_payload->>'item_status'),''),'pending');
begin
  if p_actor_profile_id is null then raise exception 'Actor profile is required.'; end if;
  if v_cycle is null or not exists(select 1 from public.seasonal_operations_cycles where id=v_cycle) then raise exception 'Valid seasonal cycle is required.'; end if;
  if v_key='' then raise exception 'Checklist item key is required.'; end if;
  if v_status not in ('pending','ready','blocked','not_applicable','complete') then raise exception 'Unsupported checklist status.'; end if;

  if v_id is not null then
    update public.seasonal_operations_checklist_items set
      item_key=v_key,
      category=coalesce(nullif(lower(p_payload->>'category'),''),category),
      item_label=coalesce(nullif(trim(p_payload->>'item_label'),''),item_label),
      item_status=v_status,
      due_date=coalesce(nullif(p_payload->>'due_date','')::date,due_date),
      canonical_source=nullif(trim(p_payload->>'canonical_source'),''),
      canonical_entity_id=nullif(trim(p_payload->>'canonical_entity_id'),''),
      item_note=nullif(trim(p_payload->>'item_note'),''),
      completed_by_profile_id=case when v_status='complete' then p_actor_profile_id else null end,
      completed_at=case when v_status='complete' then coalesce(completed_at,now()) else null end,
      updated_by_profile_id=p_actor_profile_id,updated_at=now()
    where id=v_id and cycle_id=v_cycle;
    if not found then raise exception 'Seasonal checklist item was not found.'; end if;
  else
    insert into public.seasonal_operations_checklist_items(
      cycle_id,item_key,category,item_label,item_status,due_date,canonical_source,canonical_entity_id,item_note,
      completed_by_profile_id,completed_at,updated_by_profile_id
    ) values(
      v_cycle,v_key,coalesce(nullif(lower(p_payload->>'category'),''),'operations'),
      coalesce(nullif(trim(p_payload->>'item_label'),''),v_key),v_status,
      nullif(p_payload->>'due_date','')::date,nullif(trim(p_payload->>'canonical_source'),''),
      nullif(trim(p_payload->>'canonical_entity_id'),''),nullif(trim(p_payload->>'item_note'),''),
      case when v_status='complete' then p_actor_profile_id else null end,
      case when v_status='complete' then now() else null end,p_actor_profile_id
    )
    on conflict(cycle_id,item_key) do update set
      category=excluded.category,item_label=excluded.item_label,item_status=excluded.item_status,
      due_date=excluded.due_date,canonical_source=excluded.canonical_source,canonical_entity_id=excluded.canonical_entity_id,
      item_note=excluded.item_note,completed_by_profile_id=excluded.completed_by_profile_id,
      completed_at=excluded.completed_at,updated_by_profile_id=excluded.updated_by_profile_id,updated_at=now()
    returning id into v_id;
  end if;
  return (select to_jsonb(i) from public.seasonal_operations_checklist_items i where i.id=v_id);
end;
$$;

create or replace function public.ywi_rpc_seasonal_readiness_save(p_payload jsonb,p_actor_profile_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_id uuid:=nullif(p_payload->>'id','')::uuid;
  v_cycle uuid:=nullif(p_payload->>'cycle_id','')::uuid;
  v_type text:=coalesce(nullif(lower(p_payload->>'readiness_type'),''),'general');
  v_status text:=coalesce(nullif(lower(p_payload->>'readiness_status'),''),'pending');
begin
  if p_actor_profile_id is null then raise exception 'Actor profile is required.'; end if;
  if v_cycle is null or not exists(select 1 from public.seasonal_operations_cycles where id=v_cycle) then raise exception 'Valid seasonal cycle is required.'; end if;
  if v_type not in ('customer_rollover','staffing','equipment','material','route','safety','communications','general') then raise exception 'Unsupported readiness type.'; end if;
  if v_status not in ('pending','ready','monitor','blocked','not_applicable') then raise exception 'Unsupported readiness status.'; end if;

  if v_id is null then
    insert into public.seasonal_operations_readiness_reviews(
      cycle_id,readiness_type,readiness_status,recurring_service_agreement_id,profile_id,crew_id,equipment_item_id,material_id,route_id,
      entity_label,review_note,next_action,target_date,reviewed_by_profile_id
    ) values(
      v_cycle,v_type,v_status,
      nullif(p_payload->>'recurring_service_agreement_id','')::uuid,
      nullif(p_payload->>'profile_id','')::uuid,
      nullif(p_payload->>'crew_id','')::uuid,
      nullif(p_payload->>'equipment_item_id','')::bigint,
      nullif(p_payload->>'material_id','')::uuid,
      nullif(p_payload->>'route_id','')::uuid,
      nullif(trim(p_payload->>'entity_label'),''),nullif(trim(p_payload->>'review_note'),''),
      nullif(trim(p_payload->>'next_action'),''),nullif(p_payload->>'target_date','')::date,p_actor_profile_id
    ) returning id into v_id;
  else
    update public.seasonal_operations_readiness_reviews set
      readiness_type=v_type,readiness_status=v_status,
      recurring_service_agreement_id=nullif(p_payload->>'recurring_service_agreement_id','')::uuid,
      profile_id=nullif(p_payload->>'profile_id','')::uuid,
      crew_id=nullif(p_payload->>'crew_id','')::uuid,
      equipment_item_id=nullif(p_payload->>'equipment_item_id','')::bigint,
      material_id=nullif(p_payload->>'material_id','')::uuid,
      route_id=nullif(p_payload->>'route_id','')::uuid,
      entity_label=nullif(trim(p_payload->>'entity_label'),''),
      review_note=nullif(trim(p_payload->>'review_note'),''),
      next_action=nullif(trim(p_payload->>'next_action'),''),
      target_date=nullif(p_payload->>'target_date','')::date,
      reviewed_by_profile_id=p_actor_profile_id,reviewed_at=now(),updated_at=now()
    where id=v_id and cycle_id=v_cycle;
    if not found then raise exception 'Seasonal readiness review was not found.'; end if;
  end if;
  return (select to_jsonb(r) from public.v_seasonal_operations_readiness_directory r where r.id=v_id);
end;
$$;

create or replace function public.ywi_rpc_seasonal_rollover_save(p_payload jsonb,p_actor_profile_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_cycle uuid:=nullif(p_payload->>'cycle_id','')::uuid;
  v_agreement uuid:=nullif(p_payload->>'recurring_service_agreement_id','')::uuid;
  v_state text:=coalesce(nullif(lower(p_payload->>'rollover_state'),''),'review');
  v_id uuid;
begin
  if p_actor_profile_id is null then raise exception 'Actor profile is required.'; end if;
  if v_cycle is null or not exists(select 1 from public.seasonal_operations_cycles where id=v_cycle) then raise exception 'Valid seasonal cycle is required.'; end if;
  if v_agreement is null or not exists(select 1 from public.recurring_service_agreements where id=v_agreement) then raise exception 'Valid recurring service agreement is required.'; end if;
  if v_state not in ('review','continue','hold','end','renewal_contact_needed') then raise exception 'Unsupported rollover state.'; end if;

  insert into public.seasonal_operations_rollover_decisions(
    cycle_id,recurring_service_agreement_id,rollover_state,effective_start_date,decision_note,decided_by_profile_id
  ) values(
    v_cycle,v_agreement,v_state,nullif(p_payload->>'effective_start_date','')::date,
    nullif(trim(p_payload->>'decision_note'),''),p_actor_profile_id
  )
  on conflict(cycle_id,recurring_service_agreement_id) do update set
    rollover_state=excluded.rollover_state,effective_start_date=excluded.effective_start_date,
    decision_note=excluded.decision_note,decided_by_profile_id=excluded.decided_by_profile_id,decided_at=now(),updated_at=now()
  returning id into v_id;

  return (select to_jsonb(d) from public.v_seasonal_operations_rollover_directory d where d.id=v_id);
end;
$$;

create or replace function public.ywi_rpc_seasonal_storm_event_save(p_payload jsonb,p_actor_profile_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_id uuid:=nullif(p_payload->>'id','')::uuid;
  v_cycle uuid:=nullif(p_payload->>'cycle_id','')::uuid;
  v_status text:=coalesce(nullif(lower(p_payload->>'storm_status'),''),'watch');
  v_season text;
begin
  if p_actor_profile_id is null then raise exception 'Actor profile is required.'; end if;
  select season_context into v_season from public.seasonal_operations_cycles where id=v_cycle;
  if v_season is distinct from 'winter' then raise exception 'Storm activation belongs to the core winter operating cycle.'; end if;
  if v_status not in ('watch','ready','active','paused','complete','cancelled') then raise exception 'Unsupported storm status.'; end if;
  if nullif(trim(p_payload->>'storm_name'),'') is null then raise exception 'Storm event name is required.'; end if;

  if v_id is null then
    insert into public.seasonal_storm_events(
      cycle_id,storm_name,storm_status,planned_start,planned_end,workability_observation_id,
      activation_note,owner_profile_id,created_by_profile_id,updated_by_profile_id
    ) values(
      v_cycle,trim(p_payload->>'storm_name'),v_status,nullif(p_payload->>'planned_start','')::timestamptz,
      nullif(p_payload->>'planned_end','')::timestamptz,nullif(p_payload->>'workability_observation_id','')::uuid,
      nullif(trim(p_payload->>'activation_note'),''),nullif(p_payload->>'owner_profile_id','')::uuid,
      p_actor_profile_id,p_actor_profile_id
    ) returning id into v_id;
  else
    update public.seasonal_storm_events set
      storm_name=trim(p_payload->>'storm_name'),storm_status=v_status,
      planned_start=nullif(p_payload->>'planned_start','')::timestamptz,
      planned_end=nullif(p_payload->>'planned_end','')::timestamptz,
      workability_observation_id=nullif(p_payload->>'workability_observation_id','')::uuid,
      activation_note=nullif(trim(p_payload->>'activation_note'),''),
      owner_profile_id=coalesce(nullif(p_payload->>'owner_profile_id','')::uuid,owner_profile_id),
      updated_by_profile_id=p_actor_profile_id,updated_at=now()
    where id=v_id and cycle_id=v_cycle;
    if not found then raise exception 'Seasonal storm event was not found.'; end if;
  end if;
  return (select to_jsonb(s) from public.seasonal_storm_events s where s.id=v_id);
end;
$$;

create or replace function public.ywi_rpc_seasonal_storm_route_activation_save(p_payload jsonb,p_actor_profile_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_storm uuid:=nullif(p_payload->>'storm_event_id','')::uuid;
  v_route uuid:=nullif(p_payload->>'route_id','')::uuid;
  v_status text:=coalesce(nullif(lower(p_payload->>'activation_status'),''),'staged');
  v_storm_status text;
  v_route_capable boolean;
  v_route_season text;
  v_id uuid;
begin
  if p_actor_profile_id is null then raise exception 'Actor profile is required.'; end if;
  select storm_status into v_storm_status from public.seasonal_storm_events where id=v_storm;
  if v_storm_status is null then raise exception 'Valid storm event is required.'; end if;
  select storm_event_capable,season_context into v_route_capable,v_route_season from public.routes where id=v_route;
  if coalesce(v_route_capable,false)=false or v_route_season not in ('winter','four_season') then
    raise exception 'Route must be winter/four-season and storm-event capable in canonical route planning before activation.';
  end if;
  if v_status not in ('staged','active','paused','complete','cancelled') then raise exception 'Unsupported storm-route activation status.'; end if;
  if v_status='active' and v_storm_status<>'active' then raise exception 'Storm event must be active before a route can be activated.'; end if;

  insert into public.seasonal_storm_route_activations(
    storm_event_id,route_id,crew_id,activation_status,service_priority,activation_note,
    activated_by_profile_id,activated_at,completed_at
  ) values(
    v_storm,v_route,nullif(p_payload->>'crew_id','')::uuid,v_status,
    coalesce(nullif(lower(p_payload->>'service_priority'),''),'high'),
    nullif(trim(p_payload->>'activation_note'),''),p_actor_profile_id,
    case when v_status='active' then now() else null end,
    case when v_status='complete' then now() else null end
  )
  on conflict(storm_event_id,route_id) do update set
    crew_id=excluded.crew_id,activation_status=excluded.activation_status,service_priority=excluded.service_priority,
    activation_note=excluded.activation_note,activated_by_profile_id=excluded.activated_by_profile_id,
    activated_at=case when excluded.activation_status='active' then coalesce(seasonal_storm_route_activations.activated_at,now()) else seasonal_storm_route_activations.activated_at end,
    completed_at=case when excluded.activation_status='complete' then now() else null end,updated_at=now()
  returning id into v_id;

  return (select to_jsonb(a) from public.v_seasonal_storm_route_directory a where a.id=v_id);
end;
$$;

revoke all on function public.ywi_rpc_seasonal_cycle_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_seasonal_checklist_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_seasonal_readiness_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_seasonal_rollover_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_seasonal_storm_event_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_seasonal_storm_route_activation_save(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_seasonal_cycle_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_seasonal_checklist_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_seasonal_readiness_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_seasonal_rollover_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_seasonal_storm_event_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_seasonal_storm_route_activation_save(jsonb,uuid) to service_role;

insert into public.app_module_write_contracts(
  action_key,owner_module,minimum_access,boundary_mode,domain_key,event_key,cross_module_event,is_enabled,description
) values
  ('seasonal_cycle_save','jobs','approve','write','seasonal_operations','jobs.seasonal.cycle_saved',true,true,'Creates/updates a seasonal operating cycle and seeds its readiness checklist.'),
  ('seasonal_checklist_save','jobs','approve','write','seasonal_operations','jobs.seasonal.checklist_saved',false,true,'Records seasonal readiness checklist status without mutating canonical source modules.'),
  ('seasonal_readiness_save','jobs','approve','write','seasonal_operations','jobs.seasonal.readiness_saved',true,true,'Records readiness against canonical customer/workforce/equipment/material/route sources.'),
  ('seasonal_rollover_save','jobs','approve','write','seasonal_operations','jobs.seasonal.rollover_saved',true,true,'Records a recurring-customer rollover decision without changing the canonical agreement.'),
  ('seasonal_storm_event_save','jobs','approve','write','seasonal_operations','jobs.seasonal.storm_saved',true,true,'Creates/updates a winter storm operating event linked to workability evidence when available.'),
  ('seasonal_storm_route_activation_save','jobs','approve','write','seasonal_operations','jobs.seasonal.storm_route_saved',true,true,'Stages/activates only canonical routes already marked winter/four-season and storm-event capable.')
on conflict(action_key) do update set
  owner_module=excluded.owner_module,minimum_access=excluded.minimum_access,boundary_mode=excluded.boundary_mode,
  domain_key=excluded.domain_key,event_key=excluded.event_key,cross_module_event=excluded.cross_module_event,
  is_enabled=excluded.is_enabled,description=excluded.description,updated_at=now();

create or replace function public.ywi_module_write_boundary_security_assertions()
returns table(assertion_key text,assertion_status text,details text)
language sql stable security invoker set search_path=public as $$
  select 'operations_action_contract_count',
    case when (select count(*) from public.app_module_write_contracts where is_enabled)=90 then 'passed' else 'failed' end,
    'Exactly 90 explicitly handled operations-manage actions have enabled write-boundary contracts.'
  union all
  select 'cross_module_events_named',
    case when not exists(select 1 from public.app_module_write_contracts where is_enabled and cross_module_event and event_key is null) then 'passed' else 'failed' end,
    'Every declared cross-module effect has a stable event key.'
  union all
  select 'manual_deposit_mutation_disabled',
    case when exists(select 1 from public.app_module_write_contracts where action_key='deposit_status_update' and owner_module='finance' and boundary_mode='disabled' and is_enabled) then 'passed' else 'failed' end,
    'Hosted payment truth cannot be manually changed through operations-manage.'
  union all
  select 'weather_workability_jobs_boundary',
    case when (select count(*) from public.app_module_write_contracts where action_key in (
      'workability_rule_save','workability_observation_save','workability_decision_save','workability_notification_readiness_save'
    ) and owner_module='jobs' and minimum_access='approve' and boundary_mode='write' and is_enabled)=4 then 'passed' else 'failed' end,
    'Build 342 weather/workability writes remain explicit Jobs-approve contracts.'
  union all
  select 'landscape_material_estimator_jobs_boundary',
    case when (select count(*) from public.app_module_write_contracts where action_key in (
      'landscape_material_estimate_save','landscape_material_actual_use_save'
    ) and owner_module='jobs' and minimum_access='approve' and boundary_mode='write' and is_enabled)=2 then 'passed' else 'failed' end,
    'Build 343 material-estimator writes remain explicit Jobs-approve contracts.'
  union all
  select 'change_orders_extras_jobs_boundary',
    case when (select count(*) from public.app_module_write_contracts where action_key in (
      'change_order_discovery_save','change_order_evidence_save','change_order_review_price',
      'change_order_customer_authorization','change_order_apply','change_order_invoice_evidence_save'
    ) and owner_module='jobs' and boundary_mode='write' and is_enabled)=6 then 'passed' else 'failed' end,
    'Build 344 change-order actions remain explicit Jobs contracts.'
  union all
  select 'quality_control_jobs_boundary',
    case when (select count(*) from public.app_module_write_contracts where action_key in (
      'quality_control_template_save','quality_control_run_save','quality_control_evidence_link',
      'quality_control_deficiency_save','quality_control_rework_save','quality_control_review'
    ) and owner_module='jobs' and boundary_mode='write' and is_enabled)=6 then 'passed' else 'failed' end,
    'Build 345 QC actions remain explicit Jobs contracts.'
  union all
  select 'seasonal_operations_jobs_boundary',
    case when (select count(*) from public.app_module_write_contracts where action_key in (
      'seasonal_cycle_save','seasonal_checklist_save','seasonal_readiness_save',
      'seasonal_rollover_save','seasonal_storm_event_save','seasonal_storm_route_activation_save'
    ) and owner_module='jobs' and minimum_access='approve' and boundary_mode='write' and is_enabled)=6 then 'passed' else 'failed' end,
    'Build 346 seasonal-cycle/checklist/readiness/rollover/storm actions are explicit Jobs-approve contracts.'
  union all
  select 'boundary_control_plane_private',
    case when not exists(select 1 from information_schema.table_privileges where table_schema='public'
      and table_name in ('app_module_write_contracts','module_boundary_events','v_module_boundary_event_contract_status','operations_attention_states')
      and grantee in ('anon','authenticated','PUBLIC')) then 'passed' else 'failed' end,
    'Boundary contracts, events and attention state remain private server control-plane data.';
$$;
revoke all on function public.ywi_module_write_boundary_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_module_write_boundary_security_assertions() to service_role;

create or replace function public.ywi_seasonal_operations_security_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql stable security invoker set search_path=public as $$
  select 'winter_is_core_operating_season',
    case when not exists(select 1 from public.seasonal_operations_cycles where season_context='winter' and operating_priority<>'core')
      and exists(select 1 from public.seasonal_operations_checklist_templates where season_context='winter' and item_key='operations_launch' and is_active)
    then 'passed' else 'failed' end,
    'Winter cycles cannot be marked supporting/optional and include a core operations launch checklist.'
  union all
  select 'canonical_authorities_preserved',
    case when position('update public.recurring_service_agreements' in lower(pg_get_functiondef('public.ywi_rpc_seasonal_rollover_save(jsonb,uuid)'::regprocedure)))=0
      and position('update public.routes' in lower(pg_get_functiondef('public.ywi_rpc_seasonal_storm_route_activation_save(jsonb,uuid)'::regprocedure)))=0
      and to_regclass('public.preventive_maintenance_plans') is not null
      and to_regclass('public.materials_catalog') is not null
      and to_regclass('public.workability_observations') is not null
    then 'passed' else 'failed' end,
    'Seasonal operations coordinates but does not replace recurring agreements, equipment maintenance, materials, routes or workability authority.'
  union all
  select 'storm_routes_require_canonical_capability',
    case when position('storm_event_capable' in lower(pg_get_functiondef('public.ywi_rpc_seasonal_storm_route_activation_save(jsonb,uuid)'::regprocedure)))>0
      and position('winter' in lower(pg_get_functiondef('public.ywi_rpc_seasonal_storm_route_activation_save(jsonb,uuid)'::regprocedure)))>0
    then 'passed' else 'failed' end,
    'Storm activation requires a canonical winter/four-season route already marked storm-event capable.'
  union all
  select 'winter_storm_event_only',
    case when position('core winter operating cycle' in lower(pg_get_functiondef('public.ywi_rpc_seasonal_storm_event_save(jsonb,uuid)'::regprocedure)))>0
    then 'passed' else 'failed' end,
    'Storm events can only be created inside the winter operating cycle.'
  union all
  select 'seasonal_operations_private',
    case when not exists(select 1 from information_schema.table_privileges where table_schema='public'
      and table_name in (
        'seasonal_operations_cycles','seasonal_operations_checklist_templates','seasonal_operations_checklist_items',
        'seasonal_operations_readiness_reviews','seasonal_operations_rollover_decisions',
        'seasonal_storm_events','seasonal_storm_route_activations'
      ) and grantee in ('anon','authenticated','PUBLIC'))
    then 'passed' else 'failed' end,
    'Seasonal operations orchestration records remain service-role private.'
  union all
  select 'four_season_checklist_coverage',
    case when (select count(distinct season_context) from public.seasonal_operations_checklist_templates where is_active and season_context in ('spring_summer','fall','winter','four_season'))=4
    then 'passed' else 'failed' end,
    'Checklist templates cover spring/summer, fall, winter and four-season operations.';
$$;
revoke all on function public.ywi_seasonal_operations_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_seasonal_operations_security_assertions() to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values(
  234,'seasonal_operations_centre',
  'Build 346 adds a four-season operations centre for readiness, recurring-customer rollover, seasonal staffing/equipment/material coordination, winter storm events/routes, checklists and outstanding work.',
  'applied',now(),'schema234',
  'Seasonal operations is an orchestration layer. Canonical recurring agreements, workforce, preventive maintenance, materials stock, routes/dispatch and workability remain authoritative. Winter snow-clearing/removal is a core operating season.',
  '234_seasonal_operations_centre.sql','schema234'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true) as
select 234 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)=234 then 'current'
       when coalesce(max(schema_version) filter(where status='applied'),0)>234 then 'ahead' else 'drift' end as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)=234 then 'Live database matches the repository schema marker.'
       when coalesce(max(schema_version) filter(where status='applied'),0)>234 then 'Live database is ahead of the repository schema marker.'
       else 'Live database is behind the repository schema marker.' end as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
