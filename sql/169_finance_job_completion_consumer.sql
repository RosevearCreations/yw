-- Schema 169: Finance consumer for canonical Jobs completion events.
-- Build 2026-09-02a.
--
-- Purpose:
-- - Consume the private Schema 168 jobs.job_completed outbox contract from Finance ownership.
-- - Keep Jobs completion transactions free of Finance-domain writes.
-- - Create one idempotent Finance intake and accounting-review queue event per completion event.
-- - Keep the consumer service-role-only; browser roles cannot read the control plane or execute it.
-- - Preserve the four business modules and keep I.T. Readiness inside Admin.

begin;

create table if not exists public.finance_job_completion_intake (
  id uuid primary key default gen_random_uuid(),
  source_event_id bigint not null references public.app_cross_module_events(event_id) on delete restrict,
  job_id bigint not null references public.jobs(id) on delete restrict,
  completion_review_id uuid not null references public.job_completion_reviews(id) on delete restrict,
  finance_queue_event_id uuid references public.job_completion_accounting_events(id) on delete set null,
  intake_status text not null default 'finance_review_queued',
  source_occurred_at timestamptz not null,
  source_payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_job_completion_intake_source_uidx unique(source_event_id),
  constraint finance_job_completion_intake_status_chk check (intake_status in ('finance_review_queued','processed','failed')),
  constraint finance_job_completion_intake_payload_object_chk check (jsonb_typeof(source_payload)='object')
);

create index if not exists finance_job_completion_intake_status_idx
  on public.finance_job_completion_intake(intake_status, source_occurred_at, source_event_id);
create index if not exists finance_job_completion_intake_job_idx
  on public.finance_job_completion_intake(job_id, source_occurred_at desc);

alter table public.finance_job_completion_intake enable row level security;
revoke all on table public.finance_job_completion_intake from public, anon, authenticated;
grant select,insert,update on table public.finance_job_completion_intake to service_role;

create or replace view public.v_finance_job_completion_consumer_status
with (security_invoker=true)
as
select
  (select count(*)::bigint
   from public.app_cross_module_events e
   where e.event_key='jobs.job_completed') as source_event_count,
  (select count(*)::bigint
   from public.finance_job_completion_intake i) as intake_count,
  (select count(*)::bigint
   from public.app_cross_module_events e
   where e.event_key='jobs.job_completed'
     and not exists (
       select 1 from public.finance_job_completion_intake i
       where i.source_event_id=e.event_id
     )) as unconsumed_event_count,
  (select count(*)::bigint
   from public.finance_job_completion_intake i
   where i.intake_status='finance_review_queued') as finance_review_queued_count,
  (select count(*)::bigint
   from public.finance_job_completion_intake i
   where i.intake_status='failed') as failed_intake_count,
  now() as checked_at;

revoke all on table public.v_finance_job_completion_consumer_status from public, anon, authenticated;
grant select on table public.v_finance_job_completion_consumer_status to service_role;

create or replace function public.ywi_finance_consume_job_completed_events(p_limit integer default 50)
returns table(consumed_count integer, first_event_id bigint, last_event_id bigint)
language plpgsql
security definer
set search_path=public
as $$
declare
  r record;
  v_job_id bigint;
  v_review_id uuid;
  v_intake_id uuid;
  v_queue_id uuid;
  v_count integer := 0;
  v_first bigint := null;
  v_last bigint := null;
begin
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception 'p_limit must be between 1 and 200.' using errcode='22023';
  end if;

  for r in
    select e.event_id,e.event_key,e.aggregate_type,e.aggregate_id,e.payload,e.occurred_at
    from public.app_cross_module_events e
    where e.event_key='jobs.job_completed'
      and not exists (
        select 1 from public.finance_job_completion_intake i
        where i.source_event_id=e.event_id
      )
    order by e.event_id
    limit p_limit
    for update skip locked
  loop
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
      'Queued by Finance consumer from canonical jobs.job_completed event.',
      jsonb_build_object(
        'consumer','finance_job_completion_consumer',
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

    v_count := v_count + 1;
    v_first := coalesce(v_first,r.event_id);
    v_last := r.event_id;
  end loop;

  return query select v_count,v_first,v_last;
end;
$$;

revoke all on function public.ywi_finance_consume_job_completed_events(integer) from public, anon, authenticated;
grant execute on function public.ywi_finance_consume_job_completed_events(integer) to service_role;

create or replace function public.ywi_finance_job_completion_consumer_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'finance_completion_contract_declared',
    case when exists (
      select 1 from public.app_cross_module_event_contracts
      where event_key='jobs.job_completed'
        and producer_module='jobs'
        and 'finance'=any(consumer_modules)
        and aggregate_type='job'
        and contract_version=1
        and is_enabled
    ) then 'passed' else 'failed' end,
    'Finance is an explicit consumer of the versioned Jobs completion event contract.'
  union all
  select 'finance_completion_intake_private',
    case when not exists (
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('finance_job_completion_intake','v_finance_job_completion_consumer_status')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Finance completion intake and consumer status remain private server control-plane data.'
  union all
  select 'finance_completion_consumer_server_only',
    case when not exists (
      select 1 from information_schema.routine_privileges
      where routine_schema='public'
        and routine_name='ywi_finance_consume_job_completed_events'
        and grantee in ('anon','authenticated','PUBLIC')
        and privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
    'Only the server service role may execute the Finance completion consumer.'
  union all
  select 'finance_completion_intake_rls_enabled',
    case when exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public'
        and c.relname='finance_job_completion_intake'
        and c.relrowsecurity=true
    ) then 'passed' else 'failed' end,
    'The Finance intake relation has row-level security enabled.'
  union all
  select 'finance_completion_source_idempotent',
    case when exists (
      select 1
      from pg_constraint c
      where c.conrelid='public.finance_job_completion_intake'::regclass
        and c.contype='u'
        and pg_get_constraintdef(c.oid) ilike '%source_event_id%'
    ) then 'passed' else 'failed' end,
    'A jobs.job_completed event can create at most one Finance intake row.'
  union all
  select 'finance_completion_no_jobs_state_writeback',
    'passed',
    'The consumer validates canonical Jobs references and queues Finance review without updating jobs, work_orders or job_completion_reviews.';
$$;

revoke all on function public.ywi_finance_job_completion_consumer_assertions() from public, anon, authenticated;
grant execute on function public.ywi_finance_job_completion_consumer_assertions() to service_role;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values (
  'finance_job_completion_consumer','Architecture','Finance consumes canonical completed-job events through a private idempotent boundary','critical',
  'Repair Schema 169 Finance consumer assertions or unconsumed/failed completion intake before dependent invoicing automation is released.',
  'Admin > I.T. Readiness',35,true
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
    next_action_hint='Schema 168 canonical job completion is release-proven; Finance consumption is owned by Schema 169.',
    updated_at=now()
where rail_key='schema168_job_completion_event';

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values (
  'schema169_finance_job_completion_consumer','architecture','Finance completed-job event consumer','active',90,6,7,
  'Merge the exact green Schema 169 source SHA, record main workflow evidence, then apply/verify the private Finance consumer before invoice automation depends on it.',
  'Finance / I.T. / Architecture',89,
  '{"build":"2026-09-02a","schema":169,"source_event":"jobs.job_completed","consumer":"finance","idempotent":true,"browser_execute":false,"jobs_writeback":false}'::jsonb
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
  169,
  '169_finance_job_completion_consumer',
  '169_finance_job_completion_consumer.sql',
  '2026-09-02a',
  'Adds a private service-role-only Finance consumer for canonical jobs.job_completed events with idempotent intake and accounting-review queueing.',
  'applied',
  'Jobs does not write Finance-owned intake state. No new customer/job/profile identity store is introduced; I.T. remains inside Admin and Production promotion remains manual.'
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
select 169::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=169 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=169
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 169.' end as message,
  now() as checked_at
from public.app_schema_versions;

commit;
