-- 183_finance_account_mapping_decision_support.sql
-- Build 2026-09-02o
-- Adds structural chart-account decision support around the existing human mapping authority.
-- Human review remains authoritative. This migration does not auto-select/approve an account,
-- enable posting/provider mutation, write Jobs state, change tax/chart policy, or promote Production.

begin;

create or replace view public.v_finance_account_mapping_decision_support
with (security_invoker=true)
as
with mappings as (
  select
    r.mapping_rule_id,
    r.mapping_key,
    r.source_key,
    r.target_label,
    r.account_id as current_account_id,
    r.account_number as current_account_number,
    r.account_name as current_account_name,
    r.account_type as current_account_type,
    r.system_code as current_system_code,
    r.review_status,
    r.mapping_approved,
    case r.mapping_key
      when 'accounts_receivable' then 'asset'
      when 'service_revenue' then 'revenue'
      when 'sales_tax_payable' then 'liability'
      else null
    end::text as expected_account_type
  from public.v_finance_account_mapping_review_directory r
), candidates as (
  select
    m.*,
    a.id as candidate_account_id,
    a.account_number as candidate_account_number,
    a.account_name as candidate_account_name,
    a.account_type as candidate_account_type,
    a.system_code as candidate_system_code,
    a.normal_balance as candidate_normal_balance,
    a.is_control_account as candidate_is_control_account,
    a.gifi_code as candidate_gifi_code,
    a.gifi_description as candidate_gifi_description,
    a.tax_export_group as candidate_tax_export_group,
    a.accountant_export_group as candidate_accountant_export_group,
    a.is_active as candidate_is_active,
    (a.id=m.current_account_id) as is_current_selection,
    (a.account_type=m.expected_account_type) as structural_match,
    (a.system_code=m.source_key) as source_identity_match
  from mappings m
  cross join public.chart_of_accounts a
  where a.is_active is true
)
select
  c.*,
  (c.candidate_is_active and c.structural_match) as approval_eligible,
  case
    when c.is_current_selection and c.structural_match then 'CURRENT_SELECTION'
    when c.source_identity_match and c.structural_match then 'SOURCE_IDENTITY_MATCH'
    when c.structural_match then 'TYPE_COMPATIBLE'
    else 'TYPE_MISMATCH'
  end::text as compatibility_code,
  case
    when c.is_current_selection and c.structural_match then 0
    when c.source_identity_match and c.structural_match then 10
    when c.structural_match then 20
    else 90
  end::int as decision_rank,
  case
    when c.is_current_selection and c.structural_match then 'Current human-selected account; structurally compatible with this mapping.'
    when c.source_identity_match and c.structural_match then 'Active account matches both the expected account type and this mapping source identity.'
    when c.structural_match then 'Active account has the expected structural account type; a human accountant/bookkeeper must still decide whether it is appropriate.'
    else format('Account type %s does not match the expected %s type for this mapping and cannot be approved.',coalesce(c.candidate_account_type,'unknown'),coalesce(c.expected_account_type,'unknown'))
  end::text as decision_support_message,
  now() as checked_at
from candidates c;

revoke all on table public.v_finance_account_mapping_decision_support from public,anon,authenticated;
grant select on table public.v_finance_account_mapping_decision_support to service_role;

create or replace view public.v_it_finance_account_mapping_decision_support_status
with (security_invoker=true)
as
with per_mapping as (
  select
    mapping_key,
    expected_account_type,
    count(*) filter(where approval_eligible)::int as eligible_candidate_count,
    count(*) filter(where not structural_match)::int as type_mismatch_candidate_count,
    count(*) filter(where is_current_selection and not structural_match)::int as current_selection_incompatible_count
  from public.v_finance_account_mapping_decision_support
  group by mapping_key,expected_account_type
), totals as (
  select
    count(*)::int as mapping_count,
    coalesce(sum(eligible_candidate_count),0)::int as eligible_candidate_count,
    coalesce(sum(type_mismatch_candidate_count),0)::int as type_mismatch_candidate_count,
    coalesce(sum(current_selection_incompatible_count),0)::int as current_selection_incompatible_count,
    count(*) filter(where eligible_candidate_count=0)::int as mapping_without_eligible_candidate_count
  from per_mapping
), controls as (
  select
    coalesce(bool_or(execution_enabled),false) as execution_release_enabled,
    coalesce(bool_or(provider_mutation_enabled),false) as provider_mutation_enabled
  from public.finance_job_completion_posting_execution_controls
  where control_key='finance_job_completion_v1'
)
select
  t.*,
  c.execution_release_enabled,
  c.provider_mutation_enabled,
  case
    when t.mapping_count<>3 or t.current_selection_incompatible_count>0 or t.mapping_without_eligible_candidate_count>0
      or c.execution_release_enabled or c.provider_mutation_enabled then 'red'
    else 'green'
  end::text as mapping_decision_support_status,
  case
    when t.mapping_count<>3 then 'Decision support does not cover exactly the three canonical Finance posting mappings.'
    when t.current_selection_incompatible_count>0 then 'A current human-selected mapping points to an account with the wrong structural account type.'
    when t.mapping_without_eligible_candidate_count>0 then 'At least one canonical mapping has no active structurally compatible chart-account candidate.'
    when c.execution_release_enabled then 'Posting execution is unexpectedly enabled for this bounded decision-support release.'
    when c.provider_mutation_enabled then 'Provider/payment mutation is unexpectedly enabled.'
    else 'Decision support is structurally healthy. Final account selection and approval remain human accounting decisions.'
  end::text as decision_support_message,
  now() as checked_at
from totals t cross join controls c;

revoke all on table public.v_it_finance_account_mapping_decision_support_status from public,anon,authenticated;
grant select on table public.v_it_finance_account_mapping_decision_support_status to service_role;

create or replace function public.ywi_finance_review_account_mapping(
  p_mapping_key text,
  p_account_id uuid,
  p_review_status text,
  p_reason text,
  p_actor_profile_id uuid
)
returns table(
  mapping_key text,
  account_id uuid,
  review_status text,
  reviewed_by_profile_id uuid,
  reviewed_at timestamptz,
  audit_id uuid
)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_rule public.accountant_export_mapping_rules%rowtype;
  v_new_account_id uuid;
  v_new_status text := lower(trim(coalesce(p_review_status,'')));
  v_reason text := trim(coalesce(p_reason,''));
  v_account_active boolean := false;
  v_account_type text;
  v_expected_account_type text;
  v_audit_id uuid;
begin
  if p_actor_profile_id is null
     or public.ywi_module_access_rank(public.ywi_effective_module_access(p_actor_profile_id,'finance'))
        < public.ywi_module_access_rank('manage') then
    raise exception 'Finance manage access is required for accountant mapping review.' using errcode='42501';
  end if;

  if lower(trim(coalesce(p_mapping_key,''))) not in ('accounts_receivable','service_revenue','sales_tax_payable') then
    raise exception 'Unsupported Finance posting mapping key.' using errcode='22023';
  end if;
  if v_new_status not in ('review','approved','rejected') then
    raise exception 'review_status must be review, approved, or rejected.' using errcode='22023';
  end if;
  if length(v_reason)<5 then
    raise exception 'A mapping review reason of at least 5 characters is required.' using errcode='22023';
  end if;

  select * into v_rule
  from public.accountant_export_mapping_rules
  where mapping_key=lower(trim(p_mapping_key)) and mapping_type='account' and is_active is true
  for update;
  if v_rule.id is null then
    raise exception 'Active canonical mapping rule was not found.' using errcode='P0002';
  end if;

  v_expected_account_type := case v_rule.mapping_key
    when 'accounts_receivable' then 'asset'
    when 'service_revenue' then 'revenue'
    when 'sales_tax_payable' then 'liability'
    else null
  end;

  v_new_account_id := coalesce(p_account_id,v_rule.account_id);
  if v_new_account_id is not null then
    select is_active,account_type into v_account_active,v_account_type
    from public.chart_of_accounts where id=v_new_account_id;
    if coalesce(v_account_active,false) is not true then
      raise exception 'Selected chart account must exist and be active.' using errcode='23514';
    end if;
  end if;
  if v_new_status='approved' and v_new_account_id is null then
    raise exception 'Approved mapping requires an active chart account.' using errcode='23514';
  end if;
  if v_new_status='approved' and v_account_type is distinct from v_expected_account_type then
    raise exception 'Selected chart account type % is not structurally compatible with %; expected account type %.',coalesce(v_account_type,'unknown'),v_rule.mapping_key,v_expected_account_type using errcode='23514';
  end if;

  update public.accountant_export_mapping_rules
  set account_id=v_new_account_id,
      review_status=v_new_status,
      reviewed_by_profile_id=p_actor_profile_id,
      reviewed_at=now(),
      updated_at=now()
  where id=v_rule.id;

  insert into public.finance_account_mapping_review_audit(
    mapping_rule_id,mapping_key,prior_account_id,new_account_id,prior_review_status,new_review_status,
    review_reason,reviewed_by_profile_id,metadata
  ) values(
    v_rule.id,v_rule.mapping_key,v_rule.account_id,v_new_account_id,v_rule.review_status,v_new_status,
    v_reason,p_actor_profile_id,
    jsonb_build_object(
      'authority','schema183_finance_account_mapping_decision_support',
      'expected_account_type',v_expected_account_type,
      'selected_account_type',v_account_type,
      'structural_compatibility_guard',true,
      'posting_execution_released',false,
      'provider_mutation',false
    )
  ) returning id into v_audit_id;

  return query
  select r.mapping_key,r.account_id,r.review_status,r.reviewed_by_profile_id,r.reviewed_at,v_audit_id
  from public.accountant_export_mapping_rules r where r.id=v_rule.id;
end;
$$;

revoke all on function public.ywi_finance_review_account_mapping(text,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.ywi_finance_review_account_mapping(text,uuid,text,text,uuid) to service_role;

create or replace function public.ywi_finance_account_mapping_decision_support_assertions()
returns table(assertion_key text,assertion_status text,details text)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select 'finance_mapping_decision_support_three_canonical_keys',
    case when (select count(distinct mapping_key) from public.v_finance_account_mapping_decision_support)=3 then 'passed' else 'failed' end,
    'Decision support covers exactly the three canonical posting mappings.'
  union all
  select 'finance_mapping_decision_support_surfaces_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public' and table_name in ('v_finance_account_mapping_decision_support','v_it_finance_account_mapping_decision_support_status')
        and grantee in ('PUBLIC','anon','authenticated')
    ) then 'passed' else 'failed' end,
    'Decision-support views are private service-role surfaces.'
  union all
  select 'finance_mapping_decision_support_each_mapping_has_eligible_account',
    case when not exists(
      select mapping_key from public.v_finance_account_mapping_decision_support
      group by mapping_key having count(*) filter(where approval_eligible)=0
    ) then 'passed' else 'failed' end,
    'Each canonical mapping has at least one active structurally compatible candidate.'
  union all
  select 'finance_mapping_decision_support_current_selection_compatible',
    case when not exists(
      select 1 from public.v_finance_account_mapping_decision_support
      where is_current_selection and not structural_match
    ) then 'passed' else 'failed' end,
    'Current human-selected mapping accounts have the expected structural account type.'
  union all
  select 'finance_mapping_decision_support_db_approval_guard',
    case when pg_get_functiondef('public.ywi_finance_review_account_mapping(text,uuid,text,text,uuid)'::regprocedure)
      like '%not structurally compatible%' then 'passed' else 'failed' end,
    'Database approval authority rejects structurally incompatible accounts while preserving human review/reject decisions.'
  union all
  select 'finance_mapping_decision_support_execution_provider_off',
    case when not exists(
      select 1 from public.finance_job_completion_posting_execution_controls
      where execution_enabled is true or provider_mutation_enabled is true
    ) then 'passed' else 'failed' end,
    'Build 183 does not enable accounting execution or provider/payment mutation.';
$$;

revoke all on function public.ywi_finance_account_mapping_decision_support_assertions() from public,anon,authenticated;
grant execute on function public.ywi_finance_account_mapping_decision_support_assertions() to service_role;

insert into public.app_schema_dependency_contracts(
  contract_key,relation_schema,relation_name,column_name,expected_data_type,owner_module,
  introduced_by_schema,required_by_schema,is_required,notes
) values
  ('finance_mapping_decision_support_account_type','public','chart_of_accounts','account_type','text','finance',30,183,true,'Build 183 structural account compatibility.'),
  ('finance_mapping_decision_support_system_code','public','chart_of_accounts','system_code','text','finance',30,183,true,'Build 183 account identity decision support.'),
  ('finance_mapping_decision_support_source_key','public','accountant_export_mapping_rules','source_key','text','finance',153,183,true,'Build 183 source-identity comparison without auto-selection.')
on conflict(contract_key) do update set
  relation_schema=excluded.relation_schema,relation_name=excluded.relation_name,column_name=excluded.column_name,
  expected_data_type=excluded.expected_data_type,owner_module=excluded.owner_module,
  introduced_by_schema=excluded.introduced_by_schema,required_by_schema=excluded.required_by_schema,
  is_required=excluded.is_required,notes=excluded.notes,updated_at=now();

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values(
  'finance_account_mapping_decision_support','Finance','Finance account mapping decision support','critical',
  'Verify all three canonical mappings have active structurally compatible chart-account candidates and the current selections match their expected account types. Human approval remains separate.',
  'Admin > I.T. Readiness > Finance mapping decision support',53,true
)
on conflict(check_key) do update set
  check_group=excluded.check_group,check_title=excluded.check_title,severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,route_hint=excluded.route_hint,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,updated_at=now();

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values(
  'schema183_finance_account_mapping_decision_support','finance','Finance mapping decision support and compatibility guard',
  'active',90,9,10,
  'Verify live compatibility classifications, protected endpoint/UI behavior, database approval guard, browser acceptance and exact-main release evidence without changing human mapping decisions.',
  'Finance / I.T.',103,
  jsonb_build_object('schema',183,'build','2026-09-02o','human_decision_required',true,'auto_selection',false,'auto_approval',false,'posting_execution_release_enabled',false,'provider_mutation',false,'jobs_writeback',false,'production_promotion',false)
)
on conflict(rail_key) do update set
  rail_area=excluded.rail_area,rail_title=excluded.rail_title,rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,current_value=excluded.current_value,target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint,owner_hint=excluded.owner_hint,sort_order=excluded.sort_order,
  metadata=excluded.metadata,updated_at=now();

insert into public.app_schema_versions(
  schema_version,migration_key,schema_name,release_label,description,status,notes
) values(
  183,'183_finance_account_mapping_decision_support','183_finance_account_mapping_decision_support.sql','2026-09-02o',
  'Adds read-only chart-account decision support and a structural account-type guard on explicit human mapping approval.',
  'applied',
  'Does not auto-select/approve mappings, enable posting/provider execution, write Jobs state, change chart/tax policy, or promote Production.'
)
on conflict(schema_version) do update set
  migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,
  description=excluded.description,status=excluded.status,notes=excluded.notes,applied_at=now();

create or replace view public.v_schema_drift_status as
select 183::int as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=183 then 'current' else 'behind' end::text as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=183 then 'Live database is at or ahead of the repo schema marker.'
       else 'Live database is behind the deployed app. Apply migrations through schema 183 in order.' end::text as message,
  now() as checked_at
from public.app_schema_versions;

commit;
