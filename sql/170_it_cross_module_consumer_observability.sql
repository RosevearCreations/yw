-- Schema 170: I.T. cross-module consumer observability.
-- Build 2026-09-02b.
--
-- Purpose:
-- - Make the Schema 168 -> 169 Jobs completion / Finance consumer path visible in Admin > I.T. Readiness.
-- - Expose only private server-read health summaries; never expose the outbox or Finance intake directly to browsers.
-- - Distinguish normal queued work from stale or failed consumer work.
-- - Keep the consumer manual/service-owned; this release does not schedule accounting, create invoices, or promote Production.
-- - Preserve the four business modules and Shared Core identities.

begin;

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
  'Run the bounded Finance consumer only after confirming Schema 169 is applied and service-role execution is authorized.'::text as next_action_hint,
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
  'Review queued accounting work; Schema 170 does not auto-create invoices or journals.',
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
from facts;

revoke all on table public.v_it_cross_module_consumer_health from public, anon, authenticated;
grant select on table public.v_it_cross_module_consumer_health to service_role;

create or replace function public.ywi_it_cross_module_consumer_observability_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'consumer_health_view_private',
    case when not exists (
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name='v_it_cross_module_consumer_health'
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Cross-module consumer health is available only through the protected Admin I.T. server path.'
  union all
  select 'consumer_source_control_plane_private',
    case when not exists (
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('app_cross_module_events','finance_job_completion_intake')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'The outbox and Finance intake remain unavailable to browser roles.'
  union all
  select 'consumer_no_failed_intake',
    case when not exists (
      select 1 from public.finance_job_completion_intake where intake_status='failed'
    ) then 'passed' else 'failed' end,
    'No Finance completed-job intake row is in failed state.'
  union all
  select 'consumer_no_stale_unconsumed_completion',
    case when not exists (
      select 1
      from public.app_cross_module_events e
      where e.event_key='jobs.job_completed'
        and e.occurred_at < now()-interval '1 day'
        and not exists (
          select 1 from public.finance_job_completion_intake i
          where i.source_event_id=e.event_id
        )
    ) then 'passed' else 'failed' end,
    'No canonical completed-job event has remained outside Finance intake for more than 24 hours.'
  union all
  select 'consumer_no_stale_accounting_review',
    case when not exists (
      select 1 from public.job_completion_accounting_events
      where accounting_action='queue_review'
        and event_status='queued'
        and payload->>'consumer'='finance_job_completion_consumer'
        and created_at < now()-interval '7 days'
    ) then 'passed' else 'failed' end,
    'No Finance review created by the completion consumer has remained queued for more than seven days.'
  union all
  select 'consumer_observability_read_only',
    'passed',
    'Schema 170 adds health views/assertions only; it does not execute the consumer, post accounting, create invoices, or update Jobs completion state.';
$$;

revoke all on function public.ywi_it_cross_module_consumer_observability_assertions() from public, anon, authenticated;
grant execute on function public.ywi_it_cross_module_consumer_observability_assertions() to service_role;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values (
  'cross_module_consumer_observability','Architecture','Cross-module consumer backlog and failures are visible in I.T. Readiness','critical',
  'Resolve failed or stale Jobs completion / Finance intake conditions before dependent accounting automation is released.',
  'Admin > I.T. Readiness',36,true
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
    next_action_hint='Schema 169 Finance completion consumption is source-proven; Schema 170 makes consumer health release-visible.',
    updated_at=now()
where rail_key='schema169_finance_job_completion_consumer';

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values (
  'schema170_it_consumer_observability','architecture','I.T. cross-module consumer observability','active',90,6,7,
  'Merge the exact green Schema 170 source SHA, record main workflow evidence, then apply/verify the read-only consumer health assertions before invoice automation begins.',
  'I.T. / Finance / Architecture',90,
  '{"build":"2026-09-02b","schema":170,"source":"jobs.job_completed","consumer":"finance","read_only":true,"browser_control_plane":false,"invoice_automation":false}'::jsonb
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
  170,
  '170_it_cross_module_consumer_observability',
  '170_it_cross_module_consumer_observability.sql',
  '2026-09-02b',
  'Adds private read-only I.T. health and assertions for the canonical Jobs completion to Finance consumer pipeline, including stale backlog and failed-intake visibility.',
  'applied',
  'No consumer execution, invoice automation, Jobs writeback, business-module addition, or Production promotion is introduced.'
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
select 170::int as expected_schema_version,
  coalesce(max(schema_version) filter (where status='applied'),0)::int as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=170 then 'current' else 'behind' end as drift_status,
  case when coalesce(max(schema_version) filter (where status='applied'),0)>=170
    then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 170.' end as message,
  now() as checked_at
from public.app_schema_versions;

commit;
