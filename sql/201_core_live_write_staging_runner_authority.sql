begin;

-- Schema 201 — core live-write staging runner authority.
-- Automates only disposable quote/contact staging evidence on a dedicated non-production
-- project. Operations Cockpit write-form evidence remains human-controlled. This migration
-- does not execute a staging run, close a business rail, mutate Auth, enable Finance/provider
-- execution, touch Production business data, or promote Production.

update public.operations_staging_acceptance_scenarios
set
  evidence_kind = case case_key
    when 'quote_invalid_payload_rejected' then 'runtime'
    when 'quote_submission_creates_request' then 'runtime'
    when 'quote_created_event_recorded' then 'automated'
    when 'quote_fixture_cleanup' then 'automated'
    else evidence_kind
  end,
  verification_mode = 'runner',
  metadata = metadata || jsonb_build_object(
    'automation_owner','current_schema_staging_runner',
    'automated_by_schema',201,
    'dedicated_non_production_only',true,
    'production_mutation_allowed',false
  ),
  updated_at = now()
where rail_key='quote_intake_live'
  and case_key in (
    'quote_invalid_payload_rejected',
    'quote_submission_creates_request',
    'quote_created_event_recorded',
    'quote_fixture_cleanup'
  );

insert into public.operations_staging_acceptance_scenarios(
  rail_key,case_key,case_title,case_description,evidence_kind,verification_mode,
  is_blocking,expected_outcome,prerequisites,sort_order,is_enabled,introduced_by_schema,metadata
) values (
  'quote_intake_live',
  'quote_human_acceptance_review',
  'Human review of quote staging evidence',
  'Review the runner-captured invalid rejection, uniquely labelled STAGING request, matching created event, and cleanup proof before finalization/signoff.',
  'manual','human',true,
  'A human confirms the runner evidence belongs only to the dedicated staging project, no real customer/provider was contacted, cleanup is proven, and the run is suitable for explicit finalization/signoff.',
  '[{"kind":"case","key":"quote_invalid_payload_rejected"},{"kind":"case","key":"quote_submission_creates_request"},{"kind":"case","key":"quote_created_event_recorded"},{"kind":"case","key":"quote_fixture_cleanup"}]'::jsonb,
  80,true,201,
  jsonb_build_object('review_scope','runner_evidence_only','human_signoff_required',true,'business_rail_auto_close',false)
)
on conflict(rail_key,case_key) do update set
  case_title=excluded.case_title,
  case_description=excluded.case_description,
  evidence_kind=excluded.evidence_kind,
  verification_mode=excluded.verification_mode,
  is_blocking=excluded.is_blocking,
  expected_outcome=excluded.expected_outcome,
  prerequisites=excluded.prerequisites,
  sort_order=excluded.sort_order,
  is_enabled=excluded.is_enabled,
  introduced_by_schema=excluded.introduced_by_schema,
  metadata=excluded.metadata,
  updated_at=now();

update public.it_open_rail_acceptance_runbook
set
  current_action='Use a dedicated non-production YardWeasels project at the exact current repository schema. Run quote_intake_live through the current-schema staging runner: it records invalid-payload rejection, one uniquely labelled STAGING request, its matching created event, and verified cleanup. Then complete the blocking human evidence review, finalize, and explicitly sign off. Production is never valid staging evidence.',
  metadata=metadata || jsonb_build_object(
    'quote_runner_automation_schema',201,
    'runner_owned_cases',jsonb_build_array(
      'quote_invalid_payload_rejected','quote_submission_creates_request',
      'quote_created_event_recorded','quote_fixture_cleanup'
    ),
    'human_review_case','quote_human_acceptance_review',
    'production_mutation_allowed',false
  ),
  updated_at=now()
where rail_key='quote_intake_live';

create or replace function public.ywi_core_live_write_staging_runner_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql
security definer
set search_path=public,pg_temp
as $$
  select 'quote_runner_exact_four_cases',
    case when (
      select count(*) from public.operations_staging_acceptance_scenarios
      where rail_key='quote_intake_live'
        and is_enabled
        and verification_mode='runner'
        and case_key in (
          'quote_invalid_payload_rejected','quote_submission_creates_request',
          'quote_created_event_recorded','quote_fixture_cleanup'
        )
    )=4 then 'passed' else 'failed' end,
    'The four disposable quote/contact runtime cases are runner-owned.'
  union all select 'quote_human_review_preserved',
    case when exists(
      select 1 from public.operations_staging_acceptance_scenarios
      where rail_key='quote_intake_live'
        and case_key='quote_human_acceptance_review'
        and is_enabled and verification_mode='human' and is_blocking
    ) then 'passed' else 'failed' end,
    'Quote/contact acceptance still has a blocking human review before finalization/signoff.'
  union all select 'operations_write_remains_human',
    case when exists(
      select 1 from public.operations_staging_acceptance_scenarios
      where rail_key='operations_cockpit_live'
        and case_key='operations_cockpit_write_form_roundtrip'
        and verification_mode='human' and is_blocking and is_enabled
    ) then 'passed' else 'failed' end,
    'Operations Cockpit write-form round-trip remains human-controlled.'
  union all select 'quote_business_rail_still_open',
    case when exists(
      select 1
      from public.admin_scorecard_progress_rails r
      join public.it_scorecard_rail_resolution_contracts c using(rail_key)
      where r.rail_key='quote_intake_live'
        and r.rail_status<>'complete'
        and c.requires_human=true
        and c.auto_close_allowed=false
    ) then 'passed' else 'failed' end,
    'Runner automation does not close or weaken the human-gated quote intake business rail.'
  union all select 'open_business_acceptance_unchanged',
    case when (select count(*) from public.v_it_open_rail_acceptance_readiness where rail_status<>'complete')=11
      then 'passed' else 'failed' end,
    'All 11 human/provider/accounting/content/staging acceptance rails remain open.'
  union all select 'finance_provider_execution_off',
    case when not exists(
      select 1 from public.finance_job_completion_posting_execution_controls
      where execution_enabled=true or provider_mutation_enabled=true
    ) then 'passed' else 'failed' end,
    'Finance posting execution and payment-provider mutation remain OFF.'
  union all select 'scenario_catalog_service_private',
    case when not has_table_privilege('anon','public.operations_staging_acceptance_scenarios','select')
      and not has_table_privilege('authenticated','public.operations_staging_acceptance_scenarios','select')
      and has_table_privilege('service_role','public.operations_staging_acceptance_scenarios','select')
    then 'passed' else 'failed' end,
    'Staging scenario authority remains service-role-only.';
$$;

revoke all on function public.ywi_core_live_write_staging_runner_assertions() from public,anon,authenticated;
grant execute on function public.ywi_core_live_write_staging_runner_assertions() to service_role;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values (
  'core_live_write_staging_runner','I.T.','Core live-write staging runner authority','warning',
  'Use only the dedicated non-production staging project at exact current-schema parity. Quote runner cases use uniquely labelled disposable data and retain blocking human review/signoff; Production is denied.',
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

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values (
  'schema201_core_live_write_staging_runner_authority','admin','Core live-write staging runner authority',
  'active',80,8,10,
  'Verify Schema 201 assertions, runner source gates, exact non-production refusal, quote runtime evidence/cleanup contract, existing phone/PC/web regressions, and release proof. Do not execute against Production or auto-close quote/Operations acceptance.',
  'Admin / I.T.',121,
  jsonb_build_object(
    'schema',201,'staging_runner_source_only',true,'production_mutation',false,
    'business_rail_auto_close',false,'auth_setting_mutation',false,
    'finance_mutation',false,'payment_provider_mutation',false,'production_promotion',false
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
  'schema201_core_live_write_staging_runner_authority','build_acceptance',false,false,false,
  'Close only after schema/source/browser/release proof. Actual staging execution and the quote/Operations human business rails remain independently gated.',201
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
  201,'201_core_live_write_staging_runner_authority',
  'Moves disposable quote/contact staging cases to the guarded current-schema runner while preserving a blocking human review and keeping Operations write evidence human-controlled.',
  'applied',now(),'schema201',
  'No Production business mutation, staging execution, Auth mutation, Finance/provider enablement, or human/external rail closure.',
  '201_core_live_write_staging_runner_authority.sql','schema201'
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
  201 as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status='applied'),0)=201 then 'current'
    when coalesce(max(schema_version) filter (where status='applied'),0)>201 then 'ahead'
    else 'drift'
  end::text as drift_status,
  case
    when coalesce(max(schema_version) filter (where status='applied'),0)=201
      then 'Live database exactly matches the repo schema marker.'
    when coalesce(max(schema_version) filter (where status='applied'),0)>201
      then 'Live database is ahead of the repo schema marker; release/staging mutation must remain fail-closed.'
    else 'Live database is behind the repo schema marker.'
  end::text as message,
  now() as checked_at
from public.app_schema_versions;

revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
