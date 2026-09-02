-- Schema 165: rendered standalone / mixed module acceptance authority.
-- This release does not create replacement customer/job/site/asset storage.
-- It records the required access combinations that must be proven by the browser gate.

begin;

create table if not exists public.app_module_acceptance_scenarios (
  scenario_key text primary key,
  scenario_title text not null,
  requires_auth boolean not null default true,
  allowed_module_keys text[] not null default '{}'::text[],
  denied_module_keys text[] not null default '{}'::text[],
  required_viewports text[] not null default array['phone','desktop']::text[],
  evidence_kind text not null default 'rendered_browser',
  is_required boolean not null default true,
  sort_order integer not null default 100,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_module_acceptance_scenarios_key_chk check (scenario_key ~ '^[a-z][a-z0-9_]*$'),
  constraint app_module_acceptance_scenarios_evidence_chk check (evidence_kind in ('rendered_browser')),
  constraint app_module_acceptance_scenarios_viewports_chk check (required_viewports @> array['phone','desktop']::text[])
);

alter table public.app_module_acceptance_scenarios enable row level security;
revoke all on table public.app_module_acceptance_scenarios from public, anon, authenticated;
grant select on table public.app_module_acceptance_scenarios to service_role;

insert into public.app_module_acceptance_scenarios(
  scenario_key,scenario_title,requires_auth,allowed_module_keys,denied_module_keys,required_viewports,sort_order,description
) values
  ('anonymous','Anonymous shell',false,'{}'::text[],array['safety','finance','jobs','admin']::text[],array['phone','desktop']::text[],10,'No business module bundle may be requested before authenticated access resolves.'),
  ('safety_only','Safety only',true,array['safety']::text[],array['finance','jobs','admin']::text[],array['phone','desktop']::text[],20,'Safety runs independently while Finance, Jobs and Admin remain unloaded.'),
  ('finance_only','Finance only',true,array['finance']::text[],array['safety','jobs','admin']::text[],array['phone','desktop']::text[],30,'Finance runs independently while Safety, Jobs and Admin remain unloaded.'),
  ('jobs_only','Jobs only',true,array['jobs']::text[],array['safety','finance','admin']::text[],array['phone','desktop']::text[],40,'Jobs runs independently while Safety, Finance and Admin remain unloaded.'),
  ('admin_only','Admin only',true,array['admin']::text[],array['safety','finance','jobs']::text[],array['phone','desktop']::text[],50,'Admin runs independently; I.T. Readiness remains an Admin subsection rather than a fifth module.'),
  ('safety_jobs','Safety + Jobs',true,array['safety','jobs']::text[],array['finance','admin']::text[],array['phone','desktop']::text[],60,'Safety and Jobs may coexist over the same canonical Core identities without loading Finance/Admin.'),
  ('finance_admin','Finance + Admin',true,array['finance','admin']::text[],array['safety','jobs']::text[],array['phone','desktop']::text[],70,'Finance and Admin may coexist while Safety/Jobs remain unloaded.'),
  ('full_admin','Full Admin authority',true,array['safety','finance','jobs','admin']::text[],'{}'::text[],array['phone','desktop']::text[],80,'Administrative authority proves all four business modules can load together over Shared Core.')
on conflict(scenario_key) do update set
  scenario_title=excluded.scenario_title,
  requires_auth=excluded.requires_auth,
  allowed_module_keys=excluded.allowed_module_keys,
  denied_module_keys=excluded.denied_module_keys,
  required_viewports=excluded.required_viewports,
  evidence_kind=excluded.evidence_kind,
  is_required=true,
  sort_order=excluded.sort_order,
  description=excluded.description,
  updated_at=now();

create or replace view public.v_module_acceptance_contract_status
with (security_invoker=true)
as
select
  s.scenario_key,
  s.scenario_title,
  s.requires_auth,
  s.allowed_module_keys,
  s.denied_module_keys,
  s.required_viewports,
  s.evidence_kind,
  s.is_required,
  not exists (
    select 1
    from unnest(s.allowed_module_keys || s.denied_module_keys) module_key
    where not exists (
      select 1 from public.app_modules m
      where m.module_key=module_key
    )
  ) as module_keys_resolve,
  cardinality(s.allowed_module_keys) + cardinality(s.denied_module_keys) = 4 as covers_four_modules,
  not (s.allowed_module_keys && s.denied_module_keys) as allowed_denied_disjoint
from public.app_module_acceptance_scenarios s
order by s.sort_order,s.scenario_key;

revoke all on table public.v_module_acceptance_contract_status from public, anon, authenticated;
grant select on table public.v_module_acceptance_contract_status to service_role;

create or replace function public.ywi_module_acceptance_security_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'acceptance_matrix_complete',
    case when (
      select count(*) from public.app_module_acceptance_scenarios
      where is_required=true
        and scenario_key in ('anonymous','safety_only','finance_only','jobs_only','admin_only','safety_jobs','finance_admin','full_admin')
    )=8 then 'passed' else 'failed' end,
    'All eight required standalone/mixed access scenarios are registered.'
  union all
  select 'acceptance_module_keys_resolve',
    case when not exists (
      select 1 from public.v_module_acceptance_contract_status
      where is_required=true and (module_keys_resolve=false or covers_four_modules=false or allowed_denied_disjoint=false)
    ) then 'passed' else 'failed' end,
    'Every scenario partitions exactly the four registered business modules into allowed and denied sets.'
  union all
  select 'acceptance_control_plane_private',
    case when not exists (
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('app_module_acceptance_scenarios','v_module_acceptance_contract_status')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Acceptance requirements and status are not directly browser-readable control-plane data.'
  union all
  select 'acceptance_registry_rls_enabled',
    case when exists (
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname='app_module_acceptance_scenarios' and c.relrowsecurity=true
    ) then 'passed' else 'failed' end,
    'The private acceptance registry has RLS enabled.'
  union all
  select 'it_remains_admin_subsection',
    case when not exists (
      select 1 from public.app_modules where module_key='it'
    ) and exists (
      select 1 from public.app_module_acceptance_scenarios
      where scenario_key='admin_only' and allowed_module_keys=array['admin']::text[]
    ) then 'passed' else 'failed' end,
    'I.T. Readiness remains inside Admin and is not registered as a fifth business module.';
$$;

revoke all on function public.ywi_module_acceptance_security_assertions() from public, anon, authenticated;
grant execute on function public.ywi_module_acceptance_security_assertions() to service_role;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values (
  'standalone_module_acceptance','Architecture','Standalone and mixed module browser acceptance is required','critical',
  'Run the Schema 165 rendered browser matrix and require every anonymous, single-module, mixed-module and full-Admin scenario to request only permitted bundles on phone and desktop before release.',
  'Admin > I.T. Readiness',40,true
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
set rail_status='complete',progress_percent=100,current_value=10,target_value=10,
    next_action_hint='Schema 165 rendered acceptance now proves standalone and mixed module combinations.',
    updated_at=now()
where rail_key='schema164_cross_module_write_boundaries';

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values (
  'schema165_standalone_module_acceptance','architecture','Rendered standalone and mixed module acceptance','complete',100,8,8,
  'Keep all eight required access scenarios green on phone and desktop; any new business module or runtime bundle requires an explicit acceptance-matrix update.',
  'I.T. / Architecture',80,
  '{"build":"2026-09-01g","schema":165,"scenarios":8,"viewports":["phone","desktop"],"it_scope":"admin_subsection","shared_core":"canonical"}'::jsonb
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
  165,
  '165_standalone_module_acceptance_matrix',
  '165_standalone_module_acceptance_matrix.sql',
  '2026-09-01g',
  'Registers the private eight-scenario rendered module acceptance contract for anonymous, standalone, mixed and full-Admin runtime combinations on phone and desktop.',
  'applied',
  'Acceptance authority only. No replacement customer, job, site, equipment, asset or document tables are introduced; all module combinations continue to depend on canonical Shared Core identities.'
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
select 165::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=165 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=165
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 165.' end as message,
  now() as checked_at
from public.app_schema_versions;

commit;
