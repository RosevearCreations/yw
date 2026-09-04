begin;

-- Build 197 closes a technical safety gap in staging acceptance only.
-- It does not run staging acceptance, close any human/business rail,
-- enable Finance/provider mutation, or authorize Production promotion.

create table if not exists public.it_runtime_environment_authorities (
  project_ref text primary key,
  environment_class text not null check(environment_class in ('production','staging','development','preview')),
  staging_acceptance_mutation_allowed boolean not null default false,
  authority_note text not null default '',
  updated_at timestamptz not null default now(),
  constraint it_runtime_environment_authorities_project_ref_format
    check(project_ref ~ '^[a-z0-9-]{8,80}$')
);

alter table public.it_runtime_environment_authorities enable row level security;
revoke all on table public.it_runtime_environment_authorities from public,anon,authenticated;
grant select on table public.it_runtime_environment_authorities to service_role;

insert into public.it_runtime_environment_authorities(
  project_ref,environment_class,staging_acceptance_mutation_allowed,authority_note
)
values(
  'jmqvkgiqlimdhcofwkxr','production',false,
  'Primary Yard Weasels Production Supabase project. Staging-acceptance evidence mutation is permanently denied by runtime guard authority.'
)
on conflict(project_ref) do update set
  environment_class='production',
  staging_acceptance_mutation_allowed=false,
  authority_note=excluded.authority_note,
  updated_at=now();

create or replace function public.ywi_staging_environment_guard_assertions()
returns table(assertion_key text, assertion_status text, assertion_detail text)
language sql security definer set search_path=public,pg_temp as $$
  select 'production_project_registered_fail_closed',
    case when exists(
      select 1 from public.it_runtime_environment_authorities
      where project_ref='jmqvkgiqlimdhcofwkxr'
        and environment_class='production'
        and staging_acceptance_mutation_allowed=false
    ) then 'passed' else 'failed' end,
    'The known Production project is registered with staging-acceptance mutation denied.'
  union all select 'open_business_acceptance_unchanged',
    case when (select count(*) from public.v_it_open_rail_acceptance_readiness where rail_status<>'complete')=11 then 'passed' else 'failed' end,
    'All 11 human/provider/accounting/content/staging acceptance rails remain open.'
  union all select 'staging_rails_remain_human_gated',
    case when (
      select count(*) from public.it_scorecard_rail_resolution_contracts
      where resolution_class='staging_acceptance'
        and requires_human=true
        and auto_close_allowed=false
    )>=6 then 'passed' else 'failed' end,
    'Staging acceptance rails remain human-gated and cannot auto-close.'
  union all select 'finance_provider_execution_off',
    case when not exists(
      select 1 from public.finance_job_completion_posting_execution_controls
      where execution_enabled=true or provider_mutation_enabled=true
    ) then 'passed' else 'failed' end,
    'Finance posting execution and provider mutation remain OFF.';
$$;
revoke all on function public.ywi_staging_environment_guard_assertions() from public,anon,authenticated;
grant execute on function public.ywi_staging_environment_guard_assertions() to service_role;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
)
values(
  'staging_environment_guard',
  'Staging / Release Safety',
  'Staging acceptance environment mutation guard',
  'error',
  'Keep Production fail-closed. Human staging-evidence writes require an explicit staging runtime label, exact staging project-ref match, and explicit staging mutation enable flag; the known Production project ref is always denied.',
  'Admin > I.T. Readiness > Staging acceptance',
  34,
  true
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
)
values(
  'schema197_staging_environment_guard',
  'admin',
  'Staging acceptance environment guard and Production mutation lockout',
  'active',80,8,10,
  'Verify endpoint fail-closed environment detection, Production project-ref denial, UI mutation lock state, permanent source/browser gates, Schema 197 convergence, dev/main accepted-tree parity, exact-main release evidence and cleanup. Do not run or sign off any human staging acceptance as part of this technical rail.',
  'Admin / I.T. / Release',
  117,
  jsonb_build_object(
    'schema',197,
    'business_rail_auto_close',false,
    'staging_acceptance_execution',false,
    'production_mutation',false,
    'finance_mutation',false,
    'payment_provider_mutation',false,
    'production_promotion',false
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
)
values(
  'schema197_staging_environment_guard',
  'build_acceptance',false,false,false,
  'Close only after environment-guard assertions, source/browser GREEN, schema convergence, dev/main accepted-tree parity, exact-main release evidence and cleanup. Human staging acceptance remains separate.',
  197
)
on conflict(rail_key) do update set
  resolution_class=excluded.resolution_class,
  requires_human=excluded.requires_human,
  requires_external=excluded.requires_external,
  auto_close_allowed=excluded.auto_close_allowed,
  resolution_note=excluded.resolution_note,
  introduced_by_schema=excluded.introduced_by_schema,
  updated_at=now();

create or replace view public.v_schema_drift_status with (security_invoker=true) as
select 197::int as expected_schema_version,
       coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
       case when coalesce(max(schema_version) filter(where status='applied'),0)>=197 then 'current' else 'behind' end::text as drift_status,
       case when coalesce(max(schema_version) filter(where status='applied'),0)>=197 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through the current schema in order.' end::text as message,
       now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

insert into public.app_schema_versions(
  schema_version,migration_key,schema_name,release_label,description,status,notes
)
values(
  197,
  '197_staging_environment_guard',
  '197_staging_environment_guard.sql',
  '2026-09-04a',
  'Adds explicit Production-deny staging environment authority so acceptance evidence mutation fails closed unless a dedicated staging runtime is deliberately configured.',
  'applied',
  'No staging acceptance executed. Eleven human/external rails remain open. Finance/provider execution remains OFF. Production promotion remains manual.'
)
on conflict(schema_version) do update set
  migration_key=excluded.migration_key,
  schema_name=excluded.schema_name,
  release_label=excluded.release_label,
  description=excluded.description,
  status=excluded.status,
  notes=excluded.notes,
  applied_at=now();

commit;
