-- 181_finance_account_mapping_observability.sql
-- Build 2026-09-02m
-- Read-only observability for the existing human-controlled Finance account mappings.
-- This migration does NOT choose or approve accounts, mutate canonical mapping decisions,
-- enable posting/provider execution, write Jobs state, or promote Production.

begin;

create or replace view public.v_finance_account_mapping_observability
with (security_invoker=true)
as
with latest_audit as (
  select distinct on (a.mapping_rule_id)
    a.mapping_rule_id,
    a.id as latest_audit_id,
    a.new_account_id as audited_account_id,
    a.new_review_status as audited_review_status,
    a.reviewed_by_profile_id as audited_by_profile_id,
    a.reviewed_at as audited_at
  from public.finance_account_mapping_review_audit a
  order by a.mapping_rule_id, a.reviewed_at desc, a.id desc
), generated_lifecycle as (
  select
    l.intake_id,
    l.tax_total,
    b.blocker_code
  from public.v_finance_job_completion_operational_lifecycle l
  left join lateral (
    select e->>'code' as blocker_code
    from jsonb_array_elements(
      case when jsonb_typeof(l.preflight_blockers)='array' then l.preflight_blockers else '[]'::jsonb end
    ) e
  ) b on true
  where l.candidate_generation_status='generated'
), preflight_counts as (
  select
    count(distinct intake_id)::int as generated_pair_sample_count,
    count(distinct intake_id) filter(where tax_total>0)::int as generated_tax_pair_sample_count,
    count(distinct intake_id) filter(where blocker_code='AR_ACCOUNT_MAPPING_NOT_APPROVED')::int as ar_blocker_count,
    count(distinct intake_id) filter(where blocker_code='REVENUE_ACCOUNT_MAPPING_NOT_APPROVED')::int as revenue_blocker_count,
    count(distinct intake_id) filter(where tax_total>0 and blocker_code='TAX_ACCOUNT_MAPPING_NOT_APPROVED')::int as tax_blocker_count
  from generated_lifecycle
), base as (
  select
    r.mapping_rule_id,
    r.mapping_key,
    r.source_key,
    r.target_label,
    r.account_id,
    r.account_number,
    r.account_name,
    r.account_type,
    r.system_code,
    r.account_is_active,
    r.review_status,
    r.reviewed_by_profile_id,
    r.reviewed_by_name,
    r.reviewed_at,
    r.is_required,
    r.mapping_is_active,
    r.mapping_approved,
    r.conditional_for_zero_tax,
    r.blocker_code as review_blocker_code,
    r.blocker_message as review_blocker_message,
    r.action_hint as review_action_hint,
    m.created_at as mapping_created_at,
    m.updated_at as mapping_updated_at,
    coa.updated_at as account_updated_at,
    a.latest_audit_id,
    a.audited_account_id,
    a.audited_review_status,
    a.audited_by_profile_id,
    a.audited_at,
    coalesce(r.reviewed_at,m.updated_at,m.created_at) as review_age_anchor,
    greatest(0,floor(extract(epoch from (now()-coalesce(r.reviewed_at,m.updated_at,m.created_at)))/86400))::int as review_age_days,
    case when r.mapping_key='sales_tax_payable' then p.generated_tax_pair_sample_count else p.generated_pair_sample_count end::int as preflight_sample_count,
    case r.mapping_key
      when 'accounts_receivable' then p.ar_blocker_count
      when 'service_revenue' then p.revenue_blocker_count
      when 'sales_tax_payable' then p.tax_blocker_count
      else 0
    end::int as preflight_mapping_blocker_count
  from public.v_finance_account_mapping_review_directory r
  join public.accountant_export_mapping_rules m on m.id=r.mapping_rule_id
  left join public.chart_of_accounts coa on coa.id=r.account_id
  left join latest_audit a on a.mapping_rule_id=r.mapping_rule_id
  cross join preflight_counts p
), classified as (
  select
    b.*,
    case
      when b.review_status='approved' and b.mapping_approved then 'REVIEW_COMPLETE'
      when b.review_status='rejected' then 'REVIEW_REJECTED'
      when b.review_status='retired' then 'REVIEW_RETIRED'
      when b.review_age_days>=30 then 'HUMAN_REVIEW_PENDING_STALE'
      when b.review_age_days>=7 then 'HUMAN_REVIEW_PENDING_AGING'
      else 'HUMAN_REVIEW_PENDING_RECENT'
    end::text as review_age_code,
    case
      when b.mapping_is_active is not true then 'MAPPING_INACTIVE'
      when b.account_id is null then 'ACCOUNT_SELECTION_REQUIRED'
      when b.account_is_active is not true then 'ACCOUNT_INACTIVE'
      when b.latest_audit_id is not null
        and (b.audited_account_id is distinct from b.account_id or b.audited_review_status is distinct from b.review_status)
        then 'REVIEW_AUDIT_STATE_DRIFT'
      when b.review_status='approved' and b.reviewed_at is null then 'APPROVED_WITHOUT_REVIEW_TIMESTAMP'
      when b.review_status='approved' and b.account_updated_at is not null and b.reviewed_at is not null and b.account_updated_at>b.reviewed_at
        then 'ACCOUNT_METADATA_CHANGED_AFTER_REVIEW'
      else 'NONE'
    end::text as drift_code,
    case
      when b.mapping_is_active is not true then true
      when b.account_is_active is not true and b.account_id is not null then true
      when b.latest_audit_id is not null
        and (b.audited_account_id is distinct from b.account_id or b.audited_review_status is distinct from b.review_status)
        then true
      when b.review_status='approved' and b.reviewed_at is null then true
      else false
    end as technical_drift,
    (b.review_status='approved' and b.account_updated_at is not null and b.reviewed_at is not null and b.account_updated_at>b.reviewed_at) as account_recheck_recommended,
    case
      when b.preflight_sample_count=0 then 'NO_GENERATED_PAIR_SAMPLE'
      when b.mapping_approved and b.preflight_mapping_blocker_count>0 then 'STALE_PREFLIGHT_MAPPING_BLOCKER'
      when not b.mapping_approved and b.preflight_mapping_blocker_count=0 then 'MISSING_PREFLIGHT_MAPPING_BLOCKER'
      else 'ALIGNED'
    end::text as preflight_reconciliation_code
  from base b
)
select
  c.*,
  (c.preflight_reconciliation_code in ('STALE_PREFLIGHT_MAPPING_BLOCKER','MISSING_PREFLIGHT_MAPPING_BLOCKER')) as preflight_reconciliation_issue,
  case
    when c.technical_drift then 'red'
    when c.preflight_reconciliation_code in ('STALE_PREFLIGHT_MAPPING_BLOCKER','MISSING_PREFLIGHT_MAPPING_BLOCKER') then 'red'
    when c.account_recheck_recommended then 'amber'
    when c.review_status<>'approved' or c.mapping_approved is not true then 'amber'
    else 'green'
  end::text as observability_status,
  case
    when c.technical_drift then 'Resolve the technical mapping/account drift before relying on posting preflight.'
    when c.preflight_reconciliation_code='STALE_PREFLIGHT_MAPPING_BLOCKER' then 'Investigate stale preflight mapping blockers; the canonical mapping is approved but generated-pair preflight still reports it blocked.'
    when c.preflight_reconciliation_code='MISSING_PREFLIGHT_MAPPING_BLOCKER' then 'Investigate missing preflight enforcement; generated-pair preflight did not block an unapproved canonical mapping.'
    when c.account_recheck_recommended then 'The linked chart account changed after human approval. Reconfirm the existing human decision; Build 181 does not change it.'
    when c.review_age_code='HUMAN_REVIEW_PENDING_STALE' then 'Human accountant/bookkeeper review has been pending at least 30 days. This is a human decision queue, not an I.T. migration failure.'
    when c.review_age_code='HUMAN_REVIEW_PENDING_AGING' then 'Human accountant/bookkeeper review has been pending at least 7 days.'
    when c.review_status='rejected' then 'A human rejected this mapping. Finance manage must decide whether to select/review another account.'
    when c.preflight_reconciliation_code='NO_GENERATED_PAIR_SAMPLE' then 'No generated completion pair currently exercises this mapping, so preflight alignment has no live sample.'
    else 'Mapping observability is aligned with the canonical human review and posting-preflight authorities.'
  end::text as observability_action_hint,
  now() as checked_at
from classified c;

revoke all on table public.v_finance_account_mapping_observability from public,anon,authenticated;
grant select on table public.v_finance_account_mapping_observability to service_role;

create or replace view public.v_it_finance_account_mapping_observability_status
with (security_invoker=true)
as
with s as (
  select
    count(*)::int as mapping_count,
    count(*) filter(where mapping_approved)::int as approved_count,
    count(*) filter(where not mapping_approved)::int as pending_count,
    count(*) filter(where review_age_code='HUMAN_REVIEW_PENDING_STALE')::int as stale_review_count,
    count(*) filter(where review_age_code='HUMAN_REVIEW_PENDING_AGING')::int as aging_review_count,
    count(*) filter(where review_status='rejected')::int as rejected_count,
    count(*) filter(where technical_drift)::int as technical_drift_count,
    count(*) filter(where account_recheck_recommended)::int as account_recheck_count,
    count(*) filter(where preflight_reconciliation_issue)::int as preflight_reconciliation_issue_count,
    count(*) filter(where preflight_reconciliation_code='NO_GENERATED_PAIR_SAMPLE')::int as no_generated_pair_sample_count
  from public.v_finance_account_mapping_observability
), controls as (
  select
    coalesce(bool_or(execution_enabled),false) as execution_release_enabled,
    coalesce(bool_or(provider_mutation_enabled),false) as provider_mutation_enabled
  from public.finance_job_completion_posting_execution_controls
  where control_key='finance_job_completion_v1'
), release as (
  select release_authority_status,source_gate_status,schema_status,release_schema_version
  from public.v_it_release_authority_status
  limit 1
)
select
  s.*,
  c.execution_release_enabled,
  c.provider_mutation_enabled,
  r.release_authority_status,
  r.source_gate_status,
  r.schema_status,
  r.release_schema_version,
  case
    when s.mapping_count<>3 or s.technical_drift_count>0 or s.preflight_reconciliation_issue_count>0
      or c.execution_release_enabled or c.provider_mutation_enabled then 'red'
    when s.pending_count>0 or s.stale_review_count>0 or s.aging_review_count>0 or s.rejected_count>0 or s.account_recheck_count>0 then 'amber'
    else 'green'
  end::text as mapping_observability_status,
  case
    when s.mapping_count<>3 then 'The canonical Schema 176 posting mapping set is incomplete.'
    when s.technical_drift_count>0 then 'True technical drift exists between canonical mapping/review/account state.'
    when s.preflight_reconciliation_issue_count>0 then 'Mapping readiness and generated-pair posting preflight disagree.'
    when c.execution_release_enabled then 'Posting execution release is unexpectedly enabled for this bounded observability release.'
    when c.provider_mutation_enabled then 'Provider/payment mutation is unexpectedly enabled.'
    when s.stale_review_count>0 then 'Human accountant/bookkeeper review is stale/pending; this is an accounting decision queue, not an I.T. migration failure.'
    when s.pending_count>0 then 'Human accountant/bookkeeper review remains pending.'
    when s.account_recheck_count>0 then 'At least one approved mapping should be rechecked because its chart-account metadata changed after review.'
    else 'Mapping aging, drift and posting-preflight reconciliation are aligned.'
  end::text as observability_message,
  now() as checked_at
from s cross join controls c cross join release r;

revoke all on table public.v_it_finance_account_mapping_observability_status from public,anon,authenticated;
grant select on table public.v_it_finance_account_mapping_observability_status to service_role;

create or replace function public.ywi_finance_account_mapping_observability_assertions()
returns table(assertion_key text,assertion_status text,details text)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select 'finance_mapping_observability_three_canonical_keys',
    case when (select count(*) from public.v_finance_account_mapping_observability)=3 then 'passed' else 'failed' end,
    'Observability covers exactly the three canonical posting mappings.'
  union all
  select 'finance_mapping_observability_surfaces_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public' and table_name in ('v_finance_account_mapping_observability','v_it_finance_account_mapping_observability_status')
        and grantee in ('PUBLIC','anon','authenticated')
    ) then 'passed' else 'failed' end,
    'Build 181 observability views are private service-owned surfaces.'
  union all
  select 'finance_mapping_observability_canonical_identity_consistent',
    case when not exists(
      select 1
      from public.v_finance_account_mapping_observability o
      join public.v_finance_posting_account_mapping_authority p using(mapping_key)
      where o.account_id is distinct from p.account_id
         or o.review_status is distinct from p.review_status
         or o.mapping_approved is distinct from p.mapping_approved
    ) then 'passed' else 'failed' end,
    'Observability does not create a parallel mapping authority.'
  union all
  select 'finance_mapping_observability_no_technical_drift',
    case when not exists(select 1 from public.v_finance_account_mapping_observability where technical_drift) then 'passed' else 'failed' end,
    'No true technical mapping/account/audit-state drift is present.'
  union all
  select 'finance_mapping_observability_preflight_reconciled',
    case when not exists(select 1 from public.v_finance_account_mapping_observability where preflight_reconciliation_issue) then 'passed' else 'failed' end,
    'Generated-pair posting preflight and canonical mapping approval state do not contradict each other.'
  union all
  select 'finance_mapping_observability_execution_release_off',
    case when not exists(select 1 from public.finance_job_completion_posting_execution_controls where execution_enabled is true) then 'passed' else 'failed' end,
    'Build 181 does not enable Finance posting execution.'
  union all
  select 'finance_mapping_observability_provider_mutation_off',
    case when not exists(select 1 from public.finance_job_completion_posting_execution_controls where provider_mutation_enabled is true) then 'passed' else 'failed' end,
    'Build 181 does not enable provider/payment mutation.'
  union all
  select 'finance_mapping_observability_prior_schema180_green',
    case when not exists(select 1 from public.ywi_finance_account_mapping_review_assertions() where assertion_status<>'passed') then 'passed' else 'failed' end,
    'Schema 180 human mapping review assertions remain green.';
$$;

revoke all on function public.ywi_finance_account_mapping_observability_assertions() from public,anon,authenticated;
grant execute on function public.ywi_finance_account_mapping_observability_assertions() to service_role;

insert into public.app_schema_dependency_contracts(
  contract_key,relation_schema,relation_name,column_name,expected_data_type,owner_module,
  introduced_by_schema,required_by_schema,is_required,notes
) values
  ('finance_mapping_observability_mapping_updated_at','public','accountant_export_mapping_rules','updated_at','timestamp with time zone','finance',153,181,true,'Build 181 human-review aging anchor.'),
  ('finance_mapping_observability_account_updated_at','public','chart_of_accounts','updated_at','timestamp with time zone','finance',30,181,true,'Build 181 post-review chart-account drift signal.'),
  ('finance_mapping_observability_audit_reviewed_at','public','finance_account_mapping_review_audit','reviewed_at','timestamp with time zone','finance',180,181,true,'Build 181 immutable human-review evidence timestamp.')
on conflict(contract_key) do update set
  relation_schema=excluded.relation_schema,relation_name=excluded.relation_name,column_name=excluded.column_name,
  expected_data_type=excluded.expected_data_type,owner_module=excluded.owner_module,
  introduced_by_schema=excluded.introduced_by_schema,required_by_schema=excluded.required_by_schema,
  is_required=excluded.is_required,notes=excluded.notes,updated_at=now();

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values(
  'finance_account_mapping_observability','Finance','Finance mapping aging, drift and preflight reconciliation','warning',
  'Distinguish human review backlog from true mapping/account/preflight drift. Do not approve mappings or enable execution merely to clear I.T. readiness.',
  'Admin > I.T. Readiness > Finance mapping observability',51,true
)
on conflict(check_key) do update set
  check_group=excluded.check_group,check_title=excluded.check_title,severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,route_hint=excluded.route_hint,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,updated_at=now();

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values(
  'schema181_finance_account_mapping_observability','finance','Finance mapping aging, drift and reconciliation observability',
  'active',90,9,10,
  'Verify Schema 181 live aging/drift/preflight alignment, protected runtime exposure, browser acceptance and exact-main release evidence; keep all human mapping decisions unchanged.',
  'Finance / I.T.',101,
  jsonb_build_object('schema',181,'build','2026-09-02m','read_only_observability',true,'mapping_auto_approval',false,'posting_execution_release_enabled',false,'provider_mutation',false,'jobs_writeback',false,'production_promotion',false)
)
on conflict(rail_key) do update set
  rail_area=excluded.rail_area,rail_title=excluded.rail_title,rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,current_value=excluded.current_value,target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint,owner_hint=excluded.owner_hint,sort_order=excluded.sort_order,
  metadata=excluded.metadata,updated_at=now();

insert into public.app_schema_versions(
  schema_version,migration_key,schema_name,release_label,description,status,notes
) values(
  181,'181_finance_account_mapping_observability','181_finance_account_mapping_observability.sql','2026-09-02m',
  'Adds read-only Finance account-mapping aging, drift and posting-preflight reconciliation observability.',
  'applied',
  'Does not modify mapping account IDs/review decisions, add a mutation authority, enable posting/provider execution, write Jobs state, or promote Production.'
)
on conflict(schema_version) do update set
  migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,
  description=excluded.description,status=excluded.status,notes=excluded.notes;

commit;
