-- Schema 164: Cross-module event + write boundaries
-- Purpose:
-- - Keep Safety, Finance, Jobs and Admin independently operable over one Shared Core.
-- - Prevent modules from coordinating by writing each other's private domain tables.
-- - Provide a private, server-only event contract/outbox for cross-module reactions.

begin;

create table if not exists public.app_cross_module_event_contracts (
  event_key text primary key,
  producer_module text not null references public.app_modules(module_key) on delete restrict,
  consumer_modules text[] not null default '{}'::text[],
  aggregate_type text not null,
  contract_version integer not null default 1,
  description text not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_cross_module_event_contracts_key_check check (event_key ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  constraint app_cross_module_event_contracts_version_check check (contract_version > 0),
  constraint app_cross_module_event_contracts_producer_not_consumer_check check (not producer_module = any(consumer_modules))
);

insert into public.app_cross_module_event_contracts(
  event_key,producer_module,consumer_modules,aggregate_type,contract_version,description,is_enabled
) values
  ('jobs.job_scheduled','jobs',array['safety','admin'],'job',1,'Jobs publishes a scheduling fact; Safety/Admin may react without receiving write access to Jobs private tables.',true),
  ('jobs.job_completed','jobs',array['finance','admin'],'job',1,'Jobs publishes completion; Finance/Admin may react without Jobs writing Finance/Admin domain records.',true),
  ('safety.incident_recorded','safety',array['jobs','admin'],'job',1,'Safety publishes an incident signal linked to canonical work; Jobs/Admin may react without mutating Safety records.',true),
  ('finance.invoice_posted','finance',array['jobs','admin'],'job',1,'Finance publishes billing state linked to canonical work; Jobs/Admin may react without mutating Finance records.',true),
  ('admin.profile_access_changed','admin',array['safety','finance','jobs'],'profile',1,'Admin publishes an access-change signal so loaded modules can invalidate permission-sensitive state.',true)
on conflict(event_key) do update set
  producer_module=excluded.producer_module,
  consumer_modules=excluded.consumer_modules,
  aggregate_type=excluded.aggregate_type,
  contract_version=excluded.contract_version,
  description=excluded.description,
  is_enabled=excluded.is_enabled,
  updated_at=now();

alter table public.app_cross_module_event_contracts enable row level security;
revoke all on table public.app_cross_module_event_contracts from public, anon, authenticated;
grant select on table public.app_cross_module_event_contracts to service_role;

create table if not exists public.app_cross_module_events (
  event_id bigint generated always as identity primary key,
  event_key text not null references public.app_cross_module_event_contracts(event_key) on delete restrict,
  producer_module text not null references public.app_modules(module_key) on delete restrict,
  aggregate_type text not null,
  aggregate_id text,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint app_cross_module_events_payload_object_check check (jsonb_typeof(payload)='object'),
  constraint app_cross_module_events_dedupe_key_check check (dedupe_key is null or length(trim(dedupe_key)) between 1 and 180)
);

create unique index if not exists app_cross_module_events_dedupe_key_uidx
  on public.app_cross_module_events(dedupe_key)
  where dedupe_key is not null;
create index if not exists app_cross_module_events_key_occurred_idx
  on public.app_cross_module_events(event_key,occurred_at desc);
create index if not exists app_cross_module_events_aggregate_idx
  on public.app_cross_module_events(aggregate_type,aggregate_id,occurred_at desc);

alter table public.app_cross_module_events enable row level security;
revoke all on table public.app_cross_module_events from public, anon, authenticated;
grant select,insert on table public.app_cross_module_events to service_role;
grant usage,select on sequence public.app_cross_module_events_event_id_seq to service_role;

create or replace function public.ywi_validate_cross_module_event()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_contract public.app_cross_module_event_contracts%rowtype;
begin
  select * into v_contract
  from public.app_cross_module_event_contracts
  where event_key=new.event_key and is_enabled=true;

  if not found then
    raise exception 'Cross-module event contract % is missing or disabled.', new.event_key;
  end if;

  if new.producer_module is distinct from v_contract.producer_module then
    raise exception 'Event % must be produced by module %, not %.', new.event_key, v_contract.producer_module, new.producer_module;
  end if;

  if new.aggregate_type is distinct from v_contract.aggregate_type then
    raise exception 'Event % must use aggregate type %, not %.', new.event_key, v_contract.aggregate_type, new.aggregate_type;
  end if;

  return new;
end;
$$;

revoke all on function public.ywi_validate_cross_module_event() from public, anon, authenticated;
grant execute on function public.ywi_validate_cross_module_event() to service_role;

drop trigger if exists trg_validate_cross_module_event on public.app_cross_module_events;
create trigger trg_validate_cross_module_event
before insert or update on public.app_cross_module_events
for each row execute function public.ywi_validate_cross_module_event();

create or replace function public.ywi_publish_cross_module_event(
  p_producer_module text,
  p_event_key text,
  p_aggregate_type text,
  p_aggregate_id text default null,
  p_payload jsonb default '{}'::jsonb,
  p_dedupe_key text default null,
  p_occurred_at timestamptz default now()
)
returns bigint
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_event_id bigint;
begin
  insert into public.app_cross_module_events(
    event_key,producer_module,aggregate_type,aggregate_id,payload,dedupe_key,occurred_at
  ) values (
    p_event_key,p_producer_module,p_aggregate_type,nullif(trim(p_aggregate_id),''),coalesce(p_payload,'{}'::jsonb),nullif(trim(p_dedupe_key),''),coalesce(p_occurred_at,now())
  )
  on conflict(dedupe_key) where dedupe_key is not null do update
    set dedupe_key=excluded.dedupe_key
  returning event_id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.ywi_publish_cross_module_event(text,text,text,text,jsonb,text,timestamptz) from public, anon, authenticated;
grant execute on function public.ywi_publish_cross_module_event(text,text,text,text,jsonb,text,timestamptz) to service_role;

create or replace view public.v_module_domain_ownership
with (security_invoker=true)
as
select mc.module_key, domain_key
from public.app_module_contracts mc
cross join lateral unnest(mc.owns_domains) domain_key
where mc.is_enabled=true;

revoke all on table public.v_module_domain_ownership from public, anon, authenticated;
grant select on table public.v_module_domain_ownership to service_role;

create or replace view public.v_cross_module_event_contract_status
with (security_invoker=true)
as
select
  c.event_key,
  c.producer_module,
  c.consumer_modules,
  c.aggregate_type,
  c.contract_version,
  c.is_enabled,
  exists(select 1 from public.app_modules m where m.module_key=c.producer_module) as producer_resolves,
  not exists(
    select 1 from unnest(c.consumer_modules) consumer(module_key)
    where not exists(select 1 from public.app_modules m where m.module_key=consumer.module_key)
  ) as consumers_resolve
from public.app_cross_module_event_contracts c
order by c.event_key;

revoke all on table public.v_cross_module_event_contract_status from public, anon, authenticated;
grant select on table public.v_cross_module_event_contract_status to service_role;

create or replace function public.ywi_cross_module_boundary_security_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'module_domain_ownership_unique',
    case when not exists (
      select domain_key
      from public.v_module_domain_ownership
      group by domain_key
      having count(*) > 1
    ) then 'passed' else 'failed' end,
    'Each declared private business domain has exactly one owning module.'
  union all
  select 'event_contracts_resolve',
    case when not exists (
      select 1 from public.v_cross_module_event_contract_status
      where is_enabled=true and (producer_resolves=false or consumers_resolve=false)
    ) then 'passed' else 'failed' end,
    'Every enabled event contract resolves its producer and consumers to registered modules.'
  union all
  select 'event_control_plane_private',
    case when not exists (
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('app_cross_module_event_contracts','app_cross_module_events','v_module_domain_ownership','v_cross_module_event_contract_status')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Cross-module event contracts/outbox/status views are not directly exposed to browser roles.'
  union all
  select 'event_tables_rls_enabled',
    case when (
      select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public'
        and c.relname in ('app_cross_module_event_contracts','app_cross_module_events')
        and c.relrowsecurity=true
    )=2 then 'passed' else 'failed' end,
    'Both cross-module event tables have RLS enabled.'
  union all
  select 'publish_rpc_service_role_only',
    case when not exists (
      select 1 from information_schema.routine_privileges
      where routine_schema='public'
        and routine_name='ywi_publish_cross_module_event'
        and grantee in ('anon','authenticated','PUBLIC')
        and privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
    'Cross-module event publication is server/service-role only.';
$$;

revoke all on function public.ywi_cross_module_boundary_security_assertions() from public, anon, authenticated;
grant execute on function public.ywi_cross_module_boundary_security_assertions() to service_role;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values (
  'cross_module_write_boundaries','Architecture','Modules coordinate through private events instead of cross-writing domain tables','critical',
  'Keep each private domain single-owner. Publish a versioned server-side event for cross-module reactions instead of granting another module write access.',
  'Admin > I.T. Readiness',39,true
)
on conflict(check_key) do update set
  check_group=excluded.check_group,
  check_title=excluded.check_title,
  severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,
  route_hint=excluded.route_hint,
  sort_order=excluded.sort_order,
  is_enabled=excluded.is_enabled,
  updated_at=now();

update public.admin_scorecard_progress_rails
set rail_status='complete', progress_percent=100, current_value=10, target_value=10,
    next_action_hint='Schema 163 Shared Core reads are current. Preserve the single Core data service while enforcing module write ownership.',
    updated_at=now()
where rail_key='schema163_core_data_service';

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,next_action_hint,owner_hint,sort_order,metadata
) values (
  'schema164_cross_module_boundaries','architecture','Cross-module write and event boundaries','active',90,9,10,
  'Wire first real module reactions to versioned events, then prove singular/mixed module browser behavior end to end.',
  'I.T. / Architecture',79,
  '{"build":"2026-09-01f","schema":164,"event_contract_version":1,"outbox":"app_cross_module_events","next":"rendered_module_acceptance"}'::jsonb
)
on conflict(rail_key) do update set
  rail_area=excluded.rail_area, rail_title=excluded.rail_title, rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent, current_value=excluded.current_value, target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint, owner_hint=excluded.owner_hint, sort_order=excluded.sort_order,
  metadata=excluded.metadata, updated_at=now();

insert into public.app_schema_versions(
  schema_version,migration_key,schema_name,release_label,description,status,notes
) values (
  164,
  '164_cross_module_event_write_boundaries',
  '164_cross_module_event_write_boundaries.sql',
  '2026-09-01f',
  'Adds private cross-module event contracts/outbox and explicit domain ownership proof so independently loadable modules share Core facts without cross-writing private domain data.',
  'applied',
  'Cross-module event publication is service-role only; event contracts are validated by trigger; browser roles have no direct event/outbox access.'
)
on conflict(schema_version) do update set
  migration_key=excluded.migration_key, schema_name=excluded.schema_name, release_label=excluded.release_label,
  description=excluded.description, status=excluded.status, notes=excluded.notes, applied_at=now();

create or replace view public.v_schema_drift_status as
select 164::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=164 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=164
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 164.' end as message,
  now() as checked_at
from public.app_schema_versions;

commit;
