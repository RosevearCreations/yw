begin;

-- Build 190 assertion repair: v_sms_configuration was an earlier advisor finding, not a
-- row in the fresh 2026-09-03 snapshot view. Verify that historical stale target directly
-- from pg_catalog while keeping fresh-snapshot rows limited to the captured current claims.

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
    case when not exists(
        select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname='v_sms_configuration'
      )
      and exists(select 1 from public.v_it_security_advisor_truth where object_name='cleanup_old_traffic_events' and reconciliation_state='stale_object')
      and exists(select 1 from public.v_it_security_advisor_truth where object_name='monitoring_events' and reconciliation_state='stale_object')
    then 'passed' else 'failed' end,
    'Historical v_sms_configuration and current advisor targets absent from the live PostgreSQL catalog are classified as stale instead of being recreated or modified.'
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

update public.app_schema_versions
set notes=concat_ws(' ',nullif(notes,''),'Build 190b keeps the fresh advisor snapshot pure and checks the historical v_sms_configuration stale target directly from pg_catalog.')
where schema_version=190 and migration_key='190_security_advisor_truth_reconciliation';

commit;
