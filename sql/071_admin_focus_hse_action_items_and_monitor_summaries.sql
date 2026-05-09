-- 071_admin_focus_hse_action_items_and_monitor_summaries.sql
-- Adds Admin focus/review views for:
-- 1) HSE packet action items
-- 2) Daily traffic analytics summaries
-- 3) Monitor threshold alerts
--
-- This version is aligned to the actual 069/070 schema.
-- Note: linked_hse_packets has:
--   - unscheduled_project (boolean)
--   - standalone_project_name (text)
-- It does NOT have unscheduled_project_name.

create or replace view public.v_hse_packet_action_items as
with base as (
  select
    hp.id as packet_id,
    hp.packet_number,
    hp.packet_type,
    hp.packet_scope,
    hp.packet_status,
    hp.job_id,
    hp.work_order_id,
    hp.dispatch_id,
    hp.equipment_master_id,
    hp.unscheduled_project,
    hp.standalone_project_name,
    hp.completion_percent,
    hp.required_step_count,
    hp.completed_step_count,
    greatest(coalesce(hp.required_step_count, 0) - coalesce(hp.completed_step_count, 0), 0) as open_step_count,
    hp.exception_event_count,
    hp.proof_count,
    hp.photo_count,
    hp.document_count,
    hp.ready_for_closeout_at,
    hp.closed_at,
    hp.reopen_in_progress,
    hp.reopen_count,
    hp.last_reopened_at,
    hp.last_event_at,
    hp.last_proof_at,
    hp.field_signoff_required,
    hp.field_signoff_completed,
    hp.weather_monitoring_required,
    hp.weather_monitoring_completed,
    hp.heat_monitoring_required,
    hp.heat_monitoring_completed,
    hp.chemical_handling_required,
    hp.chemical_handling_completed,
    hp.traffic_control_required,
    hp.traffic_control_completed,
    coalesce(nullif(trim(hp.standalone_project_name), ''), hp.packet_number) as project_label
  from public.v_hse_packet_progress hp
)
select
  b.packet_id,
  b.packet_number,
  b.packet_type,
  b.packet_scope,
  b.packet_status,
  b.job_id,
  b.work_order_id,
  b.dispatch_id,
  b.equipment_master_id,
  b.unscheduled_project,
  b.standalone_project_name,
  b.project_label,
  b.completion_percent,
  b.required_step_count,
  b.completed_step_count,
  b.open_step_count,
  b.exception_event_count,
  b.proof_count,
  b.photo_count,
  b.document_count,
  b.ready_for_closeout_at,
  b.closed_at,
  b.reopen_in_progress,
  b.reopen_count,
  b.last_reopened_at,
  b.last_event_at,
  b.last_proof_at,

  case
    when coalesce(b.closed_at, null) is not null and coalesce(b.reopen_in_progress, false) then 5
    when coalesce(b.exception_event_count, 0) > 0 then 10
    when coalesce(b.field_signoff_required, false) and not coalesce(b.field_signoff_completed, false) and coalesce(b.open_step_count, 0) = 0 then 20
    when coalesce(b.ready_for_closeout_at, null) is not null and b.closed_at is null then 30
    when coalesce(b.open_step_count, 0) > 0 then 40
    else 90
  end as action_priority,

  case
    when coalesce(b.closed_at, null) is not null and coalesce(b.reopen_in_progress, false) then 'reopen_followup'
    when coalesce(b.exception_event_count, 0) > 0 then 'exception_review'
    when coalesce(b.field_signoff_required, false) and not coalesce(b.field_signoff_completed, false) and coalesce(b.open_step_count, 0) = 0 then 'field_signoff'
    when coalesce(b.ready_for_closeout_at, null) is not null and b.closed_at is null then 'closeout'
    when coalesce(b.open_step_count, 0) > 0 then 'workflow_completion'
    else 'review'
  end as action_code,

  case
    when coalesce(b.closed_at, null) is not null and coalesce(b.reopen_in_progress, false) then 'Reopened packet needs follow-up'
    when coalesce(b.exception_event_count, 0) > 0 then 'Packet has exception events'
    when coalesce(b.field_signoff_required, false) and not coalesce(b.field_signoff_completed, false) and coalesce(b.open_step_count, 0) = 0 then 'Packet ready for field signoff'
    when coalesce(b.ready_for_closeout_at, null) is not null and b.closed_at is null then 'Packet ready for closeout'
    when coalesce(b.open_step_count, 0) > 0 then 'Packet still has open workflow steps'
    else 'Packet review'
  end as action_title,

  concat_ws(
    ' | ',
    case when b.unscheduled_project then 'Unscheduled project' end,
    case when coalesce(b.open_step_count, 0) > 0 then ('Open steps: ' || b.open_step_count::text) end,
    case when coalesce(b.exception_event_count, 0) > 0 then ('Exceptions: ' || b.exception_event_count::text) end,
    case when coalesce(b.proof_count, 0) > 0 then ('Proofs: ' || b.proof_count::text) end,
    case when coalesce(b.ready_for_closeout_at, null) is not null and b.closed_at is null then 'Awaiting closeout' end,
    case when coalesce(b.reopen_in_progress, false) then 'Reopen in progress' end
  ) as action_summary,

  (
    coalesce(b.exception_event_count, 0) > 0
    or (coalesce(b.field_signoff_required, false) and not coalesce(b.field_signoff_completed, false))
    or coalesce(b.open_step_count, 0) > 0
    or (coalesce(b.ready_for_closeout_at, null) is not null and b.closed_at is null)
    or coalesce(b.reopen_in_progress, false)
  ) as needs_attention
from base b;

create or replace view public.v_app_traffic_daily_summary as
with daily as (
  select
    ate.created_at::date as event_date,
    count(*)::int as total_events,
    count(*) filter (where ate.event_name = 'page_view')::int as page_view_count,
    count(*) filter (where ate.event_name = 'route_view')::int as route_view_count,
    count(*) filter (where ate.event_name = 'admin_load')::int as admin_load_count,
    count(*) filter (where ate.event_name = 'api_call')::int as api_call_count,
    count(*) filter (where ate.event_name = 'api_error')::int as api_error_count,
    count(*) filter (where ate.event_name = 'client_error')::int as client_error_count,
    count(*) filter (where ate.event_name = 'upload_failure')::int as upload_failure_count,
    count(*) filter (where ate.event_name = 'upload_success')::int as upload_success_count,
    count(distinct nullif(ate.session_key, ''))::int as session_count,
    count(distinct nullif(ate.visitor_key, ''))::int as visitor_count,
    count(distinct ate.profile_id)::int as authenticated_profile_count,
    avg(ate.duration_ms)::numeric(12,2) as avg_duration_ms,
    max(ate.duration_ms) as max_duration_ms
  from public.app_traffic_events ate
  group by ate.created_at::date
)
select
  d.event_date,
  d.total_events,
  d.page_view_count,
  d.route_view_count,
  d.admin_load_count,
  d.api_call_count,
  d.api_error_count,
  d.client_error_count,
  d.upload_failure_count,
  d.upload_success_count,
  d.session_count,
  d.visitor_count,
  d.authenticated_profile_count,
  d.avg_duration_ms,
  d.max_duration_ms,
  round((coalesce(d.api_error_count, 0)::numeric / nullif(d.api_call_count, 0)::numeric) * 100, 2) as api_error_rate_percent,
  round(((coalesce(d.api_error_count, 0) + coalesce(d.client_error_count, 0) + coalesce(d.upload_failure_count, 0))::numeric / nullif(d.total_events, 0)::numeric) * 100, 2) as trouble_event_rate_percent
from daily d;

create or replace view public.v_monitor_threshold_alerts as
with open_monitor_rollups as (
  select
    bme.monitor_scope as alert_scope,
    count(*)::int as open_incident_count,
    count(*) filter (where bme.severity in ('critical', 'error'))::int as open_error_incident_count,
    max(bme.last_seen_at) as observed_at
  from public.backend_monitor_events bme
  where bme.lifecycle_status in ('open', 'investigating')
  group by bme.monitor_scope
),
traffic_alerts as (
  select
    ('traffic-' || vads.event_date::text) as alert_key,
    'analytics'::text as alert_scope,
    case
      when coalesce(vads.api_error_rate_percent, 0) >= 10
        or coalesce(vads.trouble_event_rate_percent, 0) >= 15
        then 'error'
      else 'warning'
    end as alert_level,
    'Traffic / reliability threshold alert'::text as alert_title,
    concat_ws(
      ' | ',
      'Date: ' || vads.event_date::text,
      'API error rate: ' || coalesce(vads.api_error_rate_percent, 0)::text || '%',
      'Trouble event rate: ' || coalesce(vads.trouble_event_rate_percent, 0)::text || '%',
      'Upload failures: ' || coalesce(vads.upload_failure_count, 0)::text
    ) as alert_summary,
    vads.event_date::timestamp as observed_at,
    vads.event_date,
    greatest(coalesce(vads.api_error_rate_percent, 0), coalesce(vads.trouble_event_rate_percent, 0))::numeric(12,2) as metric_value,
    case
      when coalesce(vads.api_error_rate_percent, 0) >= 10 then 10::numeric(12,2)
      when coalesce(vads.trouble_event_rate_percent, 0) >= 15 then 15::numeric(12,2)
      when coalesce(vads.upload_failure_count, 0) >= 3 then 3::numeric(12,2)
      else 5::numeric(12,2)
    end as threshold_value,
    vads.total_events as related_count,
    jsonb_build_object(
      'api_error_rate_percent', vads.api_error_rate_percent,
      'trouble_event_rate_percent', vads.trouble_event_rate_percent,
      'upload_failure_count', vads.upload_failure_count,
      'api_call_count', vads.api_call_count,
      'api_error_count', vads.api_error_count,
      'client_error_count', vads.client_error_count
    ) as details
  from public.v_app_traffic_daily_summary vads
  where
    coalesce(vads.api_error_rate_percent, 0) >= 5
    or coalesce(vads.trouble_event_rate_percent, 0) >= 8
    or coalesce(vads.upload_failure_count, 0) >= 3
),
monitor_alerts as (
  select
    ('monitor-' || omr.alert_scope) as alert_key,
    omr.alert_scope,
    case
      when coalesce(omr.open_error_incident_count, 0) > 0 then 'error'
      else 'warning'
    end as alert_level,
    'Open monitor incidents'::text as alert_title,
    concat_ws(
      ' | ',
      'Scope: ' || omr.alert_scope,
      'Open incidents: ' || omr.open_incident_count::text,
      'Open error/critical incidents: ' || omr.open_error_incident_count::text
    ) as alert_summary,
    omr.observed_at::timestamp as observed_at,
    omr.observed_at::date as event_date,
    omr.open_incident_count::numeric(12,2) as metric_value,
    case
      when coalesce(omr.open_error_incident_count, 0) > 0 then 1::numeric(12,2)
      else 5::numeric(12,2)
    end as threshold_value,
    omr.open_incident_count as related_count,
    jsonb_build_object(
      'open_incident_count', omr.open_incident_count,
      'open_error_incident_count', omr.open_error_incident_count
    ) as details
  from open_monitor_rollups omr
  where
    coalesce(omr.open_error_incident_count, 0) > 0
    or coalesce(omr.open_incident_count, 0) >= 5
)
select * from traffic_alerts
union all
select * from monitor_alerts;
