begin;

-- Schema 217 — Build 329 Incident & Near-Miss Investigation
-- Immediate event capture remains in the existing incident submission authority.
-- This layer adds structured, auditable investigation and closure evidence without
-- duplicating submission images or corrective-action tasks.

create table if not exists public.incident_investigations (
  id uuid primary key default gen_random_uuid(),
  investigation_number text not null unique,
  source_submission_id bigint not null unique references public.submissions(id) on delete restrict,
  investigation_status text not null default 'in_progress',
  event_classification text not null default 'incident',
  severity text not null default 'medium',
  people_involved jsonb not null default '[]'::jsonb,
  witness_accounts jsonb not null default '[]'::jsonb,
  equipment_involved jsonb not null default '[]'::jsonb,
  initial_response_summary text,
  scene_secured boolean not null default false,
  immediate_hazard_controlled boolean not null default false,
  contributing_factors jsonb not null default '[]'::jsonb,
  root_factors jsonb not null default '[]'::jsonb,
  root_cause_summary text,
  investigation_summary text,
  corrective_action_required boolean not null default false,
  corrective_action_rationale text,
  external_reporting_assessment_note text,
  supervisor_review_status text not null default 'pending',
  supervisor_review_note text,
  supervisor_reviewed_at timestamptz,
  supervisor_reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  closure_summary text,
  closure_evidence jsonb not null default '[]'::jsonb,
  closed_at timestamptz,
  closed_by_profile_id uuid references public.profiles(id) on delete set null,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint incident_investigations_status_chk
    check (investigation_status in ('in_progress','ready_for_review','changes_required','closed')),
  constraint incident_investigations_review_chk
    check (supervisor_review_status in ('pending','approved','changes_required')),
  constraint incident_investigations_severity_chk
    check (severity in ('low','medium','high','critical')),
  constraint incident_investigations_people_json_chk check (jsonb_typeof(people_involved)='array'),
  constraint incident_investigations_witness_json_chk check (jsonb_typeof(witness_accounts)='array'),
  constraint incident_investigations_equipment_json_chk check (jsonb_typeof(equipment_involved)='array'),
  constraint incident_investigations_contributing_json_chk check (jsonb_typeof(contributing_factors)='array'),
  constraint incident_investigations_root_json_chk check (jsonb_typeof(root_factors)='array'),
  constraint incident_investigations_closure_json_chk check (jsonb_typeof(closure_evidence)='array')
);

create table if not exists public.incident_investigation_events (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.incident_investigations(id) on delete cascade,
  event_type text not null,
  event_status text,
  event_notes text,
  changed_by_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint incident_investigation_events_type_chk
    check (event_type in ('created','updated','submitted_for_review','review_approved','review_changes_required','reopened','closed')),
  constraint incident_investigation_events_metadata_chk check (jsonb_typeof(metadata)='object')
);

create index if not exists incident_investigations_status_idx
  on public.incident_investigations(investigation_status,supervisor_review_status,updated_at desc);
create index if not exists incident_investigations_created_by_idx on public.incident_investigations(created_by_profile_id);
create index if not exists incident_investigations_updated_by_idx on public.incident_investigations(updated_by_profile_id);
create index if not exists incident_investigations_reviewed_by_idx on public.incident_investigations(supervisor_reviewed_by_profile_id);
create index if not exists incident_investigations_closed_by_idx on public.incident_investigations(closed_by_profile_id);
create index if not exists incident_investigation_events_investigation_idx
  on public.incident_investigation_events(investigation_id,created_at desc);
create index if not exists incident_investigation_events_changed_by_idx
  on public.incident_investigation_events(changed_by_profile_id);

alter table public.incident_investigations enable row level security;
alter table public.incident_investigation_events enable row level security;
revoke all on table public.incident_investigations from public,anon,authenticated;
revoke all on table public.incident_investigation_events from public,anon,authenticated;
grant select,insert,update,delete on table public.incident_investigations to service_role;
grant select,insert on table public.incident_investigation_events to service_role;

create or replace view public.v_incident_investigation_directory
with (security_invoker=true)
as
with action_rollup as (
  select
    t.source_submission_id,
    count(*) filter(where t.task_scope='incident_corrective_action')::int as corrective_action_count,
    count(*) filter(where t.task_scope='incident_corrective_action' and t.status not in ('closed','cancelled'))::int as open_corrective_action_count,
    count(*) filter(where t.task_scope='incident_corrective_action' and t.status not in ('closed','cancelled') and t.due_date is not null and t.due_date < current_date)::int as overdue_corrective_action_count,
    max(t.updated_at) filter(where t.task_scope='incident_corrective_action') as last_corrective_action_at
  from public.corrective_action_tasks t
  group by t.source_submission_id
), event_rollup as (
  select
    e.investigation_id,
    count(*)::int as investigation_event_count,
    max(e.created_at) as last_investigation_event_at,
    (array_agg(e.event_type order by e.created_at desc nulls last))[1] as last_investigation_event_type
  from public.incident_investigation_events e
  group by e.investigation_id
)
select
  i.id,
  i.investigation_number,
  i.source_submission_id,
  i.investigation_status,
  i.event_classification,
  i.severity,
  inc.submission_date,
  inc.event_time,
  inc.status as submission_status,
  inc.site_id,
  inc.site_code,
  inc.site_name,
  inc.site_label,
  inc.job_code,
  inc.work_order_number,
  inc.route_code,
  inc.equipment_code as reported_equipment_code,
  inc.incident_kind,
  inc.medical_treatment_required,
  inc.lost_time,
  inc.property_damage,
  inc.vehicle_involved,
  inc.anonymous_report,
  inc.event_summary,
  inc.immediate_actions_taken as reported_immediate_actions,
  inc.root_cause_summary as reported_root_cause_summary,
  inc.witness_names as reported_witness_names,
  inc.image_count as photo_count,
  i.people_involved,
  i.witness_accounts,
  i.equipment_involved,
  i.initial_response_summary,
  i.scene_secured,
  i.immediate_hazard_controlled,
  i.contributing_factors,
  i.root_factors,
  i.root_cause_summary,
  i.investigation_summary,
  i.corrective_action_required,
  i.corrective_action_rationale,
  i.external_reporting_assessment_note,
  coalesce(ar.corrective_action_count,0) as corrective_action_count,
  coalesce(ar.open_corrective_action_count,0) as open_corrective_action_count,
  coalesce(ar.overdue_corrective_action_count,0) as overdue_corrective_action_count,
  ar.last_corrective_action_at,
  i.supervisor_review_status,
  i.supervisor_review_note,
  i.supervisor_reviewed_at,
  i.supervisor_reviewed_by_profile_id,
  i.closure_summary,
  i.closure_evidence,
  i.closed_at,
  i.closed_by_profile_id,
  coalesce(er.investigation_event_count,0) as investigation_event_count,
  er.last_investigation_event_at,
  er.last_investigation_event_type,
  i.created_at,
  i.updated_at,
  (
    i.investigation_status='ready_for_review'
    and nullif(btrim(coalesce(i.root_cause_summary,'')),'') is not null
    and nullif(btrim(coalesce(i.investigation_summary,'')),'') is not null
  ) as review_ready,
  (
    i.supervisor_review_status='approved'
    and coalesce(ar.open_corrective_action_count,0)=0
    and (not i.corrective_action_required or coalesce(ar.corrective_action_count,0)>0)
    and nullif(btrim(coalesce(i.closure_summary,'')),'') is not null
    and jsonb_array_length(i.closure_evidence)>0
  ) as closure_ready
from public.incident_investigations i
join public.v_incident_near_miss_history inc on inc.submission_id=i.source_submission_id
left join action_rollup ar on ar.source_submission_id=i.source_submission_id
left join event_rollup er on er.investigation_id=i.id;

revoke all on table public.v_incident_investigation_directory from public,anon,authenticated;
grant select on table public.v_incident_investigation_directory to service_role;

create or replace function public.ywi_rpc_incident_investigation_save(p_payload jsonb,p_actor_profile_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_id uuid;
  v_submission_id bigint;
  v_status text;
  v_classification text;
  v_severity text;
  v_people jsonb;
  v_witnesses jsonb;
  v_equipment jsonb;
  v_contributing jsonb;
  v_root jsonb;
  v_source public.v_incident_near_miss_history%rowtype;
  v_row public.incident_investigations%rowtype;
  v_event_type text;
begin
  if p_actor_profile_id is null then raise exception 'Actor profile is required.' using errcode='42501'; end if;
  v_id:=nullif(p_payload->>'id','')::uuid;
  v_submission_id:=nullif(p_payload->>'source_submission_id','')::bigint;
  if v_submission_id is null then raise exception 'Incident submission is required.' using errcode='23514'; end if;

  select * into v_source from public.v_incident_near_miss_history where submission_id=v_submission_id;
  if not found then raise exception 'Incident / near-miss submission was not found.' using errcode='P0002'; end if;

  v_status:=lower(coalesce(nullif(btrim(p_payload->>'investigation_status'),''),'in_progress'));
  if v_status not in ('in_progress','ready_for_review','changes_required') then
    raise exception 'Unsupported investigation status for save.' using errcode='23514';
  end if;
  v_classification:=lower(coalesce(nullif(btrim(p_payload->>'event_classification'),''),nullif(btrim(v_source.incident_kind),''),'incident'));
  v_severity:=lower(coalesce(nullif(btrim(p_payload->>'severity'),''),nullif(btrim(v_source.severity),''),'medium'));
  if v_severity not in ('low','medium','high','critical') then raise exception 'Unsupported incident severity.' using errcode='23514'; end if;

  v_people:=coalesce(p_payload->'people_involved','[]'::jsonb);
  v_witnesses:=coalesce(p_payload->'witness_accounts','[]'::jsonb);
  v_equipment:=coalesce(p_payload->'equipment_involved','[]'::jsonb);
  v_contributing:=coalesce(p_payload->'contributing_factors','[]'::jsonb);
  v_root:=coalesce(p_payload->'root_factors','[]'::jsonb);
  if jsonb_typeof(v_people)<>'array' or jsonb_typeof(v_witnesses)<>'array'
     or jsonb_typeof(v_equipment)<>'array' or jsonb_typeof(v_contributing)<>'array'
     or jsonb_typeof(v_root)<>'array' then
    raise exception 'People, witnesses, equipment and factor fields must be JSON arrays.' using errcode='23514';
  end if;

  if v_status='ready_for_review' and nullif(btrim(coalesce(p_payload->>'root_cause_summary','')),'') is null then
    raise exception 'Root-cause summary is required before supervisor review.' using errcode='23514';
  end if;
  if v_status='ready_for_review' and nullif(btrim(coalesce(p_payload->>'investigation_summary','')),'') is null then
    raise exception 'Investigation summary is required before supervisor review.' using errcode='23514';
  end if;

  if v_id is null then
    select id into v_id from public.incident_investigations where source_submission_id=v_submission_id;
  end if;

  if v_id is null then
    insert into public.incident_investigations(
      investigation_number,source_submission_id,investigation_status,event_classification,severity,
      people_involved,witness_accounts,equipment_involved,initial_response_summary,scene_secured,
      immediate_hazard_controlled,contributing_factors,root_factors,root_cause_summary,investigation_summary,
      corrective_action_required,corrective_action_rationale,external_reporting_assessment_note,
      created_by_profile_id,updated_by_profile_id
    ) values (
      'INV-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
      v_submission_id,v_status,v_classification,v_severity,
      v_people,v_witnesses,v_equipment,nullif(btrim(p_payload->>'initial_response_summary'),''),
      coalesce((p_payload->>'scene_secured')::boolean,false),
      coalesce((p_payload->>'immediate_hazard_controlled')::boolean,false),
      v_contributing,v_root,nullif(btrim(p_payload->>'root_cause_summary'),''),
      nullif(btrim(p_payload->>'investigation_summary'),''),
      coalesce((p_payload->>'corrective_action_required')::boolean,false),
      nullif(btrim(p_payload->>'corrective_action_rationale'),''),
      nullif(btrim(p_payload->>'external_reporting_assessment_note'),''),
      p_actor_profile_id,p_actor_profile_id
    ) returning * into v_row;
    v_event_type:=case when v_status='ready_for_review' then 'submitted_for_review' else 'created' end;
  else
    update public.incident_investigations set
      investigation_status=v_status,
      event_classification=v_classification,
      severity=v_severity,
      people_involved=v_people,
      witness_accounts=v_witnesses,
      equipment_involved=v_equipment,
      initial_response_summary=nullif(btrim(p_payload->>'initial_response_summary'),''),
      scene_secured=coalesce((p_payload->>'scene_secured')::boolean,false),
      immediate_hazard_controlled=coalesce((p_payload->>'immediate_hazard_controlled')::boolean,false),
      contributing_factors=v_contributing,
      root_factors=v_root,
      root_cause_summary=nullif(btrim(p_payload->>'root_cause_summary'),''),
      investigation_summary=nullif(btrim(p_payload->>'investigation_summary'),''),
      corrective_action_required=coalesce((p_payload->>'corrective_action_required')::boolean,false),
      corrective_action_rationale=nullif(btrim(p_payload->>'corrective_action_rationale'),''),
      external_reporting_assessment_note=nullif(btrim(p_payload->>'external_reporting_assessment_note'),''),
      supervisor_review_status=case when v_status='changes_required' then supervisor_review_status else 'pending' end,
      updated_by_profile_id=p_actor_profile_id,
      updated_at=now()
    where id=v_id and source_submission_id=v_submission_id and investigation_status<>'closed'
    returning * into v_row;
    if not found then raise exception 'Open investigation was not found for this incident.' using errcode='P0002'; end if;
    v_event_type:=case when v_status='ready_for_review' then 'submitted_for_review' else 'updated' end;
  end if;

  insert into public.incident_investigation_events(
    investigation_id,event_type,event_status,event_notes,changed_by_profile_id,metadata
  ) values (
    v_row.id,v_event_type,v_row.investigation_status,
    nullif(btrim(p_payload->>'event_note'),''),p_actor_profile_id,
    jsonb_build_object('source_submission_id',v_submission_id,'event_classification',v_row.event_classification,'severity',v_row.severity)
  );

  return to_jsonb(v_row);
end;
$$;

create or replace function public.ywi_rpc_incident_investigation_review(
  p_investigation_id uuid,p_actor_profile_id uuid,p_decision text,p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_decision text:=lower(coalesce(nullif(btrim(p_decision),''),''));
  v_row public.incident_investigations%rowtype;
  v_event_type text;
begin
  if p_actor_profile_id is null then raise exception 'Actor profile is required.' using errcode='42501'; end if;
  if p_investigation_id is null then raise exception 'Investigation is required.' using errcode='23514'; end if;
  if v_decision not in ('approve','changes_required','reopen') then
    raise exception 'Unsupported investigation review decision.' using errcode='23514';
  end if;

  select * into v_row from public.incident_investigations where id=p_investigation_id;
  if not found then raise exception 'Incident investigation was not found.' using errcode='P0002'; end if;
  if v_decision='approve' and v_row.investigation_status<>'ready_for_review' then
    raise exception 'Investigation must be ready for review before approval.' using errcode='23514';
  end if;

  update public.incident_investigations set
    supervisor_review_status=case v_decision when 'approve' then 'approved' when 'changes_required' then 'changes_required' else 'pending' end,
    supervisor_review_note=nullif(btrim(p_note),''),
    supervisor_reviewed_at=case when v_decision='reopen' then null else now() end,
    supervisor_reviewed_by_profile_id=case when v_decision='reopen' then null else p_actor_profile_id end,
    investigation_status=case
      when v_decision='changes_required' then 'changes_required'
      when v_decision='reopen' then 'in_progress'
      else investigation_status
    end,
    closed_at=case when v_decision='reopen' then null else closed_at end,
    closed_by_profile_id=case when v_decision='reopen' then null else closed_by_profile_id end,
    updated_by_profile_id=p_actor_profile_id,
    updated_at=now()
  where id=p_investigation_id
  returning * into v_row;

  v_event_type:=case v_decision when 'approve' then 'review_approved' when 'changes_required' then 'review_changes_required' else 'reopened' end;
  insert into public.incident_investigation_events(
    investigation_id,event_type,event_status,event_notes,changed_by_profile_id,metadata
  ) values (
    v_row.id,v_event_type,v_row.investigation_status,nullif(btrim(p_note),''),p_actor_profile_id,
    jsonb_build_object('review_status',v_row.supervisor_review_status)
  );
  return to_jsonb(v_row);
end;
$$;

create or replace function public.ywi_rpc_incident_investigation_close(
  p_investigation_id uuid,p_actor_profile_id uuid,p_closure_summary text,p_closure_evidence jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_row public.incident_investigations%rowtype;
  v_evidence jsonb:=coalesce(p_closure_evidence,'[]'::jsonb);
  v_action_count integer:=0;
  v_open_action_count integer:=0;
begin
  if p_actor_profile_id is null then raise exception 'Actor profile is required.' using errcode='42501'; end if;
  if p_investigation_id is null then raise exception 'Investigation is required.' using errcode='23514'; end if;
  if jsonb_typeof(v_evidence)<>'array' or jsonb_array_length(v_evidence)=0 then
    raise exception 'At least one closure-evidence reference is required.' using errcode='23514';
  end if;
  if nullif(btrim(coalesce(p_closure_summary,'')),'') is null then
    raise exception 'Closure summary is required.' using errcode='23514';
  end if;

  select * into v_row from public.incident_investigations where id=p_investigation_id;
  if not found then raise exception 'Incident investigation was not found.' using errcode='P0002'; end if;
  if v_row.supervisor_review_status<>'approved' then
    raise exception 'Supervisor approval is required before investigation closure.' using errcode='23514';
  end if;
  if nullif(btrim(coalesce(v_row.root_cause_summary,'')),'') is null or nullif(btrim(coalesce(v_row.investigation_summary,'')),'') is null then
    raise exception 'Root-cause and investigation summaries are required before closure.' using errcode='23514';
  end if;

  select
    count(*) filter(where task_scope='incident_corrective_action'),
    count(*) filter(where task_scope='incident_corrective_action' and status not in ('closed','cancelled'))
  into v_action_count,v_open_action_count
  from public.corrective_action_tasks
  where source_submission_id=v_row.source_submission_id;

  if v_row.corrective_action_required and v_action_count=0 then
    raise exception 'At least one linked corrective-action task is required before closure.' using errcode='23514';
  end if;
  if v_open_action_count>0 then
    raise exception 'Open corrective-action tasks must be resolved before investigation closure.' using errcode='23514';
  end if;

  update public.incident_investigations set
    investigation_status='closed',
    closure_summary=btrim(p_closure_summary),
    closure_evidence=v_evidence,
    closed_at=now(),
    closed_by_profile_id=p_actor_profile_id,
    updated_by_profile_id=p_actor_profile_id,
    updated_at=now()
  where id=p_investigation_id
  returning * into v_row;

  insert into public.incident_investigation_events(
    investigation_id,event_type,event_status,event_notes,changed_by_profile_id,metadata
  ) values (
    v_row.id,'closed','closed',v_row.closure_summary,p_actor_profile_id,
    jsonb_build_object('closure_evidence_count',jsonb_array_length(v_evidence),'corrective_action_count',v_action_count)
  );
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.ywi_rpc_incident_investigation_save(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_incident_investigation_review(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_incident_investigation_close(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.ywi_rpc_incident_investigation_save(jsonb,uuid) to service_role;
grant execute on function public.ywi_rpc_incident_investigation_review(uuid,uuid,text,text) to service_role;
grant execute on function public.ywi_rpc_incident_investigation_close(uuid,uuid,text,jsonb) to service_role;

insert into public.app_module_write_contracts(
  action_key,owner_module,minimum_access,boundary_mode,domain_key,event_key,cross_module_event,is_enabled,description
) values
  ('incident_investigation_save','safety','approve','write','incident_investigation','safety.incident_investigation.saved',false,true,'Create or update a supervisor-led investigation linked to an existing incident submission.'),
  ('incident_investigation_review','safety','approve','write','incident_investigation','safety.incident_investigation.reviewed',false,true,'Record explicit supervisor review of an incident investigation.'),
  ('incident_investigation_close','safety','approve','write','incident_investigation','safety.incident_investigation.closed',false,true,'Close an approved investigation only after closure evidence and corrective-action checks pass.')
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
    case when (select count(*) from public.app_module_write_contracts where is_enabled)=54 then 'passed' else 'failed' end,
    'Exactly 54 explicitly handled operations-manage actions have enabled write-boundary contracts.'
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

create or replace function public.ywi_incident_investigation_security_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql
stable
security invoker
set search_path=public
as $$
  select 'investigation_tables_private',
    case when
      coalesce((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='incident_investigations'),false)
      and coalesce((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='incident_investigation_events'),false)
      and not exists(
        select 1 from information_schema.table_privileges
        where table_schema='public' and table_name in ('incident_investigations','incident_investigation_events')
          and grantee in ('anon','authenticated','PUBLIC')
      ) then 'passed' else 'failed' end,
    'Investigation records and audit events use RLS and remain service-private.'
  union all
  select 'investigation_view_private',
    case when not exists(
      select 1 from information_schema.table_privileges
      where table_schema='public' and table_name='v_incident_investigation_directory'
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Investigation read model remains server-only.'
  union all
  select 'investigation_rpcs_private',
    case when not exists(
      select 1 from information_schema.routine_privileges
      where specific_schema='public'
        and routine_name in ('ywi_rpc_incident_investigation_save','ywi_rpc_incident_investigation_review','ywi_rpc_incident_investigation_close')
        and grantee in ('anon','authenticated','PUBLIC')
    ) then 'passed' else 'failed' end,
    'Investigation mutation RPCs remain service-role-only.'
  union all
  select 'incident_submission_parent_authority_preserved',
    case when to_regclass('public.submissions') is not null
      and exists(
        select 1 from information_schema.table_constraints
        where table_schema='public' and table_name='incident_investigations'
          and constraint_type='FOREIGN KEY'
      ) then 'passed' else 'failed' end,
    'Investigations attach to the existing incident submission authority.'
  union all
  select 'corrective_action_authority_reused',
    case when to_regclass('public.corrective_action_tasks') is not null
      and position('corrective_action_tasks' in pg_get_functiondef('public.ywi_rpc_incident_investigation_close(uuid,uuid,text,jsonb)'::regprocedure))>0
      then 'passed' else 'failed' end,
    'Investigation closure reuses existing corrective-action tasks rather than creating a duplicate action system.'
  union all
  select 'investigation_write_contracts_registered',
    case when (select count(*) from public.app_module_write_contracts
      where action_key in ('incident_investigation_save','incident_investigation_review','incident_investigation_close')
        and owner_module='safety' and minimum_access='approve' and is_enabled)=3 then 'passed' else 'failed' end,
    'Save, review and closure are explicit Safety-approve contracts.';
$$;
revoke all on function public.ywi_incident_investigation_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_incident_investigation_security_assertions() to service_role;

insert into public.app_schema_versions(
  schema_version,schema_name,description,status,applied_at,applied_by,notes,migration_key,release_label
) values (
  217,'incident_near_miss_investigation',
  'Build 329 structured incident/near-miss investigation, review, audit history and evidence-gated closure linked to existing submissions.',
  'applied',now(),'schema217',
  'Immediate field capture/photos remain in submissions. Corrective actions remain in corrective_action_tasks. Investigation closure does not certify regulatory compliance.',
  '217_incident_near_miss_investigation.sql','schema217'
)
on conflict(schema_version) do update set
  schema_name=excluded.schema_name,description=excluded.description,status='applied',applied_at=now(),
  applied_by=excluded.applied_by,notes=excluded.notes,migration_key=excluded.migration_key,release_label=excluded.release_label;

create or replace view public.v_schema_drift_status
with (security_invoker=true)
as
select
  217 as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0) as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=217 then 'current'
    when coalesce(max(schema_version) filter(where status='applied'),0)>217 then 'ahead'
    else 'drift'
  end as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0)=217 then 'Live database matches the repository schema marker.'
    when coalesce(max(schema_version) filter(where status='applied'),0)>217 then 'Live database is ahead of the repository schema marker.'
    else 'Live database is behind the repository schema marker.'
  end as message,
  now() as checked_at
from public.app_schema_versions;
revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

commit;
