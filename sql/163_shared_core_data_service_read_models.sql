-- Schema 163: Shared Core Data Service + canonical read models
-- Purpose:
-- - Give Safety, Finance, Jobs and Admin one read-only directory contract for the seven Shared Core identities.
-- - Keep canonical storage in profiles, clients, client_sites, jobs, equipment_master, customer_assets and service_contract_documents.
-- - Record the protected core-data-read Edge Function as the read surface; do not create parallel business tables.

begin;

alter table public.app_core_entity_contracts
  add column if not exists read_model_key text,
  add column if not exists read_endpoint text,
  add column if not exists read_contract_version integer not null default 1,
  add column if not exists read_model_mode text not null default 'protected_edge_directory';

alter table public.app_core_entity_contracts
  drop constraint if exists app_core_entity_contracts_read_model_mode_check;
alter table public.app_core_entity_contracts
  add constraint app_core_entity_contracts_read_model_mode_check
  check (read_model_mode in ('protected_edge_directory','direct_rls','disabled'));

alter table public.app_core_entity_contracts
  drop constraint if exists app_core_entity_contracts_read_contract_version_check;
alter table public.app_core_entity_contracts
  add constraint app_core_entity_contracts_read_contract_version_check
  check (read_contract_version > 0);

update public.app_core_entity_contracts
set read_model_key=entity_key,
    read_endpoint='core-data-read',
    read_contract_version=1,
    read_model_mode='protected_edge_directory',
    updated_at=now()
where entity_key in ('profile','customer','customer_site','job','equipment','customer_asset','service_document');

create or replace view public.v_core_read_model_contract_status
with (security_invoker=true)
as
select
  c.entity_key,
  c.entity_label,
  c.canonical_relation,
  c.primary_key_column,
  c.primary_key_type,
  c.shared_by_modules,
  c.read_model_key,
  c.read_endpoint,
  c.read_contract_version,
  c.read_model_mode,
  c.is_enabled,
  (
    c.is_enabled=true
    and c.read_model_key=c.entity_key
    and c.read_endpoint='core-data-read'
    and c.read_contract_version>=1
    and c.read_model_mode='protected_edge_directory'
  ) as read_contract_ready
from public.app_core_entity_contracts c
order by c.entity_key;

revoke all on table public.v_core_read_model_contract_status from public, anon, authenticated;
grant select on table public.v_core_read_model_contract_status to service_role;

create or replace function public.ywi_core_read_model_security_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'seven_core_read_models',
    case when (
      select count(*)
      from public.app_core_entity_contracts
      where entity_key in ('profile','customer','customer_site','job','equipment','customer_asset','service_document')
        and is_enabled=true
        and read_model_key=entity_key
        and read_endpoint='core-data-read'
        and read_contract_version>=1
        and read_model_mode='protected_edge_directory'
    )=7 then 'passed' else 'failed' end,
    'All seven Shared Core identities resolve to the protected core-data-read directory contract.'
  union all
  select 'canonical_relations_unchanged',
    case when not exists (
      select required.entity_key
      from (values
        ('profile','profiles'),
        ('customer','clients'),
        ('customer_site','client_sites'),
        ('job','jobs'),
        ('equipment','equipment_master'),
        ('customer_asset','customer_assets'),
        ('service_document','service_contract_documents')
      ) required(entity_key, relation_name)
      left join public.app_core_entity_contracts c on c.entity_key=required.entity_key
      where c.canonical_relation is distinct from required.relation_name
    ) then 'passed' else 'failed' end,
    'Schema 163 does not replace or duplicate canonical Shared Core storage.'
  union all
  select 'core_read_contract_private',
    case when not exists (
      select 1
      from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('app_core_entity_contracts','v_core_read_model_contract_status')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Core read-model control-plane metadata remains service-role only.';
$$;

revoke all on function public.ywi_core_read_model_security_assertions() from public, anon, authenticated;
grant execute on function public.ywi_core_read_model_security_assertions() to service_role;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values (
  'shared_core_data_service','Architecture','Shared Core Data service resolves all canonical read models','critical',
  'Keep module identity lookups on the protected core-data-read service. Do not add module-local customer, job, person, equipment, asset, site or service-document directories.',
  'Admin > I.T. Readiness',38,true
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
set rail_status='complete',
    progress_percent=100,
    current_value=10,
    target_value=10,
    next_action_hint='Schema 162 permission-driven loading is source-complete. Preserve it while Shared Core reads converge on core-data-read.',
    updated_at=now()
where rail_key='schema162_permission_runtime';

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values (
  'schema163_core_data_service','architecture','Shared Core Data service and canonical read models','active',90,9,10,
  'Complete source and rendered acceptance for permission-scoped Core reads, then enforce cross-module event/write boundaries.',
  'I.T. / Architecture',78,
  '{"build":"2026-09-01e","schema":163,"core_read_contract_version":1,"endpoint":"core-data-read","mode":"protected_edge_directory","next":"cross_module_boundaries"}'::jsonb
)
on conflict(rail_key) do update set
  rail_area=excluded.rail_area,
  rail_title=excluded.rail_title,
  rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,
  current_value=excluded.current_value,
  target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint,
  owner_hint=excluded.owner_hint,
  sort_order=excluded.sort_order,
  metadata=excluded.metadata,
  updated_at=now();

insert into public.app_schema_versions(
  schema_version,migration_key,schema_name,release_label,description,status,notes
) values (
  163,
  '163_shared_core_data_service_read_models',
  '163_shared_core_data_service_read_models.sql',
  '2026-09-01e',
  'Registers one protected read-only Shared Core Data service for canonical people, customers, sites, jobs, equipment, customer assets and service documents.',
  'applied',
  'Schema 163 adds read-contract metadata only. It creates no replacement business identity tables; module view permission remains mandatory at the Edge Function boundary.'
)
on conflict(schema_version) do update set
  migration_key=excluded.migration_key,
  schema_name=excluded.schema_name,
  release_label=excluded.release_label,
  description=excluded.description,
  status=excluded.status,
  notes=excluded.notes,
  applied_at=now();

create or replace view public.v_schema_drift_status as
select 163::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=163 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=163
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 163.' end as message,
  now() as checked_at
from public.app_schema_versions;

commit;
