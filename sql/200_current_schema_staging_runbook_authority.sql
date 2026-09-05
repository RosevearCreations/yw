begin;

-- Schema 200 — current-schema staging runbook authority.
-- Schema 187 remains the historical staging scenario catalog authority, but every new
-- acceptance execution must run against the exact current repository schema. This
-- migration changes guidance/safety authority only; it does not execute staging work,
-- close business rails, mutate Auth, enable Finance/provider execution, or promote Production.

update public.it_open_rail_acceptance_runbook
set current_action=case rail_key
  when 'operations_cockpit_live' then
    'Use a dedicated non-production YardWeasels project. Verify the staging database exactly matches the current repository schema, then start the current-schema Operations Cockpit acceptance run using the historical Schema 187 scenario catalog. Complete runner-owned checks, record the staging-only Cockpit write-form human case, finalize, and explicitly sign off.'
  when 'quote_intake_live' then
    'Use a dedicated non-production YardWeasels project whose database exactly matches the current repository schema. Run the current-schema quote/contact staging acceptance using the historical Schema 187 scenario catalog, including invalid-payload, valid labelled STAGING request, event-history, and fixture-cleanup cases. Do not redeploy Production or reapply an old schema.'
  when 'live_job_updates' then
    'Use a dedicated non-production YardWeasels project whose database exactly matches the current repository schema. Run the current-schema live job-update staging acceptance using a labelled work order and portal token; verify staff-only visibility, customer-visible updates, approved public media, retraction, finalization, and explicit signoff. Historical Schema 155 work must not be reapplied.'
  when 'customer_live_update_notifications' then
    'Use a dedicated non-production YardWeasels project whose database exactly matches the current repository schema. Run the current-schema notification acceptance: record explicit portal opt-in, publish one customer-visible update, use the protected dispatcher with a test-safe destination, inspect delivery, opt out, verify suppression, finalize, and explicitly sign off.'
  when 'service_execution_proof_costing' then
    'Use a dedicated non-production YardWeasels project whose database exactly matches the current repository schema. Run the current-schema execution-proof/costing acceptance with representative arrival/completion proof and labour/material/equipment values, supervisor approval, customer-safe portal comparison, internal Cockpit cost variance review, finalization, and explicit signoff.'
  when 'supervisor_closeout_signoff_invoice_followup' then
    'Use a dedicated non-production YardWeasels project whose database exactly matches the current repository schema. Run the current-schema closeout/signoff acceptance from approved execution proof through supervisor approval, customer portal signoff, invoice readiness, review-request state, maintenance follow-up, finalization, and explicit signoff while internal costs remain private.'
  else current_action
end,
metadata=metadata || jsonb_build_object(
  'required_schema_mode','exact_current',
  'runner_schema_mode','current_repository',
  'historical_catalog_schema',187,
  'guidance_updated_by_schema',200
),
updated_at=now()
where rail_key in (
  'operations_cockpit_live','quote_intake_live','live_job_updates',
  'customer_live_update_notifications','service_execution_proof_costing',
  'supervisor_closeout_signoff_invoice_followup'
);

create or replace view public.v_it_next_safe_action_queue
with (security_invoker=true)
as
select
  t.todo_key,
  t.todo_area,
  t.todo_title,
  t.todo_status,
  t.current_action,
  t.evidence_requirement,
  t.requires_human,
  t.requires_external,
  t.source_kind,
  t.source_schema_version,
  case
    when t.source_kind='staging_acceptance' and t.todo_status='ready' then 10
    when t.source_kind in ('security_followup','repository_followup') then 20
    when t.source_kind in ('content_approval','provider_acceptance') then 30
    when t.source_kind='accounting_acceptance' or t.todo_status='blocked' then 40
    else 50
  end::int as priority_bucket,
  case
    when t.source_kind='staging_acceptance' and t.todo_status='ready' then 'staging_ready_candidate'
    when t.source_kind in ('security_followup','repository_followup') then 'external_verification'
    when t.source_kind='content_approval' then 'human_content_approval'
    when t.source_kind='provider_acceptance' then 'provider_acceptance'
    when t.source_kind='accounting_acceptance' or t.todo_status='blocked' then 'blocked_accounting_acceptance'
    else 'review_required'
  end::text as action_class,
  (t.source_kind='staging_acceptance' and t.todo_status='ready')::boolean as safe_candidate_after_environment_guard,
  case
    when t.source_kind='staging_acceptance' and t.todo_status='ready'
      then 'Candidate only. Before any mutation, re-verify both the dedicated non-production staging environment guard and exact current-schema parity. Use labelled disposable/test data. Human signoff remains required.'
    when t.source_kind in ('security_followup','repository_followup')
      then 'External control-plane evidence is required. Do not infer completion from application source or CI.'
    when t.source_kind='content_approval'
      then 'Human route/visual approval is required before public publishing or sitemap expansion.'
    when t.source_kind='provider_acceptance'
      then 'Use provider test mode only; Production provider mutation remains prohibited.'
    when t.source_kind='accounting_acceptance' or t.todo_status='blocked'
      then 'Keep Finance posting execution and provider mutation OFF; complete controlled accounting acceptance first.'
    else 'Review the current authority before taking action.'
  end::text as safety_note,
  t.sort_order,
  t.checked_at,
  (
    t.source_kind='staging_acceptance' and t.todo_status='ready'
    and exists(
      select 1 from public.v_schema_drift_status s
      where s.drift_status='current'
        and s.expected_schema_version=s.latest_applied_schema_version
    )
  )::boolean as safe_candidate_after_environment_and_schema_guard
from public.v_it_current_admin_todo t;

revoke all on table public.v_it_next_safe_action_queue from public,anon,authenticated;
grant select on table public.v_it_next_safe_action_queue to service_role;

create or replace view public.v_it_next_safe_action_status
with (security_invoker=true)
as
with q as (
  select * from public.v_it_next_safe_action_queue
), next_row as (
  select * from q order by priority_bucket,sort_order,todo_key limit 1
)
select
  (select count(*) from q)::int as current_action_count,
  (select count(*) from q where action_class='staging_ready_candidate')::int as staging_ready_candidate_count,
  (select count(*) from q where action_class='external_verification')::int as external_verification_count,
  (select count(*) from q where action_class in ('human_content_approval','provider_acceptance'))::int as pending_human_or_provider_count,
  (select count(*) from q where action_class='blocked_accounting_acceptance')::int as blocked_accounting_count,
  n.todo_key::text as next_todo_key,
  n.todo_title::text as next_todo_title,
  n.action_class::text as next_action_class,
  n.safe_candidate_after_environment_guard,
  n.current_action::text as next_action,
  n.safety_note::text as next_safety_note,
  case when n.todo_key is null then 'green' else 'amber' end::text as next_action_status,
  now() as checked_at,
  n.safe_candidate_after_environment_and_schema_guard
from next_row n
right join (select 1 as singleton) s on true;

revoke all on table public.v_it_next_safe_action_status from public,anon,authenticated;
grant select on table public.v_it_next_safe_action_status to service_role;

create or replace function public.ywi_next_safe_action_authority_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql
security definer
set search_path=public,pg_temp
as $$
  select 'current_todo_parity',
    case when (select count(*) from public.v_it_next_safe_action_queue)=(select count(*) from public.v_it_current_admin_todo) then 'passed' else 'failed' end,
    'Every current Admin To-Do item is represented exactly once in the next-safe-action queue.'
  union all select 'ready_staging_only_safe_candidates',
    case when not exists(
      select 1 from public.v_it_next_safe_action_queue
      where safe_candidate_after_environment_guard
        and not (source_kind='staging_acceptance' and todo_status='ready')
    ) then 'passed' else 'failed' end,
    'Only technically ready staging-acceptance items can be marked as staging candidates.'
  union all select 'exact_schema_required_for_staging_candidate',
    case when not exists(
      select 1 from public.v_it_next_safe_action_queue q
      where q.safe_candidate_after_environment_and_schema_guard
        and not exists(
          select 1 from public.v_schema_drift_status s
          where s.drift_status='current' and s.expected_schema_version=s.latest_applied_schema_version
        )
    ) then 'passed' else 'failed' end,
    'A staging candidate is not mutation-ready unless current-schema authority is exact.'
  union all select 'current_schema_runbook_language',
    case when (
      select count(*) from public.it_open_rail_acceptance_runbook r
      where r.rail_key in (
        'operations_cockpit_live','quote_intake_live','live_job_updates',
        'customer_live_update_notifications','service_execution_proof_costing',
        'supervisor_closeout_signoff_invoice_followup'
      )
        and r.metadata->>'required_schema_mode'='exact_current'
        and r.metadata->>'runner_schema_mode'='current_repository'
        and coalesce(r.current_action,'') not ilike '%Schema 187+%'
    )=6 then 'passed' else 'failed' end,
    'All six staging runbooks require exact current-schema execution and no longer present Schema 187+ as the runtime identity.'
  union all select 'historical_catalog_preserved',
    case when (select count(distinct rail_key) from public.operations_staging_acceptance_scenarios where is_enabled)=6 then 'passed' else 'failed' end,
    'The historical Schema 187 six-rail scenario catalog remains intact.'
  union all select 'blocked_accounting_not_safe',
    case when not exists(
      select 1 from public.v_it_next_safe_action_queue
      where (source_kind='accounting_acceptance' or todo_status='blocked')
        and safe_candidate_after_environment_guard
    ) then 'passed' else 'failed' end,
    'Blocked/accounting acceptance items are never presented as safe execution candidates.'
  union all select 'external_followups_not_auto_safe',
    case when not exists(
      select 1 from public.v_it_next_safe_action_queue
      where source_kind in ('security_followup','repository_followup')
        and safe_candidate_after_environment_guard
    ) then 'passed' else 'failed' end,
    'Auth and GitHub enforcement follow-ups require external evidence and are never inferred safe from source state.'
  union all select 'open_business_acceptance_unchanged',
    case when (select count(*) from public.v_it_open_rail_acceptance_readiness where rail_status<>'complete')=11 then 'passed' else 'failed' end,
    'All 11 human/provider/accounting/content/staging acceptance rails remain open.'
  union all select 'finance_provider_execution_off',
    case when not exists(
      select 1 from public.finance_job_completion_posting_execution_controls
      where execution_enabled=true or provider_mutation_enabled=true
    ) then 'passed' else 'failed' end,
    'Finance posting execution and payment-provider mutation remain OFF.'
  union all select 'service_private_authority',
    case when not has_table_privilege('anon','public.v_it_next_safe_action_queue','select')
      and not has_table_privilege('authenticated','public.v_it_next_safe_action_queue','select')
      and has_table_privilege('service_role','public.v_it_next_safe_action_queue','select')
      and not has_table_privilege('anon','public.v_it_next_safe_action_status','select')
      and not has_table_privilege('authenticated','public.v_it_next_safe_action_status','select')
      and has_table_privilege('service_role','public.v_it_next_safe_action_status','select')
    then 'passed' else 'failed' end,
    'The next-safe-action authority remains service-role-only.';
$$;

revoke all on function public.ywi_next_safe_action_authority_assertions() from public,anon,authenticated;
grant execute on function public.ywi_next_safe_action_authority_assertions() to service_role;

insert into public.it_readiness_check_registry(check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled)
values(
  'current_schema_staging_runbook','I.T.','Current-schema staging runbook authority','warning',
  'Before staging mutation, require both the dedicated non-production environment guard and exact expected/live schema equality. Schema 187 remains catalog history, not the current execution identity.',
  'Admin > I.T. Readiness',37,true
)
on conflict(check_key) do update set
  check_group=excluded.check_group,check_title=excluded.check_title,severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,route_hint=excluded.route_hint,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,updated_at=now();

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,next_action_hint,owner_hint,sort_order,metadata
) values(
  'schema200_current_schema_staging_runbook_authority','admin','Current-schema staging runbook authority','active',80,8,10,
  'Verify Schema 200 assertions, exact current-schema runbook guidance, source/browser gates, release evidence, and cleanup. Do not execute staging or auto-close human/external rails.',
  'Admin / I.T.',120,jsonb_build_object(
    'schema',200,'staging_mutation',false,'business_rail_auto_close',false,'auth_setting_mutation',false,
    'finance_mutation',false,'payment_provider_mutation',false,'production_promotion',false
  )
)
on conflict(rail_key) do update set
  rail_area=excluded.rail_area,rail_title=excluded.rail_title,rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,current_value=excluded.current_value,target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint,owner_hint=excluded.owner_hint,sort_order=excluded.sort_order,
  metadata=excluded.metadata,updated_at=now();

insert into public.it_scorecard_rail_resolution_contracts(
  rail_key,resolution_class,requires_human,requires_external,auto_close_allowed,resolution_note,introduced_by_schema
) values(
  'schema200_current_schema_staging_runbook_authority','build_acceptance',false,false,false,
  'Close only after schema/source/browser/exact-release proof. Staging execution and all human/external business rails remain independently gated.',200
)
on conflict(rail_key) do update set
  resolution_class=excluded.resolution_class,requires_human=excluded.requires_human,requires_external=excluded.requires_external,
  auto_close_allowed=excluded.auto_close_allowed,resolution_note=excluded.resolution_note,introduced_by_schema=excluded.introduced_by_schema;

insert into public.app_schema_versions(schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label)
values(
  200,'200_current_schema_staging_runbook_authority','Converges staging runbook and next-safe-action guidance on exact current-schema execution while preserving the historical Schema 187 scenario catalog.',
  'applied',now(),'schema200','No staging/Auth/Finance/provider mutation and no human/external rail closure.',
  '200_current_schema_staging_runbook_authority.sql','schema200'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status=excluded.status,applied_at=excluded.applied_at,
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

-- Exact means exact: ahead-of-source is no longer reported as current.
create or replace view public.v_schema_drift_status as
select
  200 as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter (where status='applied'),0)=200 then 'current'
    when coalesce(max(schema_version) filter (where status='applied'),0)>200 then 'ahead'
    else 'drift'
  end::text as drift_status,
  case
    when coalesce(max(schema_version) filter (where status='applied'),0)=200
      then 'Live database exactly matches the repo schema marker.'
    when coalesce(max(schema_version) filter (where status='applied'),0)>200
      then 'Live database is ahead of the repo schema marker; release/staging mutation must remain fail-closed.'
    else 'Live database is behind the repo schema marker.'
  end::text as message,
  now() as checked_at
from public.app_schema_versions;

revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
