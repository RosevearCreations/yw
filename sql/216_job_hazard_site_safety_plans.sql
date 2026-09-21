begin;

-- Schema 216 — Build 328 Job Hazard & Site Safety Plans
-- Safety owns reusable hazard-plan templates and field plan evidence.
-- Plans attach to the existing linked_hse_packets authority and reuse canonical
-- jobs, work orders, customer sites, packet controls and field signoff.

create table if not exists public.job_hazard_plan_templates (
  id uuid primary key default gen_random_uuid(),
  template_code text not null unique,
  template_name text not null,
  work_type text not null,
  hazard_prompts jsonb not null default '[]'::jsonb,
  default_controls jsonb not null default '[]'::jsonb,
  required_ppe jsonb not null default '[]'::jsonb,
  requires_toolbox_talk boolean not null default false,
  requires_site_inspection boolean not null default true,
  requires_weather_review boolean not null default false,
  requires_heat_review boolean not null default false,
  requires_chemical_review boolean not null default false,
  requires_traffic_control boolean not null default false,
  requires_machinery_review boolean not null default false,
  requires_lifting_review boolean not null default false,
  requires_utility_locate_review boolean not null default false,
  requires_public_control boolean not null default false,
  notes text,
  revision integer not null default 1,
  is_active boolean not null default true,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_hazard_plan_templates_code_chk check (template_code ~ '^[a-z0-9_]{2,80}$'),
  constraint job_hazard_plan_templates_revision_chk check (revision >= 1),
  constraint job_hazard_plan_templates_hazards_json_chk check (jsonb_typeof(hazard_prompts)='array'),
  constraint job_hazard_plan_templates_controls_json_chk check (jsonb_typeof(default_controls)='array'),
  constraint job_hazard_plan_templates_ppe_json_chk check (jsonb_typeof(required_ppe)='array')
);

create table if not exists public.job_hazard_site_safety_plans (
  id uuid primary key default gen_random_uuid(),
  plan_number text not null unique,
  hse_packet_id uuid not null references public.linked_hse_packets(id) on delete cascade,
  template_id uuid not null references public.job_hazard_plan_templates(id) on delete restrict,
  template_revision integer not null,
  work_type text not null,
  field_date date not null default current_date,
  plan_status text not null default 'draft',
  job_id bigint references public.jobs(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  client_site_id uuid references public.client_sites(id) on delete set null,
  supervisor_profile_id uuid references public.profiles(id) on delete set null,
  actual_conditions jsonb not null default '{}'::jsonb,
  identified_hazards jsonb not null default '[]'::jsonb,
  active_controls jsonb not null default '[]'::jsonb,
  additional_controls text,
  stop_work_required boolean not null default false,
  stop_work_reason text,
  emergency_notes text,
  public_interaction_notes text,
  utility_locate_reference text,
  utility_locate_confirmed boolean not null default false,
  conditions_reviewed_at timestamptz,
  conditions_reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  supervisor_review_status text not null default 'pending',
  supervisor_review_note text,
  supervisor_reviewed_at timestamptz,
  supervisor_reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_hazard_site_safety_plans_status_chk
    check (plan_status in ('draft','in_progress','ready_for_signoff','closed')),
  constraint job_hazard_site_safety_plans_review_chk
    check (supervisor_review_status in ('pending','approved','changes_required')),
  constraint job_hazard_site_safety_plans_conditions_json_chk check (jsonb_typeof(actual_conditions)='object'),
  constraint job_hazard_site_safety_plans_hazards_json_chk check (jsonb_typeof(identified_hazards)='array'),
  constraint job_hazard_site_safety_plans_controls_json_chk check (jsonb_typeof(active_controls)='array'),
  constraint job_hazard_site_safety_plans_stop_work_reason_chk
    check (not stop_work_required or nullif(btrim(coalesce(stop_work_reason,'')),'') is not null)
);

create index if not exists job_hazard_site_safety_plans_packet_idx
  on public.job_hazard_site_safety_plans(hse_packet_id,field_date desc,updated_at desc);
create index if not exists job_hazard_site_safety_plans_work_order_idx
  on public.job_hazard_site_safety_plans(work_order_id,field_date desc)
  where work_order_id is not null;
create index if not exists job_hazard_site_safety_plans_site_idx
  on public.job_hazard_site_safety_plans(client_site_id,field_date desc)
  where client_site_id is not null;
create index if not exists job_hazard_site_safety_plans_review_idx
  on public.job_hazard_site_safety_plans(supervisor_review_status,plan_status,updated_at desc);

alter table public.job_hazard_plan_templates enable row level security;
alter table public.job_hazard_site_safety_plans enable row level security;
revoke all on table public.job_hazard_plan_templates from public,anon,authenticated;
revoke all on table public.job_hazard_site_safety_plans from public,anon,authenticated;
grant select,insert,update,delete on table public.job_hazard_plan_templates to service_role;
grant select,insert,update,delete on table public.job_hazard_site_safety_plans to service_role;

insert into public.job_hazard_plan_templates(
  template_code,template_name,work_type,hazard_prompts,default_controls,required_ppe,
  requires_toolbox_talk,requires_site_inspection,requires_weather_review,requires_heat_review,
  requires_chemical_review,requires_traffic_control,requires_machinery_review,requires_lifting_review,
  requires_utility_locate_review,requires_public_control,notes
) values
('mowing','Mowing','mowing',
 '["moving blades","thrown objects","slopes and rollover exposure","hidden debris","bystanders or pets","noise and vibration"]',
 '["inspect work area before start","verify guards and discharge controls","keep public clear of discharge path","stop for hidden debris or unsafe slope","use manufacturer-safe operating practices"]',
 '["eye protection","hearing protection","protective footwear"]',true,true,true,true,false,false,true,false,false,true,'Record actual terrain, weather, public exposure and controls before work.'),
('trimming_edging','Trimming / Edging','trimming_edging',
 '["rotating line or blade","thrown objects","traffic or pedestrians","uneven ground","noise","contact with structures or vehicles"]',
 '["inspect area and remove debris","maintain exclusion distance","direct discharge away from people/property","use guards","stop if public enters work zone"]',
 '["eye protection","hearing protection","protective footwear"]',true,true,true,true,false,false,true,false,false,true,'Use for string trimmers, edgers and similar hand-held cutting tools.'),
('blowers','Blowers','blowers',
 '["airborne debris","dust","noise","pedestrians","traffic","visibility reduction"]',
 '["keep discharge away from people/vehicles","control dust where practical","maintain public separation","do not blow debris into traffic","stop if visibility becomes unsafe"]',
 '["eye protection","hearing protection"]',true,true,true,true,false,false,true,false,false,true,'Capture dust, wind and public-interface conditions.'),
('chainsaw_brush','Chainsaw / Brush Work','chainsaw_brush',
 '["cutting chain or blade","kickback","falling limbs","pinch points","unstable footing","bystanders","manual handling"]',
 '["establish exclusion zone","inspect tool and guards","plan cut and escape path","control falling material","use competent crew and task-specific procedures","stop for unstable trees/limbs or unsafe weather"]',
 '["eye and face protection","hearing protection","protective footwear","task-appropriate cut protection"]',true,true,true,true,false,false,true,true,false,true,'Task-specific competency and equipment requirements still apply.'),
('hedge_work','Hedge / Shrub Work','hedge_work',
 '["moving blades","overhead reach","ladders or elevated reach","hidden wire/fence","bystanders","repetitive motion"]',
 '["inspect hedge and surroundings","maintain stable footing","avoid unsafe overreach","keep people clear of cutting zone","use guards and two-hand controls where applicable"]',
 '["eye protection","hearing protection","protective footwear"]',true,true,true,true,false,false,true,true,false,true,'Record reach height, footing and public exposure.'),
('loading_unloading','Loading / Unloading','loading_unloading',
 '["manual handling","pinch/crush points","vehicle movement","ramps","shifting loads","slips/trips"]',
 '["stabilize vehicle/trailer","use suitable ramps and restraints","keep hands clear of pinch points","use team/mechanical lift when needed","maintain clear loading zone"]',
 '["protective footwear","work gloves as task-appropriate"]',true,true,false,false,false,true,false,true,false,true,'Record load weight/shape, ramp condition and crew needs.'),
('trailers_towing','Trailers / Towing','trailers_towing',
 '["hitch/coupler failure","unsecured load","blind spots","backing","traffic","trailer swing"]',
 '["verify hitch/coupler/safety chains","secure load","check lights and tires","use spotter where needed","maintain exclusion zone during backing"]',
 '["high-visibility apparel where traffic exposure exists","protective footwear"]',true,true,true,false,false,true,false,false,false,true,'Driver licensing, vehicle and towing requirements remain separate legal/operational authorities.'),
('roadside_work','Roadside Work','roadside_work',
 '["moving traffic","limited sight distance","work-zone intrusion","noise","public interaction","weather"]',
 '["assess traffic and sight lines","use required traffic-control setup","use cones/barriers/spotter as appropriate","maintain escape path","stop work if traffic control is inadequate"]',
 '["high-visibility apparel","task-specific PPE"]',true,true,true,true,false,true,false,false,false,true,'Traffic-control requirements depend on the actual road, jurisdiction and work.'),
('excavation_digging','Excavation / Digging','excavation_digging',
 '["underground services","collapse or unstable ground","manual handling","mobile equipment","public access","water accumulation"]',
 '["verify locate requirements before disturbing ground","mark work zone","keep spoil/equipment controlled","assess ground and water conditions","stop if unknown service or unstable excavation is encountered"]',
 '["protective footwear","high-visibility apparel where mobile equipment is present","task-specific PPE"]',true,true,true,false,false,true,true,true,true,true,'This template does not replace legally required locates, shoring or competent-person requirements.'),
('underground_utility','Underground Utility Concern','underground_utility',
 '["electric/gas/communications/water services","unverified locate","hand digging near services","private services","damaged markings"]',
 '["do not disturb ground until required locate/authorization is confirmed","preserve markings","use required tolerance-zone methods","stop on conflicting or missing information","escalate suspected contact immediately"]',
 '["task-specific PPE"]',true,true,false,false,false,false,false,false,true,false,'Record the actual locate/reference evidence. A saved form does not make an unverified locate safe.'),
('fertilizer_application','Fertilizer / Application Work','fertilizer_application',
 '["chemical exposure","drift","mixing/loading","public or pet exposure","weather","spill"]',
 '["confirm product is legally permitted for intended use","review label/SDS","use required PPE","control application area and public access","avoid unsafe wind/weather","follow spill response requirements"]',
 '["label/SDS-required PPE"]',true,true,true,true,true,false,false,true,false,true,'Only use where legally permitted and by appropriately authorized/qualified personnel.'),
('heat','Heat Exposure','heat',
 '["heat stress","sun exposure","dehydration","high workload","PPE/clothing load","worker-specific risk"]',
 '["assess heat conditions and workload","plan water/rest/shade","adjust pace or schedule","use buddy/symptom awareness","stop/escalate for heat illness signs"]',
 '["task-specific PPE adjusted safely for heat"]',true,true,true,true,false,false,false,false,false,false,'Actual heat risk must be reassessed as conditions change.'),
('cold','Cold Exposure','cold',
 '["cold stress","wind chill","wet clothing","reduced dexterity","ice","vehicle/equipment cold-start hazards"]',
 '["assess temperature/wind/wetness","plan warming breaks","keep clothing dry","adjust task duration","monitor dexterity and symptoms","address ice before work"]',
 '["weather-appropriate clothing","task-specific PPE"]',true,true,true,false,false,false,false,false,false,false,'Record actual cold/wind/wet conditions.'),
('storms_lightning','Storms / Lightning','storms_lightning',
 '["lightning","high winds","falling branches","heavy rain","flooding","reduced visibility"]',
 '["monitor conditions","stop exposed outdoor work when storm risk is unsafe","move crew to suitable shelter","secure loose equipment","reassess after conditions change"]',
 '["weather-appropriate PPE when work remains safe"]',true,true,true,false,false,false,false,false,false,false,'No form overrides a stop-work decision for dangerous weather.'),
('slips_trips','Slips / Trips','slips_trips',
 '["wet surfaces","debris","hoses/cords","uneven grade","ice","poor access"]',
 '["clear travel paths","mark or isolate hazards","use suitable footwear","maintain lighting/visibility","change access route when unsafe"]',
 '["protective footwear"]',false,true,true,false,false,false,false,false,false,true,'Use as a supplemental plan when site access or housekeeping drives risk.'),
('slopes','Slopes / Uneven Terrain','slopes',
 '["loss of footing","equipment rollover","wet grade","hidden holes","runaway equipment","fatigue"]',
 '["walk and assess slope before work","choose equipment/task method suitable for grade","avoid unsafe side-slope operation","stop when wet/unstable","maintain safe footing and escape route"]',
 '["protective footwear","task-specific PPE"]',true,true,true,true,false,false,true,false,false,true,'Actual slope and ground condition control the work decision.'),
('public_pedestrian','Public / Pedestrian Interaction','public_pedestrian',
 '["pedestrian entry","children/pets","vehicles","noise/dust/debris","blocked access","customer interaction"]',
 '["define work/exclusion zone","maintain safe public route","use spotter/cones/barriers as needed","pause work when public enters hazard area","communicate access changes"]',
 '["high-visibility apparel where traffic/public interface warrants","task-specific PPE"]',true,true,false,false,false,true,false,false,false,true,'Record actual public-interface controls for the site.'),
('general_site','General Site Safety Plan','general_site',
 '["site access","slips/trips","weather","public interaction","equipment","manual handling","unknown hazards"]',
 '["complete site walk","record actual hazards","select effective controls","brief crew","stop and reassess when conditions differ from plan"]',
 '["task-specific PPE"]',true,true,true,true,false,false,false,true,false,true,'Use only when a more specific work-type template does not cover the task; add actual hazards and controls.')
on conflict(template_code) do nothing;

create or replace view public.v_job_hazard_plan_template_directory
with (security_invoker=true)
as
select
  id,template_code,template_name,work_type,hazard_prompts,default_controls,required_ppe,
  requires_toolbox_talk,requires_site_inspection,requires_weather_review,requires_heat_review,
  requires_chemical_review,requires_traffic_control,requires_machinery_review,requires_lifting_review,
  requires_utility_locate_review,requires_public_control,notes,revision,is_active,updated_at
from public.job_hazard_plan_templates;

create or replace view public.v_job_hazard_site_safety_plan_directory
with (security_invoker=true)
as
select
  p.id,p.plan_number,p.hse_packet_id,p.template_id,p.template_revision,p.work_type,p.field_date,p.plan_status,
  p.job_id,p.work_order_id,p.client_site_id,p.supervisor_profile_id,
  p.actual_conditions,p.identified_hazards,p.active_controls,p.additional_controls,
  p.stop_work_required,p.stop_work_reason,p.emergency_notes,p.public_interaction_notes,
  p.utility_locate_reference,p.utility_locate_confirmed,p.conditions_reviewed_at,p.conditions_reviewed_by_profile_id,
  p.supervisor_review_status,p.supervisor_review_note,p.supervisor_reviewed_at,p.supervisor_reviewed_by_profile_id,
  p.created_at,p.updated_at,
  t.template_code,t.template_name,t.required_ppe,t.requires_utility_locate_review,
  h.packet_number,h.packet_status,h.field_signoff_required,h.field_signoff_completed,h.field_signed_off_at,
  h.briefing_required,h.briefing_completed,h.inspection_required,h.inspection_completed,
  h.weather_monitoring_required,h.weather_monitoring_completed,h.heat_monitoring_required,h.heat_monitoring_completed,
  h.chemical_handling_required,h.chemical_handling_completed,h.traffic_control_required,h.traffic_control_completed,
  h.machinery_review_required,h.machinery_review_completed,h.lifting_review_required,h.lifting_review_completed,
  h.cones_barriers_required,h.cones_barriers_completed,
  wo.work_order_number,
  cs.site_code,cs.site_name,cs.service_address,cs.city,
  cs.hazard_notes as site_hazard_notes,cs.slope_notes as site_slope_notes,
  cs.drainage_wet_area_notes as site_drainage_notes,cs.utility_locate_notes as site_utility_locate_notes,
  cs.tree_brush_notes as site_tree_brush_notes
from public.job_hazard_site_safety_plans p
join public.job_hazard_plan_templates t on t.id=p.template_id
join public.linked_hse_packets h on h.id=p.hse_packet_id
left join public.work_orders wo on wo.id=p.work_order_id
left join public.client_sites cs on cs.id=p.client_site_id;

revoke all on table public.v_job_hazard_plan_template_directory from public,anon,authenticated;
revoke all on table public.v_job_hazard_site_safety_plan_directory from public,anon,authenticated;
grant select on table public.v_job_hazard_plan_template_directory to service_role;
grant select on table public.v_job_hazard_site_safety_plan_directory to service_role;

create or replace function public.ywi_rpc_job_hazard_template_save(p_payload jsonb,p_actor_profile_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_id uuid;
  v_code text;
  v_name text;
  v_work_type text;
  v_hazards jsonb;
  v_controls jsonb;
  v_ppe jsonb;
  v_row public.job_hazard_plan_templates%rowtype;
begin
  if p_actor_profile_id is null then raise exception 'Actor profile is required.' using errcode='42501'; end if;
  v_id:=nullif(p_payload->>'id','')::uuid;
  v_code:=lower(regexp_replace(coalesce(nullif(btrim(p_payload->>'template_code'),''),''),'[^a-zA-Z0-9_]+','_','g'));
  v_name:=nullif(btrim(p_payload->>'template_name'),'');
  v_work_type:=lower(regexp_replace(coalesce(nullif(btrim(p_payload->>'work_type'),''),''),'[^a-zA-Z0-9_]+','_','g'));
  v_hazards:=coalesce(p_payload->'hazard_prompts','[]'::jsonb);
  v_controls:=coalesce(p_payload->'default_controls','[]'::jsonb);
  v_ppe:=coalesce(p_payload->'required_ppe','[]'::jsonb);
  if v_name is null or v_work_type='' then raise exception 'Template name and work type are required.' using errcode='23514'; end if;
  if v_code='' then v_code:=v_work_type; end if;
  if v_code !~ '^[a-z0-9_]{2,80}$' then raise exception 'Template code is invalid.' using errcode='23514'; end if;
  if jsonb_typeof(v_hazards)<>'array' or jsonb_typeof(v_controls)<>'array' or jsonb_typeof(v_ppe)<>'array' then
    raise exception 'Hazards, controls and PPE must be JSON arrays.' using errcode='23514';
  end if;

  if v_id is null then
    select id into v_id from public.job_hazard_plan_templates where template_code=v_code;
  end if;

  if v_id is null then
    insert into public.job_hazard_plan_templates(
      template_code,template_name,work_type,hazard_prompts,default_controls,required_ppe,
      requires_toolbox_talk,requires_site_inspection,requires_weather_review,requires_heat_review,
      requires_chemical_review,requires_traffic_control,requires_machinery_review,requires_lifting_review,
      requires_utility_locate_review,requires_public_control,notes,is_active,created_by_profile_id,updated_by_profile_id
    ) values (
      v_code,v_name,v_work_type,v_hazards,v_controls,v_ppe,
      coalesce((p_payload->>'requires_toolbox_talk')::boolean,false),
      coalesce((p_payload->>'requires_site_inspection')::boolean,true),
      coalesce((p_payload->>'requires_weather_review')::boolean,false),
      coalesce((p_payload->>'requires_heat_review')::boolean,false),
      coalesce((p_payload->>'requires_chemical_review')::boolean,false),
      coalesce((p_payload->>'requires_traffic_control')::boolean,false),
      coalesce((p_payload->>'requires_machinery_review')::boolean,false),
      coalesce((p_payload->>'requires_lifting_review')::boolean,false),
      coalesce((p_payload->>'requires_utility_locate_review')::boolean,false),
      coalesce((p_payload->>'requires_public_control')::boolean,false),
      nullif(btrim(p_payload->>'notes'),''),
      coalesce((p_payload->>'is_active')::boolean,true),p_actor_profile_id,p_actor_profile_id
    ) returning * into v_row;
  else
    update public.job_hazard_plan_templates set
      template_code=v_code,template_name=v_name,work_type=v_work_type,hazard_prompts=v_hazards,
      default_controls=v_controls,required_ppe=v_ppe,
      requires_toolbox_talk=coalesce((p_payload->>'requires_toolbox_talk')::boolean,requires_toolbox_talk),
      requires_site_inspection=coalesce((p_payload->>'requires_site_inspection')::boolean,requires_site_inspection),
      requires_weather_review=coalesce((p_payload->>'requires_weather_review')::boolean,requires_weather_review),
      requires_heat_review=coalesce((p_payload->>'requires_heat_review')::boolean,requires_heat_review),
      requires_chemical_review=coalesce((p_payload->>'requires_chemical_review')::boolean,requires_chemical_review),
      requires_traffic_control=coalesce((p_payload->>'requires_traffic_control')::boolean,requires_traffic_control),
      requires_machinery_review=coalesce((p_payload->>'requires_machinery_review')::boolean,requires_machinery_review),
      requires_lifting_review=coalesce((p_payload->>'requires_lifting_review')::boolean,requires_lifting_review),
      requires_utility_locate_review=coalesce((p_payload->>'requires_utility_locate_review')::boolean,requires_utility_locate_review),
      requires_public_control=coalesce((p_payload->>'requires_public_control')::boolean,requires_public_control),
      notes=case when p_payload ? 'notes' then nullif(btrim(p_payload->>'notes'),'') else notes end,
      is_active=coalesce((p_payload->>'is_active')::boolean,is_active),
      revision=revision+1,updated_by_profile_id=p_actor_profile_id,updated_at=now()
    where id=v_id returning * into v_row;
    if not found then raise exception 'Hazard-plan template was not found.' using errcode='P0002'; end if;
  end if;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.ywi_rpc_job_hazard_plan_save(p_payload jsonb,p_actor_profile_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_id uuid;
  v_packet_id uuid;
  v_template_id uuid;
  v_status text;
  v_conditions jsonb;
  v_hazards jsonb;
  v_controls jsonb;
  v_packet public.linked_hse_packets%rowtype;
  v_template public.job_hazard_plan_templates%rowtype;
  v_row public.job_hazard_site_safety_plans%rowtype;
  v_utility_confirmed boolean;
  v_utility_ref text;
begin
  if p_actor_profile_id is null then raise exception 'Actor profile is required.' using errcode='42501'; end if;
  v_id:=nullif(p_payload->>'id','')::uuid;
  v_packet_id:=nullif(p_payload->>'hse_packet_id','')::uuid;
  v_template_id:=nullif(p_payload->>'template_id','')::uuid;
  if v_packet_id is null then raise exception 'HSE packet is required.' using errcode='23514'; end if;
  if v_template_id is null then raise exception 'Safety-plan template is required.' using errcode='23514'; end if;
  select * into v_packet from public.linked_hse_packets where id=v_packet_id;
  if not found then raise exception 'HSE packet was not found.' using errcode='P0002'; end if;
  select * into v_template from public.job_hazard_plan_templates where id=v_template_id and is_active=true;
  if not found then raise exception 'Active safety-plan template was not found.' using errcode='P0002'; end if;

  v_status:=lower(coalesce(nullif(btrim(p_payload->>'plan_status'),''),'draft'));
  if v_status not in ('draft','in_progress','ready_for_signoff','closed') then
    raise exception 'Unsupported plan status.' using errcode='23514';
  end if;
  v_conditions:=coalesce(p_payload->'actual_conditions','{}'::jsonb);
  v_hazards:=coalesce(p_payload->'identified_hazards','[]'::jsonb);
  v_controls:=coalesce(p_payload->'active_controls','[]'::jsonb);
  if jsonb_typeof(v_conditions)<>'object' or jsonb_typeof(v_hazards)<>'array' or jsonb_typeof(v_controls)<>'array' then
    raise exception 'Actual conditions must be an object and hazards/controls must be arrays.' using errcode='23514';
  end if;
  v_utility_confirmed:=coalesce((p_payload->>'utility_locate_confirmed')::boolean,false);
  v_utility_ref:=nullif(btrim(p_payload->>'utility_locate_reference'),'');
  if v_status='ready_for_signoff' and jsonb_array_length(v_controls)=0 then
    raise exception 'At least one active control is required before ready-for-signoff.' using errcode='23514';
  end if;
  if v_status='ready_for_signoff' and v_template.requires_utility_locate_review and (not v_utility_confirmed or v_utility_ref is null) then
    raise exception 'Utility-locate confirmation and reference are required before ready-for-signoff.' using errcode='23514';
  end if;

  if v_id is null then
    insert into public.job_hazard_site_safety_plans(
      plan_number,hse_packet_id,template_id,template_revision,work_type,field_date,plan_status,
      job_id,work_order_id,client_site_id,supervisor_profile_id,
      actual_conditions,identified_hazards,active_controls,additional_controls,stop_work_required,stop_work_reason,
      emergency_notes,public_interaction_notes,utility_locate_reference,utility_locate_confirmed,
      conditions_reviewed_at,conditions_reviewed_by_profile_id,created_by_profile_id,updated_by_profile_id
    ) values (
      'JHSP-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
      v_packet.id,v_template.id,v_template.revision,v_template.work_type,
      coalesce(nullif(p_payload->>'field_date','')::date,current_date),v_status,
      v_packet.job_id,v_packet.work_order_id,v_packet.client_site_id,v_packet.supervisor_profile_id,
      v_conditions,v_hazards,v_controls,nullif(btrim(p_payload->>'additional_controls'),''),
      coalesce((p_payload->>'stop_work_required')::boolean,false),nullif(btrim(p_payload->>'stop_work_reason'),''),
      nullif(btrim(p_payload->>'emergency_notes'),''),nullif(btrim(p_payload->>'public_interaction_notes'),''),
      v_utility_ref,v_utility_confirmed,now(),p_actor_profile_id,p_actor_profile_id,p_actor_profile_id
    ) returning * into v_row;
  else
    update public.job_hazard_site_safety_plans set
      hse_packet_id=v_packet.id,template_id=v_template.id,template_revision=v_template.revision,work_type=v_template.work_type,
      field_date=coalesce(nullif(p_payload->>'field_date','')::date,field_date),plan_status=v_status,
      job_id=v_packet.job_id,work_order_id=v_packet.work_order_id,client_site_id=v_packet.client_site_id,
      supervisor_profile_id=v_packet.supervisor_profile_id,
      actual_conditions=v_conditions,identified_hazards=v_hazards,active_controls=v_controls,
      additional_controls=nullif(btrim(p_payload->>'additional_controls'),''),
      stop_work_required=coalesce((p_payload->>'stop_work_required')::boolean,false),
      stop_work_reason=nullif(btrim(p_payload->>'stop_work_reason'),''),
      emergency_notes=nullif(btrim(p_payload->>'emergency_notes'),''),
      public_interaction_notes=nullif(btrim(p_payload->>'public_interaction_notes'),''),
      utility_locate_reference=v_utility_ref,utility_locate_confirmed=v_utility_confirmed,
      conditions_reviewed_at=now(),conditions_reviewed_by_profile_id=p_actor_profile_id,
      updated_by_profile_id=p_actor_profile_id,updated_at=now()
    where id=v_id and hse_packet_id=v_packet.id
    returning * into v_row;
    if not found then raise exception 'Safety plan was not found for this HSE packet.' using errcode='P0002'; end if;
  end if;

  update public.linked_hse_packets set
    briefing_required=briefing_required or v_template.requires_toolbox_talk,
    inspection_required=inspection_required or v_template.requires_site_inspection,
    weather_monitoring_required=weather_monitoring_required or v_template.requires_weather_review,
    heat_monitoring_required=heat_monitoring_required or v_template.requires_heat_review,
    chemical_handling_required=chemical_handling_required or v_template.requires_chemical_review,
    traffic_control_required=traffic_control_required or v_template.requires_traffic_control,
    machinery_review_required=machinery_review_required or v_template.requires_machinery_review,
    lifting_review_required=lifting_review_required or v_template.requires_lifting_review,
    cones_barriers_required=cones_barriers_required or v_template.requires_public_control,
    updated_at=now()
  where id=v_packet.id;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.ywi_rpc_job_hazard_plan_review(
  p_plan_id uuid,p_actor_profile_id uuid,p_decision text,p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_decision text:=lower(coalesce(nullif(btrim(p_decision),''),''));
  v_row public.job_hazard_site_safety_plans%rowtype;
begin
  if p_actor_profile_id is null then raise exception 'Actor profile is required.' using errcode='42501'; end if;
  if p_plan_id is null then raise exception 'Plan is required.' using errcode='23514'; end if;
  if v_decision not in ('approve','changes_required','reopen') then
    raise exception 'Unsupported supervisor review decision.' using errcode='23514';
  end if;
  select * into v_row from public.job_hazard_site_safety_plans where id=p_plan_id;
  if not found then raise exception 'Safety plan was not found.' using errcode='P0002'; end if;
  if v_decision='approve' and v_row.plan_status<>'ready_for_signoff' then
    raise exception 'Plan must be ready for signoff before supervisor approval.' using errcode='23514';
  end if;

  update public.job_hazard_site_safety_plans set
    supervisor_review_status=case v_decision when 'approve' then 'approved' when 'changes_required' then 'changes_required' else 'pending' end,
    supervisor_review_note=nullif(btrim(p_note),''),
    supervisor_reviewed_at=case when v_decision='reopen' then null else now() end,
    supervisor_reviewed_by_profile_id=case when v_decision='reopen' then null else p_actor_profile_id end,
    plan_status=case when v_decision='reopen' and plan_status='closed' then 'in_progress' else plan_status end,
    updated_by_profile_id=p_actor_profile_id,updated_at=now()
  where id=p_plan_id returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.ywi_rpc_job_hazard_template_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_job_hazard_plan_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_job_hazard_plan_review(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ywi_rpc_job_hazard_template_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_job_hazard_plan_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_job_hazard_plan_review(uuid,uuid,text,text) to service_role;

insert into public.app_module_write_contracts(
  action_key,owner_module,minimum_access,boundary_mode,domain_key,event_key,cross_module_event,is_enabled,description
) values
  ('job_hazard_template_save','safety','approve','write','job_hazard_plans','safety.job_hazard_template.saved',false,true,'Create/update reusable Safety-owned job-hazard plan templates.'),
  ('job_hazard_plan_save','safety','create','write','job_hazard_plans','safety.job_hazard_plan.saved',false,true,'Capture actual site conditions, hazards and controls against an existing HSE packet.'),
  ('job_hazard_plan_review','safety','approve','write','job_hazard_plans','safety.job_hazard_plan.reviewed',false,true,'Record explicit supervisor review without auto-signing or closing the parent HSE packet.')
on conflict(action_key) do update set
  owner_module=excluded.owner_module,minimum_access=excluded.minimum_access,boundary_mode=excluded.boundary_mode,
  domain_key=excluded.domain_key,event_key=excluded.event_key,cross_module_event=excluded.cross_module_event,
  is_enabled=excluded.is_enabled,description=excluded.description,updated_at=now();

create or replace function public.ywi_module_write_boundary_security_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'operations_action_contract_count',
    case when (select count(*) from public.app_module_write_contracts where is_enabled)=51 then 'passed' else 'failed' end,
    'Exactly 51 explicitly handled operations-manage actions have enabled write-boundary contracts.'
  union all
  select 'cross_module_events_named',
    case when not exists (
      select 1 from public.app_module_write_contracts where is_enabled and cross_module_event and event_key is null
    ) then 'passed' else 'failed' end,
    'Every declared cross-module effect has a stable event key.'
  union all
  select 'manual_deposit_mutation_disabled',
    case when exists (
      select 1 from public.app_module_write_contracts
      where action_key='deposit_status_update' and owner_module='finance' and boundary_mode='disabled' and is_enabled
    ) then 'passed' else 'failed' end,
    'Hosted payment truth cannot be manually changed through operations-manage.'
  union all
  select 'boundary_control_plane_private',
    case when not exists (
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('app_module_write_contracts','module_boundary_events','v_module_boundary_event_contract_status','operations_attention_states')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Boundary contracts, emitted events and attention disposition state remain private server control-plane data.';
$$;
revoke all on function public.ywi_module_write_boundary_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_module_write_boundary_security_assertions() to service_role;

create or replace function public.ywi_job_hazard_site_safety_plan_security_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'safety_plan_tables_private',
    case when
      coalesce((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='job_hazard_plan_templates'),false)
      and coalesce((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='job_hazard_site_safety_plans'),false)
      and not exists(
        select 1 from information_schema.table_privileges
        where table_schema='public' and table_name in ('job_hazard_plan_templates','job_hazard_site_safety_plans')
          and grantee in ('anon','authenticated','PUBLIC')
      ) then 'passed' else 'failed' end,
    'Build 328 Safety tables use RLS and remain service-private.'
  union all
  select 'safety_plan_views_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('v_job_hazard_plan_template_directory','v_job_hazard_site_safety_plan_directory')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Build 328 Safety read models are server-only.'
  union all
  select 'safety_plan_rpcs_private',
    case when not exists(
      select 1 from information_schema.routine_privileges
      where specific_schema='public'
        and routine_name in ('ywi_rpc_job_hazard_template_save','ywi_rpc_job_hazard_plan_save','ywi_rpc_job_hazard_plan_review')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Build 328 Safety mutation RPCs are callable only through server authority.'
  union all
  select 'hse_packet_parent_authority_preserved',
    case when to_regclass('public.linked_hse_packets') is not null
      and exists(select 1 from information_schema.table_constraints where table_schema='public' and table_name='job_hazard_site_safety_plans' and constraint_type='FOREIGN KEY')
      then 'passed' else 'failed' end,
    'Every field safety plan attaches to the existing HSE packet authority rather than creating a parallel packet system.'
  union all
  select 'reusable_work_type_templates_seeded',
    case when (select count(*) from public.job_hazard_plan_templates where is_active)>=18 then 'passed' else 'failed' end,
    'At least 18 reusable landscaping hazard-plan templates are available.'
  union all
  select 'safety_write_contracts_registered',
    case when (select count(*) from public.app_module_write_contracts
      where action_key in ('job_hazard_template_save','job_hazard_plan_save','job_hazard_plan_review')
        and owner_module='safety' and is_enabled)=3 then 'passed' else 'failed' end,
    'Template authoring, field-plan capture and supervisor review are explicit Safety-module contracts.';
$$;
revoke all on function public.ywi_job_hazard_site_safety_plan_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_job_hazard_site_safety_plan_security_assertions() to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  216,'job_hazard_site_safety_plans',
  'Build 328 reusable landscaping hazard-plan templates and field/site safety plans linked to canonical HSE packets.',
  'applied',now(),'schema216',
  'Actual conditions, hazards and controls are recorded explicitly. Supervisor review does not auto-complete HSE field signoff or claim legal compliance.',
  '216_job_hazard_site_safety_plans.sql','schema216'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true)
as
select
  216 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=216 then 'current'
    when coalesce(max(schema_version) filter(where status='applied'),0)>216 then 'ahead'
    else 'drift'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=216 then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter(where status='applied'),0)>216 then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
