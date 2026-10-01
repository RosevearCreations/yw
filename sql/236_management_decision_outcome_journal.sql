begin;

-- Schema 236 — Build 363 Management Decision Outcome Journal & Learning Loop.
-- Records bounded management decision/outcome evidence only. Canonical Jobs, Safety,
-- Finance, Equipment, Employment and CRM records remain authoritative.

create table if not exists public.management_decision_outcome_journal (
  id uuid primary key default gen_random_uuid(),
  decision_key text not null unique,
  source_key text not null,
  source_module text not null,
  source_type text not null,
  source_id text not null,
  recommendation_key text not null,
  recommendation_label text,
  chosen_safe_action text not null,
  decision_kind text not null default 'review',
  decision_note text,
  source_status_at_review text,
  source_priority_at_review text,
  source_due_state_at_review text,
  triage_score_at_review integer,
  outcome_status text not null default 'pending',
  outcome_note text,
  recurrence_signal boolean not null default false,
  followup_due_at timestamptz,
  followup_evidence text,
  followup_evidence_reference text,
  decision_at timestamptz not null default now(),
  outcome_recorded_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint management_decision_outcome_source_module_chk
    check (source_module in ('safety','finance','jobs','admin')),
  constraint management_decision_outcome_source_key_chk
    check (source_key = source_module || ':' || source_type || ':' || source_id),
  constraint management_decision_outcome_decision_key_chk
    check (length(btrim(decision_key)) between 8 and 240),
  constraint management_decision_outcome_recommendation_chk
    check (length(btrim(recommendation_key)) between 3 and 240),
  constraint management_decision_outcome_action_chk
    check (length(btrim(chosen_safe_action)) between 3 and 1200),
  constraint management_decision_outcome_kind_chk
    check (decision_kind in ('review','defer','resolve','escalate','follow_up')),
  constraint management_decision_outcome_status_chk
    check (outcome_status in ('pending','resolved','improved','recurring','no_change','superseded')),
  constraint management_decision_outcome_score_chk
    check (triage_score_at_review is null or triage_score_at_review between 0 and 10000),
  constraint management_decision_outcome_timestamp_chk
    check ((outcome_status='pending' and outcome_recorded_at is null)
      or (outcome_status<>'pending' and outcome_recorded_at is not null))
);

create index if not exists management_decision_outcome_source_idx
  on public.management_decision_outcome_journal(source_key,decision_at desc);
create index if not exists management_decision_outcome_status_idx
  on public.management_decision_outcome_journal(outcome_status,recurrence_signal,updated_at desc);
create index if not exists management_decision_outcome_followup_idx
  on public.management_decision_outcome_journal(followup_due_at)
  where outcome_status='pending' and followup_due_at is not null;

alter table public.management_decision_outcome_journal enable row level security;
revoke all on table public.management_decision_outcome_journal from public,anon,authenticated;
grant select,insert,update on table public.management_decision_outcome_journal to service_role;

create or replace view public.v_management_decision_outcome_journal
with (security_invoker=true) as
select
  j.id,j.decision_key,j.source_key,j.source_module,j.source_type,j.source_id,
  j.recommendation_key,j.recommendation_label,j.chosen_safe_action,j.decision_kind,j.decision_note,
  j.source_status_at_review,j.source_priority_at_review,j.source_due_state_at_review,j.triage_score_at_review,
  j.outcome_status,j.outcome_note,j.recurrence_signal,j.followup_due_at,j.followup_evidence,
  j.followup_evidence_reference,j.decision_at,j.outcome_recorded_at,j.created_by_profile_id,
  j.updated_by_profile_id,j.created_at,j.updated_at,
  count(*) over(partition by j.source_key) as source_decision_count,
  count(*) filter(where j.recurrence_signal) over(partition by j.source_key) as source_recurrence_count
from public.management_decision_outcome_journal j;
revoke all on table public.v_management_decision_outcome_journal from public,anon,authenticated;
grant select on table public.v_management_decision_outcome_journal to service_role;

insert into public.app_module_write_contracts(
  action_key,owner_module,minimum_access,boundary_mode,domain_key,event_key,cross_module_event,is_enabled,description
) values
  ('management_decision_record','admin','manage','write','management_learning','admin.management_learning.decision_recorded',false,true,
   'Record bounded management decision evidence linked to a canonical source key without mutating the source business record.'),
  ('management_outcome_update','admin','manage','write','management_learning','admin.management_learning.outcome_updated',false,true,
   'Update the outcome/recurrence/follow-up evidence for a management decision journal row without mutating the source business record.')
on conflict(action_key) do update set
  owner_module=excluded.owner_module,
  minimum_access=excluded.minimum_access,
  boundary_mode=excluded.boundary_mode,
  domain_key=excluded.domain_key,
  event_key=excluded.event_key,
  cross_module_event=excluded.cross_module_event,
  is_enabled=excluded.is_enabled,
  description=excluded.description,
  updated_at=now();

create or replace function public.ywi_module_write_boundary_security_assertions()
returns table(assertion_key text,assertion_status text,details text)
language sql stable security invoker set search_path=public as $$
  select 'operations_action_contract_count',
    case when (select count(*) from public.app_module_write_contracts where is_enabled)=92 then 'passed' else 'failed' end,
    'Exactly 92 explicitly handled operations-manage actions have enabled write-boundary contracts.'
  union all
  select 'cross_module_events_named',
    case when not exists(select 1 from public.app_module_write_contracts where is_enabled and cross_module_event and event_key is null) then 'passed' else 'failed' end,
    'Every declared cross-module effect has a stable event key.'
  union all
  select 'manual_deposit_mutation_disabled',
    case when exists(select 1 from public.app_module_write_contracts where action_key='deposit_status_update' and owner_module='finance' and boundary_mode='disabled' and is_enabled) then 'passed' else 'failed' end,
    'Hosted payment truth cannot be manually changed through operations-manage.'
  union all
  select 'weather_workability_jobs_boundary',
    case when (select count(*) from public.app_module_write_contracts where action_key in (
      'workability_rule_save','workability_observation_save','workability_decision_save','workability_notification_readiness_save'
    ) and owner_module='jobs' and minimum_access='approve' and boundary_mode='write' and is_enabled)=4 then 'passed' else 'failed' end,
    'Build 342 weather/workability writes remain explicit Jobs-approve contracts.'
  union all
  select 'landscape_material_estimator_jobs_boundary',
    case when (select count(*) from public.app_module_write_contracts where action_key in (
      'landscape_material_estimate_save','landscape_material_actual_use_save'
    ) and owner_module='jobs' and minimum_access='approve' and boundary_mode='write' and is_enabled)=2 then 'passed' else 'failed' end,
    'Build 343 material-estimator writes remain explicit Jobs-approve contracts.'
  union all
  select 'change_orders_extras_jobs_boundary',
    case when (select count(*) from public.app_module_write_contracts where action_key in (
      'change_order_discovery_save','change_order_evidence_save','change_order_review_price',
      'change_order_customer_authorization','change_order_apply','change_order_invoice_evidence_save'
    ) and owner_module='jobs' and boundary_mode='write' and is_enabled)=6 then 'passed' else 'failed' end,
    'Build 344 change-order actions remain explicit Jobs contracts.'
  union all
  select 'quality_control_jobs_boundary',
    case when (select count(*) from public.app_module_write_contracts where action_key in (
      'quality_control_template_save','quality_control_run_save','quality_control_evidence_link',
      'quality_control_deficiency_save','quality_control_rework_save','quality_control_review'
    ) and owner_module='jobs' and boundary_mode='write' and is_enabled)=6 then 'passed' else 'failed' end,
    'Build 345 QC actions remain explicit Jobs contracts.'
  union all
  select 'seasonal_operations_jobs_boundary',
    case when (select count(*) from public.app_module_write_contracts where action_key in (
      'seasonal_cycle_save','seasonal_checklist_save','seasonal_readiness_save',
      'seasonal_rollover_save','seasonal_storm_event_save','seasonal_storm_route_activation_save'
    ) and owner_module='jobs' and minimum_access='approve' and boundary_mode='write' and is_enabled)=6 then 'passed' else 'failed' end,
    'Build 346 seasonal-cycle/checklist/readiness/rollover/storm actions are explicit Jobs-approve contracts.'
  union all
  select 'management_learning_admin_boundary',
    case when (select count(*) from public.app_module_write_contracts
      where action_key in ('management_decision_record','management_outcome_update')
        and owner_module='admin' and minimum_access='manage' and boundary_mode='write' and is_enabled)=2
      then 'passed' else 'failed' end,
    'Build 363 decision/outcome learning writes are explicit Admin-manage contracts.'
  union all
  select 'boundary_control_plane_private',
    case when not exists(select 1 from information_schema.table_privileges where table_schema='public'
      and table_name in ('app_module_write_contracts','module_boundary_events','v_module_boundary_event_contract_status',
        'operations_attention_states','management_decision_outcome_journal','v_management_decision_outcome_journal')
      and grantee in ('anon','authenticated','PUBLIC')) then 'passed' else 'failed' end,
    'Boundary contracts, events, attention state and management learning evidence remain private server control-plane data.';
$$;
revoke all on function public.ywi_module_write_boundary_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_module_write_boundary_security_assertions() to service_role;

create or replace function public.ywi_management_decision_outcome_security_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql stable security invoker set search_path=public as $$
  select 'journal_rls_enabled',
    case when coalesce((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname='management_decision_outcome_journal'),false)
      then 'passed' else 'failed' end,
    'Management decision/outcome journal has RLS enabled.'
  union all
  select 'journal_browser_private',
    case when not exists(select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('management_decision_outcome_journal','v_management_decision_outcome_journal')
        and grantee in ('anon','authenticated','PUBLIC'))
      then 'passed' else 'failed' end,
    'Journal table and view are private to service-side authority.'
  union all
  select 'journal_actions_admin_managed',
    case when (select count(*) from public.app_module_write_contracts
      where action_key in ('management_decision_record','management_outcome_update')
        and owner_module='admin' and minimum_access='manage' and boundary_mode='write' and is_enabled)=2
      then 'passed' else 'failed' end,
    'Decision and outcome writes require Admin manage authority.'
  union all
  select 'source_records_not_duplicated',
    case when not exists(select 1 from information_schema.columns
      where table_schema='public' and table_name='management_decision_outcome_journal'
        and column_name in ('source_payload','request_payload','response_payload'))
      then 'passed' else 'failed' end,
    'Journal stores source identity/status evidence, not copied source business payloads.'
  union all
  select 'finance_provider_execution_off',
    case when not exists(select 1 from public.finance_job_completion_posting_execution_controls
      where execution_enabled=true or provider_mutation_enabled=true)
      then 'passed' else 'failed' end,
    'Build 363 does not enable Finance posting or payment-provider mutation.';
$$;
revoke all on function public.ywi_management_decision_outcome_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_management_decision_outcome_security_assertions() to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values(
  236,'management_decision_outcome_journal',
  'Build 363 adds a private bounded management decision/outcome learning journal linked to canonical source keys.',
  'applied',now(),'schema236',
  'Learning evidence only. Canonical source records are not duplicated or auto-mutated; Finance/provider execution remains fail-closed.',
  '236_management_decision_outcome_journal.sql','schema236'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true) as
select 236 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)=236 then 'current'
       when coalesce(max(schema_version) filter(where status='applied'),0)>236 then 'ahead' else 'drift' end as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)=236 then 'Live database matches the repository schema marker.'
       when coalesce(max(schema_version) filter(where status='applied'),0)>236 then 'Live database is ahead of the repository schema marker.'
       else 'Live database is behind the repository schema marker.' end as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

select 236 as expected_schema_version;

commit;
