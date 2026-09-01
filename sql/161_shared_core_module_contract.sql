-- Schema 161: Shared Core + standalone module contract
-- Purpose:
-- - Declare the canonical shared entities that all business modules reference.
-- - Declare each independently loadable application module and its browser entry scripts.
-- - Keep the contract registries private to the service-role control plane.
-- - Extend I.T. Readiness so module/core drift becomes a release blocker.

begin;

create table if not exists public.app_core_entity_contracts (
  entity_key text primary key,
  entity_label text not null,
  canonical_relation text not null,
  primary_key_column text not null default 'id',
  primary_key_type text not null,
  shared_by_modules text[] not null default array['safety','finance','jobs','admin']::text[],
  contract_version integer not null default 1,
  notes text,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_core_entity_contracts_key_check check (entity_key ~ '^[a-z][a-z0-9_]*$'),
  constraint app_core_entity_contracts_version_check check (contract_version > 0)
);

insert into public.app_core_entity_contracts(
  entity_key,entity_label,canonical_relation,primary_key_column,primary_key_type,
  shared_by_modules,contract_version,notes,is_enabled
) values
  ('profile','Profile / Person','profiles','id','uuid',array['safety','finance','jobs','admin'],1,'Canonical authenticated staff/person identity. Modules reference profiles.id rather than creating module-local people.',true),
  ('customer','Customer / Client','clients','id','uuid',array['safety','finance','jobs','admin'],1,'Canonical customer identity. Finance, Jobs, Safety and Admin must reuse clients.id.',true),
  ('customer_site','Customer Site / Location','client_sites','id','uuid',array['safety','finance','jobs','admin'],1,'Canonical customer location linked to clients.id. Legacy sites remains an operational compatibility surface until convergence is complete.',true),
  ('job','Job / Work','jobs','id','bigint',array['safety','finance','jobs','admin'],1,'Canonical job/work identity shared across operational and financial workflows.',true),
  ('equipment','Company Equipment','equipment_master','id','uuid',array['safety','finance','jobs','admin'],1,'Canonical company-owned equipment identity.',true),
  ('customer_asset','Customer Asset','customer_assets','id','uuid',array['safety','finance','jobs','admin'],1,'Canonical customer-owned/serviced asset identity tied to clients and client_sites.',true),
  ('service_document','Service / Contract Document','service_contract_documents','id','uuid',array['safety','finance','jobs','admin'],1,'Canonical cross-module service/contract document identity tied to customer, site and job.',true)
on conflict(entity_key) do update set
  entity_label=excluded.entity_label,
  canonical_relation=excluded.canonical_relation,
  primary_key_column=excluded.primary_key_column,
  primary_key_type=excluded.primary_key_type,
  shared_by_modules=excluded.shared_by_modules,
  contract_version=excluded.contract_version,
  notes=excluded.notes,
  is_enabled=excluded.is_enabled,
  updated_at=now();

alter table public.app_core_entity_contracts enable row level security;
revoke all on table public.app_core_entity_contracts from public, anon, authenticated;
grant select on table public.app_core_entity_contracts to service_role;

create table if not exists public.app_module_contracts (
  module_key text primary key references public.app_modules(module_key) on delete restrict,
  module_label text not null,
  contract_version integer not null default 1,
  entry_scripts jsonb not null default '[]'::jsonb,
  core_dependencies text[] not null default '{}'::text[],
  owns_domains text[] not null default '{}'::text[],
  runtime_mode text not null default 'permission_driven',
  notes text,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_module_contracts_version_check check (contract_version > 0),
  constraint app_module_contracts_scripts_array_check check (jsonb_typeof(entry_scripts)='array'),
  constraint app_module_contracts_runtime_mode_check check (runtime_mode in ('permission_driven','core_only','disabled'))
);

insert into public.app_module_contracts(
  module_key,module_label,contract_version,entry_scripts,core_dependencies,owns_domains,runtime_mode,notes,is_enabled
) values
  ('safety','Safety / OHSA',1,
    '["/js/hse-ops-ui.js","/js/logbook-ui.js","/js/reports-ui.js","/js/forms-toolbox.js","/js/forms-ppe.js","/js/forms-firstaid.js","/js/forms-incident.js","/js/forms-inspection.js","/js/forms-drill.js"]'::jsonb,
    array['profile','customer','customer_site','job','equipment','customer_asset','service_document'],
    array['safety_capture','safety_review','incidents','inspections','training','ppe'],
    'permission_driven','Safety owns safety behaviour; shared people/customers/sites/jobs/assets/documents remain Core identities.',true),
  ('finance','Finance',1,
    '["/js/finance-ui.js"]'::jsonb,
    array['profile','customer','customer_site','job','equipment','customer_asset','service_document'],
    array['accounting','reconciliation','tax','payroll','close','billing'],
    'permission_driven','Finance owns financial behaviour and derived accounting records; it references canonical Core business identities.',true),
  ('jobs','Jobs',1,
    '["/js/jobs-ui.js"]'::jsonb,
    array['profile','customer','customer_site','job','equipment','customer_asset','service_document'],
    array['scheduling','dispatch','crew','work_execution','equipment_assignment','closeout'],
    'permission_driven','Jobs owns field execution behaviour while reusing the canonical shared Core identities.',true),
  ('admin','Admin',1,
    '["/js/admin-actions.js","/js/admin-ui.js","/js/operations-cockpit.js","/js/module-access-ui.js","/js/it-readiness-ui.js"]'::jsonb,
    array['profile','customer','customer_site','job','equipment','customer_asset','service_document'],
    array['identity_access','configuration','integrations','it_readiness','release_control'],
    'permission_driven','Admin owns control-plane behaviour and can inspect all Core identities without creating parallel business identities.',true)
on conflict(module_key) do update set
  module_label=excluded.module_label,
  contract_version=excluded.contract_version,
  entry_scripts=excluded.entry_scripts,
  core_dependencies=excluded.core_dependencies,
  owns_domains=excluded.owns_domains,
  runtime_mode=excluded.runtime_mode,
  notes=excluded.notes,
  is_enabled=excluded.is_enabled,
  updated_at=now();

alter table public.app_module_contracts enable row level security;
revoke all on table public.app_module_contracts from public, anon, authenticated;
grant select on table public.app_module_contracts to service_role;

create or replace view public.v_module_core_contract_status
with (security_invoker=true)
as
select
  mc.module_key,
  mc.module_label,
  mc.contract_version,
  mc.runtime_mode,
  mc.is_enabled,
  mc.entry_scripts,
  mc.core_dependencies,
  mc.owns_domains,
  coalesce(array_length(mc.core_dependencies,1),0) as dependency_count,
  (
    select count(*)::integer
    from unnest(mc.core_dependencies) dep(entity_key)
    where not exists (
      select 1 from public.app_core_entity_contracts c
      where c.entity_key=dep.entity_key and c.is_enabled=true
    )
  ) as missing_dependency_count,
  not exists (
    select 1
    from unnest(mc.core_dependencies) dep(entity_key)
    where not exists (
      select 1 from public.app_core_entity_contracts c
      where c.entity_key=dep.entity_key and c.is_enabled=true
    )
  ) as contract_ready
from public.app_module_contracts mc
order by case mc.module_key when 'safety' then 10 when 'finance' then 20 when 'jobs' then 30 when 'admin' then 40 else 100 end;

revoke all on table public.v_module_core_contract_status from public, anon, authenticated;
grant select on table public.v_module_core_contract_status to service_role;

create or replace function public.ywi_module_contract_security_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'four_module_contracts',
    case when (
      select count(*) from public.app_module_contracts
      where module_key in ('safety','finance','jobs','admin') and is_enabled=true
    )=4 then 'passed' else 'failed' end,
    'Safety, Finance, Jobs, and Admin each have one enabled standalone module contract.'
  union all
  select 'canonical_core_contracts_present',
    case when not exists (
      select required.entity_key
      from (values ('profile'),('customer'),('customer_site'),('job'),('equipment'),('customer_asset'),('service_document')) required(entity_key)
      where not exists (
        select 1 from public.app_core_entity_contracts c
        where c.entity_key=required.entity_key and c.is_enabled=true
      )
    ) then 'passed' else 'failed' end,
    'All required shared Core identities are registered and enabled.'
  union all
  select 'module_dependencies_resolve',
    case when not exists (
      select 1
      from public.app_module_contracts mc
      cross join lateral unnest(mc.core_dependencies) dep(entity_key)
      where mc.is_enabled=true
        and not exists (
          select 1 from public.app_core_entity_contracts c
          where c.entity_key=dep.entity_key and c.is_enabled=true
        )
    ) then 'passed' else 'failed' end,
    'Every enabled module dependency resolves to an enabled Core entity contract.'
  union all
  select 'contract_registries_rls_enabled',
    case when (
      select count(*)
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public'
        and c.relname in ('app_core_entity_contracts','app_module_contracts')
        and c.relrowsecurity=true
    )=2 then 'passed' else 'failed' end,
    'Both contract registry tables have RLS enabled.'
  union all
  select 'contract_registries_not_browser_exposed',
    case when not exists (
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('app_core_entity_contracts','app_module_contracts','v_module_core_contract_status')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Core/module contract registries and status view are service-role control-plane data only.';
$$;

revoke all on function public.ywi_module_contract_security_assertions() from public, anon, authenticated;
grant execute on function public.ywi_module_contract_security_assertions() to service_role;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values
  ('shared_core_contract','Architecture','Shared Core canonical entity contract is complete','critical','Resolve missing/duplicate Core identities before adding module-local customer, job, person, asset, or document records.','Admin > I.T. Readiness',35,true),
  ('standalone_module_contract','Architecture','Standalone module contracts resolve to Shared Core','error','Repair a module manifest or Core dependency before releasing that module.','Admin > I.T. Readiness',36,true)
on conflict(check_key) do update set
  check_group=excluded.check_group,
  check_title=excluded.check_title,
  severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,
  route_hint=excluded.route_hint,
  sort_order=excluded.sort_order,
  is_enabled=excluded.is_enabled,
  updated_at=now();

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values (
  'schema161_shared_core_contract','architecture','Shared Core and standalone module contract','active',90,9,10,
  'Switch the browser shell from eager module scripts to permission-driven loading and complete standalone module browser proof.',
  'I.T. / Architecture',76,
  '{"build":"2026-09-01c","schema":161,"core_contract_version":1,"module_contract_version":1,"next":"permission_driven_runtime"}'::jsonb
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
  161,
  '161_shared_core_module_contract',
  '161_shared_core_module_contract.sql',
  '2026-09-01c',
  'Declares canonical shared Core entity contracts and independently loadable Safety, Finance, Jobs, and Admin module contracts.',
  'applied',
  'No duplicate customer/job/person/asset/document stores are introduced. Module business behaviour remains separate while shared identities stay canonical.'
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
select 161::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=161 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=161
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 161.' end as message,
  now() as checked_at
from public.app_schema_versions;

commit;
