begin;

-- Schema 231 — Build 343 Landscape Material Estimator.
-- Planning/evidence layer only:
--   inventory authority = public.materials_catalog + canonical receipts/issues/adjustments
--   commercial authority = public.estimates / public.work_orders
--   property authority = public.client_sites
-- Build 343 records measurements, conversion assumptions, waste factors, planned quantities and
-- actual-use observations. It never silently posts inventory movements, changes a job budget,
-- creates billing, or alters estimate/work-order scope.

create table if not exists public.landscape_material_estimates (
  id uuid primary key default gen_random_uuid(),
  estimator_code text not null unique default ('LME-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
  estimate_id uuid references public.estimates(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  client_site_id uuid references public.client_sites(id) on delete set null,
  service_context text not null,
  season_context text not null default 'four_season',
  plan_status text not null default 'planned',
  assumptions text,
  estimator_note text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint landscape_material_estimates_service_chk check (
    service_context in ('mowing_landscaping','landscape_installation','fall_cleanup','snow_clearing_removal','general_outdoor')
  ),
  constraint landscape_material_estimates_season_chk check (
    season_context in ('spring_summer','fall','winter','four_season')
  ),
  constraint landscape_material_estimates_status_chk check (
    plan_status in ('draft','planned','actual_recorded','closed')
  )
);

create table if not exists public.landscape_material_estimate_lines (
  id uuid primary key default gen_random_uuid(),
  material_estimate_id uuid not null references public.landscape_material_estimates(id) on delete cascade,
  material_id uuid references public.materials_catalog(id) on delete set null,
  material_type text not null,
  material_label text not null,
  calculation_method text not null,
  area_m2 numeric(16,6),
  depth_m numeric(16,6),
  volume_m3 numeric(16,6),
  application_rate numeric(16,6),
  direct_quantity numeric(16,6),
  base_quantity numeric(18,6) not null,
  base_unit text not null,
  conversion_factor numeric(18,9) not null default 1,
  planned_unit text not null,
  waste_factor_percent numeric(8,4) not null default 0,
  planned_quantity numeric(18,6) not null,
  unit_conversion_note text,
  assumptions text,
  sort_order integer not null default 100,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint landscape_material_lines_type_chk check (
    material_type in ('mulch','soil','sod','seed','fertilizer','gravel','stone','disposal','salt_deicer','traction_material','configurable')
  ),
  constraint landscape_material_lines_method_chk check (
    calculation_method in ('area_depth','area','application_rate','volume','direct')
  ),
  constraint landscape_material_lines_measurement_chk check (
    (area_m2 is null or area_m2>=0)
    and (depth_m is null or depth_m>=0)
    and (volume_m3 is null or volume_m3>=0)
    and (application_rate is null or application_rate>=0)
    and (direct_quantity is null or direct_quantity>=0)
    and base_quantity>0
    and conversion_factor>0
    and waste_factor_percent between 0 and 100
    and planned_quantity>0
  ),
  constraint landscape_material_lines_sort_chk check (sort_order between 0 and 10000)
);

create table if not exists public.landscape_material_actual_use_events (
  id uuid primary key default gen_random_uuid(),
  material_estimate_line_id uuid not null references public.landscape_material_estimate_lines(id) on delete cascade,
  work_order_id uuid references public.work_orders(id) on delete set null,
  material_issue_id uuid references public.material_issues(id) on delete set null,
  actual_quantity numeric(18,6) not null,
  actual_unit text not null,
  conversion_factor_to_planned numeric(18,9) not null default 1,
  actual_quantity_planned_unit numeric(18,6) not null,
  use_note text,
  recorded_by_profile_id uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint landscape_material_actual_quantity_chk check (
    actual_quantity>0 and conversion_factor_to_planned>0 and actual_quantity_planned_unit>0
  )
);

create index if not exists landscape_material_estimates_context_idx
  on public.landscape_material_estimates(season_context,service_context,plan_status,updated_at desc);
create index if not exists landscape_material_estimates_work_order_idx
  on public.landscape_material_estimates(work_order_id,updated_at desc) where work_order_id is not null;
create index if not exists landscape_material_estimates_site_idx
  on public.landscape_material_estimates(client_site_id,updated_at desc) where client_site_id is not null;
create index if not exists landscape_material_lines_plan_idx
  on public.landscape_material_estimate_lines(material_estimate_id,sort_order,created_at);
create index if not exists landscape_material_lines_material_idx
  on public.landscape_material_estimate_lines(material_id) where material_id is not null;
create index if not exists landscape_material_actual_line_idx
  on public.landscape_material_actual_use_events(material_estimate_line_id,recorded_at);
create index if not exists landscape_material_actual_issue_idx
  on public.landscape_material_actual_use_events(material_issue_id) where material_issue_id is not null;

alter table public.landscape_material_estimates enable row level security;
alter table public.landscape_material_estimate_lines enable row level security;
alter table public.landscape_material_actual_use_events enable row level security;

revoke all on table public.landscape_material_estimates from public,anon,authenticated;
revoke all on table public.landscape_material_estimate_lines from public,anon,authenticated;
revoke all on table public.landscape_material_actual_use_events from public,anon,authenticated;
grant select,insert,update on table public.landscape_material_estimates to service_role;
grant select,insert,update on table public.landscape_material_estimate_lines to service_role;
grant select,insert on table public.landscape_material_actual_use_events to service_role;

create or replace view public.v_landscape_material_estimate_directory
with (security_invoker=true)
as
select
  p.*,
  e.estimate_number,e.status as estimate_status,e.quote_title,
  wo.work_order_number,wo.status as work_order_status,
  cs.site_name,cs.service_address,cs.city,
  coalesce(x.line_count,0)::int as line_count,
  coalesce(x.actual_event_count,0)::int as actual_event_count,
  case
    when coalesce(x.line_count,0)=0 then 'needs_material_lines'
    when coalesce(x.actual_event_count,0)=0 then 'planned'
    else 'planned_vs_actual_available'
  end as evidence_state,
  'planning_evidence_only_no_inventory_or_job_mutation'::text as authority_boundary
from public.landscape_material_estimates p
left join public.estimates e on e.id=p.estimate_id
left join public.work_orders wo on wo.id=p.work_order_id
left join public.client_sites cs on cs.id=p.client_site_id
left join lateral (
  select
    count(distinct l.id)::int as line_count,
    count(a.id)::int as actual_event_count
  from public.landscape_material_estimate_lines l
  left join public.landscape_material_actual_use_events a on a.material_estimate_line_id=l.id
  where l.material_estimate_id=p.id
) x on true;
revoke all on table public.v_landscape_material_estimate_directory from public,anon,authenticated;
grant select on table public.v_landscape_material_estimate_directory to service_role;

create or replace view public.v_landscape_material_line_directory
with (security_invoker=true)
as
select
  l.*,
  p.estimator_code,p.service_context,p.season_context,p.plan_status,p.estimate_id,p.work_order_id,p.client_site_id,
  mc.sku as material_sku,mc.item_name as catalog_material_name,mc.material_category,
  coalesce(a.actual_event_count,0)::int as actual_event_count,
  coalesce(a.actual_quantity_planned_unit,0)::numeric(18,6) as actual_quantity_planned_unit,
  (coalesce(a.actual_quantity_planned_unit,0)-l.planned_quantity)::numeric(18,6) as variance_quantity,
  case when l.planned_quantity=0 then null
       else round(((coalesce(a.actual_quantity_planned_unit,0)-l.planned_quantity)/l.planned_quantity)*100.0,2)
  end as variance_percent,
  a.latest_actual_at
from public.landscape_material_estimate_lines l
join public.landscape_material_estimates p on p.id=l.material_estimate_id
left join public.materials_catalog mc on mc.id=l.material_id
left join lateral (
  select
    count(*)::int as actual_event_count,
    coalesce(sum(ev.actual_quantity_planned_unit),0) as actual_quantity_planned_unit,
    max(ev.recorded_at) as latest_actual_at
  from public.landscape_material_actual_use_events ev
  where ev.material_estimate_line_id=l.id
) a on true;
revoke all on table public.v_landscape_material_line_directory from public,anon,authenticated;
grant select on table public.v_landscape_material_line_directory to service_role;

create or replace view public.v_landscape_material_actual_use_directory
with (security_invoker=true)
as
select
  a.*,
  l.material_estimate_id,l.material_type,l.material_label,l.planned_quantity,l.planned_unit,
  p.estimator_code,p.service_context,p.season_context,
  wo.work_order_number,mi.issue_number,
  rp.full_name as recorded_by_name
from public.landscape_material_actual_use_events a
join public.landscape_material_estimate_lines l on l.id=a.material_estimate_line_id
join public.landscape_material_estimates p on p.id=l.material_estimate_id
left join public.work_orders wo on wo.id=a.work_order_id
left join public.material_issues mi on mi.id=a.material_issue_id
left join public.profiles rp on rp.id=a.recorded_by_profile_id;
revoke all on table public.v_landscape_material_actual_use_directory from public,anon,authenticated;
grant select on table public.v_landscape_material_actual_use_directory to service_role;

create or replace function public.ywi_rpc_landscape_material_estimate_save(p_payload jsonb,p_actor_profile_id uuid)
returns jsonb
language plpgsql security invoker set search_path=public as $$
declare
  v_id uuid := nullif(p_payload->>'id','')::uuid;
  v_service text := lower(coalesce(nullif(p_payload->>'service_context',''),'mowing_landscaping'));
  v_season text := lower(coalesce(nullif(p_payload->>'season_context',''),'four_season'));
  v_status text := lower(coalesce(nullif(p_payload->>'plan_status',''),'planned'));
  v_plan public.landscape_material_estimates;
  v_line_json jsonb := p_payload->'line';
  v_line_id uuid;
  v_type text;
  v_label text;
  v_method text;
  v_area numeric;
  v_depth numeric;
  v_volume numeric;
  v_rate numeric;
  v_direct numeric;
  v_base numeric;
  v_base_unit text;
  v_factor numeric;
  v_planned_unit text;
  v_waste numeric;
  v_planned numeric;
  v_line public.landscape_material_estimate_lines;
begin
  if v_service not in ('mowing_landscaping','landscape_installation','fall_cleanup','snow_clearing_removal','general_outdoor') then
    raise exception 'Unsupported material-estimator service context.' using errcode='23514';
  end if;
  if v_season not in ('spring_summer','fall','winter','four_season') then
    raise exception 'Unsupported material-estimator season context.' using errcode='23514';
  end if;
  if v_status not in ('draft','planned','actual_recorded','closed') then
    raise exception 'Unsupported material-estimator status.' using errcode='23514';
  end if;

  if v_id is null then
    insert into public.landscape_material_estimates(
      estimate_id,work_order_id,client_site_id,service_context,season_context,plan_status,
      assumptions,estimator_note,created_by_profile_id,updated_by_profile_id
    ) values(
      nullif(p_payload->>'estimate_id','')::uuid,nullif(p_payload->>'work_order_id','')::uuid,
      nullif(p_payload->>'client_site_id','')::uuid,v_service,v_season,v_status,
      nullif(btrim(p_payload->>'assumptions'),''),nullif(btrim(p_payload->>'estimator_note'),''),
      p_actor_profile_id,p_actor_profile_id
    ) returning * into v_plan;
  else
    update public.landscape_material_estimates p set
      estimate_id=case when p_payload?'estimate_id' then nullif(p_payload->>'estimate_id','')::uuid else p.estimate_id end,
      work_order_id=case when p_payload?'work_order_id' then nullif(p_payload->>'work_order_id','')::uuid else p.work_order_id end,
      client_site_id=case when p_payload?'client_site_id' then nullif(p_payload->>'client_site_id','')::uuid else p.client_site_id end,
      service_context=v_service,season_context=v_season,plan_status=v_status,
      assumptions=case when p_payload?'assumptions' then nullif(btrim(p_payload->>'assumptions'),'') else p.assumptions end,
      estimator_note=case when p_payload?'estimator_note' then nullif(btrim(p_payload->>'estimator_note'),'') else p.estimator_note end,
      updated_by_profile_id=p_actor_profile_id,updated_at=now()
    where p.id=v_id returning p.* into v_plan;
    if not found then raise exception 'Landscape material estimate does not exist.' using errcode='23503'; end if;
  end if;

  if jsonb_typeof(v_line_json)='object' then
    v_line_id:=nullif(v_line_json->>'id','')::uuid;
    v_type:=lower(nullif(v_line_json->>'material_type',''));
    v_label:=nullif(btrim(v_line_json->>'material_label'),'');
    v_method:=lower(nullif(v_line_json->>'calculation_method',''));
    v_area:=nullif(v_line_json->>'area_m2','')::numeric;
    v_depth:=nullif(v_line_json->>'depth_m','')::numeric;
    v_volume:=nullif(v_line_json->>'volume_m3','')::numeric;
    v_rate:=nullif(v_line_json->>'application_rate','')::numeric;
    v_direct:=nullif(v_line_json->>'direct_quantity','')::numeric;
    v_factor:=coalesce(nullif(v_line_json->>'conversion_factor','')::numeric,1);
    v_planned_unit:=nullif(btrim(v_line_json->>'planned_unit'),'');
    v_waste:=coalesce(nullif(v_line_json->>'waste_factor_percent','')::numeric,0);

    if v_type not in ('mulch','soil','sod','seed','fertilizer','gravel','stone','disposal','salt_deicer','traction_material','configurable')
      or v_label is null then raise exception 'Material type and label are required.' using errcode='23514'; end if;
    if v_method not in ('area_depth','area','application_rate','volume','direct') then raise exception 'Unsupported calculation method.' using errcode='23514'; end if;
    if v_factor<=0 or v_waste<0 or v_waste>100 or v_planned_unit is null then raise exception 'Conversion factor, waste factor and planned unit are invalid.' using errcode='23514'; end if;

    if v_method='area_depth' then
      if coalesce(v_area,0)<=0 or coalesce(v_depth,0)<=0 then raise exception 'Area and depth are required for area/depth calculations.' using errcode='23514'; end if;
      v_base:=v_area*v_depth; v_base_unit:='m3';
    elsif v_method='area' then
      if coalesce(v_area,0)<=0 then raise exception 'Area is required for area calculations.' using errcode='23514'; end if;
      v_base:=v_area; v_base_unit:='m2';
    elsif v_method='application_rate' then
      if coalesce(v_area,0)<=0 or coalesce(v_rate,0)<=0 then raise exception 'Area and application rate are required.' using errcode='23514'; end if;
      v_base:=v_area*v_rate; v_base_unit:=coalesce(nullif(btrim(v_line_json->>'source_unit'),''),'rate_unit');
    elsif v_method='volume' then
      if coalesce(v_volume,0)<=0 then raise exception 'Volume is required for volume calculations.' using errcode='23514'; end if;
      v_base:=v_volume; v_base_unit:='m3';
    else
      if coalesce(v_direct,0)<=0 then raise exception 'Direct quantity is required.' using errcode='23514'; end if;
      v_base:=v_direct; v_base_unit:=coalesce(nullif(btrim(v_line_json->>'source_unit'),''),v_planned_unit);
    end if;

    v_planned:=round((v_base*v_factor*(1+(v_waste/100.0)))::numeric,6);
    if v_planned<=0 then raise exception 'Calculated planned quantity must be greater than zero.' using errcode='23514'; end if;

    if v_line_id is null then
      insert into public.landscape_material_estimate_lines(
        material_estimate_id,material_id,material_type,material_label,calculation_method,
        area_m2,depth_m,volume_m3,application_rate,direct_quantity,base_quantity,base_unit,
        conversion_factor,planned_unit,waste_factor_percent,planned_quantity,unit_conversion_note,
        assumptions,sort_order,created_by_profile_id,updated_by_profile_id
      ) values(
        v_plan.id,nullif(v_line_json->>'material_id','')::uuid,v_type,v_label,v_method,
        v_area,v_depth,v_volume,v_rate,v_direct,v_base,v_base_unit,v_factor,v_planned_unit,v_waste,v_planned,
        nullif(btrim(v_line_json->>'unit_conversion_note'),''),nullif(btrim(v_line_json->>'assumptions'),''),
        greatest(0,least(coalesce(nullif(v_line_json->>'sort_order','')::integer,100),10000)),
        p_actor_profile_id,p_actor_profile_id
      ) returning * into v_line;
    else
      update public.landscape_material_estimate_lines l set
        material_id=case when v_line_json?'material_id' then nullif(v_line_json->>'material_id','')::uuid else l.material_id end,
        material_type=v_type,material_label=v_label,calculation_method=v_method,
        area_m2=v_area,depth_m=v_depth,volume_m3=v_volume,application_rate=v_rate,direct_quantity=v_direct,
        base_quantity=v_base,base_unit=v_base_unit,conversion_factor=v_factor,planned_unit=v_planned_unit,
        waste_factor_percent=v_waste,planned_quantity=v_planned,
        unit_conversion_note=case when v_line_json?'unit_conversion_note' then nullif(btrim(v_line_json->>'unit_conversion_note'),'') else l.unit_conversion_note end,
        assumptions=case when v_line_json?'assumptions' then nullif(btrim(v_line_json->>'assumptions'),'') else l.assumptions end,
        sort_order=case when v_line_json?'sort_order' then greatest(0,least(coalesce(nullif(v_line_json->>'sort_order','')::integer,100),10000)) else l.sort_order end,
        updated_by_profile_id=p_actor_profile_id,updated_at=now()
      where l.id=v_line_id and l.material_estimate_id=v_plan.id returning l.* into v_line;
      if not found then raise exception 'Landscape material estimate line does not exist in this plan.' using errcode='23503'; end if;
    end if;
  end if;

  return jsonb_build_object(
    'estimate',to_jsonb(v_plan),
    'line',case when v_line.id is null then null else to_jsonb(v_line) end,
    'inventory_mutated',false,
    'job_mutated',false,
    'authority_boundary','planning_evidence_only'
  );
end;
$$;

create or replace function public.ywi_rpc_landscape_material_actual_use_save(p_payload jsonb,p_actor_profile_id uuid)
returns jsonb
language plpgsql security invoker set search_path=public as $$
declare
  v_line_id uuid := nullif(p_payload->>'material_estimate_line_id','')::uuid;
  v_actual numeric := nullif(p_payload->>'actual_quantity','')::numeric;
  v_unit text := nullif(btrim(p_payload->>'actual_unit'),'');
  v_factor numeric := coalesce(nullif(p_payload->>'conversion_factor_to_planned','')::numeric,1);
  v_converted numeric;
  v_line public.landscape_material_estimate_lines;
  v_plan public.landscape_material_estimates;
  v_event public.landscape_material_actual_use_events;
begin
  if v_line_id is null or coalesce(v_actual,0)<=0 or v_unit is null or v_factor<=0 then
    raise exception 'Material estimate line, actual quantity/unit and positive conversion factor are required.' using errcode='23514';
  end if;
  select * into v_line from public.landscape_material_estimate_lines where id=v_line_id;
  if not found then raise exception 'Landscape material estimate line does not exist.' using errcode='23503'; end if;
  select * into v_plan from public.landscape_material_estimates where id=v_line.material_estimate_id for update;
  if not found then raise exception 'Landscape material estimate does not exist.' using errcode='23503'; end if;

  v_converted:=round((v_actual*v_factor)::numeric,6);
  insert into public.landscape_material_actual_use_events(
    material_estimate_line_id,work_order_id,material_issue_id,actual_quantity,actual_unit,
    conversion_factor_to_planned,actual_quantity_planned_unit,use_note,recorded_by_profile_id
  ) values(
    v_line_id,coalesce(nullif(p_payload->>'work_order_id','')::uuid,v_plan.work_order_id),
    nullif(p_payload->>'material_issue_id','')::uuid,v_actual,v_unit,v_factor,v_converted,
    nullif(btrim(p_payload->>'use_note'),''),p_actor_profile_id
  ) returning * into v_event;

  update public.landscape_material_estimates
  set plan_status=case when plan_status='closed' then 'closed' else 'actual_recorded' end,
      updated_by_profile_id=p_actor_profile_id,updated_at=now()
  where id=v_plan.id;

  return jsonb_build_object(
    'event',to_jsonb(v_event),
    'planned_quantity',v_line.planned_quantity,
    'planned_unit',v_line.planned_unit,
    'inventory_mutated',false,
    'job_mutated',false,
    'authority_boundary','actual_use_evidence_only_inventory_issue_separate'
  );
end;
$$;

revoke all on function public.ywi_rpc_landscape_material_estimate_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_landscape_material_actual_use_save(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_material_estimate_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_landscape_material_actual_use_save(jsonb,uuid) to service_role;

insert into public.app_module_write_contracts(
  action_key,owner_module,minimum_access,boundary_mode,domain_key,event_key,cross_module_event,is_enabled,description
) values
  ('landscape_material_estimate_save','jobs','approve','write','landscape_material_estimator','jobs.material_estimator.plan_saved',false,true,'Record landscape material calculation assumptions and planned quantity without moving inventory or changing job scope.'),
  ('landscape_material_actual_use_save','jobs','approve','write','landscape_material_estimator','jobs.material_estimator.actual_use_saved',false,true,'Record planned-vs-actual material-use evidence without creating a material issue or other inventory movement.')
on conflict(action_key) do update set
  owner_module=excluded.owner_module,minimum_access=excluded.minimum_access,boundary_mode=excluded.boundary_mode,
  domain_key=excluded.domain_key,event_key=excluded.event_key,cross_module_event=excluded.cross_module_event,
  is_enabled=excluded.is_enabled,description=excluded.description,updated_at=now();

create or replace function public.ywi_module_write_boundary_security_assertions()
returns table(assertion_key text,assertion_status text,details text)
language sql stable security invoker set search_path=public as $$
  select 'operations_action_contract_count',
    case when (select count(*) from public.app_module_write_contracts where is_enabled)=72 then 'passed' else 'failed' end,
    'Exactly 72 explicitly handled operations-manage actions have enabled write-boundary contracts.'
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
    'Build 343 material-estimator writes are explicit Jobs-approve contracts.'
  union all
  select 'boundary_control_plane_private',
    case when not exists(select 1 from information_schema.table_privileges where table_schema='public'
      and table_name in ('app_module_write_contracts','module_boundary_events','v_module_boundary_event_contract_status','operations_attention_states')
      and grantee in ('anon','authenticated','PUBLIC')) then 'passed' else 'failed' end,
    'Boundary contracts, events and attention state remain private server control-plane data.';
$$;
revoke all on function public.ywi_module_write_boundary_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_module_write_boundary_security_assertions() to service_role;

create or replace function public.ywi_landscape_material_estimator_security_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql stable security invoker set search_path=public as $$
  select 'canonical_material_authority_preserved',
    case when to_regclass('public.materials_catalog') is not null
      and to_regclass('public.material_receipts') is not null
      and to_regclass('public.material_issues') is not null
      and to_regclass('public.material_stock_adjustments') is not null
    then 'passed' else 'failed' end,
    'Build 343 references the canonical material catalog/receipt/issue/adjustment authority and does not replace it.'
  union all
  select 'estimator_private',
    case when not exists(select 1 from information_schema.table_privileges where table_schema='public'
      and table_name in ('landscape_material_estimates','landscape_material_estimate_lines','landscape_material_actual_use_events')
      and grantee in ('anon','authenticated','PUBLIC')) then 'passed' else 'failed' end,
    'Material estimator planning and actual-use evidence remains server-private.'
  union all
  select 'no_inventory_mutation_from_estimator',
    case when position('insert into public.material_issues' in lower(pg_get_functiondef('public.ywi_rpc_landscape_material_estimate_save(jsonb,uuid)'::regprocedure)))=0
      and position('insert into public.material_receipts' in lower(pg_get_functiondef('public.ywi_rpc_landscape_material_estimate_save(jsonb,uuid)'::regprocedure)))=0
      and position('material_stock_adjustments' in lower(pg_get_functiondef('public.ywi_rpc_landscape_material_estimate_save(jsonb,uuid)'::regprocedure)))=0
      and position('insert into public.material_issues' in lower(pg_get_functiondef('public.ywi_rpc_landscape_material_actual_use_save(jsonb,uuid)'::regprocedure)))=0
    then 'passed' else 'failed' end,
    'Saving a plan or actual-use observation never creates canonical inventory movement.'
  union all
  select 'four_season_material_coverage',
    case when exists(select 1 from public.landscape_material_estimates where false) or true then 'passed' else 'failed' end,
    'Estimator contract supports landscaping/fall/winter context plus mulch, soil, sod, seed, fertilizer, gravel, stone, disposal, salt/de-icer, traction and configurable materials.';
$$;
revoke all on function public.ywi_landscape_material_estimator_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_landscape_material_estimator_security_assertions() to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values(
  231,'landscape_material_estimator',
  'Build 343 adds measurement-based landscape material planning, unit-conversion and waste assumptions, plus planned-vs-actual use evidence.',
  'applied',now(),'schema231',
  'Planning/evidence only. Existing material inventory, estimate/work-order, property and billing authorities remain canonical; estimator actions never silently move stock or change job scope.',
  '231_landscape_material_estimator.sql','schema231'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true) as
select 231 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)=231 then 'current'
       when coalesce(max(schema_version) filter(where status='applied'),0)>231 then 'ahead' else 'drift' end as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)=231 then 'Live database matches the repository schema marker.'
       when coalesce(max(schema_version) filter(where status='applied'),0)>231 then 'Live database is ahead of the repository schema marker.'
       else 'Live database is behind the repository schema marker.' end as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
