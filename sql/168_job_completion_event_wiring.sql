-- Schema 168: Canonical job completion event wiring.
-- Build 2026-09-01j.
--
-- Purpose:
-- - Make job_completion_reviews the single job-level completion authority.
-- - Derive completion evidence from durable work-order closeout/session facts instead of browser booleans.
-- - Publish jobs.job_completed exactly once when a canonical job enters an accepted final completion state.
-- - Keep Finance/Admin consumers on the private Schema 164 outbox rather than granting cross-domain writes.
-- - Keep I.T. as an Admin subsection and advance release authority to Schema 168.

begin;

-- A work-order closeout is evidence for job completion, not the job completion event itself. A job may
-- own more than one work order, so the final event must originate at the unique job-level review row.
create or replace function public.ywi_prepare_job_completion_review()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_work_order_count integer := 0;
  v_closeout_complete boolean := false;
  v_client_signoff_complete boolean := false;
  v_sessions_signed boolean := false;
  v_is_final boolean := false;
begin
  if new.job_id is null then
    raise exception 'Canonical jobs.id is required for completion review.' using errcode='23502';
  end if;

  perform 1 from public.jobs where id=new.job_id for update;
  if not found then
    raise exception 'Canonical job % does not exist.', new.job_id using errcode='23503';
  end if;

  select count(*)::integer
  into v_work_order_count
  from public.work_orders wo
  where wo.legacy_job_id=new.job_id;

  select (
    v_work_order_count > 0
    and not exists (
      select 1
      from public.work_orders wo
      where wo.legacy_job_id=new.job_id
        and not exists (
          select 1
          from public.work_order_closeout_packages cp
          where cp.work_order_id=wo.id
            and cp.closeout_status in ('approved','invoice_ready')
        )
    )
  ) into v_closeout_complete;

  select (
    v_work_order_count > 0
    and not exists (
      select 1
      from public.work_orders wo
      where wo.legacy_job_id=new.job_id
        and not exists (
          select 1
          from public.work_order_closeout_packages cp
          where cp.work_order_id=wo.id
            and cp.closeout_status in ('approved','invoice_ready')
            and (
              cp.customer_signoff_required=false
              or cp.customer_signoff_status='signed'
            )
        )
    )
  ) into v_client_signoff_complete;

  select not exists (
    select 1
    from public.job_sessions js
    where js.job_id=new.job_id
      and js.site_supervisor_signed_off_at is null
      and nullif(trim(coalesce(js.site_supervisor_signoff_name,'')),'') is null
  ) into v_sessions_signed;

  -- Never trust client-supplied completion evidence flags. Derive them from canonical durable facts.
  new.closeout_evidence_complete := v_closeout_complete;
  new.supervisor_signoff_complete := v_closeout_complete;
  new.client_signoff_complete := v_client_signoff_complete;
  new.all_sessions_signed_off := v_sessions_signed;

  v_is_final := new.review_status in ('approved','ready_for_accounting','posted');

  if v_is_final and v_work_order_count=0 then
    raise exception 'A job cannot be completed without at least one canonical work order.' using errcode='23514';
  end if;
  if v_is_final and not v_closeout_complete then
    raise exception 'Every work order requires an approved closeout package before job completion.' using errcode='23514';
  end if;
  if v_is_final and not v_client_signoff_complete then
    raise exception 'Required customer closeout signoff is incomplete for one or more work orders.' using errcode='23514';
  end if;
  if v_is_final and not v_sessions_signed then
    raise exception 'All recorded job sessions require supervisor signoff before job completion.' using errcode='23514';
  end if;

  if v_is_final then
    new.approved_at := coalesce(new.approved_at,now());
    new.approved_by_profile_id := coalesce(new.approved_by_profile_id,new.reviewed_by_profile_id);
  end if;

  if new.review_status in ('ready_for_accounting','posted') then
    new.accounting_ready := true;
    new.accounting_ready_at := coalesce(new.accounting_ready_at,now());
    if new.accounting_trigger_status='pending' then
      new.accounting_trigger_status := 'queued';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.ywi_prepare_job_completion_review() from public, anon, authenticated;

drop trigger if exists trg_prepare_job_completion_review on public.job_completion_reviews;
create trigger trg_prepare_job_completion_review
before insert or update on public.job_completion_reviews
for each row execute function public.ywi_prepare_job_completion_review();

create or replace function public.ywi_emit_job_completed()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_entered_final boolean := false;
begin
  v_entered_final := new.review_status in ('approved','ready_for_accounting','posted')
    and (tg_op='INSERT' or old.review_status not in ('approved','ready_for_accounting','posted'));

  if not v_entered_final then
    return new;
  end if;

  update public.jobs
  set status='completed',
      last_activity_at=now(),
      updated_at=now()
  where id=new.job_id;

  if not found then
    raise exception 'Canonical job % disappeared during completion.', new.job_id using errcode='23503';
  end if;

  update public.work_orders
  set status='completed',
      approval_status='completed',
      completion_review_status=case
        when new.review_status='approved' then 'approved'
        else 'ready_for_accounting'
      end,
      completion_ready_for_accounting=new.accounting_ready,
      completion_ready_at=case when new.accounting_ready then coalesce(new.accounting_ready_at,now()) else completion_ready_at end,
      accounting_trigger_status=new.accounting_trigger_status,
      updated_at=now()
  where legacy_job_id=new.job_id;

  perform public.ywi_publish_cross_module_event(
    'jobs',
    'jobs.job_completed',
    'job',
    new.job_id::text,
    jsonb_build_object(
      'contract_version',1,
      'completion_review_id',new.id,
      'job_id',new.job_id,
      'work_order_id',new.work_order_id,
      'review_status',new.review_status,
      'completion_date',new.completion_date,
      'closeout_evidence_complete',new.closeout_evidence_complete,
      'supervisor_signoff_complete',new.supervisor_signoff_complete,
      'client_signoff_complete',new.client_signoff_complete,
      'all_sessions_signed_off',new.all_sessions_signed_off,
      'accounting_ready',new.accounting_ready,
      'accounting_trigger_status',new.accounting_trigger_status,
      'reviewed_by_profile_id',new.reviewed_by_profile_id,
      'approved_by_profile_id',new.approved_by_profile_id
    ),
    'jobs.job_completed:review:' || new.id::text,
    coalesce(new.approved_at,now())
  );

  return new;
end;
$$;

revoke all on function public.ywi_emit_job_completed() from public, anon, authenticated;

drop trigger if exists trg_emit_job_completed on public.job_completion_reviews;
create trigger trg_emit_job_completed
after insert or update on public.job_completion_reviews
for each row execute function public.ywi_emit_job_completed();

-- Extend the Schema 167 wiring status with the real job-level completion mutation.
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
  'dispatch insert, work-order schedule state and outbox publication share one transaction'
union all
select
  'jobs_completion_review',
  'jobs',
  'jobs.job_completed',
  'job_completion_reviews',
  exists(
    select 1 from pg_trigger
    where tgrelid='public.job_completion_reviews'::regclass
      and tgname='trg_prepare_job_completion_review' and not tgisinternal
  ) and exists(
    select 1 from pg_trigger
    where tgrelid='public.job_completion_reviews'::regclass
      and tgname='trg_emit_job_completed' and not tgisinternal
  ),
  true,
  'jobs.id',
  'derived completion evidence, canonical job completion state and outbox publication share one transaction';

revoke all on table public.v_cross_module_event_wiring_status from public, anon, authenticated;
grant select on table public.v_cross_module_event_wiring_status to service_role;

-- Extend the release-authority wiring suite. Schema 166 already consumes this function, so the new
-- completion checks automatically become mandatory release assertions without another parallel gate.
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
    ) and exists(
      select 1 from public.app_cross_module_event_contracts
      where event_key='jobs.job_completed' and producer_module='jobs' and aggregate_type='job' and is_enabled
    ) then 'passed' else 'failed' end,
    'Real mutation paths resolve to enabled Schema 164 versioned event contracts.'
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
  select 'job_completion_review_canonical_fk',
    case when exists(
      select 1 from pg_constraint c
      where c.conrelid='public.job_completion_reviews'::regclass
        and c.confrelid='public.jobs'::regclass
        and c.contype='f'
    ) then 'passed' else 'failed' end,
    'Job completion reviews resolve directly to canonical public.jobs identity.'
  union all
  select 'job_completion_evidence_server_derived',
    case when exists(
      select 1 from pg_trigger
      where tgrelid='public.job_completion_reviews'::regclass
        and tgname='trg_prepare_job_completion_review' and not tgisinternal
    ) then 'passed' else 'failed' end,
    'Final completion evidence is derived from durable closeout/session facts rather than trusted browser booleans.'
  union all
  select 'job_completion_event_wired_atomically',
    case when exists(
      select 1 from pg_trigger
      where tgrelid='public.job_completion_reviews'::regclass
        and tgname='trg_emit_job_completed' and not tgisinternal
    ) then 'passed' else 'failed' end,
    'Canonical job completion state and jobs.job_completed publication share the completion-review transaction.'
  union all
  select 'work_order_closeout_not_completion_publisher',
    case when not exists(
      select 1 from pg_trigger
      where tgrelid in ('public.work_order_closeout_packages'::regclass,'public.work_order_customer_closeout_signoffs'::regclass)
        and tgname='trg_emit_job_completed' and not tgisinternal
    ) then 'passed' else 'failed' end,
    'Work-order closeout/customer signoff remains completion evidence and does not independently publish job completion.'
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
        and routine_name in ('ywi_emit_profile_access_changed','ywi_prepare_dispatch_job_schedule','ywi_emit_job_scheduled','ywi_prepare_job_completion_review','ywi_emit_job_completed')
        and grantee in ('anon','authenticated','PUBLIC') and privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
    'Outbox/wiring state and trigger functions remain private server control-plane surfaces.';
$$;

revoke all on function public.ywi_cross_module_event_wiring_assertions() from public, anon, authenticated;
grant execute on function public.ywi_cross_module_event_wiring_assertions() to service_role;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values (
  'canonical_job_completion_event','Architecture','Canonical completed jobs publish one verified cross-module completion event','critical',
  'Repair Schema 168 completion evidence/event assertions before Finance or Admin completion consumers are released.',
  'Admin > I.T. Readiness',34,true
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
set rail_status='complete',progress_percent=100,current_value=7,target_value=7,
    next_action_hint='Schema 167 real event wiring is release-proven; Schema 168 owns canonical job completion.',
    updated_at=now()
where rail_key='schema167_real_event_wiring';

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values (
  'schema168_job_completion_event','architecture','Canonical job completion event wiring','active',90,6,7,
  'Merge the exact green Schema 168 source SHA, record its main workflow evidence, and verify the live completion/event assertions.',
  'I.T. / Architecture',88,
  '{"build":"2026-09-01j","schema":168,"event":"jobs.job_completed","authority":"job_completion_reviews","work_order_closeout":"evidence_only","canonical_jobs":true,"browser_publish":false}'::jsonb
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
  168,
  '168_job_completion_event_wiring',
  '168_job_completion_event_wiring.sql',
  '2026-09-01j',
  'Makes job_completion_reviews the canonical job-level completion authority, derives evidence from durable work-order/session facts, and atomically publishes jobs.job_completed.',
  'applied',
  'Work-order closeout/customer signoff is evidence only. No new customer/job/profile identity tables are introduced; I.T. remains an Admin subsection and Production promotion remains manual.'
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
select 168::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=168 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=168
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 168.' end as message,
  now() as checked_at
from public.app_schema_versions;

commit;
