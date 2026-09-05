begin;

-- Schema 204 — Auth evidence direct-write lock.
--
-- Schema 203 introduces the validated service-private recording RPC. This follow-on safety lock removes
-- the remaining service-role raw INSERT/UPDATE path so authoritative evidence cannot bypass the RPC's
-- project, freshness, traceability and control-specific validation. The service role retains read access
-- and execute access to ywi_record_auth_security_evidence().
--
-- No external Auth evidence is created here. No Supabase Auth setting, staging evidence, business rail,
-- Finance/provider control, or Production promotion is changed by this migration.

revoke insert,update on table public.it_auth_security_evidence from service_role;
grant select on table public.it_auth_security_evidence to service_role;

create or replace function public.ywi_auth_security_recording_access_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql
security definer
set search_path=public,pg_temp
as $$
  select 'direct_service_table_write_blocked',
    case when not has_table_privilege('service_role','public.it_auth_security_evidence','insert')
      and not has_table_privilege('service_role','public.it_auth_security_evidence','update')
      and has_table_privilege('service_role','public.it_auth_security_evidence','select')
    then 'passed' else 'failed' end,
    'Service role may read Auth evidence but cannot directly insert/update the table; writes must use the validated recording RPC.'
  union all select 'authorized_recording_rpc_service_only',
    case when not exists(
      select 1 from information_schema.routine_privileges
      where routine_schema='public'
        and routine_name='ywi_record_auth_security_evidence'
        and grantee in ('anon','authenticated','PUBLIC')
        and privilege_type='EXECUTE'
    ) and exists(
      select 1 from information_schema.routine_privileges
      where routine_schema='public'
        and routine_name='ywi_record_auth_security_evidence'
        and grantee='service_role'
        and privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
    'The validated Auth evidence recorder remains executable only by the service role.'
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

revoke all on function public.ywi_auth_security_recording_access_assertions() from public,anon,authenticated;
grant execute on function public.ywi_auth_security_recording_access_assertions() to service_role;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values (
  'auth_evidence_direct_write_lock','Security','Auth evidence direct table writes are locked','error',
  'Keep direct service-role INSERT/UPDATE revoked on Auth evidence. Record only through ywi_record_auth_security_evidence after genuine official-source confirmation.',
  'Admin > I.T. Readiness',41,true
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
  'schema204_auth_evidence_direct_write_lock','security','Auth evidence direct-write lock',
  'active',80,8,10,
  'Verify service-role direct table writes are revoked, validated recording RPC remains service-only, source gates pass, and external Auth evidence follow-ups remain evidence-driven.',
  'Admin / I.T.',124,
  jsonb_build_object(
    'schema',204,'direct_service_table_insert',false,'direct_service_table_update',false,
    'authorized_recording_rpc',true,'auth_setting_mutation',false,'external_evidence_fabrication',false,
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
  'schema204_auth_evidence_direct_write_lock','build_acceptance',false,false,false,
  'Close only after schema/source/release proof. External leaked-password and MFA follow-ups remain open until genuine current official evidence is deliberately recorded.',204
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
  204,'204_auth_evidence_direct_write_lock',
  'Revokes direct service-role Auth evidence table writes so all authoritative recording is forced through the validated service-private RPC.',
  'applied',now(),'schema204',
  'No evidence fabrication, Auth setting mutation, staging execution, business-rail closure, Finance/provider enablement, or Production promotion.',
  '204_auth_evidence_direct_write_lock.sql','schema204'
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
  204 as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status='applied'),0)=204 then 'current'
    when coalesce(max(schema_version) filter (where status='applied'),0)>204 then 'ahead'
    else 'drift'
  end::text as drift_status,
  case
    when coalesce(max(schema_version) filter (where status='applied'),0)=204
      then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter (where status='applied'),0)>204
      then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end::text as message,
  now() as checked_at
from public.app_schema_versions;

commit;
