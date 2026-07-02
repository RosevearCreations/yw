-- Schema 154: Human-reviewed release readiness dashboard and captured evidence snapshots.
-- This migration does not deploy, publish, charge, or release anything automatically.
-- It converts existing staging, policy, backup-rehearsal, payment, accounting, and
-- public-content evidence into a single review surface plus an auditable snapshot.
begin;

create table if not exists public.release_readiness_review_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique default ('release_review_' || gen_random_uuid()::text),
  review_scope text not null default 'staging',
  review_status text not null default 'captured',
  reviewer_profile_id uuid references public.profiles(id) on delete set null,
  reviewer_note text,
  dashboard_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (review_scope in ('staging','production_candidate')),
  check (review_status in ('captured','superseded','archived'))
);
create index if not exists release_readiness_review_snapshots_recent_idx
  on public.release_readiness_review_snapshots(created_at desc, review_scope, review_status);

alter table public.release_readiness_review_snapshots enable row level security;
revoke all on public.release_readiness_review_snapshots from anon, authenticated;

-- Extend the existing policy evidence function without changing its output columns.
create or replace function public.ywi_security_policy_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
security definer
set search_path = public, storage, pg_catalog
as $$
  with required_tables(table_name) as (
    values ('visual_asset_approval_items'),('accountant_handoff_exports'),('estimate_quote_packages'),
           ('customer_deposit_requests'),('operations_staging_fixture_sets'),('content_signal_observations'),
           ('release_readiness_review_snapshots')
  ), checks as (
    select 'review_assets_private'::text as assertion_key,
      case when exists(select 1 from storage.buckets where id='review-assets' and public=false) then 'passed' else 'failed' end as assertion_status,
      'Review uploads must remain in a private bucket until approved.'::text as details
    union all select 'accountant_exports_private', case when exists(select 1 from storage.buckets where id='accountant-exports' and public=false) then 'passed' else 'failed' end,
      'Accountant ZIP packages must remain private and use signed downloads.'
    union all select 'public_assets_bucket_present', case when exists(select 1 from storage.buckets where id='public-assets' and public=true) then 'passed' else 'failed' end,
      'Public assets may be public only after the approval-copy workflow promotes them.'
    union all select 'sensitive_tables_rls_enabled', case when not exists(
      select 1 from required_tables r left join pg_class c on c.relname=r.table_name and c.relnamespace='public'::regnamespace where coalesce(c.relrowsecurity,false)=false
    ) then 'passed' else 'failed' end,
      'Sensitive direct-data and release-evidence tables must have Row Level Security enabled.'
    union all select 'portal_rpc_not_public', case when not exists(
      select 1 from information_schema.routine_privileges rp
      where rp.routine_schema='public' and rp.routine_name='ywi_rpc_accept_quote_package' and rp.grantee in ('anon','authenticated') and rp.privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
      'Portal conversion RPC is callable only through the token-validating service function.'
    union all select 'release_snapshot_rpc_not_public', case when not exists(
      select 1 from information_schema.routine_privileges rp
      where rp.routine_schema='public' and rp.routine_name='ywi_rpc_capture_release_readiness_snapshot' and rp.grantee in ('anon','authenticated') and rp.privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
      'Release-readiness snapshots may be captured only by the protected service workflow.'
  ) select * from checks;
$$;

create or replace view public.v_security_policy_assertion_summary as
select count(*)::int as assertion_count,
       count(*) filter (where assertion_status='passed')::int as passed_count,
       count(*) filter (where assertion_status='failed')::int as failed_count,
       coalesce(jsonb_agg(jsonb_build_object('assertion_key',assertion_key,'assertion_status',assertion_status,'details',details) order by assertion_key), '[]'::jsonb) as assertions,
       count(*) filter (where assertion_status='failed')=0 as policy_ready
from public.ywi_security_policy_assertions();

-- Read-only dashboard. It identifies the separate evidence categories so a
-- human can review them; it does not make or apply a production release.
create or replace view public.v_release_readiness_dashboard as
with schema_state as (
  select * from public.v_schema_drift_status limit 1
), policy_state as (
  select * from public.v_security_policy_assertion_summary limit 1
), staging_state as (
  select run_status, started_at, finished_at, passed_count, case_count, failed_count, skipped_count, failure_reason
  from public.v_operations_staging_test_summary
  where environment_label='staging'
  order by started_at desc
  limit 1
), backup_state as (
  select rehearsal_status, rehearsal_at, updated_at, rehearsal_scope, result_summary, next_action, evidence_url
  from public.admin_backup_restore_rehearsals
  order by coalesce(rehearsal_at, updated_at) desc
  limit 1
), stripe_state as (
  select * from public.v_stripe_webhook_health limit 1
), alert_state as (
  select count(*) filter (where alert_status in ('open','acknowledged'))::int as unresolved_alert_count,
         count(*) filter (where alert_status in ('open','acknowledged') and severity='critical')::int as critical_alert_count
  from public.stripe_webhook_operational_alerts
), accountant_state as (
  select * from public.v_accountant_export_readiness limit 1
), route_state as (
  select count(*)::int as total_route_count,
         count(*) filter (where route_status in ('approved','published'))::int as approved_route_count,
         count(*) filter (where route_status in ('approved','published') and publication_ready=false)::int as blocked_approved_route_count,
         count(*) filter (where route_status in ('draft','review'))::int as pending_route_count
  from public.v_public_route_publication_readiness
), asset_state as (
  select count(*) filter (where surface_area='public' and asset_status in ('draft','review'))::int as pending_public_asset_count,
         count(*) filter (where surface_area='public' and asset_status='approved' and publication_ready=true)::int as approved_public_asset_count
  from public.v_visual_asset_publication_readiness
), content_signal_state as (
  select count(*)::int as unresolved_content_signal_count
  from public.v_route_content_decision_queue
), latest_snapshot as (
  select id, review_scope, review_status, created_at, reviewer_note
  from public.release_readiness_review_snapshots
  where review_status='captured'
  order by created_at desc
  limit 1
)
select
  ss.expected_schema_version,
  ss.latest_applied_schema_version,
  ss.drift_status as schema_status,
  ss.message as schema_message,
  coalesce(ps.policy_ready,false) as policy_ready,
  coalesce(ps.passed_count,0)::int as policy_passed_count,
  coalesce(ps.assertion_count,0)::int as policy_assertion_count,
  coalesce(st.run_status,'not_recorded') as latest_staging_run_status,
  st.started_at as latest_staging_run_started_at,
  st.finished_at as latest_staging_run_finished_at,
  coalesce(st.passed_count,0)::int as latest_staging_passed_count,
  coalesce(st.case_count,0)::int as latest_staging_case_count,
  coalesce(st.failed_count,0)::int as latest_staging_failed_count,
  st.failure_reason as latest_staging_failure_reason,
  coalesce(bs.rehearsal_status,'not_recorded') as backup_rehearsal_status,
  bs.rehearsal_at as backup_rehearsal_at,
  bs.rehearsal_scope as backup_rehearsal_scope,
  bs.result_summary as backup_rehearsal_summary,
  bs.next_action as backup_rehearsal_next_action,
  bs.evidence_url as backup_rehearsal_evidence_url,
  coalesce(ws.failed_24h,0)::int as webhook_failed_24h,
  coalesce(ws.processed_24h,0)::int as webhook_processed_24h,
  ws.latest_event_at as webhook_latest_event_at,
  coalesce(asl.unresolved_alert_count,0)::int as unresolved_webhook_alert_count,
  coalesce(asl.critical_alert_count,0)::int as critical_webhook_alert_count,
  coalesce(ac.package_ready,false) as accountant_package_ready,
  coalesce(ac.unresolved_required_mapping_count,0)::int as accountant_unresolved_mapping_count,
  coalesce(rs.total_route_count,0)::int as total_route_count,
  coalesce(rs.approved_route_count,0)::int as approved_route_count,
  coalesce(rs.blocked_approved_route_count,0)::int as blocked_approved_route_count,
  coalesce(rs.pending_route_count,0)::int as pending_route_count,
  coalesce(ast.pending_public_asset_count,0)::int as pending_public_asset_count,
  coalesce(ast.approved_public_asset_count,0)::int as approved_public_asset_count,
  coalesce(css.unresolved_content_signal_count,0)::int as unresolved_content_signal_count,
  ls.id as latest_snapshot_id,
  ls.review_scope as latest_snapshot_scope,
  ls.created_at as latest_snapshot_at,
  ls.reviewer_note as latest_snapshot_note,
  case when ss.drift_status='current'
              and coalesce(ps.policy_ready,false)
              and coalesce(st.run_status,'not_recorded')='passed'
              and coalesce(bs.rehearsal_status,'not_recorded')='passed'
              and coalesce(asl.critical_alert_count,0)=0
       then 'staging_evidence_ready' else 'staging_review_required' end as staging_evidence_status,
  case when coalesce(rs.approved_route_count,0)>0
              and coalesce(rs.blocked_approved_route_count,0)=0
              and coalesce(ast.pending_public_asset_count,0)=0
       then 'public_content_ready' else 'public_content_review_required' end as public_content_status,
  case when ss.drift_status='current'
              and coalesce(ps.policy_ready,false)
              and coalesce(st.run_status,'not_recorded')='passed'
              and coalesce(bs.rehearsal_status,'not_recorded')='passed'
              and coalesce(asl.critical_alert_count,0)=0
       then 'Staging evidence is complete enough for human release review. It does not authorize or perform a production release.'
       else 'One or more staging-evidence checks are incomplete. Review the cards, run the missing proof, and capture a fresh review snapshot.' end as dashboard_message,
  now() as checked_at
from schema_state ss
left join policy_state ps on true
left join staging_state st on true
left join backup_state bs on true
left join stripe_state ws on true
left join alert_state asl on true
left join accountant_state ac on true
left join route_state rs on true
left join asset_state ast on true
left join content_signal_state css on true
left join latest_snapshot ls on true;

create or replace function public.ywi_rpc_capture_release_readiness_snapshot(
  p_actor_profile_id uuid,
  p_review_scope text,
  p_reviewer_note text default null,
  p_confirmation_phrase text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope text := lower(trim(coalesce(p_review_scope,'staging')));
  v_dashboard jsonb;
  v_snapshot public.release_readiness_review_snapshots%rowtype;
begin
  if coalesce(public.ywi_profile_rank(p_actor_profile_id),0) < 45 then
    raise exception 'Only a job admin or higher may capture a release-readiness snapshot.' using errcode='42501';
  end if;
  if v_scope not in ('staging','production_candidate') then
    raise exception 'Review scope must be staging or production_candidate.' using errcode='22023';
  end if;
  if upper(trim(coalesce(p_confirmation_phrase,''))) <> 'REVIEW ONLY' then
    raise exception 'Type REVIEW ONLY to confirm that a snapshot is evidence, not a production release.' using errcode='22023';
  end if;

  select to_jsonb(d) into v_dashboard from public.v_release_readiness_dashboard d limit 1;
  insert into public.release_readiness_review_snapshots(
    review_scope, review_status, reviewer_profile_id, reviewer_note, dashboard_snapshot
  ) values (
    v_scope, 'captured', p_actor_profile_id, nullif(trim(coalesce(p_reviewer_note,'')),''), coalesce(v_dashboard,'{}'::jsonb)
  ) returning * into v_snapshot;

  return jsonb_build_object(
    'snapshot_id',v_snapshot.id,
    'snapshot_key',v_snapshot.snapshot_key,
    'review_scope',v_snapshot.review_scope,
    'created_at',v_snapshot.created_at,
    'staging_evidence_status',coalesce(v_dashboard->>'staging_evidence_status','unknown'),
    'public_content_status',coalesce(v_dashboard->>'public_content_status','unknown'),
    'message','Release-readiness evidence snapshot captured. No production release was performed.'
  );
end;
$$;

-- Append the new capability without weakening existing server-side rank checks.
create or replace function public.ywi_get_operations_capabilities(p_actor_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := lower(coalesce((select role from public.profiles where id = p_actor_profile_id and coalesce(is_active,true) is true), ''));
  v_rank integer := coalesce(public.ywi_profile_rank(p_actor_profile_id), 0);
  v_actions jsonb;
begin
  select coalesce(jsonb_object_agg(action_key,
    jsonb_build_object(
      'label', label,
      'minimum_role', minimum_role,
      'minimum_rank', minimum_rank,
      'permitted', v_rank >= minimum_rank,
      'reason', case when v_rank >= minimum_rank then 'Allowed for your role.' else 'Requires ' || replace(minimum_role, '_', ' ') || ' or higher.' end
    )
  ), '{}'::jsonb)
  into v_actions
  from (values
    ('payment_action_request','Create payment action','job_admin',45),
    ('payment_action_decision','Approve, reject, or post payment','job_admin',45),
    ('bank_csv_preview','Parse bank CSV','job_admin',45),
    ('bank_csv_confirm_import','Promote confirmed bank rows','job_admin',45),
    ('reconciliation_action','Process reconciliation','job_admin',45),
    ('equipment_scan_event','Record equipment custody scan','site_leader',20),
    ('equipment_cost_recovery_decision','Approve equipment recovery','job_admin',45),
    ('visual_asset_register','Register visual asset','supervisor',30),
    ('visual_asset_decision','Approve or reject visual asset','job_admin',45),
    ('public_route_register','Save public route','job_admin',45),
    ('public_route_decision','Approve or reject public route','job_admin',45),
    ('public_route_publish','Publish public route and sitemap','job_admin',45),
    ('quote_owner_assign','Assign quote owner','supervisor',30),
    ('quote_followup_event','Record quote follow-up','supervisor',30),
    ('dispatch_schedule','Dispatch work order','supervisor',30),
    ('job_cost_refresh','Refresh live job cost','supervisor',30),
    ('accountant_export_prepare','Generate accountant package','job_admin',45),
    ('staging_fixture_create','Create disposable staging fixture','job_admin',45),
    ('staging_fixture_cleanup','Clean disposable staging fixture','job_admin',45),
    ('content_signal_record','Record search/local performance evidence','job_admin',45),
    ('content_signal_decision','Decide route/content follow-up','job_admin',45),
    ('stripe_webhook_alert_decision','Acknowledge or resolve webhook alert','job_admin',45),
    ('release_readiness_snapshot','Capture release evidence snapshot','job_admin',45)
  ) as permissions(action_key, label, minimum_role, minimum_rank);
  return jsonb_build_object('actor_profile_id',p_actor_profile_id,'actor_role',coalesce(v_role,'unknown'),'actor_rank',v_rank,'actions',v_actions,'generated_at',now());
end;
$$;

-- Schema marker. Keep this view disposable: it is a compatibility/status view,
-- not a source of deployment truth.
create or replace view public.v_schema_drift_status as
select 154::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=154 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=154
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 154.' end as message,
  now() as checked_at
from public.app_schema_versions;

insert into public.app_schema_versions(schema_version,migration_key,schema_name,release_label,description,status,notes)
values(154,'154_release_readiness_dashboard_and_evidence_snapshots','154_release_readiness_dashboard_and_evidence_snapshots.sql','2026-06-30a',
  'Adds a human-reviewed release-readiness dashboard and captured evidence snapshots without automatic deployment or publishing.',
  'applied','Schema 154 combines schema, policy, staging proof, backup rehearsal, webhook, accountant, and content readiness into a review dashboard; capture requires an admin and REVIEW ONLY confirmation.')
on conflict (schema_version) do update set migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,description=excluded.description,status=excluded.status,notes=excluded.notes,applied_at=now();

revoke all on function public.ywi_rpc_capture_release_readiness_snapshot(uuid,text,text,text) from public;
revoke all on function public.ywi_security_policy_assertions() from public;
grant execute on function public.ywi_rpc_capture_release_readiness_snapshot(uuid,text,text,text) to service_role;
grant execute on function public.ywi_security_policy_assertions() to service_role;
revoke all on public.v_release_readiness_dashboard from anon, authenticated;

commit;
