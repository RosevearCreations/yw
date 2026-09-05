begin;

-- Schema 206 — SECURITY DEFINER execute-boundary convergence.
-- Current Supabase guidance treats function EXECUTE as an explicit Data API grant and
-- recommends SECURITY DEFINER only behind a pinned search_path and deliberate caller roles.
-- This migration closes twelve existing broad-execute helper paths and changes future
-- public-function defaults to opt-in. It does not change business/provider/Auth state.

-- Future public functions must opt in to Data API callers. PostgreSQL otherwise gives
-- functions PUBLIC EXECUTE by default, while the Supabase project default also granted
-- anon/authenticated/service_role EXECUTE.
alter default privileges for role postgres in schema public
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;

-- `directory_scope` is a read helper whose source contract is invoker semantics. Restore
-- that least-privilege behavior explicitly and keep direct invocation service-private.
alter function public.directory_scope(text) security invoker;
revoke execute on function public.directory_scope(text) from public, anon, authenticated;
grant execute on function public.directory_scope(text) to service_role;

-- Scheduler dispatchers are invoked by pg_cron jobs owned by postgres, not browser roles.
-- Pin their lookup path and remove all client-role execution.
alter function public.dispatch_due_report_delivery_scheduler_runs()
  set search_path = public, net, cron, pg_catalog;
alter function public.dispatch_due_service_execution_scheduler_runs()
  set search_path = public, net, cron, pg_catalog;
revoke execute on function public.dispatch_due_report_delivery_scheduler_runs() from public, anon, authenticated;
revoke execute on function public.dispatch_due_service_execution_scheduler_runs() from public, anon, authenticated;
grant execute on function public.dispatch_due_report_delivery_scheduler_runs() to service_role;
grant execute on function public.dispatch_due_service_execution_scheduler_runs() to service_role;

-- Auth bootstrap functions execute as trigger/internal routines. Client roles never need a
-- direct Data API path to them.
revoke execute on function public.handle_new_user_profile() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user_profile() to service_role;
grant execute on function public.handle_new_user() to service_role;

-- Finance helpers are nested behind guarded posting RPCs. Their owner-level nested calls
-- continue to work; a browser role must not be able to invoke the helpers directly.
revoke execute on function public.ywi_assert_period_open(date,text) from public, anon, authenticated;
revoke execute on function public.ywi_create_balanced_journal(uuid,uuid,text,date,text,jsonb) from public, anon, authenticated;
revoke execute on function public.ywi_find_gl_account(text[]) from public, anon, authenticated;
grant execute on function public.ywi_assert_period_open(date,text) to service_role;
grant execute on function public.ywi_create_balanced_journal(uuid,uuid,text,date,text,jsonb) to service_role;
grant execute on function public.ywi_find_gl_account(text[]) to service_role;

-- Role/rank helpers are consumed by guarded SECURITY DEFINER RPCs and do not require a
-- separate browser-callable endpoint.
revoke execute on function public.ywi_normalized_profile_role(uuid) from public, anon, authenticated;
revoke execute on function public.ywi_profile_rank(uuid) from public, anon, authenticated;
revoke execute on function public.ywi_require_rpc_rank(uuid,integer,text) from public, anon, authenticated;
grant execute on function public.ywi_normalized_profile_role(uuid) to service_role;
grant execute on function public.ywi_profile_rank(uuid) to service_role;
grant execute on function public.ywi_require_rpc_rank(uuid,integer,text) to service_role;

-- Stripe alert refresh is called by service-role Edge Functions only.
revoke execute on function public.ywi_refresh_stripe_webhook_alerts() from public, anon, authenticated;
grant execute on function public.ywi_refresh_stripe_webhook_alerts() to service_role;

create or replace view public.v_it_security_definer_execute_boundary
with (security_invoker=true)
as
with targets(signature,function_name,intended_path,expect_definer) as (
  values
    ('public.directory_scope(text)','directory_scope','service role only; invoker semantics',false),
    ('public.dispatch_due_report_delivery_scheduler_runs()','dispatch_due_report_delivery_scheduler_runs','postgres pg_cron / service diagnostics',true),
    ('public.dispatch_due_service_execution_scheduler_runs()','dispatch_due_service_execution_scheduler_runs','postgres pg_cron / service diagnostics',true),
    ('public.handle_new_user_profile()','handle_new_user_profile','auth trigger / service diagnostics',true),
    ('public.handle_new_user()','handle_new_user','internal bootstrap / service diagnostics',true),
    ('public.ywi_assert_period_open(date,text)','ywi_assert_period_open','nested Finance RPC / service diagnostics',true),
    ('public.ywi_create_balanced_journal(uuid,uuid,text,date,text,jsonb)','ywi_create_balanced_journal','nested Finance RPC / service diagnostics',true),
    ('public.ywi_find_gl_account(text[])','ywi_find_gl_account','nested Finance RPC / service diagnostics',true),
    ('public.ywi_normalized_profile_role(uuid)','ywi_normalized_profile_role','nested permission RPC / service diagnostics',true),
    ('public.ywi_profile_rank(uuid)','ywi_profile_rank','nested guarded RPC / service diagnostics',true),
    ('public.ywi_refresh_stripe_webhook_alerts()','ywi_refresh_stripe_webhook_alerts','service-role Edge Functions',true),
    ('public.ywi_require_rpc_rank(uuid,integer,text)','ywi_require_rpc_rank','nested guarded RPC / service diagnostics',true)
), resolved as (
  select t.*,to_regprocedure(t.signature) as function_oid
  from targets t
)
select
  r.signature,
  r.function_name,
  r.intended_path,
  r.expect_definer,
  p.prosecdef as is_security_definer,
  p.proconfig as function_config,
  case when r.function_oid is null then null else has_function_privilege('public',r.function_oid,'execute') end as public_execute,
  case when r.function_oid is null then null else has_function_privilege('anon',r.function_oid,'execute') end as anon_execute,
  case when r.function_oid is null then null else has_function_privilege('authenticated',r.function_oid,'execute') end as authenticated_execute,
  case when r.function_oid is null then null else has_function_privilege('service_role',r.function_oid,'execute') end as service_role_execute,
  case
    when r.function_oid is null then 'missing'
    when p.prosecdef is distinct from r.expect_definer then 'mode_mismatch'
    when has_function_privilege('public',r.function_oid,'execute')
      or has_function_privilege('anon',r.function_oid,'execute')
      or has_function_privilege('authenticated',r.function_oid,'execute') then 'client_execute_open'
    when not has_function_privilege('service_role',r.function_oid,'execute') then 'service_execute_missing'
    else 'secure'
  end::text as boundary_status,
  now() as checked_at
from resolved r
left join pg_proc p on p.oid=r.function_oid;

revoke all on table public.v_it_security_definer_execute_boundary from public, anon, authenticated;
grant select on table public.v_it_security_definer_execute_boundary to service_role;

create or replace function public.ywi_security_definer_execute_boundary_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql
security definer
set search_path=public,pg_catalog
as $$
  select 'security_definer_target_count',
    case when count(*)=12 then 'passed' else 'failed' end,
    'The bounded convergence inventory must contain exactly twelve reviewed function paths.'
  from public.v_it_security_definer_execute_boundary
  union all
  select 'security_definer_target_execute_closed',
    case when not exists(
      select 1 from public.v_it_security_definer_execute_boundary
      where boundary_status<>'secure'
    ) then 'passed' else 'failed' end,
    'Reviewed helpers must deny PUBLIC/anon/authenticated execution while retaining service-role diagnostics.'
  union all
  select 'directory_scope_invoker_restored',
    case when exists(
      select 1 from public.v_it_security_definer_execute_boundary
      where function_name='directory_scope' and is_security_definer=false and boundary_status='secure'
    ) then 'passed' else 'failed' end,
    'Directory scope is explicitly SECURITY INVOKER and not a creator-privilege Data API endpoint.'
  union all
  select 'scheduler_search_paths_pinned',
    case when not exists(
      select 1 from public.v_it_security_definer_execute_boundary
      where function_name in ('dispatch_due_report_delivery_scheduler_runs','dispatch_due_service_execution_scheduler_runs')
        and not coalesce(function_config,'{}'::text[]) @> array['search_path=public, net, cron, pg_catalog']::text[]
    ) then 'passed' else 'failed' end,
    'Both SECURITY DEFINER scheduler dispatchers have an explicit lookup path.'
  union all
  select 'future_function_default_execute_closed',
    case when exists(
      select 1
      from pg_default_acl d
      join pg_namespace n on n.oid=d.defaclnamespace
      where d.defaclrole='postgres'::regrole
        and n.nspname='public'
        and d.defaclobjtype='f'
        and not exists(
          select 1 from aclexplode(d.defaclacl) a
          where a.privilege_type='EXECUTE'
            and a.grantee in (0,'anon'::regrole,'authenticated'::regrole,'service_role'::regrole)
        )
    ) then 'passed' else 'failed' end,
    'Future public functions do not inherit Data API EXECUTE for PUBLIC, anon, authenticated, or service_role.';
$$;
revoke all on function public.ywi_security_definer_execute_boundary_assertions() from public, anon, authenticated;
grant execute on function public.ywi_security_definer_execute_boundary_assertions() to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  206,'206_security_definer_execute_boundary',
  'Closes reviewed SECURITY DEFINER/client-execute paths and makes future public-function execution explicit opt-in.',
  'applied',now(),'schema206',
  'No Auth setting mutation, business/provider mutation, staging acceptance, evidence fabrication, or Production promotion.',
  '206_security_definer_execute_boundary.sql','schema206'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status=excluded.status,
  applied_at=excluded.applied_at,applied_by=excluded.applied_by,notes=excluded.notes,
  migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status as
select 206 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=206 then 'current'
    when coalesce(max(schema_version) filter(where status='applied'),0)>206 then 'ahead'
    else 'drift'
  end::text as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=206 then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter(where status='applied'),0)>206 then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end::text as message,
  now() as checked_at
from public.app_schema_versions;

commit;
