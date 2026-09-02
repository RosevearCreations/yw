-- Schema 166: I.T. release authority and source evidence.
-- Extends the existing Admin > I.T. Readiness control plane rather than creating a fifth module.
-- This release records evidence and release state only; it never performs a production promotion.

begin;

-- Schema 165 left an untracked live helper index that the performance advisor reports as unused.
-- Eight deterministic acceptance rows do not need it; removing it converges live storage to source.
drop index if exists public.module_acceptance_scenarios_sort_order_idx;

-- Reassert the original Schema 159 browser/service boundary. These helpers accept arbitrary
-- profile IDs and must never be browser-callable; only the self-scoped permission RPC is exposed
-- to signed-in users. Explicit anon/authenticated revokes protect against privilege drift.
revoke all on function public.ywi_effective_module_access(uuid,text) from public, anon, authenticated;
revoke all on function public.ywi_profile_has_module_access(uuid,text,text) from public, anon, authenticated;
revoke all on function public.ywi_get_profile_module_permissions(uuid) from public, anon, authenticated;
grant execute on function public.ywi_effective_module_access(uuid,text) to service_role;
grant execute on function public.ywi_profile_has_module_access(uuid,text,text) to service_role;
grant execute on function public.ywi_get_profile_module_permissions(uuid) to service_role;
revoke all on function public.ywi_get_my_module_permissions() from public, anon, authenticated;
grant execute on function public.ywi_get_my_module_permissions() to authenticated, service_role;

create table if not exists public.it_release_source_evidence (
  id bigint generated always as identity primary key,
  source_branch text not null,
  source_sha text not null,
  workflow_run_id bigint,
  workflow_name text,
  workflow_status text not null,
  schema_version integer not null,
  branch_protection_reported boolean,
  branch_policy_verified boolean not null default false,
  evidence_note text,
  recorded_by_profile_id uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default now(),
  constraint it_release_source_evidence_branch_chk check (source_branch ~ '^[A-Za-z0-9._/-]+$'),
  constraint it_release_source_evidence_sha_chk check (source_sha ~ '^[0-9a-f]{40}$'),
  constraint it_release_source_evidence_workflow_status_chk check (workflow_status in ('passed','failed','cancelled','unknown')),
  constraint it_release_source_evidence_schema_version_chk check (schema_version >= 160)
);

create unique index if not exists it_release_source_evidence_run_uidx
  on public.it_release_source_evidence(source_sha, workflow_run_id)
  where workflow_run_id is not null;
create index if not exists it_release_source_evidence_recent_idx
  on public.it_release_source_evidence(recorded_at desc, id desc);

alter table public.it_release_source_evidence enable row level security;
revoke all on table public.it_release_source_evidence from public, anon, authenticated;
grant select, insert on table public.it_release_source_evidence to service_role;
grant usage, select on sequence public.it_release_source_evidence_id_seq to service_role;

create or replace view public.v_it_release_source_evidence_current
with (security_invoker=true)
as
select
  e.id,
  e.source_branch,
  e.source_sha,
  e.workflow_run_id,
  e.workflow_name,
  e.workflow_status,
  e.schema_version,
  e.branch_protection_reported,
  e.branch_policy_verified,
  case
    when e.branch_protection_reported is false then 'red'
    when e.branch_protection_reported is true and e.branch_policy_verified is true then 'green'
    when e.branch_protection_reported is true then 'amber'
    else 'unknown'
  end as repository_enforcement_status,
  case
    when e.source_branch='main' and e.workflow_status='passed' and e.schema_version=166 then 'green'
    when e.workflow_status in ('failed','cancelled') then 'red'
    else 'amber'
  end as source_gate_status,
  e.evidence_note,
  e.recorded_by_profile_id,
  e.recorded_at
from public.it_release_source_evidence e
order by e.recorded_at desc, e.id desc
limit 1;

revoke all on table public.v_it_release_source_evidence_current from public, anon, authenticated;
grant select on table public.v_it_release_source_evidence_current to service_role;

create or replace function public.ywi_record_release_source_evidence(
  p_source_branch text,
  p_source_sha text,
  p_workflow_run_id bigint,
  p_workflow_name text,
  p_workflow_status text,
  p_schema_version integer,
  p_branch_protection_reported boolean,
  p_branch_policy_verified boolean default false,
  p_evidence_note text default null,
  p_recorded_by_profile_id uuid default null
)
returns bigint
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_id bigint;
  v_branch text := trim(coalesce(p_source_branch,''));
  v_sha text := lower(trim(coalesce(p_source_sha,'')));
  v_status text := lower(trim(coalesce(p_workflow_status,'unknown')));
begin
  if v_branch='' or v_branch !~ '^[A-Za-z0-9._/-]+$' then
    raise exception 'A valid source branch is required.' using errcode='22023';
  end if;
  if v_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'A full 40-character Git commit SHA is required.' using errcode='22023';
  end if;
  if v_status not in ('passed','failed','cancelled','unknown') then
    raise exception 'Unsupported workflow status.' using errcode='22023';
  end if;
  if coalesce(p_schema_version,0) < 160 then
    raise exception 'Schema version is outside the supported release-authority range.' using errcode='22023';
  end if;

  insert into public.it_release_source_evidence(
    source_branch,source_sha,workflow_run_id,workflow_name,workflow_status,schema_version,
    branch_protection_reported,branch_policy_verified,evidence_note,recorded_by_profile_id
  ) values (
    v_branch,v_sha,p_workflow_run_id,nullif(trim(coalesce(p_workflow_name,'')),''),v_status,p_schema_version,
    p_branch_protection_reported,coalesce(p_branch_policy_verified,false),nullif(trim(coalesce(p_evidence_note,'')),''),p_recorded_by_profile_id
  )
  on conflict(source_sha,workflow_run_id) where workflow_run_id is not null do update set
    source_branch=excluded.source_branch,
    workflow_name=excluded.workflow_name,
    workflow_status=excluded.workflow_status,
    schema_version=excluded.schema_version,
    branch_protection_reported=excluded.branch_protection_reported,
    branch_policy_verified=excluded.branch_policy_verified,
    evidence_note=excluded.evidence_note,
    recorded_by_profile_id=excluded.recorded_by_profile_id,
    recorded_at=now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.ywi_record_release_source_evidence(text,text,bigint,text,text,integer,boolean,boolean,text,uuid) from public, anon, authenticated;
grant execute on function public.ywi_record_release_source_evidence(text,text,bigint,text,text,integer,boolean,boolean,text,uuid) to service_role;

create or replace view public.v_it_release_authority_status
with (security_invoker=true)
as
with
schema_state as (
  select * from public.v_schema_drift_status limit 1
),
module_contract as (
  select count(*) filter (where assertion_status<>'passed')::int as failed_count
  from public.ywi_module_contract_security_assertions()
),
permission_runtime as (
  select count(*) filter (where assertion_status<>'passed')::int as failed_count
  from public.ywi_permission_runtime_security_assertions()
),
core_read as (
  select count(*) filter (where assertion_status<>'passed')::int as failed_count
  from public.ywi_core_read_model_security_assertions()
),
write_boundary as (
  select count(*) filter (where assertion_status<>'passed')::int as failed_count
  from public.ywi_module_write_boundary_security_assertions()
),
cross_module as (
  select count(*) filter (where assertion_status<>'passed')::int as failed_count
  from public.ywi_cross_module_boundary_security_assertions()
),
acceptance as (
  select count(*) filter (where assertion_status<>'passed')::int as failed_count
  from public.ywi_module_acceptance_security_assertions()
),
it_control as (
  select count(*) filter (where assertion_status<>'passed')::int as failed_count
  from public.ywi_it_readiness_security_assertions()
),
module_control as (
  select count(*) filter (where assertion_status<>'passed')::int as failed_count
  from public.ywi_module_security_assertions()
),
source_state as (
  select * from public.v_it_release_source_evidence_current
),
component_state as (
  select
    coalesce(mc.failed_count,0)+coalesce(pr.failed_count,0)+coalesce(cr.failed_count,0)+coalesce(wb.failed_count,0)+
    coalesce(cm.failed_count,0)+coalesce(ac.failed_count,0)+coalesce(ic.failed_count,0)+coalesce(moc.failed_count,0) as failed_count
  from module_contract mc
  cross join permission_runtime pr
  cross join core_read cr
  cross join write_boundary wb
  cross join cross_module cm
  cross join acceptance ac
  cross join it_control ic
  cross join module_control moc
)
select
  166::int as release_schema_version,
  ss.expected_schema_version,
  ss.latest_applied_schema_version,
  ss.drift_status as schema_status,
  coalesce(cs.failed_count,0)::int as contract_assertion_failures,
  case when coalesce(cs.failed_count,0)=0 then 'green' else 'red' end as contract_status,
  coalesce(src.source_branch,'not_recorded') as source_branch,
  src.source_sha,
  src.workflow_run_id,
  src.workflow_name,
  coalesce(src.workflow_status,'unknown') as workflow_status,
  coalesce(src.source_gate_status,'amber') as source_gate_status,
  coalesce(src.repository_enforcement_status,'unknown') as repository_enforcement_status,
  src.branch_protection_reported,
  coalesce(src.branch_policy_verified,false) as branch_policy_verified,
  case
    when ss.drift_status<>'current' or ss.latest_applied_schema_version < 166 or coalesce(cs.failed_count,0)>0 then 'red'
    when coalesce(src.source_gate_status,'amber')='green' then 'green'
    else 'amber'
  end as release_authority_status,
  'manual_human_promotion_required'::text as production_promotion_mode,
  case
    when ss.drift_status<>'current' or ss.latest_applied_schema_version < 166 then 'Database/source schema convergence is incomplete.'
    when coalesce(cs.failed_count,0)>0 then 'One or more module/Core/boundary/readiness assertions are failing.'
    when coalesce(src.source_gate_status,'amber')<>'green' then 'Record the exact successful main workflow evidence before release review.'
    when coalesce(src.repository_enforcement_status,'unknown')='amber' then 'Application release authority is green; GitHub reports main protected, but detailed branch-policy verification is still unavailable.'
    else 'Application release authority is green. Production promotion remains a deliberate human action.'
  end as release_message,
  now() as checked_at
from schema_state ss
cross join component_state cs
left join source_state src on true;

revoke all on table public.v_it_release_authority_status from public, anon, authenticated;
grant select on table public.v_it_release_authority_status to service_role;

create or replace function public.ywi_it_release_authority_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'release_authority_four_modules',
    case when (select count(*) from public.app_modules where is_enabled=true)=4
      and not exists(select 1 from public.app_modules where module_key='it')
    then 'passed' else 'failed' end,
    'Release authority recognizes exactly Safety, Finance, Jobs and Admin; I.T. is not a fifth module.'
  union all
  select 'release_authority_it_admin_subsection',
    case when exists(
      select 1 from public.app_module_routes
      where section_id='it' and module_key='admin' and minimum_access_level='manage' and is_enabled=true
    ) then 'passed' else 'failed' end,
    'I.T. Readiness remains an Admin/manage subsection.'
  union all
  select 'release_authority_control_plane_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('it_release_source_evidence','v_it_release_source_evidence_current','v_it_release_authority_status')
        and grantee in ('anon','authenticated','PUBLIC')
    ) and exists(
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname='it_release_source_evidence' and c.relrowsecurity=true
    ) then 'passed' else 'failed' end,
    'Release source evidence and authority views are private service control-plane data.'
  union all
  select 'release_authority_capture_service_role_only',
    case when not exists(
      select 1 from information_schema.routine_privileges
      where routine_schema='public' and routine_name='ywi_record_release_source_evidence'
        and grantee in ('anon','authenticated','PUBLIC') and privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
    'Only the server/service role may record source SHA and workflow evidence.'
  union all
  select 'release_authority_component_assertions',
    case when coalesce((select contract_assertion_failures from public.v_it_release_authority_status limit 1),1)=0
    then 'passed' else 'failed' end,
    'Module contract, permission runtime, Shared Core, write-boundary, event-boundary, acceptance and I.T. assertions are all green.'
  union all
  select 'release_authority_main_source_evidence',
    case when exists(
      select 1 from public.v_it_release_source_evidence_current
      where source_branch='main' and workflow_status='passed' and schema_version=166 and branch_protection_reported=true
    ) then 'passed' else 'failed' end,
    'The exact Schema 166 main SHA has a successful workflow run and GitHub reports main as protected.';
$$;

revoke all on function public.ywi_it_release_authority_assertions() from public, anon, authenticated;
grant execute on function public.ywi_it_release_authority_assertions() to service_role;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values
  ('release_contract_authority','Release','Module/Core/boundary release contracts are green','critical',
   'Resolve any failed Schema 161-165 contract/security assertion before promotion.','Admin > I.T. Readiness',32,true),
  ('release_source_authority','Release','Exact main SHA and CI workflow evidence are recorded','critical',
   'After the main workflow passes, record its full commit SHA and workflow run as release evidence.','Admin > I.T. Readiness',34,true),
  ('repository_branch_policy','Release','Main branch enforcement is independently verifiable','warning',
   'Keep main protected. If the GitHub integration cannot read policy details, retain an explicit AMBER verification state rather than assuming enforcement.','Admin > I.T. Readiness',36,true)
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
set rail_status='complete',progress_percent=100,current_value=8,target_value=8,
    next_action_hint='Schema 166 now carries exact source/CI evidence into the Admin I.T. release authority.',
    updated_at=now()
where rail_key='schema165_standalone_module_acceptance';

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values (
  'schema166_it_release_authority','release','I.T. release authority and source evidence','active',90,5,6,
  'Record the exact successful Schema 166 main SHA/workflow evidence; keep branch-policy detail AMBER if GitHub cannot independently expose it.',
  'I.T. / Release',85,
  '{"build":"2026-09-01h","schema":166,"modules":4,"it_scope":"admin_subsection","promotion":"manual","source_evidence":"server_only"}'::jsonb
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
  166,
  '166_it_release_authority',
  '166_it_release_authority.sql',
  '2026-09-01h',
  'Extends Admin I.T. Readiness with private exact-source/CI evidence and a derived release authority over the existing module, Shared Core, boundary and acceptance contracts.',
  'applied',
  'No automatic production promotion is introduced. GitHub branch-protection policy verification remains distinct from the application release gate; I.T. remains an Admin subsection and the business module count remains four.'
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
select 166::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=166 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=166
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 166.' end as message,
  now() as checked_at
from public.app_schema_versions;

commit;
