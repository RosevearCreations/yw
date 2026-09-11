begin;

-- Schema 208 — independent GitHub repository-policy evidence authority.
-- Release-source evidence remains exactly as established by Schema 205 / Build 280:
-- source CI can be GREEN while detailed repository policy is verified and recorded separately.
-- This migration creates the private policy evidence store and authority bridge only. It does
-- not fabricate GitHub evidence, record a policy row, promote Production, close business rails,
-- enable Finance posting, mutate payment providers, or perform staging acceptance.

create table if not exists public.it_repository_policy_evidence (
  id bigint generated always as identity primary key,
  repository text not null,
  branch_name text not null,
  source_sha text not null,
  source_workflow_run_id bigint not null,
  source_workflow_run_attempt integer not null,
  branch_protection_reported boolean not null,
  ruleset_id bigint not null,
  ruleset_name text not null,
  ruleset_target text not null,
  ruleset_enforcement text not null,
  default_branch_targeted boolean not null,
  pull_request_required boolean not null,
  required_status_contexts text[] not null default '{}'::text[],
  source_checks_required boolean not null,
  force_push_blocked boolean not null,
  deletion_blocked boolean not null,
  bypass_actor_count integer not null default 0,
  current_user_can_bypass text not null,
  policy_contract_version integer not null,
  ruleset_updated_at timestamptz not null,
  verified_payload_sha256 text not null,
  verified_at timestamptz not null,
  evidence_note text,
  recorded_at timestamptz not null default now(),
  constraint it_repository_policy_evidence_repository_chk check (repository='RosevearCreations/yw'),
  constraint it_repository_policy_evidence_branch_chk check (branch_name='main'),
  constraint it_repository_policy_evidence_sha_chk check (source_sha ~ '^[0-9a-f]{40}$'),
  constraint it_repository_policy_evidence_run_chk check (source_workflow_run_id>0 and source_workflow_run_attempt>0),
  constraint it_repository_policy_evidence_ruleset_chk check (
    ruleset_id>0
    and ruleset_name='main protection'
    and ruleset_target='branch'
    and ruleset_enforcement='active'
  ),
  constraint it_repository_policy_evidence_contract_chk check (
    branch_protection_reported=true
    and default_branch_targeted=true
    and pull_request_required=true
    and source_checks_required=true
    and force_push_blocked=true
    and deletion_blocked=true
    and bypass_actor_count=0
    and current_user_can_bypass='never'
    and policy_contract_version=1
    and required_status_contexts @> array['source-checks']::text[]
    and verified_payload_sha256 ~ '^[0-9a-f]{64}$'
  )
);

create unique index if not exists it_repository_policy_evidence_run_ruleset_uidx
  on public.it_repository_policy_evidence(source_sha,source_workflow_run_id,source_workflow_run_attempt,ruleset_id);
create index if not exists it_repository_policy_evidence_recent_idx
  on public.it_repository_policy_evidence(verified_at desc,id desc);

alter table public.it_repository_policy_evidence enable row level security;
revoke all on table public.it_repository_policy_evidence from public,anon,authenticated,service_role;
grant select on table public.it_repository_policy_evidence to service_role;

create or replace function public.ywi_record_verified_repository_policy_evidence(
  p_project_ref text,
  p_repository text,
  p_branch_name text,
  p_source_sha text,
  p_source_workflow_run_id bigint,
  p_source_workflow_run_attempt integer,
  p_branch_protection_reported boolean,
  p_ruleset_id bigint,
  p_ruleset_name text,
  p_ruleset_target text,
  p_ruleset_enforcement text,
  p_default_branch_targeted boolean,
  p_pull_request_required boolean,
  p_required_status_contexts text[],
  p_source_checks_required boolean,
  p_force_push_blocked boolean,
  p_deletion_blocked boolean,
  p_bypass_actor_count integer,
  p_current_user_can_bypass text,
  p_policy_contract_version integer,
  p_ruleset_updated_at timestamptz,
  p_verified_payload_sha256 text,
  p_verified_at timestamptz,
  p_evidence_note text default null
)
returns bigint
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_id bigint;
  v_sha text := lower(btrim(coalesce(p_source_sha,'')));
  v_digest text := lower(btrim(coalesce(p_verified_payload_sha256,'')));
  v_drift text;
  v_expected integer;
  v_latest integer;
begin
  if btrim(coalesce(p_project_ref,''))<>'jmqvkgiqlimdhcofwkxr' then
    raise exception 'Repository-policy evidence target is not the registered YardWeasels Production project.' using errcode='22023';
  end if;
  if not exists(
    select 1 from public.it_runtime_environment_authorities
    where project_ref='jmqvkgiqlimdhcofwkxr'
      and environment_class='production'
      and staging_acceptance_mutation_allowed=false
  ) then
    raise exception 'Registered Production runtime authority is missing or unsafe.' using errcode='55000';
  end if;
  if btrim(coalesce(p_repository,''))<>'RosevearCreations/yw'
     or btrim(coalesce(p_branch_name,''))<>'main' then
    raise exception 'Repository-policy evidence must target RosevearCreations/yw main.' using errcode='22023';
  end if;
  if v_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'A full lowercase 40-character source SHA is required.' using errcode='22023';
  end if;
  if coalesce(p_source_workflow_run_id,0)<=0 or coalesce(p_source_workflow_run_attempt,0)<=0 then
    raise exception 'Positive source workflow run id and attempt are required.' using errcode='22023';
  end if;
  if p_branch_protection_reported is distinct from true then
    raise exception 'GitHub must report main protected=true.' using errcode='22023';
  end if;
  if coalesce(p_ruleset_id,0)<=0
     or btrim(coalesce(p_ruleset_name,''))<>'main protection'
     or btrim(coalesce(p_ruleset_target,''))<>'branch'
     or btrim(coalesce(p_ruleset_enforcement,''))<>'active' then
    raise exception 'The active main protection branch ruleset is required.' using errcode='22023';
  end if;
  if p_default_branch_targeted is distinct from true
     or p_pull_request_required is distinct from true
     or p_source_checks_required is distinct from true
     or p_force_push_blocked is distinct from true
     or p_deletion_blocked is distinct from true then
    raise exception 'Required main repository-policy controls are not all verified.' using errcode='22023';
  end if;
  if coalesce(p_bypass_actor_count,-1)<>0 or btrim(coalesce(p_current_user_can_bypass,''))<>'never' then
    raise exception 'Main repository policy must have no bypass actors and the current actor must never bypass.' using errcode='22023';
  end if;
  if p_policy_contract_version is distinct from 1 then
    raise exception 'Unsupported repository-policy verification contract version.' using errcode='22023';
  end if;
  if not (coalesce(p_required_status_contexts,'{}'::text[]) @> array['source-checks']::text[]) then
    raise exception 'The canonical source-checks status must be required.' using errcode='22023';
  end if;
  if v_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'A SHA-256 verified-policy payload digest is required.' using errcode='22023';
  end if;
  if p_ruleset_updated_at is null or p_verified_at is null then
    raise exception 'Ruleset and verification timestamps are required.' using errcode='22023';
  end if;
  if p_verified_at < now()-interval '24 hours' or p_verified_at > now()+interval '5 minutes' then
    raise exception 'Repository-policy verification must be recent and not future-dated.' using errcode='22023';
  end if;
  if p_ruleset_updated_at > p_verified_at + interval '5 minutes' then
    raise exception 'Ruleset evidence cannot be materially future-dated relative to verification.' using errcode='22023';
  end if;

  select expected_schema_version,latest_applied_schema_version,drift_status
    into v_expected,v_latest,v_drift
  from public.v_schema_drift_status
  limit 1;
  if v_drift is distinct from 'current' or v_expected is distinct from v_latest then
    raise exception 'Production schema must be current before repository-policy evidence can be recorded.' using errcode='55000';
  end if;

  insert into public.it_repository_policy_evidence(
    repository,branch_name,source_sha,source_workflow_run_id,source_workflow_run_attempt,
    branch_protection_reported,ruleset_id,ruleset_name,ruleset_target,ruleset_enforcement,
    default_branch_targeted,pull_request_required,required_status_contexts,source_checks_required,
    force_push_blocked,deletion_blocked,bypass_actor_count,current_user_can_bypass,
    policy_contract_version,ruleset_updated_at,verified_payload_sha256,verified_at,evidence_note
  ) values (
    'RosevearCreations/yw','main',v_sha,p_source_workflow_run_id,p_source_workflow_run_attempt,
    true,p_ruleset_id,'main protection','branch','active',
    true,true,p_required_status_contexts,true,true,true,0,'never',
    1,p_ruleset_updated_at,v_digest,p_verified_at,nullif(btrim(coalesce(p_evidence_note,'')),'')
  )
  on conflict(source_sha,source_workflow_run_id,source_workflow_run_attempt,ruleset_id)
  do update set
    branch_protection_reported=true,
    ruleset_name='main protection',ruleset_target='branch',ruleset_enforcement='active',
    default_branch_targeted=true,pull_request_required=true,
    required_status_contexts=excluded.required_status_contexts,source_checks_required=true,
    force_push_blocked=true,deletion_blocked=true,bypass_actor_count=0,current_user_can_bypass='never',
    policy_contract_version=1,ruleset_updated_at=excluded.ruleset_updated_at,
    verified_payload_sha256=excluded.verified_payload_sha256,verified_at=excluded.verified_at,
    evidence_note=excluded.evidence_note,recorded_at=now()
  returning id into v_id;

  return v_id;
end;
$$;
revoke execute on function public.ywi_record_verified_repository_policy_evidence(text,text,text,text,bigint,integer,boolean,bigint,text,text,text,boolean,boolean,text[],boolean,boolean,boolean,integer,text,integer,timestamptz,text,timestamptz,text) from public,anon,authenticated,service_role;
grant execute on function public.ywi_record_verified_repository_policy_evidence(text,text,text,text,bigint,integer,boolean,bigint,text,text,text,boolean,boolean,text[],boolean,boolean,boolean,integer,text,integer,timestamptz,text,timestamptz,text) to service_role;

create or replace view public.v_it_repository_policy_evidence_current
with (security_invoker=true)
as
with current_source as (
  select source_sha,source_gate_status
  from public.v_it_release_source_evidence_current
  limit 1
), latest as (
  select e.*
  from public.it_repository_policy_evidence e
  where e.repository='RosevearCreations/yw' and e.branch_name='main'
  order by e.verified_at desc,e.id desc
  limit 1
)
select
  e.id,e.repository,e.branch_name,e.source_sha,e.source_workflow_run_id,e.source_workflow_run_attempt,
  e.branch_protection_reported,e.ruleset_id,e.ruleset_name,e.ruleset_target,e.ruleset_enforcement,
  e.default_branch_targeted,e.pull_request_required,e.required_status_contexts,e.source_checks_required,
  e.force_push_blocked,e.deletion_blocked,e.bypass_actor_count,e.current_user_can_bypass,
  e.policy_contract_version,e.ruleset_updated_at,e.verified_payload_sha256,e.verified_at,e.evidence_note,e.recorded_at,
  (
    e.branch_protection_reported=true
    and e.ruleset_name='main protection'
    and e.ruleset_target='branch'
    and e.ruleset_enforcement='active'
    and e.default_branch_targeted=true
    and e.pull_request_required=true
    and e.source_checks_required=true
    and e.required_status_contexts @> array['source-checks']::text[]
    and e.force_push_blocked=true
    and e.deletion_blocked=true
    and e.bypass_actor_count=0
    and e.current_user_can_bypass='never'
    and e.policy_contract_version=1
    and e.verified_payload_sha256 ~ '^[0-9a-f]{64}$'
    and e.verified_at >= now()-interval '24 hours'
    and cs.source_gate_status='green'
    and cs.source_sha=e.source_sha
  ) as branch_policy_verified,
  case
    when e.branch_protection_reported=true
      and e.ruleset_name='main protection'
      and e.ruleset_target='branch'
      and e.ruleset_enforcement='active'
      and e.default_branch_targeted=true
      and e.pull_request_required=true
      and e.source_checks_required=true
      and e.required_status_contexts @> array['source-checks']::text[]
      and e.force_push_blocked=true
      and e.deletion_blocked=true
      and e.bypass_actor_count=0
      and e.current_user_can_bypass='never'
      and e.policy_contract_version=1
      and e.verified_payload_sha256 ~ '^[0-9a-f]{64}$'
      and e.verified_at >= now()-interval '24 hours'
      and cs.source_gate_status='green'
      and cs.source_sha=e.source_sha then 'green'
    when e.branch_protection_reported=true then 'amber'
    when e.branch_protection_reported=false then 'red'
    else 'unknown'
  end::text as repository_enforcement_status
from latest e
left join current_source cs on true;
revoke all on table public.v_it_repository_policy_evidence_current from public,anon,authenticated;
grant select on table public.v_it_repository_policy_evidence_current to service_role;

-- Preserve the existing release-authority output columns and order. Repository policy now reads
-- from its independent evidence authority instead of overloading release-source evidence.
create or replace view public.v_it_release_authority_status
with (security_invoker=true)
as
with schema_state as (
  select expected_schema_version,latest_applied_schema_version,drift_status,message,checked_at
  from public.v_schema_drift_status
  limit 1
), module_contract as (
  select count(*) filter(where assertion_status<>'passed')::integer as failed_count
  from public.ywi_module_contract_security_assertions()
), permission_runtime as (
  select count(*) filter(where assertion_status<>'passed')::integer as failed_count
  from public.ywi_permission_runtime_security_assertions()
), core_read as (
  select count(*) filter(where assertion_status<>'passed')::integer as failed_count
  from public.ywi_core_read_model_security_assertions()
), write_boundary as (
  select count(*) filter(where assertion_status<>'passed')::integer as failed_count
  from public.ywi_module_write_boundary_security_assertions()
), cross_module as (
  select count(*) filter(where assertion_status<>'passed')::integer as failed_count
  from public.ywi_cross_module_boundary_security_assertions()
), real_wiring as (
  select count(*) filter(where assertion_status<>'passed')::integer as failed_count
  from public.ywi_cross_module_event_wiring_assertions()
), acceptance as (
  select count(*) filter(where assertion_status<>'passed')::integer as failed_count
  from public.ywi_module_acceptance_security_assertions()
), it_control as (
  select count(*) filter(where assertion_status<>'passed')::integer as failed_count
  from public.ywi_it_readiness_security_assertions()
), module_control as (
  select count(*) filter(where assertion_status<>'passed')::integer as failed_count
  from public.ywi_module_security_assertions()
), source_state as (
  select id,source_branch,source_sha,workflow_run_id,workflow_name,workflow_status,schema_version,
    branch_protection_reported,branch_policy_verified,repository_enforcement_status,source_gate_status,
    evidence_note,recorded_by_profile_id,recorded_at
  from public.v_it_release_source_evidence_current
), policy_state as (
  select branch_policy_verified,repository_enforcement_status
  from public.v_it_repository_policy_evidence_current
), component_state as (
  select coalesce(mc.failed_count,0)+coalesce(pr.failed_count,0)+coalesce(cr.failed_count,0)+
    coalesce(wb.failed_count,0)+coalesce(cm.failed_count,0)+coalesce(rw.failed_count,0)+
    coalesce(ac.failed_count,0)+coalesce(ic.failed_count,0)+coalesce(moc.failed_count,0) as failed_count
  from module_contract mc
  cross join permission_runtime pr
  cross join core_read cr
  cross join write_boundary wb
  cross join cross_module cm
  cross join real_wiring rw
  cross join acceptance ac
  cross join it_control ic
  cross join module_control moc
)
select
  ss.expected_schema_version as release_schema_version,
  ss.expected_schema_version,
  ss.latest_applied_schema_version,
  ss.drift_status as schema_status,
  coalesce(cs.failed_count,0) as contract_assertion_failures,
  case when coalesce(cs.failed_count,0)=0 then 'green' else 'red' end as contract_status,
  coalesce(src.source_branch,'not_recorded') as source_branch,
  src.source_sha,
  src.workflow_run_id,
  src.workflow_name,
  coalesce(src.workflow_status,'unknown') as workflow_status,
  coalesce(src.source_gate_status,'amber') as source_gate_status,
  coalesce(pol.repository_enforcement_status,
    case when src.branch_protection_reported is true then 'amber'
         when src.branch_protection_reported is false then 'red'
         else 'unknown' end) as repository_enforcement_status,
  src.branch_protection_reported,
  coalesce(pol.branch_policy_verified,false) as branch_policy_verified,
  case
    when ss.drift_status<>'current' or ss.latest_applied_schema_version<ss.expected_schema_version or coalesce(cs.failed_count,0)>0 then 'red'
    when coalesce(src.source_gate_status,'amber')='green' then 'green'
    else 'amber'
  end as release_authority_status,
  'manual_human_promotion_required'::text as production_promotion_mode,
  case
    when ss.drift_status<>'current' or ss.latest_applied_schema_version<ss.expected_schema_version then 'Database/source schema convergence is incomplete.'
    when coalesce(cs.failed_count,0)>0 then 'One or more module/Core/boundary/wiring/readiness assertions are failing.'
    when coalesce(src.source_gate_status,'amber')<>'green' then 'Record the exact successful main workflow evidence for the current schema before release review.'
    when coalesce(pol.repository_enforcement_status,
      case when src.branch_protection_reported is true then 'amber' when src.branch_protection_reported is false then 'red' else 'unknown' end)<>'green'
      then 'Application release authority is green; repository enforcement remains separately AMBER until current detailed main-ruleset evidence is verified.'
    else 'Application release authority and current repository enforcement evidence are green. Production promotion remains a deliberate human action.'
  end as release_message,
  now() as checked_at
from schema_state ss
cross join component_state cs
left join source_state src on true
left join policy_state pol on true;
revoke all on table public.v_it_release_authority_status from public,anon,authenticated;
grant select on table public.v_it_release_authority_status to service_role;

create or replace function public.ywi_repository_policy_evidence_authority_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql
security definer
set search_path=public,pg_temp
as $$
  select 'repository_policy_raw_service_write_blocked',
    case when not has_table_privilege('service_role','public.it_repository_policy_evidence','insert')
      and not has_table_privilege('service_role','public.it_repository_policy_evidence','update')
      and not has_table_privilege('service_role','public.it_repository_policy_evidence','delete')
      and has_table_privilege('service_role','public.it_repository_policy_evidence','select')
      then 'passed' else 'failed' end,
    'Service role may read repository-policy evidence but raw writes remain blocked.'
  union all
  select 'repository_policy_recorder_service_only',
    case when exists(
      select 1 from information_schema.routine_privileges
      where routine_schema='public' and routine_name='ywi_record_verified_repository_policy_evidence'
        and grantee='service_role' and privilege_type='EXECUTE'
    ) and not exists(
      select 1 from information_schema.routine_privileges
      where routine_schema='public' and routine_name='ywi_record_verified_repository_policy_evidence'
        and grantee in ('anon','authenticated','PUBLIC') and privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
    'Only service_role may execute the verified repository-policy recorder.'
  union all
  select 'repository_policy_view_service_private',
    case when not has_table_privilege('anon','public.v_it_repository_policy_evidence_current','select')
      and not has_table_privilege('authenticated','public.v_it_repository_policy_evidence_current','select')
      and has_table_privilege('service_role','public.v_it_repository_policy_evidence_current','select')
      then 'passed' else 'failed' end,
    'Repository-policy current evidence remains private service control-plane data.'
  union all
  select 'release_source_policy_separation_preserved',
    case when not exists(
      select 1 from public.it_release_source_evidence
      where workflow_status='passed' and branch_policy_verified is distinct from false
    ) then 'passed' else 'failed' end,
    'Detailed repository policy remains independently recorded; passed release-source rows retain branch_policy_verified=false.'
  union all
  select 'open_business_acceptance_unchanged',
    case when (select count(*) from public.v_it_open_rail_acceptance_readiness where rail_status<>'complete')=11
      then 'passed' else 'failed' end,
    'All human/provider/accounting/content/staging acceptance rails remain open.'
  union all
  select 'finance_provider_execution_off',
    case when not exists(
      select 1 from public.finance_job_completion_posting_execution_controls
      where execution_enabled=true or provider_mutation_enabled=true
    ) then 'passed' else 'failed' end,
    'Finance posting execution and payment-provider mutation remain OFF.';
$$;
revoke execute on function public.ywi_repository_policy_evidence_authority_assertions() from public,anon,authenticated,service_role;
grant execute on function public.ywi_repository_policy_evidence_authority_assertions() to service_role;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values (
  'repository_policy_evidence_authority','Release','Verified GitHub main repository policy evidence','critical',
  'Keep detailed main-ruleset evidence independent from release-source evidence. Accept GREEN only from a recent OIDC-authenticated verification of the active main protection ruleset.',
  'Admin > I.T. Readiness > Release authority',55,true
)
on conflict(check_key) do update set
  check_group=excluded.check_group,check_title=excluded.check_title,severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,route_hint=excluded.route_hint,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,updated_at=now();

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  208,'208_repository_policy_evidence_authority',
  'Adds independent, service-private GitHub main-ruleset evidence and bridges it into I.T. release authority without changing release-source evidence semantics.',
  'applied',now(),'schema208',
  'No GitHub evidence is fabricated by migration; no business acceptance, Auth, Finance/provider, staging, customer, or Production-promotion mutation.',
  '208_repository_policy_evidence_authority.sql','schema208'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true)
as
select
  208 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=208 then 'current'
    when coalesce(max(schema_version) filter(where status='applied'),0)>208 then 'ahead'
    else 'drift'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=208 then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter(where status='applied'),0)>208 then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
