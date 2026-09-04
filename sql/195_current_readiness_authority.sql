begin;

-- Current I.T. readiness must be derived from live/current authority.
-- The old admin_production_readiness_checks rows remain audit history only.
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
from public.admin_production_readiness_checks p
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

create or replace view public.v_production_readiness_checklist
with (security_invoker=true)
as
select
  'schema_drift'::text as check_key,
  'Database'::text as check_area,
  'Live schema matches current repository authority'::text as check_title,
  ('Applied '||coalesce(s.latest_applied_schema_version,0)::text||' / expected '||coalesce(s.expected_schema_version,0)::text||'.')::text as check_detail,
  case when s.drift_status='current' then 'ready' else 'blocked' end::text as check_status,
  case when s.drift_status='current' then 'No schema action required.' else coalesce(s.message,'Resolve schema drift before release.') end::text as next_action,
  10::int as sort_order,
  s.checked_at as updated_at
from public.v_schema_drift_status s
union all
select
  'application_release_authority','Release','Application release authority',
  coalesce(r.release_message,'Current exact-source release authority.'),
  case when lower(coalesce(r.release_authority_status,''))='green' then 'ready' else 'blocked' end,
  case when lower(coalesce(r.release_authority_status,''))='green' then 'Use the recorded exact-main source evidence for release decisions.' else 'Resolve source/schema/contract release-authority blockers.' end,
  20,r.checked_at
from public.v_it_release_authority_status r
union all
select
  'repository_enforcement','Repository','Main branch/ruleset enforcement',
  ('Protection reported='||coalesce(r.branch_protection_reported,false)::text||'; policy verified='||coalesce(r.branch_policy_verified,false)::text||'.')::text,
  case when lower(coalesce(r.repository_enforcement_status,''))='green' then 'ready' else 'review' end,
  case when lower(coalesce(r.repository_enforcement_status,''))='green' then 'Repository enforcement is verified.' else 'Enable and verify GitHub main protection/ruleset enforcement; keep this separate from application release authority.' end,
  30,r.checked_at
from public.v_it_release_authority_status r
union all
select
  'scorecard_truth','I.T.','Scorecard classification truth',
  coalesce(t.truth_message,'Current scorecard classification authority.'),
  case when lower(coalesce(t.scorecard_truth_status,''))='green' and coalesce(t.unclassified_open_count,0)=0 then 'ready' else 'blocked' end,
  case when coalesce(t.unclassified_open_count,0)=0 then 'All open rails are classified. Do not auto-close human/external rails.' else 'Classify every open rail before selecting autonomous technical work.' end,
  40,t.checked_at
from public.v_it_scorecard_progress_truth_status t
union all
select
  'current_admin_todo','I.T.','Current unresolved Admin / I.T. actions',
  (coalesce(t.current_todo_count,0)::text||' current action(s): '||coalesce(t.business_acceptance_count,0)::text||' business acceptance, '||coalesce(t.security_followup_count,0)::text||' security follow-up, '||coalesce(t.repository_followup_count,0)::text||' repository follow-up.')::text,
  case when coalesce(t.current_todo_count,0)=0 then 'ready' else 'review' end,
  case when coalesce(t.current_todo_count,0)=0 then 'No current unresolved actions.' else 'Use Current Admin To-Do. Historical prerelease/checklist rows are audit-only and must not be treated as current work.' end,
  50,t.checked_at
from public.v_it_current_admin_todo_status t
union all
select
  'help_seo_authority','SEO','Online Help, canonical authority, noindex and one-H1 release contract',
  ('Schema 194 public-web assertions: '||(select count(*) from public.ywi_public_web_authority_release_assertions() where assertion_status='passed')::text||'/'||(select count(*) from public.ywi_public_web_authority_release_assertions())::text||' passed.')::text,
  case when not exists(select 1 from public.ywi_public_web_authority_release_assertions() where assertion_status<>'passed') then 'ready' else 'blocked' end,
  case when not exists(select 1 from public.ywi_public_web_authority_release_assertions() where assertion_status<>'passed') then 'Keep Help/search/mobile-desktop source and browser gates permanent.' else 'Resolve public-web authority assertions before release.' end,
  60,now()
union all
select
  'finance_provider_execution','Finance','Finance posting and provider mutation safety',
  ((select count(*) from public.finance_job_completion_posting_execution_controls where execution_enabled=true or provider_mutation_enabled=true)::text||' execution/provider control(s) enabled.')::text,
  case when not exists(select 1 from public.finance_job_completion_posting_execution_controls where execution_enabled=true or provider_mutation_enabled=true) then 'ready' else 'blocked' end,
  case when not exists(select 1 from public.finance_job_completion_posting_execution_controls where execution_enabled=true or provider_mutation_enabled=true) then 'Posting execution and provider mutation remain OFF.' else 'Disable unauthorized Finance/provider execution before release.' end,
  70,now();

revoke all on table public.v_production_readiness_checklist from public,anon,authenticated;
grant select on table public.v_production_readiness_checklist to service_role;

create or replace function public.ywi_current_readiness_authority_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql security definer set search_path=public,pg_temp as $$
  select 'legacy_readiness_not_current',
    case when not exists(select 1 from public.v_production_readiness_checklist where check_key in ('saved_filters','close_wizard_steps','server_pagination_foundation','bank_csv_import_foundation','mobile_action_cards')) then 'passed' else 'failed' end,
    'Legacy foundation/checklist rows do not appear as current Production readiness.'
  union all select 'legacy_readiness_preserved_for_audit',
    case when exists(select 1 from public.v_it_historical_readiness_archive where archive_source='production_readiness' and archive_key='bank_csv_import_foundation' and audit_only) then 'passed' else 'failed' end,
    'Legacy readiness rows remain available as audit history.'
  union all select 'current_schema_readiness_derived',
    case when exists(select 1 from public.v_production_readiness_checklist where check_key='schema_drift' and check_status='ready') then 'passed' else 'failed' end,
    'Current readiness derives schema status from v_schema_drift_status.'
  union all select 'open_business_acceptance_unchanged',
    case when (select count(*) from public.v_it_open_rail_acceptance_readiness where rail_status<>'complete')=11 then 'passed' else 'failed' end,
    'All 11 human/provider/accounting/content/staging acceptance rails remain open.'
  union all select 'finance_provider_execution_off',
    case when not exists(select 1 from public.finance_job_completion_posting_execution_controls where execution_enabled=true or provider_mutation_enabled=true) then 'passed' else 'failed' end,
    'Finance posting execution and provider mutation remain OFF.';
$$;
revoke all on function public.ywi_current_readiness_authority_assertions() from public,anon,authenticated;
grant execute on function public.ywi_current_readiness_authority_assertions() to service_role;

insert into public.it_readiness_check_registry(check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled)
values('current_readiness_authority','I.T. / Release','Current readiness authority excludes legacy checklist drift','error','Use current schema/release/scorecard/Admin-To-Do/search/Finance authorities. Preserve retired prerelease checklist rows only in historical readiness audit.','Admin > I.T. Readiness',47,true)
on conflict(check_key) do update set check_group=excluded.check_group,check_title=excluded.check_title,severity_if_failed=excluded.severity_if_failed,action_hint=excluded.action_hint,route_hint=excluded.route_hint,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,updated_at=now();

insert into public.admin_scorecard_progress_rails(rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,next_action_hint,owner_hint,sort_order,metadata)
values('schema195_current_readiness_authority','admin','Current readiness authority and legacy checklist demotion','active',80,8,10,'Verify legacy readiness rows are audit-only, current Production readiness derives live authority, source/browser gates remain green, Schema 195 converges, dev/main accepted-tree parity is proven, evidence is recorded, and only this technical rail closes.','Admin / I.T. / Release',115,jsonb_build_object('schema',195,'business_rail_auto_close',false,'historical_audit_delete',false,'finance_mutation',false,'payment_provider_mutation',false,'production_promotion',false))
on conflict(rail_key) do update set rail_area=excluded.rail_area,rail_title=excluded.rail_title,rail_status=excluded.rail_status,progress_percent=excluded.progress_percent,current_value=excluded.current_value,target_value=excluded.target_value,next_action_hint=excluded.next_action_hint,owner_hint=excluded.owner_hint,sort_order=excluded.sort_order,metadata=excluded.metadata,updated_at=now();

insert into public.it_scorecard_rail_resolution_contracts(rail_key,resolution_class,requires_human,requires_external,auto_close_allowed,resolution_note,introduced_by_schema)
values('schema195_current_readiness_authority','build_acceptance',false,false,false,'Close only after current-readiness assertions, exact source/browser GREEN, schema convergence, dev/main accepted-tree parity, release evidence and cleanup. Do not close human/external rails.',195)
on conflict(rail_key) do update set resolution_class=excluded.resolution_class,requires_human=excluded.requires_human,requires_external=excluded.requires_external,auto_close_allowed=excluded.auto_close_allowed,resolution_note=excluded.resolution_note,introduced_by_schema=excluded.introduced_by_schema,updated_at=now();

create or replace view public.v_schema_drift_status with (security_invoker=true) as
select 195::int as expected_schema_version,
       coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
       case when coalesce(max(schema_version) filter(where status='applied'),0)>=195 then 'current' else 'behind' end::text as drift_status,
       case when coalesce(max(schema_version) filter(where status='applied'),0)>=195 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through the current schema in order.' end::text as message,
       now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

insert into public.app_schema_versions(schema_version,migration_key,schema_name,release_label,description,status,notes)
values(195,'195_current_readiness_authority','195_current_readiness_authority.sql','2026-09-03i','Replaces stale live Production readiness with current derived authority while preserving legacy checklist rows as audit history.','applied','No business data mutation. Eleven human/external business acceptance rails remain open. Finance/provider execution remains OFF. Production promotion remains manual.')
on conflict(schema_version) do update set migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,description=excluded.description,status=excluded.status,notes=excluded.notes,applied_at=now();

commit;
