begin;

-- Schema 211 — Build 322 Recurring Lawn & Yard Maintenance Engine.
-- Extends the existing recurring_service_agreements authority and existing
-- service execution scheduler. No replacement customer/job/dispatch authority is created.

alter table public.recurring_service_agreements
  add column if not exists service_program_type text not null default 'other',
  add column if not exists recurrence_frequency text not null default 'weekly',
  add column if not exists recurrence_anchor_date date,
  add column if not exists custom_interval_days integer,
  add column if not exists preferred_weekday integer,
  add column if not exists service_window_start time,
  add column if not exists service_window_end time,
  add column if not exists season_start_month integer,
  add column if not exists season_start_day integer,
  add column if not exists season_end_month integer,
  add column if not exists season_end_day integer,
  add column if not exists default_travel_allowance_minutes integer not null default 0,
  add column if not exists weather_delay_policy text not null default 'manual',
  add column if not exists weather_makeup_days integer not null default 1,
  add column if not exists customer_hold_until date,
  add column if not exists customer_hold_reason text,
  add column if not exists paused_at timestamptz,
  add column if not exists paused_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists pause_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists cancellation_reason text;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='recurring_service_agreements_program_type_chk') then
    alter table public.recurring_service_agreements add constraint recurring_service_agreements_program_type_chk
      check (service_program_type in (
        'mowing','garden_bed_maintenance','hedge_shrub_trimming','spring_cleanup',
        'fall_cleanup','aeration','fertilizing','seasonal_program','other'
      ));
  end if;
  if not exists(select 1 from pg_constraint where conname='recurring_service_agreements_frequency_chk') then
    alter table public.recurring_service_agreements add constraint recurring_service_agreements_frequency_chk
      check (recurrence_frequency in ('weekly','biweekly','custom_days','seasonal_once','manual'));
  end if;
  if not exists(select 1 from pg_constraint where conname='recurring_service_agreements_custom_interval_chk') then
    alter table public.recurring_service_agreements add constraint recurring_service_agreements_custom_interval_chk
      check (custom_interval_days is null or custom_interval_days between 1 and 366);
  end if;
  if not exists(select 1 from pg_constraint where conname='recurring_service_agreements_weekday_chk') then
    alter table public.recurring_service_agreements add constraint recurring_service_agreements_weekday_chk
      check (preferred_weekday is null or preferred_weekday between 0 and 6);
  end if;
  if not exists(select 1 from pg_constraint where conname='recurring_service_agreements_service_window_chk') then
    alter table public.recurring_service_agreements add constraint recurring_service_agreements_service_window_chk
      check (service_window_start is null or service_window_end is null or service_window_end > service_window_start);
  end if;
  if not exists(select 1 from pg_constraint where conname='recurring_service_agreements_season_month_chk') then
    alter table public.recurring_service_agreements add constraint recurring_service_agreements_season_month_chk
      check (
        (season_start_month is null or season_start_month between 1 and 12) and
        (season_end_month is null or season_end_month between 1 and 12)
      );
  end if;
  if not exists(select 1 from pg_constraint where conname='recurring_service_agreements_season_day_chk') then
    alter table public.recurring_service_agreements add constraint recurring_service_agreements_season_day_chk
      check (
        (season_start_day is null or season_start_day between 1 and 31) and
        (season_end_day is null or season_end_day between 1 and 31)
      );
  end if;
  if not exists(select 1 from pg_constraint where conname='recurring_service_agreements_travel_chk') then
    alter table public.recurring_service_agreements add constraint recurring_service_agreements_travel_chk
      check (default_travel_allowance_minutes between 0 and 720);
  end if;
  if not exists(select 1 from pg_constraint where conname='recurring_service_agreements_weather_policy_chk') then
    alter table public.recurring_service_agreements add constraint recurring_service_agreements_weather_policy_chk
      check (weather_delay_policy in ('manual','next_available','fixed_days'));
  end if;
  if not exists(select 1 from pg_constraint where conname='recurring_service_agreements_weather_makeup_chk') then
    alter table public.recurring_service_agreements add constraint recurring_service_agreements_weather_makeup_chk
      check (weather_makeup_days between 0 and 30);
  end if;
end $$;

create index if not exists recurring_service_agreements_status_program_idx
  on public.recurring_service_agreements(agreement_status,service_program_type,start_date,end_date);
create index if not exists recurring_service_agreements_site_status_idx
  on public.recurring_service_agreements(client_site_id,agreement_status);
create index if not exists recurring_service_agreements_crew_status_idx
  on public.recurring_service_agreements(crew_id,agreement_status);

-- This domain is controlled through Jobs-authorized server functions. Existing
-- RLS already blocks browser roles; revoke broad legacy grants as defense in depth.
alter table public.recurring_service_agreements enable row level security;
revoke all on table public.recurring_service_agreements from public,anon,authenticated;
grant select,insert,update,delete on table public.recurring_service_agreements to service_role;

create table if not exists public.recurring_service_visit_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique default ('RSVE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,18))),
  agreement_id uuid not null references public.recurring_service_agreements(id) on delete cascade,
  original_service_date date not null,
  event_type text not null,
  effective_service_date date,
  reason text,
  workability_state text,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint recurring_service_visit_events_type_chk check (
    event_type in ('skip','weather_delay','makeup','customer_hold','resume','cancel_visit')
  ),
  constraint recurring_service_visit_events_workability_chk check (
    workability_state is null or workability_state in ('not_assessed','workable','caution','delayed','blocked')
  )
);
create index if not exists recurring_service_visit_events_agreement_date_idx
  on public.recurring_service_visit_events(agreement_id,original_service_date,created_at desc);
create index if not exists recurring_service_visit_events_effective_date_idx
  on public.recurring_service_visit_events(effective_service_date)
  where effective_service_date is not null;
alter table public.recurring_service_visit_events enable row level security;
revoke all on table public.recurring_service_visit_events from public,anon,authenticated;
grant select,insert on table public.recurring_service_visit_events to service_role;

create or replace function public.ywi_recurring_date_in_season(
  p_date date,
  p_start_month integer,
  p_start_day integer,
  p_end_month integer,
  p_end_day integer
)
returns boolean
language sql
immutable
security invoker
set search_path=public
as $$
  select case
    when p_date is null then false
    when p_start_month is null or p_start_day is null or p_end_month is null or p_end_day is null then true
    when (p_start_month*100+p_start_day) <= (p_end_month*100+p_end_day)
      then ((extract(month from p_date)::int*100+extract(day from p_date)::int)
            between (p_start_month*100+p_start_day) and (p_end_month*100+p_end_day))
    else ((extract(month from p_date)::int*100+extract(day from p_date)::int) >= (p_start_month*100+p_start_day)
       or (extract(month from p_date)::int*100+extract(day from p_date)::int) <= (p_end_month*100+p_end_day))
  end;
$$;
revoke all on function public.ywi_recurring_date_in_season(date,integer,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.ywi_recurring_date_in_season(date,integer,integer,integer,integer) to service_role;

create or replace function public.ywi_recurring_service_occurrences(
  p_from_date date,
  p_to_date date
)
returns table(
  agreement_id uuid,
  agreement_code text,
  service_name text,
  service_program_type text,
  client_id uuid,
  client_site_id uuid,
  route_id uuid,
  crew_id uuid,
  original_service_date date,
  service_date date,
  occurrence_key text,
  visit_status text,
  recurrence_label text,
  preferred_weekday integer,
  service_window_start time,
  service_window_end time,
  visit_estimated_minutes integer,
  default_travel_allowance_minutes integer,
  weather_delay_policy text,
  latest_event_type text,
  latest_event_reason text,
  latest_event_workability_state text,
  customer_hold_until date,
  customer_hold_reason text
)
language sql
stable
security invoker
set search_path=public
as $$
with agreements as (
  select
    a.*,
    coalesce(a.recurrence_anchor_date,a.start_date,p_from_date) as anchor_date
  from public.recurring_service_agreements a
  where a.agreement_status in ('active','paused')
    and coalesce(a.start_date,p_from_date) <= p_to_date
    and (a.open_end_date=true or a.end_date is null or a.end_date >= p_from_date)
), base as (
  select a.*, gs::date as original_date
  from agreements a
  cross join lateral generate_series(p_from_date,p_to_date,interval '1 day') gs
  where gs::date >= coalesce(a.start_date,gs::date)
    and (a.open_end_date=true or a.end_date is null or gs::date <= a.end_date)
    and public.ywi_recurring_date_in_season(
      gs::date,a.season_start_month,a.season_start_day,a.season_end_month,a.season_end_day
    )
    and case a.recurrence_frequency
      when 'weekly' then
        gs::date >= a.anchor_date
        and mod((gs::date-a.anchor_date),7*greatest(1,coalesce(a.recurrence_interval,1)))=0
        and (a.preferred_weekday is null or extract(dow from gs)::int=a.preferred_weekday)
      when 'biweekly' then
        gs::date >= a.anchor_date
        and mod((gs::date-a.anchor_date),14*greatest(1,coalesce(a.recurrence_interval,1)))=0
        and (a.preferred_weekday is null or extract(dow from gs)::int=a.preferred_weekday)
      when 'custom_days' then
        gs::date >= a.anchor_date
        and mod((gs::date-a.anchor_date),greatest(1,coalesce(a.custom_interval_days,a.recurrence_interval,1)))=0
      when 'seasonal_once' then
        extract(month from gs)::int=coalesce(a.season_start_month,extract(month from coalesce(a.start_date,a.anchor_date))::int)
        and extract(day from gs)::int=coalesce(a.season_start_day,extract(day from coalesce(a.start_date,a.anchor_date))::int)
      when 'manual' then false
      else false
    end
), enriched as (
  select
    b.*,
    ev.event_type as latest_event_type,
    ev.effective_service_date,
    ev.reason as latest_event_reason,
    ev.workability_state as latest_event_workability_state
  from base b
  left join lateral (
    select e.event_type,e.effective_service_date,e.reason,e.workability_state
    from public.recurring_service_visit_events e
    where e.agreement_id=b.id and e.original_service_date=b.original_date
    order by e.created_at desc,e.id desc
    limit 1
  ) ev on true
)
select
  e.id,
  e.agreement_code,
  e.service_name,
  e.service_program_type,
  e.client_id,
  e.client_site_id,
  e.route_id,
  e.crew_id,
  e.original_date,
  case
    when e.latest_event_type in ('weather_delay','makeup') and e.effective_service_date is not null
      then e.effective_service_date
    else e.original_date
  end as service_date,
  e.agreement_code||':'||to_char(e.original_date,'YYYY-MM-DD') as occurrence_key,
  case
    when e.agreement_status='paused' then 'held'
    when e.customer_hold_reason is not null
      and (e.customer_hold_until is null or e.original_date<=e.customer_hold_until) then 'held'
    when e.latest_event_type='skip' then 'skipped'
    when e.latest_event_type='cancel_visit' then 'cancelled'
    when e.latest_event_type='weather_delay' then 'weather_delayed'
    when e.latest_event_type='makeup' then 'makeup'
    else 'scheduled'
  end as visit_status,
  case e.recurrence_frequency
    when 'weekly' then 'Weekly'
    when 'biweekly' then 'Biweekly'
    when 'custom_days' then 'Every '||greatest(1,coalesce(e.custom_interval_days,e.recurrence_interval,1))::text||' day(s)'
    when 'seasonal_once' then 'Seasonal once'
    else initcap(replace(e.recurrence_frequency,'_',' '))
  end as recurrence_label,
  e.preferred_weekday,
  e.service_window_start,
  e.service_window_end,
  coalesce(e.visit_estimated_minutes,
    case when e.visit_estimated_duration_hours is not null then round(e.visit_estimated_duration_hours*60)::int else null end
  ) as visit_estimated_minutes,
  e.default_travel_allowance_minutes,
  e.weather_delay_policy,
  e.latest_event_type,
  e.latest_event_reason,
  e.latest_event_workability_state,
  e.customer_hold_until,
  e.customer_hold_reason
from enriched e
order by service_date,agreement_code;
$$;
revoke all on function public.ywi_recurring_service_occurrences(date,date) from public,anon,authenticated;
grant execute on function public.ywi_recurring_service_occurrences(date,date) to service_role;

create or replace view public.v_recurring_service_visit_schedule
with (security_invoker=true)
as
select *
from public.ywi_recurring_service_occurrences(current_date-14,current_date+90);
revoke all on table public.v_recurring_service_visit_schedule from public,anon,authenticated;
grant select on table public.v_recurring_service_visit_schedule to service_role;

create or replace view public.v_recurring_service_program_directory
with (security_invoker=true)
as
select
  a.*,
  coalesce(c.display_name,c.legal_name) as client_name,
  cs.site_name,
  cs.service_address,
  cs.city as site_city,
  cr.crew_code,
  cr.crew_name,
  r.route_code,
  r.name as route_name,
  j.id as linked_job_id,
  j.job_code as linked_job_code,
  j.job_name as linked_job_name,
  nv.original_service_date as next_original_service_date,
  nv.service_date as next_service_date,
  nv.visit_status as next_visit_status,
  nv.occurrence_key as next_occurrence_key,
  nv.recurrence_label
from public.recurring_service_agreements a
left join public.clients c on c.id=a.client_id
left join public.client_sites cs on cs.id=a.client_site_id
left join public.crews cr on cr.id=a.crew_id
left join public.routes r on r.id=a.route_id
left join lateral (
  select jj.id,jj.job_code,jj.job_name
  from public.jobs jj
  where upper(coalesce(jj.service_contract_reference,''))=upper(coalesce(a.agreement_code,''))
  order by jj.id
  limit 1
) j on true
left join lateral (
  select v.original_service_date,v.service_date,v.visit_status,v.occurrence_key,v.recurrence_label
  from public.v_recurring_service_visit_schedule v
  where v.agreement_id=a.id
    and v.service_date>=current_date
    and v.visit_status not in ('skipped','cancelled')
  order by v.service_date,v.original_service_date
  limit 1
) nv on true;
revoke all on table public.v_recurring_service_program_directory from public,anon,authenticated;
grant select on table public.v_recurring_service_program_directory to service_role;

create or replace function public.ywi_rpc_recurring_program_save(
  p_payload jsonb,
  p_actor_profile_id uuid
)
returns public.recurring_service_agreements
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_id uuid := case when nullif(p_payload->>'id','') is null then null else (p_payload->>'id')::uuid end;
  v_row public.recurring_service_agreements;
  v_status text := lower(coalesce(nullif(p_payload->>'agreement_status',''),'draft'));
  v_frequency text := lower(coalesce(nullif(p_payload->>'recurrence_frequency',''),'weekly'));
  v_program_type text := lower(coalesce(nullif(p_payload->>'service_program_type',''),'other'));
  v_service_name text := nullif(btrim(p_payload->>'service_name'),'');
  v_code text := upper(nullif(btrim(p_payload->>'agreement_code'),''));
  v_pause_reason text := nullif(btrim(p_payload->>'pause_reason'),'');
  v_cancel_reason text := nullif(btrim(p_payload->>'cancellation_reason'),'');
begin
  if v_service_name is null and v_id is null then
    raise exception 'Service name is required.' using errcode='23514';
  end if;
  if v_status not in ('draft','active','paused','completed','cancelled') then
    raise exception 'Unsupported agreement status %.',v_status using errcode='23514';
  end if;
  if v_frequency not in ('weekly','biweekly','custom_days','seasonal_once','manual') then
    raise exception 'Unsupported recurrence frequency %.',v_frequency using errcode='23514';
  end if;
  if v_program_type not in ('mowing','garden_bed_maintenance','hedge_shrub_trimming','spring_cleanup','fall_cleanup','aeration','fertilizing','seasonal_program','other') then
    raise exception 'Unsupported service program type %.',v_program_type using errcode='23514';
  end if;
  if v_status='paused' and v_pause_reason is null then
    raise exception 'A pause/hold reason is required.' using errcode='23514';
  end if;
  if v_status='cancelled' and v_cancel_reason is null then
    raise exception 'A cancellation reason is required.' using errcode='23514';
  end if;
  if v_frequency='custom_days' and coalesce(nullif(p_payload->>'custom_interval_days','')::integer,0)<1 then
    raise exception 'Custom recurrence requires custom_interval_days of at least 1.' using errcode='23514';
  end if;

  if v_id is null then
    v_code:=coalesce(v_code,'RSA-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)));
    insert into public.recurring_service_agreements(
      agreement_code,client_id,client_site_id,route_id,crew_id,service_name,agreement_status,
      billing_method,service_pattern,recurrence_basis,recurrence_rule,recurrence_interval,
      start_date,end_date,open_end_date,visit_estimated_minutes,service_notes,created_by_profile_id,
      service_program_type,recurrence_frequency,recurrence_anchor_date,custom_interval_days,preferred_weekday,
      service_window_start,service_window_end,season_start_month,season_start_day,season_end_month,season_end_day,
      default_travel_allowance_minutes,weather_delay_policy,weather_makeup_days,customer_hold_until,customer_hold_reason,
      paused_at,paused_by_profile_id,pause_reason,cancelled_at,cancelled_by_profile_id,cancellation_reason,
      auto_create_session_candidates
    ) values (
      v_code,
      case when nullif(p_payload->>'client_id','') is null then null else (p_payload->>'client_id')::uuid end,
      case when nullif(p_payload->>'client_site_id','') is null then null else (p_payload->>'client_site_id')::uuid end,
      case when nullif(p_payload->>'route_id','') is null then null else (p_payload->>'route_id')::uuid end,
      case when nullif(p_payload->>'crew_id','') is null then null else (p_payload->>'crew_id')::uuid end,
      v_service_name,v_status,coalesce(nullif(p_payload->>'billing_method',''),'per_visit'),
      nullif(p_payload->>'service_pattern',''),v_frequency,nullif(p_payload->>'recurrence_rule',''),
      greatest(1,coalesce(nullif(p_payload->>'recurrence_interval','')::integer,1)),
      nullif(p_payload->>'start_date','')::date,nullif(p_payload->>'end_date','')::date,
      coalesce((p_payload->>'open_end_date')::boolean,false),
      nullif(p_payload->>'visit_estimated_minutes','')::integer,nullif(p_payload->>'service_notes',''),p_actor_profile_id,
      v_program_type,v_frequency,nullif(p_payload->>'recurrence_anchor_date','')::date,
      nullif(p_payload->>'custom_interval_days','')::integer,nullif(p_payload->>'preferred_weekday','')::integer,
      nullif(p_payload->>'service_window_start','')::time,nullif(p_payload->>'service_window_end','')::time,
      nullif(p_payload->>'season_start_month','')::integer,nullif(p_payload->>'season_start_day','')::integer,
      nullif(p_payload->>'season_end_month','')::integer,nullif(p_payload->>'season_end_day','')::integer,
      greatest(0,coalesce(nullif(p_payload->>'default_travel_allowance_minutes','')::integer,0)),
      coalesce(nullif(p_payload->>'weather_delay_policy',''),'manual'),
      greatest(0,coalesce(nullif(p_payload->>'weather_makeup_days','')::integer,1)),
      nullif(p_payload->>'customer_hold_until','')::date,nullif(p_payload->>'customer_hold_reason',''),
      case when v_status='paused' then now() else null end,
      case when v_status='paused' then p_actor_profile_id else null end,
      v_pause_reason,
      case when v_status='cancelled' then now() else null end,
      case when v_status='cancelled' then p_actor_profile_id else null end,
      v_cancel_reason,
      coalesce((p_payload->>'auto_create_session_candidates')::boolean,true)
    ) returning * into v_row;
  else
    select * into v_row from public.recurring_service_agreements where id=v_id for update;
    if not found then raise exception 'Recurring service agreement % does not exist.',v_id using errcode='23503'; end if;

    update public.recurring_service_agreements a set
      agreement_code=case when p_payload ? 'agreement_code' then coalesce(v_code,a.agreement_code) else a.agreement_code end,
      client_id=case when p_payload ? 'client_id' then nullif(p_payload->>'client_id','')::uuid else a.client_id end,
      client_site_id=case when p_payload ? 'client_site_id' then nullif(p_payload->>'client_site_id','')::uuid else a.client_site_id end,
      route_id=case when p_payload ? 'route_id' then nullif(p_payload->>'route_id','')::uuid else a.route_id end,
      crew_id=case when p_payload ? 'crew_id' then nullif(p_payload->>'crew_id','')::uuid else a.crew_id end,
      service_name=coalesce(v_service_name,a.service_name),
      agreement_status=v_status,
      billing_method=coalesce(nullif(p_payload->>'billing_method',''),a.billing_method),
      service_pattern=case when p_payload ? 'service_pattern' then nullif(p_payload->>'service_pattern','') else a.service_pattern end,
      recurrence_basis=v_frequency,
      recurrence_rule=case when p_payload ? 'recurrence_rule' then nullif(p_payload->>'recurrence_rule','') else a.recurrence_rule end,
      recurrence_interval=case when p_payload ? 'recurrence_interval' then greatest(1,coalesce(nullif(p_payload->>'recurrence_interval','')::integer,1)) else a.recurrence_interval end,
      start_date=case when p_payload ? 'start_date' then nullif(p_payload->>'start_date','')::date else a.start_date end,
      end_date=case when p_payload ? 'end_date' then nullif(p_payload->>'end_date','')::date else a.end_date end,
      open_end_date=case when p_payload ? 'open_end_date' then coalesce((p_payload->>'open_end_date')::boolean,false) else a.open_end_date end,
      visit_estimated_minutes=case when p_payload ? 'visit_estimated_minutes' then nullif(p_payload->>'visit_estimated_minutes','')::integer else a.visit_estimated_minutes end,
      service_notes=case when p_payload ? 'service_notes' then nullif(p_payload->>'service_notes','') else a.service_notes end,
      service_program_type=v_program_type,
      recurrence_frequency=v_frequency,
      recurrence_anchor_date=case when p_payload ? 'recurrence_anchor_date' then nullif(p_payload->>'recurrence_anchor_date','')::date else a.recurrence_anchor_date end,
      custom_interval_days=case when p_payload ? 'custom_interval_days' then nullif(p_payload->>'custom_interval_days','')::integer else a.custom_interval_days end,
      preferred_weekday=case when p_payload ? 'preferred_weekday' then nullif(p_payload->>'preferred_weekday','')::integer else a.preferred_weekday end,
      service_window_start=case when p_payload ? 'service_window_start' then nullif(p_payload->>'service_window_start','')::time else a.service_window_start end,
      service_window_end=case when p_payload ? 'service_window_end' then nullif(p_payload->>'service_window_end','')::time else a.service_window_end end,
      season_start_month=case when p_payload ? 'season_start_month' then nullif(p_payload->>'season_start_month','')::integer else a.season_start_month end,
      season_start_day=case when p_payload ? 'season_start_day' then nullif(p_payload->>'season_start_day','')::integer else a.season_start_day end,
      season_end_month=case when p_payload ? 'season_end_month' then nullif(p_payload->>'season_end_month','')::integer else a.season_end_month end,
      season_end_day=case when p_payload ? 'season_end_day' then nullif(p_payload->>'season_end_day','')::integer else a.season_end_day end,
      default_travel_allowance_minutes=case when p_payload ? 'default_travel_allowance_minutes' then greatest(0,coalesce(nullif(p_payload->>'default_travel_allowance_minutes','')::integer,0)) else a.default_travel_allowance_minutes end,
      weather_delay_policy=coalesce(nullif(p_payload->>'weather_delay_policy',''),a.weather_delay_policy),
      weather_makeup_days=case when p_payload ? 'weather_makeup_days' then greatest(0,coalesce(nullif(p_payload->>'weather_makeup_days','')::integer,1)) else a.weather_makeup_days end,
      customer_hold_until=case when p_payload ? 'customer_hold_until' then nullif(p_payload->>'customer_hold_until','')::date else a.customer_hold_until end,
      customer_hold_reason=case when p_payload ? 'customer_hold_reason' then nullif(p_payload->>'customer_hold_reason','') else a.customer_hold_reason end,
      paused_at=case when v_status='paused' and a.agreement_status<>'paused' then now() when v_status<>'paused' then null else a.paused_at end,
      paused_by_profile_id=case when v_status='paused' then coalesce(a.paused_by_profile_id,p_actor_profile_id) when v_status<>'paused' then null else a.paused_by_profile_id end,
      pause_reason=case when v_status='paused' then coalesce(v_pause_reason,a.pause_reason) when v_status<>'paused' then null else a.pause_reason end,
      cancelled_at=case when v_status='cancelled' and a.agreement_status<>'cancelled' then now() else a.cancelled_at end,
      cancelled_by_profile_id=case when v_status='cancelled' then coalesce(a.cancelled_by_profile_id,p_actor_profile_id) else a.cancelled_by_profile_id end,
      cancellation_reason=case when v_status='cancelled' then coalesce(v_cancel_reason,a.cancellation_reason) else a.cancellation_reason end,
      auto_create_session_candidates=case when p_payload ? 'auto_create_session_candidates' then coalesce((p_payload->>'auto_create_session_candidates')::boolean,true) else a.auto_create_session_candidates end,
      updated_at=now()
    where a.id=v_id
    returning a.* into v_row;
  end if;

  return v_row;
end;
$$;
revoke all on function public.ywi_rpc_recurring_program_save(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_recurring_program_save(jsonb,uuid) to service_role;

create or replace function public.ywi_rpc_recurring_visit_event(
  p_agreement_id uuid,
  p_original_service_date date,
  p_event_type text,
  p_effective_service_date date,
  p_reason text,
  p_workability_state text,
  p_actor_profile_id uuid
)
returns public.recurring_service_visit_events
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_type text := lower(coalesce(nullif(btrim(p_event_type),''),''));
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
  v_workability text := lower(nullif(btrim(coalesce(p_workability_state,'')),''));
  v_row public.recurring_service_visit_events;
begin
  if not exists(select 1 from public.recurring_service_agreements where id=p_agreement_id) then
    raise exception 'Recurring service agreement % does not exist.',p_agreement_id using errcode='23503';
  end if;
  if v_type not in ('skip','weather_delay','makeup','customer_hold','resume','cancel_visit') then
    raise exception 'Unsupported recurring visit event type %.',v_type using errcode='23514';
  end if;
  if v_type<>'resume' and v_reason is null then
    raise exception 'A reason is required for %.',v_type using errcode='23514';
  end if;
  if v_type in ('weather_delay','makeup') and p_effective_service_date is null then
    raise exception 'Weather delay and make-up events require an effective service date.' using errcode='23514';
  end if;
  if p_effective_service_date is not null and p_effective_service_date<p_original_service_date then
    raise exception 'Effective service date cannot precede the original service date.' using errcode='23514';
  end if;

  if v_type='customer_hold' then
    update public.recurring_service_agreements
    set agreement_status='paused',
        customer_hold_until=p_effective_service_date,
        customer_hold_reason=v_reason,
        paused_at=now(),
        paused_by_profile_id=p_actor_profile_id,
        pause_reason=v_reason,
        updated_at=now()
    where id=p_agreement_id;
  elsif v_type='resume' then
    update public.recurring_service_agreements
    set agreement_status='active',
        customer_hold_until=null,
        customer_hold_reason=null,
        paused_at=null,
        paused_by_profile_id=null,
        pause_reason=null,
        updated_at=now()
    where id=p_agreement_id;
  end if;

  insert into public.recurring_service_visit_events(
    agreement_id,original_service_date,event_type,effective_service_date,reason,
    workability_state,actor_profile_id,event_payload
  ) values (
    p_agreement_id,p_original_service_date,v_type,p_effective_service_date,v_reason,
    v_workability,p_actor_profile_id,
    jsonb_build_object('build',322,'schema',211)
  ) returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.ywi_rpc_recurring_visit_event(uuid,date,text,date,text,text,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_recurring_visit_event(uuid,date,text,date,text,text,uuid) to service_role;

-- Replace the legacy "today only" candidate generator with recurrence-aware visits.
create or replace view public.v_service_agreement_execution_candidates
with (security_invoker=true)
as
with visit_candidates as (
  select
    v.agreement_id,
    v.agreement_code,
    v.service_name,
    v.client_id,
    v.client_site_id,
    v.route_id,
    v.crew_id,
    'service_session'::text as candidate_kind,
    a.default_invoice_source as invoice_source,
    v.service_date as candidate_date,
    a.visit_charge_total,
    a.visit_cost_total,
    null::uuid as snow_event_trigger_id,
    ('Recurring '||replace(v.visit_status,'_',' ')||' visit: '||v.recurrence_label)::text as candidate_reason
  from public.v_recurring_service_visit_schedule v
  join public.recurring_service_agreements a on a.id=v.agreement_id
  where v.service_date>=current_date
    and v.visit_status in ('scheduled','weather_delayed','makeup')
    and a.agreement_status='active'
    and coalesce(a.auto_create_session_candidates,false)=true
), invoice_candidates as (
  select
    v.agreement_id,
    v.agreement_code,
    v.service_name,
    v.client_id,
    v.client_site_id,
    v.route_id,
    v.crew_id,
    'visit_invoice'::text as candidate_kind,
    a.default_invoice_source as invoice_source,
    v.service_date as candidate_date,
    a.visit_charge_total,
    a.visit_cost_total,
    null::uuid as snow_event_trigger_id,
    ('Recurring visit invoice candidate: '||v.recurrence_label)::text as candidate_reason
  from public.v_recurring_service_visit_schedule v
  join public.recurring_service_agreements a on a.id=v.agreement_id
  where v.service_date>=current_date
    and v.visit_status in ('scheduled','weather_delayed','makeup')
    and a.agreement_status='active'
    and coalesce(a.auto_stage_invoice_candidates,false)=true
    and coalesce(a.default_invoice_source,'agreement_visit')='agreement_visit'
), snow_candidates as (
  select
    a.id as agreement_id,
    a.agreement_code,
    a.service_name,
    a.client_id,
    a.client_site_id,
    a.route_id,
    a.crew_id,
    'snow_invoice'::text as candidate_kind,
    'agreement_snow'::text as invoice_source,
    st.event_date as candidate_date,
    a.visit_charge_total,
    a.visit_cost_total,
    st.id as snow_event_trigger_id,
    'Triggered snow event is ready for invoice candidate staging.'::text as candidate_reason
  from public.recurring_service_agreements a
  join public.snow_event_triggers st on st.agreement_id=a.id
  left join public.ar_invoices ai on ai.snow_event_trigger_id=st.id
  where a.agreement_status='active'
    and coalesce(a.auto_stage_invoice_candidates,false)=true
    and st.trigger_met=true
    and ai.id is null
)
select * from visit_candidates
union all
select * from invoice_candidates
union all
select * from snow_candidates;
revoke all on table public.v_service_agreement_execution_candidates from public,anon,authenticated;
grant select on table public.v_service_agreement_execution_candidates to service_role;

create or replace view public.v_service_execution_scheduler_candidates
with (security_invoker=true)
as
with candidate_jobs as (
  select
    c.*,
    j.id as job_id,
    j.job_code,
    j.job_name,
    j.status as job_status
  from public.v_service_agreement_execution_candidates c
  left join public.jobs j
    on upper(coalesce(j.service_contract_reference,''))=upper(coalesce(c.agreement_code,''))
)
select
  cj.agreement_id,cj.agreement_code,cj.service_name,cj.candidate_kind,cj.invoice_source,
  cj.candidate_date,cj.candidate_reason,cj.client_id,cj.client_site_id,cj.route_id,cj.crew_id,
  cj.job_id,cj.job_code,cj.job_name,cj.job_status,cj.visit_charge_total,cj.visit_cost_total,
  cj.snow_event_trigger_id,
  case
    when cj.job_id is null then 'no_linked_job'
    when exists(
      select 1 from public.job_sessions js
      where js.job_id=cj.job_id and js.session_date=cj.candidate_date
    ) then 'session_exists'
    else 'ready'
  end as scheduler_status
from candidate_jobs cj;
revoke all on table public.v_service_execution_scheduler_candidates from public,anon,authenticated;
grant select on table public.v_service_execution_scheduler_candidates to service_role;

create or replace view public.v_service_execution_scheduler_summary
with (security_invoker=true)
as
select
  count(*)::int as total_candidate_count,
  count(*) filter(where scheduler_status='ready')::int as ready_candidate_count,
  count(*) filter(where scheduler_status='session_exists')::int as session_exists_count,
  count(*) filter(where scheduler_status='no_linked_job')::int as no_linked_job_count,
  count(*) filter(where candidate_kind='service_session')::int as session_candidate_count,
  count(*) filter(where candidate_kind in ('visit_invoice','snow_invoice'))::int as invoice_candidate_count
from public.v_service_execution_scheduler_candidates;
revoke all on table public.v_service_execution_scheduler_summary from public,anon,authenticated;
grant select on table public.v_service_execution_scheduler_summary to service_role;

insert into public.app_module_write_contracts(
  action_key,owner_module,minimum_access,boundary_mode,domain_key,event_key,cross_module_event,is_enabled,description
) values
  ('recurring_service_program_save','jobs','approve','write','recurring_service','jobs.recurring_service.program_saved',false,true,'Create or update a recurring lawn/yard maintenance program.'),
  ('recurring_service_visit_event','jobs','approve','write','recurring_service','jobs.recurring_service.visit_event_recorded',false,true,'Record skip, weather delay, make-up, customer hold/resume or visit cancellation evidence.')
on conflict(action_key) do update set
  owner_module=excluded.owner_module,
  minimum_access=excluded.minimum_access,
  boundary_mode=excluded.boundary_mode,
  domain_key=excluded.domain_key,
  event_key=excluded.event_key,
  cross_module_event=excluded.cross_module_event,
  is_enabled=excluded.is_enabled,
  description=excluded.description,
  updated_at=now();

create or replace function public.ywi_module_write_boundary_security_assertions()
returns table(assertion_key text, assertion_status text, details text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'operations_action_contract_count',
    case when (select count(*) from public.app_module_write_contracts where is_enabled)=39 then 'passed' else 'failed' end,
    'Exactly 39 explicitly handled operations-manage actions have enabled write-boundary contracts.'
  union all
  select 'cross_module_events_named',
    case when not exists (
      select 1 from public.app_module_write_contracts
      where is_enabled and cross_module_event and event_key is null
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

create or replace function public.ywi_recurring_service_security_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'recurring_agreement_rls_enabled',
    case when coalesce((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='recurring_service_agreements'),false)
      then 'passed' else 'failed' end,
    'Canonical recurring_service_agreements keeps RLS enabled.'
  union all
  select 'recurring_agreement_browser_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public' and table_name='recurring_service_agreements'
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Recurring agreement writes are server-authorized rather than browser-direct.'
  union all
  select 'recurring_visit_events_private',
    case when coalesce((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='recurring_service_visit_events'),false)
      and not exists(
        select 1 from information_schema.table_privileges
        where table_schema='public' and table_name='recurring_service_visit_events'
          and grantee in ('anon','authenticated','PUBLIC')
      ) then 'passed' else 'failed' end,
    'Skip/delay/make-up/hold/cancellation evidence is private and RLS-protected.'
  union all
  select 'recurring_views_browser_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('v_recurring_service_visit_schedule','v_recurring_service_program_directory','v_service_agreement_execution_candidates','v_service_execution_scheduler_candidates')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Recurring program and scheduler read models are server-only.'
  union all
  select 'recurring_rpcs_browser_private',
    case when not exists(
      select 1 from information_schema.routine_privileges
      where specific_schema='public'
        and routine_name in ('ywi_rpc_recurring_program_save','ywi_rpc_recurring_visit_event')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Recurring program mutation RPCs are callable only through server authority.'
  union all
  select 'recurring_actions_registered',
    case when (select count(*) from public.app_module_write_contracts
      where action_key in ('recurring_service_program_save','recurring_service_visit_event')
        and owner_module='jobs' and minimum_access='approve' and boundary_mode='write' and is_enabled)=2
      then 'passed' else 'failed' end,
    'Program save and visit-event writes are explicit Jobs-approve contracts.'
  union all
  select 'recurring_scheduler_reuses_existing_authority',
    case when exists(select 1 from information_schema.views where table_schema='public' and table_name='v_service_execution_scheduler_candidates')
      and exists(select 1 from information_schema.tables where table_schema='public' and table_name='job_sessions')
      then 'passed' else 'failed' end,
    'Build 322 feeds the existing service execution scheduler and job-session authority.'
  union all
  select 'finance_provider_execution_off',
    case when not exists(
      select 1 from public.finance_job_completion_posting_execution_controls
      where execution_enabled=true or provider_mutation_enabled=true
    ) then 'passed' else 'failed' end,
    'Build 322 does not enable Finance posting or payment-provider mutation.';
$$;
revoke all on function public.ywi_recurring_service_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_recurring_service_security_assertions() to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  211,'211_recurring_lawn_yard_maintenance',
  'Adds recurrence-aware lawn/yard programs, seasonal windows, private visit events, hold/resume controls and scheduler-ready occurrence generation.',
  'applied',now(),'schema211',
  'Extends recurring_service_agreements and the existing service-execution scheduler; Jobs/dispatch/customer/Finance sources remain authoritative.',
  '211_recurring_lawn_yard_maintenance.sql','schema211'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true)
as
select
  211 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=211 then 'current'
    when coalesce(max(schema_version) filter(where status='applied'),0)>211 then 'ahead'
    else 'drift'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=211 then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter(where status='applied'),0)>211 then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
