begin;

-- Schema 191 — Admin account recovery + current-readiness cleanup.
-- Adds audited temporary-password issuance without ever storing plaintext passwords,
-- exposes a current-only Admin To-Do queue, preserves legacy release/readiness rows as
-- audit history, and advances release authority to Schema 191.

alter table public.profiles
  add column if not exists password_reset_required boolean not null default false,
  add column if not exists temporary_password_issued_at timestamptz,
  add column if not exists temporary_password_issued_by_profile_id uuid references public.profiles(id) on delete set null;

create table if not exists public.admin_password_resets (
  id uuid primary key default gen_random_uuid(),
  target_profile_id uuid not null references public.profiles(id) on delete restrict,
  reset_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  reason text,
  force_password_change boolean not null default true,
  reset_status text not null default 'issued' check(reset_status in ('issued','completed','failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_admin_password_resets_target_created
  on public.admin_password_resets(target_profile_id,created_at desc);
create index if not exists idx_admin_password_resets_actor_created
  on public.admin_password_resets(reset_by_profile_id,created_at desc);

alter table public.admin_password_resets enable row level security;
revoke all on table public.admin_password_resets from public,anon,authenticated;
grant select,insert,update on table public.admin_password_resets to service_role;

create or replace view public.v_admin_account_security_directory
with (security_invoker=true)
as
select
  p.id as profile_id,
  p.full_name,
  p.username,
  p.email,
  p.role,
  p.is_active,
  p.password_login_ready,
  p.password_changed_at,
  p.password_reset_required,
  p.temporary_password_issued_at,
  p.temporary_password_issued_by_profile_id,
  r.id as latest_reset_id,
  r.created_at as latest_reset_at,
  r.reset_status as latest_reset_status,
  r.reset_by_profile_id as latest_reset_by_profile_id,
  r.completed_at as latest_reset_completed_at
from public.profiles p
left join lateral (
  select apr.id,apr.created_at,apr.reset_status,apr.reset_by_profile_id,apr.completed_at
  from public.admin_password_resets apr
  where apr.target_profile_id=p.id
  order by apr.created_at desc
  limit 1
) r on true;

revoke all on table public.v_admin_account_security_directory from public,anon,authenticated;
grant select on table public.v_admin_account_security_directory to service_role;

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
    when 'pg_net' then 'Review pg_net extension schema placement'
    when 'leaked_password_protection' then 'Verify leaked-password protection in Supabase Auth'
    when 'mfa_options' then 'Verify MFA options in Supabase Auth'
    else 'Review current security follow-up: '||s.object_name
  end::text,
  'pending'::text,
  case s.object_name
    when 'pg_net' then 'Inventory every live pg_net dependency and usage path before deciding whether extension relocation is safe. Do not relocate it from advisor output alone.'
    when 'leaked_password_protection' then 'Verify the current Supabase Auth leaked-password protection setting in the external Auth control plane and record evidence before changing it.'
    when 'mfa_options' then 'Verify the current Supabase Auth MFA configuration in the external Auth control plane and record evidence before changing it.'
    else 'Verify this security follow-up against its live authority before remediation.'
  end::text,
  'Current external/catalog evidence is required; historical advisor rows are not sufficient proof.'::text,
  false,
  (s.reconciliation_state='external_verification')::boolean,
  'security_followup'::text,
  190::int,
  500 + row_number() over(order by s.object_name)::int,
  s.checked_at
from public.v_it_security_advisor_truth s
where s.reconciliation_state in ('confirmed_followup','external_verification')
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
  'Only current unresolved actions appear here. Completed rails and superseded preflight/prerelease checklists remain audit history and are not active To-Do items.'::text as status_message,
  now() as checked_at
from public.v_it_current_admin_todo;

revoke all on table public.v_it_current_admin_todo_status from public,anon,authenticated;
grant select on table public.v_it_current_admin_todo_status to service_role;

create or replace view public.v_it_historical_readiness_archive
with (security_invoker=true)
as
select
  'production_readiness'::text as archive_source,
  p.check_key::text as archive_key,
  p.check_title::text as archive_title,
  p.check_status::text as historical_status,
  p.next_action::text as historical_action,
  p.updated_at,
  true::boolean as audit_only
from public.v_production_readiness_checklist p
union all
select
  'function_readiness'::text,
  f.function_key::text,
  f.function_name::text,
  f.readiness_status::text,
  f.deploy_hint::text,
  f.updated_at,
  true::boolean
from public.v_admin_function_readiness_checks f;

revoke all on table public.v_it_historical_readiness_archive from public,anon,authenticated;
grant select on table public.v_it_historical_readiness_archive to service_role;

create or replace function public.ywi_admin_account_security_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql
security definer
set search_path=public,pg_temp
as $$
  select 'admin_password_reset_audit_private',
    case when not has_table_privilege('anon','public.admin_password_resets','select')
      and not has_table_privilege('authenticated','public.admin_password_resets','select')
      and has_table_privilege('service_role','public.admin_password_resets','select')
    then 'passed' else 'failed' end,
    'Password reset audit is service-private.'
  union all
  select 'admin_password_reset_has_no_plaintext_column',
    case when not exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='admin_password_resets'
        and lower(column_name) in ('password','temporary_password','temp_password','password_hash','encrypted_password')
    ) then 'passed' else 'failed' end,
    'No password, temporary password, or auth hash is stored in the reset audit table.'
  union all
  select 'profile_temporary_password_gate_present',
    case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='password_reset_required')
      and exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='temporary_password_issued_at')
    then 'passed' else 'failed' end,
    'Profiles can be forced through a temporary-password replacement gate.'
  union all
  select 'current_todo_excludes_complete_scorecard_rails',
    case when not exists(
      select 1 from public.v_it_current_admin_todo t
      join public.admin_scorecard_progress_rails r on t.todo_key='rail:'||r.rail_key
      where r.rail_status='complete'
    ) then 'passed' else 'failed' end,
    'Completed scorecard rails are absent from the active Admin To-Do queue.'
  union all
  select 'current_todo_excludes_superseded_deploy_hints',
    case when not exists(
      select 1 from public.v_it_current_admin_todo
      where lower(coalesce(current_action,'')) like '%deploy schema 155%'
         or lower(coalesce(current_action,'')) like '%deploy quote-contact-submit%'
         or lower(coalesce(current_action,'')) like '%schema 107%'
    ) then 'passed' else 'failed' end,
    'Superseded schema/function deployment instructions are not active To-Do actions.'
  union all
  select 'current_todo_preserves_open_business_acceptance',
    case when (select count(*) from public.v_it_current_admin_todo where todo_key like 'rail:%')=
                   (select count(*) from public.v_it_open_rail_acceptance_readiness where rail_status<>'complete')
    then 'passed' else 'failed' end,
    'Every genuinely open human/provider/accounting/content rail remains represented.'
  union all
  select 'historical_readiness_preserved_for_audit',
    case when exists(select 1 from public.v_it_historical_readiness_archive where audit_only)
    then 'passed' else 'failed' end,
    'Legacy preflight/prerelease rows are preserved as audit history rather than deleted.'
  union all
  select 'account_security_views_service_private',
    case when not has_table_privilege('anon','public.v_admin_account_security_directory','select')
      and not has_table_privilege('authenticated','public.v_admin_account_security_directory','select')
      and has_table_privilege('service_role','public.v_admin_account_security_directory','select')
      and not has_table_privilege('anon','public.v_it_current_admin_todo','select')
      and not has_table_privilege('authenticated','public.v_it_current_admin_todo','select')
      and has_table_privilege('service_role','public.v_it_current_admin_todo','select')
    then 'passed' else 'failed' end,
    'Admin account-security and current To-Do views are service-private.';
$$;

revoke all on function public.ywi_admin_account_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_admin_account_security_assertions() to service_role;

insert into public.it_readiness_check_registry(check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled)
values('admin_account_recovery_current_todo','Security','Admin temporary-password recovery and current-only To-Do authority','critical',
  'Use Admin account security to issue audited temporary passwords. Use Current Admin To-Do for unresolved work; legacy release/preflight rows are audit-only.',
  'Admin > I.T. Readiness',39,true)
on conflict(check_key) do update set check_group=excluded.check_group,check_title=excluded.check_title,severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,route_hint=excluded.route_hint,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,updated_at=now();

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,next_action_hint,owner_hint,sort_order,metadata
) values(
  'schema191_admin_account_recovery_readiness_cleanup','admin','Admin account recovery and current-readiness cleanup','active',90,9,10,
  'Verify audited temporary-password reset, forced replacement, password visibility, current-only Admin To-Do rendering, source/browser gates, dev promotion, exact-main release evidence, and branch cleanup.',
  'Admin / I.T. / Security',111,jsonb_build_object('schema',191,'build','2026-09-03e','business_rail_auto_close',false,'plaintext_password_storage',false,'historical_audit_delete',false,'finance_mutation',false,'payment_provider_mutation',false,'production_promotion',false)
)
on conflict(rail_key) do update set rail_area=excluded.rail_area,rail_title=excluded.rail_title,rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,current_value=excluded.current_value,target_value=excluded.target_value,next_action_hint=excluded.next_action_hint,
  owner_hint=excluded.owner_hint,sort_order=excluded.sort_order,metadata=excluded.metadata,updated_at=now();

insert into public.it_scorecard_rail_resolution_contracts(
  rail_key,resolution_class,requires_human,requires_external,auto_close_allowed,resolution_note,introduced_by_schema
) values(
  'schema191_admin_account_recovery_readiness_cleanup','build_acceptance',false,false,false,
  'Close Build 191 only after password-reset security assertions, rendered Account/Admin acceptance, protected Edge deployment, current-only To-Do proof, dev/main source gates and exact-main release evidence are green. No human business acceptance rail is auto-closed.',191
)
on conflict(rail_key) do update set resolution_class=excluded.resolution_class,requires_human=excluded.requires_human,requires_external=excluded.requires_external,
  auto_close_allowed=excluded.auto_close_allowed,resolution_note=excluded.resolution_note,introduced_by_schema=excluded.introduced_by_schema,updated_at=now();

create or replace view public.v_schema_drift_status with (security_invoker=true) as
select 191::int as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=191 then 'current' else 'behind' end::text as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=191 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through schema 191 in order.' end::text as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

insert into public.app_schema_versions(schema_version,migration_key,schema_name,release_label,description,status,notes)
values(191,'191_admin_account_recovery_readiness_cleanup','191_admin_account_recovery_readiness_cleanup.sql','2026-09-03e',
  'Adds audited temporary-password recovery, forced password replacement metadata, service-private Admin account directory, and a current-only Admin To-Do authority that excludes completed/superseded release tasks.',
  'applied','Plaintext passwords are never stored. Historical readiness remains audit history. Finance/provider mutation remain OFF; the 11 business acceptance rails remain evidence-gated; Production promotion remains manual.')
on conflict(schema_version) do update set migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,
  description=excluded.description,status=excluded.status,notes=excluded.notes,applied_at=now();

commit;
