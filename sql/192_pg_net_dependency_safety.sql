begin;

-- Schema 192 — pg_net dependency inventory and relocation-safety authority.
-- pg_net is retained in its current installed schema because the live extension is
-- non-relocatable and is actively used by two scheduler dispatch functions and two
-- pg_cron jobs. This migration records that runtime constraint, makes it observable,
-- and removes the false relocation task from Current Admin To-Do while the dependency
-- remains healthy. No extension, cron job, business row, Finance/provider switch, or
-- human-gated business acceptance rail is modified by this migration.

create table if not exists public.it_platform_runtime_constraints (
  constraint_key text primary key,
  component_name text not null,
  constraint_class text not null,
  decision_status text not null check(decision_status in ('accepted','review','retired')),
  observed_schema text,
  observed_version text,
  relocatable boolean,
  rationale text not null,
  revisit_trigger text not null,
  evidence jsonb not null default '{}'::jsonb,
  introduced_by_schema int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.it_platform_runtime_constraints enable row level security;
revoke all on table public.it_platform_runtime_constraints from public,anon,authenticated;
grant select,insert,update on table public.it_platform_runtime_constraints to service_role;

insert into public.it_platform_runtime_constraints(
  constraint_key,component_name,constraint_class,decision_status,observed_schema,observed_version,
  relocatable,rationale,revisit_trigger,evidence,introduced_by_schema
)
select
  'pg_net_public_schema_runtime_dependency',
  'pg_net',
  'supabase_managed_extension_runtime_dependency',
  'accepted',
  n.nspname,
  e.extversion,
  e.extrelocatable,
  'Retain pg_net in its current installed schema. The live extension is non-relocatable and is an active dependency of YardWeasels scheduler dispatch functions and pg_cron jobs. Advisor placement alone is not sufficient justification for drop/recreate or forced relocation.',
  'Re-open review if pg_net becomes relocatable, the scheduler architecture stops using net.http_post, the active cron dependencies are retired, or Supabase publishes a supported migration path for this project.',
  jsonb_build_object(
    'inventory_date','2026-09-03',
    'expected_scheduler_functions',jsonb_build_array('dispatch_due_service_execution_scheduler_runs','dispatch_due_report_delivery_scheduler_runs'),
    'expected_cron_jobs',jsonb_build_array('service_execution_scheduler_dispatch_default','report_subscription_delivery_dispatch_default'),
    'business_data_mutation',false,
    'extension_relocation_performed',false
  ),
  192
from pg_extension e
join pg_namespace n on n.oid=e.extnamespace
where e.extname='pg_net'
on conflict(constraint_key) do update set
  component_name=excluded.component_name,
  constraint_class=excluded.constraint_class,
  decision_status=excluded.decision_status,
  observed_schema=excluded.observed_schema,
  observed_version=excluded.observed_version,
  relocatable=excluded.relocatable,
  rationale=excluded.rationale,
  revisit_trigger=excluded.revisit_trigger,
  evidence=excluded.evidence,
  introduced_by_schema=excluded.introduced_by_schema,
  updated_at=now();

create or replace view public.v_it_pg_net_runtime_dependency_status
with (security_invoker=true)
as
with ext as (
  select e.extname,e.extversion,e.extrelocatable,n.nspname as installed_schema
  from pg_extension e
  join pg_namespace n on n.oid=e.extnamespace
  where e.extname='pg_net'
), fn as (
  select count(*)::int as dependency_function_count,
    array_agg(p.proname order by p.proname) filter(where p.proname is not null) as dependency_functions
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in ('dispatch_due_service_execution_scheduler_runs','dispatch_due_report_delivery_scheduler_runs')
    and pg_get_functiondef(p.oid) like '%net.http_post%'
), cj as (
  select count(*)::int as active_cron_dependency_count,
    array_agg(jobname order by jobname) filter(where jobname is not null) as active_cron_jobs
  from cron.job
  where active
    and jobname in ('service_execution_scheduler_dispatch_default','report_subscription_delivery_dispatch_default')
    and command like '%dispatch_due_%scheduler_runs%'
), recent as (
  select
    count(*)::int as response_rows_30d,
    count(*) filter(where status_code between 200 and 299)::int as success_2xx_30d,
    count(*) filter(where timed_out or error_msg is not null)::int as error_or_timeout_30d,
    max(created) as latest_response_at
  from net._http_response
  where created >= now()-interval '30 days'
), c as (
  select * from public.it_platform_runtime_constraints
  where constraint_key='pg_net_public_schema_runtime_dependency'
)
select
  c.constraint_key,
  c.component_name,
  e.extversion as installed_version,
  e.installed_schema,
  e.extrelocatable as relocatable,
  fn.dependency_function_count,
  coalesce(fn.dependency_functions,'{}'::name[]) as dependency_functions,
  cj.active_cron_dependency_count,
  coalesce(cj.active_cron_jobs,'{}'::text[]) as active_cron_jobs,
  recent.response_rows_30d,
  recent.success_2xx_30d,
  recent.error_or_timeout_30d,
  recent.latest_response_at,
  case
    when e.extname is null then 'failed'
    when e.extrelocatable then 'review'
    when fn.dependency_function_count<2 then 'review'
    when cj.active_cron_dependency_count<2 then 'review'
    else 'accepted'
  end::text as status,
  case
    when e.extname is null then 'pg_net is missing; scheduler delivery is at risk.'
    when e.extrelocatable then 'pg_net reports relocatable; re-evaluate the accepted placement constraint before changing it.'
    when fn.dependency_function_count<2 or cj.active_cron_dependency_count<2 then 'Scheduler dependency drift detected; review pg_net placement and scheduler architecture.'
    else 'Accepted runtime constraint: pg_net remains in its current installed schema because it is non-relocatable and actively required by scheduler dispatch.'
  end::text as status_message,
  c.rationale,
  c.revisit_trigger,
  now() as checked_at
from c
left join ext e on true
cross join fn
cross join cj
cross join recent;

revoke all on table public.v_it_pg_net_runtime_dependency_status from public,anon,authenticated;
grant select on table public.v_it_pg_net_runtime_dependency_status to service_role;

create or replace view public.v_it_current_admin_todo
with (security_invoker=true)
as
select
  ('rail:'||r.rail_key)::text as todo_key,
  r.rail_area::text as todo_area,
  r.rail_title::text as todo_title,
  r.technical_readiness_status::text as todo_status,
  r.current_action::text as current_action,
  r.evidence_requirement::text as evidence_requirement,
  r.requires_human,
  r.requires_external,
  r.resolution_class::text as source_kind,
  null::int as source_schema_version,
  r.sort_order::int as sort_order,
  r.checked_at
from public.v_it_open_rail_acceptance_readiness r
where r.rail_status<>'complete'
union all
select
  ('security:'||s.object_name)::text,
  'security'::text,
  case s.object_name
    when 'leaked_password_protection' then 'Verify leaked-password protection in Supabase Auth'
    when 'mfa_options' then 'Verify MFA options in Supabase Auth'
    when 'pg_net' then 'Review pg_net runtime placement constraint'
    else 'Review current security follow-up: '||s.object_name
  end::text,
  'pending'::text,
  case s.object_name
    when 'leaked_password_protection' then 'Verify the current Supabase Auth leaked-password protection setting in the external Auth control plane and record evidence before changing it.'
    when 'mfa_options' then 'Verify the current Supabase Auth MFA configuration in the external Auth control plane and record evidence before changing it.'
    when 'pg_net' then 'Review current pg_net runtime dependency status; do not relocate unless the accepted runtime constraint has changed.'
    else 'Verify this security follow-up against its live authority before remediation.'
  end::text,
  'Current external/catalog evidence is required; historical advisor rows are not sufficient proof.'::text,
  false,
  (s.reconciliation_state='external_verification')::boolean,
  'security_followup'::text,
  192::int,
  500 + row_number() over(order by s.object_name)::int,
  s.checked_at
from public.v_it_security_advisor_truth s
where s.reconciliation_state in ('confirmed_followup','external_verification')
  and (
    s.object_name<>'pg_net'
    or not exists(select 1 from public.v_it_pg_net_runtime_dependency_status p where p.status='accepted')
  )
union all
select
  'repository:main_protection'::text,
  'release'::text,
  'Protect main branch repository enforcement'::text,
  ra.repository_enforcement_status::text,
  'Enable and verify main branch protection/ruleset enforcement, then record current branch-policy evidence. This remains separate from application release authority.'::text,
  'GitHub must report current main protection/ruleset enforcement; do not infer protection from a green application workflow.'::text,
  false,
  true,
  'repository_followup'::text,
  ra.release_schema_version::int,
  900::int,
  ra.checked_at
from public.v_it_release_authority_status ra
where lower(coalesce(ra.repository_enforcement_status,''))<>'green';

revoke all on table public.v_it_current_admin_todo from public,anon,authenticated;
grant select on table public.v_it_current_admin_todo to service_role;

create or replace view public.v_it_current_admin_todo_status
with (security_invoker=true)
as
select
  count(*)::int as current_todo_count,
  count(*) filter(where todo_key like 'rail:%')::int as business_acceptance_count,
  count(*) filter(where source_kind='security_followup')::int as security_followup_count,
  count(*) filter(where source_kind='repository_followup')::int as repository_followup_count,
  count(*) filter(where requires_human)::int as human_required_count,
  count(*) filter(where requires_external)::int as external_required_count,
  case when count(*)=0 then 'green' else 'amber' end::text as todo_status,
  'Only current unresolved actions appear here. Accepted runtime constraints, completed rails, and superseded preflight/prerelease checklists are not active To-Do items.'::text as status_message,
  now() as checked_at
from public.v_it_current_admin_todo;

revoke all on table public.v_it_current_admin_todo_status from public,anon,authenticated;
grant select on table public.v_it_current_admin_todo_status to service_role;

create or replace function public.ywi_pg_net_runtime_constraint_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql
security definer
set search_path=public,pg_temp
as $$
  select 'pg_net_extension_present',
    case when exists(select 1 from pg_extension where extname='pg_net') then 'passed' else 'failed' end,
    'pg_net is installed.'
  union all
  select 'pg_net_non_relocatable_truth',
    case when exists(select 1 from pg_extension where extname='pg_net' and extrelocatable=false) then 'passed' else 'failed' end,
    'Live pg_net reports non-relocatable; Build 192 does not force relocation.'
  union all
  select 'pg_net_scheduler_functions_tracked',
    case when exists(select 1 from public.v_it_pg_net_runtime_dependency_status where dependency_function_count>=2) then 'passed' else 'failed' end,
    'Both YardWeasels scheduler dispatch functions still call net.http_post.'
  union all
  select 'pg_net_active_cron_dependencies_tracked',
    case when exists(select 1 from public.v_it_pg_net_runtime_dependency_status where active_cron_dependency_count>=2) then 'passed' else 'failed' end,
    'Both expected pg_cron scheduler dispatch jobs remain active.'
  union all
  select 'pg_net_constraint_accepted_from_live_truth',
    case when exists(select 1 from public.v_it_pg_net_runtime_dependency_status where status='accepted') then 'passed' else 'failed' end,
    'The runtime constraint is accepted only while extension, function, and cron dependency truth agrees.'
  union all
  select 'pg_net_false_relocation_todo_suppressed',
    case when not exists(select 1 from public.v_it_current_admin_todo where todo_key='security:pg_net') then 'passed' else 'failed' end,
    'The active Admin To-Do does not request pg_net relocation while the accepted dependency is healthy.'
  union all
  select 'pg_net_runtime_authority_service_private',
    case when not has_table_privilege('anon','public.it_platform_runtime_constraints','select')
      and not has_table_privilege('authenticated','public.it_platform_runtime_constraints','select')
      and has_table_privilege('service_role','public.it_platform_runtime_constraints','select')
      and not has_table_privilege('anon','public.v_it_pg_net_runtime_dependency_status','select')
      and not has_table_privilege('authenticated','public.v_it_pg_net_runtime_dependency_status','select')
      and has_table_privilege('service_role','public.v_it_pg_net_runtime_dependency_status','select')
    then 'passed' else 'failed' end,
    'Runtime-constraint evidence is service-role-only.'
  union all
  select 'business_acceptance_rails_untouched',
    case when (select count(*) from public.v_it_open_rail_acceptance_readiness where rail_status<>'complete')=11
    then 'passed' else 'failed' end,
    'All 11 existing human/provider/accounting/content acceptance rails remain open.';
$$;

revoke all on function public.ywi_pg_net_runtime_constraint_assertions() from public,anon,authenticated;
grant execute on function public.ywi_pg_net_runtime_constraint_assertions() to service_role;

insert into public.it_readiness_check_registry(check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled)
values(
  'pg_net_runtime_constraint','Security','pg_net runtime dependency and relocation-safety authority','critical',
  'Treat pg_net placement as an accepted runtime constraint while the service-private dependency status is accepted. Re-open only if extension relocatability, scheduler function usage, cron wiring, or Supabase-supported migration guidance changes.',
  'Admin > I.T. Readiness',40,true
)
on conflict(check_key) do update set
  check_group=excluded.check_group,check_title=excluded.check_title,severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,route_hint=excluded.route_hint,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,updated_at=now();

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,next_action_hint,owner_hint,sort_order,metadata
) values(
  'schema192_pg_net_dependency_safety','admin','pg_net dependency inventory and relocation-safety authority','active',80,8,10,
  'Verify Schema 192 rollback proof, 8/8 pg_net assertions, source gate, exact live status, dev promotion, exact-main release evidence, and branch cleanup. Do not relocate or recreate pg_net.',
  'Admin / I.T. / Security',112,jsonb_build_object(
    'schema',192,'business_rail_auto_close',false,'extension_relocation',false,'cron_mutation',false,
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
  'schema192_pg_net_dependency_safety','build_acceptance',false,false,false,
  'Close Build 192 only after live pg_net extension/function/cron dependency truth, service-private runtime authority, source gates, dev/main parity, exact-main evidence, and branch cleanup are green. No extension relocation and no business acceptance auto-close are authorized.',192
)
on conflict(rail_key) do update set
  resolution_class=excluded.resolution_class,requires_human=excluded.requires_human,requires_external=excluded.requires_external,
  auto_close_allowed=excluded.auto_close_allowed,resolution_note=excluded.resolution_note,
  introduced_by_schema=excluded.introduced_by_schema,updated_at=now();

create or replace view public.v_schema_drift_status with (security_invoker=true) as
select 192::int as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=192 then 'current' else 'behind' end::text as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=192
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 192 in order.' end::text as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

insert into public.app_schema_versions(schema_version,migration_key,schema_name,release_label,description,status,notes)
values(
  192,'192_pg_net_dependency_safety','192_pg_net_dependency_safety.sql','2026-09-03f',
  'Records pg_net as a catalog-backed active runtime constraint, inventories scheduler function/cron dependencies, and suppresses the false relocation To-Do while that dependency remains healthy.',
  'applied',
  'Build 192 does not alter, drop, recreate, or relocate pg_net and does not mutate cron jobs or business data. Finance/provider execution remains OFF; all 11 business acceptance rails remain evidence-gated; Production promotion remains manual.'
)
on conflict(schema_version) do update set
  migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,
  description=excluded.description,status=excluded.status,notes=excluded.notes,applied_at=now();

commit;
