begin;

-- Schema 228 — Build 340 Customer & Property CRM.
-- Canonical authority remains:
-- customer=public.clients, property=public.client_sites, lead=public.quote_contact_requests,
-- service plan=public.recurring_service_agreements, commercial/service history=public.estimates/public.work_orders.
-- Build 340 adds CRM lifecycle and relationship evidence around those sources without replacing them.

alter table public.clients
  add column if not exists crm_lifecycle_stage text not null default 'customer',
  add column if not exists crm_lead_source text,
  add column if not exists crm_relationship_owner_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists crm_preferred_contact_method text,
  add column if not exists crm_preferred_contact_window text,
  add column if not exists crm_relationship_notes text;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='clients_crm_lifecycle_stage_chk') then
    alter table public.clients add constraint clients_crm_lifecycle_stage_chk
      check (crm_lifecycle_stage in ('lead','prospect','customer','inactive','former'));
  end if;
  if not exists(select 1 from pg_constraint where conname='clients_crm_preferred_contact_chk') then
    alter table public.clients add constraint clients_crm_preferred_contact_chk
      check (crm_preferred_contact_method is null or crm_preferred_contact_method in ('email','phone','text','portal','in_person','other'));
  end if;
end $$;

create index if not exists clients_crm_lifecycle_owner_idx
  on public.clients(crm_lifecycle_stage,crm_relationship_owner_profile_id,is_active);

create table if not exists public.crm_customer_interactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  client_site_id uuid references public.client_sites(id) on delete set null,
  quote_request_id uuid references public.quote_contact_requests(id) on delete set null,
  estimate_id uuid references public.estimates(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  recurring_service_agreement_id uuid references public.recurring_service_agreements(id) on delete set null,
  interaction_type text not null default 'communication',
  channel text not null default 'other',
  direction text not null default 'internal',
  interaction_status text not null default 'open',
  complaint_status text,
  subject text,
  summary text not null,
  outcome text,
  season_context text not null default 'other',
  service_type text,
  occurred_at timestamptz not null default now(),
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_customer_interactions_type_chk check (interaction_type in ('communication','complaint','service_review','renewal_discussion','opportunity_note')),
  constraint crm_customer_interactions_channel_chk check (channel in ('email','phone','text','in_person','portal','website','system','other')),
  constraint crm_customer_interactions_direction_chk check (direction in ('inbound','outbound','internal')),
  constraint crm_customer_interactions_status_chk check (interaction_status in ('open','resolved','closed','informational')),
  constraint crm_customer_interactions_complaint_chk check (complaint_status is null or complaint_status in ('open','investigating','resolved','closed')),
  constraint crm_customer_interactions_season_chk check (season_context in ('spring_summer','fall','winter','four_season','other'))
);

create table if not exists public.crm_followups (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  client_site_id uuid references public.client_sites(id) on delete set null,
  interaction_id uuid references public.crm_customer_interactions(id) on delete set null,
  followup_type text not null default 'general',
  followup_status text not null default 'pending',
  priority text not null default 'normal',
  due_at timestamptz not null,
  assigned_to_profile_id uuid references public.profiles(id) on delete set null,
  season_context text not null default 'other',
  service_type text,
  summary text not null,
  resolution_note text,
  completed_at timestamptz,
  completed_by_profile_id uuid references public.profiles(id) on delete set null,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_followups_type_chk check (followup_type in ('general','lead','complaint','renewal','service_review','upsell_cross_service')),
  constraint crm_followups_status_chk check (followup_status in ('pending','in_progress','deferred','completed','cancelled')),
  constraint crm_followups_priority_chk check (priority in ('low','normal','high','urgent')),
  constraint crm_followups_season_chk check (season_context in ('spring_summer','fall','winter','four_season','other'))
);

create table if not exists public.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  client_site_id uuid references public.client_sites(id) on delete set null,
  source_interaction_id uuid references public.crm_customer_interactions(id) on delete set null,
  estimate_id uuid references public.estimates(id) on delete set null,
  opportunity_type text not null default 'new_service',
  opportunity_status text not null default 'identified',
  source_service_type text,
  target_service_type text not null,
  season_context text not null default 'other',
  reason text,
  next_action text,
  estimated_value numeric(12,2),
  assigned_to_profile_id uuid references public.profiles(id) on delete set null,
  target_date date,
  closed_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_opportunities_type_chk check (opportunity_type in ('new_service','upsell','cross_service','renewal','winback')),
  constraint crm_opportunities_status_chk check (opportunity_status in ('identified','contact_ready','quoted','on_hold','won','lost','dismissed')),
  constraint crm_opportunities_season_chk check (season_context in ('spring_summer','fall','winter','four_season','other')),
  constraint crm_opportunities_value_chk check (estimated_value is null or estimated_value >= 0)
);

create index if not exists crm_interactions_client_idx on public.crm_customer_interactions(client_id,occurred_at desc);
create index if not exists crm_interactions_property_idx on public.crm_customer_interactions(client_site_id,occurred_at desc) where client_site_id is not null;
create index if not exists crm_followups_queue_idx on public.crm_followups(followup_status,due_at,priority);
create index if not exists crm_followups_client_idx on public.crm_followups(client_id,due_at desc);
create index if not exists crm_opportunities_queue_idx on public.crm_opportunities(opportunity_status,target_date,season_context);
create index if not exists crm_opportunities_client_idx on public.crm_opportunities(client_id,created_at desc);

alter table public.crm_customer_interactions enable row level security;
alter table public.crm_followups enable row level security;
alter table public.crm_opportunities enable row level security;
revoke all on table public.crm_customer_interactions from public,anon,authenticated;
revoke all on table public.crm_followups from public,anon,authenticated;
revoke all on table public.crm_opportunities from public,anon,authenticated;
grant select,insert,update on table public.crm_customer_interactions to service_role;
grant select,insert,update on table public.crm_followups to service_role;
grant select,insert,update on table public.crm_opportunities to service_role;

create or replace function public.ywi_crm_season_context(p_service text)
returns text language sql immutable security invoker set search_path=public as $$
  select case
    when lower(coalesce(p_service,'')) ~ '(four[ -]?season|year[ -]?round)' then 'four_season'
    when lower(coalesce(p_service,'')) ~ '(snow|winter|ice|salting|salt|de[ -]?ic)' then 'winter'
    when lower(coalesce(p_service,'')) ~ '(fall|autumn|leaf|leaves)' then 'fall'
    when lower(coalesce(p_service,'')) ~ '(mow|lawn|landscap|garden|hedge|shrub|spring|aerat|fertiliz|sod|mulch|soil|gravel|stone)' then 'spring_summer'
    else 'other'
  end;
$$;
revoke all on function public.ywi_crm_season_context(text) from public,anon,authenticated;
grant execute on function public.ywi_crm_season_context(text) to service_role;

create or replace view public.v_crm_service_plan_directory
with (security_invoker=true) as
select
  a.id as agreement_id,a.agreement_code,a.client_id,a.client_site_id,
  c.client_code,coalesce(c.display_name,c.legal_name) as client_name,
  cs.site_code,cs.site_name,cs.service_address,cs.city,
  a.service_name,a.service_program_type,a.agreement_status,a.billing_method,
  a.start_date,a.end_date,a.open_end_date,a.recurrence_frequency,
  a.customer_hold_until,a.customer_hold_reason,a.pause_reason,a.cancellation_reason,
  public.ywi_crm_season_context(coalesce(a.service_program_type,'')||' '||coalesce(a.service_name,'')) as season_context,
  a.updated_at
from public.recurring_service_agreements a
left join public.clients c on c.id=a.client_id
left join public.client_sites cs on cs.id=a.client_site_id;
revoke all on table public.v_crm_service_plan_directory from public,anon,authenticated;
grant select on table public.v_crm_service_plan_directory to service_role;

create or replace view public.v_crm_service_history
with (security_invoker=true) as
select
  'work_order'::text as record_type,w.id as record_id,w.client_id,w.client_site_id,
  w.work_order_number as reference_code,w.work_type as service_type,
  public.ywi_crm_season_context(coalesce(w.work_type,'')||' '||coalesce(w.customer_notes,'')) as season_context,
  w.status,coalesce(w.scheduled_start,w.created_at) as occurred_at,w.total_amount as amount,w.customer_notes as summary
from public.work_orders w where w.client_id is not null
union all
select
  'estimate'::text,e.id,e.client_id,e.client_site_id,e.estimate_number,e.estimate_type,
  public.ywi_crm_season_context(coalesce(e.estimate_type,'')||' '||coalesce(e.scope_notes,'')),
  e.status,e.created_at,e.total_amount,e.scope_notes
from public.estimates e where e.client_id is not null;
revoke all on table public.v_crm_service_history from public,anon,authenticated;
grant select on table public.v_crm_service_history to service_role;

create or replace view public.v_crm_customer_directory
with (security_invoker=true) as
select
  c.id as client_id,c.client_code,c.legal_name,c.display_name,coalesce(c.display_name,c.legal_name) as client_name,
  c.client_type,c.billing_email,c.phone,c.city,c.province,c.postal_code,c.notes,c.is_active,
  c.crm_lifecycle_stage,c.crm_lead_source,c.crm_relationship_owner_profile_id,
  owner.full_name as crm_relationship_owner_name,c.crm_preferred_contact_method,c.crm_preferred_contact_window,c.crm_relationship_notes,
  coalesce(p.property_count,0)::int as property_count,
  coalesce(sp.active_service_plan_count,0)::int as active_service_plan_count,
  coalesce(h.service_history_count,0)::int as service_history_count,
  coalesce(f.open_followup_count,0)::int as open_followup_count,
  coalesce(o.open_opportunity_count,0)::int as open_opportunity_count,
  coalesce(i.open_complaint_count,0)::int as open_complaint_count,
  coalesce(sp.spring_summer_coverage,false) or coalesce(h.spring_summer_history,false) as spring_summer_coverage,
  coalesce(sp.fall_coverage,false) or coalesce(h.fall_history,false) as fall_coverage,
  coalesce(sp.winter_coverage,false) or coalesce(h.winter_history,false) as winter_coverage,
  greatest(c.updated_at,coalesce(i.last_interaction_at,c.updated_at),coalesce(h.last_service_at,c.updated_at)) as last_crm_activity_at
from public.clients c
left join public.profiles owner on owner.id=c.crm_relationship_owner_profile_id
left join lateral (
  select count(*) filter(where cs.is_active)::int as property_count from public.client_sites cs where cs.client_id=c.id
) p on true
left join lateral (
  select
    count(*) filter(where a.agreement_status in ('active','paused','draft'))::int as active_service_plan_count,
    bool_or(public.ywi_crm_season_context(coalesce(a.service_program_type,'')||' '||coalesce(a.service_name,'')) in ('spring_summer','four_season')) filter(where a.agreement_status in ('active','paused')) as spring_summer_coverage,
    bool_or(public.ywi_crm_season_context(coalesce(a.service_program_type,'')||' '||coalesce(a.service_name,'')) in ('fall','four_season')) filter(where a.agreement_status in ('active','paused')) as fall_coverage,
    bool_or(public.ywi_crm_season_context(coalesce(a.service_program_type,'')||' '||coalesce(a.service_name,'')) in ('winter','four_season')) filter(where a.agreement_status in ('active','paused')) as winter_coverage
  from public.recurring_service_agreements a where a.client_id=c.id
) sp on true
left join lateral (
  select count(*)::int as service_history_count,max(sh.occurred_at) as last_service_at,
    bool_or(sh.season_context in ('spring_summer','four_season')) as spring_summer_history,
    bool_or(sh.season_context in ('fall','four_season')) as fall_history,
    bool_or(sh.season_context in ('winter','four_season')) as winter_history
  from public.v_crm_service_history sh where sh.client_id=c.id
) h on true
left join lateral (
  select count(*) filter(where followup_status in ('pending','in_progress','deferred'))::int as open_followup_count
  from public.crm_followups x where x.client_id=c.id
) f on true
left join lateral (
  select count(*) filter(where opportunity_status in ('identified','contact_ready','quoted','on_hold'))::int as open_opportunity_count
  from public.crm_opportunities x where x.client_id=c.id
) o on true
left join lateral (
  select count(*) filter(where interaction_type='complaint' and coalesce(complaint_status,'open') not in ('resolved','closed'))::int as open_complaint_count,
    max(occurred_at) as last_interaction_at
  from public.crm_customer_interactions x where x.client_id=c.id
) i on true;
revoke all on table public.v_crm_customer_directory from public,anon,authenticated;
grant select on table public.v_crm_customer_directory to service_role;

create or replace view public.v_crm_property_directory
with (security_invoker=true) as
select
  p.*,c.crm_lifecycle_stage,c.crm_preferred_contact_method,
  coalesce(sp.active_plan_count,0)::int as active_service_plan_count,
  coalesce(sp.spring_summer_coverage,false) or coalesce(h.spring_summer_history,false) as spring_summer_coverage,
  coalesce(sp.fall_coverage,false) or coalesce(h.fall_history,false) as fall_coverage,
  coalesce(sp.winter_coverage,false) or coalesce(h.winter_history,false) as winter_coverage,
  coalesce(h.service_history_count,0)::int as service_history_count,h.last_service_at
from public.v_property_site_intelligence p
join public.clients c on c.id=p.client_id
left join lateral (
  select count(*) filter(where a.agreement_status in ('active','paused','draft'))::int as active_plan_count,
    bool_or(public.ywi_crm_season_context(coalesce(a.service_program_type,'')||' '||coalesce(a.service_name,'')) in ('spring_summer','four_season')) as spring_summer_coverage,
    bool_or(public.ywi_crm_season_context(coalesce(a.service_program_type,'')||' '||coalesce(a.service_name,'')) in ('fall','four_season')) as fall_coverage,
    bool_or(public.ywi_crm_season_context(coalesce(a.service_program_type,'')||' '||coalesce(a.service_name,'')) in ('winter','four_season')) as winter_coverage
  from public.recurring_service_agreements a where a.client_site_id=p.id
) sp on true
left join lateral (
  select count(*)::int as service_history_count,max(sh.occurred_at) as last_service_at,
    bool_or(sh.season_context in ('spring_summer','four_season')) as spring_summer_history,
    bool_or(sh.season_context in ('fall','four_season')) as fall_history,
    bool_or(sh.season_context in ('winter','four_season')) as winter_history
  from public.v_crm_service_history sh where sh.client_site_id=p.id
) h on true;
revoke all on table public.v_crm_property_directory from public,anon,authenticated;
grant select on table public.v_crm_property_directory to service_role;

create or replace view public.v_crm_interaction_timeline
with (security_invoker=true) as
select i.*,coalesce(c.display_name,c.legal_name) as client_name,cs.site_name,cs.service_address,p.full_name as recorded_by_name
from public.crm_customer_interactions i
join public.clients c on c.id=i.client_id
left join public.client_sites cs on cs.id=i.client_site_id
left join public.profiles p on p.id=i.created_by_profile_id;
revoke all on table public.v_crm_interaction_timeline from public,anon,authenticated;
grant select on table public.v_crm_interaction_timeline to service_role;

create or replace view public.v_crm_followup_queue
with (security_invoker=true) as
select f.*,coalesce(c.display_name,c.legal_name) as client_name,cs.site_name,p.full_name as assigned_to_name,
  (f.followup_status in ('pending','in_progress','deferred') and f.due_at<now()) as overdue
from public.crm_followups f
join public.clients c on c.id=f.client_id
left join public.client_sites cs on cs.id=f.client_site_id
left join public.profiles p on p.id=f.assigned_to_profile_id;
revoke all on table public.v_crm_followup_queue from public,anon,authenticated;
grant select on table public.v_crm_followup_queue to service_role;

create or replace view public.v_crm_opportunity_directory
with (security_invoker=true) as
select o.*,coalesce(c.display_name,c.legal_name) as client_name,cs.site_name,p.full_name as assigned_to_name,e.estimate_number
from public.crm_opportunities o
join public.clients c on c.id=o.client_id
left join public.client_sites cs on cs.id=o.client_site_id
left join public.profiles p on p.id=o.assigned_to_profile_id
left join public.estimates e on e.id=o.estimate_id;
revoke all on table public.v_crm_opportunity_directory from public,anon,authenticated;
grant select on table public.v_crm_opportunity_directory to service_role;

create or replace view public.v_crm_renewal_queue
with (security_invoker=true) as
select p.*,
  case
    when p.end_date is null or p.open_end_date then 'open_ended'
    when p.end_date<current_date then 'overdue'
    when p.end_date<=current_date+30 then 'due_30_days'
    when p.end_date<=current_date+90 then 'due_90_days'
    else 'future'
  end as renewal_status
from public.v_crm_service_plan_directory p
where p.agreement_status in ('active','paused','draft')
  and (p.open_end_date or p.end_date is null or p.end_date<=current_date+120);
revoke all on table public.v_crm_renewal_queue from public,anon,authenticated;
grant select on table public.v_crm_renewal_queue to service_role;

create or replace view public.v_crm_cross_service_candidates
with (security_invoker=true) as
with coverage as (
  select p.id as client_site_id,p.client_id,p.site_name,p.service_address,
    bool_or(public.ywi_crm_season_context(coalesce(a.service_program_type,'')||' '||coalesce(a.service_name,'')) in ('spring_summer','four_season'))
      filter(where a.agreement_status in ('active','paused','completed')) as has_spring_summer,
    bool_or(public.ywi_crm_season_context(coalesce(a.service_program_type,'')||' '||coalesce(a.service_name,'')) in ('fall','four_season'))
      filter(where a.agreement_status in ('active','paused','completed')) as has_fall,
    bool_or(public.ywi_crm_season_context(coalesce(a.service_program_type,'')||' '||coalesce(a.service_name,'')) in ('winter','four_season'))
      filter(where a.agreement_status in ('active','paused','completed')) as has_winter
  from public.client_sites p
  left join public.recurring_service_agreements a on a.client_site_id=p.id
  where p.is_active
  group by p.id,p.client_id,p.site_name,p.service_address
)
select cv.client_id,cv.client_site_id,coalesce(c.display_name,c.legal_name) as client_name,cv.site_name,cv.service_address,
  x.season_context,x.target_service_type,
  case x.season_context
    when 'spring_summer' then 'No spring/summer mowing or landscaping service-plan history is recorded for this property.'
    when 'fall' then 'No fall cleanup or leaf-collection service-plan history is recorded for this property.'
    when 'winter' then 'No winter snow-clearing/removal service-plan history is recorded for this property.'
  end as candidate_reason,
  'advisory_only'::text as action_boundary
from coverage cv
join public.clients c on c.id=cv.client_id
cross join lateral (values
  ('spring_summer'::text,'Mowing / landscaping'::text,coalesce(cv.has_spring_summer,false)),
  ('fall'::text,'Fall cleanup / leaf collection'::text,coalesce(cv.has_fall,false)),
  ('winter'::text,'Snow clearing / snow removal'::text,coalesce(cv.has_winter,false))
) as x(season_context,target_service_type,already_covered)
where not x.already_covered and c.is_active;
revoke all on table public.v_crm_cross_service_candidates from public,anon,authenticated;
grant select on table public.v_crm_cross_service_candidates to service_role;

create or replace function public.ywi_rpc_crm_client_save(p_payload jsonb,p_actor_profile_id uuid)
returns public.clients language plpgsql security invoker set search_path=public as $$
declare
  v_id uuid := case when nullif(p_payload->>'id','') is null then null else (p_payload->>'id')::uuid end;
  v_lead uuid := case when nullif(p_payload->>'lead_request_id','') is null then null else (p_payload->>'lead_request_id')::uuid end;
  v_name text := nullif(btrim(p_payload->>'legal_name'),'');
  v_stage text := lower(coalesce(nullif(p_payload->>'crm_lifecycle_stage',''),'customer'));
  v_contact text := lower(nullif(p_payload->>'crm_preferred_contact_method',''));
  v_row public.clients;
begin
  if v_stage not in ('lead','prospect','customer','inactive','former') then raise exception 'Unsupported CRM lifecycle stage.' using errcode='23514'; end if;
  if v_contact is not null and v_contact not in ('email','phone','text','portal','in_person','other') then raise exception 'Unsupported preferred contact method.' using errcode='23514'; end if;
  if v_id is null and v_name is null then raise exception 'Customer/legal name is required.' using errcode='23514'; end if;

  if v_id is null then
    insert into public.clients(client_code,legal_name,display_name,client_type,billing_email,phone,city,province,postal_code,notes,is_active,
      crm_lifecycle_stage,crm_lead_source,crm_relationship_owner_profile_id,crm_preferred_contact_method,crm_preferred_contact_window,crm_relationship_notes)
    values(
      coalesce(upper(nullif(btrim(p_payload->>'client_code'),'')),'CRM-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
      v_name,nullif(btrim(p_payload->>'display_name'),''),coalesce(nullif(btrim(p_payload->>'client_type'),''),'customer'),
      nullif(btrim(p_payload->>'billing_email'),''),nullif(btrim(p_payload->>'phone'),''),nullif(btrim(p_payload->>'city'),''),
      nullif(btrim(p_payload->>'province'),''),nullif(btrim(p_payload->>'postal_code'),''),nullif(btrim(p_payload->>'notes'),''),
      coalesce((p_payload->>'is_active')::boolean,true),v_stage,nullif(btrim(p_payload->>'crm_lead_source'),''),
      nullif(p_payload->>'crm_relationship_owner_profile_id','')::uuid,v_contact,
      nullif(btrim(p_payload->>'crm_preferred_contact_window'),''),nullif(btrim(p_payload->>'crm_relationship_notes'),'')
    ) returning * into v_row;
  else
    update public.clients c set
      legal_name=coalesce(v_name,c.legal_name),
      display_name=case when p_payload?'display_name' then nullif(btrim(p_payload->>'display_name'),'') else c.display_name end,
      billing_email=case when p_payload?'billing_email' then nullif(btrim(p_payload->>'billing_email'),'') else c.billing_email end,
      phone=case when p_payload?'phone' then nullif(btrim(p_payload->>'phone'),'') else c.phone end,
      city=case when p_payload?'city' then nullif(btrim(p_payload->>'city'),'') else c.city end,
      province=case when p_payload?'province' then nullif(btrim(p_payload->>'province'),'') else c.province end,
      postal_code=case when p_payload?'postal_code' then nullif(btrim(p_payload->>'postal_code'),'') else c.postal_code end,
      notes=case when p_payload?'notes' then nullif(btrim(p_payload->>'notes'),'') else c.notes end,
      is_active=case when p_payload?'is_active' then coalesce((p_payload->>'is_active')::boolean,true) else c.is_active end,
      crm_lifecycle_stage=case when p_payload?'crm_lifecycle_stage' then v_stage else c.crm_lifecycle_stage end,
      crm_lead_source=case when p_payload?'crm_lead_source' then nullif(btrim(p_payload->>'crm_lead_source'),'') else c.crm_lead_source end,
      crm_relationship_owner_profile_id=case when p_payload?'crm_relationship_owner_profile_id' then nullif(p_payload->>'crm_relationship_owner_profile_id','')::uuid else c.crm_relationship_owner_profile_id end,
      crm_preferred_contact_method=case when p_payload?'crm_preferred_contact_method' then v_contact else c.crm_preferred_contact_method end,
      crm_preferred_contact_window=case when p_payload?'crm_preferred_contact_window' then nullif(btrim(p_payload->>'crm_preferred_contact_window'),'') else c.crm_preferred_contact_window end,
      crm_relationship_notes=case when p_payload?'crm_relationship_notes' then nullif(btrim(p_payload->>'crm_relationship_notes'),'') else c.crm_relationship_notes end,
      updated_at=now()
    where c.id=v_id returning c.* into v_row;
    if not found then raise exception 'Customer does not exist.' using errcode='23503'; end if;
  end if;

  if v_lead is not null then
    if not exists(select 1 from public.quote_contact_requests where id=v_lead) then raise exception 'Lead request does not exist.' using errcode='23503'; end if;
    update public.quote_contact_requests set converted_client_id=v_row.id,updated_at=now() where id=v_lead;
    insert into public.quote_contact_request_events(request_id,event_type,event_note,actor_profile_id,metadata)
      values(v_lead,'converted_to_client','Linked to canonical customer record.',p_actor_profile_id,jsonb_build_object('client_id',v_row.id,'schema',228));
  end if;
  return v_row;
end;
$$;

create or replace function public.ywi_rpc_crm_interaction_save(p_payload jsonb,p_actor_profile_id uuid)
returns public.crm_customer_interactions language plpgsql security invoker set search_path=public as $$
declare
  v_id uuid := nullif(p_payload->>'id','')::uuid;
  v_client uuid := nullif(p_payload->>'client_id','')::uuid;
  v_type text := lower(coalesce(nullif(p_payload->>'interaction_type',''),'communication'));
  v_channel text := lower(coalesce(nullif(p_payload->>'channel',''),'other'));
  v_direction text := lower(coalesce(nullif(p_payload->>'direction',''),'internal'));
  v_status text := lower(coalesce(nullif(p_payload->>'interaction_status',''),'open'));
  v_complaint text := lower(nullif(p_payload->>'complaint_status',''));
  v_season text := lower(coalesce(nullif(p_payload->>'season_context',''),'other'));
  v_summary text := nullif(btrim(p_payload->>'summary'),'');
  v_row public.crm_customer_interactions;
begin
  if v_client is null or v_summary is null then raise exception 'Customer and interaction summary are required.' using errcode='23514'; end if;
  if v_type not in ('communication','complaint','service_review','renewal_discussion','opportunity_note') then raise exception 'Unsupported interaction type.' using errcode='23514'; end if;
  if v_channel not in ('email','phone','text','in_person','portal','website','system','other') then raise exception 'Unsupported channel.' using errcode='23514'; end if;
  if v_direction not in ('inbound','outbound','internal') then raise exception 'Unsupported direction.' using errcode='23514'; end if;
  if v_status not in ('open','resolved','closed','informational') then raise exception 'Unsupported status.' using errcode='23514'; end if;
  if v_complaint is not null and v_complaint not in ('open','investigating','resolved','closed') then raise exception 'Unsupported complaint status.' using errcode='23514'; end if;
  if v_season not in ('spring_summer','fall','winter','four_season','other') then raise exception 'Unsupported season context.' using errcode='23514'; end if;
  if v_id is null then
    insert into public.crm_customer_interactions(client_id,client_site_id,quote_request_id,estimate_id,work_order_id,recurring_service_agreement_id,
      interaction_type,channel,direction,interaction_status,complaint_status,subject,summary,outcome,season_context,service_type,occurred_at,created_by_profile_id)
    values(v_client,nullif(p_payload->>'client_site_id','')::uuid,nullif(p_payload->>'quote_request_id','')::uuid,nullif(p_payload->>'estimate_id','')::uuid,
      nullif(p_payload->>'work_order_id','')::uuid,nullif(p_payload->>'recurring_service_agreement_id','')::uuid,v_type,v_channel,v_direction,v_status,v_complaint,
      nullif(btrim(p_payload->>'subject'),''),v_summary,nullif(btrim(p_payload->>'outcome'),''),v_season,nullif(btrim(p_payload->>'service_type'),''),
      coalesce(nullif(p_payload->>'occurred_at','')::timestamptz,now()),p_actor_profile_id) returning * into v_row;
  else
    update public.crm_customer_interactions i set interaction_status=v_status,
      complaint_status=case when p_payload?'complaint_status' then v_complaint else i.complaint_status end,
      subject=case when p_payload?'subject' then nullif(btrim(p_payload->>'subject'),'') else i.subject end,
      summary=v_summary,outcome=case when p_payload?'outcome' then nullif(btrim(p_payload->>'outcome'),'') else i.outcome end,
      season_context=v_season,service_type=case when p_payload?'service_type' then nullif(btrim(p_payload->>'service_type'),'') else i.service_type end,updated_at=now()
    where i.id=v_id and i.client_id=v_client returning i.* into v_row;
    if not found then raise exception 'CRM interaction was not found.' using errcode='23503'; end if;
  end if;
  return v_row;
end;
$$;

create or replace function public.ywi_rpc_crm_followup_save(p_payload jsonb,p_actor_profile_id uuid)
returns public.crm_followups language plpgsql security invoker set search_path=public as $$
declare
  v_id uuid := nullif(p_payload->>'id','')::uuid;
  v_client uuid := nullif(p_payload->>'client_id','')::uuid;
  v_type text := lower(coalesce(nullif(p_payload->>'followup_type',''),'general'));
  v_status text := lower(coalesce(nullif(p_payload->>'followup_status',''),'pending'));
  v_priority text := lower(coalesce(nullif(p_payload->>'priority',''),'normal'));
  v_season text := lower(coalesce(nullif(p_payload->>'season_context',''),'other'));
  v_due timestamptz := nullif(p_payload->>'due_at','')::timestamptz;
  v_summary text := nullif(btrim(p_payload->>'summary'),'');
  v_row public.crm_followups;
begin
  if v_client is null or v_due is null or v_summary is null then raise exception 'Customer, due date and summary are required.' using errcode='23514'; end if;
  if v_type not in ('general','lead','complaint','renewal','service_review','upsell_cross_service') then raise exception 'Unsupported follow-up type.' using errcode='23514'; end if;
  if v_status not in ('pending','in_progress','deferred','completed','cancelled') then raise exception 'Unsupported follow-up status.' using errcode='23514'; end if;
  if v_priority not in ('low','normal','high','urgent') then raise exception 'Unsupported priority.' using errcode='23514'; end if;
  if v_season not in ('spring_summer','fall','winter','four_season','other') then raise exception 'Unsupported season context.' using errcode='23514'; end if;
  if v_id is null then
    insert into public.crm_followups(client_id,client_site_id,interaction_id,followup_type,followup_status,priority,due_at,assigned_to_profile_id,
      season_context,service_type,summary,resolution_note,completed_at,completed_by_profile_id,created_by_profile_id)
    values(v_client,nullif(p_payload->>'client_site_id','')::uuid,nullif(p_payload->>'interaction_id','')::uuid,v_type,v_status,v_priority,v_due,
      nullif(p_payload->>'assigned_to_profile_id','')::uuid,v_season,nullif(btrim(p_payload->>'service_type'),''),v_summary,nullif(btrim(p_payload->>'resolution_note'),''),
      case when v_status='completed' then now() else null end,case when v_status='completed' then p_actor_profile_id else null end,p_actor_profile_id) returning * into v_row;
  else
    update public.crm_followups f set followup_type=v_type,followup_status=v_status,priority=v_priority,due_at=v_due,
      assigned_to_profile_id=case when p_payload?'assigned_to_profile_id' then nullif(p_payload->>'assigned_to_profile_id','')::uuid else f.assigned_to_profile_id end,
      season_context=v_season,service_type=case when p_payload?'service_type' then nullif(btrim(p_payload->>'service_type'),'') else f.service_type end,
      summary=v_summary,resolution_note=case when p_payload?'resolution_note' then nullif(btrim(p_payload->>'resolution_note'),'') else f.resolution_note end,
      completed_at=case when v_status='completed' then coalesce(f.completed_at,now()) when v_status in ('pending','in_progress','deferred') then null else f.completed_at end,
      completed_by_profile_id=case when v_status='completed' then coalesce(f.completed_by_profile_id,p_actor_profile_id) when v_status in ('pending','in_progress','deferred') then null else f.completed_by_profile_id end,
      updated_at=now()
    where f.id=v_id and f.client_id=v_client returning f.* into v_row;
    if not found then raise exception 'CRM follow-up was not found.' using errcode='23503'; end if;
  end if;
  return v_row;
end;
$$;

create or replace function public.ywi_rpc_crm_opportunity_save(p_payload jsonb,p_actor_profile_id uuid)
returns public.crm_opportunities language plpgsql security invoker set search_path=public as $$
declare
  v_id uuid := nullif(p_payload->>'id','')::uuid;
  v_client uuid := nullif(p_payload->>'client_id','')::uuid;
  v_type text := lower(coalesce(nullif(p_payload->>'opportunity_type',''),'new_service'));
  v_status text := lower(coalesce(nullif(p_payload->>'opportunity_status',''),'identified'));
  v_season text := lower(coalesce(nullif(p_payload->>'season_context',''),'other'));
  v_target text := nullif(btrim(p_payload->>'target_service_type'),'');
  v_value numeric := nullif(p_payload->>'estimated_value','')::numeric;
  v_row public.crm_opportunities;
begin
  if v_client is null or v_target is null then raise exception 'Customer and target service are required.' using errcode='23514'; end if;
  if v_type not in ('new_service','upsell','cross_service','renewal','winback') then raise exception 'Unsupported opportunity type.' using errcode='23514'; end if;
  if v_status not in ('identified','contact_ready','quoted','on_hold','won','lost','dismissed') then raise exception 'Unsupported opportunity status.' using errcode='23514'; end if;
  if v_season not in ('spring_summer','fall','winter','four_season','other') then raise exception 'Unsupported season context.' using errcode='23514'; end if;
  if v_value is not null and v_value<0 then raise exception 'Estimated value cannot be negative.' using errcode='23514'; end if;
  if v_id is null then
    insert into public.crm_opportunities(client_id,client_site_id,source_interaction_id,estimate_id,opportunity_type,opportunity_status,source_service_type,
      target_service_type,season_context,reason,next_action,estimated_value,assigned_to_profile_id,target_date,closed_at,created_by_profile_id)
    values(v_client,nullif(p_payload->>'client_site_id','')::uuid,nullif(p_payload->>'source_interaction_id','')::uuid,nullif(p_payload->>'estimate_id','')::uuid,
      v_type,v_status,nullif(btrim(p_payload->>'source_service_type'),''),v_target,v_season,nullif(btrim(p_payload->>'reason'),''),
      nullif(btrim(p_payload->>'next_action'),''),v_value,nullif(p_payload->>'assigned_to_profile_id','')::uuid,nullif(p_payload->>'target_date','')::date,
      case when v_status in ('won','lost','dismissed') then now() else null end,p_actor_profile_id) returning * into v_row;
  else
    update public.crm_opportunities o set opportunity_type=v_type,opportunity_status=v_status,target_service_type=v_target,season_context=v_season,
      source_service_type=case when p_payload?'source_service_type' then nullif(btrim(p_payload->>'source_service_type'),'') else o.source_service_type end,
      reason=case when p_payload?'reason' then nullif(btrim(p_payload->>'reason'),'') else o.reason end,
      next_action=case when p_payload?'next_action' then nullif(btrim(p_payload->>'next_action'),'') else o.next_action end,
      estimated_value=v_value,assigned_to_profile_id=case when p_payload?'assigned_to_profile_id' then nullif(p_payload->>'assigned_to_profile_id','')::uuid else o.assigned_to_profile_id end,
      target_date=case when p_payload?'target_date' then nullif(p_payload->>'target_date','')::date else o.target_date end,
      estimate_id=case when p_payload?'estimate_id' then nullif(p_payload->>'estimate_id','')::uuid else o.estimate_id end,
      closed_at=case when v_status in ('won','lost','dismissed') then coalesce(o.closed_at,now()) else null end,updated_at=now()
    where o.id=v_id and o.client_id=v_client returning o.* into v_row;
    if not found then raise exception 'CRM opportunity was not found.' using errcode='23503'; end if;
  end if;
  return v_row;
end;
$$;

revoke all on function public.ywi_rpc_crm_client_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_crm_interaction_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_crm_followup_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_crm_opportunity_save(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_crm_client_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_crm_interaction_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_crm_followup_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_crm_opportunity_save(jsonb,uuid) to service_role;

insert into public.app_module_write_contracts(
  action_key,owner_module,minimum_access,boundary_mode,domain_key,event_key,cross_module_event,is_enabled,description
) values
  ('crm_client_save','jobs','approve','write','customer_property_crm','jobs.crm.customer_saved',false,true,'Update canonical clients with CRM lifecycle/preference metadata.'),
  ('crm_interaction_save','jobs','approve','write','customer_property_crm','jobs.crm.interaction_saved',false,true,'Record customer relationship/complaint evidence.'),
  ('crm_followup_save','jobs','approve','write','customer_property_crm','jobs.crm.followup_saved',false,true,'Record bounded customer follow-up work.'),
  ('crm_opportunity_save','jobs','approve','write','customer_property_crm','jobs.crm.opportunity_saved',false,true,'Record advisory renewal/cross-service opportunities without automatic commercial effects.')
on conflict(action_key) do update set owner_module=excluded.owner_module,minimum_access=excluded.minimum_access,boundary_mode=excluded.boundary_mode,
  domain_key=excluded.domain_key,event_key=excluded.event_key,cross_module_event=excluded.cross_module_event,is_enabled=excluded.is_enabled,
  description=excluded.description,updated_at=now();

create or replace function public.ywi_module_write_boundary_security_assertions()
returns table(assertion_key text,assertion_status text,details text)
language sql stable security invoker set search_path=public as $$
  select 'operations_action_contract_count',
    case when (select count(*) from public.app_module_write_contracts where is_enabled)=62 then 'passed' else 'failed' end,
    'Exactly 62 explicitly handled operations-manage actions have enabled write-boundary contracts.'
  union all
  select 'cross_module_events_named',
    case when not exists(select 1 from public.app_module_write_contracts where is_enabled and cross_module_event and event_key is null) then 'passed' else 'failed' end,
    'Every declared cross-module effect has a stable event key.'
  union all
  select 'manual_deposit_mutation_disabled',
    case when exists(select 1 from public.app_module_write_contracts where action_key='deposit_status_update' and owner_module='finance' and boundary_mode='disabled' and is_enabled) then 'passed' else 'failed' end,
    'Hosted payment truth cannot be manually changed through operations-manage.'
  union all
  select 'crm_jobs_boundary',
    case when (select count(*) from public.app_module_write_contracts where action_key in ('crm_client_save','crm_interaction_save','crm_followup_save','crm_opportunity_save')
      and owner_module='jobs' and minimum_access='approve' and boundary_mode='write' and is_enabled)=4 then 'passed' else 'failed' end,
    'Build 340 CRM writes are explicit Jobs-approve contracts.'
  union all
  select 'boundary_control_plane_private',
    case when not exists(select 1 from information_schema.table_privileges where table_schema='public'
      and table_name in ('app_module_write_contracts','module_boundary_events','v_module_boundary_event_contract_status','operations_attention_states')
      and grantee in ('anon','authenticated','PUBLIC')) then 'passed' else 'failed' end,
    'Boundary contracts, events and attention state remain private server control-plane data.';
$$;
revoke all on function public.ywi_module_write_boundary_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_module_write_boundary_security_assertions() to service_role;

create or replace function public.ywi_customer_property_crm_security_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql stable security invoker set search_path=public as $$
  select 'canonical_authorities_preserved',
    case when to_regclass('public.clients') is not null and to_regclass('public.client_sites') is not null
      and to_regclass('public.quote_contact_requests') is not null and to_regclass('public.recurring_service_agreements') is not null
      and to_regclass('public.estimates') is not null and to_regclass('public.work_orders') is not null then 'passed' else 'failed' end,
    'Build 340 links existing lead/customer/property/service-plan/estimate/work-order authorities.'
  union all
  select 'crm_evidence_private',
    case when not exists(select 1 from information_schema.table_privileges where table_schema='public'
      and table_name in ('crm_customer_interactions','crm_followups','crm_opportunities') and grantee in ('anon','authenticated','PUBLIC'))
    then 'passed' else 'failed' end,
    'CRM interaction, follow-up and opportunity evidence is server-only.'
  union all
  select 'cross_service_advisory_only',
    case when not exists(select 1 from public.v_crm_cross_service_candidates where action_boundary<>'advisory_only') then 'passed' else 'failed' end,
    'Cross-service candidates are advisory only and never auto-contact, auto-estimate or bill.';
$$;
revoke all on function public.ywi_customer_property_crm_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_customer_property_crm_security_assertions() to service_role;

insert into public.app_schema_versions(schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label)
values(228,'customer_property_crm',
  'Build 340 unifies CRM read models around canonical lead/customer/property/service-plan/history authorities and adds interaction, follow-up and opportunity evidence.',
  'applied',now(),'schema228',
  'Four-season Ontario CRM preserves spring/summer mowing/landscaping, fall cleanup/leaf collection, and winter snow clearing/removal context without splitting customer or property records.',
  '228_customer_property_crm.sql','schema228')
on conflict(schema_version) do update set schema_name=excluded.schema_name,description=excluded.description,status='applied',
  applied_at=now(),applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true) as
select 228 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)=228 then 'current'
       when coalesce(max(schema_version) filter(where status='applied'),0)>228 then 'ahead' else 'drift' end as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)=228 then 'Live database matches the repository schema marker.'
       when coalesce(max(schema_version) filter(where status='applied'),0)>228 then 'Live database is ahead of the repository schema marker.'
       else 'Live database is behind the repository schema marker.' end as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
