-- Schema 171: Controlled Finance completion-consumer execution and retry readiness.
-- Build 2026-09-02c.
--
-- Purpose:
-- - Replace ad-hoc service execution with one durable, auditable service-role entrypoint.
-- - Keep the browser read-only: Admin > I.T. Readiness can observe execution/retry health but cannot run the consumer.
-- - Record bounded consumer runs and per-event failures without writing back into Jobs completion state.
-- - Permit service-owned retries only after a backoff window, with a hard three-attempt ceiling.
-- - Continue to queue human Finance review only; this release does not create invoices, journals, schedules, or Production promotion.

begin;

create table if not exists public.finance_job_completion_consumer_runs (
  id uuid primary key default gen_random_uuid(),
  run_mode text not null default 'standard',
  requested_limit integer not null,
  run_status text not null default 'running',
  consumed_count integer not null default 0,
  failed_count integer not null default 0,
  first_event_id bigint references public.app_cross_module_events(event_id) on delete set null,
  last_event_id bigint references public.app_cross_module_events(event_id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_summary text,
  metadata jsonb not null default '{}'::jsonb,
  constraint finance_job_completion_consumer_runs_mode_chk check (run_mode in ('standard','retry_failed')),
  constraint finance_job_completion_consumer_runs_limit_chk check (requested_limit between 1 and 200),
  constraint finance_job_completion_consumer_runs_status_chk check (run_status in ('running','completed','completed_with_failures','failed')),
  constraint finance_job_completion_consumer_runs_counts_chk check (consumed_count >= 0 and failed_count >= 0),
  constraint finance_job_completion_consumer_runs_metadata_chk check (jsonb_typeof(metadata)='object')
);

create index if not exists finance_job_completion_consumer_runs_started_idx
  on public.finance_job_completion_consumer_runs(started_at desc);

alter table public.finance_job_completion_consumer_runs enable row level security;
revoke all on table public.finance_job_completion_consumer_runs from public, anon, authenticated;
grant select,insert,update on table public.finance_job_completion_consumer_runs to service_role;

create table if not exists public.finance_job_completion_consumer_failures (
  source_event_id bigint primary key references public.app_cross_module_events(event_id) on delete restrict,
  failure_status text not null default 'open',
  attempt_count integer not null default 1,
  last_error_code text,
  last_error_message text not null,
  first_failed_at timestamptz not null default now(),
  last_failed_at timestamptz not null default now(),
  next_retry_at timestamptz,
  resolved_at timestamptz,
  last_run_id uuid references public.finance_job_completion_consumer_runs(id) on delete set null,
  constraint finance_job_completion_consumer_failures_status_chk check (failure_status in ('open','resolved','exhausted')),
  constraint finance_job_completion_consumer_failures_attempt_chk check (attempt_count between 1 and 3)
);

create index if not exists finance_job_completion_consumer_failures_retry_idx
  on public.finance_job_completion_consumer_failures(failure_status,next_retry_at,source_event_id);

alter table public.finance_job_completion_consumer_failures enable row level security;
revoke all on table public.finance_job_completion_consumer_failures from public, anon, authenticated;
grant select,insert,update on table public.finance_job_completion_consumer_failures to service_role;

create or replace function public.ywi_finance_process_job_completed_event(p_event_id bigint)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  r public.app_cross_module_events%rowtype;
  v_job_id bigint;
  v_review_id uuid;
  v_intake_id uuid;
  v_queue_id uuid;
begin
  if p_event_id is null then
    raise exception 'p_event_id is required.' using errcode='22023';
  end if;

  select * into r
  from public.app_cross_module_events e
  where e.event_id=p_event_id
    and e.event_key='jobs.job_completed'
  for update;

  if not found then
    raise exception 'Canonical jobs.job_completed event % was not found.', p_event_id using errcode='P0002';
  end if;

  if exists (
    select 1 from public.finance_job_completion_intake i where i.source_event_id=r.event_id
  ) then
    return;
  end if;

  if r.aggregate_type is distinct from 'job' then
    raise exception 'Event % has invalid aggregate type %.', r.event_id, r.aggregate_type using errcode='23514';
  end if;
  if coalesce(r.aggregate_id,'') !~ '^[0-9]+$' then
    raise exception 'Event % has invalid canonical job aggregate id.', r.event_id using errcode='23514';
  end if;

  v_job_id := r.aggregate_id::bigint;
  if coalesce(r.payload->>'job_id','') is distinct from v_job_id::text then
    raise exception 'Event % payload job_id does not match aggregate_id.', r.event_id using errcode='23514';
  end if;
  if coalesce(r.payload->>'contract_version','') is distinct from '1' then
    raise exception 'Event % does not use jobs.job_completed contract version 1.', r.event_id using errcode='23514';
  end if;
  if nullif(trim(coalesce(r.payload->>'completion_review_id','')),'') is null then
    raise exception 'Event % is missing completion_review_id.', r.event_id using errcode='23514';
  end if;

  begin
    v_review_id := (r.payload->>'completion_review_id')::uuid;
  exception when invalid_text_representation then
    raise exception 'Event % has invalid completion_review_id.', r.event_id using errcode='23514';
  end;

  perform 1
  from public.job_completion_reviews cr
  where cr.id=v_review_id and cr.job_id=v_job_id;
  if not found then
    raise exception 'Event % does not resolve to its canonical job completion review.', r.event_id using errcode='23503';
  end if;

  insert into public.finance_job_completion_intake(
    source_event_id,job_id,completion_review_id,intake_status,source_occurred_at,source_payload
  ) values (
    r.event_id,v_job_id,v_review_id,'finance_review_queued',r.occurred_at,r.payload
  )
  returning id into v_intake_id;

  insert into public.job_completion_accounting_events(
    completion_review_id,job_id,accounting_action,event_status,memo,payload,created_by_profile_id
  ) values (
    v_review_id,
    v_job_id,
    'queue_review',
    'queued',
    'Queued by controlled Finance consumer from canonical jobs.job_completed event.',
    jsonb_build_object(
      'consumer','finance_job_completion_consumer',
      'consumer_release','schema171',
      'source_event_id',r.event_id,
      'source_event_key',r.event_key,
      'source_occurred_at',r.occurred_at,
      'source_payload',r.payload
    ),
    null
  )
  returning id into v_queue_id;

  update public.finance_job_completion_intake
  set finance_queue_event_id=v_queue_id,
      updated_at=now()
  where id=v_intake_id;
end;
$$;

-- The helper is deliberately not callable by service_role or browser roles.
-- Only the controlled runner below owns service execution authority.
revoke all on function public.ywi_finance_process_job_completed_event(bigint) from public, anon, authenticated, service_role;

-- Retire the Schema 169 direct batch entrypoint from service use so every run is ledgered.
revoke all on function public.ywi_finance_consume_job_completed_events(integer) from service_role;

create or replace function public.ywi_finance_run_job_completion_consumer(
  p_limit integer default 50,
  p_mode text default 'standard'
)
returns table(
  run_id uuid,
  run_status text,
  consumed_count integer,
  failed_count integer,
  first_event_id bigint,
  last_event_id bigint
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_run_id uuid;
  v_mode text := lower(trim(coalesce(p_mode,'')));
  v_consumed integer := 0;
  v_failed integer := 0;
  v_first bigint := null;
  v_last bigint := null;
  v_sqlstate text;
  v_message text;
  v_final_status text := 'completed';
  r record;
begin
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception 'p_limit must be between 1 and 200.' using errcode='22023';
  end if;
  if v_mode not in ('standard','retry_failed') then
    raise exception 'p_mode must be standard or retry_failed.' using errcode='22023';
  end if;

  perform 1
  from public.v_schema_drift_status s
  where s.expected_schema_version >= 171
    and s.latest_applied_schema_version >= 171
    and s.drift_status='current';
  if not found then
    raise exception 'Finance completion consumer execution requires current Schema 171.' using errcode='55000';
  end if;

  perform 1
  from public.app_cross_module_event_contracts c
  where c.event_key='jobs.job_completed'
    and c.producer_module='jobs'
    and 'finance'=any(c.consumer_modules)
    and c.aggregate_type='job'
    and c.contract_version=1
    and c.is_enabled;
  if not found then
    raise exception 'Enabled jobs.job_completed -> Finance contract version 1 is required.' using errcode='55000';
  end if;

  insert into public.finance_job_completion_consumer_runs(
    run_mode,requested_limit,run_status,metadata
  ) values (
    v_mode,p_limit,'running',jsonb_build_object('consumer','finance_job_completion_consumer','schema',171)
  ) returning id into v_run_id;

  begin
    for r in
      select e.event_id
      from public.app_cross_module_events e
      where e.event_key='jobs.job_completed'
        and not exists (
          select 1 from public.finance_job_completion_intake i where i.source_event_id=e.event_id
        )
        and (
          (v_mode='standard' and not exists (
            select 1 from public.finance_job_completion_consumer_failures f
            where f.source_event_id=e.event_id and f.failure_status in ('open','exhausted')
          ))
          or
          (v_mode='retry_failed' and exists (
            select 1 from public.finance_job_completion_consumer_failures f
            where f.source_event_id=e.event_id
              and f.failure_status='open'
              and f.attempt_count < 3
              and coalesce(f.next_retry_at,now()) <= now()
          ))
        )
      order by e.event_id
      limit p_limit
      for update skip locked
    loop
      v_first := coalesce(v_first,r.event_id);
      v_last := r.event_id;

      begin
        perform public.ywi_finance_process_job_completed_event(r.event_id);

        update public.finance_job_completion_consumer_failures
        set failure_status='resolved',
            resolved_at=now(),
            next_retry_at=null,
            last_run_id=v_run_id
        where source_event_id=r.event_id
          and failure_status in ('open','exhausted');

        v_consumed := v_consumed + 1;
      exception when others then
        get stacked diagnostics
          v_sqlstate = returned_sqlstate,
          v_message = message_text;

        insert into public.finance_job_completion_consumer_failures(
          source_event_id,failure_status,attempt_count,last_error_code,last_error_message,
          first_failed_at,last_failed_at,next_retry_at,resolved_at,last_run_id
        ) values (
          r.event_id,'open',1,v_sqlstate,left(coalesce(v_message,'Unknown consumer failure.'),2000),
          now(),now(),now()+interval '15 minutes',null,v_run_id
        )
        on conflict(source_event_id) do update set
          attempt_count=least(public.finance_job_completion_consumer_failures.attempt_count+1,3),
          failure_status=case
            when public.finance_job_completion_consumer_failures.attempt_count+1 >= 3 then 'exhausted'
            else 'open'
          end,
          last_error_code=excluded.last_error_code,
          last_error_message=excluded.last_error_message,
          last_failed_at=now(),
          next_retry_at=case
            when public.finance_job_completion_consumer_failures.attempt_count+1 >= 3 then null
            when public.finance_job_completion_consumer_failures.attempt_count+1 = 2 then now()+interval '1 hour'
            else now()+interval '15 minutes'
          end,
          resolved_at=null,
          last_run_id=v_run_id;

        v_failed := v_failed + 1;
      end;
    end loop;

    v_final_status := case when v_failed > 0 then 'completed_with_failures' else 'completed' end;
    update public.finance_job_completion_consumer_runs
    set run_status=v_final_status,
        consumed_count=v_consumed,
        failed_count=v_failed,
        first_event_id=v_first,
        last_event_id=v_last,
        finished_at=now()
    where id=v_run_id;
  exception when others then
    get stacked diagnostics
      v_sqlstate = returned_sqlstate,
      v_message = message_text;
    v_final_status := 'failed';
    update public.finance_job_completion_consumer_runs
    set run_status='failed',
        consumed_count=v_consumed,
        failed_count=v_failed,
        first_event_id=v_first,
        last_event_id=v_last,
        finished_at=now(),
        error_summary=left(format('[%s] %s',v_sqlstate,coalesce(v_message,'Unknown runner failure.')),2000)
    where id=v_run_id;
  end;

  return query
  select v_run_id,v_final_status,v_consumed,v_failed,v_first,v_last;
end;
$$;

revoke all on function public.ywi_finance_run_job_completion_consumer(integer,text) from public, anon, authenticated;
grant execute on function public.ywi_finance_run_job_completion_consumer(integer,text) to service_role;

create or replace view public.v_finance_job_completion_execution_status
with (security_invoker=true)
as
with latest as (
  select r.*
  from public.finance_job_completion_consumer_runs r
  order by r.started_at desc,r.id desc
  limit 1
), failure_rollup as (
  select
    count(*)::bigint as failure_record_count,
    count(*) filter (where failure_status='open')::bigint as open_failure_count,
    count(*) filter (
      where failure_status='open'
        and attempt_count < 3
        and coalesce(next_retry_at,now()) <= now()
    )::bigint as retry_ready_count,
    count(*) filter (where failure_status='exhausted')::bigint as exhausted_failure_count,
    min(next_retry_at) filter (where failure_status='open') as next_retry_at
  from public.finance_job_completion_consumer_failures
), backlog as (
  select
    count(*) filter (
      where e.event_key='jobs.job_completed'
        and not exists (
          select 1 from public.finance_job_completion_intake i where i.source_event_id=e.event_id
        )
    )::bigint as unconsumed_event_count
  from public.app_cross_module_events e
)
select
  l.id as last_run_id,
  l.run_mode as last_run_mode,
  l.run_status as last_run_status,
  l.requested_limit as last_requested_limit,
  l.consumed_count as last_consumed_count,
  l.failed_count as last_failed_count,
  l.started_at as last_started_at,
  l.finished_at as last_finished_at,
  fr.failure_record_count,
  fr.open_failure_count,
  fr.retry_ready_count,
  fr.exhausted_failure_count,
  fr.next_retry_at,
  b.unconsumed_event_count,
  case
    when fr.exhausted_failure_count > 0 then 'failed'
    when fr.open_failure_count > 0 or b.unconsumed_event_count > 0 then 'warning'
    else 'passed'
  end::text as check_status,
  case
    when fr.exhausted_failure_count > 0 then 'A Finance completion event exhausted the three-attempt retry ceiling and requires service-side investigation.'
    when fr.retry_ready_count > 0 then 'One or more failed Finance completion events are eligible for a bounded service-role retry.'
    when fr.open_failure_count > 0 then 'Finance completion failures are inside their retry backoff window.'
    when b.unconsumed_event_count > 0 then 'Canonical completed-job events are waiting for a standard service-role consumer run.'
    when l.id is null then 'No controlled Finance consumer run has been required yet; the pipeline has no backlog.'
    else 'Controlled Finance completion consumer execution is healthy.'
  end::text as details,
  now() as checked_at
from failure_rollup fr
cross join backlog b
left join latest l on true;

revoke all on table public.v_finance_job_completion_execution_status from public, anon, authenticated;
grant select on table public.v_finance_job_completion_execution_status to service_role;

create or replace function public.ywi_finance_job_completion_execution_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'finance_consumer_run_control_private',
    case when not exists (
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in (
          'finance_job_completion_consumer_runs',
          'finance_job_completion_consumer_failures',
          'v_finance_job_completion_execution_status'
        )
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Consumer run, failure and execution-readiness data remain private server control-plane relations.'
  union all
  select 'finance_consumer_run_control_rls',
    case when (
      select count(*)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public'
        and c.relname in ('finance_job_completion_consumer_runs','finance_job_completion_consumer_failures')
        and c.relrowsecurity=true
    )=2 then 'passed' else 'failed' end,
    'Both public-schema execution ledger tables have row-level security enabled.'
  union all
  select 'finance_consumer_controlled_entrypoint_server_only',
    case when exists (
      select 1 from information_schema.routine_privileges
      where routine_schema='public'
        and routine_name='ywi_finance_run_job_completion_consumer'
        and grantee='service_role'
        and privilege_type='EXECUTE'
    ) and not exists (
      select 1 from information_schema.routine_privileges
      where routine_schema='public'
        and routine_name='ywi_finance_run_job_completion_consumer'
        and grantee in ('anon','authenticated','PUBLIC')
        and privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
    'Only service_role may invoke the controlled Finance completion runner.'
  union all
  select 'finance_consumer_legacy_entrypoint_retired',
    case when not exists (
      select 1 from information_schema.routine_privileges
      where routine_schema='public'
        and routine_name='ywi_finance_consume_job_completed_events'
        and grantee in ('service_role','anon','authenticated','PUBLIC')
        and privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
    'The unledgered Schema 169 batch entrypoint is no longer callable by application/service roles.'
  union all
  select 'finance_consumer_retry_ceiling_declared',
    case when exists (
      select 1 from pg_constraint c
      where c.conrelid='public.finance_job_completion_consumer_failures'::regclass
        and c.conname='finance_job_completion_consumer_failures_attempt_chk'
        and c.contype='c'
    ) then 'passed' else 'failed' end,
    'Retry state has a database-enforced attempt ceiling and the controlled runner exhausts a failure at the third attempt.'
  union all
  select 'finance_consumer_no_jobs_writeback',
    case when not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public'
        and p.proname in ('ywi_finance_process_job_completed_event','ywi_finance_run_job_completion_consumer')
        and pg_get_functiondef(p.oid) ~* E'update\\s+public\\.(jobs|work_orders|job_completion_reviews)'
    ) then 'passed' else 'failed' end,
    'Schema 171 consumer execution never writes back into canonical Jobs completion state.'
  union all
  select 'finance_consumer_review_only',
    case when not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public'
        and p.proname in ('ywi_finance_process_job_completed_event','ywi_finance_run_job_completion_consumer')
        and (
          pg_get_functiondef(p.oid) ilike '%create_invoice_candidate%'
          or pg_get_functiondef(p.oid) ilike '%create_journal_candidate%'
          or pg_get_functiondef(p.oid) ilike '%mark_posted%'
        )
    ) then 'passed' else 'failed' end,
    'Controlled execution queues human Finance review only; invoice, journal and posting automation remain outside this release.';
$$;

revoke all on function public.ywi_finance_job_completion_execution_assertions() from public, anon, authenticated;
grant execute on function public.ywi_finance_job_completion_execution_assertions() to service_role;

-- Extend the existing private I.T. consumer health feed without exposing execution controls.
create or replace view public.v_it_cross_module_consumer_health
with (security_invoker=true)
as
with source_events as (
  select
    count(*)::bigint as source_event_count,
    count(*) filter (where not exists (
      select 1 from public.finance_job_completion_intake i
      where i.source_event_id=e.event_id
    ))::bigint as unconsumed_event_count,
    min(e.occurred_at) filter (where not exists (
      select 1 from public.finance_job_completion_intake i
      where i.source_event_id=e.event_id
    )) as oldest_unconsumed_at
  from public.app_cross_module_events e
  where e.event_key='jobs.job_completed'
), intake as (
  select
    count(*)::bigint as intake_count,
    count(*) filter (where intake_status='finance_review_queued')::bigint as finance_review_queued_count,
    count(*) filter (where intake_status='processed')::bigint as processed_intake_count,
    count(*) filter (where intake_status='failed')::bigint as failed_intake_count,
    min(source_occurred_at) filter (where intake_status='finance_review_queued') as oldest_queued_intake_at
  from public.finance_job_completion_intake
), accounting_queue as (
  select
    count(*) filter (
      where accounting_action='queue_review'
        and event_status='queued'
        and payload->>'consumer'='finance_job_completion_consumer'
    )::bigint as queued_accounting_review_count,
    min(created_at) filter (
      where accounting_action='queue_review'
        and event_status='queued'
        and payload->>'consumer'='finance_job_completion_consumer'
    ) as oldest_accounting_review_at
  from public.job_completion_accounting_events
), facts as (
  select se.*,i.*,aq.*
  from source_events se cross join intake i cross join accounting_queue aq
), execution as (
  select * from public.v_finance_job_completion_execution_status
)
select
  'finance_completion_unconsumed'::text as check_key,
  'Unconsumed Jobs completion events'::text as check_title,
  case
    when unconsumed_event_count=0 then 'passed'
    when oldest_unconsumed_at < now()-interval '1 day' then 'failed'
    else 'warning'
  end::text as check_status,
  unconsumed_event_count as metric_value,
  source_event_count as related_total,
  oldest_unconsumed_at as oldest_item_at,
  case
    when unconsumed_event_count=0 then 'Every canonical jobs.job_completed event has a Finance intake row.'
    when oldest_unconsumed_at < now()-interval '1 day' then 'At least one canonical completed-job event has remained unconsumed for more than 24 hours.'
    else 'Finance has completed-job events waiting for service-owned intake.'
  end::text as details,
  'Run the bounded Finance consumer only through the Schema 171 service-role runner after execution readiness is green.'::text as next_action_hint,
  now() as checked_at
from facts
union all
select
  'finance_completion_failed_intake',
  'Failed Finance completion intake',
  case when failed_intake_count=0 then 'passed' else 'failed' end,
  failed_intake_count,
  intake_count,
  null::timestamptz,
  case when failed_intake_count=0
    then 'No Finance completed-job intake rows are in failed state.'
    else 'One or more Finance completed-job intake rows require investigation before downstream automation.' end,
  'Inspect the private Finance intake and source event under service-role tooling; do not repair Jobs state from Finance.',
  now()
from facts
union all
select
  'finance_completion_review_queue',
  'Finance accounting review queue',
  case
    when queued_accounting_review_count=0 then 'passed'
    when oldest_accounting_review_at < now()-interval '7 days' then 'failed'
    else 'warning'
  end,
  queued_accounting_review_count,
  finance_review_queued_count,
  oldest_accounting_review_at,
  case
    when queued_accounting_review_count=0 then 'No Finance review items created by the completed-job consumer are currently queued.'
    when oldest_accounting_review_at < now()-interval '7 days' then 'A completed-job Finance review has remained queued for more than seven days.'
    else 'Completed-job Finance reviews are queued for human/accounting handling.'
  end,
  'Review queued accounting work; Schema 171 still does not auto-create invoices or journals.',
  now()
from facts
union all
select
  'finance_completion_pipeline_balance',
  'Jobs completion / Finance intake balance',
  case
    when intake_count > source_event_count then 'failed'
    when processed_intake_count + finance_review_queued_count + failed_intake_count <> intake_count then 'failed'
    else 'passed'
  end,
  intake_count,
  source_event_count,
  oldest_queued_intake_at,
  'Finance intake must never exceed canonical source events, and every intake row must resolve to a declared intake status.',
  'Repair consumer-state integrity before releasing dependent accounting automation.',
  now()
from facts
union all
select
  'finance_completion_execution_readiness',
  'Controlled Finance consumer execution',
  e.check_status,
  e.unconsumed_event_count,
  coalesce(e.last_consumed_count,0)::bigint,
  e.last_started_at,
  e.details,
  'Execution is service-role-only. Admin I.T. remains read-only and must not expose a browser execute or retry control.',
  now()
from execution e
union all
select
  'finance_completion_retry_state',
  'Finance consumer retry state',
  case
    when e.exhausted_failure_count > 0 then 'failed'
    when e.open_failure_count > 0 then 'warning'
    else 'passed'
  end,
  (e.open_failure_count + e.exhausted_failure_count)::bigint,
  e.failure_record_count,
  e.next_retry_at,
  case
    when e.exhausted_failure_count > 0 then 'At least one event reached the three-attempt retry ceiling.'
    when e.retry_ready_count > 0 then 'At least one failed event is eligible for an explicit service-role retry run.'
    when e.open_failure_count > 0 then 'Failed events are inside their retry backoff window.'
    else 'No unresolved Finance consumer retry state exists.'
  end,
  'Investigate exhausted failures before any dependent accounting automation is released.',
  now()
from execution e;

revoke all on table public.v_it_cross_module_consumer_health from public, anon, authenticated;
grant select on table public.v_it_cross_module_consumer_health to service_role;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values (
  'finance_consumer_execution_control','Architecture','Finance completed-job consumer execution is ledgered, bounded and retry-safe','critical',
  'Use only the Schema 171 service-role runner. Investigate exhausted failures before dependent invoicing or journal automation is released.',
  'Admin > I.T. Readiness',37,true
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
    next_action_hint='Schema 170 consumer observability is release-proven; Schema 171 adds controlled service execution and retry evidence.',
    updated_at=now()
where rail_key='schema170_it_consumer_observability';

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values (
  'schema171_finance_consumer_execution','architecture','Finance completion consumer execution and retry control','active',90,7,8,
  'Merge the exact green Schema 171 source SHA, record main workflow evidence, then apply and verify the controlled runner without executing business events unless backlog requires it.',
  'Finance / I.T. / Architecture',91,
  '{"build":"2026-09-02c","schema":171,"service_role_only":true,"run_ledger":true,"retry_ceiling":3,"browser_execute":false,"invoice_automation":false,"jobs_writeback":false}'::jsonb
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
  171,
  '171_finance_consumer_execution_retry',
  '171_finance_consumer_execution_retry.sql',
  '2026-09-02c',
  'Adds a private service-role-only Finance completion-consumer run ledger, per-event failure ledger, bounded retries and I.T. execution-readiness evidence.',
  'applied',
  'The browser remains read-only. The legacy direct batch entrypoint is retired from service use. No invoice/journal automation, Jobs writeback, scheduler, fifth module or Production promotion is introduced.'
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
select 171::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=171 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=171
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 171.' end as message,
  now() as checked_at
from public.app_schema_versions;

commit;