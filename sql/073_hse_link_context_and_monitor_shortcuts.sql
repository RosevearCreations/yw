-- 073_hse_link_context_and_monitor_shortcuts.sql
-- Corrected again for PostgreSQL compatibility:
-- - client_site_id and route_id come from public.linked_hse_packets
-- - uuid values inside filtered aggregates are cast through text, then back to uuid where needed

create or replace view public.v_hse_link_context_summary as
with packet_base as (
  select
    hp.id,
    hp.packet_number,
    hp.packet_status,
    hp.job_id,
    hp.work_order_id,
    lhp.client_site_id,
    lhp.route_id,
    hp.dispatch_id,
    hp.equipment_master_id,
    hp.unscheduled_project,
    hp.packet_scope,
    hp.packet_type,
    coalesce(ai.action_priority, 90) as action_priority,
    coalesce(ai.action_title, 'Packet review') as action_title,
    ai.action_summary,
    coalesce(ai.needs_attention, false) as needs_attention
  from public.v_hse_packet_progress hp
  left join public.linked_hse_packets lhp
    on lhp.id = hp.id
  left join public.v_hse_packet_action_items ai
    on ai.packet_id = hp.id
), lane_rows as (
  select
    'job_work_order'::text as lane_key,
    'Jobs and work orders'::text as lane_title,
    1 as sort_order,
    id,
    packet_number,
    packet_status,
    action_priority,
    action_title,
    action_summary,
    needs_attention
  from packet_base
  where job_id is not null or work_order_id is not null

  union all

  select
    'site_context'::text as lane_key,
    'Sites and client locations'::text as lane_title,
    2 as sort_order,
    id,
    packet_number,
    packet_status,
    action_priority,
    action_title,
    action_summary,
    needs_attention
  from packet_base
  where client_site_id is not null

  union all

  select
    'route_dispatch'::text as lane_key,
    'Routes, dispatches, and subcontract work'::text as lane_title,
    3 as sort_order,
    id,
    packet_number,
    packet_status,
    action_priority,
    action_title,
    action_summary,
    needs_attention
  from packet_base
  where route_id is not null or dispatch_id is not null

  union all

  select
    'equipment'::text as lane_key,
    'Equipment-linked packets'::text as lane_title,
    4 as sort_order,
    id,
    packet_number,
    packet_status,
    action_priority,
    action_title,
    action_summary,
    needs_attention
  from packet_base
  where equipment_master_id is not null

  union all

  select
    'standalone'::text as lane_key,
    'Standalone and unscheduled packets'::text as lane_title,
    5 as sort_order,
    id,
    packet_number,
    packet_status,
    action_priority,
    action_title,
    action_summary,
    needs_attention
  from packet_base
  where coalesce(unscheduled_project, false)
     or coalesce(packet_scope, '') = 'standalone'
     or coalesce(packet_type, '') = 'unscheduled_project'
     or (
       job_id is null
       and work_order_id is null
       and client_site_id is null
       and route_id is null
       and dispatch_id is null
       and equipment_master_id is null
     )
), ranked as (
  select
    lr.*,
    row_number() over (
      partition by lr.lane_key
      order by
        case when lr.needs_attention then 0 else 1 end,
        lr.action_priority asc,
        lr.packet_number asc,
        lr.id asc
    ) as rn
  from lane_rows lr
)
select
  lane_key,
  lane_title,
  sort_order,
  'linked_hse_packet'::text as related_entity,
  count(*)::int as packet_count,
  count(*) filter (where needs_attention)::int as attention_count,
  count(*) filter (where packet_status = 'ready_for_closeout')::int as ready_for_closeout_count,
  (max(id::text) filter (where rn = 1))::uuid as top_packet_id,
  max(packet_number) filter (where rn = 1) as top_packet_number,
  max(action_title) filter (where rn = 1) as top_action_title,
  max(action_summary) filter (where rn = 1) as top_action_summary
from ranked
group by lane_key, lane_title, sort_order
order by sort_order, lane_key;

create or replace view public.v_monitor_review_summary as
with upload_ranked as (
  select
    'upload_failures'::text as lane_key,
    'Upload issues'::text as lane_title,
    1 as sort_order,
    'field_upload_failure'::text as related_entity,
    vur.id::text as record_id,
    coalesce(vur.file_name, vur.packet_number, vur.job_code, vur.linked_record_type, vur.id::text) as label,
    concat_ws(' | ', vur.failure_scope, vur.failure_stage, vur.failure_reason) as summary,
    (vur.resolved_at is null) as is_open,
    (coalesce(vur.retry_status, '') in ('failed', 'dead_letter')) as is_error,
    vur.created_at as observed_at,
    row_number() over (
      partition by 'upload_failures'
      order by
        case when vur.resolved_at is null then 0 else 1 end,
        vur.created_at desc,
        vur.id desc
    ) as rn
  from public.v_field_upload_failure_rollups vur
), upload_summary as (
  select
    lane_key,
    lane_title,
    sort_order,
    related_entity,
    count(*)::int as record_count,
    count(*) filter (where is_open)::int as open_count,
    count(*) filter (where is_error)::int as error_count,
    max(observed_at) as observed_at,
    max(record_id) filter (where rn = 1) as top_record_id,
    max(label) filter (where rn = 1) as top_label,
    max(summary) filter (where rn = 1) as top_summary
  from upload_ranked
  group by lane_key, lane_title, sort_order, related_entity
), traffic_ranked as (
  select
    'traffic_reliability'::text as lane_key,
    'Traffic and reliability'::text as lane_title,
    2 as sort_order,
    'app_traffic_event'::text as related_entity,
    vmt.alert_key::text as record_id,
    vmt.alert_title as label,
    vmt.alert_summary as summary,
    true as is_open,
    (coalesce(vmt.alert_level, '') = 'error') as is_error,
    vmt.observed_at,
    row_number() over (
      partition by 'traffic_reliability'
      order by
        case when coalesce(vmt.alert_level, '') = 'error' then 0 else 1 end,
        vmt.observed_at desc,
        vmt.alert_key asc
    ) as rn
  from public.v_monitor_threshold_alerts vmt
  where vmt.alert_scope = 'analytics'
     or vmt.alert_key like 'traffic-%'
), traffic_summary as (
  select
    lane_key,
    lane_title,
    sort_order,
    related_entity,
    count(*)::int as record_count,
    count(*)::int as open_count,
    count(*) filter (where is_error)::int as error_count,
    max(observed_at) as observed_at,
    max(record_id) filter (where rn = 1) as top_record_id,
    max(label) filter (where rn = 1) as top_label,
    max(summary) filter (where rn = 1) as top_summary
  from traffic_ranked
  group by lane_key, lane_title, sort_order, related_entity
), runtime_ranked as (
  select
    'runtime_incidents'::text as lane_key,
    'Runtime and API incidents'::text as lane_title,
    3 as sort_order,
    'backend_monitor_event'::text as related_entity,
    vbr.id::text as record_id,
    coalesce(vbr.title, vbr.event_name, vbr.id::text) as label,
    concat_ws(' | ', vbr.monitor_scope, vbr.severity, vbr.message) as summary,
    (coalesce(vbr.lifecycle_status, '') in ('open', 'investigating')) as is_open,
    (coalesce(vbr.severity, '') in ('critical', 'error')) as is_error,
    coalesce(vbr.last_seen_at, vbr.created_at) as observed_at,
    row_number() over (
      partition by 'runtime_incidents'
      order by
        case when coalesce(vbr.severity, '') in ('critical', 'error') then 0 else 1 end,
        case when coalesce(vbr.lifecycle_status, '') in ('open', 'investigating') then 0 else 1 end,
        coalesce(vbr.last_seen_at, vbr.created_at) desc,
        vbr.id desc
    ) as rn
  from public.v_backend_monitor_recent vbr
  where coalesce(vbr.lifecycle_status, '') in ('open', 'investigating')
     or coalesce(vbr.severity, '') in ('critical', 'error')
), runtime_summary as (
  select
    lane_key,
    lane_title,
    sort_order,
    related_entity,
    count(*)::int as record_count,
    count(*) filter (where is_open)::int as open_count,
    count(*) filter (where is_error)::int as error_count,
    max(observed_at) as observed_at,
    max(record_id) filter (where rn = 1) as top_record_id,
    max(label) filter (where rn = 1) as top_label,
    max(summary) filter (where rn = 1) as top_summary
  from runtime_ranked
  group by lane_key, lane_title, sort_order, related_entity
)
select * from upload_summary
union all
select * from traffic_summary
union all
select * from runtime_summary
order by sort_order, lane_key;
