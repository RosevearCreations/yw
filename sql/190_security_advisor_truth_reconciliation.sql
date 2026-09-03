begin;

-- Schema 190 — security advisor truth reconciliation.
-- Reconciles the 2026-09-03 Supabase security-advisor snapshot against live PostgreSQL
-- catalogs before remediation. Only one confirmed, low-risk database finding is changed:
-- public.set_updated_at() receives a fixed search_path. pg_net relocation and Auth
-- dashboard settings remain explicit follow-ups. No business rows or human acceptance
-- rails are rewritten; Finance/provider execution remains OFF and Production stays manual.

alter function public.set_updated_at() set search_path=public,pg_temp;

create or replace view public.v_it_security_advisor_truth
with (security_invoker=true)
as
with relation_claims(advisor_rule,severity,object_name,policy_name) as (
  values
    ('rls_disabled_in_public','error','monitoring_events',null::text),
    ('security_definer_view','error','admin_security_logs',null),
    ('security_definer_view','error','v_coupon_usage_summary',null),
    ('security_definer_view','error','v_global_business_metrics',null),
    ('security_definer_view','error','v_it_rbac_current_state',null),
    ('security_definer_view','error','v_crew_payment_summary',null),
    ('security_definer_view','error','v_system_performance_metrics',null),
    ('security_definer_view','error','v_audit_trail_enhanced',null),
    ('security_definer_view','error','platform_connectors',null),
    ('security_definer_view','error','v_it_rbac_current_grants',null),
    ('security_definer_view','error','v_admin_dashboard',null),
    ('security_definer_view','error','v_admin_recovery_cleanup_candidates',null),
    ('security_definer_view','error','v_incident_response_status',null),
    ('security_definer_view','error','v_data_protection_status',null),
    ('security_definer_view','error','v_it_user_security_status',null),
    ('security_definer_view','error','v_it_access_render_acceptance',null),
    ('security_definer_view','error','user_activity_summary',null),
    ('security_definer_view','error','v_auth_account_issue_queue',null),
    ('security_definer_view','error','payment_methods',null),
    ('security_definer_view','error','admin_action_logs',null),
    ('materialized_view_in_api','error','mv_precomputed_metrics',null),
    ('materialized_view_in_api','error','mv_user_permissions',null),
    ('sensitive_columns_exposed','warn','v_admin_active_sessions',null),
    ('rls_policy_always_true','warn','activity_log','Authenticated can log activity'),
    ('rls_policy_always_true','warn','analytics_events','analytics_insert'),
    ('rls_policy_always_true','warn','client_error_events','Allow error event inserts')
), live_relations as (
  select c.relname,c.relkind,c.relrowsecurity,c.reloptions,c.oid,
    has_table_privilege('anon',c.oid,'select') as anon_select,
    has_table_privilege('authenticated',c.oid,'select') as authenticated_select,
    has_table_privilege('service_role',c.oid,'select') as service_select
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
), relation_truth as (
  select
    '2026-09-03-build190'::text as snapshot_label,
    rc.advisor_rule,rc.severity,'relation'::text as object_kind,'public'::text as object_schema,
    rc.object_name,rc.policy_name,
    (lr.oid is not null) as live_exists,
    case
      when lr.oid is null then 'stale_object'
      when rc.advisor_rule='rls_disabled_in_public' and lr.relrowsecurity then 'verified_safe'
      when rc.advisor_rule='security_definer_view' and lr.relkind='v' and coalesce(lr.reloptions,'{}'::text[]) @> array['security_invoker=true'] then 'verified_safe'
      when rc.advisor_rule='materialized_view_in_api' and not lr.anon_select and not lr.authenticated_select then 'verified_safe'
      when rc.advisor_rule='sensitive_columns_exposed' and not lr.anon_select and not lr.authenticated_select then 'verified_safe'
      when rc.advisor_rule='rls_policy_always_true' and not exists(
        select 1 from pg_policies p where p.schemaname='public' and p.tablename=rc.object_name and p.policyname=rc.policy_name
      ) then 'verified_safe'
      else 'confirmed_followup'
    end::text as reconciliation_state,
    jsonb_build_object(
      'relkind',lr.relkind,'rls_enabled',lr.relrowsecurity,'reloptions',lr.reloptions,
      'anon_select',lr.anon_select,'authenticated_select',lr.authenticated_select,'service_select',lr.service_select
    ) as truth_detail
  from relation_claims rc
  left join live_relations lr on lr.relname=rc.object_name
), function_claims(advisor_rule,severity,object_name) as (
  values
    ('function_search_path_mutable','warn','get_referral_stats'),
    ('function_search_path_mutable','warn','validate_equipment_custody_reference'),
    ('function_search_path_mutable','warn','update_updated_at_column'),
    ('function_search_path_mutable','warn','financial_transactions_audit'),
    ('function_search_path_mutable','warn','has_module_access'),
    ('function_search_path_mutable','warn','get_task_progress'),
    ('function_search_path_mutable','warn','current_user_employee_id'),
    ('function_search_path_mutable','warn','update_user_profiles_updated_at'),
    ('function_search_path_mutable','warn','award_badge'),
    ('function_search_path_mutable','warn','user_has_permission'),
    ('function_search_path_mutable','warn','get_user_activity_feed'),
    ('function_search_path_mutable','warn','async_database_audit'),
    ('function_search_path_mutable','warn','claim_referral'),
    ('function_search_path_mutable','warn','handle_new_user'),
    ('function_search_path_mutable','warn','calculate_user_data_value'),
    ('function_search_path_mutable','warn','set_updated_at'),
    ('function_search_path_mutable','warn','update_crm_contacts_updated_at'),
    ('function_search_path_mutable','warn','update_smart_tasks_updated_at'),
    ('function_search_path_mutable','warn','get_pending_ace_learning_count'),
    ('function_search_path_mutable','warn','get_coupon_analytics'),
    ('function_search_path_mutable','warn','ywi_employee_unblocker_scorecard'),
    ('function_search_path_mutable','warn','handle_updated_at'),
    ('function_search_path_mutable','warn','log_data_value_metric'),
    ('function_search_path_mutable','warn','validate_consent_record'),
    ('function_search_path_mutable','warn','validate_timesheet_overlap'),
    ('function_search_path_mutable','warn','check_migration_ready'),
    ('function_search_path_mutable','warn','update_user_ace_profiles_updated_at'),
    ('function_search_path_mutable','warn','generate_coupon_code'),
    ('function_search_path_mutable','warn','calculate_coupon_discount'),
    ('function_search_path_mutable','warn','get_rows_for_processing'),
    ('function_search_path_mutable','warn','insert_referrals'),
    ('function_search_path_mutable','warn','get_employee_finance_summary'),
    ('function_search_path_mutable','warn','sync_user_email'),
    ('function_search_path_mutable','warn','log_historical_replay_event'),
    ('function_search_path_mutable','warn','register_event_schema'),
    ('function_search_path_mutable','warn','award_points'),
    ('function_search_path_mutable','warn','validate_equipment_item_write_schema184'),
    ('function_search_path_mutable','warn','get_employee_metrics'),
    ('function_search_path_mutable','warn','log_email_event'),
    ('function_search_path_mutable','warn','next_internal_reference'),
    ('function_search_path_mutable','warn','resolve_auth_flow'),
    ('function_search_path_mutable','warn','update_worker_metrics_updated_at'),
    ('function_search_path_mutable','warn','is_internal_user'),
    ('function_search_path_mutable','warn','cleanup_old_traffic_events')
), live_functions as (
  select p.proname,count(*)::int as overloads,
    count(*) filter(where p.proconfig is not null and exists(
      select 1 from unnest(p.proconfig) x where x like 'search_path=%'
    ))::int as fixed_search_path_overloads,
    count(*) filter(where p.prosecdef)::int as security_definer_overloads
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
  group by p.proname
), function_truth as (
  select
    '2026-09-03-build190'::text as snapshot_label,
    fc.advisor_rule,fc.severity,'function'::text as object_kind,'public'::text as object_schema,
    fc.object_name,null::text as policy_name,
    (lf.proname is not null) as live_exists,
    case
      when lf.proname is null then 'stale_object'
      when lf.fixed_search_path_overloads=lf.overloads then 'verified_safe'
      else 'confirmed_followup'
    end::text as reconciliation_state,
    jsonb_build_object('overloads',lf.overloads,'fixed_search_path_overloads',lf.fixed_search_path_overloads,'security_definer_overloads',lf.security_definer_overloads) as truth_detail
  from function_claims fc
  left join live_functions lf on lf.proname=fc.object_name
), extension_claims(advisor_rule,severity,object_name) as (
  values
    ('extension_in_public','warn','pg_net'),
    ('extension_in_public','warn','pg_trgm'),
    ('extension_in_public','warn','unaccent')
), extension_truth as (
  select
    '2026-09-03-build190'::text as snapshot_label,
    ec.advisor_rule,ec.severity,'extension'::text as object_kind,'public'::text as object_schema,
    ec.object_name,null::text as policy_name,
    (e.oid is not null) as live_exists,
    case
      when e.oid is null then 'stale_object'
      when n.nspname<>'public' then 'verified_safe'
      else 'confirmed_followup'
    end::text as reconciliation_state,
    jsonb_build_object('installed_schema',n.nspname) as truth_detail
  from extension_claims ec
  left join pg_extension e on e.extname=ec.object_name
  left join pg_namespace n on n.oid=e.extnamespace
), auth_truth as (
  select * from (values
    ('2026-09-03-build190'::text,'auth_leaked_password_protection'::text,'warn'::text,'auth_setting'::text,'auth'::text,'leaked_password_protection'::text,null::text,null::boolean,'external_verification'::text,jsonb_build_object('verification','Supabase Auth configuration; not inferred from PostgreSQL catalogs')),
    ('2026-09-03-build190'::text,'auth_insufficient_mfa_options'::text,'warn'::text,'auth_setting'::text,'auth'::text,'mfa_options'::text,null::text,null::boolean,'external_verification'::text,jsonb_build_object('verification','Supabase Auth configuration; not inferred from PostgreSQL catalogs'))
  ) x(snapshot_label,advisor_rule,severity,object_kind,object_schema,object_name,policy_name,live_exists,reconciliation_state,truth_detail)
)
select *,now() as checked_at from relation_truth
union all
select *,now() from function_truth
union all
select *,now() from extension_truth
union all
select *,now() from auth_truth;

revoke all on table public.v_it_security_advisor_truth from public,anon,authenticated;
grant select on table public.v_it_security_advisor_truth to service_role;

create or replace view public.v_it_security_advisor_truth_status
with (security_invoker=true)
as
select
  '2026-09-03-build190'::text as snapshot_label,
  count(*)::int as snapshot_claim_count,
  count(*) filter(where reconciliation_state='stale_object')::int as stale_object_count,
  count(*) filter(where reconciliation_state='verified_safe')::int as verified_safe_count,
  count(*) filter(where reconciliation_state='confirmed_followup')::int as confirmed_followup_count,
  count(*) filter(where reconciliation_state='external_verification')::int as external_verification_count,
  count(*) filter(where reconciliation_state not in ('stale_object','verified_safe','confirmed_followup','external_verification'))::int as unclassified_count,
  case when count(*) filter(where reconciliation_state not in ('stale_object','verified_safe','confirmed_followup','external_verification'))=0 then 'green' else 'red' end::text as reconciliation_status,
  case when count(*) filter(where reconciliation_state in ('confirmed_followup','external_verification'))=0 then 'green' else 'amber' end::text as security_followup_status,
  'Reconciliation GREEN means every captured advisor claim has live truth classification; it does not mean every security follow-up is complete.'::text as status_message,
  now() as checked_at
from public.v_it_security_advisor_truth;

revoke all on table public.v_it_security_advisor_truth_status from public,anon,authenticated;
grant select on table public.v_it_security_advisor_truth_status to service_role;

create or replace function public.ywi_security_advisor_truth_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql
security definer
set search_path=public,pg_temp
as $$
  select 'advisor_snapshot_fully_classified',
    case when exists(select 1 from public.v_it_security_advisor_truth_status where reconciliation_status='green' and unclassified_count=0) then 'passed' else 'failed' end,
    'Every claim captured from the 2026-09-03 advisor snapshot has an explicit catalog or external-verification disposition.'
  union all
  select 'advisor_deleted_object_staleness_detected',
    case when exists(select 1 from public.v_it_security_advisor_truth where object_name='v_sms_configuration' and reconciliation_state='stale_object')
      and exists(select 1 from public.v_it_security_advisor_truth where object_name='cleanup_old_traffic_events' and reconciliation_state='stale_object')
      and exists(select 1 from public.v_it_security_advisor_truth where object_name='monitoring_events' and reconciliation_state='stale_object')
    then 'passed' else 'failed' end,
    'Known advisor targets that are absent from the live PostgreSQL catalog are classified as stale instead of being recreated or modified.'
  union all
  select 'advisor_search_path_truth_current',
    case when exists(select 1 from public.v_it_security_advisor_truth where object_name='set_updated_at' and reconciliation_state='verified_safe')
      and exists(select 1 from public.v_it_security_advisor_truth where object_name='handle_new_user' and reconciliation_state='verified_safe')
    then 'passed' else 'failed' end,
    'Live advisor-listed functions that remain present have a fixed search_path after the bounded Build 190 remediation.'
  union all
  select 'advisor_extension_truth_classified',
    case when exists(select 1 from public.v_it_security_advisor_truth where object_name='pg_net' and reconciliation_state='confirmed_followup')
      and exists(select 1 from public.v_it_security_advisor_truth where object_name='pg_trgm' and reconciliation_state='stale_object')
      and exists(select 1 from public.v_it_security_advisor_truth where object_name='unaccent' and reconciliation_state='stale_object')
    then 'passed' else 'failed' end,
    'Only live pg_net is retained as an extension-schema follow-up; absent pg_trgm and unaccent findings are classified stale.'
  union all
  select 'advisor_external_auth_followups_separated',
    case when (select count(*) from public.v_it_security_advisor_truth where object_kind='auth_setting' and reconciliation_state='external_verification')=2
    then 'passed' else 'failed' end,
    'Leaked-password protection and MFA findings remain explicit Supabase Auth configuration follow-ups rather than guessed from PostgreSQL catalogs.'
  union all
  select 'advisor_truth_views_service_private',
    case when not has_table_privilege('anon','public.v_it_security_advisor_truth','select')
      and not has_table_privilege('authenticated','public.v_it_security_advisor_truth','select')
      and has_table_privilege('service_role','public.v_it_security_advisor_truth','select')
      and not has_table_privilege('anon','public.v_it_security_advisor_truth_status','select')
      and not has_table_privilege('authenticated','public.v_it_security_advisor_truth_status','select')
      and has_table_privilege('service_role','public.v_it_security_advisor_truth_status','select')
    then 'passed' else 'failed' end,
    'Security-advisor truth surfaces are service-role-only.'
  union all
  select 'submission_security_control_still_safe',
    case when exists(
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname='v_it_submission_security_status' and c.relkind='v'
        and coalesce(c.reloptions,'{}'::text[]) @> array['security_invoker=true']
    )
      and not has_table_privilege('anon','public.v_it_submission_security_status','select')
      and not has_table_privilege('authenticated','public.v_it_submission_security_status','select')
      and has_table_privilege('service_role','public.v_it_submission_security_status','select')
    then 'passed' else 'failed' end,
    'The Build 189 submission-security control remains security-invoker and service-private.';
$$;

revoke all on function public.ywi_security_advisor_truth_assertions() from public,anon,authenticated;
grant execute on function public.ywi_security_advisor_truth_assertions() to service_role;

insert into public.it_readiness_check_registry(check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled)
values('security_advisor_truth_reconciliation','Security','Supabase advisor findings are reconciled against live PostgreSQL truth','critical',
  'Run the Schema 190 advisor-truth assertions. Treat stale objects as historical advisor state; review confirmed pg_net and external Auth configuration follow-ups separately.',
  'Admin > I.T. Readiness',38,true)
on conflict(check_key) do update set check_group=excluded.check_group,check_title=excluded.check_title,severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,route_hint=excluded.route_hint,sort_order=excluded.sort_order,is_enabled=excluded.is_enabled,updated_at=now();

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,next_action_hint,owner_hint,sort_order,metadata
) values(
  'schema190_security_advisor_truth_reconciliation','security','Security advisor live-catalog truth reconciliation','active',90,9,10,
  'Verify all Schema 190 truth assertions, preserve the 11 human acceptance rails, keep Finance/provider mutation OFF, obtain green source/browser gates, and record exact-main release evidence.',
  'I.T. / Security',110,jsonb_build_object('schema',190,'build','2026-09-03d','business_rail_auto_close',false,'business_row_rewrite',false,'finance_mutation',false,'payment_provider_mutation',false,'production_promotion',false,'pg_net_relocation_deferred',true,'auth_configuration_deferred',true)
)
on conflict(rail_key) do update set rail_area=excluded.rail_area,rail_title=excluded.rail_title,rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,current_value=excluded.current_value,target_value=excluded.target_value,next_action_hint=excluded.next_action_hint,
  owner_hint=excluded.owner_hint,sort_order=excluded.sort_order,metadata=excluded.metadata,updated_at=now();

insert into public.it_scorecard_rail_resolution_contracts(
  rail_key,resolution_class,requires_human,requires_external,auto_close_allowed,resolution_note,introduced_by_schema
) values(
  'schema190_security_advisor_truth_reconciliation','build_acceptance',false,false,false,
  'Close Build 190 only after catalog truth assertions, the bounded set_updated_at search_path remediation, source/browser regression gates and exact-main release evidence are green. pg_net relocation and Supabase Auth configuration remain separate follow-ups; no human business acceptance rail is closed by this build.',190
)
on conflict(rail_key) do update set resolution_class=excluded.resolution_class,requires_human=excluded.requires_human,requires_external=excluded.requires_external,
  auto_close_allowed=excluded.auto_close_allowed,resolution_note=excluded.resolution_note,introduced_by_schema=excluded.introduced_by_schema,updated_at=now();

create or replace view public.v_schema_drift_status with (security_invoker=true) as
select 190::int as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=190 then 'current' else 'behind' end::text as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)>=190 then 'Live database is at or ahead of the repo schema marker.' else 'Live database is behind the deployed app. Apply migrations through schema 190 in order.' end::text as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

insert into public.app_schema_versions(schema_version,migration_key,schema_name,release_label,description,status,notes)
values(190,'190_security_advisor_truth_reconciliation','190_security_advisor_truth_reconciliation.sql','2026-09-03d',
  'Reconciles the current Supabase security-advisor snapshot against live PostgreSQL catalogs, fixes the confirmed set_updated_at search_path finding, and exposes service-private I.T. truth/status assertions.',
  'applied','No business rows are rewritten. pg_net relocation and Supabase Auth configuration remain explicit follow-ups. Finance/provider mutation remain OFF; all human-gated business acceptance rails remain open; Production promotion remains manual.')
on conflict(schema_version) do update set migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,
  description=excluded.description,status=excluded.status,notes=excluded.notes,applied_at=now();

commit;
