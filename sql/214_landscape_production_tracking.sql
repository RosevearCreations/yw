begin;

-- Schema 214 — Build 325 Landscape Production Tracking
-- Extends canonical field-execution authorities. Build 325 does not create parallel
-- timekeeping, material, equipment, media, closeout, Finance, or payment systems.

alter table public.job_sessions
  alter column job_id drop not null,
  add column if not exists work_order_id uuid references public.work_orders(id) on delete cascade,
  add column if not exists dispatch_schedule_item_id uuid references public.dispatch_schedule_items(id) on delete set null,
  add column if not exists workability_status text not null default 'not_recorded',
  add column if not exists weather_summary text,
  add column if not exists delay_reason text,
  add column if not exists completion_state text not null default 'open',
  add column if not exists unfinished_work_notes text,
  add column if not exists return_visit_required boolean not null default false,
  add column if not exists return_visit_reason text,
  add column if not exists customer_site_issue_notes text,
  add column if not exists production_notes text,
  add column if not exists production_recorded_at timestamptz,
  add column if not exists production_recorded_by_profile_id uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='job_sessions_build325_identity_chk') then
    alter table public.job_sessions add constraint job_sessions_build325_identity_chk
      check (job_id is not null or work_order_id is not null);
  end if;
  if not exists(select 1 from pg_constraint where conname='job_sessions_workability_chk') then
    alter table public.job_sessions add constraint job_sessions_workability_chk
      check (workability_status in ('not_recorded','workable','restricted','delayed','stopped'));
  end if;
  if not exists(select 1 from pg_constraint where conname='job_sessions_completion_state_chk') then
    alter table public.job_sessions add constraint job_sessions_completion_state_chk
      check (completion_state in ('open','complete','partial','blocked','return_required'));
  end if;
  if not exists(select 1 from pg_constraint where conname='job_sessions_return_reason_chk') then
    alter table public.job_sessions add constraint job_sessions_return_reason_chk
      check (not return_visit_required or nullif(btrim(coalesce(return_visit_reason,'')),'') is not null);
  end if;
end $$;

create index if not exists job_sessions_work_order_idx
  on public.job_sessions(work_order_id,session_date desc,started_at desc)
  where work_order_id is not null;
create index if not exists job_sessions_dispatch_item_idx
  on public.job_sessions(dispatch_schedule_item_id)
  where dispatch_schedule_item_id is not null;
create index if not exists job_sessions_production_actor_idx
  on public.job_sessions(production_recorded_by_profile_id)
  where production_recorded_by_profile_id is not null;

alter table public.job_session_crew_hours
  alter column job_id drop not null,
  add column if not exists work_order_id uuid references public.work_orders(id) on delete cascade;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='job_session_crew_hours_build325_identity_chk') then
    alter table public.job_session_crew_hours add constraint job_session_crew_hours_build325_identity_chk
      check (job_id is not null or work_order_id is not null);
  end if;
end $$;

create index if not exists job_session_crew_hours_work_order_idx
  on public.job_session_crew_hours(work_order_id,created_at desc)
  where work_order_id is not null;

alter table public.material_issues
  add column if not exists job_session_id uuid references public.job_sessions(id) on delete set null;
create index if not exists material_issues_job_session_idx
  on public.material_issues(job_session_id,issue_date desc)
  where job_session_id is not null;

alter table public.equipment_signouts
  add column if not exists work_order_id uuid references public.work_orders(id) on delete set null,
  add column if not exists job_session_id uuid references public.job_sessions(id) on delete set null;
create index if not exists equipment_signouts_work_order_idx
  on public.equipment_signouts(work_order_id,checked_out_at desc)
  where work_order_id is not null;
create index if not exists equipment_signouts_job_session_idx
  on public.equipment_signouts(job_session_id,checked_out_at desc)
  where job_session_id is not null;

alter table public.work_order_execution_proofs
  add column if not exists job_session_id uuid references public.job_sessions(id) on delete set null;
create index if not exists work_order_execution_proofs_job_session_idx
  on public.work_order_execution_proofs(job_session_id,occurred_at desc)
  where job_session_id is not null;

alter table public.work_order_live_updates
  add column if not exists job_session_id uuid references public.job_sessions(id) on delete set null;
create index if not exists work_order_live_updates_job_session_idx
  on public.work_order_live_updates(job_session_id,occurred_at desc)
  where job_session_id is not null;

create table if not exists public.job_session_production_quantities (
  id uuid primary key default gen_random_uuid(),
  job_session_id uuid not null references public.job_sessions(id) on delete cascade,
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  client_site_zone_id uuid references public.client_site_zones(id) on delete set null,
  source_work_order_line_id uuid references public.work_order_lines(id) on delete set null,
  source_estimate_assumption_id uuid references public.estimate_workflow_assumptions(id) on delete set null,
  record_type text not null default 'production',
  activity_type text not null default 'other',
  metric_label text not null,
  planned_quantity numeric(14,4),
  actual_quantity numeric(14,4) not null default 0,
  waste_quantity numeric(14,4) not null default 0,
  disposal_quantity numeric(14,4) not null default 0,
  unit_label text,
  completion_percent numeric(7,2),
  disposal_destination text,
  notes text,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_session_production_quantities_record_type_chk
    check (record_type in ('production','disposal')),
  constraint job_session_production_quantities_activity_chk
    check (activity_type in (
      'mowing','edging','trimming','garden_bed','hedge_shrub','tree_brush','cleanup',
      'aeration','fertilizing','seeding','sod','planting','mulch','soil','gravel_stone',
      'disposal','snow_ice','other'
    )),
  constraint job_session_production_quantities_planned_chk
    check (planned_quantity is null or planned_quantity >= 0),
  constraint job_session_production_quantities_actual_chk
    check (actual_quantity >= 0),
  constraint job_session_production_quantities_waste_chk
    check (waste_quantity >= 0),
  constraint job_session_production_quantities_disposal_chk
    check (disposal_quantity >= 0),
  constraint job_session_production_quantities_completion_chk
    check (completion_percent is null or (completion_percent >= 0 and completion_percent <= 100)),
  constraint job_session_production_quantities_sort_chk
    check (sort_order between 0 and 10000)
);
create index if not exists job_session_production_quantities_session_idx
  on public.job_session_production_quantities(job_session_id,is_active,sort_order);
create index if not exists job_session_production_quantities_work_order_idx
  on public.job_session_production_quantities(work_order_id,activity_type,is_active);
create index if not exists job_session_production_quantities_zone_idx
  on public.job_session_production_quantities(client_site_zone_id)
  where client_site_zone_id is not null;
create index if not exists job_session_production_quantities_work_order_line_idx
  on public.job_session_production_quantities(source_work_order_line_id)
  where source_work_order_line_id is not null;
create index if not exists job_session_production_quantities_estimate_assumption_idx
  on public.job_session_production_quantities(source_estimate_assumption_id)
  where source_estimate_assumption_id is not null;
create index if not exists job_session_production_quantities_created_by_idx
  on public.job_session_production_quantities(created_by_profile_id)
  where created_by_profile_id is not null;
create index if not exists job_session_production_quantities_updated_by_idx
  on public.job_session_production_quantities(updated_by_profile_id)
  where updated_by_profile_id is not null;
alter table public.job_session_production_quantities enable row level security;
revoke all on table public.job_session_production_quantities from public,anon,authenticated;
grant select,insert,update,delete on table public.job_session_production_quantities to service_role;

create or replace view public.v_landscape_production_quantity_directory
with (security_invoker=true)
as
select
  q.*,
  js.session_date,
  js.session_status,
  js.started_at,
  js.ended_at,
  wo.work_order_number,
  wo.client_id,
  wo.client_site_id,
  coalesce(c.display_name,c.legal_name) as client_name,
  cs.site_name,
  z.zone_code,
  z.zone_name,
  case when q.planned_quantity is null then null else q.actual_quantity-q.planned_quantity end as quantity_variance,
  case when coalesce(q.planned_quantity,0)>0
    then round((q.actual_quantity/nullif(q.planned_quantity,0))*100.0,2)
    else null
  end as planned_completion_percent
from public.job_session_production_quantities q
join public.job_sessions js on js.id=q.job_session_id
join public.work_orders wo on wo.id=q.work_order_id
left join public.clients c on c.id=wo.client_id
left join public.client_sites cs on cs.id=wo.client_site_id
left join public.client_site_zones z on z.id=q.client_site_zone_id;
revoke all on table public.v_landscape_production_quantity_directory from public,anon,authenticated;
grant select on table public.v_landscape_production_quantity_directory to service_role;

create or replace view public.v_landscape_production_session_directory
with (security_invoker=true)
as
select
  js.id as job_session_id,
  js.work_order_id,
  js.job_id,
  js.dispatch_schedule_item_id,
  js.session_date,
  js.session_kind,
  js.session_status,
  js.scheduled_start_at,
  js.started_at,
  js.ended_at,
  js.duration_minutes,
  js.delay_minutes,
  js.delay_reason,
  js.workability_status,
  js.weather_summary,
  js.completion_state,
  js.unfinished_work_notes,
  js.return_visit_required,
  js.return_visit_reason,
  js.customer_site_issue_notes,
  js.production_notes,
  js.production_recorded_at,
  js.production_recorded_by_profile_id,
  js.site_supervisor_profile_id,
  js.site_supervisor_signoff_name,
  js.site_supervisor_signed_off_at,
  wo.work_order_number,
  wo.status as work_order_status,
  wo.client_id,
  wo.client_site_id,
  wo.supervisor_profile_id as work_order_supervisor_profile_id,
  coalesce(c.display_name,c.legal_name) as client_name,
  cs.site_name,
  cs.service_address,
  cs.city,
  coalesce(ch.crew_member_count,0)::int as crew_member_count,
  coalesce(ch.total_labour_hours,0)::numeric(12,2) as total_labour_hours,
  coalesce(ch.total_break_minutes,0)::int as total_break_minutes,
  coalesce(pq.production_metric_count,0)::int as production_metric_count,
  coalesce(pq.planned_quantity_total,0)::numeric(14,4) as planned_quantity_total,
  coalesce(pq.actual_quantity_total,0)::numeric(14,4) as actual_quantity_total,
  coalesce(pq.waste_quantity_total,0)::numeric(14,4) as waste_quantity_total,
  coalesce(pq.disposal_quantity_total,0)::numeric(14,4) as disposal_quantity_total,
  coalesce(mi.material_issue_count,0)::int as material_issue_count,
  coalesce(mi.material_quantity_total,0)::numeric(14,4) as material_quantity_total,
  coalesce(mi.material_cost_total,0)::numeric(14,2) as material_cost_total,
  coalesce(eq.equipment_signout_count,0)::int as equipment_signout_count,
  coalesce(ev.execution_proof_count,0)::int as execution_proof_count,
  coalesce(ev.before_media_count,0)::int as before_media_count,
  coalesce(ev.during_media_count,0)::int as during_media_count,
  coalesce(ev.after_media_count,0)::int as after_media_count,
  coalesce(lu.live_update_count,0)::int as live_update_count,
  (
    js.ended_at is not null
    and js.completion_state in ('complete','partial','return_required')
    and coalesce(ev.execution_proof_count,0)>0
  ) as completion_evidence_present,
  case
    when js.session_status='cancelled' then 'cancelled'
    when js.session_status='in_progress' then 'in_progress'
    when js.return_visit_required or js.completion_state='return_required' then 'return_visit_required'
    when js.completion_state='blocked' then 'blocked'
    when js.completion_state='partial' then 'partial'
    when js.completion_state='complete' and coalesce(ev.execution_proof_count,0)>0 then 'completed_with_evidence'
    when js.completion_state='complete' then 'completed_missing_evidence'
    when js.workability_status in ('delayed','stopped') then 'weather_or_workability_impact'
    else 'open'
  end as production_state
from public.job_sessions js
join public.work_orders wo on wo.id=js.work_order_id
left join public.clients c on c.id=wo.client_id
left join public.client_sites cs on cs.id=wo.client_site_id
left join lateral (
  select
    count(*)::int as crew_member_count,
    coalesce(sum(h.hours_worked),0) as total_labour_hours,
    coalesce(sum(h.break_minutes),0)::int as total_break_minutes
  from public.job_session_crew_hours h
  where h.job_session_id=js.id
) ch on true
left join lateral (
  select
    count(*) filter(where q.is_active)::int as production_metric_count,
    coalesce(sum(q.planned_quantity) filter(where q.is_active),0) as planned_quantity_total,
    coalesce(sum(q.actual_quantity) filter(where q.is_active),0) as actual_quantity_total,
    coalesce(sum(q.waste_quantity) filter(where q.is_active),0) as waste_quantity_total,
    coalesce(sum(q.disposal_quantity) filter(where q.is_active),0) as disposal_quantity_total
  from public.job_session_production_quantities q
  where q.job_session_id=js.id
) pq on true
left join lateral (
  select
    count(distinct m.id)::int as material_issue_count,
    coalesce(sum(m.quantity_total),0) as material_quantity_total,
    coalesce(sum(m.issue_total),0) as material_cost_total
  from public.material_issues m
  where m.job_session_id=js.id and m.issue_status<>'void'
) mi on true
left join lateral (
  select count(*)::int as equipment_signout_count
  from public.equipment_signouts e
  where e.job_session_id=js.id
) eq on true
left join lateral (
  select
    count(distinct p.id)::int as execution_proof_count,
    count(pm.id) filter(where p.proof_type='arrival')::int as before_media_count,
    count(pm.id) filter(where p.proof_type in ('progress','material','equipment','note'))::int as during_media_count,
    count(pm.id) filter(where p.proof_type in ('completion','quality'))::int as after_media_count
  from public.work_order_execution_proofs p
  left join public.work_order_execution_proof_media pm on pm.execution_proof_id=p.id
  where p.job_session_id=js.id and p.proof_status<>'retracted'
) ev on true
left join lateral (
  select count(*)::int as live_update_count
  from public.work_order_live_updates u
  where u.job_session_id=js.id and u.retracted_at is null
) lu on true;
revoke all on table public.v_landscape_production_session_directory from public,anon,authenticated;
grant select on table public.v_landscape_production_session_directory to service_role;

create or replace function public.ywi_rpc_landscape_production_session_save(
  p_payload jsonb,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_id uuid := case when nullif(p_payload->>'id','') is null then null else (p_payload->>'id')::uuid end;
  v_work_order_id uuid := case when nullif(p_payload->>'work_order_id','') is null then null else (p_payload->>'work_order_id')::uuid end;
  v_wo public.work_orders;
  v_session public.job_sessions;
  v_status text := lower(coalesce(nullif(p_payload->>'session_status',''),'planned'));
  v_workability text := lower(coalesce(nullif(p_payload->>'workability_status',''),'not_recorded'));
  v_completion text := lower(coalesce(nullif(p_payload->>'completion_state',''),'open'));
  v_started timestamptz := nullif(p_payload->>'started_at','')::timestamptz;
  v_ended timestamptz := nullif(p_payload->>'ended_at','')::timestamptz;
  v_delay_minutes int := greatest(0,coalesce(nullif(p_payload->>'delay_minutes','')::int,0));
  v_return_required boolean := coalesce((p_payload->>'return_visit_required')::boolean,false);
  v_crew jsonb := coalesce(p_payload->'crew_hour','{}'::jsonb);
  v_crew_id uuid := case when nullif(v_crew->>'id','') is null then null else (v_crew->>'id')::uuid end;
  v_crew_row public.job_session_crew_hours;
  v_hours numeric := null;
  v_material_issue_id uuid := case when nullif(p_payload->>'material_issue_id','') is null then null else (p_payload->>'material_issue_id')::uuid end;
  v_equipment_signout_id bigint := case when nullif(p_payload->>'equipment_signout_id','') is null then null else (p_payload->>'equipment_signout_id')::bigint end;
  v_execution_proof_id uuid := case when nullif(p_payload->>'execution_proof_id','') is null then null else (p_payload->>'execution_proof_id')::uuid end;
  v_live_update_id uuid := case when nullif(p_payload->>'live_update_id','') is null then null else (p_payload->>'live_update_id')::uuid end;
begin
  if v_status not in ('planned','in_progress','completed','delayed','paused','cancelled') then
    raise exception 'Unsupported production session status %.',v_status using errcode='23514';
  end if;
  if v_workability not in ('not_recorded','workable','restricted','delayed','stopped') then
    raise exception 'Unsupported workability status %.',v_workability using errcode='23514';
  end if;
  if v_completion not in ('open','complete','partial','blocked','return_required') then
    raise exception 'Unsupported completion state %.',v_completion using errcode='23514';
  end if;
  if v_completion='return_required' then v_return_required:=true; end if;
  if v_return_required and nullif(btrim(coalesce(p_payload->>'return_visit_reason','')),'') is null then
    raise exception 'Return-visit reason is required when a return visit is required.' using errcode='23514';
  end if;

  if v_id is not null then
    select * into v_session from public.job_sessions where id=v_id for update;
    if not found then raise exception 'Production session % does not exist.',v_id using errcode='23503'; end if;
    v_work_order_id:=coalesce(v_work_order_id,v_session.work_order_id);
  end if;
  if v_work_order_id is null then raise exception 'Work order is required.' using errcode='23514'; end if;
  select * into v_wo from public.work_orders where id=v_work_order_id;
  if not found then raise exception 'Work order % does not exist.',v_work_order_id using errcode='23503'; end if;

  if v_status='in_progress' and v_started is null then v_started:=coalesce(v_session.started_at,now()); end if;
  if v_status='completed' and v_ended is null then v_ended:=coalesce(v_session.ended_at,now()); end if;
  if v_ended is not null and v_started is not null and v_ended<v_started then
    raise exception 'Session end cannot be before session start.' using errcode='23514';
  end if;

  if v_id is null then
    insert into public.job_sessions(
      job_id,work_order_id,dispatch_schedule_item_id,session_date,session_kind,session_status,
      service_frequency_label,scheduled_start_at,started_at,ended_at,duration_minutes,delay_minutes,notes,
      site_supervisor_profile_id,created_by_profile_id,
      workability_status,weather_summary,delay_reason,completion_state,unfinished_work_notes,
      return_visit_required,return_visit_reason,customer_site_issue_notes,production_notes,
      production_recorded_at,production_recorded_by_profile_id
    ) values (
      v_wo.legacy_job_id,v_wo.id,
      case when nullif(p_payload->>'dispatch_schedule_item_id','') is null then null else (p_payload->>'dispatch_schedule_item_id')::uuid end,
      coalesce(nullif(p_payload->>'session_date','')::date,current_date),
      coalesce(nullif(p_payload->>'session_kind',''),'field_service'),v_status,
      nullif(p_payload->>'service_frequency_label',''),
      nullif(p_payload->>'scheduled_start_at','')::timestamptz,
      v_started,v_ended,
      case when v_started is not null and v_ended is not null then greatest(0,floor(extract(epoch from (v_ended-v_started))/60)::int) else null end,
      v_delay_minutes,nullif(p_payload->>'notes',''),
      case when nullif(p_payload->>'site_supervisor_profile_id','') is null then v_wo.supervisor_profile_id else (p_payload->>'site_supervisor_profile_id')::uuid end,
      p_actor_profile_id,
      v_workability,nullif(p_payload->>'weather_summary',''),nullif(p_payload->>'delay_reason',''),v_completion,
      nullif(p_payload->>'unfinished_work_notes',''),v_return_required,nullif(p_payload->>'return_visit_reason',''),
      nullif(p_payload->>'customer_site_issue_notes',''),nullif(p_payload->>'production_notes',''),
      now(),p_actor_profile_id
    ) returning * into v_session;
  else
    update public.job_sessions js set
      work_order_id=v_wo.id,
      job_id=coalesce(js.job_id,v_wo.legacy_job_id),
      dispatch_schedule_item_id=case when p_payload ? 'dispatch_schedule_item_id' then nullif(p_payload->>'dispatch_schedule_item_id','')::uuid else js.dispatch_schedule_item_id end,
      session_date=case when p_payload ? 'session_date' then coalesce(nullif(p_payload->>'session_date','')::date,js.session_date) else js.session_date end,
      session_kind=case when p_payload ? 'session_kind' then coalesce(nullif(p_payload->>'session_kind',''),'field_service') else js.session_kind end,
      session_status=case when p_payload ? 'session_status' then v_status else js.session_status end,
      service_frequency_label=case when p_payload ? 'service_frequency_label' then nullif(p_payload->>'service_frequency_label','') else js.service_frequency_label end,
      scheduled_start_at=case when p_payload ? 'scheduled_start_at' then nullif(p_payload->>'scheduled_start_at','')::timestamptz else js.scheduled_start_at end,
      started_at=case when p_payload ? 'started_at' or v_status='in_progress' then coalesce(v_started,js.started_at) else js.started_at end,
      ended_at=case when p_payload ? 'ended_at' or v_status='completed' then coalesce(v_ended,js.ended_at) else js.ended_at end,
      duration_minutes=case
        when coalesce(v_started,js.started_at) is not null and coalesce(v_ended,js.ended_at) is not null
          then greatest(0,floor(extract(epoch from (coalesce(v_ended,js.ended_at)-coalesce(v_started,js.started_at)))/60)::int)
        else js.duration_minutes end,
      delay_minutes=case when p_payload ? 'delay_minutes' then v_delay_minutes else js.delay_minutes end,
      notes=case when p_payload ? 'notes' then nullif(p_payload->>'notes','') else js.notes end,
      site_supervisor_profile_id=case when p_payload ? 'site_supervisor_profile_id' then nullif(p_payload->>'site_supervisor_profile_id','')::uuid else js.site_supervisor_profile_id end,
      workability_status=case when p_payload ? 'workability_status' then v_workability else js.workability_status end,
      weather_summary=case when p_payload ? 'weather_summary' then nullif(p_payload->>'weather_summary','') else js.weather_summary end,
      delay_reason=case when p_payload ? 'delay_reason' then nullif(p_payload->>'delay_reason','') else js.delay_reason end,
      completion_state=case when p_payload ? 'completion_state' then v_completion else js.completion_state end,
      unfinished_work_notes=case when p_payload ? 'unfinished_work_notes' then nullif(p_payload->>'unfinished_work_notes','') else js.unfinished_work_notes end,
      return_visit_required=case when p_payload ? 'return_visit_required' or v_completion='return_required' then v_return_required else js.return_visit_required end,
      return_visit_reason=case when p_payload ? 'return_visit_reason' then nullif(p_payload->>'return_visit_reason','') else js.return_visit_reason end,
      customer_site_issue_notes=case when p_payload ? 'customer_site_issue_notes' then nullif(p_payload->>'customer_site_issue_notes','') else js.customer_site_issue_notes end,
      production_notes=case when p_payload ? 'production_notes' then nullif(p_payload->>'production_notes','') else js.production_notes end,
      production_recorded_at=now(),
      production_recorded_by_profile_id=p_actor_profile_id,
      updated_at=now()
    where js.id=v_id
    returning js.* into v_session;
  end if;

  if jsonb_typeof(v_crew)='object' and (
    nullif(v_crew->>'worker_name','') is not null
    or nullif(v_crew->>'profile_id','') is not null
    or v_crew_id is not null
  ) then
    if nullif(v_crew->>'hours_worked','') is not null then
      v_hours:=greatest(0,(v_crew->>'hours_worked')::numeric);
    elsif nullif(v_crew->>'started_at','') is not null and nullif(v_crew->>'ended_at','') is not null then
      v_hours:=greatest(0,round((extract(epoch from ((v_crew->>'ended_at')::timestamptz-(v_crew->>'started_at')::timestamptz))/3600.0)::numeric,2));
    else v_hours:=0; end if;

    if v_crew_id is null then
      insert into public.job_session_crew_hours(
        job_session_id,job_id,work_order_id,crew_id,profile_id,worker_name,started_at,ended_at,hours_worked,
        regular_hours,overtime_hours,notes,created_by_profile_id,break_minutes,pay_code
      ) values (
        v_session.id,v_wo.legacy_job_id,v_wo.id,
        case when nullif(v_crew->>'crew_id','') is null then null else (v_crew->>'crew_id')::uuid end,
        case when nullif(v_crew->>'profile_id','') is null then null else (v_crew->>'profile_id')::uuid end,
        nullif(v_crew->>'worker_name',''),
        nullif(v_crew->>'started_at','')::timestamptz,nullif(v_crew->>'ended_at','')::timestamptz,
        v_hours,
        greatest(0,coalesce(nullif(v_crew->>'regular_hours','')::numeric,v_hours)),
        greatest(0,coalesce(nullif(v_crew->>'overtime_hours','')::numeric,0)),
        nullif(v_crew->>'notes',''),p_actor_profile_id,
        greatest(0,coalesce(nullif(v_crew->>'break_minutes','')::int,0)),
        lower(coalesce(nullif(v_crew->>'pay_code',''),'regular'))
      ) returning * into v_crew_row;
    else
      update public.job_session_crew_hours h set
        job_session_id=v_session.id,job_id=coalesce(h.job_id,v_wo.legacy_job_id),work_order_id=v_wo.id,
        crew_id=case when v_crew ? 'crew_id' then nullif(v_crew->>'crew_id','')::uuid else h.crew_id end,
        profile_id=case when v_crew ? 'profile_id' then nullif(v_crew->>'profile_id','')::uuid else h.profile_id end,
        worker_name=case when v_crew ? 'worker_name' then nullif(v_crew->>'worker_name','') else h.worker_name end,
        started_at=case when v_crew ? 'started_at' then nullif(v_crew->>'started_at','')::timestamptz else h.started_at end,
        ended_at=case when v_crew ? 'ended_at' then nullif(v_crew->>'ended_at','')::timestamptz else h.ended_at end,
        hours_worked=case when v_crew ? 'hours_worked' or (v_crew ? 'started_at' and v_crew ? 'ended_at') then v_hours else h.hours_worked end,
        regular_hours=case when v_crew ? 'regular_hours' then greatest(0,coalesce(nullif(v_crew->>'regular_hours','')::numeric,0)) else h.regular_hours end,
        overtime_hours=case when v_crew ? 'overtime_hours' then greatest(0,coalesce(nullif(v_crew->>'overtime_hours','')::numeric,0)) else h.overtime_hours end,
        notes=case when v_crew ? 'notes' then nullif(v_crew->>'notes','') else h.notes end,
        break_minutes=case when v_crew ? 'break_minutes' then greatest(0,coalesce(nullif(v_crew->>'break_minutes','')::int,0)) else h.break_minutes end,
        pay_code=case when v_crew ? 'pay_code' then lower(coalesce(nullif(v_crew->>'pay_code',''),'regular')) else h.pay_code end,
        updated_at=now()
      where h.id=v_crew_id and (h.job_session_id=v_session.id or h.job_session_id is null)
      returning h.* into v_crew_row;
      if v_crew_row.id is null then raise exception 'Crew-hour entry was not found for this production session.' using errcode='23503'; end if;
    end if;
  end if;

  if v_material_issue_id is not null then
    update public.material_issues
      set job_session_id=v_session.id,updated_at=now()
    where id=v_material_issue_id and work_order_id=v_wo.id;
    if not found then raise exception 'Material issue must belong to the selected work order.' using errcode='23514'; end if;
  end if;

  if v_equipment_signout_id is not null then
    update public.equipment_signouts
      set work_order_id=v_wo.id,job_session_id=v_session.id
    where id=v_equipment_signout_id
      and (job_id is null or v_wo.legacy_job_id is null or job_id=v_wo.legacy_job_id);
    if not found then raise exception 'Equipment signout cannot be linked to this work order.' using errcode='23514'; end if;
  end if;

  if v_execution_proof_id is not null then
    update public.work_order_execution_proofs
      set job_session_id=v_session.id,updated_at=now()
    where id=v_execution_proof_id and work_order_id=v_wo.id;
    if not found then raise exception 'Execution proof must belong to the selected work order.' using errcode='23514'; end if;
  end if;

  if v_live_update_id is not null then
    update public.work_order_live_updates
      set job_session_id=v_session.id,updated_at=now()
    where id=v_live_update_id and work_order_id=v_wo.id;
    if not found then raise exception 'Live update must belong to the selected work order.' using errcode='23514'; end if;
  end if;

  return jsonb_build_object(
    'session',(select to_jsonb(x) from public.v_landscape_production_session_directory x where x.job_session_id=v_session.id),
    'crew_hour',case when v_crew_row.id is null then null else to_jsonb(v_crew_row) end
  );
end;
$$;
revoke all on function public.ywi_rpc_landscape_production_session_save(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_production_session_save(jsonb,uuid) to service_role;

create or replace function public.ywi_rpc_landscape_production_quantity_save(
  p_payload jsonb,
  p_actor_profile_id uuid
)
returns public.job_session_production_quantities
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_id uuid := case when nullif(p_payload->>'id','') is null then null else (p_payload->>'id')::uuid end;
  v_session_id uuid := case when nullif(p_payload->>'job_session_id','') is null then null else (p_payload->>'job_session_id')::uuid end;
  v_session public.job_sessions;
  v_wo public.work_orders;
  v_record_type text := lower(coalesce(nullif(p_payload->>'record_type',''),'production'));
  v_activity text := lower(coalesce(nullif(p_payload->>'activity_type',''),'other'));
  v_metric text := nullif(btrim(p_payload->>'metric_label'),'');
  v_zone_id uuid := case when nullif(p_payload->>'client_site_zone_id','') is null then null else (p_payload->>'client_site_zone_id')::uuid end;
  v_line_id uuid := case when nullif(p_payload->>'source_work_order_line_id','') is null then null else (p_payload->>'source_work_order_line_id')::uuid end;
  v_assumption_id uuid := case when nullif(p_payload->>'source_estimate_assumption_id','') is null then null else (p_payload->>'source_estimate_assumption_id')::uuid end;
  v_row public.job_session_production_quantities;
begin
  if v_session_id is null and v_id is null then raise exception 'Production session is required.' using errcode='23514'; end if;
  if v_record_type not in ('production','disposal') then raise exception 'Unsupported production record type.' using errcode='23514'; end if;
  if v_activity not in ('mowing','edging','trimming','garden_bed','hedge_shrub','tree_brush','cleanup','aeration','fertilizing','seeding','sod','planting','mulch','soil','gravel_stone','disposal','snow_ice','other') then
    raise exception 'Unsupported production activity %.',v_activity using errcode='23514';
  end if;
  if v_metric is null and v_id is null then raise exception 'Metric label is required.' using errcode='23514'; end if;

  if v_id is not null then
    select * into v_row from public.job_session_production_quantities where id=v_id for update;
    if not found then raise exception 'Production quantity was not found.' using errcode='23503'; end if;
    v_session_id:=coalesce(v_session_id,v_row.job_session_id);
  end if;
  select * into v_session from public.job_sessions where id=v_session_id;
  if not found or v_session.work_order_id is null then raise exception 'Production session must be linked to a work order.' using errcode='23503'; end if;
  select * into v_wo from public.work_orders where id=v_session.work_order_id;
  if not found then raise exception 'Work order was not found.' using errcode='23503'; end if;

  if v_zone_id is not null and not exists(
    select 1 from public.client_site_zones z
    where z.id=v_zone_id and (v_wo.client_site_id is null or z.client_site_id=v_wo.client_site_id)
  ) then raise exception 'Production zone must belong to the work-order property.' using errcode='23514'; end if;
  if v_line_id is not null and not exists(select 1 from public.work_order_lines l where l.id=v_line_id and l.work_order_id=v_wo.id) then
    raise exception 'Source work-order line must belong to the selected work order.' using errcode='23514';
  end if;
  if v_assumption_id is not null and not exists(
    select 1 from public.estimate_workflow_assumptions a
    where a.id=v_assumption_id and v_wo.estimate_id is not null and a.estimate_id=v_wo.estimate_id
  ) then raise exception 'Source estimate assumption must belong to the work-order estimate.' using errcode='23514'; end if;

  if v_id is null then
    insert into public.job_session_production_quantities(
      job_session_id,work_order_id,client_site_zone_id,source_work_order_line_id,source_estimate_assumption_id,
      record_type,activity_type,metric_label,planned_quantity,actual_quantity,waste_quantity,disposal_quantity,
      unit_label,completion_percent,disposal_destination,notes,sort_order,is_active,created_by_profile_id,updated_by_profile_id
    ) values (
      v_session.id,v_wo.id,v_zone_id,v_line_id,v_assumption_id,v_record_type,v_activity,v_metric,
      nullif(p_payload->>'planned_quantity','')::numeric,
      greatest(0,coalesce(nullif(p_payload->>'actual_quantity','')::numeric,0)),
      greatest(0,coalesce(nullif(p_payload->>'waste_quantity','')::numeric,0)),
      greatest(0,coalesce(nullif(p_payload->>'disposal_quantity','')::numeric,0)),
      nullif(p_payload->>'unit_label',''),
      nullif(p_payload->>'completion_percent','')::numeric,
      nullif(p_payload->>'disposal_destination',''),nullif(p_payload->>'notes',''),
      greatest(0,least(coalesce(nullif(p_payload->>'sort_order','')::int,100),10000)),
      coalesce((p_payload->>'is_active')::boolean,true),p_actor_profile_id,p_actor_profile_id
    ) returning * into v_row;
  else
    update public.job_session_production_quantities q set
      job_session_id=v_session.id,work_order_id=v_wo.id,
      client_site_zone_id=case when p_payload ? 'client_site_zone_id' then v_zone_id else q.client_site_zone_id end,
      source_work_order_line_id=case when p_payload ? 'source_work_order_line_id' then v_line_id else q.source_work_order_line_id end,
      source_estimate_assumption_id=case when p_payload ? 'source_estimate_assumption_id' then v_assumption_id else q.source_estimate_assumption_id end,
      record_type=case when p_payload ? 'record_type' then v_record_type else q.record_type end,
      activity_type=case when p_payload ? 'activity_type' then v_activity else q.activity_type end,
      metric_label=coalesce(v_metric,q.metric_label),
      planned_quantity=case when p_payload ? 'planned_quantity' then nullif(p_payload->>'planned_quantity','')::numeric else q.planned_quantity end,
      actual_quantity=case when p_payload ? 'actual_quantity' then greatest(0,coalesce(nullif(p_payload->>'actual_quantity','')::numeric,0)) else q.actual_quantity end,
      waste_quantity=case when p_payload ? 'waste_quantity' then greatest(0,coalesce(nullif(p_payload->>'waste_quantity','')::numeric,0)) else q.waste_quantity end,
      disposal_quantity=case when p_payload ? 'disposal_quantity' then greatest(0,coalesce(nullif(p_payload->>'disposal_quantity','')::numeric,0)) else q.disposal_quantity end,
      unit_label=case when p_payload ? 'unit_label' then nullif(p_payload->>'unit_label','') else q.unit_label end,
      completion_percent=case when p_payload ? 'completion_percent' then nullif(p_payload->>'completion_percent','')::numeric else q.completion_percent end,
      disposal_destination=case when p_payload ? 'disposal_destination' then nullif(p_payload->>'disposal_destination','') else q.disposal_destination end,
      notes=case when p_payload ? 'notes' then nullif(p_payload->>'notes','') else q.notes end,
      sort_order=case when p_payload ? 'sort_order' then greatest(0,least(coalesce(nullif(p_payload->>'sort_order','')::int,100),10000)) else q.sort_order end,
      is_active=case when p_payload ? 'is_active' then coalesce((p_payload->>'is_active')::boolean,true) else q.is_active end,
      updated_by_profile_id=p_actor_profile_id,updated_at=now()
    where q.id=v_id
    returning q.* into v_row;
  end if;
  return v_row;
end;
$$;
revoke all on function public.ywi_rpc_landscape_production_quantity_save(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.ywi_rpc_landscape_production_quantity_save(jsonb,uuid) to service_role;

insert into public.app_module_write_contracts(
  action_key,owner_module,minimum_access,boundary_mode,domain_key,event_key,cross_module_event,is_enabled,description
) values
  ('landscape_production_session_save','jobs','create','write','landscape_production','jobs.production.session_saved',true,true,'Create/update canonical field sessions and link existing crew/material/equipment/live-update/execution-proof evidence.'),
  ('landscape_production_quantity_save','jobs','create','write','landscape_production','jobs.production.quantity_saved',false,true,'Create/update measurable landscaping production and disposal quantities for a field session.')
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
    case when (select count(*) from public.app_module_write_contracts where is_enabled)=48 then 'passed' else 'failed' end,
    'Exactly 48 explicitly handled operations-manage actions have enabled write-boundary contracts.'
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

create or replace function public.ywi_landscape_production_security_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'canonical_execution_authorities_preserved',
    case when to_regclass('public.job_sessions') is not null
      and to_regclass('public.job_session_crew_hours') is not null
      and to_regclass('public.material_issues') is not null
      and to_regclass('public.equipment_signouts') is not null
      and to_regclass('public.work_order_execution_proofs') is not null
      and to_regclass('public.work_order_live_updates') is not null
      then 'passed' else 'failed' end,
    'Build 325 extends existing time, material, equipment, proof and live-update authorities instead of replacing them.'
  union all
  select 'production_quantity_private',
    case when coalesce((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='job_session_production_quantities'),false)
      and not exists(
        select 1 from information_schema.table_privileges
        where table_schema='public' and table_name='job_session_production_quantities'
          and grantee in ('anon','authenticated','PUBLIC')
      ) then 'passed' else 'failed' end,
    'Production quantities are private service-role data with RLS enabled.'
  union all
  select 'production_views_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public'
        and table_name in ('v_landscape_production_session_directory','v_landscape_production_quantity_directory')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Build 325 production read models are server-only.'
  union all
  select 'production_rpcs_private',
    case when not exists(
      select 1 from information_schema.routine_privileges
      where specific_schema='public'
        and routine_name in ('ywi_rpc_landscape_production_session_save','ywi_rpc_landscape_production_quantity_save')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Build 325 production mutation RPCs are callable only through server authority.'
  union all
  select 'production_actions_registered',
    case when (select count(*) from public.app_module_write_contracts
      where action_key in ('landscape_production_session_save','landscape_production_quantity_save')
        and owner_module='jobs' and minimum_access='create' and boundary_mode='write' and is_enabled)=2
      then 'passed' else 'failed' end,
    'Production session and quantity writes are explicit Jobs-create contracts.'
  union all
  select 'media_evidence_authority_preserved',
    case when to_regprocedure('public.ywi_rpc_submit_work_order_execution_proof(uuid,uuid,text,text,text,text,boolean,timestamp with time zone,numeric,uuid[],integer,numeric,numeric,numeric,numeric,jsonb)') is not null
      and to_regprocedure('public.ywi_rpc_create_work_order_live_update(uuid,uuid,text,text,text,text,timestamp with time zone,numeric,uuid[],boolean,jsonb)') is not null
      then 'passed' else 'failed' end,
    'Before/during/after media and field updates continue through the existing execution-proof/live-update authorities.'
  union all
  select 'material_equipment_authority_preserved',
    case when to_regclass('public.material_issues') is not null and to_regclass('public.equipment_signouts') is not null
      then 'passed' else 'failed' end,
    'Material use and equipment custody remain canonical in their existing tables and are linked to production sessions.'
  union all
  select 'finance_provider_execution_off',
    case when not exists(
      select 1 from public.finance_job_completion_posting_execution_controls
      where execution_enabled=true or provider_mutation_enabled=true
    ) then 'passed' else 'failed' end,
    'Build 325 does not enable Finance posting or payment-provider mutation.';
$$;
revoke all on function public.ywi_landscape_production_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_landscape_production_security_assertions() to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  214,'214_landscape_production_tracking',
  'Links canonical field sessions to work orders and captures crew hours, measurable production/disposal quantities, workability impacts and existing material/equipment/media evidence.',
  'applied',now(),'schema214',
  'Existing job_sessions, material_issues, equipment_signouts, live updates, execution proof and closeout authorities are preserved; Finance/provider execution remains disabled.',
  '214_landscape_production_tracking.sql','schema214'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true)
as
select
  214 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=214 then 'current'
    when coalesce(max(schema_version) filter(where status='applied'),0)>214 then 'ahead'
    else 'drift'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=214 then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter(where status='applied'),0)>214 then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
