begin;

-- Schema 203 — Auth evidence authorized recording authority.
--
-- Build 220 created a source-side intake candidate for genuine Supabase Dashboard / Management API
-- observations. This migration closes the next missing control: service-role recording must not be
-- an unconstrained raw insert. The database now re-validates project identity, provenance, freshness,
-- traceability and the control-specific observed state, derives verification status/expiry, and records
-- idempotently through one service-private RPC.
--
-- This migration does not obtain or fabricate external Auth evidence, change any Supabase Auth setting,
-- run staging acceptance, close a business/human/external rail, enable Finance/provider mutation, or
-- authorize Production promotion.

alter table public.it_auth_security_evidence
  add column if not exists source_project_ref text,
  add column if not exists source_capture_sha256 text,
  add column if not exists recording_contract_version integer;

-- Historical rows remain available as supporting history, but a row cannot remain authoritative after
-- Schema 203 unless it carries the project/hash traceability required by the authorized recording path.
update public.it_auth_security_evidence
set
  is_authoritative=false,
  verification_status=case when verification_status='verified_secure' then 'unverified' else verification_status end
where is_authoritative=true
  and (
    nullif(btrim(coalesce(source_project_ref,'')),'') is null
    or nullif(btrim(coalesce(source_capture_sha256,'')),'') is null
  );

alter table public.it_auth_security_evidence
  drop constraint if exists it_auth_security_evidence_source_project_ref_chk;
alter table public.it_auth_security_evidence
  add constraint it_auth_security_evidence_source_project_ref_chk
  check (
    source_project_ref is null
    or source_project_ref ~ '^[a-z0-9-]{8,80}$'
  );

alter table public.it_auth_security_evidence
  drop constraint if exists it_auth_security_evidence_source_capture_sha256_chk;
alter table public.it_auth_security_evidence
  add constraint it_auth_security_evidence_source_capture_sha256_chk
  check (
    source_capture_sha256 is null
    or source_capture_sha256 ~ '^[0-9a-f]{64}$'
  );

alter table public.it_auth_security_evidence
  drop constraint if exists it_auth_security_evidence_recording_contract_version_chk;
alter table public.it_auth_security_evidence
  add constraint it_auth_security_evidence_recording_contract_version_chk
  check (
    recording_contract_version is null
    or recording_contract_version=1
  );

alter table public.it_auth_security_evidence
  drop constraint if exists it_auth_security_evidence_authoritative_traceability_chk;
alter table public.it_auth_security_evidence
  add constraint it_auth_security_evidence_authoritative_traceability_chk
  check (
    is_authoritative=false
    or (
      nullif(btrim(coalesce(source_project_ref,'')),'') is not null
      and source_capture_sha256 ~ '^[0-9a-f]{64}$'
      and recording_contract_version=1
    )
  );

alter table public.it_auth_security_evidence
  drop constraint if exists it_auth_security_evidence_sensitive_detail_chk;
alter table public.it_auth_security_evidence
  add constraint it_auth_security_evidence_sensitive_detail_chk
  check (
    not (
      evidence_detail ?| array[
        'authorization','access_token','refresh_token','service_role','service_role_key',
        'api_key','apikey','jwt','secret','cookie','private_key','password'
      ]
    )
  );

-- Reassert verified-secure defense with Schema 203 traceability included.
alter table public.it_auth_security_evidence
  drop constraint if exists it_auth_security_evidence_secure_provenance_chk;
alter table public.it_auth_security_evidence
  add constraint it_auth_security_evidence_secure_provenance_chk
  check (
    verification_status <> 'verified_secure'
    or (
      is_authoritative=true
      and evidence_source in ('supabase_dashboard','supabase_management_api')
      and nullif(btrim(coalesce(evidence_reference,'')),'') is not null
      and nullif(btrim(coalesce(source_project_ref,'')),'') is not null
      and source_capture_sha256 ~ '^[0-9a-f]{64}$'
      and recording_contract_version=1
      and (
        (control_key='leaked_password_protection' and observed_state='enabled')
        or (control_key='mfa_options' and observed_state='configured')
      )
    )
  );

create unique index if not exists it_auth_security_evidence_capture_uidx
  on public.it_auth_security_evidence(
    control_key,evidence_source,source_project_ref,source_capture_sha256
  )
  where source_capture_sha256 is not null;

create or replace function public.ywi_record_auth_security_evidence(
  p_control_key text,
  p_evidence_source text,
  p_observed_state text,
  p_observed_at timestamptz,
  p_source_project_ref text,
  p_evidence_reference text,
  p_source_capture_sha256 text,
  p_evidence_detail jsonb default '{}'::jsonb,
  p_recorded_by_profile_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_id bigint;
  v_control_key text := lower(btrim(coalesce(p_control_key,'')));
  v_source text := lower(btrim(coalesce(p_evidence_source,'')));
  v_state text := lower(btrim(coalesce(p_observed_state,'')));
  v_project_ref text := lower(btrim(coalesce(p_source_project_ref,'')));
  v_reference text := btrim(coalesce(p_evidence_reference,''));
  v_capture_sha text := lower(btrim(coalesce(p_source_capture_sha256,'')));
  v_detail jsonb := coalesce(p_evidence_detail,'{}'::jsonb);
  v_status text;
  v_expires_at timestamptz;
begin
  if v_control_key not in ('leaked_password_protection','mfa_options') then
    raise exception 'Unsupported Auth security control.' using errcode='22023';
  end if;

  if v_source not in ('supabase_dashboard','supabase_management_api') then
    raise exception 'Only Supabase Dashboard or Management API evidence may be recorded authoritatively.' using errcode='22023';
  end if;

  if not exists(
    select 1
    from public.it_runtime_environment_authorities a
    where a.project_ref=v_project_ref
      and a.environment_class='production'
  ) then
    raise exception 'Auth evidence project_ref must match a registered Production authority.' using errcode='22023';
  end if;

  if p_observed_at is null then
    raise exception 'observed_at is required.' using errcode='22023';
  end if;
  if p_observed_at > now()+interval '5 minutes' then
    raise exception 'observed_at must not be materially future-dated.' using errcode='22023';
  end if;
  if p_observed_at < now()-interval '30 days' then
    raise exception 'observed_at is older than the 30-day current-evidence window.' using errcode='22023';
  end if;

  if v_reference='' or length(v_reference)>1000 then
    raise exception 'A durable evidence_reference of 1-1000 characters is required.' using errcode='22023';
  end if;

  if v_capture_sha !~ '^[0-9a-f]{64}$' then
    raise exception 'A lowercase 64-character source_capture_sha256 is required.' using errcode='22023';
  end if;

  if jsonb_typeof(v_detail)<>'object' then
    raise exception 'evidence_detail must be a JSON object.' using errcode='22023';
  end if;
  if v_detail ?| array[
    'authorization','access_token','refresh_token','service_role','service_role_key',
    'api_key','apikey','jwt','secret','cookie','private_key','password'
  ] then
    raise exception 'evidence_detail contains a secret-bearing top-level field.' using errcode='22023';
  end if;

  if v_control_key='leaked_password_protection' then
    if v_state='enabled' then v_status:='verified_secure';
    elsif v_state='disabled' then v_status:='verified_followup';
    elsif v_state='unknown' then v_status:='unverified';
    else raise exception 'Invalid observed_state for leaked-password protection.' using errcode='22023';
    end if;
  else
    if v_state='configured' then v_status:='verified_secure';
    elsif v_state='not_configured' then v_status:='verified_followup';
    elsif v_state='unknown' then v_status:='unverified';
    else raise exception 'Invalid observed_state for MFA options.' using errcode='22023';
    end if;
  end if;

  v_expires_at := p_observed_at + interval '30 days';
  v_detail := v_detail || jsonb_build_object(
    'recording_contract_version',1,
    'source_project_ref',v_project_ref,
    'source_capture_sha256',v_capture_sha
  );

  insert into public.it_auth_security_evidence(
    control_key,evidence_source,observed_state,verification_status,is_authoritative,
    observed_at,expires_at,evidence_reference,evidence_detail,recorded_by_profile_id,
    introduced_by_schema,source_project_ref,source_capture_sha256,recording_contract_version
  ) values (
    v_control_key,v_source,v_state,v_status,true,
    p_observed_at,v_expires_at,v_reference,v_detail,p_recorded_by_profile_id,
    203,v_project_ref,v_capture_sha,1
  )
  on conflict(control_key,evidence_source,source_project_ref,source_capture_sha256)
    where source_capture_sha256 is not null
  do update set
    observed_state=excluded.observed_state,
    verification_status=excluded.verification_status,
    is_authoritative=true,
    observed_at=excluded.observed_at,
    expires_at=excluded.expires_at,
    evidence_reference=excluded.evidence_reference,
    evidence_detail=excluded.evidence_detail,
    recorded_by_profile_id=excluded.recorded_by_profile_id,
    introduced_by_schema=203,
    recording_contract_version=1,
    created_at=now()
  returning evidence_id into v_id;

  return v_id;
end;
$$;

revoke all on function public.ywi_record_auth_security_evidence(text,text,text,timestamptz,text,text,text,jsonb,uuid)
  from public,anon,authenticated;
grant execute on function public.ywi_record_auth_security_evidence(text,text,text,timestamptz,text,text,text,jsonb,uuid)
  to service_role;

-- Defense in depth: preserve every existing Schema 202 view column in its exact order.
-- The new traceability fields are appended only; PostgreSQL CREATE OR REPLACE VIEW requires this.
create or replace view public.v_it_auth_security_evidence_current
with (security_invoker=true)
as
with controls(control_key,control_title,secure_state_hint) as (
  values
    ('leaked_password_protection'::text,'Leaked-password protection'::text,'enabled'::text),
    ('mfa_options'::text,'MFA options'::text,'configured'::text)
), latest as (
  select distinct on (e.control_key)
    e.control_key,e.evidence_id,e.evidence_source,e.observed_state,e.verification_status,
    e.is_authoritative,e.observed_at,e.expires_at,e.evidence_reference,e.evidence_detail,e.created_at,
    e.source_project_ref,e.source_capture_sha256,e.recording_contract_version
  from public.it_auth_security_evidence e
  order by e.control_key,e.observed_at desc,e.evidence_id desc
)
select
  c.control_key,
  c.control_title,
  c.secure_state_hint,
  l.evidence_id,
  l.evidence_source,
  l.observed_state,
  l.verification_status,
  coalesce(l.is_authoritative,false) as is_authoritative,
  l.observed_at,
  l.expires_at,
  l.evidence_reference,
  l.evidence_detail,
  case
    when l.evidence_id is null then 'pending_external_verification'
    when l.expires_at is not null and l.expires_at <= now() then 'stale_external_evidence'
    when l.observed_at < now()-interval '30 days' then 'stale_external_evidence'
    when not l.is_authoritative then 'pending_external_verification'
    when l.evidence_source not in ('supabase_dashboard','supabase_management_api') then 'pending_external_verification'
    when nullif(btrim(coalesce(l.evidence_reference,'')),'') is null then 'pending_external_verification'
    when l.source_capture_sha256 !~ '^[0-9a-f]{64}$' then 'pending_external_verification'
    when l.recording_contract_version<>1 then 'pending_external_verification'
    when not exists(
      select 1 from public.it_runtime_environment_authorities a
      where a.project_ref=l.source_project_ref and a.environment_class='production'
    ) then 'pending_external_verification'
    when l.verification_status='verified_secure'
      and (
        (c.control_key='leaked_password_protection' and l.observed_state='enabled')
        or (c.control_key='mfa_options' and l.observed_state='configured')
      ) then 'verified_secure'
    when l.verification_status='verified_followup'
      or l.observed_state in ('disabled','not_configured') then 'verified_followup'
    else 'pending_external_verification'
  end::text as current_status,
  case
    when l.evidence_id is null then 'No current authoritative Supabase Auth control-plane evidence has been recorded.'
    when l.expires_at is not null and l.expires_at <= now() then 'Recorded Supabase Auth control-plane evidence has expired and must be re-verified.'
    when l.observed_at < now()-interval '30 days' then 'Recorded Supabase Auth control-plane evidence is older than 30 days and must be re-verified.'
    when not l.is_authoritative then 'Supporting/manual/advisor evidence cannot prove the external Auth setting.'
    when l.evidence_source not in ('supabase_dashboard','supabase_management_api') then 'Only Supabase Dashboard or Management API evidence may be authoritative.'
    when nullif(btrim(coalesce(l.evidence_reference,'')),'') is null then 'Authoritative Auth evidence requires a durable source reference.'
    when l.source_capture_sha256 !~ '^[0-9a-f]{64}$' then 'Authoritative Auth evidence requires a traceable source-capture digest.'
    when l.recording_contract_version<>1 then 'Authoritative Auth evidence must use the current authorized recording contract.'
    when not exists(
      select 1 from public.it_runtime_environment_authorities a
      where a.project_ref=l.source_project_ref and a.environment_class='production'
    ) then 'Recorded Auth evidence is not bound to a registered Production project authority.'
    when l.verification_status='verified_secure'
      and (
        (c.control_key='leaked_password_protection' and l.observed_state='enabled')
        or (c.control_key='mfa_options' and l.observed_state='configured')
      ) then 'Recent authoritative Supabase control-plane evidence verifies the control as secure.'
    when l.verification_status='verified_followup'
      or l.observed_state in ('disabled','not_configured') then 'Recent authoritative Supabase control-plane evidence confirms that follow-up is still required.'
    else 'External Auth configuration still requires authoritative Supabase Dashboard or Management API verification.'
  end::text as status_message,
  now() as checked_at,
  l.source_project_ref,
  l.source_capture_sha256,
  l.recording_contract_version
from controls c
left join latest l on l.control_key=c.control_key;

revoke all on table public.v_it_auth_security_evidence_current from public,anon,authenticated;
grant select on table public.v_it_auth_security_evidence_current to service_role;

create or replace view public.v_it_auth_security_evidence_status
with (security_invoker=true)
as
select
  count(*)::int as control_count,
  count(*) filter(where current_status='verified_secure')::int as verified_secure_count,
  count(*) filter(where current_status='verified_followup')::int as verified_followup_count,
  count(*) filter(where current_status='pending_external_verification')::int as pending_external_verification_count,
  count(*) filter(where current_status='stale_external_evidence')::int as stale_external_evidence_count,
  case when count(*) filter(where current_status<>'verified_secure')=0 then 'green' else 'amber' end::text as auth_security_status,
  'Auth-security GREEN requires recent official control-plane evidence recorded through the service-private traceable recording contract for both controls.'::text as status_message,
  now() as checked_at
from public.v_it_auth_security_evidence_current;

revoke all on table public.v_it_auth_security_evidence_status from public,anon,authenticated;
grant select on table public.v_it_auth_security_evidence_status to service_role;

create or replace function public.ywi_auth_security_evidence_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql
security definer
set search_path=public,pg_temp
as $$
  select 'auth_controls_catalogued',
    case when (select count(*) from public.v_it_auth_security_evidence_current)=2 then 'passed' else 'failed' end,
    'Exactly leaked-password protection and MFA options are represented in current Auth-security evidence authority.'
  union all select 'authoritative_provenance_official_only',
    case when not exists(
      select 1 from public.it_auth_security_evidence
      where is_authoritative=true
        and evidence_source not in ('supabase_dashboard','supabase_management_api')
    ) then 'passed' else 'failed' end,
    'Only Supabase Dashboard or Management API evidence may be authoritative.'
  union all select 'authoritative_reference_required',
    case when not exists(
      select 1 from public.it_auth_security_evidence
      where is_authoritative=true
        and nullif(btrim(coalesce(evidence_reference,'')),'') is null
    ) then 'passed' else 'failed' end,
    'Every authoritative Auth observation retains a durable evidence reference.'
  union all select 'authoritative_traceability_required',
    case when not exists(
      select 1 from public.it_auth_security_evidence
      where is_authoritative=true
        and (
          source_capture_sha256 !~ '^[0-9a-f]{64}$'
          or recording_contract_version<>1
          or not exists(
            select 1 from public.it_runtime_environment_authorities a
            where a.project_ref=it_auth_security_evidence.source_project_ref
              and a.environment_class='production'
          )
        )
    ) then 'passed' else 'failed' end,
    'Authoritative Auth evidence is bound to a registered Production project, source-capture digest, and current recording contract.'
  union all select 'verified_secure_requires_exact_control_state',
    case when not exists(
      select 1 from public.it_auth_security_evidence
      where verification_status='verified_secure'
        and (
          is_authoritative=false
          or evidence_source not in ('supabase_dashboard','supabase_management_api')
          or nullif(btrim(coalesce(evidence_reference,'')),'') is null
          or source_capture_sha256 !~ '^[0-9a-f]{64}$'
          or recording_contract_version<>1
          or not (
            (control_key='leaked_password_protection' and observed_state='enabled')
            or (control_key='mfa_options' and observed_state='configured')
          )
        )
    ) then 'passed' else 'failed' end,
    'Verified-secure evidence requires official provenance, traceability and the exact secure state for the named control.'
  union all select 'current_auth_followups_truthful',
    case when (
      select count(*) from public.v_it_current_admin_todo
      where todo_key in ('security:leaked_password_protection','security:mfa_options')
    ) = (
      select count(*) from public.v_it_auth_security_evidence_current where current_status<>'verified_secure'
    ) then 'passed' else 'failed' end,
    'Current Admin To-Do agrees with current Auth-security evidence truth.'
  union all select 'authorized_recording_service_private',
    case when not exists(
      select 1 from information_schema.routine_privileges
      where routine_schema='public'
        and routine_name='ywi_record_auth_security_evidence'
        and grantee in ('anon','authenticated','PUBLIC')
        and privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
    'Only the service role may execute the authorized Auth evidence recording RPC.'
  union all select 'auth_evidence_authority_service_private',
    case when not has_table_privilege('anon','public.it_auth_security_evidence','select')
      and not has_table_privilege('authenticated','public.it_auth_security_evidence','select')
      and has_table_privilege('service_role','public.it_auth_security_evidence','select')
      and not has_table_privilege('anon','public.v_it_auth_security_evidence_current','select')
      and not has_table_privilege('authenticated','public.v_it_auth_security_evidence_current','select')
      and has_table_privilege('service_role','public.v_it_auth_security_evidence_current','select')
    then 'passed' else 'failed' end,
    'Auth-security evidence authority remains service-role-only.'
  union all select 'open_business_acceptance_unchanged',
    case when (select count(*) from public.v_it_open_rail_acceptance_readiness where rail_status<>'complete')=11 then 'passed' else 'failed' end,
    'All 11 human/provider/accounting/content/staging acceptance rails remain open.'
  union all select 'finance_provider_execution_off',
    case when not exists(
      select 1 from public.finance_job_completion_posting_execution_controls
      where execution_enabled=true or provider_mutation_enabled=true
    ) then 'passed' else 'failed' end,
    'Finance posting execution and payment-provider mutation remain OFF.';
$$;

revoke all on function public.ywi_auth_security_evidence_assertions() from public,anon,authenticated;
grant execute on function public.ywi_auth_security_evidence_assertions() to service_role;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values (
  'auth_evidence_authorized_recording','Security','Auth evidence authorized recording contract','warning',
  'After confirming genuine current Supabase Dashboard/Management API evidence, record only through the service-private authorized RPC with exact Production project binding and the intake capture digest. Re-read current Auth evidence immediately after recording.',
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

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values (
  'schema203_auth_evidence_authorized_recording','security','Auth evidence authorized recording authority',
  'active',80,8,10,
  'Verify project binding, traceable capture hash, service-role-only RPC, control-specific status derivation, idempotency, current evidence truth, source gates, and release proof. Do not fabricate external evidence or mutate Auth settings.',
  'Admin / I.T.',123,
  jsonb_build_object(
    'schema',203,'auth_setting_mutation',false,'external_evidence_fabrication',false,
    'raw_service_role_insert_required',false,'authorized_recording_rpc',true,
    'business_rail_auto_close',false,'finance_mutation',false,'payment_provider_mutation',false,
    'staging_execution',false,'production_promotion',false
  )
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

insert into public.it_scorecard_rail_resolution_contracts(
  rail_key,resolution_class,requires_human,requires_external,auto_close_allowed,resolution_note,introduced_by_schema
) values (
  'schema203_auth_evidence_authorized_recording','build_acceptance',false,false,false,
  'Close only after schema/source/release proof. The leaked-password and MFA follow-ups remain external verification requirements until genuine current official evidence is deliberately recorded.',203
)
on conflict(rail_key) do update set
  resolution_class=excluded.resolution_class,
  requires_human=excluded.requires_human,
  requires_external=excluded.requires_external,
  auto_close_allowed=excluded.auto_close_allowed,
  resolution_note=excluded.resolution_note,
  introduced_by_schema=excluded.introduced_by_schema;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  203,'203_auth_evidence_authorized_recording',
  'Adds traceable project/capture binding and a service-role-only RPC that re-validates and derives authoritative Supabase Auth evidence records.',
  'applied',now(),'schema203',
  'No external evidence fabrication, Auth setting mutation, staging execution, business-rail closure, Finance/provider enablement, or Production promotion.',
  '203_auth_evidence_authorized_recording.sql','schema203'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,
  description=excluded.description,
  status=excluded.status,
  applied_at=excluded.applied_at,
  applied_by=excluded.applied_by,
  notes=excluded.notes,
  migration_key=excluded.migration_key,
  release_label=excluded.release_label;

create or replace view public.v_schema_drift_status as
select
  203 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=203 then 'current'
    when coalesce(max(schema_version) filter(where status='applied'),0)>203 then 'ahead'
    else 'drift'
  end::text as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=203
      then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter(where status='applied'),0)>203
      then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end::text as message,
  now() as checked_at
from public.app_schema_versions;

commit;