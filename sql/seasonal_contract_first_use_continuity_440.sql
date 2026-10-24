-- YW 440: read-only, company-owner scoped seasonal/recurring provenance.
-- This is not a renewal, storm/dispatch, field completion or billing authority.
-- Earlier recurring agreements have no company_id. Only agreements CREATED by
-- the verified owner and matching BOTH original customer and property are shown.
begin;

create or replace function public.ywi_rpc_seasonal_continuity_440(
 p_company_id uuid,p_work_order_id uuid
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_order public.work_orders;
 v_agreements jsonb:='[]'::jsonb; v_visits jsonb:='[]'::jsonb;
 v_triggers jsonb:='[]'::jsonb; v_routes jsonb:='[]'::jsonb;
 v_count integer;v_enabled boolean;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 perform public.ywi_423_assert_order(p_company_id,p_work_order_id,false);
 select * into v_order from public.work_orders
 where id=p_work_order_id and company_id=p_company_id
  and service_module_key in ('landscape','snow_removal','snow_plowing');
 if not found then raise exception '440 original company lawn or snow order required'; end if;
 select enabled into v_enabled from public.ywi_company_service_modules
 where company_id=p_company_id and module_key=v_order.service_module_key;
 if v_enabled is null then raise exception '440 original company offering register missing'; end if;

 -- A property-name, date, contract title or same storm day is NEVER a join key.
 if v_order.client_id is not null and v_order.client_site_id is not null then
  select count(*) into v_count from public.recurring_service_agreements a
  where a.client_id=v_order.client_id and a.client_site_id=v_order.client_site_id
   and a.created_by_profile_id=(select auth.uid());
  if v_count>20 then raise exception '440 recurring agreements exceed owner-reviewed cap'; end if;
  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_agreements from (
   select a.id,a.agreement_code,a.service_name,a.client_id,a.client_site_id,
    a.route_id,a.agreement_status,a.billing_method,a.event_trigger_type,
    a.start_date,a.end_date,a.open_end_date,a.recurrence_frequency,
    a.created_at,a.updated_at
   from public.recurring_service_agreements a
   where a.client_id=v_order.client_id and a.client_site_id=v_order.client_site_id
    and a.created_by_profile_id=(select auth.uid())
   order by a.created_at desc,a.id limit 20
  ) x;
  select count(*) into v_count from public.recurring_service_visit_events e
  join public.recurring_service_agreements a on a.id=e.agreement_id
  where a.client_id=v_order.client_id and a.client_site_id=v_order.client_site_id
   and a.created_by_profile_id=(select auth.uid());
  if v_count>80 then raise exception '440 visit-change events exceed audited cap'; end if;
  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_visits from (
   select e.id,e.agreement_id,e.event_key,e.original_service_date,e.event_type,
    e.effective_service_date,e.workability_state,e.created_at
   from public.recurring_service_visit_events e
   join public.recurring_service_agreements a on a.id=e.agreement_id
   where a.client_id=v_order.client_id and a.client_site_id=v_order.client_site_id
    and a.created_by_profile_id=(select auth.uid())
   order by e.created_at desc,e.id limit 80
  ) x;
  select count(*) into v_count from public.snow_event_triggers t
  join public.recurring_service_agreements a on a.id=t.agreement_id
  where a.client_id=v_order.client_id and a.client_site_id=v_order.client_site_id
   and a.created_by_profile_id=(select auth.uid());
  if v_count>80 then raise exception '440 snow agreement triggers exceed audited cap'; end if;
  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_triggers from (
   select t.id,t.agreement_id,t.event_date,t.trigger_met,t.snowfall_cm,t.threshold_cm
   from public.snow_event_triggers t
   join public.recurring_service_agreements a on a.id=t.agreement_id
   where a.client_id=v_order.client_id and a.client_site_id=v_order.client_site_id
    and a.created_by_profile_id=(select auth.uid())
   order by t.event_date desc,t.id limit 80
  ) x;
 end if;
 select count(*) into v_count from public.dispatch_schedule_items d
 where d.work_order_id=p_work_order_id;
 if v_count>80 then raise exception '440 original dispatch route links exceed audited cap'; end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_routes from (
  select d.id as dispatch_id,d.route_id,d.client_site_id,d.schedule_status,d.dispatched_at
  from public.dispatch_schedule_items d where d.work_order_id=p_work_order_id
  order by d.created_at desc,d.id limit 80
 ) x;
 return jsonb_build_object('company_id',p_company_id,'work_order_id',p_work_order_id,
  'state','review_only','complete',true,'source_limit',80,
  'mutation_authorized',false,'automatic_renewal',false,'automatic_dispatch',false,
  'automatic_billing',false,'service_enabled_now',v_enabled,
  'order',jsonb_build_object('id',v_order.id,'service',v_order.service_module_key,
   'number',v_order.work_order_number,'client_id',v_order.client_id,
   'client_site_id',v_order.client_site_id,'status',v_order.status),
  'agreements',v_agreements,'visit_events',v_visits,
  'snow_triggers',v_triggers,'dispatch_routes',v_routes,
  'agreement_scope','owner_created_exact_customer_and_property_only');
end $$;
revoke all on function public.ywi_rpc_seasonal_continuity_440(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.ywi_rpc_seasonal_continuity_440(uuid,uuid) to authenticated;
comment on function public.ywi_rpc_seasonal_continuity_440(uuid,uuid) is
 'YW 440 conservative original contract/visit/storm provenance; owner and order asserted; legacy agreement identity is not company-authoritative.';
commit;
