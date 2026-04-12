-- 071_admin_focus_hse_action_items_and_monitor_summaries.sql
-- Adds:
-- 1) HSE packet action-item view for closeout, reopen, and required-step follow-up
-- 2) traffic daily summary view for admin analytics review
-- 3) threshold-alert summary view so Admin can see spikes without reading raw rows

create or replace view public.v_hse_packet_action_items as
with packet_base as (
  select
    lhp.id as packet_id,
    lhp.packet_number,
    lhp.packet_scope,
    lhp.packet_status,
    lhp.packet_type,
    lhp.job_id,
    lhp.work_order_id,
    lhp.dispatch_id,
    lhp.route_id,
    lhp.client_site_id,
    lhp.equipment_master_id,
    lhp.supervisor_profile_id,
    lhp.unscheduled_project,
    lhp.unscheduled_project_name,
    coalesce(vhpp.required_step_count, 0) as required_step_count,
    coalesce(vhpp.completed_step_count, 0) as completed_step_count,
    coalesce(vhpp.completion_percent, lhp.completion_percent, 0) as completion_percent,
    coalesce(vhpp.proof_count, 0) as proof_count,
    coalesce(vhpp.reopen_count, lhp.reopen_count, 0) as reopen_count,
    coalesce(lhp.briefing_required and not lhp.briefing_completed, false) as missing_briefing,
    coalesce(lhp.inspection_required and not lhp.inspection_completed, false) as missing_inspection,
    coalesce(lhp.emergency_review_required and not lhp.emergency_review_completed, false) as missing_emergency_review,
    coalesce(lhp.weather_monitoring_required and not lhp.weather_monitoring_completed, false) as missing_weather,
    coalesce(lhp.heat_monitoring_required and not lhp.heat_monitoring_completed, false) as missing_heat,
    coalesce(lhp.chemical_handling_required and not lhp.chemical_handling_completed, false) as missing_chemical,
    coalesce(lhp.traffic_control_required and not lhp.traffic_control_completed, false) as missing_traffic,
    coalesce(lhp.field_signoff_required and not lhp.field_signoff_completed, false) as missing_signoff,
    coalesce(lhp.closeout_completed, false) as closeout_completed,
    coalesce(lhp.reopen_in_progress, false) as reopen_in_progress,
    lhp.ready_for_closeout_at,
    lhp.closed_at,
    lhp.last_reopened_at,
    lhp.updated_at,
    lhp.created_at
  from public.linked_hse_packets lhp
  left join public.v_hse_packet_progress vhpp on vhpp.id = lhp.id
)
select
  pb.packet_id as id,
  pb.packet_id,
  pb.packet_number,
  pb.packet_scope,
  pb.packet_status,
  pb.packet_type,
  pb.job_id,
  pb.work_order_id,
  pb.dispatch_id,
  pb.route_id,
  pb.client_site_id,
  pb.equipment_master_id,
  pb.supervisor_profile_id,
  pb.unscheduled_project,
  pb.unscheduled_project_name,
  pb.required_step_count,
  pb.completed_step_count,
  pb.completion_percent,
  pb.proof_count,
  pb.reopen_count,
  pb.ready_for_closeout_at,
  pb.closed_at,
  pb.last_reopened_at,
  pb.updated_at,
  pb.created_at,
  case
    when pb.reopen_in_progress then 'critical'
    when pb.packet_status in ('ready_for_closeout', 'closed') and pb.missing_signoff then 'critical'
    when pb.packet_status = 'ready_for_closeout' and not pb.closeout_completed then 'warning'
    when pb.missing_weather or pb.missing_heat or pb.missing_chemical or pb.missing_traffic then 'warning'
    when pb.missing_briefing or pb.missing_inspection or pb.missing_emergency_review then 'warning'
    when pb.proof_count = 0 and pb.packet_status in ('in_progress', 'ready_for_closeout') then 'info'
    else 'normal'
  end as action_priority,
  case
    when pb.reopen_in_progress then 'Packet was reopened and still needs follow-up before closeout can stand.'
    when pb.packet_status in ('ready_for_closeout', 'closed') and pb.missing_signoff then 'Field signoff is still missing for a packet already at closeout stage.'
    when pb.packet_status = 'ready_for_closeout' and not pb.closeout_completed then 'Packet is ready for closeout review but has not been formally closed.'
    when pb.missing_weather then 'Required weather monitoring check is still incomplete.'
    when pb.missing_heat then 'Required heat-stress workflow check is still incomplete.'
    when pb.missing_chemical then 'Required chemical-handling workflow check is still incomplete.'
    when pb.missing_traffic then 'Required traffic/public interaction control check is still incomplete.'
    when pb.missing_briefing then 'Required briefing step is still incomplete.'
    when pb.missing_inspection then 'Required inspection step is still incomplete.'
    when pb.missing_emergency_review then 'Required emergency review step is still incomplete.'
    when pb.proof_count = 0 and pb.packet_status in ('in_progress', 'ready_for_closeout') then 'No proof items are linked yet for an active packet.'
    else 'Packet currently has no high-priority action item.'
  end as action_reason
from packet_base pb;

create or replace view public.v_app_traffic_daily_summary as
select
  date_trunc('day', ate.created_at)::date as activity_date,
  count(*) as event_count,
  count(distinct coalesce(nullif(ate.session_key, ''), nullif(ate.visitor_key, ''), ate.id::text)) as unique_sessions,
  count(*) filter (where ate.event_name = 'page_view') as page_views,
  count(*) filter (where ate.event_name = 'route_view') as route_views,
  count(*) filter (where ate.event_name = 'api_call') as api_calls,
  count(*) filter (where ate.event_name = 'api_error') as api_errors,
  count(*) filter (where ate.event_name = 'client_error') as client_errors,
  count(*) filter (where ate.event_name = 'upload_failure') as upload_failures,
  round(avg(nullif(ate.duration_ms, 0))::numeric, 2) as avg_duration_ms,
  max(ate.created_at) as last_event_at
from public.app_traffic_events ate
group by 1
order by 1 desc;

create or replace view public.v_monitor_threshold_alerts as
with upload_24h as (
  select
    count(*) filter (where retry_status in ('pending', 'retrying')) as pending_upload_failures,
    count(*) as total_upload_failures_24h
  from public.field_upload_failures
  where created_at >= now() - interval '24 hours'
),
monitor_24h as (
  select
    count(*) filter (where severity in ('error', 'critical')) as error_or_critical_24h,
    count(*) filter (where lifecycle_status in ('open', 'investigating') and severity = 'critical') as critical_open_count,
    count(*) filter (where lifecycle_status in ('open', 'investigating')) as open_monitor_count
  from public.backend_monitor_events
  where created_at >= now() - interval '24 hours'
),
journal_open as (
  select count(*) as open_journal_exceptions
  from public.gl_journal_sync_exceptions
  where exception_status = 'open'
),
hse_action as (
  select
    count(*) filter (where action_priority = 'critical') as critical_hse_packets,
    count(*) filter (where action_priority = 'warning') as warning_hse_packets
  from public.v_hse_packet_action_items
)
select
  'upload_failures_24h'::text as alert_key,
  'Upload failures in the last 24 hours'::text as alert_name,
  u.total_upload_failures_24h::integer as current_value,
  5::integer as warning_threshold,
  10::integer as critical_threshold,
  case when u.total_upload_failures_24h >= 10 then 'critical'
       when u.total_upload_failures_24h >= 5 then 'warning'
       else 'normal' end as alert_status,
  '24h'::text as alert_window,
  'Tracks recent field upload issues across comments, route execution attachments, HSE proofs, and evidence uploads.'::text as alert_notes
from upload_24h u
union all
select
  'monitor_errors_24h',
  'Error/critical monitor incidents in the last 24 hours',
  m.error_or_critical_24h::integer,
  3,
  6,
  case when m.error_or_critical_24h >= 6 then 'critical'
       when m.error_or_critical_24h >= 3 then 'warning'
       else 'normal' end,
  '24h',
  'Shows repeated frontend/backend/storage/auth incidents so Admin can escalate before field work is affected.'
from monitor_24h m
union all
select
  'critical_monitors_open',
  'Open critical monitor incidents',
  m.critical_open_count::integer,
  1,
  3,
  case when m.critical_open_count >= 3 then 'critical'
       when m.critical_open_count >= 1 then 'warning'
       else 'normal' end,
  'open',
  'Any critical incident left open should be reviewed quickly.'
from monitor_24h m
union all
select
  'journal_sync_exceptions_open',
  'Open journal sync exceptions',
  j.open_journal_exceptions::integer,
  3,
  8,
  case when j.open_journal_exceptions >= 8 then 'critical'
       when j.open_journal_exceptions >= 3 then 'warning'
       else 'normal' end,
  'open',
  'Flags stale or drifted source-generated accounting batches that still need review.'
from journal_open j
union all
select
  'hse_action_items_open',
  'Open HSE action items',
  (h.critical_hse_packets + h.warning_hse_packets)::integer,
  3,
  8,
  case when (h.critical_hse_packets + h.warning_hse_packets) >= 8 or h.critical_hse_packets >= 3 then 'critical'
       when (h.critical_hse_packets + h.warning_hse_packets) >= 3 or h.critical_hse_packets >= 1 then 'warning'
       else 'normal' end,
  'open',
  'Highlights linked or standalone packets still missing safety steps, signoff, or closeout follow-up.'
from hse_action h;
