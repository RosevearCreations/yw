-- Schema 167: Real cross-module event wiring.
-- Build 2026-09-01i.
--
-- Purpose:
-- - Publish Admin profile-access changes and Jobs scheduling facts from the real mutation transactions.
-- - Align dispatch_schedule with the formal jobs.job_scheduled outbox contract.
-- - Require dispatch to resolve through the canonical jobs identity owned by Shared Core.
-- - Keep the outbox private and server-only; no browser/client publication path is introduced.
-- - Make I.T. release source evidence follow the current schema marker instead of hardcoding Schema 166.

begin;

-- The operations write contract previously described dispatch scheduling as a Jobs-local event even
-- though Schema 164 already defines jobs.job_scheduled as a formal Jobs -> Safety/Admin contract.
-- Converge those two authorities before wiring the mutation.
insert into public.app_module_write_contracts(
  action_key,owner_module,minimum_access,boundary_mode,domain_key,event_key,cross_module_event,is_enabled,description
) values (
  'dispatch_schedule','jobs','approve','write','dispatch','jobs.job_scheduled',true,true,
  'Schedule canonical work and publish jobs.job_scheduled for Safety/Admin consumers.'
)
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

-- Any effective module-access change written through the canonical Admin RPC already inserts one
-- app_module_permission_audit row in the same transaction. Publish from that durable audit fact so
-- a permission mutation and its invalidation event either both commit or both roll back.
create or replace function public.ywi_emit_profile_access_changed()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
begin
  perform public.ywi_publish_cross_module_event(
    'admin',
    'admin.profile_access_changed',
    'profile',
    new.target_profile_id::text,
    jsonb_build_object(
      'contract_version',1,
      'audit_id',new.id,
      'module_key',new.module_key,
      'previous_access_level',new.previous_access_level,
      'new_access_level',new.new_access_level,
      'actor_profile_id',new.actor_profile_id,
      'change_reason',new.change_reason
    ),
    'admin.profile_access_changed:audit:' || new.id::text,
    new.created_at
  );
  return new;
end;
$$;

revoke all on function public.ywi_emit_profile_access_changed() from public, anon, authenticated;

drop trigger if exists trg_emit_profile_access_changed on public.app_module_permission_audit;
create trigger trg_emit_profile_access_changed
after insert on public.app_module_permission_audit
for each row execute function public.ywi_emit_profile_access_changed();

-- Dispatch must resolve to one canonical public.jobs row before it can become a scheduling fact.
-- The BEFORE trigger also locks the work-order row so concurrent scheduling writes cannot publish
-- against a drifting work-order/job relationship.
create or replace function public.ywi_prepare_dispatch_job_schedule()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_job_id bigint;
  v_route_id uuid;
begin
  if new.work_order_id is null then
    raise exception 'A canonical work_order_id is required before scheduling.' using errcode='23502';
  end if;

  select legacy_job_id,route_id
  into v_job_id,v_route_id
  from public.work_orders
  where id=new.work_order_id
  for update;

  if not found then
    raise exception 'Work order % does not exist.', new.work_order_id using errcode='23503';
  end if;
  if v_job_id is null then
    raise exception 'Work order % must resolve to canonical jobs.id before scheduling.', new.work_order_id using errcode='23503';
  end if;
  if new.job_id is not null and new.job_id is distinct from v_job_id then
    raise exception 'Dispatch job_id % does not match the work order canonical job_id %.', new.job_id, v_job_id using errcode='23514';
  end if;
  if new.scheduled_start is null or new.scheduled_end is null or new.scheduled_end <= new.scheduled_start then
    raise exception 'A valid scheduled_start and scheduled_end are required.' using errcode='22007';
  end if;

  new.job_id := v_job_id;
  if new.route_id is null then new.route_id := v_route_id; end if;
  return new;
end;
$$;

revoke all on function public.ywi_prepare_dispatch_job_schedule() from public, anon, authenticated;

drop trigger if exists trg_prepare_dispatch_job_schedule on public.dispatch_schedule_items;
create trigger trg_prepare_dispatch_job_schedule
before insert on public.dispatch_schedule_items
for each row execute function public.ywi_prepare_dispatch_job_schedule();

-- The dispatch row, canonical work-order scheduling state, and jobs.job_scheduled event now share
-- one Postgres transaction. A publisher/contract failure rolls back the scheduling mutation.
create or replace function public.ywi_emit_job_scheduled()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
begin
  update public.work_orders
  set scheduled_start=new.scheduled_start,
      scheduled_end=new.scheduled_end,
      supervisor_profile_id=coalesce(new.assigned_supervisor_profile_id,supervisor_profile_id),
      status='scheduled',
      updated_at=now()
  where id=new.work_order_id;

  if not found then
    raise exception 'Work order % disappeared during scheduling.', new.work_order_id using errcode='23503';
  end if;

  perform public.ywi_publish_cross_module_event(
    'jobs',
    'jobs.job_scheduled',
    'job',
    new.job_id::text,
    jsonb_build_object(
      'contract_version',1,
      'dispatch_schedule_item_id',new.id,
      'work_order_id',new.work_order_id,
      'job_id',new.job_id,
      'schedule_status',new.schedule_status,
      'scheduled_start',new.scheduled_start,
      'scheduled_end',new.scheduled_end,
      'assigned_supervisor_profile_id',new.assigned_supervisor_profile_id,
      'route_id',new.route_id,
      'actor_profile_id',new.dispatched_by_profile_id
    ),
    'jobs.job_scheduled:dispatch:' || new.id::text,
    new.created_at
  );

  return new;
end;
$$;

revoke all on function public.ywi_emit_job_scheduled() from public, anon, authenticated;

drop trigger if exists trg_emit_job_scheduled on public.dispatch_schedule_items;
create trigger trg_emit_job_scheduled
after insert on public.dispatch_schedule_items
for each row execute function public.ywi_emit_job_scheduled();

create or replace view public.v_cross_module_event_wiring_status
with (security_invoker=true)
as
select
  'admin_profile_access_change'::text as wiring_key,
  'admin'::text as producer_module,
  'admin.profile_access_changed'::text as event_key,
  'app_module_permission_audit'::text as mutation_relation,
  exists(
    select 1 from pg_trigger
    where tgrelid='public.app_module_permission_audit'::regclass
      and tgname='trg_emit_profile_access_changed' and not tgisinternal
  ) as mutation_trigger_present,
  true as canonical_identity_required,
  'profiles.id'::text as canonical_identity,
  'audit insert and outbox publication share one transaction'::text as transaction_boundary
union all
select
  'jobs_dispatch_schedule',
  'jobs',
  'jobs.job_scheduled',
  'dispatch_schedule_items',
  exists(
    select 1 from pg_trigger
    where tgrelid='public.dispatch_schedule_items'::regclass
      and tgname='trg_prepare_dispatch_job_schedule' and not tgisinternal
  ) and exists(
    select 1 from pg_trigger
    where tgrelid='public.dispatch_schedule_items'::regclass
      and tgname='trg_emit_job_scheduled' and not tgisinternal
  ),
  true,
  'jobs.id',
  'dispatch insert, work-order schedule state and outbox publication share one transaction';

revoke all on table public.v_cross_module_event_wiring_status from public, anon, authenticated;
grant select on table public.v_cross_module_event_wiring_status to service_role;

create or replace function public.ywi_cross_module_event_wiring_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'real_wiring_contracts_present',
    case when exists(
      select 1 from public.app_cross_module_event_contracts
      where event_key='admin.profile_access_changed' and producer_module='admin' and aggregate_type='profile' and is_enabled
    ) and exists(
      select 1 from public.app_cross_module_event_contracts
      where event_key='jobs.job_scheduled' and producer_module='jobs' and aggregate_type='job' and is_enabled
    ) then 'passed' else 'failed' end,
    'The two Schema 167 mutation paths resolve to the existing versioned Schema 164 event contracts.'
  union all
  select 'admin_access_change_wired',
    case when exists(
      select 1 from pg_trigger
      where tgrelid='public.app_module_permission_audit'::regclass
        and tgname='trg_emit_profile_access_changed' and not tgisinternal
    ) then 'passed' else 'failed' end,
    'Effective Admin module-access changes publish from the durable permission audit row in the same transaction.'
  union all
  select 'dispatch_contract_is_cross_module',
    case when exists(
      select 1 from public.app_module_write_contracts
      where action_key='dispatch_schedule' and owner_module='jobs' and boundary_mode='write'
        and event_key='jobs.job_scheduled' and cross_module_event=true and is_enabled
    ) then 'passed' else 'failed' end,
    'dispatch_schedule is aligned to the formal jobs.job_scheduled cross-module contract.'
  union all
  select 'dispatch_schedule_wired_atomically',
    case when exists(
      select 1 from pg_trigger
      where tgrelid='public.dispatch_schedule_items'::regclass
        and tgname='trg_prepare_dispatch_job_schedule' and not tgisinternal
    ) and exists(
      select 1 from pg_trigger
      where tgrelid='public.dispatch_schedule_items'::regclass
        and tgname='trg_emit_job_scheduled' and not tgisinternal
    ) then 'passed' else 'failed' end,
    'Dispatch validates canonical job identity, updates scheduling state, and publishes from database triggers.'
  union all
  select 'dispatch_canonical_job_fk_present',
    case when exists(
      select 1 from pg_constraint c
      where c.conrelid='public.work_orders'::regclass
        and c.confrelid='public.jobs'::regclass
        and c.contype='f'
    ) then 'passed' else 'failed' end,
    'Work orders retain a foreign-key path to canonical public.jobs identity.'
  union all
  select 'real_event_publisher_server_only',
    case when not exists(
      select 1 from information_schema.routine_privileges
      where routine_schema='public' and routine_name='ywi_publish_cross_module_event'
        and grantee in ('anon','authenticated','PUBLIC') and privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
    'The shared outbox publisher remains unavailable to browser roles.'
  union all
  select 'wiring_control_plane_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('app_cross_module_events','app_cross_module_event_contracts','v_cross_module_event_wiring_status')
        and grantee in ('anon','authenticated','PUBLIC')
    ) and not exists(
      select 1 from information_schema.routine_privileges
      where routine_schema='public'
        and routine_name in ('ywi_emit_profile_access_changed','ywi_prepare_dispatch_job_schedule','ywi_emit_job_scheduled')
        and grantee in ('anon','authenticated','PUBLIC') and privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
    'Outbox/wiring state and trigger functions remain private server control-plane surfaces.';
$$;

revoke all on function public.ywi_cross_module_event_wiring_assertions() from public, anon, authenticated;
grant execute on function public.ywi_cross_module_event_wiring_assertions() to service_role;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values (
  'cross_module_event_wiring','Architecture','Real mutation paths publish their declared cross-module events','critical',
   'Repair failed Schema 167 event-wiring assertions before dependent module consumers are released.','Admin > I.T. Readiness',33,true
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

update public.admin_scorecard_progress_rails
set rail_status='complete',progress_percent=100,current_value=6,target_value=6,
    next_action_hint='Schema 166 release authority remains active and now follows the current schema marker.',
    updated_at=now()
where rail_key='schema166_it_release_authority';

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values (
  'schema167_real_event_wiring','architecture','Real cross-module event wiring','active',90,6,7,
  'Merge the exact green Schema 167 source SHA, record its main workflow evidence, and verify all live wiring/release assertions.',
  'I.T. / Architecture',87,
  '{"build":"2026-09-01i","schema":167,"wired_events":["admin.profile_access_changed","jobs.job_scheduled"],"canonical_jobs":true,"browser_publish":false}'::jsonb
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

insert into public.app_schema_versions(
  schema_version,migration_key,schema_name,release_label,description,status,notes
) values (
  167,
  '167_real_cross_module_event_wiring',
  '167_real_cross_module_event_wiring.sql',
  '2026-09-01i',
  'Wires real Admin permission and Jobs scheduling mutations to the private Schema 164 cross-module outbox, with canonical job resolution and atomic publication.',
  'applied',
  'No new customer/job/profile identity tables are introduced. I.T. remains an Admin subsection; business module count remains four. Production promotion remains manual.'
)
on conflict(schema_version) do update set
  migration_key=excluded.migration_key,
  schema_name=excluded.schema_name,
  release_label=excluded.release_label,
  description=excluded.description,
  status=excluded.status,
  notes=excluded.notes,
  applied_at=now();

create or replace view public.v_schema_drift_status as
select 167::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=167 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=167
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 167.' end as message,
  now() as checked_at
from public.app_schema_versions;

-- Schema 166 intentionally introduced exact source evidence, but its current-evidence view pinned
-- source_gate_status to schema_version=166. Make it follow v_schema_drift_status so future additive
-- releases do not recreate the stale-release-authority defect fixed in Schema 160/166.
create or replace view public.v_it_release_source_evidence_current
with (security_invoker=true)
as
with expected as (
  select expected_schema_version from public.v_schema_drift_status limit 1
)
select
  e.id,
  e.source_branch,
  e.source_sha,
  e.workflow_run_id,
  e.workflow_name,
  e.workflow_status,
  e.schema_version,
  e.branch_protection_reported,
  e.branch_policy_verified,
  case
    when e.branch_protection_reported is true and e.branch_policy_verified is true then 'green'
    when e.branch_protection_reported is false then 'amber'
    when e.branch_protection_reported is true then 'amber'
    else 'unknown'
  end as repository_enforcement_status,
  case
    when e.source_branch='main' and e.workflow_status='passed' and e.schema_version=expected.expected_schema_version then 'green'
    when e.workflow_status in ('failed','cancelled') then 'red'
    else 'amber'
  end as source_gate_status,
  e.evidence_note,
  e.recorded_by_profile_id,
  e.recorded_at
from public.it_release_source_evidence e
cross join expected
where e.schema_version=expected.expected_schema_version
order by e.recorded_at desc,e.id desc
limit 1;

revoke all on table public.v_it_release_source_evidence_current from public, anon, authenticated;
grant select on table public.v_it_release_source_evidence_current to service_role;

create or replace view public.v_it_release_authority_status
with (security_invoker=true)
as
with
schema_state as (
  select * from public.v_schema_drift_status limit 1
),
module_contract as (
  select count(*) filter (where assertion_status<>'passed')::int as failed_count
  from public.ywi_module_contract_security_assertions()
),
permission_runtime as (
  select count(*) filter (where assertion_status<>'passed')::int as failed_count
  from public.ywi_permission_runtime_security_assertions()
),
core_read as (
  select count(*) filter (where assertion_status<>'passed')::int as failed_count
  from public.ywi_core_read_model_security_assertions()
),
write_boundary as (
  select count(*) filter (where assertion_status<>'passed')::int as failed_count
  from public.ywi_module_write_boundary_security_assertions()
),
cross_module as (
  select count(*) filter (where assertion_status<>'passed')::int as failed_count
  from public.ywi_cross_module_boundary_security_assertions()
),
real_wiring as (
  select count(*) filter (where assertion_status<>'passed')::int as failed_count
  from public.ywi_cross_module_event_wiring_assertions()
),
acceptance as (
  select count(*) filter (where assertion_status<>'passed')::int as failed_count
  from public.ywi_module_acceptance_security_assertions()
),
it_control as (
  select count(*) filter (where assertion_status<>'passed')::int as failed_count
  from public.ywi_it_readiness_security_assertions()
),
module_control as (
  select count(*) filter (where assertion_status<>'passed')::int as failed_count
  from public.ywi_module_security_assertions()
),
source_state as (
  select * from public.v_it_release_source_evidence_current
),
component_state as (
  select
    coalesce(mc.failed_count,0)+coalesce(pr.failed_count,0)+coalesce(cr.failed_count,0)+coalesce(wb.failed_count,0)+
    coalesce(cm.failed_count,0)+coalesce(rw.failed_count,0)+coalesce(ac.failed_count,0)+coalesce(ic.failed_count,0)+coalesce(moc.failed_count,0) as failed_count
  from module_contract mc
  cross join permission_runtime pr
  cross join core_read cr
  cross join write_boundary wb
  cross join cross_module cm
  cross join real_wiring rw
  cross join acceptance ac
  cross join it_control ic
  cross join module_control moc
)
select
  ss.expected_schema_version as release_schema_version,
  ss.expected_schema_version,
  ss.latest_applied_schema_version,
  ss.drift_status as schema_status,
  coalesce(cs.failed_count,0)::int as contract_assertion_failures,
  case when coalesce(cs.failed_count,0)=0 then 'green' else 'red' end as contract_status,
  coalesce(src.source_branch,'not_recorded') as source_branch,
  src.source_sha,
  src.workflow_run_id,
  src.workflow_name,
  coalesce(src.workflow_status,'unknown') as workflow_status,
  coalesce(src.source_gate_status,'amber') as source_gate_status,
  coalesce(src.repository_enforcement_status,'unknown') as repository_enforcement_status,
  src.branch_protection_reported,
  coalesce(src.branch_policy_verified,false) as branch_policy_verified,
  case
    when ss.drift_status<>'current' or ss.latest_applied_schema_version < ss.expected_schema_version or coalesce(cs.failed_count,0)>0 then 'red'
    when coalesce(src.source_gate_status,'amber')='green' then 'green'
    else 'amber'
  end as release_authority_status,
  'manual_human_promotion_required'::text as production_promotion_mode,
  case
    when ss.drift_status<>'current' or ss.latest_applied_schema_version < ss.expected_schema_version then 'Database/source schema convergence is incomplete.'
    when coalesce(cs.failed_count,0)>0 then 'One or more module/Core/boundary/wiring/readiness assertions are failing.'
    when coalesce(src.source_gate_status,'amber')<>'green' then 'Record the exact successful main workflow evidence for the current schema before release review.'
    when coalesce(src.repository_enforcement_status,'unknown')<>'green' then 'Application release authority is green; repository enforcement remains separately AMBER until main protection is verifiably enforced.'
    else 'Application release authority is green. Production promotion remains a deliberate human action.'
  end as release_message,
  now() as checked_at
from schema_state ss
cross join component_state cs
left join source_state src on true;

revoke all on table public.v_it_release_authority_status from public, anon, authenticated;
grant select on table public.v_it_release_authority_status to service_role;

create or replace function public.ywi_it_release_authority_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'release_authority_four_modules',
    case when (select count(*) from public.app_modules where is_enabled=true)=4
      and not exists(select 1 from public.app_modules where module_key='it')
    then 'passed' else 'failed' end,
    'Release authority recognizes exactly Safety, Finance, Jobs and Admin; I.T. is not a fifth module.'
  union all
  select 'release_authority_it_admin_subsection',
    case when exists(
      select 1 from public.app_module_routes
      where section_id='it' and module_key='admin' and minimum_access_level='manage' and is_enabled=true
    ) then 'passed' else 'failed' end,
    'I.T. Readiness remains an Admin/manage subsection.'
  union all
  select 'release_authority_control_plane_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('it_release_source_evidence','v_it_release_source_evidence_current','v_it_release_authority_status')
        and grantee in ('anon','authenticated','PUBLIC')
    ) and exists(
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname='it_release_source_evidence' and c.relrowsecurity=true
    ) then 'passed' else 'failed' end,
    'Release source evidence and authority views are private service control-plane data.'
  union all
  select 'release_authority_capture_service_role_only',
    case when not exists(
      select 1 from information_schema.routine_privileges
      where routine_schema='public' and routine_name='ywi_record_release_source_evidence'
        and grantee in ('anon','authenticated','PUBLIC') and privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
    'Only the server/service role may record source SHA and workflow evidence.'
  union all
  select 'release_authority_component_assertions',
    case when coalesce((select contract_assertion_failures from public.v_it_release_authority_status limit 1),1)=0
    then 'passed' else 'failed' end,
    'Module contract, permission runtime, Shared Core, write-boundary, event-boundary, real-wiring, acceptance and I.T. assertions are all green.'
  union all
  select 'release_authority_main_source_evidence',
    case when exists(
      select 1
      from public.v_it_release_source_evidence_current src
      cross join public.v_schema_drift_status ss
      where src.source_branch='main'
        and src.workflow_status='passed'
        and src.source_gate_status='green'
        and src.schema_version=ss.expected_schema_version
    ) then 'passed' else 'failed' end,
    'The exact current-schema main SHA has a successful workflow run; repository enforcement is evaluated separately.';
$$;

revoke all on function public.ywi_it_release_authority_assertions() from public, anon, authenticated;
grant execute on function public.ywi_it_release_authority_assertions() to service_role;

commit;
