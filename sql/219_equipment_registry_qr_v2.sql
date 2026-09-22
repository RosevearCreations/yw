begin;

-- Schema 219 — Build 331 Equipment Registry & QR System v2
-- equipment_items remains the physical-asset authority.
-- The existing exact equipment_identifier_registry remains the QR/barcode/asset-tag resolver.
-- Build 331 adds registry depth only: crew assignment, meters, manuals/photos/accessories,
-- lifecycle-cost evidence and replacement planning. Inspection/lockout/maintenance workflows
-- remain separate authorities for Builds 332/334.

alter table public.equipment_items
  add column if not exists assigned_crew_id uuid references public.crews(id) on delete set null,
  add column if not exists meter_type text not null default 'none',
  add column if not exists meter_unit text,
  add column if not exists current_meter_value numeric(14,2),
  add column if not exists current_meter_at timestamptz,
  add column if not exists replacement_state text not null default 'retain',
  add column if not exists replacement_target_date date,
  add column if not exists replacement_reason text,
  add column if not exists replacement_estimated_cost numeric(14,2),
  add column if not exists registry_v2_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.equipment_items'::regclass
      and conname='equipment_items_meter_type_chk'
  ) then
    alter table public.equipment_items
      add constraint equipment_items_meter_type_chk
      check (meter_type in ('none','hours','odometer','cycles','other'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.equipment_items'::regclass
      and conname='equipment_items_meter_value_chk'
  ) then
    alter table public.equipment_items
      add constraint equipment_items_meter_value_chk
      check (current_meter_value is null or current_meter_value >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.equipment_items'::regclass
      and conname='equipment_items_replacement_state_chk'
  ) then
    alter table public.equipment_items
      add constraint equipment_items_replacement_state_chk
      check (replacement_state in ('retain','monitor','plan_replacement','replace','retired'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.equipment_items'::regclass
      and conname='equipment_items_replacement_cost_chk'
  ) then
    alter table public.equipment_items
      add constraint equipment_items_replacement_cost_chk
      check (replacement_estimated_cost is null or replacement_estimated_cost >= 0);
  end if;
end;
$$;

create index if not exists equipment_items_assigned_crew_idx
  on public.equipment_items(assigned_crew_id)
  where assigned_crew_id is not null;
create index if not exists equipment_items_replacement_state_idx
  on public.equipment_items(replacement_state,replacement_target_date);

-- Give every existing physical asset a dedicated opaque QR token when one is missing.
-- The existing Schema 185 trigger refreshes equipment_identifier_registry and will
-- reject any collision rather than allowing ambiguous scan resolution.
update public.equipment_items
set qr_code_value='YWI-EQ-'||replace(gen_random_uuid()::text,'-',''),
    registry_v2_updated_at=now(),
    updated_at=now()
where nullif(btrim(coalesce(qr_code_value,'')),'') is null;

create table if not exists public.equipment_registry_documents (
  id uuid primary key default gen_random_uuid(),
  equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  document_type text not null default 'manual',
  title text not null,
  document_url text not null,
  version_label text,
  notes text,
  is_active boolean not null default true,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_registry_documents_type_chk
    check (document_type in ('manual','warranty','parts','service','registration','insurance','other')),
  constraint equipment_registry_documents_url_chk
    check (length(btrim(document_url)) between 4 and 2000)
);

create table if not exists public.equipment_registry_photos (
  id uuid primary key default gen_random_uuid(),
  equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  photo_kind text not null default 'profile',
  photo_url text not null,
  caption text,
  is_primary boolean not null default false,
  taken_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_registry_photos_kind_chk
    check (photo_kind in ('profile','serial','condition','accessory','label','other')),
  constraint equipment_registry_photos_url_chk
    check (length(btrim(photo_url)) between 4 and 2000)
);

create table if not exists public.equipment_accessory_registry (
  id uuid primary key default gen_random_uuid(),
  equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  accessory_name text not null,
  expected_quantity integer not null default 1,
  serial_number text,
  accessory_status text not null default 'active',
  replacement_cost numeric(14,2),
  notes text,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_accessory_registry_qty_chk check (expected_quantity between 0 and 1000),
  constraint equipment_accessory_registry_status_chk
    check (accessory_status in ('active','missing','damaged','retired')),
  constraint equipment_accessory_registry_cost_chk
    check (replacement_cost is null or replacement_cost >= 0)
);

create table if not exists public.equipment_meter_readings (
  id uuid primary key default gen_random_uuid(),
  equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  meter_value numeric(14,2) not null,
  meter_unit text not null,
  reading_source text not null default 'manual',
  recorded_at timestamptz not null default now(),
  recorded_by_profile_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  constraint equipment_meter_readings_value_chk check (meter_value >= 0),
  constraint equipment_meter_readings_source_chk
    check (reading_source in ('manual','inspection','service','checkout','return','import','other'))
);

alter table public.equipment_registry_documents enable row level security;
alter table public.equipment_registry_photos enable row level security;
alter table public.equipment_accessory_registry enable row level security;
alter table public.equipment_meter_readings enable row level security;

revoke all on table public.equipment_registry_documents from public,anon,authenticated;
revoke all on table public.equipment_registry_photos from public,anon,authenticated;
revoke all on table public.equipment_accessory_registry from public,anon,authenticated;
revoke all on table public.equipment_meter_readings from public,anon,authenticated;

grant select,insert,update,delete on table public.equipment_registry_documents to service_role;
grant select,insert,update,delete on table public.equipment_registry_photos to service_role;
grant select,insert,update,delete on table public.equipment_accessory_registry to service_role;
grant select,insert,update,delete on table public.equipment_meter_readings to service_role;

create index if not exists equipment_registry_documents_item_idx
  on public.equipment_registry_documents(equipment_item_id,is_active,updated_at desc);
create index if not exists equipment_registry_documents_creator_idx
  on public.equipment_registry_documents(created_by_profile_id);
create index if not exists equipment_registry_photos_item_idx
  on public.equipment_registry_photos(equipment_item_id,is_primary desc,updated_at desc);
create index if not exists equipment_registry_photos_creator_idx
  on public.equipment_registry_photos(created_by_profile_id);
create index if not exists equipment_accessory_registry_item_idx
  on public.equipment_accessory_registry(equipment_item_id,accessory_status,updated_at desc);
create index if not exists equipment_accessory_registry_updater_idx
  on public.equipment_accessory_registry(updated_by_profile_id);
create index if not exists equipment_meter_readings_item_idx
  on public.equipment_meter_readings(equipment_item_id,recorded_at desc);
create index if not exists equipment_meter_readings_recorder_idx
  on public.equipment_meter_readings(recorded_by_profile_id);

create or replace view public.v_equipment_registry_v2
with (security_invoker=true)
as
with service_cost as (
  select
    equipment_item_id,
    count(*)::int as recorded_service_event_count,
    coalesce(sum(cost),0)::numeric(14,2) as recorded_service_cost_total,
    max(serviced_at) as latest_recorded_service_at
  from public.equipment_service_history
  group by equipment_item_id
), task_rollup as (
  select
    equipment_item_id,
    count(*) filter(where task_status not in ('resolved','closed','cancelled'))::int as open_service_task_count,
    coalesce(sum(estimated_cost) filter(where task_status not in ('resolved','closed','cancelled')),0)::numeric(14,2) as open_service_estimated_cost,
    coalesce(sum(actual_cost),0)::numeric(14,2) as service_task_actual_cost_total
  from public.equipment_service_tasks
  group by equipment_item_id
), document_rollup as (
  select
    equipment_item_id,
    count(*) filter(where is_active)::int as document_count,
    jsonb_agg(
      jsonb_build_object(
        'id',id,'document_type',document_type,'title',title,'document_url',document_url,
        'version_label',version_label,'notes',notes,'is_active',is_active,'updated_at',updated_at
      ) order by updated_at desc
    ) filter(where is_active) as documents
  from public.equipment_registry_documents
  group by equipment_item_id
), photo_rollup as (
  select
    equipment_item_id,
    count(*)::int as registry_photo_count,
    jsonb_agg(
      jsonb_build_object(
        'id',id,'photo_kind',photo_kind,'photo_url',photo_url,'caption',caption,
        'is_primary',is_primary,'taken_at',taken_at,'updated_at',updated_at
      ) order by is_primary desc,updated_at desc
    ) as registry_photos
  from public.equipment_registry_photos
  group by equipment_item_id
), accessory_rollup as (
  select
    equipment_item_id,
    count(*)::int as accessory_line_count,
    coalesce(sum(expected_quantity),0)::int as expected_accessory_quantity,
    count(*) filter(where accessory_status in ('missing','damaged'))::int as accessory_attention_count,
    coalesce(sum(replacement_cost * greatest(expected_quantity,1)) filter(where accessory_status in ('missing','damaged')),0)::numeric(14,2) as accessory_replacement_exposure,
    jsonb_agg(
      jsonb_build_object(
        'id',id,'accessory_name',accessory_name,'expected_quantity',expected_quantity,
        'serial_number',serial_number,'accessory_status',accessory_status,
        'replacement_cost',replacement_cost,'notes',notes,'updated_at',updated_at
      ) order by accessory_name
    ) as accessories
  from public.equipment_accessory_registry
  group by equipment_item_id
), meter_rollup as (
  select distinct on (equipment_item_id)
    equipment_item_id,meter_value,meter_unit,reading_source,recorded_at as latest_meter_reading_at
  from public.equipment_meter_readings
  order by equipment_item_id,recorded_at desc,created_at desc
)
select
  d.*,
  e.assigned_crew_id,
  c.crew_code as assigned_crew_code,
  c.crew_name as assigned_crew_name,
  e.qr_code_value,
  e.barcode_value,
  e.verifier_role_required,
  e.accessory_checklist_required,
  e.purchase_vendor,
  coalesce(e.purchase_cost,e.purchase_price,0)::numeric(14,2) as acquisition_cost,
  e.warranty_expiry_date,
  e.year_of_manufacture,
  e.meter_type,
  e.meter_unit,
  e.current_meter_value,
  e.current_meter_at,
  mr.meter_value as latest_meter_reading_value,
  mr.meter_unit as latest_meter_reading_unit,
  mr.reading_source as latest_meter_reading_source,
  mr.latest_meter_reading_at,
  e.locked_out_at,
  e.lockout_reason,
  coalesce(dr.document_count,0) as document_count,
  coalesce(dr.documents,'[]'::jsonb) as registry_documents,
  coalesce(pr.registry_photo_count,0) as registry_photo_count,
  coalesce(pr.registry_photos,'[]'::jsonb) as registry_photos,
  coalesce(ar.accessory_line_count,0) as accessory_line_count,
  coalesce(ar.expected_accessory_quantity,0) as expected_accessory_quantity,
  coalesce(ar.accessory_attention_count,0) as accessory_attention_count,
  coalesce(ar.accessory_replacement_exposure,0)::numeric(14,2) as accessory_replacement_exposure,
  coalesce(ar.accessories,'[]'::jsonb) as registry_accessories,
  coalesce(sc.recorded_service_event_count,0) as recorded_service_event_count,
  coalesce(sc.recorded_service_cost_total,0)::numeric(14,2) as recorded_service_cost_total,
  sc.latest_recorded_service_at,
  coalesce(tr.open_service_task_count,0) as open_service_task_count,
  coalesce(tr.open_service_estimated_cost,0)::numeric(14,2) as open_service_estimated_cost,
  coalesce(tr.service_task_actual_cost_total,0)::numeric(14,2) as service_task_actual_cost_total,
  (
    coalesce(e.purchase_cost,e.purchase_price,0)
    + coalesce(sc.recorded_service_cost_total,0)
  )::numeric(14,2) as recorded_lifecycle_cost_total,
  e.replacement_state,
  e.replacement_target_date,
  e.replacement_reason,
  e.replacement_estimated_cost,
  e.qr_code_value as qr_label_value,
  case
    when nullif(btrim(coalesce(e.qr_code_value,'')),'') is null then 'missing'
    when qr.identifier_value is null then 'registry_mismatch'
    else 'ready'
  end as qr_identity_status,
  coalesce(idc.identifier_count,0) as exact_identifier_count,
  case
    when e.is_locked_out then 'locked_out'
    when e.replacement_state in ('replace','retired') then 'replacement_hold'
    when coalesce(ar.accessory_attention_count,0)>0 then 'accessory_attention'
    when coalesce(tr.open_service_task_count,0)>0 then 'service_attention'
    when e.next_inspection_due_date is not null and e.next_inspection_due_date < current_date then 'inspection_overdue'
    when e.next_service_due_date is not null and e.next_service_due_date < current_date then 'service_overdue'
    else 'ready'
  end as registry_readiness_status,
  e.registry_v2_updated_at
from public.v_equipment_directory d
join public.equipment_items e on e.id=d.id
left join public.crews c on c.id=e.assigned_crew_id
left join service_cost sc on sc.equipment_item_id=e.id
left join task_rollup tr on tr.equipment_item_id=e.id
left join document_rollup dr on dr.equipment_item_id=e.id
left join photo_rollup pr on pr.equipment_item_id=e.id
left join accessory_rollup ar on ar.equipment_item_id=e.id
left join meter_rollup mr on mr.equipment_item_id=e.id
left join public.equipment_identifier_registry qr
  on qr.equipment_item_id=e.id
 and qr.identifier_kind='qr_code_value'
 and qr.identifier_value=e.qr_code_value
left join lateral (
  select count(*)::int as identifier_count
  from public.equipment_identifier_registry ir
  where ir.equipment_item_id=e.id
) idc on true;

create or replace view public.v_equipment_registry_v2_summary
with (security_invoker=true)
as
select
  count(*)::int as asset_count,
  count(*) filter(where qr_identity_status='ready')::int as qr_ready_count,
  count(*) filter(where qr_identity_status<>'ready')::int as qr_attention_count,
  count(*) filter(where is_locked_out)::int as locked_out_count,
  count(*) filter(where registry_readiness_status='inspection_overdue')::int as inspection_overdue_count,
  count(*) filter(where registry_readiness_status='service_overdue')::int as service_overdue_count,
  count(*) filter(where open_service_task_count>0)::int as open_service_asset_count,
  count(*) filter(where accessory_attention_count>0)::int as accessory_attention_asset_count,
  count(*) filter(where replacement_state in ('plan_replacement','replace','retired'))::int as replacement_attention_count,
  coalesce(sum(recorded_lifecycle_cost_total),0)::numeric(14,2) as recorded_lifecycle_cost_total,
  coalesce(sum(open_service_estimated_cost),0)::numeric(14,2) as open_service_estimated_cost,
  max(registry_v2_updated_at) as last_updated_at
from public.v_equipment_registry_v2;

revoke all on table public.v_equipment_registry_v2 from public,anon,authenticated;
revoke all on table public.v_equipment_registry_v2_summary from public,anon,authenticated;
grant select on table public.v_equipment_registry_v2 to service_role;
grant select on table public.v_equipment_registry_v2_summary to service_role;

create or replace function public.ywi_equipment_registry_v2_security_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'registry_children_private',
    case when
      coalesce((select relrowsecurity from pg_class where oid='public.equipment_registry_documents'::regclass),false)
      and coalesce((select relrowsecurity from pg_class where oid='public.equipment_registry_photos'::regclass),false)
      and coalesce((select relrowsecurity from pg_class where oid='public.equipment_accessory_registry'::regclass),false)
      and coalesce((select relrowsecurity from pg_class where oid='public.equipment_meter_readings'::regclass),false)
      and not exists(
        select 1 from information_schema.table_privileges
        where table_schema='public'
          and table_name in ('equipment_registry_documents','equipment_registry_photos','equipment_accessory_registry','equipment_meter_readings')
          and grantee in ('anon','authenticated','PUBLIC')
      )
    then 'passed' else 'failed' end,
    'Registry evidence tables use RLS and remain service-private.'
  union all
  select 'registry_views_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('v_equipment_registry_v2','v_equipment_registry_v2_summary')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Equipment registry v2 read models remain server-only.'
  union all
  select 'physical_equipment_authority_preserved',
    case when
      to_regclass('public.equipment_items') is not null
      and not exists(
        select 1
        from information_schema.columns
        where table_schema='public'
          and table_name in ('equipment_registry_documents','equipment_registry_photos','equipment_accessory_registry','equipment_meter_readings')
          and column_name='equipment_code'
      )
    then 'passed' else 'failed' end,
    'Child registry evidence links to equipment_items rather than creating a second physical-asset identity.'
  union all
  select 'qr_identity_registry_reused',
    case when not exists(
      select 1
      from public.equipment_items e
      left join public.equipment_identifier_registry ir
        on ir.equipment_item_id=e.id
       and ir.identifier_kind='qr_code_value'
       and ir.identifier_value=e.qr_code_value
      where nullif(btrim(coalesce(e.qr_code_value,'')),'') is null or ir.identifier_value is null
    ) then 'passed' else 'failed' end,
    'Every physical asset has a QR token resolved by the existing exact identifier registry.'
  union all
  select 'meter_values_nonnegative',
    case when not exists(
      select 1 from public.equipment_items where current_meter_value < 0
    ) and not exists(
      select 1 from public.equipment_meter_readings where meter_value < 0
    ) then 'passed' else 'failed' end,
    'Current and historical meter values cannot be negative.'
  union all
  select 'lifecycle_cost_components_explicit',
    case when not exists(
      select 1 from public.v_equipment_registry_v2
      where recorded_lifecycle_cost_total < 0 or open_service_estimated_cost < 0
    ) then 'passed' else 'failed' end,
    'Recorded lifecycle cost and open service estimate remain separate nonnegative measures.'
  union all
  select 'replacement_state_bounded',
    case when not exists(
      select 1 from public.equipment_items
      where replacement_state not in ('retain','monitor','plan_replacement','replace','retired')
    ) then 'passed' else 'failed' end,
    'Equipment replacement planning uses the bounded registry lifecycle states.';
$$;

revoke all on function public.ywi_equipment_registry_v2_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_equipment_registry_v2_security_assertions() to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  219,'equipment_registry_qr_v2',
  'Build 331 equipment registry v2: QR identity coverage, crew assignment, manuals/photos/accessories, meter evidence, lifecycle cost and replacement state.',
  'applied',now(),'schema219',
  'equipment_items and Schema 185 exact identifier registry remain authoritative. Daily inspections/lockout and preventive-maintenance engines remain separate later builds.',
  '219_equipment_registry_qr_v2.sql','schema219'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true)
as
select
  219 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=219 then 'current'
    when coalesce(max(schema_version) filter(where status='applied'),0)>219 then 'ahead'
    else 'drift'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=219 then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter(where status='applied'),0)>219 then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end as message,
  now() as checked_at
from public.app_schema_versions;

revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
