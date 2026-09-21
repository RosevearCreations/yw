begin;

-- Schema 220 — Build 332 Daily Equipment Inspection & Lockout
-- Reuses equipment_items, equipment_service_tasks and existing lockout authority.
-- Adds daily pre-use/post-use checklist evidence, supervisor review and verified return-to-service.

create table if not exists public.equipment_daily_inspection_templates (
  id uuid primary key default gen_random_uuid(),
  template_code text not null unique,
  template_name text not null,
  equipment_category text,
  equipment_item_id bigint references public.equipment_items(id) on delete cascade,
  inspection_stage text not null default 'pre_use',
  version_label text,
  is_active boolean not null default true,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (inspection_stage in ('pre_use','post_use'))
);

create table if not exists public.equipment_daily_inspection_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.equipment_daily_inspection_templates(id) on delete cascade,
  item_key text not null,
  inspection_area text not null,
  item_label text not null,
  display_order integer not null default 0,
  is_safety_critical boolean not null default false,
  requires_note_on_fail boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(template_id,item_key)
);

create table if not exists public.equipment_daily_inspections (
  id uuid primary key default gen_random_uuid(),
  equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  template_id uuid references public.equipment_daily_inspection_templates(id) on delete set null,
  job_id bigint references public.jobs(id) on delete set null,
  inspection_stage text not null,
  inspection_date date not null default current_date,
  inspected_at timestamptz not null default now(),
  inspector_profile_id uuid references public.profiles(id) on delete set null,
  meter_value numeric(14,2),
  meter_unit text,
  overall_status text not null default 'pass',
  safety_critical_failure boolean not null default false,
  defect_summary text,
  lockout_created boolean not null default false,
  service_task_id uuid references public.equipment_service_tasks(id) on delete set null,
  supervisor_review_status text not null default 'pending',
  supervisor_review_notes text,
  supervisor_reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  supervisor_reviewed_at timestamptz,
  return_to_service_status text not null default 'not_required',
  return_to_service_notes text,
  returned_to_service_by_profile_id uuid references public.profiles(id) on delete set null,
  returned_to_service_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (inspection_stage in ('pre_use','post_use')),
  check (overall_status in ('pass','fail','needs_review')),
  check (supervisor_review_status in ('pending','approved','rejected','not_required')),
  check (return_to_service_status in ('not_required','blocked','ready_for_verification','verified'))
);

create table if not exists public.equipment_daily_inspection_items (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.equipment_daily_inspections(id) on delete cascade,
  template_item_id uuid references public.equipment_daily_inspection_template_items(id) on delete set null,
  item_key text not null,
  inspection_area text not null,
  item_label text not null,
  result_status text not null default 'pass',
  is_safety_critical boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  check (result_status in ('pass','fail','na')),
  unique(inspection_id,item_key)
);

create index if not exists equipment_daily_inspections_item_idx
  on public.equipment_daily_inspections(equipment_item_id,inspected_at desc);
create index if not exists equipment_daily_inspections_review_idx
  on public.equipment_daily_inspections(supervisor_review_status,return_to_service_status,inspected_at desc);
create index if not exists equipment_daily_template_lookup_idx
  on public.equipment_daily_inspection_templates(equipment_item_id,equipment_category,inspection_stage,is_active);

alter table public.equipment_daily_inspection_templates enable row level security;
alter table public.equipment_daily_inspection_template_items enable row level security;
alter table public.equipment_daily_inspections enable row level security;
alter table public.equipment_daily_inspection_items enable row level security;

revoke all on table public.equipment_daily_inspection_templates from public,anon,authenticated;
revoke all on table public.equipment_daily_inspection_template_items from public,anon,authenticated;
revoke all on table public.equipment_daily_inspections from public,anon,authenticated;
revoke all on table public.equipment_daily_inspection_items from public,anon,authenticated;

grant select,insert,update,delete on table public.equipment_daily_inspection_templates to service_role;
grant select,insert,update,delete on table public.equipment_daily_inspection_template_items to service_role;
grant select,insert,update,delete on table public.equipment_daily_inspections to service_role;
grant select,insert,update,delete on table public.equipment_daily_inspection_items to service_role;

insert into public.equipment_daily_inspection_templates
  (template_code,template_name,equipment_category,inspection_stage,version_label)
values
  ('DAILY-GENERAL-PRE','General equipment pre-use','general','pre_use','332-v1'),
  ('DAILY-GENERAL-POST','General equipment post-use','general','post_use','332-v1'),
  ('DAILY-MOWER-PRE','Mower pre-use','mower','pre_use','332-v1'),
  ('DAILY-MOWER-POST','Mower post-use','mower','post_use','332-v1'),
  ('DAILY-HANDHELD-PRE','Handheld powered equipment pre-use','handheld_power','pre_use','332-v1'),
  ('DAILY-HANDHELD-POST','Handheld powered equipment post-use','handheld_power','post_use','332-v1')
on conflict (template_code) do update
set template_name=excluded.template_name,
    equipment_category=excluded.equipment_category,
    inspection_stage=excluded.inspection_stage,
    version_label=excluded.version_label,
    is_active=true,
    updated_at=now();

with seed(template_code,item_key,inspection_area,item_label,display_order,is_safety_critical) as (
  values
  ('DAILY-GENERAL-PRE','guards','guards_safety','Guards and safety systems secure and functional',10,true),
  ('DAILY-GENERAL-PRE','fluids','fluids','Fluids checked; no active leaks',20,true),
  ('DAILY-GENERAL-PRE','cutting','cutting_components','Blades/cutting components secure and serviceable',30,true),
  ('DAILY-GENERAL-PRE','tires','tires_wheels','Tires/wheels secure and serviceable',40,true),
  ('DAILY-GENERAL-PRE','power','fuel_battery','Fuel/battery condition safe for use',50,true),
  ('DAILY-GENERAL-PRE','accessories','accessories','Required accessories present and secure',60,false),
  ('DAILY-GENERAL-PRE','damage','damage_defects','No unsafe damage or unresolved defect observed',70,true),
  ('DAILY-GENERAL-POST','guards','guards_safety','Guards and safety systems intact after use',10,true),
  ('DAILY-GENERAL-POST','fluids','fluids','No new leak or fluid issue after use',20,true),
  ('DAILY-GENERAL-POST','cutting','cutting_components','Blades/cutting components checked after use',30,true),
  ('DAILY-GENERAL-POST','tires','tires_wheels','Tires/wheels checked after use',40,true),
  ('DAILY-GENERAL-POST','power','fuel_battery','Fuel/battery left in safe condition',50,true),
  ('DAILY-GENERAL-POST','accessories','accessories','Accessories returned/accounted for',60,false),
  ('DAILY-GENERAL-POST','damage','damage_defects','Damage/defects from use recorded',70,true),
  ('DAILY-MOWER-PRE','guards','guards_safety','Discharge guard, interlocks and operator safety systems functional',10,true),
  ('DAILY-MOWER-PRE','fluids','fluids','Engine/hydraulic fluids and leaks checked',20,true),
  ('DAILY-MOWER-PRE','blades','cutting_components','Blades, deck and fasteners secure',30,true),
  ('DAILY-MOWER-PRE','tires','tires_wheels','Tires/wheels and lug hardware checked',40,true),
  ('DAILY-MOWER-PRE','power','fuel_battery','Fuel/battery condition safe',50,true),
  ('DAILY-MOWER-PRE','accessories','accessories','Keys, deflector and required accessories present',60,false),
  ('DAILY-MOWER-PRE','damage','damage_defects','No unsafe damage or unresolved defect',70,true),
  ('DAILY-MOWER-POST','guards','guards_safety','Safety systems and guards intact after use',10,true),
  ('DAILY-MOWER-POST','fluids','fluids','No leak or fluid issue after use',20,true),
  ('DAILY-MOWER-POST','blades','cutting_components','Deck/blades checked for damage or obstruction',30,true),
  ('DAILY-MOWER-POST','tires','tires_wheels','Tires/wheels checked for damage',40,true),
  ('DAILY-MOWER-POST','power','fuel_battery','Fuel/battery left safe for storage/next use',50,true),
  ('DAILY-MOWER-POST','accessories','accessories','Accessories returned/accounted for',60,false),
  ('DAILY-MOWER-POST','damage','damage_defects','New damage/defects recorded',70,true)
)
insert into public.equipment_daily_inspection_template_items
  (template_id,item_key,inspection_area,item_label,display_order,is_safety_critical)
select t.id,s.item_key,s.inspection_area,s.item_label,s.display_order,s.is_safety_critical
from seed s
join public.equipment_daily_inspection_templates t on t.template_code=s.template_code
on conflict (template_id,item_key) do update
set inspection_area=excluded.inspection_area,
    item_label=excluded.item_label,
    display_order=excluded.display_order,
    is_safety_critical=excluded.is_safety_critical,
    is_active=true;

create or replace view public.v_equipment_daily_inspection_templates
with (security_invoker=true)
as
select
  t.id,t.template_code,t.template_name,t.equipment_category,t.equipment_item_id,t.inspection_stage,
  t.version_label,t.is_active,
  coalesce(jsonb_agg(jsonb_build_object(
    'id',i.id,'item_key',i.item_key,'inspection_area',i.inspection_area,'item_label',i.item_label,
    'display_order',i.display_order,'is_safety_critical',i.is_safety_critical,'requires_note_on_fail',i.requires_note_on_fail
  ) order by i.display_order) filter (where i.id is not null and i.is_active),'[]'::jsonb) as checklist_items
from public.equipment_daily_inspection_templates t
left join public.equipment_daily_inspection_template_items i on i.template_id=t.id
where t.is_active
group by t.id;

create or replace view public.v_equipment_daily_inspection_workbench
with (security_invoker=true)
as
select
  d.*,
  e.equipment_code,e.equipment_name,e.category,e.asset_tag,e.qr_code_value,e.barcode_value,
  e.is_locked_out,e.lockout_reason,e.defect_status,e.defect_notes,
  p.full_name as inspector_name,
  r.full_name as supervisor_reviewer_name,
  s.full_name as returned_to_service_by_name,
  st.task_status as service_task_status,
  st.task_type as service_task_type,
  st.failure_reason as service_failure_reason,
  coalesce(items.items,'[]'::jsonb) as inspection_items,
  coalesce(items.failed_item_count,0) as failed_item_count,
  coalesce(items.critical_failed_item_count,0) as critical_failed_item_count
from public.equipment_daily_inspections d
join public.equipment_items e on e.id=d.equipment_item_id
left join public.profiles p on p.id=d.inspector_profile_id
left join public.profiles r on r.id=d.supervisor_reviewed_by_profile_id
left join public.profiles s on s.id=d.returned_to_service_by_profile_id
left join public.equipment_service_tasks st on st.id=d.service_task_id
left join lateral (
  select
    count(*) filter(where di.result_status='fail')::int as failed_item_count,
    count(*) filter(where di.result_status='fail' and di.is_safety_critical)::int as critical_failed_item_count,
    jsonb_agg(jsonb_build_object(
      'id',di.id,'item_key',di.item_key,'inspection_area',di.inspection_area,'item_label',di.item_label,
      'result_status',di.result_status,'is_safety_critical',di.is_safety_critical,'note',di.note
    ) order by di.created_at,di.item_key) as items
  from public.equipment_daily_inspection_items di
  where di.inspection_id=d.id
) items on true;

create or replace view public.v_equipment_daily_inspection_summary
with (security_invoker=true)
as
select
  count(*) filter(where inspection_date=current_date)::int as today_count,
  count(*) filter(where inspection_date=current_date and inspection_stage='pre_use')::int as today_pre_use_count,
  count(*) filter(where inspection_date=current_date and inspection_stage='post_use')::int as today_post_use_count,
  count(*) filter(where safety_critical_failure)::int as critical_failure_count,
  count(*) filter(where supervisor_review_status='pending')::int as supervisor_review_pending_count,
  count(*) filter(where return_to_service_status in ('blocked','ready_for_verification'))::int as return_to_service_pending_count
from public.equipment_daily_inspections;

revoke all on table public.v_equipment_daily_inspection_templates from public,anon,authenticated;
revoke all on table public.v_equipment_daily_inspection_workbench from public,anon,authenticated;
revoke all on table public.v_equipment_daily_inspection_summary from public,anon,authenticated;
grant select on table public.v_equipment_daily_inspection_templates to service_role;
grant select on table public.v_equipment_daily_inspection_workbench to service_role;
grant select on table public.v_equipment_daily_inspection_summary to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  220,'daily_equipment_inspection_lockout',
  'Build 332 daily equipment pre-use/post-use inspection, fail-closed critical lockout, supervisor review and verified return to service.',
  'applied',now(),'schema220',
  'Reuses equipment_items, existing equipment lockout fields and equipment_service_tasks; does not replace asset, service or preventive-maintenance authority.',
  '220_daily_equipment_inspection_lockout.sql','schema220'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true)
as
select
  220 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=220 then 'current'
    when coalesce(max(schema_version) filter(where status='applied'),0)>220 then 'ahead'
    else 'drift'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=220 then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter(where status='applied'),0)>220 then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
