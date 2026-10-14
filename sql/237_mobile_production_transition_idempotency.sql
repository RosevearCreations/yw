-- Schema 237 / Build 396: atomic, retry-safe mobile job session transitions.
-- Canonical production session writes remain in ywi_rpc_landscape_production_session_save.
begin;

create table if not exists public.mobile_production_transition_intents (
  intent_key uuid primary key,
  actor_profile_id uuid not null references public.profiles(id),
  work_order_id uuid not null references public.work_orders(id),
  dispatch_schedule_item_id uuid not null references public.dispatch_schedule_items(id),
  transition text not null check (transition in ('start','finish')),
  session_id uuid not null references public.job_sessions(id),
  acknowledgment jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists mobile_production_transition_intents_work_order_idx
  on public.mobile_production_transition_intents(work_order_id,created_at desc);

alter table public.mobile_production_transition_intents enable row level security;
revoke all on table public.mobile_production_transition_intents from public, anon, authenticated;
grant select,insert on table public.mobile_production_transition_intents to service_role;

create or replace function public.ywi_rpc_mobile_production_transition(
  p_intent_key uuid,
  p_actor_profile_id uuid,
  p_work_order_id uuid,
  p_dispatch_id uuid,
  p_transition text,
  p_session_id uuid default null,
  p_completion_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_existing public.mobile_production_transition_intents%rowtype;
  v_session public.job_sessions%rowtype;
  v_dispatch public.dispatch_schedule_items%rowtype;
  v_response jsonb;
  v_canonical jsonb;
begin
  if p_intent_key is null or p_actor_profile_id is null or p_work_order_id is null or p_dispatch_id is null then
    raise exception 'A fresh action key, signed-in profile, work order and dispatch are required.' using errcode='23514';
  end if;
  if p_transition not in ('start','finish') then
    raise exception 'Unsupported mobile production action.' using errcode='23514';
  end if;
  -- Serialize start/finish/retry attempts against a canonical work order.
  perform pg_advisory_xact_lock(hashtextextended(p_work_order_id::text,396));
  select * into v_existing from public.mobile_production_transition_intents where intent_key=p_intent_key;
  if found then
    if v_existing.actor_profile_id<>p_actor_profile_id or v_existing.work_order_id<>p_work_order_id
       or v_existing.dispatch_schedule_item_id<>p_dispatch_id or v_existing.transition<>p_transition
       or (p_session_id is not null and p_session_id<>v_existing.session_id) then
      raise exception 'Action key was already used for a different production transition.' using errcode='23505';
    end if;
    return v_existing.acknowledgment || jsonb_build_object('replayed',true);
  end if;
  select * into v_dispatch from public.dispatch_schedule_items
    where id=p_dispatch_id and work_order_id=p_work_order_id;
  if not found then
    raise exception 'This dispatch does not belong to the selected work order.' using errcode='23503';
  end if;
  if p_transition='start' then
    if lower(coalesce(v_dispatch.schedule_status,'')) ~ '(cancel|block|hold|suspend|close)' then
      raise exception 'The dispatch is on hold, cancelled or restricted.' using errcode='23514';
    end if;
    if lower(coalesce(v_dispatch.workability_state,'')) ~ '(block|restrict|stop|delay|hold|postpon)' then
      raise exception 'The recorded workability status restricts starting this visit.' using errcode='23514';
    end if;
    select * into v_session from public.job_sessions
    where work_order_id=p_work_order_id and session_status='in_progress'
    order by started_at desc nulls last, created_at desc limit 1 for update;
    if not found then
      v_canonical:=public.ywi_rpc_landscape_production_session_save(
        jsonb_build_object(
          'work_order_id',p_work_order_id,'dispatch_schedule_item_id',p_dispatch_id,
          'session_date',current_date,'session_status','in_progress',
          'started_at',now(),'completion_state','open',
          'workability_status',case when v_dispatch.workability_state='workable' then 'workable' else 'not_recorded' end,
          'weather_summary',v_dispatch.weather_summary,
          'production_notes','Started from mobile production capture.'
        ),p_actor_profile_id);
      select * into v_session from public.job_sessions
      where work_order_id=p_work_order_id and session_status='in_progress'
      order by started_at desc nulls last, created_at desc limit 1;
      if not found then raise exception 'Canonical session create gave no active record.' using errcode='23503'; end if;
    end if;
  else
    if p_session_id is null then
      raise exception 'A confirmed existing session ID is required to finish a visit.' using errcode='23514';
    end if;
    select * into v_session from public.job_sessions
    where id=p_session_id and work_order_id=p_work_order_id and dispatch_schedule_item_id=p_dispatch_id
    for update;
    if not found then
      raise exception 'This session does not belong to the selected dispatch.' using errcode='23503';
    end if;
    if v_session.session_status='in_progress' then
      v_canonical:=public.ywi_rpc_landscape_production_session_save(
        jsonb_build_object(
          'id',v_session.id,'work_order_id',p_work_order_id,
          'session_status','completed','ended_at',now(),'completion_state','complete',
          'production_notes',coalesce(nullif(left(btrim(p_completion_note),3000),''),'Completed from mobile production capture.')
        ),p_actor_profile_id);
      select * into v_session from public.job_sessions where id=p_session_id;
    elsif v_session.session_status<>'completed' then
      raise exception 'Session is not active or completed; finish was not recorded.' using errcode='23514';
    end if;
  end if;

  v_response=jsonb_build_object(
    'ok',true,'intent_key',p_intent_key,'transition',p_transition,
    'session_id',v_session.id,'work_order_id',p_work_order_id,
    'dispatch_schedule_item_id',p_dispatch_id,
    'session_status',v_session.session_status,
    'completion_state',v_session.completion_state,
    'started_at',v_session.started_at,'ended_at',v_session.ended_at,
    'completion_note',v_session.production_notes,
    'replayed',false,'evidence_authority','public.job_sessions'
  );
  insert into public.mobile_production_transition_intents(
    intent_key,actor_profile_id,work_order_id,dispatch_schedule_item_id,
    transition,session_id,acknowledgment
  ) values (
    p_intent_key,p_actor_profile_id,p_work_order_id,p_dispatch_id,
    p_transition,v_session.id,v_response
  );
  return v_response;
end;
$$;

revoke all on function public.ywi_rpc_mobile_production_transition(uuid,uuid,uuid,uuid,text,uuid,text)
  from public,anon,authenticated;
grant execute on function public.ywi_rpc_mobile_production_transition(uuid,uuid,uuid,uuid,text,uuid,text)
  to service_role;
-- Advance the authoritative schema registry and release drift view together.
-- The release recorder rejects a new migration until BOTH agree on the version.
insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  237,'mobile_production_transition_idempotency',
  'Build 396 adds canonical idempotent mobile session transitions and immutable acknowledgement evidence.',
  'applied',now(),'schema237',
  'JWT-authenticated assigned crews; atomic canonical start/finish; no Finance/dispatch or provider mutation.',
  '237_mobile_production_transition_idempotency.sql','schema237'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,
  description=excluded.description,
  status='applied',
  applied_at=now(),
  applied_by=excluded.applied_by,
  notes=excluded.notes,
  migration_key=excluded.migration_key,
  release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true) as
select 237 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case when coalesce(max(schema_version) filter(where status='applied'),0)=237 then 'current'
       when coalesce(max(schema_version) filter(where status='applied'),0)>237 then 'ahead' else 'drift' end as drift_status,
  case when coalesce(max(schema_version) filter(where status='applied'),0)=237
       then 'Live database matches the repository schema marker.'
       when coalesce(max(schema_version) filter(where status='applied'),0)>237
       then 'Live database is ahead of the repository schema marker.'
       else 'Live database is behind the repository schema marker.' end as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

-- Repository staging-fixture acceptance marker (no runtime mutation).
select 237 as expected_schema_version;
commit;
