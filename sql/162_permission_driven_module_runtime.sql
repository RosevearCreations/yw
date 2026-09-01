-- Schema 162: Permission-driven standalone module runtime
-- Activates the Schema 161 module contract by marking each module runtime contract v2,
-- recording readiness, and advancing the canonical drift marker. No parallel business
-- identities are introduced; all modules continue to reference the Shared Core.

begin;

update public.app_module_contracts
set contract_version=2,
    runtime_mode='permission_driven',
    notes=case module_key
      when 'safety' then 'Safety browser code is loaded only after authenticated Safety access resolves. Shared people/customers/sites/jobs/assets/documents remain Core identities.'
      when 'finance' then 'Finance browser code is loaded only after authenticated Finance access resolves. Financial behaviour references canonical Core identities.'
      when 'jobs' then 'Jobs browser code is loaded only after authenticated Jobs access resolves. Work execution references canonical Core identities.'
      when 'admin' then 'Admin browser code is loaded only after authenticated Admin access resolves. Control-plane behaviour references canonical Core identities.'
      else notes end,
    updated_at=now()
where module_key in ('safety','finance','jobs','admin');

create or replace function public.ywi_permission_runtime_security_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'four_permission_driven_v2_contracts',
    case when (
      select count(*) from public.app_module_contracts
      where module_key in ('safety','finance','jobs','admin')
        and is_enabled=true
        and runtime_mode='permission_driven'
        and contract_version>=2
    )=4 then 'passed' else 'failed' end,
    'Safety, Finance, Jobs and Admin are enabled permission-driven runtime contracts at version 2 or later.'
  union all
  select 'shared_core_dependencies_still_resolve',
    case when not exists (
      select 1
      from public.app_module_contracts mc
      cross join lateral unnest(mc.core_dependencies) dep(entity_key)
      where mc.module_key in ('safety','finance','jobs','admin')
        and mc.is_enabled=true
        and not exists (
          select 1 from public.app_core_entity_contracts c
          where c.entity_key=dep.entity_key and c.is_enabled=true
        )
    ) then 'passed' else 'failed' end,
    'Every active module still resolves all Shared Core dependencies.'
  union all
  select 'runtime_contract_registry_private',
    case when not exists (
      select 1
      from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('app_module_contracts','app_core_entity_contracts','v_module_core_contract_status')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Runtime/Core registries remain outside browser-role direct access.';
$$;

revoke all on function public.ywi_permission_runtime_security_assertions() from public, anon, authenticated;
grant execute on function public.ywi_permission_runtime_security_assertions() to service_role;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values (
  'permission_driven_module_runtime','Architecture','Business modules load only after authenticated module access resolves','critical',
  'Do not release if the shell eagerly loads Safety, Finance, Jobs, or Admin browser bundles. Restore module-runtime permission gating and stale-runtime purge behaviour.',
  'Admin > I.T. Readiness',37,true
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
    next_action_hint='Schema 161 Shared Core contract is active. Continue through permission-driven module runtime and rendered standalone-module proof.',
    updated_at=now()
where rail_key='schema161_shared_core_contract';

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values (
  'schema162_permission_runtime','architecture','Permission-driven standalone module runtime','active',90,9,10,
  'Complete rendered browser proof for singular and mixed module profiles, including permission downgrade and sign-out purge behaviour.',
  'I.T. / Architecture',77,
  '{"build":"2026-09-01d","schema":162,"module_contract_version":2,"runtime":"permission_driven","next":"rendered_module_acceptance"}'::jsonb
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
  162,
  '162_permission_driven_module_runtime',
  '162_permission_driven_module_runtime.sql',
  '2026-09-01d',
  'Activates permission-driven browser loading for Safety, Finance, Jobs, and Admin while retaining one Shared Core identity contract.',
  'applied',
  'Business module bundles are no longer part of the eager shell. Sign-out, profile change, or permission downgrade purges already-loaded module code through a full runtime reload.'
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
select 162::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=162 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=162
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 162.' end as message,
  now() as checked_at
from public.app_schema_versions;

commit;
