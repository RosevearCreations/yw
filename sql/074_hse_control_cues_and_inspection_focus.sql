-- 074_hse_control_cues_and_inspection_focus.sql
-- Tightens HSE packet and inspection capture around the requested OSHA-oriented focus:
-- - machinery / tool hazards
-- - lifting and awkward posture
-- - weather / heat workload cues
-- - chemicals / public interaction / cones / barriers
-- Keeps HSE standalone-capable while making packet and event review more structured.

create extension if not exists pgcrypto;

alter table if exists public.linked_hse_packets
  add column if not exists machinery_review_required boolean not null default false,
  add column if not exists machinery_review_completed boolean not null default false,
  add column if not exists last_machinery_review_at timestamptz,
  add column if not exists moving_blade_risk boolean not null default false,
  add column if not exists pinch_point_risk boolean not null default false,
  add column if not exists thrown_object_risk boolean not null default false,
  add column if not exists guard_controls_verified boolean not null default false,
  add column if not exists lockout_required boolean not null default false,
  add column if not exists lockout_verified boolean not null default false,
  add column if not exists task_tool_risk_notes text,
  add column if not exists machinery_notes text,
  add column if not exists lifting_review_required boolean not null default false,
  add column if not exists lifting_review_completed boolean not null default false,
  add column if not exists last_lifting_review_at timestamptz,
  add column if not exists manual_handling_required boolean not null default false,
  add column if not exists repetitive_motion_risk boolean not null default false,
  add column if not exists overhead_reach_risk boolean not null default false,
  add column if not exists uneven_terrain_risk boolean not null default false,
  add column if not exists crew_lift_required boolean not null default false,
  add column if not exists crew_size_notes text,
  add column if not exists lifting_notes text,
  add column if not exists hydration_plan_notes text,
  add column if not exists clothing_notes text,
  add column if not exists sun_air_movement_notes text,
  add column if not exists worker_specific_risk_notes text,
  add column if not exists sds_notes text,
  add column if not exists cones_barriers_required boolean not null default false,
  add column if not exists cones_barriers_completed boolean not null default false,
  add column if not exists roadside_exposure_risk boolean not null default false,
  add column if not exists site_communication_notes text;

alter table if exists public.hse_packet_events
  add column if not exists hazard_category text not null default 'general',
  add column if not exists moving_blade_risk boolean not null default false,
  add column if not exists pinch_point_risk boolean not null default false,
  add column if not exists thrown_object_risk boolean not null default false,
  add column if not exists guard_controls_verified boolean not null default false,
  add column if not exists lockout_required boolean not null default false,
  add column if not exists lockout_verified boolean not null default false,
  add column if not exists task_tool_risk_notes text,
  add column if not exists manual_handling_level text,
  add column if not exists manual_handling_required boolean not null default false,
  add column if not exists repetitive_motion_risk boolean not null default false,
  add column if not exists overhead_reach_risk boolean not null default false,
  add column if not exists uneven_terrain_risk boolean not null default false,
  add column if not exists crew_lift_required boolean not null default false,
  add column if not exists crew_size_needed integer,
  add column if not exists posture_notes text,
  add column if not exists humidity_percent numeric(6,2),
  add column if not exists sun_exposure_level text,
  add column if not exists air_movement_notes text,
  add column if not exists clothing_notes text,
  add column if not exists hydration_verified boolean not null default false,
  add column if not exists worker_specific_risk_notes text,
  add column if not exists cones_barriers_required boolean not null default false,
  add column if not exists cones_barriers_in_place boolean not null default false,
  add column if not exists roadside_exposure_risk boolean not null default false,
  add column if not exists site_communication_notes text;

alter table if exists public.hse_packet_events drop constraint if exists hse_packet_events_hazard_category_check;
alter table if exists public.hse_packet_events
  add constraint hse_packet_events_hazard_category_check
  check (hazard_category in ('general','machinery_tools','lifting_posture','weather_heat','chemicals_public','slip_trip_fall','traffic'));

alter table if exists public.hse_packet_events drop constraint if exists hse_packet_events_manual_handling_level_check;
alter table if exists public.hse_packet_events
  add constraint hse_packet_events_manual_handling_level_check
  check (manual_handling_level is null or manual_handling_level in ('low','moderate','high','team_lift'));

alter table if exists public.hse_packet_events drop constraint if exists hse_packet_events_sun_exposure_level_check;
alter table if exists public.hse_packet_events
  add constraint hse_packet_events_sun_exposure_level_check
  check (sun_exposure_level is null or sun_exposure_level in ('low','moderate','high','extreme'));

create or replace function public.ywi_sync_hse_packet_event_flags(p_packet_id uuid)
returns void
language plpgsql
as $$
declare
  v_weather_at timestamptz;
  v_heat_at timestamptz;
  v_chemical_at timestamptz;
  v_traffic_at timestamptz;
  v_machinery_at timestamptz;
  v_lifting_at timestamptz;
  v_signoff_at timestamptz;
  v_closeout_at timestamptz;
  v_reopen_at timestamptz;
  v_signoff_by uuid;
  v_has_weather boolean := false;
  v_has_heat boolean := false;
  v_has_chemical boolean := false;
  v_has_traffic boolean := false;
  v_has_machinery boolean := false;
  v_has_lifting boolean := false;
  v_has_signoff boolean := false;
  v_has_closeout boolean := false;
  v_has_reopen boolean := false;
  v_has_cones boolean := false;
  v_reopen_reason text;
begin
  if p_packet_id is null then
    return;
  end if;

  select
    max(event_at) filter (where event_type = 'weather_check'),
    max(event_at) filter (where event_type = 'heat_check'),
    max(event_at) filter (where event_type = 'chemical_check'),
    max(event_at) filter (where event_type = 'traffic_check'),
    max(event_at) filter (where hazard_category = 'machinery_tools'),
    max(event_at) filter (where hazard_category = 'lifting_posture'),
    bool_or(event_type = 'weather_check'),
    bool_or(event_type = 'heat_check'),
    bool_or(event_type = 'chemical_check'),
    bool_or(event_type = 'traffic_check'),
    bool_or(hazard_category = 'machinery_tools'),
    bool_or(hazard_category = 'lifting_posture'),
    bool_or(event_type = 'field_signoff'),
    bool_or(event_type = 'closeout'),
    bool_or(event_type = 'reopen'),
    bool_or(coalesce(cones_barriers_in_place, false))
  into
    v_weather_at,
    v_heat_at,
    v_chemical_at,
    v_traffic_at,
    v_machinery_at,
    v_lifting_at,
    v_has_weather,
    v_has_heat,
    v_has_chemical,
    v_has_traffic,
    v_has_machinery,
    v_has_lifting,
    v_has_signoff,
    v_has_closeout,
    v_has_reopen,
    v_has_cones
  from public.hse_packet_events
  where packet_id = p_packet_id;

  select e.event_at, e.created_by_profile_id
    into v_signoff_at, v_signoff_by
  from public.hse_packet_events e
  where e.packet_id = p_packet_id
    and e.event_type = 'field_signoff'
  order by e.event_at desc, e.created_at desc
  limit 1;

  select e.event_at
    into v_closeout_at
  from public.hse_packet_events e
  where e.packet_id = p_packet_id
    and e.event_type = 'closeout'
  order by e.event_at desc, e.created_at desc
  limit 1;

  select e.event_at, e.notes
    into v_reopen_at, v_reopen_reason
  from public.hse_packet_events e
  where e.packet_id = p_packet_id
    and e.event_type = 'reopen'
  order by e.event_at desc, e.created_at desc
  limit 1;

  update public.linked_hse_packets
  set
    last_weather_check_at = v_weather_at,
    last_heat_check_at = v_heat_at,
    last_chemical_check_at = v_chemical_at,
    last_traffic_check_at = v_traffic_at,
    last_machinery_review_at = v_machinery_at,
    last_lifting_review_at = v_lifting_at,
    weather_monitoring_completed = case when weather_monitoring_required then coalesce(v_has_weather, false) else weather_monitoring_completed end,
    heat_monitoring_completed = case when heat_monitoring_required then coalesce(v_has_heat, false) else heat_monitoring_completed end,
    chemical_handling_completed = case when chemical_handling_required then coalesce(v_has_chemical, false) else chemical_handling_completed end,
    traffic_control_completed = case when traffic_control_required then coalesce(v_has_traffic, false) else traffic_control_completed end,
    machinery_review_completed = case when machinery_review_required then coalesce(v_has_machinery, false) else machinery_review_completed end,
    lifting_review_completed = case when lifting_review_required then coalesce(v_has_lifting, false) else lifting_review_completed end,
    cones_barriers_completed = case when cones_barriers_required then coalesce(v_has_cones, false) else cones_barriers_completed end,
    field_signoff_completed = case when field_signoff_required then coalesce(v_has_signoff, false) else field_signoff_completed end,
    field_signed_off_at = case when coalesce(v_has_signoff, false) then coalesce(v_signoff_at, field_signed_off_at) else field_signed_off_at end,
    field_signed_off_by_profile_id = case when coalesce(v_has_signoff, false) then coalesce(v_signoff_by, field_signed_off_by_profile_id) else field_signed_off_by_profile_id end,
    closeout_completed = case when coalesce(v_has_closeout, false) then true else closeout_completed end,
    reopen_in_progress = case when coalesce(v_has_reopen, false) and not coalesce(v_has_closeout, false) then true else reopen_in_progress end,
    reopen_reason = case when coalesce(v_has_reopen, false) then coalesce(v_reopen_reason, reopen_reason) else reopen_reason end,
    last_reopened_at = case when coalesce(v_has_reopen, false) then coalesce(v_reopen_at, last_reopened_at) else last_reopened_at end,
    updated_at = now()
  where id = p_packet_id;
end;
$$;

create or replace view public.v_hse_packet_event_rollups as
select
  lhp.id as packet_id,
  count(hpe.id)::int as event_count,
  count(hpe.id) filter (where hpe.event_type = 'weather_check')::int as weather_event_count,
  count(hpe.id) filter (where hpe.event_type = 'heat_check')::int as heat_event_count,
  count(hpe.id) filter (where hpe.event_type = 'chemical_check')::int as chemical_event_count,
  count(hpe.id) filter (where hpe.event_type = 'traffic_check')::int as traffic_event_count,
  count(hpe.id) filter (where hpe.hazard_category = 'machinery_tools')::int as machinery_event_count,
  count(hpe.id) filter (where hpe.hazard_category = 'lifting_posture')::int as lifting_event_count,
  count(hpe.id) filter (where hpe.event_type = 'field_signoff')::int as signoff_event_count,
  count(hpe.id) filter (where hpe.event_type = 'closeout')::int as closeout_event_count,
  count(hpe.id) filter (where hpe.event_status in ('warning','exception'))::int as exception_event_count,
  max(hpe.event_at) as last_event_at,
  max(hpe.event_at) filter (where hpe.event_type = 'weather_check') as last_weather_event_at,
  max(hpe.event_at) filter (where hpe.event_type = 'heat_check') as last_heat_event_at,
  max(hpe.event_at) filter (where hpe.event_type = 'chemical_check') as last_chemical_event_at,
  max(hpe.event_at) filter (where hpe.event_type = 'traffic_check') as last_traffic_event_at,
  max(hpe.event_at) filter (where hpe.hazard_category = 'machinery_tools') as last_machinery_event_at,
  max(hpe.event_at) filter (where hpe.hazard_category = 'lifting_posture') as last_lifting_event_at,
  max(hpe.event_at) filter (where hpe.event_type = 'field_signoff') as last_signoff_event_at,
  max(hpe.event_at) filter (where hpe.event_type = 'closeout') as last_closeout_event_at
from public.linked_hse_packets lhp
left join public.hse_packet_events hpe on hpe.packet_id = lhp.id
group by lhp.id;

create or replace view public.v_hse_packet_progress as
with proof_rollups as (
  select
    hpp.packet_id,
    count(hpp.id)::int as proof_count,
    count(hpp.id) filter (where hpp.proof_kind = 'photo')::int as photo_count,
    count(hpp.id) filter (where hpp.proof_kind = 'signature')::int as signature_count,
    count(hpp.id) filter (where hpp.proof_kind in ('file','document'))::int as document_count,
    max(hpp.created_at) as last_proof_at
  from public.hse_packet_proofs hpp
  group by hpp.packet_id
), event_rollups as (
  select * from public.v_hse_packet_event_rollups
)
select
  lhp.id,
  lhp.packet_number,
  lhp.packet_type,
  lhp.packet_status,
  lhp.work_order_id,
  lhp.dispatch_id,
  ((case when lhp.briefing_required then 1 else 0 end)
    + (case when lhp.inspection_required then 1 else 0 end)
    + (case when lhp.emergency_review_required then 1 else 0 end)
    + (case when lhp.weather_monitoring_required then 1 else 0 end)
    + (case when lhp.heat_monitoring_required then 1 else 0 end)
    + (case when lhp.chemical_handling_required then 1 else 0 end)
    + (case when lhp.traffic_control_required then 1 else 0 end)
    + (case when lhp.machinery_review_required then 1 else 0 end)
    + (case when lhp.lifting_review_required then 1 else 0 end)
    + (case when lhp.cones_barriers_required then 1 else 0 end)
    + (case when lhp.field_signoff_required then 1 else 0 end)) as required_step_count,
  ((case when lhp.briefing_required and lhp.briefing_completed then 1 else 0 end)
    + (case when lhp.inspection_required and lhp.inspection_completed then 1 else 0 end)
    + (case when lhp.emergency_review_required and lhp.emergency_review_completed then 1 else 0 end)
    + (case when lhp.weather_monitoring_required and lhp.weather_monitoring_completed then 1 else 0 end)
    + (case when lhp.heat_monitoring_required and lhp.heat_monitoring_completed then 1 else 0 end)
    + (case when lhp.chemical_handling_required and lhp.chemical_handling_completed then 1 else 0 end)
    + (case when lhp.traffic_control_required and lhp.traffic_control_completed then 1 else 0 end)
    + (case when lhp.machinery_review_required and lhp.machinery_review_completed then 1 else 0 end)
    + (case when lhp.lifting_review_required and lhp.lifting_review_completed then 1 else 0 end)
    + (case when lhp.cones_barriers_required and lhp.cones_barriers_completed then 1 else 0 end)
    + (case when lhp.field_signoff_required and lhp.field_signoff_completed then 1 else 0 end)) as completed_step_count,
  lhp.completion_percent,
  lhp.ready_for_closeout_at,
  lhp.closed_at,
  coalesce(pr.proof_count, 0) as proof_count,
  coalesce(pr.photo_count, 0) as photo_count,
  coalesce(pr.signature_count, 0) as signature_count,
  coalesce(pr.document_count, 0) as document_count,
  pr.last_proof_at,
  lhp.reopen_in_progress,
  lhp.reopen_count,
  lhp.last_reopened_at,
  lhp.last_reopened_by_profile_id,
  lhp.job_id,
  lhp.equipment_master_id,
  lhp.packet_scope,
  lhp.unscheduled_project,
  lhp.standalone_project_name,
  lhp.weather_monitoring_required,
  lhp.weather_monitoring_completed,
  lhp.heat_monitoring_required,
  lhp.heat_monitoring_completed,
  lhp.chemical_handling_required,
  lhp.chemical_handling_completed,
  lhp.traffic_control_required,
  lhp.traffic_control_completed,
  lhp.machinery_review_required,
  lhp.machinery_review_completed,
  lhp.last_machinery_review_at,
  lhp.lifting_review_required,
  lhp.lifting_review_completed,
  lhp.last_lifting_review_at,
  lhp.cones_barriers_required,
  lhp.cones_barriers_completed,
  lhp.field_signoff_required,
  lhp.field_signoff_completed,
  lhp.field_signed_off_at,
  lhp.field_signed_off_by_profile_id,
  lhp.last_weather_check_at,
  lhp.last_heat_check_at,
  lhp.last_chemical_check_at,
  lhp.last_traffic_check_at,
  lhp.weather_notes,
  lhp.heat_plan_notes,
  lhp.chemical_notes,
  lhp.traffic_notes,
  lhp.machinery_notes,
  lhp.lifting_notes,
  lhp.hydration_plan_notes,
  lhp.clothing_notes,
  lhp.sun_air_movement_notes,
  lhp.worker_specific_risk_notes,
  lhp.sds_notes,
  lhp.public_interaction_notes,
  lhp.site_communication_notes,
  coalesce(er.event_count, 0) as event_count,
  coalesce(er.weather_event_count, 0) as weather_event_count,
  coalesce(er.heat_event_count, 0) as heat_event_count,
  coalesce(er.chemical_event_count, 0) as chemical_event_count,
  coalesce(er.traffic_event_count, 0) as traffic_event_count,
  coalesce(er.machinery_event_count, 0) as machinery_event_count,
  coalesce(er.lifting_event_count, 0) as lifting_event_count,
  coalesce(er.signoff_event_count, 0) as signoff_event_count,
  coalesce(er.closeout_event_count, 0) as closeout_event_count,
  coalesce(er.exception_event_count, 0) as exception_event_count,
  er.last_event_at,
  er.last_weather_event_at,
  er.last_heat_event_at,
  er.last_chemical_event_at,
  er.last_traffic_event_at,
  er.last_machinery_event_at,
  er.last_lifting_event_at,
  er.last_signoff_event_at,
  er.last_closeout_event_at
from public.linked_hse_packets lhp
left join proof_rollups pr on pr.packet_id = lhp.id
left join event_rollups er on er.packet_id = lhp.id;

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
    hp.machinery_review_required,
    hp.machinery_review_completed,
    hp.lifting_review_required,
    hp.lifting_review_completed,
    hp.cones_barriers_required,
    hp.cones_barriers_completed,
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
    when coalesce(b.machinery_review_required, false) and not coalesce(b.machinery_review_completed, false) then 15
    when coalesce(b.lifting_review_required, false) and not coalesce(b.lifting_review_completed, false) then 16
    when coalesce(b.field_signoff_required, false) and not coalesce(b.field_signoff_completed, false) and coalesce(b.open_step_count, 0) = 0 then 20
    when coalesce(b.ready_for_closeout_at, null) is not null and b.closed_at is null then 30
    when coalesce(b.open_step_count, 0) > 0 then 40
    else 90
  end as action_priority,
  case
    when coalesce(b.closed_at, null) is not null and coalesce(b.reopen_in_progress, false) then 'reopen_followup'
    when coalesce(b.exception_event_count, 0) > 0 then 'exception_review'
    when coalesce(b.machinery_review_required, false) and not coalesce(b.machinery_review_completed, false) then 'machinery_review'
    when coalesce(b.lifting_review_required, false) and not coalesce(b.lifting_review_completed, false) then 'lifting_review'
    when coalesce(b.field_signoff_required, false) and not coalesce(b.field_signoff_completed, false) and coalesce(b.open_step_count, 0) = 0 then 'field_signoff'
    when coalesce(b.ready_for_closeout_at, null) is not null and b.closed_at is null then 'closeout'
    when coalesce(b.open_step_count, 0) > 0 then 'workflow_completion'
    else 'review'
  end as action_code,
  case
    when coalesce(b.closed_at, null) is not null and coalesce(b.reopen_in_progress, false) then 'Reopened packet needs follow-up'
    when coalesce(b.exception_event_count, 0) > 0 then 'Packet has exception events'
    when coalesce(b.machinery_review_required, false) and not coalesce(b.machinery_review_completed, false) then 'Machinery and tool review still needs completion'
    when coalesce(b.lifting_review_required, false) and not coalesce(b.lifting_review_completed, false) then 'Lifting and awkward-posture review still needs completion'
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
    case when coalesce(b.machinery_review_required, false) and not coalesce(b.machinery_review_completed, false) then 'Machinery review open' end,
    case when coalesce(b.lifting_review_required, false) and not coalesce(b.lifting_review_completed, false) then 'Lifting review open' end,
    case when coalesce(b.cones_barriers_required, false) and not coalesce(b.cones_barriers_completed, false) then 'Cones/barriers not confirmed' end,
    case when coalesce(b.proof_count, 0) > 0 then ('Proofs: ' || b.proof_count::text) end,
    case when coalesce(b.ready_for_closeout_at, null) is not null and b.closed_at is null then 'Awaiting closeout' end,
    case when coalesce(b.reopen_in_progress, false) then 'Reopen in progress' end
  ) as action_summary,
  (
    coalesce(b.exception_event_count, 0) > 0
    or (coalesce(b.field_signoff_required, false) and not coalesce(b.field_signoff_completed, false))
    or (coalesce(b.machinery_review_required, false) and not coalesce(b.machinery_review_completed, false))
    or (coalesce(b.lifting_review_required, false) and not coalesce(b.lifting_review_completed, false))
    or (coalesce(b.cones_barriers_required, false) and not coalesce(b.cones_barriers_completed, false))
    or coalesce(b.open_step_count, 0) > 0
    or (coalesce(b.ready_for_closeout_at, null) is not null and b.closed_at is null)
    or coalesce(b.reopen_in_progress, false)
  ) as needs_attention
from base b;

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
  count(*) filter (where coalesce(machinery_review_required, false) and not coalesce(machinery_review_completed, false))::int as machinery_open_packets,
  count(*) filter (where coalesce(lifting_review_required, false) and not coalesce(lifting_review_completed, false))::int as lifting_open_packets,
  count(*) filter (where coalesce(cones_barriers_required, false) and not coalesce(cones_barriers_completed, false))::int as cones_open_packets,
  count(*) filter (where coalesce(field_signoff_required, false) and not coalesce(field_signoff_completed, false))::int as signoff_open_packets,
  count(*) filter (where coalesce(exception_event_count, 0) > 0)::int as exception_packets,
  count(*) filter (where coalesce(reopen_in_progress, false))::int as reopen_packets,
  count(*) filter (
    coalesce(exception_event_count, 0) > 0
    or (coalesce(field_signoff_required, false) and not coalesce(field_signoff_completed, false))
    or (coalesce(weather_monitoring_required, false) and not coalesce(weather_monitoring_completed, false))
    or (coalesce(heat_monitoring_required, false) and not coalesce(heat_monitoring_completed, false))
    or (coalesce(chemical_handling_required, false) and not coalesce(chemical_handling_completed, false))
    or (coalesce(traffic_control_required, false) and not coalesce(traffic_control_completed, false))
    or (coalesce(machinery_review_required, false) and not coalesce(machinery_review_completed, false))
    or (coalesce(lifting_review_required, false) and not coalesce(lifting_review_completed, false))
    or (coalesce(cones_barriers_required, false) and not coalesce(cones_barriers_completed, false))
    or coalesce(reopen_in_progress, false)
    or packet_status = 'ready_for_closeout'
  )::int as action_needed_packets
from public.v_hse_packet_progress;
