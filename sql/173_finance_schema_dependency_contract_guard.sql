-- 173_finance_schema_dependency_contract_guard.sql
-- Build 2026-09-02e
-- Converts the Schema 172 live-compatibility lesson into a reusable I.T. dependency contract.
-- No business events are consumed and no invoice/journal/payment/provider state is created here.

begin;

create table if not exists public.app_schema_dependency_contracts (
  contract_key text primary key,
  relation_schema text not null default 'public',
  relation_name text not null,
  column_name text not null,
  expected_data_type text not null,
  owner_module text not null,
  introduced_by_schema integer not null,
  required_by_schema integer not null,
  is_required boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_schema_dependency_contracts_owner_chk
    check (owner_module in ('safety','finance','jobs','admin','core')),
  constraint app_schema_dependency_contracts_schema_order_chk
    check (required_by_schema >= introduced_by_schema),
  constraint app_schema_dependency_contracts_relation_column_uidx
    unique(relation_schema,relation_name,column_name,required_by_schema)
);

alter table public.app_schema_dependency_contracts enable row level security;
revoke all on table public.app_schema_dependency_contracts from public,anon,authenticated;
grant select on table public.app_schema_dependency_contracts to service_role;

insert into public.app_schema_dependency_contracts(
  contract_key,relation_schema,relation_name,column_name,expected_data_type,owner_module,
  introduced_by_schema,required_by_schema,is_required,notes
) values
  ('finance_intake_id','public','finance_job_completion_intake','id','uuid','finance',169,172,true,'Canonical Finance intake identity.'),
  ('finance_intake_source_event_id','public','finance_job_completion_intake','source_event_id','bigint','finance',169,172,true,'Canonical jobs.job_completed source event.'),
  ('finance_intake_job_id','public','finance_job_completion_intake','job_id','bigint','finance',169,172,true,'Canonical Jobs identity reference.'),
  ('finance_intake_completion_review_id','public','finance_job_completion_intake','completion_review_id','uuid','finance',169,172,true,'Canonical completion review reference.'),
  ('finance_intake_queue_event_id','public','finance_job_completion_intake','finance_queue_event_id','uuid','finance',169,172,true,'Finance accounting review queue event.'),
  ('finance_intake_status','public','finance_job_completion_intake','intake_status','text','finance',169,172,true,'Finance intake lifecycle state.'),
  ('finance_intake_source_occurred_at','public','finance_job_completion_intake','source_occurred_at','timestamp with time zone','finance',169,172,true,'Canonical source event timestamp.'),
  ('finance_intake_source_payload','public','finance_job_completion_intake','source_payload','jsonb','finance',169,172,true,'Server-owned source event payload.'),
  ('finance_intake_first_seen_at','public','finance_job_completion_intake','first_seen_at','timestamp with time zone','finance',169,172,true,'Canonical Finance queue/first-seen timestamp. Schema 172 must use this instead of a nonexistent created_at.'),
  ('finance_intake_updated_at','public','finance_job_completion_intake','updated_at','timestamp with time zone','finance',169,172,true,'Finance intake mutation timestamp.'),
  ('completion_review_work_order','public','job_completion_reviews','work_order_id','bigint','jobs',168,172,true,'Canonical work order backing Finance candidate generation.'),
  ('completion_review_accounting_ready','public','job_completion_reviews','accounting_ready','boolean','jobs',168,172,true,'Server-derived accounting readiness.'),
  ('completion_review_revenue_total','public','job_completion_reviews','revenue_total','numeric','jobs',168,172,true,'Documentary revenue total.'),
  ('completion_review_cost_total','public','job_completion_reviews','cost_total','numeric','jobs',168,172,true,'Documentary cost total.'),
  ('completion_review_profit_total','public','job_completion_reviews','profit_total','numeric','jobs',168,172,true,'Documentary profit total.'),
  ('work_order_subtotal','public','work_orders','subtotal','numeric','jobs',1,172,true,'Canonical invoice subtotal source.'),
  ('work_order_tax_total','public','work_orders','tax_total','numeric','jobs',1,172,true,'Canonical invoice tax source.'),
  ('work_order_total_amount','public','work_orders','total_amount','numeric','jobs',1,172,true,'Canonical invoice total source.'),
  ('invoice_candidate_payload','public','job_invoice_candidates','payload','jsonb','finance',1,172,true,'Finance authority and idempotency markers.'),
  ('journal_candidate_payload','public','job_journal_candidates','payload','jsonb','finance',1,172,true,'Finance authority and idempotency markers.'),
  ('journal_candidate_ledger_summary','public','job_journal_candidates','ledger_summary','jsonb','finance',1,172,true,'Documentary totals only; no GL account truth asserted.'),
  ('accounting_event_created_at','public','job_completion_accounting_events','created_at','timestamp with time zone','finance',1,172,true,'Accounting queue age/observability timestamp.')
on conflict(contract_key) do update set
  relation_schema=excluded.relation_schema,
  relation_name=excluded.relation_name,
  column_name=excluded.column_name,
  expected_data_type=excluded.expected_data_type,
  owner_module=excluded.owner_module,
  introduced_by_schema=excluded.introduced_by_schema,
  required_by_schema=excluded.required_by_schema,
  is_required=excluded.is_required,
  notes=excluded.notes,
  updated_at=now();

create or replace view public.v_it_schema_dependency_status
with (security_invoker=true)
as
select
  c.contract_key,
  c.owner_module,
  c.relation_schema,
  c.relation_name,
  c.column_name,
  c.expected_data_type,
  cols.data_type as live_data_type,
  c.introduced_by_schema,
  c.required_by_schema,
  c.is_required,
  case
    when cols.column_name is null then 'missing'
    when lower(cols.data_type) <> lower(c.expected_data_type) then 'type_mismatch'
    else 'passed'
  end::text as check_status,
  case
    when cols.column_name is null then format('Missing required column %I.%I.%I.',c.relation_schema,c.relation_name,c.column_name)
    when lower(cols.data_type) <> lower(c.expected_data_type) then format('Column %I.%I.%I is %s; expected %s.',c.relation_schema,c.relation_name,c.column_name,cols.data_type,c.expected_data_type)
    else format('Column %I.%I.%I matches %s.',c.relation_schema,c.relation_name,c.column_name,c.expected_data_type)
  end::text as details,
  c.notes,
  now() as checked_at
from public.app_schema_dependency_contracts c
left join information_schema.columns cols
  on cols.table_schema=c.relation_schema
 and cols.table_name=c.relation_name
 and cols.column_name=c.column_name
where c.is_required=true;

revoke all on table public.v_it_schema_dependency_status from public,anon,authenticated;
grant select on table public.v_it_schema_dependency_status to service_role;

create or replace function public.ywi_schema_dependency_assertions()
returns table(assertion_key text,assertion_status text,details text)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select
    'schema_dependency_contract:'||contract_key,
    case when check_status='passed' then 'passed' else 'failed' end,
    details
  from public.v_it_schema_dependency_status
  union all
  select
    'schema173_finance_intake_contract_complete',
    case when count(*)=10 and count(*) filter(where check_status='passed')=10 then 'passed' else 'failed' end,
    format('Finance intake dependency contract: %s/10 required columns match.',count(*) filter(where check_status='passed'))
  from public.v_it_schema_dependency_status
  where relation_schema='public' and relation_name='finance_job_completion_intake'
  union all
  select
    'schema173_schema172_first_seen_runtime',
    case when
      pg_get_functiondef('public.ywi_guard_finance_completion_invoice_candidate()'::regprocedure) ilike '%order by first_seen_at desc%'
      and pg_get_functiondef('public.ywi_guard_finance_completion_journal_candidate()'::regprocedure) ilike '%order by first_seen_at desc%'
      and pg_get_viewdef('public.v_finance_job_completion_review_queue'::regclass,true) ilike '%first_seen_at%'
      and pg_get_viewdef('public.v_finance_job_completion_review_status'::regclass,true) ilike '%first_seen_at%'
      then 'passed' else 'failed' end,
    'Schema 172 runtime objects use the canonical Schema 169 first_seen_at intake timestamp.'
  union all
  select
    'schema173_dependency_control_plane_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('app_schema_dependency_contracts','v_it_schema_dependency_status')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Schema dependency contracts and live status remain a private service-role I.T. control plane.';
$$;

revoke all on function public.ywi_schema_dependency_assertions() from public,anon,authenticated;
grant execute on function public.ywi_schema_dependency_assertions() to service_role;

-- Make the new live dependency proof visible in the existing Admin > I.T. schema-preflight panel.
create or replace view public.v_admin_schema_preflight_checks
with (security_invoker=true)
as
select
  p.check_key,p.check_area,p.required_object_type,p.required_object_name,p.expected_status,
  p.live_status,p.check_status,p.operator_hint,p.failure_hint,p.sort_order,p.checked_at,p.updated_at
from public.admin_schema_preflight_checks p
union all
select
  'schema173_finance_dependency_contract'::text as check_key,
  'Architecture'::text as check_area,
  'column_contract'::text as required_object_type,
  'public.finance_job_completion_intake'::text as required_object_name,
  'all_required_columns_match'::text as expected_status,
  case when count(*) filter(where check_status<>'passed')=0 then 'present' else 'mismatch' end::text as live_status,
  case when count(*) filter(where check_status<>'passed')=0 then 'passed' else 'failed' end::text as check_status,
  'Schema 172+ Finance releases must resolve every registered dependency before release.'::text as operator_hint,
  'Do not apply dependent Finance migrations when any registered relation/column/type contract is missing.'::text as failure_hint,
  145::int as sort_order,
  now() as checked_at,
  now() as updated_at
from public.v_it_schema_dependency_status
where required_by_schema<=173
order by sort_order,check_area,required_object_name;

revoke all on table public.v_admin_schema_preflight_checks from public,anon,authenticated;
grant select on table public.v_admin_schema_preflight_checks to service_role;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values(
  'finance_schema_dependency_contracts','Architecture','Finance schema dependency contracts match live database','critical',
  'Resolve every required relation/column/type contract before applying a dependent Finance migration. Never substitute guessed column names.',
  'Admin > I.T. Readiness',39,true
)
on conflict(check_key) do update set
  check_group=excluded.check_group,check_title=excluded.check_title,severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,route_hint=excluded.route_hint,sort_order=excluded.sort_order,
  is_enabled=excluded.is_enabled,updated_at=now();

update public.admin_scorecard_progress_rails
set rail_status='complete',progress_percent=100,current_value=9,target_value=9,
  next_action_hint='Schema 172 Finance review/candidate authority is live-converged on the canonical first_seen_at intake contract.',
  updated_at=now()
where rail_key='schema172_finance_review_disposition';

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values(
  'schema173_finance_schema_dependency_guard','architecture','Finance live schema dependency contract guard','complete',100,4,4,
  'Require dependency-contract proof before every future Finance migration that consumes another schema-owned relation.',
  'Finance / I.T. / Architecture',93,
  '{"build":"2026-09-02e","schema":173,"dependency_registry":true,"live_column_type_proof":true,"schema172_repair":"first_seen_at","business_mutation":false,"production_promotion":false}'::jsonb
)
on conflict(rail_key) do update set
  rail_area=excluded.rail_area,rail_title=excluded.rail_title,rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,current_value=excluded.current_value,target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint,owner_hint=excluded.owner_hint,sort_order=excluded.sort_order,
  metadata=excluded.metadata,updated_at=now();

insert into public.app_schema_versions(
  schema_version,migration_key,schema_name,release_label,description,status,notes
) values(
  173,'173_finance_schema_dependency_contract_guard','173_finance_schema_dependency_contract_guard.sql','2026-09-02e',
  'Adds a reusable private schema dependency contract and live column/type proof after the Schema 172 Finance intake timestamp convergence repair.',
  'applied',
  'No business event consumption, invoice/journal posting, payment/provider mutation, Jobs writeback, fifth module or Production promotion is introduced.'
)
on conflict(schema_version) do update set
  migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,
  description=excluded.description,status=excluded.status,notes=excluded.notes,applied_at=now();

create or replace view public.v_schema_drift_status as
select 173::int as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=173 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=173
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 173 in order.' end as message,
  now() as checked_at
from public.app_schema_versions;

commit;
