-- Schema 221 — Build 333 Fleet, Trailer & Vehicle Operations
-- equipment_items remains the physical-asset authority.
-- Build 333 adds fleet-specific operating evidence without replacing the existing
-- daily inspection, service-task, lockout or future preventive-maintenance authorities.

begin;

create table if not exists public.equipment_fleet_profiles (
  equipment_item_id bigint primary key references public.equipment_items(id) on delete cascade,
  asset_class text not null default 'vehicle' check (asset_class in ('truck','trailer','vehicle')),
  vin_or_unit_number text,
  plate_number text,
  registration_expiry date,
  insurance_policy_reference text,
  insurance_expiry date,
  annual_vehicle_inspection_due date,
  tire_status text not null default 'unknown' check (tire_status in ('unknown','good','monitor','service_due','unsafe')),
  hitch_class text,
  max_tow_kg numeric(12,2) check (max_tow_kg is null or max_tow_kg >= 0),
  trailer_gvwr_kg numeric(12,2) check (trailer_gvwr_kg is null or trailer_gvwr_kg >= 0),
  trailer_connector text,
  fuel_type text not null default 'gasoline' check (fuel_type in ('gasoline','diesel','electric','hybrid','propane','other','none')),
  operational_status text not null default 'ready' check (operational_status in ('ready','assigned','service_due','downtime','out_of_service')),
  damage_status text not null default 'clear' check (damage_status in ('clear','reported','repair_required','monitor')),
  downtime_reason text,
  downtime_started_at timestamptz,
  notes text,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.fleet_towing_assignments (
  id uuid primary key default gen_random_uuid(),
  truck_equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  trailer_equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  job_id bigint references public.jobs(id) on delete set null,
  assigned_crew_id uuid references public.crews(id) on delete set null,
  assigned_at timestamptz not null default now(),
  released_at timestamptz,
  hitch_compatible boolean not null default false,
  tow_capacity_compatible boolean not null default false,
  compatibility_snapshot jsonb not null default '{}'::jsonb,
  assignment_notes text,
  assigned_by_profile_id uuid references public.profiles(id) on delete set null,
  released_by_profile_id uuid references public.profiles(id) on delete set null,
  release_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (truck_equipment_item_id <> trailer_equipment_item_id)
);

create table if not exists public.fleet_readiness_checks (
  id uuid primary key default gen_random_uuid(),
  equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  job_id bigint references public.jobs(id) on delete set null,
  checked_at timestamptz not null default now(),
  registration_verified boolean not null default false,
  insurance_verified boolean not null default false,
  vehicle_inspection_verified boolean not null default false,
  tire_status text not null default 'unknown' check (tire_status in ('unknown','good','monitor','service_due','unsafe')),
  hitch_compatible boolean,
  trailer_load_ready boolean,
  load_summary text,
  issue_summary text,
  readiness_status text not null default 'needs_review' check (readiness_status in ('ready','needs_review','blocked')),
  checked_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.fleet_fuel_logs (
  id uuid primary key default gen_random_uuid(),
  equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  job_id bigint references public.jobs(id) on delete set null,
  fueled_at timestamptz not null default now(),
  fuel_type text not null default 'gasoline',
  quantity_litres numeric(12,3) not null check (quantity_litres > 0),
  total_cost numeric(12,2) check (total_cost is null or total_cost >= 0),
  odometer_km numeric(14,2) check (odometer_km is null or odometer_km >= 0),
  supplier text,
  receipt_reference text,
  notes text,
  recorded_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.fleet_downtime_events (
  id uuid primary key default gen_random_uuid(),
  equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  job_id bigint references public.jobs(id) on delete set null,
  service_task_id uuid references public.equipment_service_tasks(id) on delete set null,
  damage_summary text,
  downtime_reason text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  resolution_notes text,
  opened_by_profile_id uuid references public.profiles(id) on delete set null,
  closed_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists equipment_fleet_profiles_status_idx on public.equipment_fleet_profiles(asset_class,operational_status);
create index if not exists fleet_towing_assignments_active_idx on public.fleet_towing_assignments(trailer_equipment_item_id,assigned_at desc) where released_at is null;
create index if not exists fleet_readiness_checks_equipment_idx on public.fleet_readiness_checks(equipment_item_id,checked_at desc);
create index if not exists fleet_fuel_logs_equipment_idx on public.fleet_fuel_logs(equipment_item_id,fueled_at desc);
create index if not exists fleet_downtime_events_equipment_idx on public.fleet_downtime_events(equipment_item_id,started_at desc);

alter table public.equipment_fleet_profiles enable row level security;
alter table public.fleet_towing_assignments enable row level security;
alter table public.fleet_readiness_checks enable row level security;
alter table public.fleet_fuel_logs enable row level security;
alter table public.fleet_downtime_events enable row level security;

revoke all on table public.equipment_fleet_profiles from public,anon,authenticated;
revoke all on table public.fleet_towing_assignments from public,anon,authenticated;
revoke all on table public.fleet_readiness_checks from public,anon,authenticated;
revoke all on table public.fleet_fuel_logs from public,anon,authenticated;
revoke all on table public.fleet_downtime_events from public,anon,authenticated;

grant select,insert,update,delete on table public.equipment_fleet_profiles to service_role;
grant select,insert,update,delete on table public.fleet_towing_assignments to service_role;
grant select,insert,update,delete on table public.fleet_readiness_checks to service_role;
grant select,insert,update,delete on table public.fleet_fuel_logs to service_role;
grant select,insert,update,delete on table public.fleet_downtime_events to service_role;

create or replace view public.v_fleet_towing_assignment_directory
with (security_invoker=true)
as
select
  a.id,
  a.truck_equipment_item_id,
  truck.equipment_code as truck_equipment_code,
  truck.equipment_name as truck_equipment_name,
  a.trailer_equipment_item_id,
  trailer.equipment_code as trailer_equipment_code,
  trailer.equipment_name as trailer_equipment_name,
  a.job_id,
  a.assigned_crew_id,
  a.assigned_at,
  a.released_at,
  a.hitch_compatible,
  a.tow_capacity_compatible,
  a.compatibility_snapshot,
  a.assignment_notes,
  a.release_notes
from public.fleet_towing_assignments a
join public.equipment_items truck on truck.id=a.truck_equipment_item_id
join public.equipment_items trailer on trailer.id=a.trailer_equipment_item_id;

create or replace view public.v_fleet_vehicle_operations
with (security_invoker=true)
as
select
  e.id as equipment_item_id,
  e.equipment_code,
  e.equipment_name,
  e.category,
  e.status as equipment_status,
  e.assigned_crew_id,
  e.current_job_id,
  e.current_meter_value as odometer_or_meter_value,
  e.meter_unit,
  e.is_locked_out,
  p.asset_class,
  p.vin_or_unit_number,
  p.plate_number,
  p.registration_expiry,
  p.insurance_policy_reference,
  p.insurance_expiry,
  p.annual_vehicle_inspection_due,
  p.tire_status,
  p.hitch_class,
  p.max_tow_kg,
  p.trailer_gvwr_kg,
  p.trailer_connector,
  p.fuel_type,
  p.operational_status,
  p.damage_status,
  p.downtime_reason,
  p.downtime_started_at,
  p.notes as fleet_notes,
  latest.readiness_status as latest_readiness_status,
  latest.checked_at as latest_readiness_checked_at,
  latest.trailer_load_ready as latest_trailer_load_ready,
  latest.issue_summary as latest_readiness_issue_summary,
  coalesce(fuel.fuel_quantity_litres,0)::numeric(14,3) as fuel_quantity_litres,
  coalesce(fuel.fuel_cost_total,0)::numeric(14,2) as fuel_cost_total,
  fuel.last_fueled_at,
  coalesce(down.open_downtime_count,0)::int as open_downtime_count,
  active_tow.assignment_id as active_towing_assignment_id,
  active_tow.truck_equipment_code,
  active_tow.trailer_equipment_code
from public.equipment_items e
join public.equipment_fleet_profiles p on p.equipment_item_id=e.id
left join lateral (
  select r.readiness_status,r.checked_at,r.trailer_load_ready,r.issue_summary
  from public.fleet_readiness_checks r
  where r.equipment_item_id=e.id
  order by r.checked_at desc
  limit 1
) latest on true
left join lateral (
  select sum(f.quantity_litres) as fuel_quantity_litres,sum(coalesce(f.total_cost,0)) as fuel_cost_total,max(f.fueled_at) as last_fueled_at
  from public.fleet_fuel_logs f
  where f.equipment_item_id=e.id
) fuel on true
left join lateral (
  select count(*) as open_downtime_count
  from public.fleet_downtime_events d
  where d.equipment_item_id=e.id and d.ended_at is null
) down on true
left join lateral (
  select a.id as assignment_id,truck.equipment_code as truck_equipment_code,trailer.equipment_code as trailer_equipment_code
  from public.fleet_towing_assignments a
  join public.equipment_items truck on truck.id=a.truck_equipment_item_id
  join public.equipment_items trailer on trailer.id=a.trailer_equipment_item_id
  where a.released_at is null and (a.truck_equipment_item_id=e.id or a.trailer_equipment_item_id=e.id)
  order by a.assigned_at desc
  limit 1
) active_tow on true;

create or replace view public.v_fleet_operations_summary
with (security_invoker=true)
as
select
  count(*)::int as fleet_asset_count,
  count(*) filter(where asset_class='truck')::int as truck_count,
  count(*) filter(where asset_class='trailer')::int as trailer_count,
  count(*) filter(where operational_status='downtime')::int as downtime_count,
  count(*) filter(where registration_expiry is not null and registration_expiry <= current_date + 30)::int as registration_attention_count,
  count(*) filter(where insurance_expiry is not null and insurance_expiry <= current_date + 30)::int as insurance_attention_count,
  count(*) filter(where annual_vehicle_inspection_due is not null and annual_vehicle_inspection_due <= current_date + 30)::int as inspection_attention_count,
  count(*) filter(where tire_status in ('service_due','unsafe'))::int as tire_attention_count
from public.equipment_fleet_profiles;

revoke all on table public.v_fleet_towing_assignment_directory from public,anon,authenticated;
revoke all on table public.v_fleet_vehicle_operations from public,anon,authenticated;
revoke all on table public.v_fleet_operations_summary from public,anon,authenticated;
grant select on table public.v_fleet_towing_assignment_directory to service_role;
grant select on table public.v_fleet_vehicle_operations to service_role;
grant select on table public.v_fleet_operations_summary to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  221,'fleet_trailer_vehicle_operations',
  'Build 333 fleet, trailer and vehicle identity, towing compatibility, readiness, fuel, damage and downtime operations.',
  'applied',now(),'schema221',
  'Reuses equipment_items, crew/job assignment, daily inspection and equipment_service_tasks authorities. Preventive maintenance scheduling remains Build 334.',
  '221_fleet_trailer_vehicle_operations.sql','schema221'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true)
as
select
  221 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=221 then 'current'
    when coalesce(max(schema_version) filter(where status='applied'),0)>221 then 'ahead'
    else 'drift'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=221 then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter(where status='applied'),0)>221 then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
