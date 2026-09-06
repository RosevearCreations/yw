begin;

-- Schema 207 — interactive I.T. readiness load convergence.
-- Release/security assertions remain available for explicit CI/operator verification, but
-- ordinary browser readiness must not execute the full Finance release assertion graph on
-- every read. This migration creates a cheap runtime Finance status and rewires the existing
-- open-rail readiness view without changing its public column order or business acceptance.

create or replace view public.v_it_finance_runtime_readiness_status
with (security_invoker=true)
as
with release_proof as (
  select rail_status,progress_percent,current_value,target_value
  from public.admin_scorecard_progress_rails
  where rail_key='schema179_finance_permissions_acceptance_release_hardening'
  limit 1
), controls as (
  select coalesce(bool_or(execution_enabled),false) as execution_release_enabled,
         coalesce(bool_or(provider_mutation_enabled),false) as provider_mutation_enabled
  from public.finance_job_completion_posting_execution_controls
  where control_key='finance_job_completion_v1'
), reconciliation as (
  select count(*)::int as reconciliation_issue_count,
         count(*) filter(where severity='critical')::int as critical_reconciliation_issue_count
  from public.v_finance_job_completion_reconciliation_issues
), authority as (
  select release_authority_status
  from public.v_it_release_authority_status
  limit 1
)
select
  1::int as assertion_count,
  case when coalesce(r.rail_status,'')='complete' and coalesce(r.progress_percent,0)>=100 then 1 else 0 end::int as passed_count,
  case when coalesce(r.rail_status,'')='complete' and coalesce(r.progress_percent,0)>=100 then 0 else 1 end::int as failed_count,
  c.execution_release_enabled,
  c.provider_mutation_enabled,
  x.reconciliation_issue_count,
  x.critical_reconciliation_issue_count,
  coalesce(a.release_authority_status,'unknown')::text as release_authority_status,
  case
    when c.provider_mutation_enabled or x.critical_reconciliation_issue_count>0 then 'red'
    when coalesce(r.rail_status,'')<>'complete' or coalesce(r.progress_percent,0)<100 then 'amber'
    when coalesce(a.release_authority_status,'unknown')<>'green' then 'amber'
    else 'green'
  end::text as hardening_status,
  'persisted_release_proof_plus_live_controls'::text as verification_mode,
  now() as checked_at
from controls c
cross join reconciliation x
left join release_proof r on true
left join authority a on true;

revoke all on table public.v_it_finance_runtime_readiness_status from public,anon,authenticated;
grant select on table public.v_it_finance_runtime_readiness_status to service_role;

-- Preserve the exact Schema 188 output-column order. Only the Finance runtime source changes.
create or replace view public.v_it_open_rail_acceptance_readiness
with (security_invoker=true)
as
with
schema_state as (
  select expected_schema_version,latest_applied_schema_version,drift_status
  from public.v_schema_drift_status
  limit 1
),
staging_assertions as (
  select count(*) filter(where assertion_status<>'passed')::int as failed_count
  from (
    select * from public.ywi_staging_acceptance_security_assertions()
    union all
    select * from public.ywi_staging_acceptance_catalog_assertions()
  ) a
),
staging_plan as (
  select rail_key,
    count(*)::int as case_count,
    count(*) filter(where evidence_status='pending_evidence')::int as pending_case_count,
    count(*) filter(where verification_mode='human')::int as human_case_count,
    count(*) filter(where human_action_required)::int as current_human_action_count
  from public.v_it_staging_acceptance_scenario_plan
  group by rail_key
),
finance_state as (
  select assertion_count,passed_count,failed_count,execution_release_enabled,provider_mutation_enabled,
    reconciliation_issue_count,critical_reconciliation_issue_count,release_authority_status,hardening_status
  from public.v_it_finance_runtime_readiness_status
  limit 1
),
stripe_state as (
  select received_24h,processed_24h,failed_24h,last_processed_at,last_received_at,last_validation_status,latest_event_at
  from public.v_stripe_webhook_health
  limit 1
),
route_state as (
  select count(*)::int as total_count,
    count(*) filter(where publication_ready)::int as ready_count,
    count(*) filter(where published_at is not null)::int as published_count
  from public.v_public_route_publication_readiness
),
payment_state as (
  select count(*)::int as action_count,
    count(*) filter(where coalesce(action_status,'') not in ('posted','rejected','cancelled','complete','completed'))::int as pending_action_count
  from public.v_payment_action_workbench
),
bank_state as (
  select count(*)::int as preview_count,
    count(*) filter(where promoted_at is not null)::int as promoted_count
  from public.v_bank_csv_import_workbench
)
select
  t.rail_key,t.rail_area,t.rail_title,t.rail_status,t.progress_percent,t.current_value,t.target_value,t.sort_order,
  t.resolution_class,t.requires_human,t.requires_external,t.auto_close_allowed,t.resolution_note,
  t.next_action_hint as historical_next_action_hint,
  r.guidance_title,r.current_action,r.evidence_requirement,r.metadata as runbook_metadata,
  case
    when t.resolution_class='staging_acceptance' and (select drift_status from schema_state)='current'
      and coalesce(sp.case_count,0)>0 and (select failed_count from staging_assertions)=0 then 'ready'
    when t.resolution_class='staging_acceptance' then 'blocked'
    when t.resolution_class='accounting_acceptance'
      and coalesce((select hardening_status from finance_state),'')='green'
      and coalesce((select failed_count from finance_state),1)=0
      and coalesce((select execution_release_enabled from finance_state),false)=false
      and coalesce((select provider_mutation_enabled from finance_state),false)=false
      and coalesce((select critical_reconciliation_issue_count from finance_state),0)=0 then 'ready'
    when t.resolution_class='accounting_acceptance' then 'blocked'
    when t.resolution_class='provider_acceptance' and coalesce((select failed_24h from stripe_state),0)>0 then 'blocked'
    when t.resolution_class='provider_acceptance' then 'pending'
    when t.resolution_class='content_approval' then 'pending'
    else 'pending'
  end::text as technical_readiness_status,
  case
    when t.resolution_class='staging_acceptance' and (select drift_status from schema_state)='current'
      and coalesce(sp.case_count,0)>0 and (select failed_count from staging_assertions)=0 then 'ready_for_dedicated_staging_evidence'
    when t.resolution_class='staging_acceptance' then 'staging_control_plane_blocked'
    when t.resolution_class='accounting_acceptance'
      and coalesce((select hardening_status from finance_state),'')='green'
      and coalesce((select failed_count from finance_state),1)=0
      and coalesce((select execution_release_enabled from finance_state),false)=false
      and coalesce((select provider_mutation_enabled from finance_state),false)=false
      and coalesce((select critical_reconciliation_issue_count from finance_state),0)=0 then 'ready_for_human_accounting_acceptance'
    when t.resolution_class='accounting_acceptance' then 'accounting_control_plane_blocked'
    when t.resolution_class='provider_acceptance' and coalesce((select failed_24h from stripe_state),0)>0 then 'stripe_health_blocked'
    when t.resolution_class='provider_acceptance' and (select latest_event_at from stripe_state) is null then 'waiting_for_stripe_test_evidence'
    when t.resolution_class='provider_acceptance' then 'ready_for_provider_acceptance_review'
    when t.resolution_class='content_approval' and (select total_count from route_state)=0 then 'waiting_for_human_route_asset_approval'
    when t.resolution_class='content_approval' and (select ready_count from route_state)>0 then 'ready_for_content_publication_acceptance'
    else 'waiting_for_human_content_approval'
  end::text as technical_readiness_code,
  case
    when t.resolution_class='staging_acceptance' then format('Schema %s/%s %s; catalog cases %s; pending cases %s; current human actions %s; staging assertion failures %s.',
      coalesce((select latest_applied_schema_version from schema_state),0),coalesce((select expected_schema_version from schema_state),0),
      coalesce((select drift_status from schema_state),'unknown'),coalesce(sp.case_count,0),coalesce(sp.pending_case_count,0),coalesce(sp.current_human_action_count,0),
      coalesce((select failed_count from staging_assertions),0))
    when t.resolution_class='accounting_acceptance' then format('Finance persisted release proof %s; runtime proof %s/%s; execution release %s; provider mutation %s; reconciliation issues %s (%s critical).',
      coalesce((select hardening_status from finance_state),'unknown'),coalesce((select passed_count from finance_state),0),coalesce((select assertion_count from finance_state),0),
      coalesce((select execution_release_enabled from finance_state),false),coalesce((select provider_mutation_enabled from finance_state),false),
      coalesce((select reconciliation_issue_count from finance_state),0),coalesce((select critical_reconciliation_issue_count from finance_state),0))
    when t.resolution_class='provider_acceptance' then format('Stripe webhook evidence in last 24h: received %s, processed %s, failed %s; latest event %s.',
      coalesce((select received_24h from stripe_state),0),coalesce((select processed_24h from stripe_state),0),coalesce((select failed_24h from stripe_state),0),
      coalesce((select latest_event_at::text from stripe_state),'none'))
    when t.resolution_class='content_approval' then format('Route publication readiness: %s candidate(s), %s ready, %s published.',
      coalesce((select total_count from route_state),0),coalesce((select ready_count from route_state),0),coalesce((select published_count from route_state),0))
    else 'No technical readiness adapter is configured for this resolution class.'
  end::text as technical_readiness_detail,
  true as human_action_required,
  t.requires_external as external_action_required,
  coalesce(sp.case_count,0)::int as staging_case_count,
  coalesce(sp.pending_case_count,0)::int as staging_pending_case_count,
  coalesce(sp.human_case_count,0)::int as staging_human_case_count,
  coalesce((select hardening_status from finance_state),'unknown')::text as finance_hardening_status,
  coalesce((select execution_release_enabled from finance_state),false) as finance_execution_release_enabled,
  coalesce((select provider_mutation_enabled from finance_state),false) as provider_mutation_enabled,
  coalesce((select reconciliation_issue_count from finance_state),0)::int as reconciliation_issue_count,
  coalesce((select received_24h from stripe_state),0)::int as stripe_received_24h,
  coalesce((select processed_24h from stripe_state),0)::int as stripe_processed_24h,
  coalesce((select failed_24h from stripe_state),0)::int as stripe_failed_24h,
  (select latest_event_at from stripe_state) as stripe_latest_event_at,
  coalesce((select total_count from route_state),0)::int as route_candidate_count,
  coalesce((select ready_count from route_state),0)::int as route_ready_count,
  coalesce((select published_count from route_state),0)::int as route_published_count,
  coalesce((select action_count from payment_state),0)::int as payment_action_count,
  coalesce((select pending_action_count from payment_state),0)::int as payment_pending_action_count,
  coalesce((select preview_count from bank_state),0)::int as bank_preview_count,
  coalesce((select promoted_count from bank_state),0)::int as bank_promoted_count,
  case
    when t.rail_key='quote_intake_live' and lower(coalesce(t.next_action_hint,'')) like '%deploy quote-contact-submit%' then true
    when t.rail_key='live_job_updates' and lower(coalesce(t.next_action_hint,'')) like '%deploy schema 155%' then true
    else false
  end as historical_hint_stale,
  now() as checked_at
from public.v_it_scorecard_progress_truth t
join public.it_open_rail_acceptance_runbook r on r.rail_key=t.rail_key
left join staging_plan sp on sp.rail_key=t.rail_key
where t.rail_status<>'complete'
  and t.resolution_class in ('staging_acceptance','accounting_acceptance','provider_acceptance','content_approval');

revoke all on table public.v_it_open_rail_acceptance_readiness from public,anon,authenticated;
grant select on table public.v_it_open_rail_acceptance_readiness to service_role;

create or replace function public.ywi_runtime_readiness_load_convergence_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql
security definer
set search_path=public,pg_catalog
as $$
  select 'runtime_finance_read_is_lightweight',
    case when lower(pg_get_viewdef('public.v_it_finance_runtime_readiness_status'::regclass,true)) not like '%ywi_finance_release_hardening_assertions%'
      then 'passed' else 'failed' end,
    'Interactive Finance readiness must use persisted release proof and live controls, not execute the full release assertion graph.'
  union all
  select 'open_rail_uses_runtime_finance_authority',
    case when lower(pg_get_viewdef('public.v_it_open_rail_acceptance_readiness'::regclass,true)) like '%v_it_finance_runtime_readiness_status%'
      and lower(pg_get_viewdef('public.v_it_open_rail_acceptance_readiness'::regclass,true)) not like '%v_it_finance_release_hardening_status%'
      then 'passed' else 'failed' end,
    'Open-rail interactive readiness must read the lightweight Finance runtime authority.'
  union all
  select 'open_business_acceptance_unchanged',
    case when (select count(*) from public.v_it_open_rail_acceptance_readiness where rail_status<>'complete')=11 then 'passed' else 'failed' end,
    'All eleven human/provider/accounting/content/staging acceptance rails remain open.'
  union all
  select 'finance_provider_execution_off',
    case when not exists(
      select 1 from public.finance_job_completion_posting_execution_controls
      where execution_enabled=true or provider_mutation_enabled=true
    ) then 'passed' else 'failed' end,
    'Finance posting execution and provider mutation remain OFF.'
  union all
  select 'runtime_readiness_service_private',
    case when not has_table_privilege('anon','public.v_it_finance_runtime_readiness_status','select')
      and not has_table_privilege('authenticated','public.v_it_finance_runtime_readiness_status','select')
      and has_table_privilege('service_role','public.v_it_finance_runtime_readiness_status','select')
      then 'passed' else 'failed' end,
    'The lightweight Finance runtime authority remains service-role-only.';
$$;
revoke all on function public.ywi_runtime_readiness_load_convergence_assertions() from public,anon,authenticated;
grant execute on function public.ywi_runtime_readiness_load_convergence_assertions() to service_role;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values (
  'runtime_readiness_load_convergence','I.T.','Interactive readiness load convergence','critical',
  'Keep interactive I.T. readiness on lightweight persisted/live-control views. Run deep release assertions only through explicit verification, never during ordinary screen reads.',
  'Admin > I.T. Readiness',37,true
)
on conflict(check_key) do update set
  check_group=excluded.check_group,check_title=excluded.check_title,severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,route_hint=excluded.route_hint,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,updated_at=now();

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  207,'207_runtime_readiness_load_convergence',
  'Separates interactive I.T. readiness from expensive release assertion execution while preserving all business, Finance and provider safety gates.',
  'applied',now(),'schema207',
  'No business acceptance closure, Auth mutation, Finance/provider mutation, staging mutation, or evidence fabrication.',
  '207_runtime_readiness_load_convergence.sql','schema207'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status=excluded.status,
  applied_at=excluded.applied_at,applied_by=excluded.applied_by,notes=excluded.notes,
  migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status as
select 207 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=207 then 'current'
    when coalesce(max(schema_version) filter(where status='applied'),0)>207 then 'ahead'
    else 'drift'
  end::text as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=207 then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter(where status='applied'),0)>207 then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end::text as message,
  now() as checked_at
from public.app_schema_versions;

revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
