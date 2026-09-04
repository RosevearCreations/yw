begin;

-- Schema 202 — Auth evidence provenance hardening.
--
-- Schema 198 correctly separated Supabase Auth control-plane truth from advisor/database
-- inference, but its initial evidence constraint still allowed evidence_source='manual_external'
-- to be marked authoritative and verified_secure. Current I.T. authority requires actual
-- Supabase Dashboard or Management API evidence for leaked-password protection and MFA.
-- This migration closes that false-green path without changing either external Auth setting.
--
-- No evidence is fabricated here. No business acceptance rail is closed. Finance posting and
-- provider mutation remain OFF. Staging/Production boundaries and manual Production promotion
-- remain unchanged.

-- Preserve historical/supporting rows but demote any provenance that cannot be authoritative
-- under the current control-plane contract. This makes later application safe even if a stale
-- Schema 198-era manual/advisor row was previously labelled authoritative.
update public.it_auth_security_evidence
set
  is_authoritative=false,
  verification_status=case when verification_status='verified_secure' then 'unverified' else verification_status end
where evidence_source not in ('supabase_dashboard','supabase_management_api')
  and (is_authoritative=true or verification_status='verified_secure');

alter table public.it_auth_security_evidence
  drop constraint if exists it_auth_security_evidence_authoritative_source_chk;
alter table public.it_auth_security_evidence
  add constraint it_auth_security_evidence_authoritative_source_chk
  check (
    is_authoritative=false
    or evidence_source in ('supabase_dashboard','supabase_management_api')
  );

alter table public.it_auth_security_evidence
  drop constraint if exists it_auth_security_evidence_authoritative_reference_chk;
alter table public.it_auth_security_evidence
  add constraint it_auth_security_evidence_authoritative_reference_chk
  check (
    is_authoritative=false
    or nullif(btrim(coalesce(evidence_reference,'')),'') is not null
  );

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
      and (
        (control_key='leaked_password_protection' and observed_state='enabled')
        or (control_key='mfa_options' and observed_state='configured')
      )
    )
  );

-- Defense in depth: even if a future table constraint is accidentally loosened, the current
-- readiness view independently requires official control-plane provenance and the exact secure
-- state for the corresponding control before returning verified_secure.
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
    e.is_authoritative,e.observed_at,e.expires_at,e.evidence_reference,e.evidence_detail,e.created_at
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
    when l.verification_status='verified_secure'
      and (
        (c.control_key='leaked_password_protection' and l.observed_state='enabled')
        or (c.control_key='mfa_options' and l.observed_state='configured')
      ) then 'Recent authoritative Supabase control-plane evidence verifies the control as secure.'
    when l.verification_status='verified_followup'
      or l.observed_state in ('disabled','not_configured') then 'Recent authoritative Supabase control-plane evidence confirms that follow-up is still required.'
    else 'External Auth configuration still requires authoritative Supabase Dashboard or Management API verification.'
  end::text as status_message,
  now() as checked_at
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
  'Auth-security GREEN requires recent authoritative Supabase Dashboard or Management API evidence for both controls. Manual notes, advisor rows, or absence of warnings never prove the setting.'::text as status_message,
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
    'Only Supabase Dashboard or Management API evidence may be authoritative; manual/advisor evidence is supporting context only.'
  union all select 'authoritative_reference_required',
    case when not exists(
      select 1 from public.it_auth_security_evidence
      where is_authoritative=true
        and nullif(btrim(coalesce(evidence_reference,'')),'') is null
    ) then 'passed' else 'failed' end,
    'Every authoritative Auth observation retains a durable evidence reference.'
  union all select 'verified_secure_requires_exact_control_state',
    case when not exists(
      select 1 from public.it_auth_security_evidence
      where verification_status='verified_secure'
        and (
          is_authoritative=false
          or evidence_source not in ('supabase_dashboard','supabase_management_api')
          or nullif(btrim(coalesce(evidence_reference,'')),'') is null
          or not (
            (control_key='leaked_password_protection' and observed_state='enabled')
            or (control_key='mfa_options' and observed_state='configured')
          )
        )
    ) then 'passed' else 'failed' end,
    'Verified-secure evidence requires official control-plane provenance, a reference, and the exact secure state for that Auth control.'
  union all select 'current_auth_followups_truthful',
    case when (
      select count(*) from public.v_it_current_admin_todo
      where todo_key in ('security:leaked_password_protection','security:mfa_options')
    ) = (
      select count(*) from public.v_it_auth_security_evidence_current where current_status<>'verified_secure'
    ) then 'passed' else 'failed' end,
    'Current Admin To-Do agrees with current Auth-security evidence truth.'
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
  'auth_evidence_provenance','Security','Auth evidence provenance is authoritative and traceable','warning',
  'Record leaked-password protection and MFA evidence only from the current Supabase Dashboard or Management API. Keep manual notes/advisor output non-authoritative and retain a source reference.',
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
set
  rail_status='complete',progress_percent=100,current_value=10,target_value=10,
  next_action_hint='Core live-write staging runner source authority is complete; actual staging business evidence remains independently gated.',
  updated_at=now()
where rail_key='schema201_core_live_write_staging_runner_authority';

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values (
  'schema202_auth_evidence_provenance_hardening','security','Auth evidence provenance hardening',
  'active',80,8,10,
  'Verify official-source-only authoritative evidence, exact secure-state constraints, durable references, current To-Do truth, source/browser gates, and release proof. Do not fabricate evidence or mutate Supabase Auth settings.',
  'Admin / I.T.',122,
  jsonb_build_object(
    'schema',202,'official_authoritative_sources',jsonb_build_array('supabase_dashboard','supabase_management_api'),
    'manual_external_authoritative',false,'advisor_authoritative',false,'auth_setting_mutation',false,
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
  'schema202_auth_evidence_provenance_hardening','build_acceptance',false,false,false,
  'Close only after schema/source/browser/release proof. The leaked-password and MFA external-verification follow-ups remain open until actual current Supabase Dashboard or Management API evidence exists.',202
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
  202,'202_auth_evidence_provenance_hardening',
  'Restricts authoritative Auth-security evidence to current Supabase Dashboard/Management API observations with durable references and exact control-specific secure states.',
  'applied',now(),'schema202',
  'No external Auth setting mutation, evidence fabrication, business-rail closure, staging execution, Finance/provider enablement, or Production promotion.',
  '202_auth_evidence_provenance_hardening.sql','schema202'
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
  202 as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status='applied'),0)=202 then 'current'
    when coalesce(max(schema_version) filter (where status='applied'),0)>202 then 'ahead'
    else 'drift'
  end::text as drift_status,
  case
    when coalesce(max(schema_version) filter (where status='applied'),0)=202
      then 'Live database exactly matches the repo schema marker.'
    when coalesce(max(schema_version) filter (where status='applied'),0)>202
      then 'Live database is ahead of the repo schema marker; release/staging mutation must remain fail-closed.'
    else 'Live database is behind the repo schema marker.'
  end::text as message,
  now() as checked_at
from public.app_schema_versions;

revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
