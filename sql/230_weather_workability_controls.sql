begin;

-- Schema 230 — Build 342 Weather & Workability Controls.
-- Existing authorities remain canonical:
--   HSE weather/heat evidence = public.linked_hse_packets + public.hse_packet_events
--   actual crew scheduling/dispatch = public.dispatch_schedule_items
--   recurring visit changes = public.recurring_service_visit_events
-- Build 342 adds service-specific operational guidance, observations, supervisor decisions,
-- proposed postponement/reschedule evidence, and customer-notification readiness.
-- No weather threshold makes an automatic safety, dispatch, cancellation, or customer-contact decision.

create table if not exists public.workability_service_rules (
  id uuid primary key default gen_random_uuid(),
  rule_code text not null unique,
  rule_name text not null,
  service_context text not null,
  season_context text not null default 'four_season',
  condition_type text not null,
  guidance_level text not null default 'review',
  threshold_summary text,
  operator_guidance text not null,
  safety_note text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workability_rules_service_chk check (
    service_context in ('mowing_landscaping','fall_cleanup','snow_clearing_removal','general_outdoor')
  ),
  constraint workability_rules_season_chk check (
    season_context in ('spring_summer','fall','winter','four_season')
  ),
  constraint workability_rules_condition_chk check (
    condition_type in ('rain','saturated_ground','heat','cold','high_wind','lightning_storm','visibility','snowfall','freezing_rain_ice')
  ),
  constraint workability_rules_guidance_chk check (
    guidance_level in ('review','caution','restriction')
  ),
  constraint workability_rules_sort_chk check (sort_order between 0 and 10000)
);

create table if not exists public.workability_observations (
  id uuid primary key default gen_random_uuid(),
  observation_code text not null unique default ('WK-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
  service_date date not null,
  observed_at timestamptz not null default now(),
  observation_source text not null default 'supervisor',
  client_site_id uuid references public.client_sites(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  dispatch_schedule_item_id uuid references public.dispatch_schedule_items(id) on delete set null,
  recurring_service_agreement_id uuid references public.recurring_service_agreements(id) on delete set null,
  route_id uuid references public.routes(id) on delete set null,
  linked_hse_packet_id uuid references public.linked_hse_packets(id) on delete set null,
  service_context text not null,
  season_context text not null,
  weather_condition text,
  temperature_c numeric(6,2),
  humidex_c numeric(6,2),
  wind_kph numeric(7,2),
  visibility_km numeric(7,2),
  rain_state text not null default 'none',
  ground_state text not null default 'unknown',
  snowfall_cm numeric(7,2),
  freezing_rain_ice_state text not null default 'none',
  lightning_storm_state text not null default 'none',
  condition_tags jsonb not null default '[]'::jsonb,
  source_note text,
  observation_note text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workability_observation_source_chk check (
    observation_source in ('supervisor','crew','hse_review','forecast_review','customer_report','other')
  ),
  constraint workability_observation_service_chk check (
    service_context in ('mowing_landscaping','fall_cleanup','snow_clearing_removal','general_outdoor')
  ),
  constraint workability_observation_season_chk check (
    season_context in ('spring_summer','fall','winter','four_season')
  ),
  constraint workability_observation_rain_chk check (
    rain_state in ('none','light','moderate','heavy','recent')
  ),
  constraint workability_observation_ground_chk check (
    ground_state in ('unknown','dry','damp','saturated','frozen','snow_covered','icy')
  ),
  constraint workability_observation_ice_chk check (
    freezing_rain_ice_state in ('none','possible','observed','treated')
  ),
  constraint workability_observation_storm_chk check (
    lightning_storm_state in ('none','watch','nearby','observed')
  ),
  constraint workability_observation_wind_chk check (wind_kph is null or wind_kph between 0 and 300),
  constraint workability_observation_visibility_chk check (visibility_km is null or visibility_km between 0 and 100),
  constraint workability_observation_snow_chk check (snowfall_cm is null or snowfall_cm between 0 and 500),
  constraint workability_observation_tags_array_chk check (jsonb_typeof(condition_tags)='array')
);

create table if not exists public.workability_decisions (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.workability_observations(id) on delete cascade,
  decision_state text not null,
  workability_state text not null,
  decision_reason text not null,
  service_restriction_summary text,
  proposed_reschedule_start timestamptz,
  proposed_reschedule_end timestamptz,
  customer_notification_readiness text not null default 'not_ready',
  customer_notification_note text,
  dispatch_application_status text not null default 'no_change_needed',
  decided_by_profile_id uuid references public.profiles(id) on delete set null,
  decision_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint workability_decision_state_chk check (
    decision_state in ('workable','caution','postpone','reschedule','blocked')
  ),
  constraint workability_decision_workability_chk check (
    workability_state in ('workable','caution','delayed','blocked')
  ),
  constraint workability_decision_notify_chk check (
    customer_notification_readiness in ('not_needed','not_ready','ready','notified')
  ),
  constraint workability_decision_dispatch_chk check (
    dispatch_application_status in ('no_change_needed','workability_synced','pending_operator_dispatch','applied_separately')
  ),
  constraint workability_decision_reschedule_window_chk check (
    decision_state<>'reschedule'
    or (
      proposed_reschedule_start is not null
      and proposed_reschedule_end is not null
      and proposed_reschedule_end>proposed_reschedule_start
    )
  )
);

create table if not exists public.workability_notification_readiness_events (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.workability_decisions(id) on delete cascade,
  readiness_state text not null,
  channel_options jsonb not null default '[]'::jsonb,
  readiness_note text,
  recorded_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint workability_notification_event_state_chk check (
    readiness_state in ('not_needed','not_ready','ready','notified')
  ),
  constraint workability_notification_event_channels_chk check (jsonb_typeof(channel_options)='array')
);

create index if not exists workability_rules_service_season_idx
  on public.workability_service_rules(service_context,season_context,condition_type,is_active);
create index if not exists workability_observations_date_idx
  on public.workability_observations(service_date,observed_at desc);
create index if not exists workability_observations_dispatch_idx
  on public.workability_observations(dispatch_schedule_item_id,observed_at desc)
  where dispatch_schedule_item_id is not null;
create index if not exists workability_observations_site_idx
  on public.workability_observations(client_site_id,service_date desc)
  where client_site_id is not null;
create index if not exists workability_decisions_observation_idx
  on public.workability_decisions(observation_id,decision_at desc);
create index if not exists workability_notifications_decision_idx
  on public.workability_notification_readiness_events(decision_id,created_at desc);

alter table public.workability_service_rules enable row level security;
alter table public.workability_observations enable row level security;
alter table public.workability_decisions enable row level security;
alter table public.workability_notification_readiness_events enable row level security;

revoke all on table public.workability_service_rules from public,anon,authenticated;
revoke all on table public.workability_observations from public,anon,authenticated;
revoke all on table public.workability_decisions from public,anon,authenticated;
revoke all on table public.workability_notification_readiness_events from public,anon,authenticated;
grant select,insert,update on table public.workability_service_rules to service_role;
grant select,insert,update on table public.workability_observations to service_role;
grant select,insert on table public.workability_decisions to service_role;
grant select,insert on table public.workability_notification_readiness_events to service_role;

insert into public.workability_service_rules(
  rule_code,rule_name,service_context,season_context,condition_type,guidance_level,
  threshold_summary,operator_guidance,safety_note,sort_order
) values
  ('MOW-RAIN','Mowing / landscaping rain review','mowing_landscaping','spring_summer','rain','caution',
   'Rain is active/recent or the intended task may damage turf/soil or create unsafe footing.',
   'Review property condition, task type, equipment impact and client expectations before proceeding.',
   'Operational guidance only; supervisor/HSE review controls the decision.',10),
  ('MOW-SAT','Saturated ground restriction review','mowing_landscaping','spring_summer','saturated_ground','restriction',
   'Ground is saturated, rut-prone or unstable for the intended equipment/task.',
   'Consider postponement, lighter equipment, alternate task or reschedule after site inspection.',
   'Do not infer safe footing from this rule alone.',20),
  ('MOW-HEAT','Heat / humidex review','mowing_landscaping','spring_summer','heat','review',
   'Heat or humidex conditions warrant work/rest, hydration and exposure review.',
   'Use the established HSE heat process and supervisor judgment before dispatch/continuation.',
   'This rule does not replace HSE heat controls.',30),
  ('OUT-LIGHTNING','Lightning / storm review','general_outdoor','four_season','lightning_storm','restriction',
   'Lightning, thunderstorm or severe-storm conditions are observed or sufficiently near to require review.',
   'Pause for supervisor/HSE reassessment and record the operational disposition.',
   'No automatic safety verdict is made by Build 342.',40),
  ('OUT-WIND','High-wind review','general_outdoor','four_season','high_wind','caution',
   'Wind may affect tree/brush work, debris, ladders, trailers, equipment handling or public interface.',
   'Review task-specific wind exposure, equipment limits and HSE controls.',
   'Task/equipment policy remains authoritative.',50),
  ('OUT-VIS','Visibility review','general_outdoor','four_season','visibility','caution',
   'Visibility is reduced by darkness, fog, blowing snow, rain or other conditions.',
   'Review driving, public-interface, equipment and site visibility before work proceeds.',
   'Supervisor/HSE judgment remains required.',60),
  ('FALL-RAIN','Fall cleanup wet-weather review','fall_cleanup','fall','rain','caution',
   'Rain/wet leaves may reduce collection efficiency and increase slip or equipment concerns.',
   'Review surface condition, collection method, equipment and property impact.',
   'Operational guidance only.',70),
  ('FALL-WIND','Fall cleanup wind review','fall_cleanup','fall','high_wind','caution',
   'Wind may make leaf/debris handling inefficient or spread debris into public/adjacent areas.',
   'Consider sequencing, containment, alternate tasks or reschedule based on local conditions.',
   'Operational guidance only.',80),
  ('WIN-SNOW','Snowfall service activation review','snow_clearing_removal','winter','snowfall','review',
   'Snowfall accumulation/intensity is relevant to route activation and service priority.',
   'Review contract/service trigger, route priority, equipment readiness and current accumulation.',
   'Snowfall is not itself treated as a work prohibition.',90),
  ('WIN-ICE','Freezing rain / ice review','snow_clearing_removal','winter','freezing_rain_ice','restriction',
   'Freezing rain or ice may require traction material, treatment sequencing and additional slip/vehicle controls.',
   'Review route treatment plan, salt/de-icer availability, crew exposure and vehicle/site conditions.',
   'HSE and equipment limitations remain authoritative.',100),
  ('WIN-VIS','Winter low-visibility review','snow_clearing_removal','winter','visibility','caution',
   'Blowing snow, heavy snowfall or darkness may reduce route/site visibility.',
   'Review route priority, lighting, travel conditions, spotter/public controls and whether work should be delayed.',
   'Supervisor judgment remains required.',110),
  ('WIN-COLD','Winter cold exposure review','snow_clearing_removal','winter','cold','review',
   'Cold/wind-chill conditions warrant crew exposure and equipment operability review.',
   'Use HSE cold-exposure controls, equipment limits and supervisor judgment; snow service may still be essential.',
   'Cold alone does not automatically disable winter service.',120),
  ('LAND-COLD','Landscaping cold/frozen-ground review','mowing_landscaping','spring_summer','cold','restriction',
   'Cold/frozen ground may make the intended landscaping process unsuitable even when other outdoor work remains possible.',
   'Review the specific service, material/equipment limits and site condition; choose another service or reschedule when needed.',
   'Service-specific restriction, not a blanket outdoor-work ban.',130)
on conflict(rule_code) do update set
  rule_name=excluded.rule_name,service_context=excluded.service_context,season_context=excluded.season_context,
  condition_type=excluded.condition_type,guidance_level=excluded.guidance_level,
  threshold_summary=excluded.threshold_summary,operator_guidance=excluded.operator_guidance,
  safety_note=excluded.safety_note,sort_order=excluded.sort_order,updated_at=now();

create or replace view public.v_workability_rule_directory
with (security_invoker=true)
as
select *
from public.workability_service_rules
where is_active
order by service_context,season_context,sort_order,rule_name;
revoke all on table public.v_workability_rule_directory from public,anon,authenticated;
grant select on table public.v_workability_rule_directory to service_role;

create or replace view public.v_workability_observation_rule_guidance
with (security_invoker=true)
as
select
  o.id as observation_id,o.observation_code,o.service_date,o.service_context,o.season_context,
  r.id as rule_id,r.rule_code,r.rule_name,r.condition_type,r.guidance_level,r.threshold_summary,
  r.operator_guidance,r.safety_note
from public.workability_observations o
join public.workability_service_rules r
  on r.is_active
 and r.condition_type in (select jsonb_array_elements_text(o.condition_tags))
 and (r.service_context=o.service_context or r.service_context='general_outdoor')
 and (r.season_context=o.season_context or r.season_context='four_season');
revoke all on table public.v_workability_observation_rule_guidance from public,anon,authenticated;
grant select on table public.v_workability_observation_rule_guidance to service_role;

create or replace view public.v_weather_workability_queue
with (security_invoker=true)
as
select
  o.*,
  cs.site_code,cs.site_name,cs.service_address,cs.city,
  coalesce(cl.display_name,cl.legal_name) as client_name,
  wo.work_order_number,wo.work_type,
  d.schedule_status as dispatch_schedule_status,d.scheduled_start,d.scheduled_end,
  d.workability_state as dispatch_workability_state,d.weather_summary as dispatch_weather_summary,
  a.agreement_code,a.service_name,a.service_program_type,
  r.route_code,r.name as route_name,
  hp.packet_number as hse_packet_number,hp.weather_monitoring_required,hp.weather_monitoring_completed,
  latest.id as latest_decision_id,latest.decision_state,latest.workability_state as decision_workability_state,
  latest.decision_reason,latest.service_restriction_summary,latest.proposed_reschedule_start,latest.proposed_reschedule_end,
  latest.customer_notification_readiness,latest.customer_notification_note,latest.dispatch_application_status,
  latest.decided_by_profile_id,dp.full_name as decided_by_name,latest.decision_at,
  coalesce(g.guidance_count,0)::int as guidance_count,
  coalesce(g.restriction_count,0)::int as restriction_guidance_count,
  case
    when latest.id is null then 'decision_required'
    when latest.customer_notification_readiness in ('not_ready','ready') and latest.decision_state in ('postpone','reschedule','blocked') then 'notification_review'
    when latest.dispatch_application_status='pending_operator_dispatch' then 'operator_dispatch_required'
    else 'decided'
  end as workability_queue_status,
  'supervisor_decision_required_no_automatic_safety_verdict'::text as decision_boundary
from public.workability_observations o
left join public.client_sites cs on cs.id=o.client_site_id
left join public.clients cl on cl.id=cs.client_id
left join public.work_orders wo on wo.id=o.work_order_id
left join public.dispatch_schedule_items d on d.id=o.dispatch_schedule_item_id
left join public.recurring_service_agreements a on a.id=o.recurring_service_agreement_id
left join public.routes r on r.id=o.route_id
left join public.linked_hse_packets hp on hp.id=o.linked_hse_packet_id
left join lateral (
  select x.*
  from public.workability_decisions x
  where x.observation_id=o.id
  order by x.decision_at desc,x.created_at desc,x.id desc
  limit 1
) latest on true
left join public.profiles dp on dp.id=latest.decided_by_profile_id
left join lateral (
  select count(*)::int as guidance_count,
    count(*) filter(where gg.guidance_level='restriction')::int as restriction_count
  from public.v_workability_observation_rule_guidance gg
  where gg.observation_id=o.id
) g on true;
revoke all on table public.v_weather_workability_queue from public,anon,authenticated;
grant select on table public.v_weather_workability_queue to service_role;

create or replace view public.v_workability_decision_directory
with (security_invoker=true)
as
select
  d.*,o.observation_code,o.service_date,o.service_context,o.season_context,
  cs.site_name,cs.service_address,wo.work_order_number,r.name as route_name,
  p.full_name as decided_by_name,
  n.latest_readiness_state,n.latest_readiness_note,n.latest_notification_recorded_at
from public.workability_decisions d
join public.workability_observations o on o.id=d.observation_id
left join public.client_sites cs on cs.id=o.client_site_id
left join public.work_orders wo on wo.id=o.work_order_id
left join public.routes r on r.id=o.route_id
left join public.profiles p on p.id=d.decided_by_profile_id
left join lateral (
  select e.readiness_state as latest_readiness_state,e.readiness_note as latest_readiness_note,e.created_at as latest_notification_recorded_at
  from public.workability_notification_readiness_events e
  where e.decision_id=d.id
  order by e.created_at desc,e.id desc
  limit 1
) n on true;
revoke all on table public.v_workability_decision_directory from public,anon,authenticated;
grant select on table public.v_workability_decision_directory to service_role;

create or replace function public.ywi_rpc_workability_rule_save(p_payload jsonb,p_actor_profile_id uuid)
returns public.workability_service_rules
language plpgsql security invoker set search_path=public as $$
declare
  v_id uuid := nullif(p_payload->>'id','')::uuid;
  v_code text := upper(nullif(btrim(p_payload->>'rule_code'),''));
  v_name text := nullif(btrim(p_payload->>'rule_name'),'');
  v_service text := lower(coalesce(nullif(p_payload->>'service_context',''),'general_outdoor'));
  v_season text := lower(coalesce(nullif(p_payload->>'season_context',''),'four_season'));
  v_condition text := lower(nullif(p_payload->>'condition_type',''));
  v_level text := lower(coalesce(nullif(p_payload->>'guidance_level',''),'review'));
  v_guidance text := nullif(btrim(p_payload->>'operator_guidance'),'');
  v_row public.workability_service_rules;
begin
  if v_code is null or v_name is null or v_condition is null or v_guidance is null then
    raise exception 'Rule code, name, condition and operator guidance are required.' using errcode='23514';
  end if;
  if v_service not in ('mowing_landscaping','fall_cleanup','snow_clearing_removal','general_outdoor') then raise exception 'Unsupported service context.' using errcode='23514'; end if;
  if v_season not in ('spring_summer','fall','winter','four_season') then raise exception 'Unsupported season context.' using errcode='23514'; end if;
  if v_condition not in ('rain','saturated_ground','heat','cold','high_wind','lightning_storm','visibility','snowfall','freezing_rain_ice') then raise exception 'Unsupported condition type.' using errcode='23514'; end if;
  if v_level not in ('review','caution','restriction') then raise exception 'Unsupported guidance level.' using errcode='23514'; end if;

  if v_id is null then
    insert into public.workability_service_rules(
      rule_code,rule_name,service_context,season_context,condition_type,guidance_level,
      threshold_summary,operator_guidance,safety_note,is_active,sort_order,created_by_profile_id,updated_by_profile_id
    ) values(
      v_code,v_name,v_service,v_season,v_condition,v_level,nullif(btrim(p_payload->>'threshold_summary'),''),
      v_guidance,nullif(btrim(p_payload->>'safety_note'),''),coalesce((p_payload->>'is_active')::boolean,true),
      coalesce(nullif(p_payload->>'sort_order','')::integer,100),p_actor_profile_id,p_actor_profile_id
    ) returning * into v_row;
  else
    update public.workability_service_rules r set
      rule_code=v_code,rule_name=v_name,service_context=v_service,season_context=v_season,
      condition_type=v_condition,guidance_level=v_level,
      threshold_summary=case when p_payload?'threshold_summary' then nullif(btrim(p_payload->>'threshold_summary'),'') else r.threshold_summary end,
      operator_guidance=v_guidance,
      safety_note=case when p_payload?'safety_note' then nullif(btrim(p_payload->>'safety_note'),'') else r.safety_note end,
      is_active=case when p_payload?'is_active' then coalesce((p_payload->>'is_active')::boolean,true) else r.is_active end,
      sort_order=case when p_payload?'sort_order' then coalesce(nullif(p_payload->>'sort_order','')::integer,100) else r.sort_order end,
      updated_by_profile_id=p_actor_profile_id,updated_at=now()
    where r.id=v_id returning r.* into v_row;
    if not found then raise exception 'Workability rule does not exist.' using errcode='23503'; end if;
  end if;
  return v_row;
end;
$$;

create or replace function public.ywi_rpc_workability_observation_save(p_payload jsonb,p_actor_profile_id uuid)
returns public.workability_observations
language plpgsql security invoker set search_path=public as $$
declare
  v_id uuid := nullif(p_payload->>'id','')::uuid;
  v_date date := nullif(p_payload->>'service_date','')::date;
  v_source text := lower(coalesce(nullif(p_payload->>'observation_source',''),'supervisor'));
  v_service text := lower(nullif(p_payload->>'service_context',''));
  v_season text := lower(nullif(p_payload->>'season_context',''));
  v_tags jsonb := coalesce(p_payload->'condition_tags','[]'::jsonb);
  v_row public.workability_observations;
begin
  if v_date is null or v_service is null or v_season is null then raise exception 'Service date, service context and season context are required.' using errcode='23514'; end if;
  if v_source not in ('supervisor','crew','hse_review','forecast_review','customer_report','other') then raise exception 'Unsupported observation source.' using errcode='23514'; end if;
  if v_service not in ('mowing_landscaping','fall_cleanup','snow_clearing_removal','general_outdoor') then raise exception 'Unsupported service context.' using errcode='23514'; end if;
  if v_season not in ('spring_summer','fall','winter','four_season') then raise exception 'Unsupported season context.' using errcode='23514'; end if;
  if jsonb_typeof(v_tags)<>'array' then raise exception 'Condition tags must be an array.' using errcode='23514'; end if;
  if exists(select 1 from jsonb_array_elements_text(v_tags) x where x not in ('rain','saturated_ground','heat','cold','high_wind','lightning_storm','visibility','snowfall','freezing_rain_ice')) then
    raise exception 'Unsupported workability condition tag.' using errcode='23514';
  end if;

  if v_id is null then
    insert into public.workability_observations(
      service_date,observed_at,observation_source,client_site_id,work_order_id,dispatch_schedule_item_id,
      recurring_service_agreement_id,route_id,linked_hse_packet_id,service_context,season_context,
      weather_condition,temperature_c,humidex_c,wind_kph,visibility_km,rain_state,ground_state,snowfall_cm,
      freezing_rain_ice_state,lightning_storm_state,condition_tags,source_note,observation_note,created_by_profile_id
    ) values(
      v_date,coalesce(nullif(p_payload->>'observed_at','')::timestamptz,now()),v_source,
      nullif(p_payload->>'client_site_id','')::uuid,nullif(p_payload->>'work_order_id','')::uuid,
      nullif(p_payload->>'dispatch_schedule_item_id','')::uuid,nullif(p_payload->>'recurring_service_agreement_id','')::uuid,
      nullif(p_payload->>'route_id','')::uuid,nullif(p_payload->>'linked_hse_packet_id','')::uuid,
      v_service,v_season,nullif(btrim(p_payload->>'weather_condition'),''),
      nullif(p_payload->>'temperature_c','')::numeric,nullif(p_payload->>'humidex_c','')::numeric,
      nullif(p_payload->>'wind_kph','')::numeric,nullif(p_payload->>'visibility_km','')::numeric,
      lower(coalesce(nullif(p_payload->>'rain_state',''),'none')),lower(coalesce(nullif(p_payload->>'ground_state',''),'unknown')),
      nullif(p_payload->>'snowfall_cm','')::numeric,lower(coalesce(nullif(p_payload->>'freezing_rain_ice_state',''),'none')),
      lower(coalesce(nullif(p_payload->>'lightning_storm_state',''),'none')),v_tags,
      nullif(btrim(p_payload->>'source_note'),''),nullif(btrim(p_payload->>'observation_note'),''),p_actor_profile_id
    ) returning * into v_row;
  else
    update public.workability_observations o set
      service_date=v_date,observed_at=coalesce(nullif(p_payload->>'observed_at','')::timestamptz,o.observed_at),
      observation_source=v_source,service_context=v_service,season_context=v_season,
      weather_condition=case when p_payload?'weather_condition' then nullif(btrim(p_payload->>'weather_condition'),'') else o.weather_condition end,
      temperature_c=case when p_payload?'temperature_c' then nullif(p_payload->>'temperature_c','')::numeric else o.temperature_c end,
      humidex_c=case when p_payload?'humidex_c' then nullif(p_payload->>'humidex_c','')::numeric else o.humidex_c end,
      wind_kph=case when p_payload?'wind_kph' then nullif(p_payload->>'wind_kph','')::numeric else o.wind_kph end,
      visibility_km=case when p_payload?'visibility_km' then nullif(p_payload->>'visibility_km','')::numeric else o.visibility_km end,
      rain_state=case when p_payload?'rain_state' then lower(coalesce(nullif(p_payload->>'rain_state',''),'none')) else o.rain_state end,
      ground_state=case when p_payload?'ground_state' then lower(coalesce(nullif(p_payload->>'ground_state',''),'unknown')) else o.ground_state end,
      snowfall_cm=case when p_payload?'snowfall_cm' then nullif(p_payload->>'snowfall_cm','')::numeric else o.snowfall_cm end,
      freezing_rain_ice_state=case when p_payload?'freezing_rain_ice_state' then lower(coalesce(nullif(p_payload->>'freezing_rain_ice_state',''),'none')) else o.freezing_rain_ice_state end,
      lightning_storm_state=case when p_payload?'lightning_storm_state' then lower(coalesce(nullif(p_payload->>'lightning_storm_state',''),'none')) else o.lightning_storm_state end,
      condition_tags=v_tags,
      source_note=case when p_payload?'source_note' then nullif(btrim(p_payload->>'source_note'),'') else o.source_note end,
      observation_note=case when p_payload?'observation_note' then nullif(btrim(p_payload->>'observation_note'),'') else o.observation_note end,
      updated_at=now()
    where o.id=v_id returning o.* into v_row;
    if not found then raise exception 'Workability observation does not exist.' using errcode='23503'; end if;
  end if;
  return v_row;
end;
$$;

create or replace function public.ywi_rpc_workability_decision_save(p_payload jsonb,p_actor_profile_id uuid)
returns public.workability_decisions
language plpgsql security invoker set search_path=public as $$
declare
  v_observation uuid := nullif(p_payload->>'observation_id','')::uuid;
  v_state text := lower(nullif(p_payload->>'decision_state',''));
  v_reason text := nullif(btrim(p_payload->>'decision_reason'),'');
  v_notify text := lower(coalesce(nullif(p_payload->>'customer_notification_readiness',''),'not_ready'));
  v_start timestamptz := nullif(p_payload->>'proposed_reschedule_start','')::timestamptz;
  v_end timestamptz := nullif(p_payload->>'proposed_reschedule_end','')::timestamptz;
  v_workability text;
  v_dispatch_status text;
  v_obs public.workability_observations;
  v_row public.workability_decisions;
begin
  if v_observation is null or v_state is null or v_reason is null then raise exception 'Observation, decision and reason are required.' using errcode='23514'; end if;
  if v_state not in ('workable','caution','postpone','reschedule','blocked') then raise exception 'Unsupported supervisor decision.' using errcode='23514'; end if;
  if v_notify not in ('not_needed','not_ready','ready','notified') then raise exception 'Unsupported customer-notification readiness.' using errcode='23514'; end if;
  if v_state='reschedule' and (v_start is null or v_end is null or v_end<=v_start) then raise exception 'Reschedule decisions require a valid proposed new window.' using errcode='23514'; end if;

  select * into v_obs from public.workability_observations where id=v_observation;
  if not found then raise exception 'Workability observation does not exist.' using errcode='23503'; end if;

  v_workability := case
    when v_state='workable' then 'workable'
    when v_state='caution' then 'caution'
    when v_state in ('postpone','reschedule') then 'delayed'
    else 'blocked'
  end;
  v_dispatch_status := case when v_state in ('postpone','reschedule','blocked') then 'pending_operator_dispatch' else 'no_change_needed' end;

  insert into public.workability_decisions(
    observation_id,decision_state,workability_state,decision_reason,service_restriction_summary,
    proposed_reschedule_start,proposed_reschedule_end,customer_notification_readiness,
    customer_notification_note,dispatch_application_status,decided_by_profile_id
  ) values(
    v_observation,v_state,v_workability,v_reason,nullif(btrim(p_payload->>'service_restriction_summary'),''),
    v_start,v_end,v_notify,nullif(btrim(p_payload->>'customer_notification_note'),''),
    case when v_obs.dispatch_schedule_item_id is null then v_dispatch_status else
      case when v_state in ('postpone','reschedule','blocked') then 'pending_operator_dispatch' else 'workability_synced' end end,
    p_actor_profile_id
  ) returning * into v_row;

  if v_obs.dispatch_schedule_item_id is not null then
    update public.dispatch_schedule_items d set
      workability_state=v_workability,
      weather_summary=coalesce(nullif(btrim(p_payload->>'weather_summary'),''),v_obs.weather_condition,d.weather_summary),
      workability_note=v_reason,
      updated_at=now()
    where d.id=v_obs.dispatch_schedule_item_id;

    if v_state in ('workable','caution') then
      update public.workability_decisions set dispatch_application_status='workability_synced' where id=v_row.id returning * into v_row;
    end if;
  end if;

  return v_row;
end;
$$;

create or replace function public.ywi_rpc_workability_notification_readiness_save(p_payload jsonb,p_actor_profile_id uuid)
returns public.workability_notification_readiness_events
language plpgsql security invoker set search_path=public as $$
declare
  v_decision uuid := nullif(p_payload->>'decision_id','')::uuid;
  v_state text := lower(nullif(p_payload->>'readiness_state',''));
  v_channels jsonb := coalesce(p_payload->'channel_options','[]'::jsonb);
  v_row public.workability_notification_readiness_events;
begin
  if v_decision is null or v_state is null then raise exception 'Decision and readiness state are required.' using errcode='23514'; end if;
  if v_state not in ('not_needed','not_ready','ready','notified') then raise exception 'Unsupported readiness state.' using errcode='23514'; end if;
  if jsonb_typeof(v_channels)<>'array' then raise exception 'Notification channels must be an array.' using errcode='23514'; end if;
  if not exists(select 1 from public.workability_decisions where id=v_decision) then raise exception 'Workability decision does not exist.' using errcode='23503'; end if;

  insert into public.workability_notification_readiness_events(
    decision_id,readiness_state,channel_options,readiness_note,recorded_by_profile_id
  ) values(
    v_decision,v_state,v_channels,nullif(btrim(p_payload->>'readiness_note'),''),p_actor_profile_id
  ) returning * into v_row;

  update public.workability_decisions set
    customer_notification_readiness=v_state,
    customer_notification_note=coalesce(nullif(btrim(p_payload->>'readiness_note'),''),customer_notification_note)
  where id=v_decision;

  return v_row;
end;
$$;

revoke all on function public.ywi_rpc_workability_rule_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_workability_observation_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_workability_decision_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_workability_notification_readiness_save(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_workability_rule_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_workability_observation_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_workability_decision_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_workability_notification_readiness_save(jsonb,uuid) to service_role;

insert into public.app_module_write_contracts(
  action_key,owner_module,minimum_access,boundary_mode,domain_key,event_key,cross_module_event,is_enabled,description
) values
  ('workability_rule_save','jobs','approve','write','weather_workability','jobs.workability.rule_saved',false,true,'Manage operational workability guidance without creating an automatic safety verdict.'),
  ('workability_observation_save','jobs','approve','write','weather_workability','jobs.workability.observation_saved',false,true,'Record weather/site workability observations linked to existing property/work/dispatch/HSE authorities.'),
  ('workability_decision_save','jobs','approve','write','weather_workability','jobs.workability.decision_saved',false,true,'Record explicit supervisor workability disposition; syncs workability state only and leaves dispatch/reschedule to operator authority.'),
  ('workability_notification_readiness_save','jobs','approve','write','weather_workability','jobs.workability.notification_readiness_saved',false,true,'Record customer-notification readiness/evidence without sending a notification.')
on conflict(action_key) do update set
  owner_module=excluded.owner_module,minimum_access=excluded.minimum_access,boundary_mode=excluded.boundary_mode,
  domain_key=excluded.domain_key,event_key=excluded.event_key,cross_module_event=excluded.cross_module_event,
  is_enabled=excluded.is_enabled,description=excluded.description,updated_at=now();

create or replace function public.ywi_module_write_boundary_security_assertions()
returns table(assertion_key text,assertion_status text,details text)
language sql stable security invoker set search_path=public as $$
  select 'operations_action_contract_count',
    case when (select count(*) from public.app_module_write_contracts where is_enabled)=70 then 'passed' else 'failed' end,
    'Exactly 70 explicitly handled operations-manage actions have enabled write-boundary contracts.'
  union all
  select 'cross_module_events_named',
    case when not exists(select 1 from public.app_module_write_contracts where is_enabled and cross_module_event and event_key is null) then 'passed' else 'failed' end,
    'Every declared cross-module effect has a stable event key.'
  union all
  select 'manual_deposit_mutation_disabled',
    case when exists(select 1 from public.app_module_write_contracts where action_key='deposit_status_update' and owner_module='finance' and boundary_mode='disabled' and is_enabled) then 'passed' else 'failed' end,
    'Hosted payment truth cannot be manually changed through operations-manage.'
  union all
  select 'weather_workability_jobs_boundary',
    case when (select count(*) from public.app_module_write_contracts where action_key in (
      'workability_rule_save','workability_observation_save','workability_decision_save','workability_notification_readiness_save'
    ) and owner_module='jobs' and minimum_access='approve' and boundary_mode='write' and is_enabled)=4 then 'passed' else 'failed' end,
    'Build 342 weather/workability writes are explicit Jobs-approve contracts.'
  union all
  select 'boundary_control_plane_private',
    case when not exists(select 1 from information_schema.table_privileges where table_schema='public'
      and table_name in ('app_module_write_contracts','module_boundary_events','v_module_boundary_event_contract_status','operations_attention_states')
      and grantee in ('anon','authenticated','PUBLIC')) then 'passed' else 'failed' end,
    'Boundary contracts, events and attention state remain private server control-plane data.';
$$;
revoke all on function public.ywi_module_write_boundary_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_module_write_boundary_security_assertions() to service_role;

create or replace function public.ywi_weather_workability_security_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql stable security invoker set search_path=public as $$
  select 'canonical_authorities_preserved',
    case when to_regclass('public.dispatch_schedule_items') is not null
      and to_regclass('public.recurring_service_visit_events') is not null
      and to_regclass('public.linked_hse_packets') is not null
      and to_regclass('public.hse_packet_events') is not null
    then 'passed' else 'failed' end,
    'Build 342 extends existing dispatch, recurring-service and HSE authorities rather than replacing them.'
  union all
  select 'weather_workability_private',
    case when not exists(select 1 from information_schema.table_privileges where table_schema='public'
      and table_name in ('workability_service_rules','workability_observations','workability_decisions','workability_notification_readiness_events')
      and grantee in ('anon','authenticated','PUBLIC')) then 'passed' else 'failed' end,
    'Operational workability evidence is server-private.'
  union all
  select 'no_automatic_reschedule_or_notification',
    case when position('schedule_status=' in pg_get_functiondef('public.ywi_rpc_workability_decision_save(jsonb,uuid)'::regprocedure))=0
      and position('recurring_service_visit_events' in pg_get_functiondef('public.ywi_rpc_workability_decision_save(jsonb,uuid)'::regprocedure))=0
      and position('notifications' in pg_get_functiondef('public.ywi_rpc_workability_decision_save(jsonb,uuid)'::regprocedure))=0
    then 'passed' else 'failed' end,
    'Supervisor decision can sync workability state, but cannot auto-reschedule recurring/dispatch work or send customer notifications.'
  union all
  select 'four_season_condition_coverage',
    case when (select count(distinct condition_type) from public.workability_service_rules where is_active)>=9
      and exists(select 1 from public.workability_service_rules where service_context='snow_clearing_removal' and condition_type='snowfall')
      and exists(select 1 from public.workability_service_rules where service_context='snow_clearing_removal' and condition_type='freezing_rain_ice')
      and exists(select 1 from public.workability_service_rules where service_context='mowing_landscaping' and condition_type='saturated_ground')
      and exists(select 1 from public.workability_service_rules where service_context='fall_cleanup' and condition_type='high_wind')
    then 'passed' else 'failed' end,
    'Rules cover rain, saturated ground, heat, cold, high wind, lightning/storm, visibility, snowfall and freezing rain/ice across four-season service contexts.';
$$;
revoke all on function public.ywi_weather_workability_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_weather_workability_security_assertions() to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values(
  230,'weather_workability_controls',
  'Build 342 adds four-season operational weather/workability guidance, observations, supervisor decisions, proposed reschedule evidence and customer-notification readiness.',
  'applied',now(),'schema230',
  'No automatic safety verdict, cancellation, reschedule or customer notification. Existing HSE, dispatch and recurring-service authorities remain canonical.',
  '230_weather_workability_controls.sql','schema230'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true) as
select 230 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)=230 then 'current'
       when coalesce(max(schema_version) filter(where status='applied'),0)>230 then 'ahead' else 'drift' end as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)=230 then 'Live database matches the repository schema marker.'
       when coalesce(max(schema_version) filter(where status='applied'),0)>230 then 'Live database is ahead of the repository schema marker.'
       else 'Live database is behind the repository schema marker.' end as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
