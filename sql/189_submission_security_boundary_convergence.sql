begin;

-- Schema 189 — submission security boundary convergence.
-- Removes two legacy broad authenticated policies that override narrower RLS rules,
-- aligns DB role ranking with the current client/server role vocabulary, and exposes
-- service-private I.T. security truth. No submission/business rows are rewritten.

create or replace function public.role_rank(input_role text)
returns integer
language sql
immutable
as $$
  select case lower(coalesce(input_role,''))
    when 'worker' then 10
    when 'employee' then 10
    when 'staff' then 15
    when 'onsite_admin' then 18
    when 'site_leader' then 20
    when 'supervisor' then 30
    when 'hse' then 40
    when 'job_admin' then 45
    when 'admin' then 50
    else 0
  end;
$$;

comment on function public.role_rank(text) is
'Current YardWeasels role rank. worker/employee=10, staff=15, onsite_admin=18, site_leader=20, supervisor=30, hse=40, job_admin=45, admin=50.';

-- PostgreSQL permissive policies are OR-combined. These two legacy TRUE policies made
-- the more specific submission policies ineffective for authenticated clients.
drop policy if exists submissions_insert_authenticated on public.submissions;
drop policy if exists submissions_select_authenticated on public.submissions;

drop policy if exists "submissions: insert per-role" on public.submissions;
drop policy if exists "submissions: insert owned per-role" on public.submissions;
create policy "submissions: insert owned per-role"
on public.submissions
for insert
to authenticated
with check (
  submitted_by_profile_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and (
        (submissions.form_type = 'E' and p.role in ('worker','employee','staff','onsite_admin','site_leader','supervisor','hse','job_admin','admin'))
        or (submissions.form_type in ('B','C','D') and p.role in ('site_leader','supervisor','hse','job_admin','admin'))
        or (submissions.form_type = 'A' and p.role in ('hse','job_admin','admin'))
      )
  )
);

create or replace view public.v_it_submission_security_status
with (security_invoker=true)
as
with policy_state as (
  select
    count(*) filter(where policyname='submissions_insert_authenticated')::int as broad_insert_policy_count,
    count(*) filter(where policyname='submissions_select_authenticated')::int as broad_select_policy_count,
    count(*) filter(where policyname='submissions: insert owned per-role'
      and cmd='INSERT'
      and 'authenticated'=any(roles)
      and coalesce(with_check,'') like '%submitted_by_profile_id = auth.uid()%'
      and coalesce(with_check,'') like '%employee%')::int as scoped_insert_policy_count,
    count(*) filter(where policyname='submissions_select_self_or_supervisor_plus'
      and cmd='SELECT')::int as scoped_select_policy_count
  from pg_policies
  where schemaname='public' and tablename='submissions'
), table_state as (
  select c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='submissions' and c.relkind in ('r','p')
  limit 1
), row_state as (
  select count(*)::int as submission_count,
    count(*) filter(where submitted_by_profile_id is null)::int as legacy_ownerless_count,
    count(*) filter(where submitted_by_profile_id is not null)::int as owned_count
  from public.submissions
)
select
  case when coalesce((select rls_enabled from table_state),false)
      and (select broad_insert_policy_count from policy_state)=0
      and (select broad_select_policy_count from policy_state)=0
      and (select scoped_insert_policy_count from policy_state)=1
      and (select scoped_select_policy_count from policy_state)>=1
      and public.role_rank('employee')=10
      and public.role_rank('staff')=15
      and public.role_rank('onsite_admin')=18
      and public.role_rank('job_admin')=45
    then 'green' else 'red' end::text as security_status,
  coalesce((select rls_enabled from table_state),false) as rls_enabled,
  (select broad_insert_policy_count from policy_state) as broad_insert_policy_count,
  (select broad_select_policy_count from policy_state) as broad_select_policy_count,
  (select scoped_insert_policy_count from policy_state) as scoped_insert_policy_count,
  (select scoped_select_policy_count from policy_state) as scoped_select_policy_count,
  public.role_rank('worker') as worker_rank,
  public.role_rank('employee') as employee_rank,
  public.role_rank('staff') as staff_rank,
  public.role_rank('onsite_admin') as onsite_admin_rank,
  public.role_rank('site_leader') as site_leader_rank,
  public.role_rank('supervisor') as supervisor_rank,
  public.role_rank('hse') as hse_rank,
  public.role_rank('job_admin') as job_admin_rank,
  public.role_rank('admin') as admin_rank,
  (select submission_count from row_state) as submission_count,
  (select legacy_ownerless_count from row_state) as legacy_ownerless_count,
  (select owned_count from row_state) as owned_count,
  'Authenticated submission access is scoped by ownership/seniority; canonical Edge writes remain server-authorized. Legacy ownerless rows remain unchanged and are not backfilled without reliable identity evidence.'::text as security_message,
  now() as checked_at;

revoke all on table public.v_it_submission_security_status from public,anon,authenticated;
grant select on table public.v_it_submission_security_status to service_role;

create or replace function public.ywi_submission_security_assertions()
returns table(assertion_key text, assertion_status text, assertion_detail text)
language sql
security definer
set search_path=public,pg_temp
as $$
  select 'submission_rls_enabled',
    case when exists(
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname='submissions' and c.relrowsecurity
    ) then 'passed' else 'failed' end,
    'The submissions table has row-level security enabled.'
  union all
  select 'submission_broad_authenticated_policies_removed',
    case when not exists(
      select 1 from pg_policies where schemaname='public' and tablename='submissions'
        and policyname in ('submissions_insert_authenticated','submissions_select_authenticated')
    ) then 'passed' else 'failed' end,
    'Legacy authenticated TRUE SELECT/INSERT policies are absent so narrower permissive policies cannot be bypassed.'
  union all
  select 'submission_owned_insert_policy_current',
    case when exists(
      select 1 from pg_policies where schemaname='public' and tablename='submissions'
        and policyname='submissions: insert owned per-role' and cmd='INSERT'
        and 'authenticated'=any(roles)
        and coalesce(with_check,'') like '%submitted_by_profile_id = auth.uid()%'
        and coalesce(with_check,'') like '%employee%'
        and coalesce(with_check,'') like '%job_admin%'
    ) then 'passed' else 'failed' end,
    'Direct authenticated inserts must belong to auth.uid(), use an active profile, and satisfy the form-type role contract.'
  union all
  select 'submission_select_policy_scoped',
    case when exists(
      select 1 from pg_policies where schemaname='public' and tablename='submissions'
        and policyname='submissions_select_self_or_supervisor_plus' and cmd='SELECT'
    ) then 'passed' else 'failed' end,
    'Authenticated reads retain the self-or-supervisor-plus scoped policy after broad SELECT removal.'
  union all
  select 'submission_role_rank_current',
    case when public.role_rank('worker')=10 and public.role_rank('employee')=10 and public.role_rank('staff')=15
      and public.role_rank('onsite_admin')=18 and public.role_rank('site_leader')=20 and public.role_rank('supervisor')=30
      and public.role_rank('hse')=40 and public.role_rank('job_admin')=45 and public.role_rank('admin')=50
    then 'passed' else 'failed' end,
    'Database role_rank matches the current browser/server role vocabulary, including employee, staff, onsite_admin and job_admin.'
  union all
  select 'submission_security_status_green',
    case when exists(select 1 from public.v_it_submission_security_status where security_status='green') then 'passed' else 'failed' end,
    'The combined live submission security posture is green.';
$$;

revoke all on function public.ywi_submission_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_submission_security_assertions() to service_role;

insert into public.it_readiness_check_registry(check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled)
values('submission_security_boundary','Security','Submission RLS, ownership and server-write trust boundary is current','critical',
  'Verify submission RLS assertions, scoped policies, current role ranks and the JWT-protected resend-email deployment before release.',
  'Admin > I.T. Readiness',37,true)
on conflict(check_key) do update set check_group=excluded.check_group,check_title=excluded.check_title,severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,route_hint=excluded.route_hint,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,updated_at=now();

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,next_action_hint,owner_hint,sort_order,metadata
) values(
  'schema189_submission_security_boundary','security','Submission RLS and server-write trust-boundary convergence','active',90,9,10,
  'Verify broad authenticated submission policies are removed, direct fallback is owner/role scoped, role ranks match current clients, resend-email uses the real date column with Safety create authorization, JWT deployment is enabled, source gates are green, and exact-main release evidence is recorded.',
  'I.T. / Security',109,jsonb_build_object('schema',189,'build','2026-09-03c','business_rail_auto_close',false,'submission_row_rewrite',false,'finance_mutation',false,'payment_provider_mutation',false,'production_promotion',false)
)
on conflict(rail_key) do update set rail_area=excluded.rail_area,rail_title=excluded.rail_title,rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,current_value=excluded.current_value,target_value=excluded.target_value,next_action_hint=excluded.next_action_hint,
  owner_hint=excluded.owner_hint,sort_order=excluded.sort_order,metadata=excluded.metadata,updated_at=now();

insert into public.it_scorecard_rail_resolution_contracts(
  rail_key,resolution_class,requires_human,requires_external,auto_close_allowed,resolution_note,introduced_by_schema
) values(
  'schema189_submission_security_boundary','build_acceptance',false,false,false,
  'Close Build 189 only after DB RLS assertions, exact source/runtime resend-email contract, JWT deployment, source/browser regression gates and exact-main release evidence are green. No business acceptance rail is closed by this build.',189
)
on conflict(rail_key) do update set resolution_class=excluded.resolution_class,requires_human=excluded.requires_human,requires_external=excluded.requires_external,
  auto_close_allowed=excluded.auto_close_allowed,resolution_note=excluded.resolution_note,introduced_by_schema=excluded.introduced_by_schema,updated_at=now();

create or replace view public.v_schema_drift_status with (security_invoker=true) as
select 189::int as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=189 then 'current' else 'behind' end::text as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=189 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through schema 189 in order.' end::text as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

insert into public.app_schema_versions(schema_version,migration_key,schema_name,release_label,description,status,notes)
values(189,'189_submission_security_boundary_convergence','189_submission_security_boundary_convergence.sql','2026-09-03c',
  'Removes broad authenticated submission RLS bypass policies, aligns role ranks with current clients, and adds service-private submission security posture assertions.',
  'applied','No submission/business rows are rewritten. Finance/provider mutation remain OFF; all human-gated business acceptance rails remain open; Production promotion remains manual.')
on conflict(schema_version) do update set migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,
  description=excluded.description,status=excluded.status,notes=excluded.notes,applied_at=now();

commit;
