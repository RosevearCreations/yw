-- 185_equipment_scan_identity_custody_hardening.sql
-- Build 2026-09-02q
--
-- Purpose:
-- - Connect physical Jobs equipment_items to Shared Core canonical equipment_master.
-- - Maintain one private exact identifier registry across equipment code, asset tag,
--   serial number, QR value and barcode value so a scan can never silently pick a
--   different physical asset through a colliding identifier.
-- - Harden scan -> custody provenance with an explicit FK, one-custody-row-per-scan,
--   and custody idempotency support.
-- - Keep equipment_scan_event Jobs-owned at Jobs/create.
-- - Leave Finance, payment providers and Production untouched.

begin;

alter table public.equipment_items
  add column if not exists equipment_master_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.equipment_items'::regclass
      and conname='equipment_items_equipment_master_id_fkey'
  ) then
    alter table public.equipment_items
      add constraint equipment_items_equipment_master_id_fkey
      foreign key (equipment_master_id) references public.equipment_master(id) on delete restrict;
  end if;
end;
$$;

-- Backfill safely if this migration is replayed after physical equipment has been added.
-- At the Build 185 boundary both tables are empty, but the migration remains deterministic.
insert into public.equipment_master(
  equipment_code,item_name,equipment_category,manufacturer,model,notes,is_active
)
select
  e.equipment_code,e.equipment_name,e.category,e.manufacturer,e.model_number,
  'Canonical equipment identity converged by Schema 185.',true
from public.equipment_items e
where e.equipment_master_id is null
on conflict(equipment_code) do update set
  item_name=excluded.item_name,
  equipment_category=coalesce(excluded.equipment_category,public.equipment_master.equipment_category),
  manufacturer=coalesce(excluded.manufacturer,public.equipment_master.manufacturer),
  model=coalesce(excluded.model,public.equipment_master.model),
  updated_at=now();

update public.equipment_items e
set equipment_master_id=m.id
from public.equipment_master m
where e.equipment_master_id is null
  and m.equipment_code=e.equipment_code;

create or replace function public.ywi_link_equipment_item_master()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
declare
  v_master_id uuid;
  v_master_code text;
begin
  new.equipment_code := btrim(coalesce(new.equipment_code,''));
  new.equipment_name := btrim(coalesce(new.equipment_name,''));

  if new.equipment_code='' then
    raise exception 'equipment_code is required for canonical equipment identity.' using errcode='23514';
  end if;
  if new.equipment_name='' then
    raise exception 'equipment_name is required for canonical equipment identity.' using errcode='23514';
  end if;

  if new.equipment_master_id is null then
    select id,equipment_code into v_master_id,v_master_code
    from public.equipment_master
    where equipment_code=new.equipment_code
    limit 1;

    if v_master_id is null then
      insert into public.equipment_master(
        equipment_code,item_name,equipment_category,manufacturer,model,notes,is_active
      ) values(
        new.equipment_code,new.equipment_name,new.category,new.manufacturer,new.model_number,
        'Canonical identity created from Jobs physical equipment.',true
      ) returning id,equipment_code into v_master_id,v_master_code;
    end if;
    new.equipment_master_id := v_master_id;
  else
    select equipment_code into v_master_code
    from public.equipment_master
    where id=new.equipment_master_id
    for update;

    if not found then
      raise exception 'equipment_master_id % does not exist.',new.equipment_master_id using errcode='23503';
    end if;

    if coalesce(btrim(v_master_code),'')='' then
      update public.equipment_master
      set equipment_code=new.equipment_code,updated_at=now()
      where id=new.equipment_master_id;
      v_master_code:=new.equipment_code;
    elsif v_master_code<>new.equipment_code then
      if tg_op='UPDATE'
         and old.equipment_master_id=new.equipment_master_id
         and old.equipment_code=v_master_code then
        update public.equipment_master
        set equipment_code=new.equipment_code,updated_at=now()
        where id=new.equipment_master_id;
        v_master_code:=new.equipment_code;
      else
        raise exception 'Physical equipment code % does not match canonical equipment code %.',new.equipment_code,v_master_code using errcode='23514';
      end if;
    end if;
  end if;

  update public.equipment_master
  set item_name=new.equipment_name,
      equipment_category=coalesce(nullif(btrim(coalesce(new.category,'')),''),equipment_category),
      manufacturer=coalesce(nullif(btrim(coalesce(new.manufacturer,'')),''),manufacturer),
      model=coalesce(nullif(btrim(coalesce(new.model_number,'')),''),model),
      updated_at=now()
  where id=new.equipment_master_id;

  return new;
end;
$$;

drop trigger if exists trg_link_equipment_item_master on public.equipment_items;
create trigger trg_link_equipment_item_master
before insert or update of equipment_code,equipment_name,category,manufacturer,model_number,equipment_master_id
on public.equipment_items
for each row execute function public.ywi_link_equipment_item_master();

do $$
begin
  if exists(select 1 from public.equipment_items where equipment_master_id is null) then
    raise exception 'Schema 185 cannot require canonical identity while unlinked physical equipment remains.' using errcode='23514';
  end if;
end;
$$;

alter table public.equipment_items
  alter column equipment_master_id set not null;

create table if not exists public.equipment_identifier_registry(
  identifier_value text primary key,
  identifier_kind text not null check(identifier_kind in (
    'equipment_code','asset_tag','serial_number','qr_code_value','barcode_value'
  )),
  equipment_item_id bigint not null references public.equipment_items(id) on delete cascade,
  equipment_master_id uuid not null references public.equipment_master(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_identifier_registry_value_check check(
    identifier_value=btrim(identifier_value) and length(identifier_value) between 1 and 180
  ),
  unique(equipment_item_id,identifier_kind)
);

alter table public.equipment_identifier_registry enable row level security;
revoke all on table public.equipment_identifier_registry from public,anon,authenticated;
grant select,insert,update,delete on table public.equipment_identifier_registry to service_role;

create or replace function public.ywi_refresh_equipment_identifier_registry()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
declare
  v_identifier record;
begin
  delete from public.equipment_identifier_registry where equipment_item_id=new.id;

  for v_identifier in
    select btrim(v.identifier_value) as identifier_value,v.identifier_kind
    from (values
      (new.equipment_code,'equipment_code'::text),
      (new.asset_tag,'asset_tag'::text),
      (new.serial_number,'serial_number'::text),
      (new.qr_code_value,'qr_code_value'::text),
      (new.barcode_value,'barcode_value'::text)
    ) as v(identifier_value,identifier_kind)
    where nullif(btrim(coalesce(v.identifier_value,'')),'') is not null
  loop
    -- No ON CONFLICT: a collision must abort the equipment write rather than make
    -- scan resolution ambiguous. The registry primary key is the exact raw identifier.
    insert into public.equipment_identifier_registry(
      identifier_value,identifier_kind,equipment_item_id,equipment_master_id
    ) values(
      v_identifier.identifier_value,v_identifier.identifier_kind,new.id,new.equipment_master_id
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_refresh_equipment_identifier_registry on public.equipment_items;
create trigger trg_refresh_equipment_identifier_registry
after insert or update of equipment_code,asset_tag,serial_number,qr_code_value,barcode_value,equipment_master_id
on public.equipment_items
for each row execute function public.ywi_refresh_equipment_identifier_registry();

insert into public.equipment_identifier_registry(
  identifier_value,identifier_kind,equipment_item_id,equipment_master_id
)
select btrim(v.identifier_value),v.identifier_kind,e.id,e.equipment_master_id
from public.equipment_items e
cross join lateral (values
  (e.equipment_code,'equipment_code'::text),
  (e.asset_tag,'asset_tag'::text),
  (e.serial_number,'serial_number'::text),
  (e.qr_code_value,'qr_code_value'::text),
  (e.barcode_value,'barcode_value'::text)
) as v(identifier_value,identifier_kind)
where nullif(btrim(coalesce(v.identifier_value,'')),'') is not null
on conflict(identifier_value) do update set
  identifier_kind=excluded.identifier_kind,
  equipment_item_id=excluded.equipment_item_id,
  equipment_master_id=excluded.equipment_master_id,
  updated_at=now();

alter table public.equipment_custody_timeline_events
  add column if not exists idempotency_key text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.equipment_custody_timeline_events'::regclass
      and conname='equipment_custody_timeline_events_scan_event_id_fkey'
  ) then
    alter table public.equipment_custody_timeline_events
      add constraint equipment_custody_timeline_events_scan_event_id_fkey
      foreign key(scan_event_id) references public.equipment_scan_events(id) on delete restrict;
  end if;
end;
$$;

create unique index if not exists equipment_custody_timeline_events_scan_event_uidx
  on public.equipment_custody_timeline_events(scan_event_id)
  where scan_event_id is not null;

create unique index if not exists equipment_custody_timeline_events_idempotency_uidx
  on public.equipment_custody_timeline_events(idempotency_key)
  where idempotency_key is not null;

create index if not exists equipment_identifier_registry_item_idx
  on public.equipment_identifier_registry(equipment_item_id,identifier_kind);
create index if not exists equipment_identifier_registry_master_idx
  on public.equipment_identifier_registry(equipment_master_id);

do $$
begin
  if exists(select 1 from public.equipment_custody_timeline_events where scan_event_id is null) then
    raise exception 'Schema 185 cannot require scan provenance while custody events without scan_event_id exist.' using errcode='23514';
  end if;
end;
$$;

alter table public.equipment_custody_timeline_events
  alter column scan_event_id set not null;

create or replace function public.ywi_equipment_scan_security_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select 'physical_items_link_canonical_master',
         case when not exists(
           select 1 from public.equipment_items e
           left join public.equipment_master m on m.id=e.equipment_master_id
           where m.id is null or m.equipment_code is distinct from e.equipment_code
         ) then 'passed' else 'failed' end,
         'Every physical Jobs equipment item must link to an existing canonical equipment_master with the same equipment_code.'
  union all
  select 'identifier_registry_exact_unique',
         case when (
           select count(*) from public.equipment_identifier_registry
         )=(
           select count(*)
           from public.equipment_items e
           cross join lateral (values(e.equipment_code),(e.asset_tag),(e.serial_number),(e.qr_code_value),(e.barcode_value)) v(identifier_value)
           where nullif(btrim(coalesce(v.identifier_value,'')),'') is not null
         ) then 'passed' else 'failed' end,
         'Every nonblank equipment code, asset tag, serial, QR value and barcode value has one exact private registry entry.'
  union all
  select 'identifier_registry_rls',
         case when coalesce((select relrowsecurity from pg_class where oid='public.equipment_identifier_registry'::regclass),false) then 'passed' else 'failed' end,
         'The private identifier registry must keep RLS enabled.'
  union all
  select 'scan_idempotency_contract',
         case when to_regclass('public.equipment_scan_events_idempotency_uidx') is not null then 'passed' else 'failed' end,
         'equipment_scan_events keeps its unique idempotency index.'
  union all
  select 'custody_scan_provenance',
         case when exists(
           select 1 from pg_constraint
           where conrelid='public.equipment_custody_timeline_events'::regclass
             and conname='equipment_custody_timeline_events_scan_event_id_fkey'
         ) and to_regclass('public.equipment_custody_timeline_events_scan_event_uidx') is not null
         then 'passed' else 'failed' end,
         'Each custody timeline row is tied to exactly one scan event by FK plus unique index.'
  union all
  select 'scan_and_custody_rls',
         case when
           coalesce((select relrowsecurity from pg_class where oid='public.equipment_scan_events'::regclass),false)
           and coalesce((select relrowsecurity from pg_class where oid='public.equipment_custody_timeline_events'::regclass),false)
         then 'passed' else 'failed' end,
         'Scan and custody tables must keep RLS enabled.'
  union all
  select 'jobs_create_boundary_contract',
         case when exists(
           select 1 from public.app_module_write_contracts
           where action_key='equipment_scan_event'
             and owner_module='jobs'
             and minimum_access='create'
             and boundary_mode='write'
             and is_enabled=true
         ) then 'passed' else 'failed' end,
         'equipment_scan_event remains Jobs-owned and requires Jobs/create.';
$$;

revoke all on function public.ywi_equipment_scan_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_equipment_scan_security_assertions() to service_role;

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values(
  'schema185_equipment_scan_custody_hardening','jobs','Equipment camera scan and custody evidence hardening',
  'active',90,9,10,
  'Complete protected camera/manual scan acceptance on phone and desktop, verify exact QR/barcode resolution and idempotent custody replay, then record Admin I.T. evidence.',
  'Jobs / I.T.',105,
  jsonb_build_object(
    'schema',185,'build','2026-09-02q','finance_mutation',false,
    'payment_provider_mutation',false,'production_promotion',false
  )
)
on conflict(rail_key) do update set
  rail_area=excluded.rail_area,rail_title=excluded.rail_title,rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,current_value=excluded.current_value,target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint,owner_hint=excluded.owner_hint,sort_order=excluded.sort_order,
  metadata=excluded.metadata,updated_at=now();

insert into public.it_scorecard_rail_resolution_contracts(
  rail_key,resolution_class,requires_human,requires_external,auto_close_allowed,resolution_note,introduced_by_schema
) values(
  'schema185_equipment_scan_custody_hardening','build_acceptance',true,false,false,
  'Schema/source completion is not enough; close only after rendered phone/desktop camera/manual acceptance and protected custody evidence are recorded.',185
)
on conflict(rail_key) do update set
  resolution_class=excluded.resolution_class,requires_human=excluded.requires_human,
  requires_external=excluded.requires_external,auto_close_allowed=excluded.auto_close_allowed,
  resolution_note=excluded.resolution_note,introduced_by_schema=excluded.introduced_by_schema,updated_at=now();

update public.it_scorecard_rail_resolution_contracts
set resolution_note='Schema 185 implements the camera/manual scan path and canonical resolver; keep this rail open until rendered phone/desktop acceptance and I.T. evidence pass.',
    updated_at=now()
where rail_key='equipment_scan_custody_live';

insert into public.app_schema_versions(
  schema_version,migration_key,schema_name,release_label,description,status,notes
) values(
  185,'185_equipment_scan_identity_custody_hardening','185_equipment_scan_identity_custody_hardening.sql','2026-09-02q',
  'Links physical Jobs equipment to canonical equipment_master, creates a private exact identifier registry, and hardens scan/custody provenance for camera/manual scanning.',
  'applied','Finance, payment providers and Production are untouched. Build closure still requires rendered phone/desktop and Admin I.T. acceptance.'
)
on conflict(schema_version) do update set
  migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,
  description=excluded.description,status=excluded.status,notes=excluded.notes,applied_at=now();

commit;
