-- 180_finance_account_mapping_review_workflow.sql
-- Build 2026-09-02l
-- Adds a protected human-controlled review workflow around the existing
-- accountant_export_mapping_rules -> chart_of_accounts authority.
-- IMPORTANT: this migration does NOT change any live mapping account_id or review_status,
-- does NOT enable posting execution/provider mutation, and does NOT write Jobs state.

begin;

create table if not exists public.finance_account_mapping_review_audit (
  id uuid primary key default gen_random_uuid(),
  mapping_rule_id uuid not null references public.accountant_export_mapping_rules(id) on delete restrict,
  mapping_key text not null,
  prior_account_id uuid references public.chart_of_accounts(id) on delete restrict,
  new_account_id uuid references public.chart_of_accounts(id) on delete restrict,
  prior_review_status text not null,
  new_review_status text not null,
  review_reason text not null,
  reviewed_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  check (mapping_key in ('accounts_receivable','service_revenue','sales_tax_payable')),
  check (prior_review_status in ('draft','review','approved','rejected','retired')),
  check (new_review_status in ('review','approved','rejected')),
  check (length(trim(review_reason)) >= 5)
);

create index if not exists finance_account_mapping_review_audit_lookup_idx
  on public.finance_account_mapping_review_audit(mapping_key, reviewed_at desc);

alter table public.finance_account_mapping_review_audit enable row level security;
revoke all on table public.finance_account_mapping_review_audit from public,anon,authenticated;
grant select on table public.finance_account_mapping_review_audit to service_role;

create or replace function public.ywi_finance_account_mapping_audit_immutable()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  raise exception 'Finance account mapping review audit is immutable.' using errcode='55000';
end;
$$;

revoke all on function public.ywi_finance_account_mapping_audit_immutable() from public,anon,authenticated;

DROP TRIGGER IF EXISTS trg_finance_account_mapping_review_audit_immutable ON public.finance_account_mapping_review_audit;
create trigger trg_finance_account_mapping_review_audit_immutable
before update or delete on public.finance_account_mapping_review_audit
for each row execute function public.ywi_finance_account_mapping_audit_immutable();

create or replace view public.v_finance_account_mapping_review_directory
with (security_invoker=true)
as
select
  r.id as mapping_rule_id,
  r.mapping_key,
  r.source_key,
  r.target_label,
  r.account_id,
  a.account_number,
  a.account_name,
  a.account_type,
  a.system_code,
  coalesce(a.is_active,false) as account_is_active,
  r.review_status,
  r.reviewed_by_profile_id,
  p.full_name as reviewed_by_name,
  r.reviewed_at,
  r.notes,
  r.is_required,
  r.is_active as mapping_is_active,
  case when r.mapping_key='sales_tax_payable' then true else false end as conditional_for_zero_tax,
  (r.is_active and r.review_status='approved' and r.account_id is not null and coalesce(a.is_active,false)) as mapping_approved,
  case
    when r.is_active is not true then 'MAPPING_INACTIVE'
    when r.account_id is null then 'ACCOUNT_SELECTION_REQUIRED'
    when coalesce(a.is_active,false) is not true then 'ACCOUNT_INACTIVE'
    when r.review_status='approved' then 'READY'
    when r.review_status='rejected' then 'ACCOUNT_MAPPING_REJECTED'
    else 'ACCOUNTANT_REVIEW_REQUIRED'
  end::text as blocker_code,
  case
    when r.is_active is not true then 'This canonical mapping rule is inactive; review accounting configuration before use.'
    when r.account_id is null then 'A Finance manager/accountant must select an active chart account before this mapping can be approved.'
    when coalesce(a.is_active,false) is not true then 'The selected chart account is inactive or missing; select an active account before approval.'
    when r.review_status='approved' then 'Human mapping review is complete.'
    when r.review_status='rejected' then 'The selected mapping was rejected; select/review an appropriate chart account.'
    else 'A Finance manager/accountant must explicitly approve or reject this mapping with a reason.'
  end::text as blocker_message,
  case
    when r.review_status='approved' and r.account_id is not null and coalesce(a.is_active,false) then 'No mapping action is required.'
    when r.mapping_key='sales_tax_payable' then 'Review this conditional mapping before any invoice with non-zero tax can be posted.'
    else 'Open Finance mapping review and complete the human account/review decision.'
  end::text as action_hint
from public.accountant_export_mapping_rules r
left join public.chart_of_accounts a on a.id=r.account_id
left join public.profiles p on p.id=r.reviewed_by_profile_id
where r.mapping_type='account'
  and r.mapping_key in ('accounts_receivable','service_revenue','sales_tax_payable');

revoke all on table public.v_finance_account_mapping_review_directory from public,anon,authenticated;
grant select on table public.v_finance_account_mapping_review_directory to service_role;

create or replace view public.v_it_finance_account_mapping_review_status
with (security_invoker=true)
as
with mapping_status as (
  select
    count(*)::int as mapping_count,
    count(*) filter(where mapping_approved)::int as approved_count,
    count(*) filter(where not mapping_approved)::int as pending_count,
    count(*) filter(where blocker_code='ACCOUNT_SELECTION_REQUIRED')::int as missing_account_count,
    count(*) filter(where blocker_code='ACCOUNT_INACTIVE')::int as inactive_account_count,
    count(*) filter(where review_status='rejected')::int as rejected_count
  from public.v_finance_account_mapping_review_directory
), audit_status as (
  select count(*)::int as audit_event_count, max(reviewed_at) as latest_review_at
  from public.finance_account_mapping_review_audit
), controls as (
  select coalesce(bool_or(execution_enabled),false) as execution_release_enabled,
         coalesce(bool_or(provider_mutation_enabled),false) as provider_mutation_enabled
  from public.finance_job_completion_posting_execution_controls
  where control_key='finance_job_completion_v1'
)
select
  m.mapping_count,m.approved_count,m.pending_count,m.missing_account_count,m.inactive_account_count,m.rejected_count,
  a.audit_event_count,a.latest_review_at,
  c.execution_release_enabled,c.provider_mutation_enabled,
  case
    when m.mapping_count<>3 or m.inactive_account_count>0 or c.provider_mutation_enabled then 'red'
    when m.pending_count>0 or m.missing_account_count>0 then 'amber'
    else 'green'
  end::text as mapping_readiness_status,
  case
    when m.mapping_count<>3 then 'The three Schema 176 posting mapping authorities are not all present.'
    when m.inactive_account_count>0 then 'At least one posting mapping points to an inactive/missing chart account.'
    when m.pending_count>0 then 'Human accountant/bookkeeper mapping review is still required; this is not an I.T. migration failure.'
    else 'All posting account mappings have explicit human approval.'
  end::text as readiness_message,
  now() as checked_at
from mapping_status m cross join audit_status a cross join controls c;

revoke all on table public.v_it_finance_account_mapping_review_status from public,anon,authenticated;
grant select on table public.v_it_finance_account_mapping_review_status to service_role;

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

  v_new_account_id := coalesce(p_account_id,v_rule.account_id);
  if v_new_account_id is not null then
    select is_active into v_account_active from public.chart_of_accounts where id=v_new_account_id;
    if coalesce(v_account_active,false) is not true then
      raise exception 'Selected chart account must exist and be active.' using errcode='23514';
    end if;
  end if;
  if v_new_status='approved' and v_new_account_id is null then
    raise exception 'Approved mapping requires an active chart account.' using errcode='23514';
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
    jsonb_build_object('authority','schema180_finance_account_mapping_review','posting_execution_released',false,'provider_mutation',false)
  ) returning id into v_audit_id;

  return query
  select r.mapping_key,r.account_id,r.review_status,r.reviewed_by_profile_id,r.reviewed_at,v_audit_id
  from public.accountant_export_mapping_rules r where r.id=v_rule.id;
end;
$$;

revoke all on function public.ywi_finance_review_account_mapping(text,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.ywi_finance_review_account_mapping(text,uuid,text,text,uuid) to service_role;

create or replace function public.ywi_finance_account_mapping_review_assertions()
returns table(assertion_key text,assertion_status text,details text)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select 'finance_mapping_three_canonical_keys',
    case when (select count(*) from public.v_finance_account_mapping_review_directory)=3 then 'passed' else 'failed' end,
    'Schema 180 review directory contains exactly AR, service revenue and sales-tax payable mappings.'
  union all
  select 'finance_mapping_review_rpc_service_only',
    case when not exists(
      select 1 from information_schema.routine_privileges
      where routine_schema='public' and routine_name='ywi_finance_review_account_mapping'
        and grantee in ('PUBLIC','anon','authenticated') and privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
    'Mapping review mutation is reachable only through service-role protected server authority.'
  union all
  select 'finance_mapping_audit_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public' and table_name='finance_account_mapping_review_audit'
        and grantee in ('PUBLIC','anon','authenticated')
    ) then 'passed' else 'failed' end,
    'Mapping review audit is private to service-owned control paths.'
  union all
  select 'finance_mapping_audit_immutable',
    case when exists(
      select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname='finance_account_mapping_review_audit'
        and t.tgname='trg_finance_account_mapping_review_audit_immutable' and not t.tgisinternal
    ) then 'passed' else 'failed' end,
    'Audit history has an immutable update/delete guard.'
  union all
  select 'finance_mapping_accounts_resolve_when_selected',
    case when not exists(
      select 1 from public.v_finance_account_mapping_review_directory
      where account_id is not null and account_is_active is not true
    ) then 'passed' else 'failed' end,
    'Selected posting mapping accounts resolve to active chart accounts.'
  union all
  select 'finance_mapping_execution_release_still_off',
    case when not exists(select 1 from public.finance_job_completion_posting_execution_controls where execution_enabled is true)
      then 'passed' else 'failed' end,
    'Build 180 does not release Finance posting execution.'
  union all
  select 'finance_mapping_provider_mutation_still_off',
    case when not exists(select 1 from public.finance_job_completion_posting_execution_controls where provider_mutation_enabled is true)
      then 'passed' else 'failed' end,
    'Build 180 does not enable provider/payment mutation.'
  union all
  select 'finance_mapping_prior_release_chain_green',
    case when not exists(select 1 from public.ywi_finance_release_hardening_assertions() where assertion_status<>'passed')
      then 'passed' else 'failed' end,
    'Schema 179 release-hardening assertions remain green.';
$$;

revoke all on function public.ywi_finance_account_mapping_review_assertions() from public,anon,authenticated;
grant execute on function public.ywi_finance_account_mapping_review_assertions() to service_role;

update public.app_module_contracts
set entry_scripts='["/js/finance-ui.js","/js/finance-account-mapping-ui.js"]'::jsonb,
    notes='Finance lifecycle plus human-controlled accountant mapping review; both remain permission-driven and server-authorized.',
    updated_at=now()
where module_key='finance';

insert into public.app_schema_dependency_contracts(
  contract_key,relation_schema,relation_name,column_name,expected_data_type,owner_module,
  introduced_by_schema,required_by_schema,is_required,notes
) values
  ('finance_mapping_rule_account_id','public','accountant_export_mapping_rules','account_id','uuid','finance',153,180,true,'Schema 180 canonical chart-account mapping reference.'),
  ('finance_mapping_rule_review_status','public','accountant_export_mapping_rules','review_status','text','finance',153,180,true,'Schema 180 human review status authority.'),
  ('finance_mapping_chart_account_active','public','chart_of_accounts','is_active','boolean','finance',30,180,true,'Schema 180 validates selected chart accounts are active.')
on conflict(contract_key) do update set
  relation_schema=excluded.relation_schema,relation_name=excluded.relation_name,column_name=excluded.column_name,
  expected_data_type=excluded.expected_data_type,owner_module=excluded.owner_module,
  introduced_by_schema=excluded.introduced_by_schema,required_by_schema=excluded.required_by_schema,
  is_required=excluded.is_required,notes=excluded.notes,updated_at=now();

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values(
  'finance_account_mapping_review','Finance','Finance accountant mapping review readiness','warning',
  'Complete the human mapping review in Finance. Do not enable posting execution merely to clear this readiness item.',
  'Finance > Accountant mapping review',50,true
)
on conflict(check_key) do update set
  check_group=excluded.check_group,check_title=excluded.check_title,severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,route_hint=excluded.route_hint,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,updated_at=now();

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values(
  'schema180_finance_account_mapping_review','finance','Finance accountant mapping readiness and review workflow','active',90,9,10,
  'Pass source/browser gates, apply Schema 180 without changing live mapping decisions, align protected mapping/I.T. functions, record exact-main evidence, then close the rail.',
  'Finance / Accountant / I.T.',100,
  '{"build":"2026-09-02l","schema":180,"human_mapping_review":true,"mapping_auto_approval":false,"posting_execution_release_enabled":false,"jobs_writeback":false,"provider_mutation":false,"production_promotion":false}'::jsonb
)
on conflict(rail_key) do update set
  rail_area=excluded.rail_area,rail_title=excluded.rail_title,rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,current_value=excluded.current_value,target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint,owner_hint=excluded.owner_hint,sort_order=excluded.sort_order,
  metadata=excluded.metadata,updated_at=now();

insert into public.app_schema_versions(
  schema_version,migration_key,schema_name,release_label,description,status,notes
) values(
  180,'180_finance_account_mapping_review_workflow','180_finance_account_mapping_review_workflow.sql','2026-09-02l',
  'Adds protected human accountant mapping review, immutable review audit, mapping readiness and Finance module lazy-loaded mapping UI contract.',
  'applied',
  'Migration does not modify existing mapping account IDs/review decisions. Posting execution/provider mutation remain OFF; Jobs writeback and Production promotion remain excluded.'
)
on conflict(schema_version) do update set
  migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,
  description=excluded.description,status=excluded.status,notes=excluded.notes,applied_at=now();

create or replace view public.v_schema_drift_status as
select 180::int as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=180 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=180
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 180 in order.' end as message,
  now() as checked_at
from public.app_schema_versions;

commit;
