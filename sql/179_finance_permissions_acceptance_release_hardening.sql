-- 179_finance_permissions_acceptance_release_hardening.sql
-- Build 2026-09-02k
-- Adds Finance permission/acceptance release contracts and I.T. hardening status.
-- This is control-plane only: no posting release, accountant mapping approval,
-- provider/payment mutation, Jobs writeback, fifth module, or Production promotion.

begin;

create table if not exists public.finance_release_acceptance_scenarios (
  scenario_key text primary key,
  scenario_group text not null,
  access_level text not null,
  protected_action text not null,
  expected_outcome text not null,
  expected_http_status integer,
  persistence_effect text not null default 'none',
  notes text not null,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (access_level in ('hidden','view','create','approve','manage','admin_break_glass','server_control')),
  check (expected_outcome in ('denied','allowed_read','allowed_approval','allowed_manage','blocked_server_release','rejected_server_owned_fields')),
  check (persistence_effect='none')
);

alter table public.finance_release_acceptance_scenarios enable row level security;
revoke all on table public.finance_release_acceptance_scenarios from public,anon,authenticated;
grant select on table public.finance_release_acceptance_scenarios to service_role;

insert into public.finance_release_acceptance_scenarios(
  scenario_key,scenario_group,access_level,protected_action,expected_outcome,expected_http_status,persistence_effect,notes,sort_order
) values
  ('hidden_list_denied','permissions','hidden','list','denied',403,'none','Hidden Finance access cannot load either protected Finance control-plane endpoint.',10),
  ('view_list_allowed','permissions','view','list','allowed_read',200,'none','View access may read Finance lifecycle and review queues.',20),
  ('create_list_allowed','permissions','create','list','allowed_read',200,'none','Create inherits view visibility but does not gain Finance approval authority.',30),
  ('view_disposition_denied','permissions','view','dispose','denied',403,'none','View access cannot approve or reject a completion.',40),
  ('create_disposition_denied','permissions','create','dispose','denied',403,'none','Create access cannot approve or reject a completion.',50),
  ('approve_disposition_allowed','permissions','approve','dispose','allowed_approval',200,'none','Approve access may make the explicit human Finance disposition.',60),
  ('approve_candidate_generation_allowed','permissions','approve','generate_candidates','allowed_approval',200,'none','Approve access may generate draft candidates only after approved disposition.',70),
  ('approve_posting_approval_allowed','permissions','approve','approve_posting','allowed_approval',200,'none','Posting approval is a second explicit Finance approve authority.',80),
  ('view_preflight_allowed_read','permissions','view','preflight','allowed_read',200,'none','Read-only preflight is safe to invoke with Finance view access; it cannot post.',90),
  ('approve_execution_server_gated','release','approve','execute_posting','blocked_server_release',200,'none','Approve access alone cannot execute while the server release control is OFF.',100),
  ('approve_reversal_denied','permissions','approve','reverse_posting','denied',403,'none','Reversal remains Finance manage-only.',110),
  ('manage_reversal_allowed','permissions','manage','reverse_posting','allowed_manage',200,'none','Manage access may request auditable reversal only for a completed posting.',120),
  ('admin_break_glass_manage','permissions','admin_break_glass','all_finance_actions','allowed_manage',200,'none','Admin break-glass resolves to manage on all four modules.',130),
  ('direct_financial_truth_rejected','bypass','approve','server_owned_financial_fields','rejected_server_owned_fields',400,'none','Browser-supplied totals, accounts, posting state or provider truth are rejected.',140),
  ('browser_release_toggle_rejected','bypass','server_control','execution_release_toggle','rejected_server_owned_fields',400,'none','The browser has no route to enable the posting execution release.',150),
  ('provider_mutation_closed','bypass','server_control','provider_mutation','blocked_server_release',200,'none','Stripe, PayPal and provider/payment mutation remain outside this Finance pipeline.',160)
on conflict(scenario_key) do update set
  scenario_group=excluded.scenario_group,
  access_level=excluded.access_level,
  protected_action=excluded.protected_action,
  expected_outcome=excluded.expected_outcome,
  expected_http_status=excluded.expected_http_status,
  persistence_effect=excluded.persistence_effect,
  notes=excluded.notes,
  sort_order=excluded.sort_order,
  updated_at=now();

create or replace function public.ywi_finance_release_hardening_assertions()
returns table(assertion_key text,assertion_status text,details text)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select 'finance_permission_rank_order',
    case when public.ywi_module_access_rank('hidden') < public.ywi_module_access_rank('view')
      and public.ywi_module_access_rank('view') < public.ywi_module_access_rank('create')
      and public.ywi_module_access_rank('create') < public.ywi_module_access_rank('approve')
      and public.ywi_module_access_rank('approve') < public.ywi_module_access_rank('manage')
      then 'passed' else 'failed' end,
    'Finance permission levels remain strictly ordered hidden < view < create < approve < manage.'
  union all
  select 'finance_acceptance_scenario_coverage',
    case when (select count(*) from public.finance_release_acceptance_scenarios)>=16
      and (select count(distinct access_level) from public.finance_release_acceptance_scenarios)>=7
      and not exists(select 1 from public.finance_release_acceptance_scenarios where persistence_effect<>'none')
      then 'passed' else 'failed' end,
    'Synthetic acceptance contracts cover permission, bypass, release and provider boundaries without persistent financial effects.'
  union all
  select 'finance_admin_break_glass_manage',
    case when exists(select 1 from public.profiles where is_active is true and public.ywi_normalized_profile_role(id)='admin')
      and not exists(
        select 1 from public.v_admin_module_access_integrity
        where role='admin' and all_modules_manage is not true
      ) then 'passed' else 'failed' end,
    'Every active Admin resolves to manage across Safety, Finance, Jobs and Admin.'
  union all
  select 'finance_protected_rpcs_service_only',
    case when not exists(
      select 1 from information_schema.routine_privileges
      where routine_schema='public'
        and routine_name in (
          'ywi_finance_dispose_job_completion_review','ywi_finance_generate_job_completion_candidates',
          'ywi_finance_approve_job_completion_posting','ywi_finance_job_completion_posting_preflight',
          'ywi_finance_execute_job_completion_posting','ywi_finance_reverse_job_completion_posting'
        )
        and grantee in ('PUBLIC','anon','authenticated')
        and privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
    'Finance mutation/preflight RPCs remain service-role control-plane entry points; browser authorization is enforced by protected Edge Functions.'
  union all
  select 'finance_execution_release_private_and_off',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public' and table_name='finance_job_completion_posting_execution_controls'
        and grantee in ('PUBLIC','anon','authenticated')
    ) and not exists(
      select 1 from public.finance_job_completion_posting_execution_controls
      where execution_enabled is true
    ) then 'passed' else 'failed' end,
    'The Finance execution release is server-owned and remains OFF for Build 179.'
  union all
  select 'finance_provider_mutation_closed',
    case when not exists(
      select 1 from public.finance_job_completion_posting_execution_controls
      where provider_mutation_enabled is true
    ) and not exists(
      select 1 from public.v_finance_job_completion_operational_lifecycle
      where provider_mutation_authorized is true
    ) then 'passed' else 'failed' end,
    'Provider/payment mutation remains false across execution control and operational lifecycle truth.'
  union all
  select 'finance_account_mapping_human_control',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public' and table_name='accountant_export_mapping_rules'
        and grantee in ('PUBLIC','anon','authenticated')
    ) then 'passed' else 'failed' end,
    'Accountant/chart mapping decisions remain private and cannot be approved directly by the browser.'
  union all
  select 'finance_schema_dependencies_current',
    case when not exists(
      select 1 from public.v_it_schema_dependency_status
      where required_by_schema<=179 and check_status<>'passed'
    ) then 'passed' else 'failed' end,
    'All Finance/core schema dependencies required through Schema 179 match the live catalog.'
  union all
  select 'finance_reconciliation_no_critical_divergence',
    case when not exists(
      select 1 from public.v_finance_job_completion_reconciliation_issues where severity='critical'
    ) then 'passed' else 'failed' end,
    'No critical Finance orphan, duplicate, incomplete-pair or reversal divergence is present.'
  union all
  select 'finance_prior_assertion_chain_green',
    case when not exists(select 1 from public.ywi_finance_posting_safety_assertions() where assertion_status<>'passed')
      and not exists(select 1 from public.ywi_finance_posting_preflight_assertions() where assertion_status<>'passed')
      and not exists(select 1 from public.ywi_finance_posting_execution_assertions() where assertion_status<>'passed')
      and not exists(select 1 from public.ywi_finance_operational_control_plane_assertions() where assertion_status<>'passed')
      then 'passed' else 'failed' end,
    'Schemas 175-178 posting safety, preflight, execution/recovery and operational assertions remain green.'
  union all
  select 'finance_no_jobs_writeback_in_finance_rpcs',
    case when not exists(
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public'
        and p.proname in (
          'ywi_finance_dispose_job_completion_review','ywi_finance_generate_job_completion_candidates',
          'ywi_finance_approve_job_completion_posting','ywi_finance_job_completion_posting_preflight',
          'ywi_finance_execute_job_completion_posting','ywi_finance_reverse_job_completion_posting'
        )
        and (pg_get_functiondef(p.oid) ~* 'update[[:space:]]+public[.]jobs([[:space:]]|$)'
          or pg_get_functiondef(p.oid) ~* 'update[[:space:]]+public[.]work_orders([[:space:]]|$)')
    ) then 'passed' else 'failed' end,
    'Finance completion/accounting RPCs do not write canonical Jobs or work-order state.'
  union all
  select 'finance_release_acceptance_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public' and table_name='finance_release_acceptance_scenarios'
        and grantee in ('PUBLIC','anon','authenticated')
    ) then 'passed' else 'failed' end,
    'Build 179 synthetic acceptance contracts are a private service-role control-plane surface.';
$$;

revoke all on function public.ywi_finance_release_hardening_assertions() from public,anon,authenticated;
grant execute on function public.ywi_finance_release_hardening_assertions() to service_role;

create or replace view public.v_it_finance_release_hardening_status
with (security_invoker=true)
as
with assertions as (
  select count(*)::int as assertion_count,
         count(*) filter(where assertion_status='passed')::int as passed_count,
         count(*) filter(where assertion_status<>'passed')::int as failed_count
  from public.ywi_finance_release_hardening_assertions()
), scenarios as (
  select count(*)::int as scenario_count,
         count(distinct access_level)::int as access_levels_covered
  from public.finance_release_acceptance_scenarios
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
  select release_schema_version,source_sha,workflow_run_id,release_authority_status,repository_enforcement_status
  from public.v_it_release_authority_status limit 1
)
select
  a.assertion_count,a.passed_count,a.failed_count,
  s.scenario_count,s.access_levels_covered,
  c.execution_release_enabled,
  c.provider_mutation_enabled,
  r.reconciliation_issue_count,r.critical_reconciliation_issue_count,
  au.release_schema_version,au.source_sha,au.workflow_run_id,
  au.release_authority_status,au.repository_enforcement_status,
  case
    when a.failed_count>0 or r.critical_reconciliation_issue_count>0 or c.provider_mutation_enabled then 'red'
    when au.release_schema_version<179 or au.release_authority_status<>'green' then 'amber'
    else 'green'
  end::text as hardening_status,
  now() as checked_at
from assertions a cross join scenarios s cross join controls c cross join reconciliation r cross join authority au;

revoke all on table public.v_it_finance_release_hardening_status from public,anon,authenticated;
grant select on table public.v_it_finance_release_hardening_status to service_role;

insert into public.app_schema_dependency_contracts(
  contract_key,relation_schema,relation_name,column_name,expected_data_type,owner_module,
  introduced_by_schema,required_by_schema,is_required,notes
) values
  ('finance_profile_permission_access_level','public','app_profile_module_permissions','access_level','text','admin',159,179,true,'Build 179 Finance permission override contract.'),
  ('finance_execution_release_enabled','public','finance_job_completion_posting_execution_controls','execution_enabled','boolean','finance',177,179,true,'Build 179 server-owned posting release contract.'),
  ('finance_execution_provider_mutation_enabled','public','finance_job_completion_posting_execution_controls','provider_mutation_enabled','boolean','finance',177,179,true,'Build 179 provider mutation fail-closed contract.')
on conflict(contract_key) do update set
  relation_schema=excluded.relation_schema,relation_name=excluded.relation_name,column_name=excluded.column_name,
  expected_data_type=excluded.expected_data_type,owner_module=excluded.owner_module,
  introduced_by_schema=excluded.introduced_by_schema,required_by_schema=excluded.required_by_schema,
  is_required=excluded.is_required,notes=excluded.notes,updated_at=now();

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values(
  'finance_release_hardening','Finance','Finance permissions, synthetic acceptance and release hardening','critical',
  'Resolve Finance permission, browser acceptance, reconciliation or release-gate failures before extending accounting execution.',
  'Admin > I.T. Readiness',49,true
)
on conflict(check_key) do update set
  check_group=excluded.check_group,check_title=excluded.check_title,severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,route_hint=excluded.route_hint,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,updated_at=now();

update public.admin_scorecard_progress_rails
set rail_status='complete',progress_percent=100,current_value=10,target_value=10,
    next_action_hint='Schema 178 lifecycle/reconciliation control plane is release-proven; Build 179 now hardens permissions and acceptance.',
    updated_at=now()
where rail_key='schema178_finance_operational_control_plane';

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values(
  'schema179_finance_permissions_acceptance_release_hardening','finance','Finance permissions, synthetic acceptance and release hardening','active',90,9,10,
  'Pass exact source/browser gates, apply Schema 179, verify live assertions/functions, record exact-main release evidence, then close the rail.',
  'Finance / I.T.',99,
  '{"build":"2026-09-02k","schema":179,"permission_matrix":true,"synthetic_browser_fixtures":true,"direct_api_bypass_guards":true,"release_chain_gate":true,"posting_execution_release_enabled":false,"jobs_writeback":false,"provider_mutation":false,"production_promotion":false}'::jsonb
)
on conflict(rail_key) do update set
  rail_area=excluded.rail_area,rail_title=excluded.rail_title,rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,current_value=excluded.current_value,target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint,owner_hint=excluded.owner_hint,sort_order=excluded.sort_order,
  metadata=excluded.metadata,updated_at=now();

insert into public.app_schema_versions(
  schema_version,migration_key,schema_name,release_label,description,status,notes
) values(
  179,'179_finance_permissions_acceptance_release_hardening','179_finance_permissions_acceptance_release_hardening.sql','2026-09-02k',
  'Adds Finance permission-matrix acceptance contracts, release-hardening assertions and Admin I.T. hardening status over the existing completion-to-accounting chain.',
  'applied',
  'Control-plane only. Synthetic browser fixtures are non-persistent. Posting execution release and provider mutation remain OFF; accountant mappings remain human-controlled; Jobs writeback and Production promotion remain excluded.'
)
on conflict(schema_version) do update set
  migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,
  description=excluded.description,status=excluded.status,notes=excluded.notes,applied_at=now();

create or replace view public.v_schema_drift_status as
select 179::int as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=179 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=179
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 179 in order.' end as message,
  now() as checked_at
from public.app_schema_versions;

commit;
