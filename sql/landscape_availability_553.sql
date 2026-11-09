-- YW 553: owner-scoped landscaping service-area and dated crew-capacity evidence.
-- Source prerequisites: YW 552 request queue, 422 owner gate and 435 original
-- dispatch/resource review. All results remain advisory; no reservation writes.
create table if not exists public.ywi_landscape_service_areas_553 (
  company_id uuid not null references public.ywi_companies(id) on delete restrict,
  area_key text not null check (area_key = lower(btrim(area_key))
    and area_key ~ '^[a-z0-9][a-z0-9 .''-]{1,79}$'),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 120),
  coverage_state text not null check (coverage_state in ('included','excluded')),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(company_id,area_key)
);
create table if not exists public.ywi_landscape_capacity_plans_553 (
  company_id uuid not null references public.ywi_companies(id) on delete restrict,
  service_date date not null,
  crew_count integer not null check (crew_count between 1 and 30),
  capacity_minutes integer not null check (capacity_minutes between 0 and 21600),
  review_note text not null default '' check (char_length(review_note) <= 500),
  updated_at timestamptz not null default now(),
  primary key(company_id,service_date),
  check (capacity_minutes <= crew_count * 720)
);
create index if not exists ywi_landscape_capacity_plans_553_by_date
 on public.ywi_landscape_capacity_plans_553(service_date,company_id);

alter table public.ywi_landscape_service_areas_553 enable row level security;
alter table public.ywi_landscape_capacity_plans_553 enable row level security;
revoke all on public.ywi_landscape_service_areas_553 from public,anon,authenticated;
revoke all on public.ywi_landscape_capacity_plans_553 from public,anon,authenticated;
grant select on public.ywi_landscape_service_areas_553 to authenticated;
grant select on public.ywi_landscape_capacity_plans_553 to authenticated;
grant insert(company_id,area_key,display_name,coverage_state,active)
 on public.ywi_landscape_service_areas_553 to authenticated;
grant update(display_name,coverage_state,active)
 on public.ywi_landscape_service_areas_553 to authenticated;
grant insert(company_id,service_date,crew_count,capacity_minutes,review_note)
 on public.ywi_landscape_capacity_plans_553 to authenticated;
grant update(crew_count,capacity_minutes,review_note)
 on public.ywi_landscape_capacity_plans_553 to authenticated;

drop policy if exists ywi_landscape_area_owner_read_553 on public.ywi_landscape_service_areas_553;
create policy ywi_landscape_area_owner_read_553 on public.ywi_landscape_service_areas_553
 for select to authenticated using ((select auth.uid()) is not null
 and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
 and exists (select 1 from public.ywi_companies c where c.id=company_id and c.owner_user_id=(select auth.uid())));
drop policy if exists ywi_landscape_area_owner_insert_553 on public.ywi_landscape_service_areas_553;
create policy ywi_landscape_area_owner_insert_553 on public.ywi_landscape_service_areas_553
 for insert to authenticated with check ((select auth.uid()) is not null
 and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
 and exists (select 1 from public.ywi_companies c where c.id=company_id and c.owner_user_id=(select auth.uid())));
drop policy if exists ywi_landscape_area_owner_update_553 on public.ywi_landscape_service_areas_553;
create policy ywi_landscape_area_owner_update_553 on public.ywi_landscape_service_areas_553
 for update to authenticated
 using ((select auth.uid()) is not null
  and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
  and exists (select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())))
 with check ((select auth.uid()) is not null
  and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
  and exists (select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));
drop policy if exists ywi_landscape_capacity_owner_read_553 on public.ywi_landscape_capacity_plans_553;
create policy ywi_landscape_capacity_owner_read_553 on public.ywi_landscape_capacity_plans_553
 for select to authenticated using ((select auth.uid()) is not null
 and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
 and exists (select 1 from public.ywi_companies c where c.id=company_id and c.owner_user_id=(select auth.uid())));
drop policy if exists ywi_landscape_capacity_owner_insert_553 on public.ywi_landscape_capacity_plans_553;
create policy ywi_landscape_capacity_owner_insert_553 on public.ywi_landscape_capacity_plans_553
 for insert to authenticated with check ((select auth.uid()) is not null
 and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
 and exists (select 1 from public.ywi_companies c where c.id=company_id and c.owner_user_id=(select auth.uid())));
drop policy if exists ywi_landscape_capacity_owner_update_553 on public.ywi_landscape_capacity_plans_553;
create policy ywi_landscape_capacity_owner_update_553 on public.ywi_landscape_capacity_plans_553
 for update to authenticated
 using ((select auth.uid()) is not null
  and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
  and exists (select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())))
 with check ((select auth.uid()) is not null
  and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
  and exists (select 1 from public.ywi_companies c
  where c.id=company_id and c.owner_user_id=(select auth.uid())));

create or replace function public.ywi_landscape_plan_touch_553()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if old.company_id is distinct from new.company_id then
      raise exception 'YW553 company identity is immutable';
    end if;
    if tg_table_name='ywi_landscape_service_areas_553' then
      if old.area_key is distinct from new.area_key then
        raise exception 'YW553 area key is immutable';
      end if;
    else
      if old.service_date is distinct from new.service_date then
        raise exception 'YW553 capacity plan date is immutable';
      end if;
    end if;
  end if;
  new.updated_at=now();
  return new;
end $$;
drop trigger if exists ywi_landscape_area_touch_553 on public.ywi_landscape_service_areas_553;
create trigger ywi_landscape_area_touch_553 before insert or update on public.ywi_landscape_service_areas_553
 for each row execute function public.ywi_landscape_plan_touch_553();
drop trigger if exists ywi_landscape_capacity_touch_553 on public.ywi_landscape_capacity_plans_553;
create trigger ywi_landscape_capacity_touch_553 before insert or update on public.ywi_landscape_capacity_plans_553
 for each row execute function public.ywi_landscape_plan_touch_553();
revoke all on function public.ywi_landscape_plan_touch_553() from public,anon,authenticated;

-- This RPC reads the original 435 company-scoped Dispatch and resource proof,
-- rather than re-implementing its tenant or resource authority.
create or replace function public.ywi_rpc_landscape_availability_553(
 p_company_id uuid,p_request_id uuid,p_review_date date default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_request public.ywi_landscape_booking_requests_552%rowtype;
 v_area public.ywi_landscape_service_areas_553%rowtype;
 v_plan public.ywi_landscape_capacity_plans_553%rowtype;
 v_day date;
 v_start timestamptz;
 v_end timestamptz;
 v_area_key text;
 v_area_state text := 'unknown';
 v_schedule_state text := 'unavailable';
 v_weather_state text := 'unverified';
 v_capacity_state text := 'unknown';
 v_result_state text := 'unknown';
 v_source jsonb;
 v_dispatch_count integer := 0;
 v_routed_dispatch_count integer := 0;
 v_scheduled_minutes integer := 0;
 v_missing_assignment_count integer := 0;
 v_not_ready_assets integer := 0;
 v_weather_count integer := 0;
 v_weather_restricted boolean := false;
 v_remaining integer;
 v_reasons jsonb := '[]'::jsonb;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select * into v_request from public.ywi_landscape_booking_requests_552
  where id=p_request_id and company_id=p_company_id;
 if not found then raise exception 'YW553 owner-scoped request not available'; end if;
 v_day:=coalesce(p_review_date,v_request.requested_date);
 v_area_key:=lower(regexp_replace(btrim(v_request.service_area),'\s+',' ','g'));
 select * into v_area from public.ywi_landscape_service_areas_553
  where company_id=p_company_id and area_key=v_area_key and active is true;
 if found then v_area_state:=v_area.coverage_state; end if;
 if v_area_state='excluded' then
  v_reasons:=v_reasons||jsonb_build_array('Owner area rule excludes the exact requested area');
 elsif v_area_state='unknown' then
  v_reasons:=v_reasons||jsonb_build_array('No exact company coverage rule; review town and property location manually');
 end if;
 if v_day is null then
  v_reasons:=v_reasons||jsonb_build_array('Customer supplied no date; an owner must choose a proposed service date');
 elsif v_day<(now() at time zone 'America/Toronto')::date or
       v_day>(now() at time zone 'America/Toronto')::date+180 then
  v_schedule_state:='out_of_horizon';
  v_reasons:=v_reasons||jsonb_build_array('Date is outside the original 435 schedule verification horizon');
 else
  v_start:=(v_day::timestamp at time zone 'America/Toronto');
  v_end:=((v_day+1)::timestamp at time zone 'America/Toronto');
  select * into v_plan from public.ywi_landscape_capacity_plans_553
   where company_id=p_company_id and service_date=v_day;
  if not found then
   v_reasons:=v_reasons||jsonb_build_array('No owner-declared crew minutes for this date');
  elsif v_plan.updated_at<now()-interval '14 days' then
   v_reasons:=v_reasons||jsonb_build_array('Owner capacity plan is stale; refresh before relying on it');
  end if;
  begin
   v_source:=public.ywi_rpc_shared_capacity_review_435(p_company_id,v_start,v_end);
   if v_source->>'company_id'=p_company_id::text
     and v_source->>'canonical_source'='original_dispatch_fleet_equipment_material_423_435'
     and v_source->>'sources_complete'='true' and v_source->>'company_scope_only'='true' then
     v_schedule_state:='company_dispatch_verified';
     select count(*)::integer,
       coalesce(sum(ceil(extract(epoch from
         least((d->>'end')::timestamptz,v_end)-greatest((d->>'start')::timestamptz,v_start))/60)),0)::integer,
       count(*) filter(where nullif(d->>'crew_id','') is null
         or jsonb_array_length(coalesce(d->'crew_member_ids','[]'::jsonb))=0)::integer
      into v_dispatch_count,v_scheduled_minutes,v_missing_assignment_count
      from jsonb_array_elements(v_source->'dispatches') d
      where lower(coalesce(d->>'status','')) not in ('cancelled','canceled');
     select count(*)::integer into v_routed_dispatch_count
       from public.dispatch_schedule_items d
       join public.work_orders w on w.id=d.work_order_id and w.company_id=p_company_id
       where d.scheduled_start<v_end and d.scheduled_end>v_start
         and d.route_id is not null
         and lower(coalesce(d.schedule_status,'')) not in ('cancelled','canceled');
     select count(*)::integer into v_not_ready_assets
      from jsonb_array_elements(v_source->'dispatches') d,
       lateral jsonb_array_elements(coalesce(d->'assets','[]'::jsonb)) a
      where coalesce((a->>'locked_out')::boolean,false) is true
        or lower(coalesce(a->>'status','')) ~ '(lockout|out.of.service|maintenance|unavailable)'
        or lower(coalesce(a->>'fleet_status','')) ~ '(blocked|unavailable|out.of.service)';
   end if;
  exception when others then
   v_schedule_state:='unavailable';
  end;
  select count(distinct o.id)::integer,
   coalesce(bool_or(lower(coalesce(wd.workability_state,'')) ~ '(blocked|unsafe|hold|restricted|stop|no.go)'
    or lower(coalesce(o.lightning_storm_state,'')) ~ '(active|severe|unsafe)'
    or lower(coalesce(o.freezing_rain_ice_state,'')) ~ '(active|severe|unsafe)'),false)
   into v_weather_count,v_weather_restricted
   from public.workability_observations o
   join public.dispatch_schedule_items d on d.id=o.dispatch_schedule_item_id
   join public.work_orders w on w.id=d.work_order_id and w.company_id=p_company_id
   left join public.workability_decisions wd on wd.observation_id=o.id
   where o.service_date=v_day;
  if v_weather_restricted then v_weather_state:='restricted';
  elsif v_weather_count>0 then v_weather_state:='observed_not_cleared';
  end if;
  if v_plan.company_id is not null and v_schedule_state='company_dispatch_verified' then
   v_remaining:=greatest(0,v_plan.capacity_minutes-v_scheduled_minutes);
   if v_scheduled_minutes>=v_plan.capacity_minutes then v_capacity_state:='exhausted';
   elsif v_plan.updated_at<now()-interval '14 days' then v_capacity_state:='stale';
   else v_capacity_state:='potential_headroom'; end if;
  end if;
 end if;
 if v_schedule_state<>'company_dispatch_verified' then
  v_reasons:=v_reasons||jsonb_build_array('Original company dispatch evidence unavailable or outside bounded review');
 end if;
 if v_missing_assignment_count>0 then
  v_reasons:=v_reasons||jsonb_build_array('Original dispatch has missing crew/member assignment evidence');
 end if;
 if v_not_ready_assets>0 then
  v_reasons:=v_reasons||jsonb_build_array('Original assigned equipment has a lockout or not-ready status');
 end if;
 if v_weather_state='restricted' then
  v_reasons:=v_reasons||jsonb_build_array('Company-linked workability evidence restricts this date');
 else
  v_reasons:=v_reasons||jsonb_build_array('Weather and site safety require a fresh human check before scheduling');
 end if;
 if v_area_state='excluded' or v_capacity_state='exhausted' or
    v_weather_state='restricted' or v_not_ready_assets>0 then
  v_result_state:='hold';
 elsif v_area_state='included' and v_capacity_state='potential_headroom'
   and v_schedule_state='company_dispatch_verified' then
  v_result_state:='review';
 end if;
 v_reasons:=v_reasons||jsonb_build_array('No crew, route, equipment, appointment, customer message or payment was committed');
 return jsonb_build_object(
  'company_id',p_company_id,'request_id',p_request_id,'requested_date',v_request.requested_date,
  'review_date',v_day,'review_matches_customer_date',v_day=v_request.requested_date,
  'coverage_state',v_area_state,'schedule_state',v_schedule_state,
  'capacity_state',v_capacity_state,'availability_state',v_result_state,
  'owner_crew_count',v_plan.crew_count,'declared_crew_minutes',v_plan.capacity_minutes,
  'capacity_plan_updated_at',v_plan.updated_at,'scheduled_minutes',v_scheduled_minutes,
  'remaining_minutes_advisory',v_remaining,'original_dispatch_count',v_dispatch_count,
  'routed_dispatch_count',v_routed_dispatch_count,'missing_crew_assignment_count',v_missing_assignment_count,
  'not_ready_asset_count',v_not_ready_assets,'weather_observation_count',v_weather_count,
  'weather_state',v_weather_state,'reasons',v_reasons,'evaluated_at',now(),
  'source','company_owner_553_plus_original_dispatch_435','company_scope_only',true,
  'advisory_only',true,'availability_confirmed',false,'dispatch_authorized',false,
  'no_business_writes',true);
end $$;
revoke all on function public.ywi_rpc_landscape_availability_553(uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_availability_553(uuid,uuid,date) to authenticated;
comment on function public.ywi_rpc_landscape_availability_553(uuid,uuid,date) is
 'YW553 owner+Jobs-read company-scoped advisory request/date validation; original 435 dispatch proof; never confirms a booking.';
