begin;

-- Schema 205 — verified release-source evidence authorized recording.
-- Build 217 creates the exact-main candidate and Build 219 verifies the completed run.
-- Schema 205 removes the remaining raw/legacy database recording bypasses and requires
-- repository/run/attempt/path/digest traceability for any `passed` source evidence.
-- It does not record evidence, change GitHub, run staging, enable Finance/providers, or promote Production.

alter table public.it_release_source_evidence
  add column if not exists repository text,
  add column if not exists workflow_run_attempt integer,
  add column if not exists workflow_path text,
  add column if not exists verification_contract_version integer,
  add column if not exists verified_payload_sha256 text,
  add column if not exists verified_at timestamptz;

-- Preserve historical rows, but legacy `passed` rows cannot remain authoritative without
-- the current final-verification traceability contract.
update public.it_release_source_evidence
set workflow_status='unknown',
    evidence_note=concat_ws(' ',nullif(evidence_note,''),
      'Schema 205 demoted legacy passed evidence because verified-recording traceability was absent.')
where workflow_status='passed'
  and (
    repository is distinct from 'RosevearCreations/yw'
    or source_branch is distinct from 'main'
    or coalesce(workflow_run_id,0)<=0
    or coalesce(workflow_run_attempt,0)<=0
    or workflow_name is distinct from 'YWI source and staging checks'
    or workflow_path is distinct from '.github/workflows/staging-browser-integration.yml'
    or branch_protection_reported is distinct from true
    or branch_policy_verified is distinct from false
    or verification_contract_version is distinct from 1
    or verified_payload_sha256 is null
    or verified_payload_sha256 !~ '^[0-9a-f]{64}$'
    or verified_at is null
  );

alter table public.it_release_source_evidence
  drop constraint if exists it_release_source_evidence_verified_passed_traceability_chk;
alter table public.it_release_source_evidence
  add constraint it_release_source_evidence_verified_passed_traceability_chk
  check (
    workflow_status<>'passed'
    or (
      repository='RosevearCreations/yw'
      and source_branch='main'
      and workflow_run_id is not null and workflow_run_id>0
      and workflow_run_attempt is not null and workflow_run_attempt>0
      and workflow_name='YWI source and staging checks'
      and workflow_path='.github/workflows/staging-browser-integration.yml'
      and branch_protection_reported=true
      and branch_policy_verified=false
      and verification_contract_version=1
      and verified_payload_sha256 ~ '^[0-9a-f]{64}$'
      and verified_at is not null
    )
  );

drop index if exists public.it_release_source_evidence_run_uidx;
create unique index if not exists it_release_source_evidence_run_attempt_uidx
  on public.it_release_source_evidence(source_sha,workflow_run_id,workflow_run_attempt)
  where workflow_run_id is not null and workflow_run_attempt is not null;

-- Force service-side recording through the narrow verified RPC.
revoke insert,update,delete on table public.it_release_source_evidence from service_role;
grant select on table public.it_release_source_evidence to service_role;
revoke execute on function public.ywi_record_release_source_evidence(text,text,bigint,text,text,integer,boolean,boolean,text,uuid) from service_role;

create or replace function public.ywi_record_verified_release_source_evidence(
  p_project_ref text,
  p_repository text,
  p_source_sha text,
  p_workflow_run_id bigint,
  p_workflow_run_attempt integer,
  p_workflow_name text,
  p_workflow_path text,
  p_schema_version integer,
  p_branch_protection_reported boolean,
  p_verification_contract_version integer,
  p_verified_payload_sha256 text,
  p_verified_at timestamptz,
  p_evidence_note text default null,
  p_recorded_by_profile_id uuid default null
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
  v_expected integer;
  v_latest integer;
  v_drift text;
begin
  if btrim(coalesce(p_project_ref,''))<>'jmqvkgiqlimdhcofwkxr' then
    raise exception 'Release evidence target project is not the registered YardWeasels Production project.' using errcode='22023';
  end if;
  if not exists(
    select 1 from public.it_runtime_environment_authorities
    where project_ref='jmqvkgiqlimdhcofwkxr'
      and environment_class='production'
      and staging_acceptance_mutation_allowed=false
  ) then
    raise exception 'Registered Production runtime authority is missing or unsafe.' using errcode='55000';
  end if;
  if btrim(coalesce(p_repository,''))<>'RosevearCreations/yw' then
    raise exception 'Release evidence repository must be RosevearCreations/yw.' using errcode='22023';
  end if;
  if v_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'A full lowercase 40-character source SHA is required.' using errcode='22023';
  end if;
  if coalesce(p_workflow_run_id,0)<=0 or coalesce(p_workflow_run_attempt,0)<=0 then
    raise exception 'Positive workflow run id and attempt are required.' using errcode='22023';
  end if;
  if btrim(coalesce(p_workflow_name,''))<>'YWI source and staging checks'
     or btrim(coalesce(p_workflow_path,''))<>'.github/workflows/staging-browser-integration.yml' then
    raise exception 'Release evidence must use the canonical workflow name and path.' using errcode='22023';
  end if;
  if p_branch_protection_reported is distinct from true then
    raise exception 'Current main protection must be reported true.' using errcode='22023';
  end if;
  if p_verification_contract_version is distinct from 1 then
    raise exception 'Unsupported release verification contract version.' using errcode='22023';
  end if;
  if v_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'A SHA-256 verified-payload digest is required.' using errcode='22023';
  end if;
  if p_verified_at is null
     or p_verified_at < now()-interval '24 hours'
     or p_verified_at > now()+interval '5 minutes' then
    raise exception 'Final release verification must be recent and not future-dated.' using errcode='22023';
  end if;

  select expected_schema_version,latest_applied_schema_version,drift_status
    into v_expected,v_latest,v_drift
  from public.v_schema_drift_status
  limit 1;
  if v_drift is distinct from 'current'
     or v_expected is distinct from p_schema_version
     or v_latest is distinct from p_schema_version then
    raise exception 'Production schema must exactly match the verified source schema before recording.' using errcode='55000';
  end if;

  insert into public.it_release_source_evidence(
    source_branch,source_sha,workflow_run_id,workflow_name,workflow_status,schema_version,
    branch_protection_reported,branch_policy_verified,evidence_note,recorded_by_profile_id,
    repository,workflow_run_attempt,workflow_path,verification_contract_version,
    verified_payload_sha256,verified_at
  ) values (
    'main',v_sha,p_workflow_run_id,'YWI source and staging checks','passed',p_schema_version,
    true,false,nullif(btrim(coalesce(p_evidence_note,'')),''),p_recorded_by_profile_id,
    'RosevearCreations/yw',p_workflow_run_attempt,'.github/workflows/staging-browser-integration.yml',1,
    v_digest,p_verified_at
  )
  on conflict(source_sha,workflow_run_id,workflow_run_attempt)
    where workflow_run_id is not null and workflow_run_attempt is not null
  do update set
    source_branch='main',workflow_name='YWI source and staging checks',workflow_status='passed',
    schema_version=excluded.schema_version,branch_protection_reported=true,branch_policy_verified=false,
    evidence_note=excluded.evidence_note,recorded_by_profile_id=excluded.recorded_by_profile_id,
    repository='RosevearCreations/yw',workflow_path='.github/workflows/staging-browser-integration.yml',
    verification_contract_version=1,verified_payload_sha256=excluded.verified_payload_sha256,
    verified_at=excluded.verified_at,recorded_at=now()
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.ywi_record_verified_release_source_evidence(text,text,text,bigint,integer,text,text,integer,boolean,integer,text,timestamptz,text,uuid) from public,anon,authenticated;
grant execute on function public.ywi_record_verified_release_source_evidence(text,text,text,bigint,integer,text,text,integer,boolean,integer,text,timestamptz,text,uuid) to service_role;

-- Preserve every historical column of this depended-on view in its exact existing order.
-- New traceability columns are appended only, which is valid for CREATE OR REPLACE VIEW.
create or replace view public.v_it_release_source_evidence_current
with (security_invoker=true)
as
with expected as (
  select expected_schema_version from public.v_schema_drift_status limit 1
)
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
    when e.branch_protection_reported is true and e.branch_policy_verified is true then 'green'
    when e.branch_protection_reported is false then 'amber'
    when e.branch_protection_reported is true then 'amber'
    else 'unknown'
  end as repository_enforcement_status,
  case
    when e.workflow_status='passed'
      and e.repository='RosevearCreations/yw'
      and e.source_branch='main'
      and e.workflow_run_id>0
      and e.workflow_run_attempt>0
      and e.workflow_name='YWI source and staging checks'
      and e.workflow_path='.github/workflows/staging-browser-integration.yml'
      and e.schema_version=expected.expected_schema_version
      and e.branch_protection_reported=true
      and e.branch_policy_verified=false
      and e.verification_contract_version=1
      and e.verified_payload_sha256 ~ '^[0-9a-f]{64}$'
      and e.verified_at is not null
    then 'green'
    when e.workflow_status in ('failed','cancelled') then 'red'
    else 'amber'
  end as source_gate_status,
  e.evidence_note,
  e.recorded_by_profile_id,
  e.recorded_at,
  e.repository,
  e.workflow_run_attempt,
  e.workflow_path,
  e.verification_contract_version,
  e.verified_payload_sha256,
  e.verified_at
from public.it_release_source_evidence e
cross join expected
where e.schema_version=expected.expected_schema_version
order by e.recorded_at desc,e.id desc
limit 1;

revoke all on table public.v_it_release_source_evidence_current from public,anon,authenticated;
grant select on table public.v_it_release_source_evidence_current to service_role;

create or replace function public.ywi_release_source_recording_authority_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql
security definer
set search_path=public,pg_temp
as $$
  select 'release_evidence_direct_service_write_blocked',
    case when not has_table_privilege('service_role','public.it_release_source_evidence','insert')
      and not has_table_privilege('service_role','public.it_release_source_evidence','update')
      and not has_table_privilege('service_role','public.it_release_source_evidence','delete')
      and has_table_privilege('service_role','public.it_release_source_evidence','select')
    then 'passed' else 'failed' end,
    'Service role may read release evidence but raw writes are blocked.'
  union all select 'legacy_release_recorder_disabled',
    case when not exists(
      select 1 from information_schema.routine_privileges
      where routine_schema='public' and routine_name='ywi_record_release_source_evidence'
        and grantee='service_role' and privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
    'The legacy caller-controlled release recorder is no longer executable by service_role.'
  union all select 'verified_release_recorder_service_only',
    case when exists(
      select 1 from information_schema.routine_privileges
      where routine_schema='public' and routine_name='ywi_record_verified_release_source_evidence'
        and grantee='service_role' and privilege_type='EXECUTE'
    ) and not exists(
      select 1 from information_schema.routine_privileges
      where routine_schema='public' and routine_name='ywi_record_verified_release_source_evidence'
        and grantee in ('anon','authenticated','PUBLIC') and privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
    'Only service_role may execute the verified release-source recorder.'
  union all select 'passed_release_traceability_required',
    case when not exists(
      select 1 from public.it_release_source_evidence
      where workflow_status='passed' and (
        repository is distinct from 'RosevearCreations/yw'
        or source_branch is distinct from 'main'
        or coalesce(workflow_run_id,0)<=0 or coalesce(workflow_run_attempt,0)<=0
        or workflow_name is distinct from 'YWI source and staging checks'
        or workflow_path is distinct from '.github/workflows/staging-browser-integration.yml'
        or branch_protection_reported is distinct from true
        or branch_policy_verified is distinct from false
        or verification_contract_version is distinct from 1
        or verified_payload_sha256 is null or verified_payload_sha256 !~ '^[0-9a-f]{64}$'
        or verified_at is null
      )
    ) then 'passed' else 'failed' end,
    'Every passed release-source row has canonical run/attempt/path/digest traceability.'
  union all select 'open_business_acceptance_unchanged',
    case when (select count(*) from public.v_it_open_rail_acceptance_readiness where rail_status<>'complete')=11
    then 'passed' else 'failed' end,
    'All human/provider/accounting/content/staging acceptance rails remain open.'
  union all select 'finance_provider_execution_off',
    case when not exists(
      select 1 from public.finance_job_completion_posting_execution_controls
      where execution_enabled=true or provider_mutation_enabled=true
    ) then 'passed' else 'failed' end,
    'Finance posting execution and payment-provider mutation remain OFF.';
$$;
revoke all on function public.ywi_release_source_recording_authority_assertions() from public,anon,authenticated;
grant execute on function public.ywi_release_source_recording_authority_assertions() to service_role;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values (
  'release_source_recording_authority','Release','Verified release-source recording authority','critical',
  'Keep raw writes and the legacy recorder disabled. Record only freshly re-verified exact-main evidence through the verified service RPC after exact Production schema parity.',
  'Admin > I.T. Readiness > Release authority',54,true
)
on conflict(check_key) do update set
  check_group=excluded.check_group,check_title=excluded.check_title,
  severity_if_failed=excluded.severity_if_failed,action_hint=excluded.action_hint,
  route_hint=excluded.route_hint,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,updated_at=now();

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values (
  'schema205_release_evidence_authorized_recording','admin','Verified release-source authorized recording',
  'active',80,8,10,
  'Verify direct/legacy write bypasses are locked, verified recording remains service-private, exact source gates pass, and Production promotion remains separate.',
  'Admin / I.T. / Release',125,
  jsonb_build_object(
    'schema',205,'direct_service_table_write',false,'legacy_release_recorder_execute',false,
    'verified_recording_rpc',true,'workflow_status_caller_supplied',false,'branch_policy_verified',false,
    'database_evidence_recorded_by_migration',false,'business_rail_auto_close',false,
    'finance_mutation',false,'payment_provider_mutation',false,'staging_execution',false,'production_promotion',false
  )
)
on conflict(rail_key) do update set
  rail_area=excluded.rail_area,rail_title=excluded.rail_title,rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,current_value=excluded.current_value,target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint,owner_hint=excluded.owner_hint,sort_order=excluded.sort_order,
  metadata=excluded.metadata,updated_at=now();

insert into public.it_scorecard_rail_resolution_contracts(
  rail_key,resolution_class,requires_human,requires_external,auto_close_allowed,resolution_note,introduced_by_schema
) values (
  'schema205_release_evidence_authorized_recording','build_acceptance',false,false,false,
  'Close only after schema/source/release proof. This rail does not record evidence, verify detailed GitHub policy, promote Production, or close business rails.',205
)
on conflict(rail_key) do update set
  resolution_class=excluded.resolution_class,requires_human=excluded.requires_human,
  requires_external=excluded.requires_external,auto_close_allowed=excluded.auto_close_allowed,
  resolution_note=excluded.resolution_note,introduced_by_schema=excluded.introduced_by_schema;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  205,'205_release_evidence_authorized_recording',
  'Forces passed release-source evidence through the traceable verified recorder and locks legacy/raw write bypasses.',
  'applied',now(),'schema205',
  'No evidence creation, GitHub mutation, staging execution, Finance/provider enablement, business-rail closure, or Production promotion.',
  '205_release_evidence_authorized_recording.sql','schema205'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status=excluded.status,
  applied_at=excluded.applied_at,applied_by=excluded.applied_by,notes=excluded.notes,
  migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status as
select 205 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=205 then 'current'
    when coalesce(max(schema_version) filter(where status='applied'),0)>205 then 'ahead'
    else 'drift'
  end::text as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=205 then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter(where status='applied'),0)>205 then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end::text as message,
  now() as checked_at
from public.app_schema_versions;

commit;
