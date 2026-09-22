-- Schema 222 — Build 334 Preventive Maintenance Engine
-- equipment_items remains the physical-asset authority.
-- Existing maintenance history and equipment_service_tasks remain the execution/history authorities.
-- Build 334 adds recurring preventive scheduling, forecasting and completion linkage only.

begin;

-- Compatibility hardening for the existing maintenance-history authority used by jobs-manage.
create table if not exists public.equipment_maintenance_history (
  id uuid primary key default gen_random_uuid(),
  equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  performed_by_profile_id uuid references public.profiles(id) on delete set null,
  performed_at timestamptz not null default now(),
  maintenance_type text not null default 'service',
  provider_name text,
  cost_amount numeric(12,2),
  notes text,
  next_due_date date,
  created_at timestamptz not null default now()
);

alter table public.equipment_maintenance_history
  add column if not exists performed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists performed_at timestamptz not null default now(),
  add column if not exists maintenance_type text not null default 'service',
  add column if not exists provider_name text,
  add column if not exists cost_amount numeric(12,2),
  add column if not exists notes text,
  add column if not exists next_due_date date,
  add column if not exists created_at timestamptz not null default now();

create index if not exists equipment_maintenance_history_item_idx
  on public.equipment_maintenance_history(equipment_item_id,performed_at desc);

create table if not exists public.preventive_maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  plan_code text not null,
  plan_name text not null,
  maintenance_type text not null,
  schedule_basis text not null,
  interval_days integer,
  meter_unit text,
  interval_meter numeric(14,2),
  anchor_date date,
  seasonal_month integer,
  seasonal_day integer,
  due_date date,
  due_meter numeric(14,2),
  lead_days integer not null default 14,
  lead_meter numeric(14,2) not null default 10,
  plan_status text not null default 'active',
  default_provider_name text,
  estimated_cost numeric(12,2) not null default 0,
  instructions text,
  last_completed_at timestamptz,
  last_completed_meter numeric(14,2),
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(equipment_item_id,plan_code),
  check (maintenance_type in ('oil','filter','blade','sharpening','belt','lubrication','tires','battery','winterization','storage','preseason_setup','repair','inspection','service','other')),
  check (schedule_basis in ('date','hours','kilometres','seasonal')),
  check (interval_days is null or interval_days > 0),
  check (meter_unit is null or meter_unit in ('hours','km')),
  check (interval_meter is null or interval_meter > 0),
  check (due_meter is null or due_meter >= 0),
  check (lead_days between 0 and 365),
  check (lead_meter >= 0),
  check (seasonal_month is null or seasonal_month between 1 and 12),
  check (seasonal_day is null or seasonal_day between 1 and 31),
  check (estimated_cost >= 0),
  check (plan_status in ('active','paused','retired'))
);

create table if not exists public.preventive_maintenance_events (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.preventive_maintenance_plans(id) on delete cascade,
  equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  event_type text not null,
  event_at timestamptz not null default now(),
  due_date_snapshot date,
  due_meter_snapshot numeric(14,2),
  meter_value numeric(14,2),
  service_task_id uuid references public.equipment_service_tasks(id) on delete set null,
  maintenance_history_id uuid references public.equipment_maintenance_history(id) on delete set null,
  cost_amount numeric(12,2),
  provider_name text,
  notes text,
  recorded_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (event_type in ('task_opened','completed','rescheduled','paused','reactivated','retired')),
  check (meter_value is null or meter_value >= 0),
  check (cost_amount is null or cost_amount >= 0)
);

create index if not exists preventive_maintenance_plans_asset_idx
  on public.preventive_maintenance_plans(equipment_item_id,plan_status,due_date);
create index if not exists preventive_maintenance_events_plan_idx
  on public.preventive_maintenance_events(plan_id,event_at desc);

-- Extend the existing service-task vocabulary; do not replace its authority.
alter table if exists public.equipment_service_tasks drop constraint if exists equipment_service_tasks_type_check;
alter table if exists public.equipment_service_tasks
  add constraint equipment_service_tasks_type_check
  check (task_type in ('arrival_test_followup','return_test_followup','repair','cleaning','inspection','replacement','accessory_missing','preventive_maintenance','custom'));

alter table public.preventive_maintenance_plans enable row level security;
alter table public.preventive_maintenance_events enable row level security;
alter table public.equipment_maintenance_history enable row level security;

revoke all on table public.preventive_maintenance_plans from public,anon,authenticated;
revoke all on table public.preventive_maintenance_events from public,anon,authenticated;
revoke all on table public.equipment_maintenance_history from public,anon,authenticated;
grant select,insert,update,delete on table public.preventive_maintenance_plans to service_role;
grant select,insert,update,delete on table public.preventive_maintenance_events to service_role;
grant select,insert,update,delete on table public.equipment_maintenance_history to service_role;

create or replace view public.v_equipment_maintenance_history
with (security_invoker=true)
as
select
  h.id,
  h.equipment_item_id,
  e.equipment_code,
  e.equipment_name,
  h.performed_at,
  h.maintenance_type,
  h.provider_name,
  h.cost_amount,
  h.notes,
  h.next_due_date,
  h.performed_by_profile_id,
  p.full_name as performed_by_name
from public.equipment_maintenance_history h
join public.equipment_items e on e.id=h.equipment_item_id
left join public.profiles p on p.id=h.performed_by_profile_id;

create or replace view public.v_preventive_maintenance_workbench
with (security_invoker=true)
as
with latest_task as (
  select distinct on (ev.plan_id)
    ev.plan_id,ev.service_task_id,t.task_status,t.due_at as service_task_due_at
  from public.preventive_maintenance_events ev
  left join public.equipment_service_tasks t on t.id=ev.service_task_id
  where ev.service_task_id is not null
  order by ev.plan_id,ev.event_at desc
), base as (
  select
    pm.id,
    pm.equipment_item_id,
    e.equipment_code,
    e.equipment_name,
    e.category,
    e.status as equipment_status,
    e.is_locked_out,
    e.current_meter_value,
    e.meter_unit as equipment_meter_unit,
    pm.plan_code,
    pm.plan_name,
    pm.maintenance_type,
    pm.schedule_basis,
    pm.interval_days,
    pm.meter_unit,
    pm.interval_meter,
    pm.anchor_date,
    pm.seasonal_month,
    pm.seasonal_day,
    pm.due_date,
    pm.due_meter,
    pm.lead_days,
    pm.lead_meter,
    pm.plan_status,
    pm.default_provider_name,
    pm.estimated_cost,
    pm.instructions,
    pm.last_completed_at,
    pm.last_completed_meter,
    lt.service_task_id,
    lt.task_status as service_task_status,
    lt.service_task_due_at
  from public.preventive_maintenance_plans pm
  join public.equipment_items e on e.id=pm.equipment_item_id
  left join latest_task lt on lt.plan_id=pm.id
)
select
  base.*,
  case
    when plan_status<>'active' then plan_status
    when schedule_basis in ('date','seasonal') and due_date is not null and due_date < current_date then 'overdue'
    when schedule_basis in ('date','seasonal') and due_date is not null and due_date = current_date then 'due'
    when schedule_basis in ('date','seasonal') and due_date is not null and due_date <= current_date + lead_days then 'due_soon'
    when schedule_basis in ('hours','kilometres') and due_meter is not null and coalesce(current_meter_value,0) >= due_meter then 'due'
    when schedule_basis in ('hours','kilometres') and due_meter is not null and coalesce(current_meter_value,0) >= greatest(0,due_meter-lead_meter) then 'due_soon'
    else 'scheduled'
  end as due_status,
  case
    when schedule_basis in ('hours','kilometres') and due_meter is not null then greatest(due_meter-coalesce(current_meter_value,0),0)
    else null
  end as meter_remaining
from base;

create or replace view public.v_preventive_maintenance_summary
with (security_invoker=true)
as
select
  count(*) filter(where plan_status='active')::int as active_plan_count,
  count(*) filter(where due_status='overdue')::int as overdue_count,
  count(*) filter(where due_status='due')::int as due_count,
  count(*) filter(where due_status='due_soon')::int as due_soon_count,
  count(*) filter(where service_task_id is not null and service_task_status not in ('resolved','cancelled'))::int as open_service_task_count,
  coalesce(sum(estimated_cost) filter(where plan_status='active'),0)::numeric(14,2) as active_estimated_cost
from public.v_preventive_maintenance_workbench;

revoke all on table public.v_equipment_maintenance_history from public,anon,authenticated;
revoke all on table public.v_preventive_maintenance_workbench from public,anon,authenticated;
revoke all on table public.v_preventive_maintenance_summary from public,anon,authenticated;
grant select on table public.v_equipment_maintenance_history to service_role;
grant select on table public.v_preventive_maintenance_workbench to service_role;
grant select on table public.v_preventive_maintenance_summary to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  222,'preventive_maintenance_engine',
  'Build 334 preventive maintenance plans by date, hours, kilometres and seasonal milestones with due forecasting, service-task linkage and existing maintenance-history completion.',
  'applied',now(),'schema222',
  'Reuses equipment_items, equipment_maintenance_history and equipment_service_tasks. Does not replace inspection/lockout, fleet or equipment registry authorities.',
  '222_preventive_maintenance_engine.sql','schema222'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true)
as
select
  222 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=222 then 'current'
    when coalesce(max(schema_version) filter(where status='applied'),0)>222 then 'ahead'
    else 'drift'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=222 then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter(where status='applied'),0)>222 then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
