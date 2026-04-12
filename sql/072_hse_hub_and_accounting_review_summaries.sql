-- 072_hse_hub_and_accounting_review_summaries.sql
-- Adds lightweight summary views for the standalone HSE hub and accounting review shell.

create or replace view public.v_hse_dashboard_summary as
select
  count(*)::int as total_packets,
  count(*) filter (where packet_status = 'draft')::int as draft_packets,
  count(*) filter (where packet_status = 'in_progress')::int as in_progress_packets,
  count(*) filter (where packet_status = 'ready_for_closeout')::int as ready_for_closeout_packets,
  count(*) filter (where packet_status = 'closed')::int as closed_packets,
  count(*) filter (where coalesce(unscheduled_project, false))::int as unscheduled_project_packets,
  count(*) filter (where coalesce(weather_monitoring_required, false) and not coalesce(weather_monitoring_completed, false))::int as weather_open_packets,
  count(*) filter (where coalesce(heat_monitoring_required, false) and not coalesce(heat_monitoring_completed, false))::int as heat_open_packets,
  count(*) filter (where coalesce(chemical_handling_required, false) and not coalesce(chemical_handling_completed, false))::int as chemical_open_packets,
  count(*) filter (where coalesce(traffic_control_required, false) and not coalesce(traffic_control_completed, false))::int as traffic_open_packets,
  count(*) filter (where coalesce(field_signoff_required, false) and not coalesce(field_signoff_completed, false))::int as signoff_open_packets,
  count(*) filter (where coalesce(exception_event_count, 0) > 0)::int as exception_packets,
  count(*) filter (where coalesce(reopen_in_progress, false))::int as reopen_packets,
  count(*) filter (where coalesce(exception_event_count, 0) > 0
                or (coalesce(field_signoff_required, false) and not coalesce(field_signoff_completed, false))
                or (coalesce(weather_monitoring_required, false) and not coalesce(weather_monitoring_completed, false))
                or (coalesce(heat_monitoring_required, false) and not coalesce(heat_monitoring_completed, false))
                or (coalesce(chemical_handling_required, false) and not coalesce(chemical_handling_completed, false))
                or (coalesce(traffic_control_required, false) and not coalesce(traffic_control_completed, false))
                or coalesce(reopen_in_progress, false)
                or packet_status = 'ready_for_closeout')::int as action_needed_packets
from public.v_hse_packet_progress;

create or replace view public.v_accounting_review_summary as
with batch_rollup as (
  select
    count(*)::int as batch_count,
    count(*) filter (where coalesce(batch_status, '') <> 'posted')::int as unposted_batch_count,
    count(*) filter (where coalesce(is_balanced, false) = false)::int as unbalanced_batch_count,
    count(*) filter (where coalesce(source_sync_state, '') in ('stale', 'out_of_sync', 'needs_review'))::int as stale_source_batch_count,
    max(source_synced_at) as last_source_synced_at
  from public.v_gl_journal_batch_rollups
),
exception_rollup as (
  select
    count(*)::int as sync_exception_count,
    count(*) filter (where exception_status = 'open')::int as open_sync_exception_count,
    count(*) filter (where exception_status = 'open' and severity in ('warning','error'))::int as warning_or_error_sync_exception_count,
    max(last_seen_at) as last_sync_exception_at
  from public.v_gl_journal_sync_exceptions
),
ar_rollup as (
  select
    count(*) filter (where record_type = 'ar_invoice' and coalesce(balance_due, 0) > 0)::int as open_ar_record_count,
    coalesce(sum(case when record_type = 'ar_invoice' then balance_due else 0 end), 0)::numeric(12,2) as open_ar_balance
  from public.v_account_balance_rollups
),
ap_rollup as (
  select
    count(*) filter (where record_type = 'ap_bill' and coalesce(balance_due, 0) > 0)::int as open_ap_record_count,
    coalesce(sum(case when record_type = 'ap_bill' then balance_due else 0 end), 0)::numeric(12,2) as open_ap_balance
  from public.v_account_balance_rollups
),
traffic_rollup as (
  select
    max(event_date) as latest_daily_event_date,
    max(total_events) filter (where event_date = (select max(event_date) from public.v_app_traffic_daily_summary)) as latest_daily_total_events
  from public.v_app_traffic_daily_summary
)
select
  br.batch_count,
  br.unposted_batch_count,
  br.unbalanced_batch_count,
  br.stale_source_batch_count,
  br.last_source_synced_at,
  er.sync_exception_count,
  er.open_sync_exception_count,
  er.warning_or_error_sync_exception_count,
  er.last_sync_exception_at,
  ar.open_ar_record_count,
  ar.open_ar_balance,
  ap.open_ap_record_count,
  ap.open_ap_balance,
  tr.latest_daily_event_date,
  tr.latest_daily_total_events
from batch_rollup br
cross join exception_rollup er
cross join ar_rollup ar
cross join ap_rollup ap
cross join traffic_rollup tr;
