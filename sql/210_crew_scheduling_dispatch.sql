begin;

-- Schema 210 — Build 321 Crew Scheduling & Dispatch.
-- Extends the existing canonical dispatch authority. No parallel scheduler/source of truth is created.

alter table public.dispatch_schedule_items
  add column if not exists crew_id uuid references public.crews(id) on delete set null,
  add column if not exists lead_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists client_site_id uuid references public.client_sites(id) on delete set null,
  add column if not exists recurring_visit_key text,
  add column if not exists recurrence_label text,
  add column if not exists estimated_duration_minutes integer,
  add column if not exists travel_allowance_minutes integer not null default 0,
  add column if not exists route_order integer,
  add column if not exists assigned_truck_equipment_item_id bigint references public.equipment_items(id) on delete set null,
  add column if not exists assigned_trailer_equipment_item_id bigint references public.equipment_items(id) on delete set null,
  add column if not exists assigned_equipment_item_ids jsonb not null default '[]'::jsonb,
  add column if not exists workability_state text not null default 'not_assessed',
  add column if not exists weather_summary text,
  add column if not exists workability_note text,
  add column if not exists schedule_reason text,
  add column if not exists reschedule_reason text,
  add column if not exists cancellation_reason text,
  add column if not exists supersedes_dispatch_id uuid references public.dispatch_schedule_items(id) on delete set null,
  add column if not exists conflict_override_note text;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='dispatch_schedule_items_duration_chk') then
    alter table public.dispatch_schedule_items
      add constraint dispatch_schedule_items_duration_chk
      check (estimated_duration_minutes is null or estimated_duration_minutes between 1 and 1440);
  end if;
  if not exists(select 1 from pg_constraint where conname='dispatch_schedule_items_travel_chk') then
    alter table public.dispatch_schedule_items
      add constraint dispatch_schedule_items_travel_chk
      check (travel_allowance_minutes between 0 and 720);
  end if;
  if not exists(select 1 from pg_constraint where conname='dispatch_schedule_items_route_order_chk') then
    alter table public.dispatch_schedule_items
      add constraint dispatch_schedule_items_route_order_chk
      check (route_order is null or route_order between 1 and 999);
  end if;
  if not exists(select 1 from pg_constraint where conname='dispatch_schedule_items_workability_chk') then
    alter table public.dispatch_schedule_items
      add constraint dispatch_schedule_items_workability_chk
      check (workability_state in ('not_assessed','workable','caution','delayed','blocked'));
  end if;
end $$;

create index if not exists dispatch_schedule_items_window_idx
  on public.dispatch_schedule_items(scheduled_start,scheduled_end)
  where schedule_status not in ('cancelled','superseded','completed');
create index if not exists dispatch_schedule_items_crew_window_idx
  on public.dispatch_schedule_items(crew_id,scheduled_start)
  where crew_id is not null and schedule_status not in ('cancelled','superseded','completed');
create index if not exists dispatch_schedule_items_route_order_idx
  on public.dispatch_schedule_items(route_id,scheduled_start,route_order)
  where route_id is not null and schedule_status not in ('cancelled','superseded','completed');
create index if not exists dispatch_schedule_items_supervisor_window_idx
  on public.dispatch_schedule_items(assigned_supervisor_profile_id,scheduled_start)
  where assigned_supervisor_profile_id is not null and schedule_status not in ('cancelled','superseded','completed');
create index if not exists dispatch_schedule_items_equipment_gin_idx
  on public.dispatch_schedule_items using gin(assigned_equipment_item_ids);

create or replace function public.ywi_dispatch_resource_keys(
  p_crew_id uuid,
  p_lead_profile_id uuid,
  p_supervisor_profile_id uuid,
  p_crew_profile_ids jsonb,
  p_truck_equipment_item_id bigint,
  p_trailer_equipment_item_id bigint,
  p_equipment_item_ids jsonb
)
returns text[]
language sql
immutable
security invoker
set search_path=public
as $$
  with keys as (
    select case when p_crew_id is null then null else 'crew:'||p_crew_id::text end as key
    union all select case when p_lead_profile_id is null then null else 'person:'||p_lead_profile_id::text end
    union all select case when p_supervisor_profile_id is null then null else 'person:'||p_supervisor_profile_id::text end
    union all select 'person:'||value from jsonb_array_elements_text(coalesce(p_crew_profile_ids,'[]'::jsonb))
    union all select case when p_truck_equipment_item_id is null then null else 'equipment:'||p_truck_equipment_item_id::text end
    union all select case when p_trailer_equipment_item_id is null then null else 'equipment:'||p_trailer_equipment_item_id::text end
    union all select 'equipment:'||value from jsonb_array_elements_text(coalesce(p_equipment_item_ids,'[]'::jsonb))
  )
  select coalesce(array_agg(distinct key) filter(where key is not null and key<>''),array[]::text[]) from keys;
$$;
revoke all on function public.ywi_dispatch_resource_keys(uuid,uuid,uuid,jsonb,bigint,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.ywi_dispatch_resource_keys(uuid,uuid,uuid,jsonb,bigint,bigint,jsonb) to service_role;

create or replace view public.v_crew_dispatch_schedule
with (security_invoker=true)
as
with base as (
  select
    d.*,
    wo.work_order_number,
    wo.work_type,
    wo.status as work_order_status,
    wo.legacy_job_id,
    wo.client_id,
    coalesce(d.client_site_id,wo.client_site_id) as effective_client_site_id,
    coalesce(c.display_name,c.legal_name) as client_name,
    cs.site_name,
    cs.service_address,
    cs.city as site_city,
    j.job_code,
    j.job_name,
    cr.crew_code,
    cr.crew_name,
    lp.full_name as lead_name,
    sp.full_name as supervisor_name,
    r.route_code,
    r.name as route_name,
    tr.equipment_code as truck_code,
    tr.equipment_name as truck_name,
    tl.equipment_code as trailer_code,
    tl.equipment_name as trailer_name,
    public.ywi_dispatch_resource_keys(
      d.crew_id,d.lead_profile_id,d.assigned_supervisor_profile_id,d.assigned_crew_profile_ids,
      d.assigned_truck_equipment_item_id,d.assigned_trailer_equipment_item_id,d.assigned_equipment_item_ids
    ) as resource_keys
  from public.dispatch_schedule_items d
  left join public.work_orders wo on wo.id=d.work_order_id
  left join public.jobs j on j.id=coalesce(d.job_id,wo.legacy_job_id)
  left join public.clients c on c.id=wo.client_id
  left join public.client_sites cs on cs.id=coalesce(d.client_site_id,wo.client_site_id)
  left join public.crews cr on cr.id=d.crew_id
  left join public.profiles lp on lp.id=d.lead_profile_id
  left join public.profiles sp on sp.id=d.assigned_supervisor_profile_id
  left join public.routes r on r.id=d.route_id
  left join public.equipment_items tr on tr.id=d.assigned_truck_equipment_item_id
  left join public.equipment_items tl on tl.id=d.assigned_trailer_equipment_item_id
), conflicts as (
  select
    b.id,
    count(o.id)::integer as conflict_count,
    coalesce(jsonb_agg(jsonb_build_object(
      'dispatch_id',o.id,
      'work_order_number',o.work_order_number,
      'crew_name',o.crew_name,
      'scheduled_start',o.scheduled_start,
      'scheduled_end',o.scheduled_end,
      'shared_resources',to_jsonb(
        array(select unnest(b.resource_keys) intersect select unnest(o.resource_keys))
      )
    ) order by o.scheduled_start) filter(where o.id is not null),'[]'::jsonb) as conflicts_json
  from base b
  left join base o
    on o.id<>b.id
   and b.schedule_status not in ('cancelled','superseded','completed')
   and o.schedule_status not in ('cancelled','superseded','completed')
   and b.scheduled_start is not null and b.scheduled_end is not null
   and o.scheduled_start < b.scheduled_end and o.scheduled_end > b.scheduled_start
   and b.resource_keys && o.resource_keys
  group by b.id
)
select
  b.*,
  coalesce(cf.conflict_count,0) as conflict_count,
  coalesce(cf.conflicts_json,'[]'::jsonb) as conflicts_json,
  case
    when b.schedule_status in ('cancelled','superseded','completed') then 'historical'
    when b.workability_state='blocked' then 'workability_blocked'
    when coalesce(cf.conflict_count,0)>0 and coalesce(b.conflict_override_note,'')='' then 'conflict'
    when coalesce(cf.conflict_count,0)>0 then 'conflict_overridden'
    when b.workability_state in ('caution','delayed') then 'workability_review'
    else 'ready'
  end as dispatch_readiness
from base b
left join conflicts cf on cf.id=b.id;
revoke all on table public.v_crew_dispatch_schedule from public,anon,authenticated;
grant select on table public.v_crew_dispatch_schedule to service_role;

create or replace function public.ywi_rpc_dispatch_schedule_v2(
  p_work_order_id uuid,
  p_schedule_status text,
  p_scheduled_start timestamptz,
  p_scheduled_end timestamptz,
  p_crew_id uuid default null,
  p_lead_profile_id uuid default null,
  p_supervisor_profile_id uuid default null,
  p_assigned_crew_profile_ids jsonb default '[]'::jsonb,
  p_route_id uuid default null,
  p_client_site_id uuid default null,
  p_route_order integer default null,
  p_estimated_duration_minutes integer default null,
  p_travel_allowance_minutes integer default 0,
  p_truck_equipment_item_id bigint default null,
  p_trailer_equipment_item_id bigint default null,
  p_equipment_item_ids jsonb default '[]'::jsonb,
  p_recurring_visit_key text default null,
  p_recurrence_label text default null,
  p_workability_state text default 'not_assessed',
  p_weather_summary text default null,
  p_workability_note text default null,
  p_schedule_reason text default null,
  p_reschedule_reason text default null,
  p_cancellation_reason text default null,
  p_supersedes_dispatch_id uuid default null,
  p_conflict_override_note text default null,
  p_dispatch_notes text default null,
  p_actor_profile_id uuid default null
)
returns public.dispatch_schedule_items
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_row public.dispatch_schedule_items;
  v_work_order public.work_orders;
  v_crew public.crews;
  v_crew_profiles jsonb := coalesce(p_assigned_crew_profile_ids,'[]'::jsonb);
  v_lead uuid := p_lead_profile_id;
  v_supervisor uuid := p_supervisor_profile_id;
  v_route uuid := p_route_id;
  v_site uuid := p_client_site_id;
  v_status text := lower(coalesce(nullif(btrim(p_schedule_status),''),'scheduled'));
  v_workability text := lower(coalesce(nullif(btrim(p_workability_state),''),'not_assessed'));
  v_duration integer;
  v_keys text[];
  v_conflict_ids uuid[];
  v_equipment_ids bigint[];
begin
  select * into v_work_order from public.work_orders where id=p_work_order_id for update;
  if not found then raise exception 'Work order % does not exist.',p_work_order_id using errcode='23503'; end if;
  if v_work_order.legacy_job_id is null then raise exception 'Work order % must resolve to canonical jobs.id before scheduling.',p_work_order_id using errcode='23503'; end if;
  if v_status not in ('draft','scheduled','dispatched','rescheduled','cancelled') then
    raise exception 'Unsupported dispatch schedule status %.',v_status using errcode='23514';
  end if;
  if p_scheduled_start is null or p_scheduled_end is null or p_scheduled_end<=p_scheduled_start then
    raise exception 'A valid scheduled_start and scheduled_end are required.' using errcode='22007';
  end if;
  if v_status='rescheduled' and coalesce(btrim(p_reschedule_reason),'')='' then
    raise exception 'A reschedule reason is required.' using errcode='23514';
  end if;
  if v_status='cancelled' and coalesce(btrim(p_cancellation_reason),'')='' then
    raise exception 'A cancellation reason is required.' using errcode='23514';
  end if;
  if v_workability not in ('not_assessed','workable','caution','delayed','blocked') then
    raise exception 'Unsupported workability state %.',v_workability using errcode='23514';
  end if;

  if p_crew_id is not null then
    select * into v_crew from public.crews where id=p_crew_id and crew_status not in ('inactive','archived');
    if not found then raise exception 'Selected crew is unavailable.' using errcode='23514'; end if;
    v_lead:=coalesce(v_lead,v_crew.lead_profile_id);
    v_supervisor:=coalesce(v_supervisor,v_crew.supervisor_profile_id);
    if jsonb_array_length(v_crew_profiles)=0 then
      select coalesce(jsonb_agg(cm.profile_id order by cm.is_primary desc,cm.created_at),'[]'::jsonb)
      into v_crew_profiles from public.crew_members cm where cm.crew_id=p_crew_id;
    end if;
  end if;

  v_route:=coalesce(v_route,v_work_order.route_id);
  v_site:=coalesce(v_site,v_work_order.client_site_id);
  v_duration:=coalesce(p_estimated_duration_minutes,greatest(1,ceil(extract(epoch from (p_scheduled_end-p_scheduled_start))/60.0)::integer));

  select coalesce(array_agg(distinct x::bigint),array[]::bigint[])
  into v_equipment_ids
  from (
    select p_truck_equipment_item_id::text as x where p_truck_equipment_item_id is not null
    union all select p_trailer_equipment_item_id::text where p_trailer_equipment_item_id is not null
    union all select value from jsonb_array_elements_text(coalesce(p_equipment_item_ids,'[]'::jsonb))
  ) e
  where x ~ '^[0-9]+$';

  if exists(
    select 1 from public.equipment_items ei
    where ei.id=any(v_equipment_ids)
      and (ei.is_locked_out=true or lower(coalesce(ei.status,'')) not in ('active','available','ready','in_service'))
  ) then
    raise exception 'One or more selected equipment items are locked out or unavailable.' using errcode='23514';
  end if;

  v_keys:=public.ywi_dispatch_resource_keys(
    p_crew_id,v_lead,v_supervisor,v_crew_profiles,p_truck_equipment_item_id,p_trailer_equipment_item_id,p_equipment_item_ids
  );

  select coalesce(array_agg(d.id),array[]::uuid[])
  into v_conflict_ids
  from public.dispatch_schedule_items d
  where d.schedule_status not in ('cancelled','superseded','completed')
    and d.scheduled_start < p_scheduled_end
    and d.scheduled_end > p_scheduled_start
    and (p_supersedes_dispatch_id is null or d.id<>p_supersedes_dispatch_id)
    and public.ywi_dispatch_resource_keys(
      d.crew_id,d.lead_profile_id,d.assigned_supervisor_profile_id,d.assigned_crew_profile_ids,
      d.assigned_truck_equipment_item_id,d.assigned_trailer_equipment_item_id,d.assigned_equipment_item_ids
    ) && v_keys;

  if cardinality(v_conflict_ids)>0 and coalesce(btrim(p_conflict_override_note),'')='' then
    raise exception 'Dispatch conflict detected with % existing schedule item(s); an explicit override note is required.',cardinality(v_conflict_ids) using errcode='23514';
  end if;

  if p_supersedes_dispatch_id is not null then
    update public.dispatch_schedule_items
    set schedule_status=case when v_status='cancelled' then 'cancelled' else 'superseded' end,
        updated_at=now()
    where id=p_supersedes_dispatch_id and work_order_id=p_work_order_id;
    if not found then raise exception 'The dispatch item being superseded does not belong to this work order.' using errcode='23514'; end if;
  end if;

  insert into public.dispatch_schedule_items(
    work_order_id,job_id,schedule_status,scheduled_start,scheduled_end,
    assigned_supervisor_profile_id,assigned_crew_profile_ids,route_id,dispatch_notes,
    customer_notification_status,crew_notification_status,dispatched_at,dispatched_by_profile_id,
    crew_id,lead_profile_id,client_site_id,recurring_visit_key,recurrence_label,
    estimated_duration_minutes,travel_allowance_minutes,route_order,
    assigned_truck_equipment_item_id,assigned_trailer_equipment_item_id,assigned_equipment_item_ids,
    workability_state,weather_summary,workability_note,schedule_reason,reschedule_reason,cancellation_reason,
    supersedes_dispatch_id,conflict_override_note
  ) values (
    p_work_order_id,v_work_order.legacy_job_id,v_status,p_scheduled_start,p_scheduled_end,
    v_supervisor,v_crew_profiles,v_route,p_dispatch_notes,
    'pending','pending',case when v_status='dispatched' then now() else null end,p_actor_profile_id,
    p_crew_id,v_lead,v_site,nullif(btrim(p_recurring_visit_key),''),nullif(btrim(p_recurrence_label),''),
    v_duration,greatest(0,coalesce(p_travel_allowance_minutes,0)),p_route_order,
    p_truck_equipment_item_id,p_trailer_equipment_item_id,coalesce(p_equipment_item_ids,'[]'::jsonb),
    v_workability,nullif(btrim(p_weather_summary),''),nullif(btrim(p_workability_note),''),
    nullif(btrim(p_schedule_reason),''),nullif(btrim(p_reschedule_reason),''),nullif(btrim(p_cancellation_reason),''),
    p_supersedes_dispatch_id,nullif(btrim(p_conflict_override_note),'')
  )
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.ywi_rpc_dispatch_schedule_v2(uuid,text,timestamptz,timestamptz,uuid,uuid,uuid,jsonb,uuid,uuid,integer,integer,integer,bigint,bigint,jsonb,text,text,text,text,text,text,text,text,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_dispatch_schedule_v2(uuid,text,timestamptz,timestamptz,uuid,uuid,uuid,jsonb,uuid,uuid,integer,integer,integer,bigint,bigint,jsonb,text,text,text,text,text,text,text,text,uuid,text,text,uuid) to service_role;

-- Preserve the existing atomic jobs.job_scheduled event path while reflecting cancellation truth.
create or replace function public.ywi_emit_job_scheduled()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
begin
  update public.work_orders
  set scheduled_start=new.scheduled_start,
      scheduled_end=new.scheduled_end,
      supervisor_profile_id=coalesce(new.assigned_supervisor_profile_id,supervisor_profile_id),
      route_id=coalesce(new.route_id,route_id),
      status=case when new.schedule_status='cancelled' then 'cancelled' else 'scheduled' end,
      updated_at=now()
  where id=new.work_order_id;

  if not found then
    raise exception 'Work order % disappeared during scheduling.',new.work_order_id using errcode='23503';
  end if;

  perform public.ywi_publish_cross_module_event(
    'jobs','jobs.job_scheduled','job',new.job_id::text,
    jsonb_build_object(
      'contract_version',2,
      'build',321,
      'schema',210,
      'dispatch_schedule_item_id',new.id,
      'work_order_id',new.work_order_id,
      'job_id',new.job_id,
      'schedule_status',new.schedule_status,
      'scheduled_start',new.scheduled_start,
      'scheduled_end',new.scheduled_end,
      'crew_id',new.crew_id,
      'lead_profile_id',new.lead_profile_id,
      'assigned_supervisor_profile_id',new.assigned_supervisor_profile_id,
      'assigned_crew_profile_ids',new.assigned_crew_profile_ids,
      'route_id',new.route_id,
      'route_order',new.route_order,
      'workability_state',new.workability_state,
      'supersedes_dispatch_id',new.supersedes_dispatch_id,
      'actor_profile_id',new.dispatched_by_profile_id
    ),
    'jobs.job_scheduled:dispatch:'||new.id::text,new.created_at
  );
  return new;
end;
$$;
revoke all on function public.ywi_emit_job_scheduled() from public,anon,authenticated;

create or replace function public.ywi_crew_dispatch_security_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'dispatch_rls_enabled',
    case when coalesce((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='dispatch_schedule_items'),false)
      then 'passed' else 'failed' end,
    'Canonical dispatch_schedule_items keeps RLS enabled.'
  union all
  select 'dispatch_view_browser_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public' and table_name='v_crew_dispatch_schedule'
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Crew scheduling read model is server-only and permission-filtered by the Edge Function.'
  union all
  select 'dispatch_rpc_browser_private',
    case when not exists(
      select 1 from information_schema.routine_privileges
      where specific_schema='public' and routine_name='ywi_rpc_dispatch_schedule_v2'
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Scheduling mutation RPC is callable only by server authority.'
  union all
  select 'dispatch_atomic_event_wiring',
    case when exists(select 1 from pg_trigger where tgrelid='public.dispatch_schedule_items'::regclass and tgname='trg_prepare_dispatch_job_schedule' and not tgisinternal)
      and exists(select 1 from pg_trigger where tgrelid='public.dispatch_schedule_items'::regclass and tgname='trg_emit_job_scheduled' and not tgisinternal)
      then 'passed' else 'failed' end,
    'Dispatch insert, work-order scheduling state and jobs.job_scheduled publication retain atomic trigger wiring.'
  union all
  select 'finance_provider_execution_off',
    case when not exists(
      select 1 from public.finance_job_completion_posting_execution_controls
      where execution_enabled=true or provider_mutation_enabled=true
    ) then 'passed' else 'failed' end,
    'Build 321 does not enable Finance posting or payment-provider mutation.';
$$;
revoke all on function public.ywi_crew_dispatch_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_crew_dispatch_security_assertions() to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  210,'210_crew_scheduling_dispatch',
  'Extends canonical dispatch scheduling with landscaping crew, equipment, route, recurrence, workability, conflict and reschedule/cancellation evidence.',
  'applied',now(),'schema210',
  'Uses existing Jobs/crew/equipment/work-order authorities and jobs.job_scheduled event wiring. No Finance/provider mutation.',
  '210_crew_scheduling_dispatch.sql','schema210'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true)
as
select
  210 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=210 then 'current'
    when coalesce(max(schema_version) filter(where status='applied'),0)>210 then 'ahead'
    else 'drift'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=210 then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter(where status='applied'),0)>210 then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
