-- 069_hse_osha_interfaces_weather_chemical_traffic_signoff.sql
-- Adds stronger standalone-capable HSE packet interfaces for:
-- - standalone and unscheduled-project packets
-- - weather / heat workflow checks
-- - chemical handling workflow
-- - traffic / public interaction workflow
-- - field signoff and closeout event tracking
-- - optional linkage to jobs, sites, routes, equipment, work orders, and dispatches

create extension if not exists pgcrypto;

alter table if exists public.linked_hse_packets
  add column if not exists job_id bigint references public.jobs(id) on delete set null,
  add column if not exists equipment_master_id uuid references public.equipment_master(id) on delete set null,
  add column if not exists packet_scope text not null default 'standalone',
  add column if not exists unscheduled_project boolean not null default false,
  add column if not exists standalone_project_name text,
  add column if not exists weather_monitoring_required boolean not null default false,
  add column if not exists weather_monitoring_completed boolean not null default false,
  add column if not exists heat_monitoring_required boolean not null default false,
  add column if not exists heat_monitoring_completed boolean not null default false,
  add column if not exists chemical_handling_required boolean not null default false,
  add column if not exists chemical_handling_completed boolean not null default false,
  add column if not exists traffic_control_required boolean not null default false,
  add column if not exists traffic_control_completed boolean not null default false,
  add column if not exists field_signoff_required boolean not null default true,
  add column if not exists field_signoff_completed boolean not null default false,
  add column if not exists field_signed_off_at timestamptz,
  add column if not exists field_signed_off_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists last_weather_check_at timestamptz,
  add column if not exists last_heat_check_at timestamptz,
  add column if not exists last_chemical_check_at timestamptz,
  add column if not exists last_traffic_check_at timestamptz,
  add column if not exists weather_notes text,
  add column if not exists heat_plan_notes text,
  add column if not exists chemical_notes text,
  add column if not exists traffic_notes text,
  add column if not exists public_interaction_notes text;

alter table if exists public.linked_hse_packets drop constraint if exists linked_hse_packets_packet_type_check;
alter table if exists public.linked_hse_packets
  add constraint linked_hse_packets_packet_type_check
  check (packet_type in ('work_order','dispatch','standalone_hse','unscheduled_project'));

alter table if exists public.linked_hse_packets drop constraint if exists linked_hse_packets_packet_scope_check;
alter table if exists public.linked_hse_packets
  add constraint linked_hse_packets_packet_scope_check
  check (packet_scope in ('standalone','site','work_order','route','dispatch','equipment','job','subcontract_work'));

create index if not exists idx_linked_hse_packets_job_id on public.linked_hse_packets(job_id);
create index if not exists idx_linked_hse_packets_equipment_master_id on public.linked_hse_packets(equipment_master_id);
create index if not exists idx_linked_hse_packets_scope on public.linked_hse_packets(packet_scope, packet_status);

create table if not exists public.hse_packet_events (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references public.linked_hse_packets(id) on delete cascade,
  event_type text not null default 'note',
  event_status text not null default 'ok',
  event_at timestamptz not null default now(),
  weather_condition text,
  temperature_c numeric(6,2),
  humidex_c numeric(6,2),
  wind_kph numeric(6,2),
  precipitation_notes text,
  heat_risk_level text,
  chemical_name text,
  sds_reviewed boolean,
  ppe_verified boolean,
  traffic_control_level text,
  public_interaction_notes text,
  notes text,
  proof_url text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (event_type in ('note','weather_check','heat_check','chemical_check','traffic_check','field_signoff','closeout','reopen','dispatch_review','hazard_review')),
  check (event_status in ('ok','warning','exception','closed','signed')),
  check (heat_risk_level is null or heat_risk_level in ('low','moderate','high','extreme')),
  check (traffic_control_level is null or traffic_control_level in ('none','cones_only','lane_control','public_interface','spotter_required'))
);

create index if not exists idx_hse_packet_events_packet_id on public.hse_packet_events(packet_id, event_at desc);
create index if not exists idx_hse_packet_events_type on public.hse_packet_events(event_type, event_status, event_at desc);

create or replace function public.ywi_before_hse_packet_event()
returns trigger
language plpgsql
as $$
begin
  new.event_type := coalesce(nullif(trim(new.event_type), ''), 'note');
  new.event_status := coalesce(nullif(trim(new.event_status), ''), 'ok');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ywi_before_hse_packet_event on public.hse_packet_events;
create trigger trg_ywi_before_hse_packet_event
before insert or update on public.hse_packet_events
for each row execute function public.ywi_before_hse_packet_event();

create or replace function public.ywi_sync_hse_packet_event_flags(p_packet_id uuid)
returns void
language plpgsql
as $$
declare
  v_weather_at timestamptz;
  v_heat_at timestamptz;
  v_chemical_at timestamptz;
  v_traffic_at timestamptz;
  v_signoff_at timestamptz;
  v_closeout_at timestamptz;
  v_reopen_at timestamptz;
  v_signoff_by uuid;
  v_has_weather boolean := false;
  v_has_heat boolean := false;
  v_has_chemical boolean := false;
  v_has_traffic boolean := false;
  v_has_signoff boolean := false;
  v_has_closeout boolean := false;
  v_has_reopen boolean := false;
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
    bool_or(event_type = 'weather_check'),
    bool_or(event_type = 'heat_check'),
    bool_or(event_type = 'chemical_check'),
    bool_or(event_type = 'traffic_check'),
    bool_or(event_type = 'field_signoff'),
    bool_or(event_type = 'closeout'),
    bool_or(event_type = 'reopen')
  into
    v_weather_at,
    v_heat_at,
    v_chemical_at,
    v_traffic_at,
    v_has_weather,
    v_has_heat,
    v_has_chemical,
    v_has_traffic,
    v_has_signoff,
    v_has_closeout,
    v_has_reopen
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
    weather_monitoring_completed = case when weather_monitoring_required then coalesce(v_has_weather, false) else weather_monitoring_completed end,
    heat_monitoring_completed = case when heat_monitoring_required then coalesce(v_has_heat, false) else heat_monitoring_completed end,
    chemical_handling_completed = case when chemical_handling_required then coalesce(v_has_chemical, false) else chemical_handling_completed end,
    traffic_control_completed = case when traffic_control_required then coalesce(v_has_traffic, false) else traffic_control_completed end,
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

create or replace function public.ywi_after_hse_packet_event_sync()
returns trigger
language plpgsql
as $$
begin
  perform public.ywi_sync_hse_packet_event_flags(coalesce(new.packet_id, old.packet_id));
  return null;
end;
$$;

drop trigger if exists trg_ywi_after_hse_packet_event_sync on public.hse_packet_events;
create trigger trg_ywi_after_hse_packet_event_sync
after insert or update or delete on public.hse_packet_events
for each row execute function public.ywi_after_hse_packet_event_sync();

create or replace function public.ywi_before_linked_hse_packet()
returns trigger
language plpgsql
as $$
declare
  v_required_count integer := 0;
  v_completed_count integer := 0;
begin
  v_required_count :=
      (case when coalesce(new.briefing_required, false) then 1 else 0 end)
    + (case when coalesce(new.inspection_required, false) then 1 else 0 end)
    + (case when coalesce(new.emergency_review_required, false) then 1 else 0 end)
    + (case when coalesce(new.weather_monitoring_required, false) then 1 else 0 end)
    + (case when coalesce(new.heat_monitoring_required, false) then 1 else 0 end)
    + (case when coalesce(new.chemical_handling_required, false) then 1 else 0 end)
    + (case when coalesce(new.traffic_control_required, false) then 1 else 0 end)
    + (case when coalesce(new.field_signoff_required, false) then 1 else 0 end);

  v_completed_count :=
      (case when coalesce(new.briefing_required, false) and coalesce(new.briefing_completed, false) then 1 else 0 end)
    + (case when coalesce(new.inspection_required, false) and coalesce(new.inspection_completed, false) then 1 else 0 end)
    + (case when coalesce(new.emergency_review_required, false) and coalesce(new.emergency_review_completed, false) then 1 else 0 end)
    + (case when coalesce(new.weather_monitoring_required, false) and coalesce(new.weather_monitoring_completed, false) then 1 else 0 end)
    + (case when coalesce(new.heat_monitoring_required, false) and coalesce(new.heat_monitoring_completed, false) then 1 else 0 end)
    + (case when coalesce(new.chemical_handling_required, false) and coalesce(new.chemical_handling_completed, false) then 1 else 0 end)
    + (case when coalesce(new.traffic_control_required, false) and coalesce(new.traffic_control_completed, false) then 1 else 0 end)
    + (case when coalesce(new.field_signoff_required, false) and coalesce(new.field_signoff_completed, false) then 1 else 0 end);

  if tg_op = 'UPDATE'
     and coalesce(old.reopen_in_progress, false) = false
     and coalesce(new.reopen_in_progress, false) = true then
    new.reopen_count := coalesce(old.reopen_count, 0) + 1;
    new.last_reopened_at := now();
    new.last_reopened_by_profile_id := coalesce(new.last_reopened_by_profile_id, new.closed_by_profile_id, old.closed_by_profile_id, new.supervisor_profile_id);
  else
    new.reopen_count := coalesce(new.reopen_count, 0);
  end if;

  if coalesce(new.packet_type, '') = 'unscheduled_project' then
    new.unscheduled_project := true;
  end if;

  if coalesce(nullif(trim(coalesce(new.packet_scope, '')), ''), '') = '' or coalesce(new.packet_scope, '') = 'standalone' then
    if new.dispatch_id is not null then
      new.packet_scope := 'dispatch';
    elsif new.route_id is not null then
      new.packet_scope := 'route';
    elsif new.work_order_id is not null then
      new.packet_scope := 'work_order';
    elsif new.client_site_id is not null then
      new.packet_scope := 'site';
    elsif new.equipment_master_id is not null then
      new.packet_scope := 'equipment';
    elsif new.job_id is not null then
      new.packet_scope := 'job';
    else
      new.packet_scope := 'standalone';
    end if;
  end if;

  if coalesce(new.field_signoff_completed, false) and new.field_signed_off_at is null then
    new.field_signed_off_at := now();
  end if;

  if coalesce(new.field_signoff_completed, false) and new.field_signed_off_by_profile_id is null then
    new.field_signed_off_by_profile_id := coalesce(new.supervisor_profile_id, new.closed_by_profile_id, new.created_by_profile_id, old.field_signed_off_by_profile_id);
  end if;

  if coalesce(new.reopen_in_progress, false) then
    new.closeout_completed := false;
    new.packet_status := 'in_progress';
    new.ready_for_closeout_at := null;
    new.closed_at := null;
    new.completion_percent := round(
      case when v_required_count <= 0 then 100 else (v_completed_count::numeric / v_required_count::numeric) * 100 end,
      2
    );
  elsif coalesce(new.closeout_completed, false) or coalesce(new.packet_status, '') = 'closed' then
    new.packet_status := 'closed';
    new.completion_percent := 100;
    new.ready_for_closeout_at := coalesce(new.ready_for_closeout_at, now());
    new.closed_at := coalesce(new.closed_at, now());
  else
    if v_required_count <= 0 then
      new.completion_percent := 100;
      new.packet_status := 'ready_for_closeout';
      new.ready_for_closeout_at := coalesce(new.ready_for_closeout_at, now());
    else
      new.completion_percent := round((v_completed_count::numeric / v_required_count::numeric) * 100, 2);
      if v_completed_count = v_required_count then
        new.packet_status := 'ready_for_closeout';
        new.ready_for_closeout_at := coalesce(new.ready_for_closeout_at, now());
      elsif v_completed_count > 0 then
        if coalesce(new.packet_status, '') <> 'closed' then
          new.packet_status := 'in_progress';
        end if;
        new.ready_for_closeout_at := null;
        new.closed_at := null;
      else
        new.packet_status := 'draft';
        new.ready_for_closeout_at := null;
        new.closed_at := null;
      end if;
    end if;
  end if;

  if coalesce(new.packet_status, '') <> 'closed' then
    new.closed_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ywi_before_linked_hse_packet on public.linked_hse_packets;
create trigger trg_ywi_before_linked_hse_packet
before insert or update on public.linked_hse_packets
for each row execute function public.ywi_before_linked_hse_packet();

create or replace view public.v_hse_packet_event_rollups as
select
  lhp.id as packet_id,
  count(hpe.id)::int as event_count,
  count(hpe.id) filter (where hpe.event_type = 'weather_check')::int as weather_event_count,
  count(hpe.id) filter (where hpe.event_type = 'heat_check')::int as heat_event_count,
  count(hpe.id) filter (where hpe.event_type = 'chemical_check')::int as chemical_event_count,
  count(hpe.id) filter (where hpe.event_type = 'traffic_check')::int as traffic_event_count,
  count(hpe.id) filter (where hpe.event_type = 'field_signoff')::int as signoff_event_count,
  count(hpe.id) filter (where hpe.event_type = 'closeout')::int as closeout_event_count,
  count(hpe.id) filter (where hpe.event_status in ('warning','exception'))::int as exception_event_count,
  max(hpe.event_at) as last_event_at,
  max(hpe.event_at) filter (where hpe.event_type = 'weather_check') as last_weather_event_at,
  max(hpe.event_at) filter (where hpe.event_type = 'heat_check') as last_heat_event_at,
  max(hpe.event_at) filter (where hpe.event_type = 'chemical_check') as last_chemical_event_at,
  max(hpe.event_at) filter (where hpe.event_type = 'traffic_check') as last_traffic_event_at,
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
    + (case when lhp.field_signoff_required then 1 else 0 end)) as required_step_count,
  ((case when lhp.briefing_required and lhp.briefing_completed then 1 else 0 end)
    + (case when lhp.inspection_required and lhp.inspection_completed then 1 else 0 end)
    + (case when lhp.emergency_review_required and lhp.emergency_review_completed then 1 else 0 end)
    + (case when lhp.weather_monitoring_required and lhp.weather_monitoring_completed then 1 else 0 end)
    + (case when lhp.heat_monitoring_required and lhp.heat_monitoring_completed then 1 else 0 end)
    + (case when lhp.chemical_handling_required and lhp.chemical_handling_completed then 1 else 0 end)
    + (case when lhp.traffic_control_required and lhp.traffic_control_completed then 1 else 0 end)
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
  lhp.public_interaction_notes,
  coalesce(er.event_count, 0) as event_count,
  coalesce(er.weather_event_count, 0) as weather_event_count,
  coalesce(er.heat_event_count, 0) as heat_event_count,
  coalesce(er.chemical_event_count, 0) as chemical_event_count,
  coalesce(er.traffic_event_count, 0) as traffic_event_count,
  coalesce(er.signoff_event_count, 0) as signoff_event_count,
  coalesce(er.closeout_event_count, 0) as closeout_event_count,
  coalesce(er.exception_event_count, 0) as exception_event_count,
  er.last_event_at,
  er.last_weather_event_at,
  er.last_heat_event_at,
  er.last_chemical_event_at,
  er.last_traffic_event_at,
  er.last_signoff_event_at,
  er.last_closeout_event_at
from public.linked_hse_packets lhp
left join proof_rollups pr on pr.packet_id = lhp.id
left join event_rollups er on er.packet_id = lhp.id;
