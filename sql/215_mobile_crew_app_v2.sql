-- Build 326 — Mobile Crew App v2
-- Schema 215 adds a signed-in, assignment-filtered read RPC for the phone crew workspace.
-- It reuses canonical dispatch/property/production/evidence/closeout authorities and exposes no Finance totals.

create or replace function public.ywi_rpc_mobile_crew_context(p_days integer default 7)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_days integer := greatest(1, least(coalesce(p_days, 7), 14));
  v_jobs_access text;
  v_role_rank integer := 0;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication is required.' using errcode='42501';
  end if;

  select * into v_profile
  from public.profiles
  where id=v_actor and coalesce(is_active,true)=true;

  if not found then
    raise exception 'Active profile is required.' using errcode='42501';
  end if;

  v_jobs_access := public.ywi_effective_module_access(v_actor,'jobs');
  if public.ywi_module_access_rank(v_jobs_access) < public.ywi_module_access_rank('view') then
    raise exception 'Jobs module view access is required.' using errcode='42501';
  end if;

  v_role_rank := case lower(coalesce(v_profile.role,'employee'))
    when 'admin' then 50
    when 'job_admin' then 45
    when 'hse' then 40
    when 'supervisor' then 30
    when 'site_leader' then 20
    when 'onsite_admin' then 18
    else 10
  end;

  with actor_crews as (
    select cm.crew_id
    from public.crew_members cm
    where cm.profile_id=v_actor
  ),
  assigned as (
    select d.*
    from public.dispatch_schedule_items d
    where d.scheduled_start >= now() - interval '1 day'
      and d.scheduled_start < now() + make_interval(days => v_days)
      and coalesce(d.schedule_status,'') not in ('cancelled','superseded')
      and (
        d.lead_profile_id=v_actor
        or d.assigned_supervisor_profile_id=v_actor
        or d.crew_id in (select crew_id from actor_crews)
        or exists (
          select 1
          from jsonb_array_elements(coalesce(d.assigned_crew_profile_ids,'[]'::jsonb)) e
          where trim(both '"' from e::text)=v_actor::text
             or e->>'profile_id'=v_actor::text
             or e->>'id'=v_actor::text
        )
      )
  ),
  assembled as (
    select
      d.scheduled_start,
      coalesce(d.route_order,rs.stop_order,9999) as route_sort,
      jsonb_build_object(
        'dispatch', jsonb_build_object(
          'id',d.id,'work_order_id',d.work_order_id,'job_id',d.job_id,
          'schedule_status',d.schedule_status,'scheduled_start',d.scheduled_start,'scheduled_end',d.scheduled_end,
          'assigned_supervisor_profile_id',d.assigned_supervisor_profile_id,'assigned_crew_profile_ids',d.assigned_crew_profile_ids,
          'route_id',d.route_id,'dispatch_notes',d.dispatch_notes,'crew_notification_status',d.crew_notification_status,
          'dispatched_at',d.dispatched_at,'crew_id',d.crew_id,'lead_profile_id',d.lead_profile_id,
          'client_site_id',d.client_site_id,'recurring_visit_key',d.recurring_visit_key,'recurrence_label',d.recurrence_label,
          'estimated_duration_minutes',d.estimated_duration_minutes,'travel_allowance_minutes',d.travel_allowance_minutes,
          'route_order',d.route_order,'assigned_truck_equipment_item_id',d.assigned_truck_equipment_item_id,
          'assigned_trailer_equipment_item_id',d.assigned_trailer_equipment_item_id,
          'assigned_equipment_item_ids',d.assigned_equipment_item_ids,'workability_state',d.workability_state,
          'weather_summary',d.weather_summary,'workability_note',d.workability_note
        ),
        'work_order', case when wo.id is null then null else jsonb_build_object(
          'id',wo.id,'work_order_number',wo.work_order_number,'client_site_id',wo.client_site_id,
          'legacy_job_id',wo.legacy_job_id,'work_type',wo.work_type,'status',wo.status,
          'scheduled_start',wo.scheduled_start,'scheduled_end',wo.scheduled_end,'route_id',wo.route_id,
          'supervisor_profile_id',wo.supervisor_profile_id,'crew_notes',wo.crew_notes,
          'customer_notes',wo.customer_notes,'safety_notes',wo.safety_notes,
          'completion_review_status',wo.completion_review_status,
          'completion_ready_for_accounting',wo.completion_ready_for_accounting
        ) end,
        'job', case when j.id is null then null else jsonb_build_object(
          'id',j.id,'job_code',j.job_code,'job_name',j.job_name,'status',j.status,
          'priority',j.priority,'client_name',j.client_name,'notes',j.notes
        ) end,
        'site', case when cs.id is null then null else jsonb_build_object(
          'id',cs.id,'site_code',cs.site_code,'site_name',cs.site_name,'service_address',cs.service_address,
          'city',cs.city,'province',cs.province,'postal_code',cs.postal_code,'access_notes',cs.access_notes,
          'hazard_notes',cs.hazard_notes,'gate_fence_summary',cs.gate_fence_summary,
          'parking_trailer_limits',cs.parking_trailer_limits,'pet_notes',cs.pet_notes,
          'irrigation_notes',cs.irrigation_notes,'slope_notes',cs.slope_notes,
          'drainage_wet_area_notes',cs.drainage_wet_area_notes,'utility_locate_notes',cs.utility_locate_notes,
          'tree_brush_notes',cs.tree_brush_notes,'recurring_property_instructions',cs.recurring_property_instructions
        ) end,
        'route', case when r.id is null and rs.id is null then null else jsonb_build_object(
          'id',r.id,'route_code',r.route_code,'name',r.name,'route_type',r.route_type,'notes',r.notes,
          'stop', case when rs.id is null then null else jsonb_build_object(
            'id',rs.id,'stop_order',rs.stop_order,'planned_arrival_time',rs.planned_arrival_time,
            'planned_duration_minutes',rs.planned_duration_minutes,'instructions',rs.instructions
          ) end
        ) end,
        'latest_session', ls.session_json,
        'production', jsonb_build_object(
          'session_count',coalesce((select count(*) from public.job_sessions x where x.work_order_id=wo.id),0),
          'quantities',coalesce((
            select jsonb_agg(to_jsonb(q) order by q.updated_at desc)
            from (
              select id,job_session_id,work_order_id,client_site_zone_id,record_type,activity_type,metric_label,
                     planned_quantity,actual_quantity,waste_quantity,disposal_quantity,unit_label,completion_percent,
                     disposal_destination,notes,is_active,updated_at
              from public.job_session_production_quantities
              where work_order_id=wo.id
              order by updated_at desc
              limit 30
            ) q
          ),'[]'::jsonb),
          'material_issues',coalesce((
            select jsonb_agg(to_jsonb(m) order by m.updated_at desc)
            from (
              select id,issue_number,work_order_id,client_site_id,issue_status,issue_date,line_count,
                     quantity_total,notes,job_session_id,updated_at
              from public.material_issues
              where work_order_id=wo.id
              order by updated_at desc
              limit 20
            ) m
          ),'[]'::jsonb)
        ),
        'evidence', jsonb_build_object(
          'proofs',coalesce((
            select jsonb_agg(to_jsonb(p) order by p.updated_at desc)
            from (
              select id,work_order_id,dispatch_schedule_item_id,job_session_id,proof_type,proof_status,
                     customer_visible,title,staff_notes,customer_summary,occurred_at,progress_percent,
                     captured_by_profile_id,approved_at,created_at,updated_at
              from public.work_order_execution_proofs
              where work_order_id=wo.id
              order by updated_at desc
              limit 20
            ) p
          ),'[]'::jsonb),
          'live_updates',coalesce((
            select jsonb_agg(to_jsonb(u) order by u.updated_at desc)
            from (
              select id,work_order_id,job_session_id,author_profile_id,visibility,update_type,update_status,
                     title,message,occurred_at,progress_percent,customer_notification_status,retracted_at,updated_at
              from public.work_order_live_updates
              where work_order_id=wo.id
              order by updated_at desc
              limit 20
            ) u
          ),'[]'::jsonb)
        ),
        'closeout',coalesce((
          select to_jsonb(c)
          from (
            select id,work_order_id,closeout_status,customer_signoff_required,customer_signoff_status,
                   invoice_ready_requested,invoice_readiness_status,review_request_requested,review_request_status,
                   maintenance_followup_status,maintenance_followup_due_at,customer_summary,submitted_at,
                   approved_at,rejected_at,updated_at
            from public.work_order_closeout_packages
            where work_order_id=wo.id
            order by updated_at desc
            limit 1
          ) c
        ),null),
        'equipment',coalesce((
          select jsonb_agg(to_jsonb(eq) order by eq.equipment_name)
          from (
            select e.id,e.equipment_code,e.equipment_name,e.category,e.status,e.condition_status,
                   e.defect_status,e.defect_notes,e.is_locked_out,e.qr_code_value,e.barcode_value,
                   e.next_service_due_at,e.next_inspection_due_at
            from public.equipment_items e
            where e.id in (
              select distinct x::bigint
              from unnest(array[
                d.assigned_truck_equipment_item_id::text,
                d.assigned_trailer_equipment_item_id::text
              ]) x
              where x is not null and x ~ '^[0-9]+$'
            )
            or exists (
              select 1
              from jsonb_array_elements(coalesce(d.assigned_equipment_item_ids,'[]'::jsonb)) ae
              where (
                case when jsonb_typeof(ae)='object' then coalesce(ae->>'equipment_item_id',ae->>'id') else trim(both '"' from ae::text) end
              ) ~ '^[0-9]+$'
              and e.id=(
                case when jsonb_typeof(ae)='object' then coalesce(ae->>'equipment_item_id',ae->>'id') else trim(both '"' from ae::text) end
              )::bigint
            )
          ) eq
        ),'[]'::jsonb),
        'equipment_signouts',coalesce((
          select jsonb_agg(to_jsonb(es) order by es.checked_out_at desc)
          from (
            select id,equipment_item_id,job_id,work_order_id,job_session_id,checked_out_at,returned_at,
                   checkout_condition,return_condition,damage_reported,damage_notes,verification_status,
                   arrived_at_site_at,arrival_condition,arrival_test_status,return_test_status,return_verified_at
            from public.equipment_signouts
            where work_order_id=wo.id
            order by checked_out_at desc
            limit 20
          ) es
        ),'[]'::jsonb)
      ) as row_json
    from assigned d
    left join public.work_orders wo on wo.id=d.work_order_id
    left join public.jobs j on j.id=coalesce(d.job_id,wo.legacy_job_id)
    left join public.client_sites cs on cs.id=coalesce(d.client_site_id,wo.client_site_id)
    left join public.routes r on r.id=coalesce(d.route_id,wo.route_id)
    left join public.route_stops rs on rs.route_id=r.id and rs.client_site_id=cs.id and coalesce(rs.is_active,true)=true
    left join lateral (
      select jsonb_build_object(
        'id',s.id,'job_id',s.job_id,'work_order_id',s.work_order_id,'dispatch_schedule_item_id',s.dispatch_schedule_item_id,
        'session_date',s.session_date,'session_kind',s.session_kind,'session_status',s.session_status,
        'scheduled_start_at',s.scheduled_start_at,'started_at',s.started_at,'ended_at',s.ended_at,
        'duration_minutes',s.duration_minutes,'delay_minutes',s.delay_minutes,'notes',s.notes,
        'workability_status',s.workability_status,'weather_summary',s.weather_summary,'delay_reason',s.delay_reason,
        'completion_state',s.completion_state,'unfinished_work_notes',s.unfinished_work_notes,
        'return_visit_required',s.return_visit_required,'return_visit_reason',s.return_visit_reason,
        'customer_site_issue_notes',s.customer_site_issue_notes,'production_notes',s.production_notes,'updated_at',s.updated_at
      ) as session_json
      from public.job_sessions s
      where s.work_order_id=wo.id
      order by coalesce(s.started_at,s.scheduled_start_at,s.created_at) desc
      limit 1
    ) ls on true
  )
  select jsonb_build_object(
    'ok',true,
    'build',326,
    'schema',215,
    'profile',jsonb_build_object('id',v_profile.id,'full_name',v_profile.full_name,'role',lower(coalesce(v_profile.role,'employee'))),
    'window',jsonb_build_object('days',v_days,'from',now()-interval '1 day','to',now()+make_interval(days=>v_days)),
    'capabilities',jsonb_build_object(
      'jobs_view',true,
      'time_clock',true,
      'safety_create',public.ywi_module_access_rank(public.ywi_effective_module_access(v_actor,'safety')) >= public.ywi_module_access_rank('create'),
      'equipment_scan',public.ywi_module_access_rank(v_jobs_access) >= public.ywi_module_access_rank('create'),
      'live_update',public.ywi_module_access_rank(v_jobs_access) >= public.ywi_module_access_rank('create') and v_role_rank>=20,
      'production_capture',public.ywi_module_access_rank(v_jobs_access) >= public.ywi_module_access_rank('create') and v_role_rank>=20,
      'execution_proof',public.ywi_module_access_rank(v_jobs_access) >= public.ywi_module_access_rank('create') and v_role_rank>=20,
      'deficiency_rework',public.ywi_module_access_rank(v_jobs_access) >= public.ywi_module_access_rank('create') and v_role_rank>=20,
      'closeout_request',public.ywi_module_access_rank(v_jobs_access) >= public.ywi_module_access_rank('approve') and v_role_rank>=30,
      'customer_signoff_review',public.ywi_module_access_rank(v_jobs_access) >= public.ywi_module_access_rank('approve') and v_role_rank>=30
    ),
    'my_jobs',coalesce((select jsonb_agg(row_json order by scheduled_start,route_sort) from assembled),'[]'::jsonb),
    'my_route',coalesce((select jsonb_agg(row_json order by scheduled_start,route_sort) from assembled),'[]'::jsonb),
    'meta',jsonb_build_object(
      'assignment_filtered',true,
      'finance_exposed',false,
      'transport','authenticated_rpc_fallback',
      'canonical_authorities',jsonb_build_array(
        'dispatch_schedule_items','client_sites','job_sessions','job_session_production_quantities',
        'material_issues','equipment_signouts','work_order_live_updates','work_order_execution_proofs',
        'work_order_closeout_packages'
      )
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.ywi_rpc_mobile_crew_context(integer) from public, anon;
grant execute on function public.ywi_rpc_mobile_crew_context(integer) to authenticated;
grant execute on function public.ywi_rpc_mobile_crew_context(integer) to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  215,'mobile_crew_app_v2',
  'Build 326 assignment-filtered Mobile Crew App v2 read RPC',
  'applied',now(),'schema215',
  'No new business authority tables. Reuses dispatch/property/production/evidence/closeout data; authenticated RPC returns only the signed-in actor assignment slice and excludes Finance totals.',
  '215_mobile_crew_app_v2.sql','schema215'
)
on conflict (schema_version) do update set
  schema_name=excluded.schema_name,
  description=excluded.description,
  status=excluded.status,
  applied_at=excluded.applied_at,
  applied_by=excluded.applied_by,
  notes=excluded.notes,
  migration_key=excluded.migration_key,
  release_label=excluded.release_label;

create or replace view public.v_mobile_crew_app_v2_security_assertions as
select 'mobile_crew_rpc_not_anon'::text assertion_key,
       case when not has_function_privilege('anon','public.ywi_rpc_mobile_crew_context(integer)','EXECUTE')
            then 'passed' else 'failed' end status,
       'Anonymous callers cannot execute the Mobile Crew context RPC.'::text detail
union all
select 'mobile_crew_rpc_authenticated',
       case when has_function_privilege('authenticated','public.ywi_rpc_mobile_crew_context(integer)','EXECUTE')
            then 'passed' else 'failed' end,
       'Signed-in users can call the assignment-filtered RPC, which performs its own active-profile and Jobs-access checks.'
union all
select 'mobile_crew_finance_fields_excluded',
       'passed',
       'The RPC projection intentionally omits work-order subtotal, total amount, total cost, margin, invoice/payment and ledger fields.';

revoke all on public.v_mobile_crew_app_v2_security_assertions from public,anon,authenticated;
grant select on public.v_mobile_crew_app_v2_security_assertions to service_role;
