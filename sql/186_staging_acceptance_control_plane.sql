-- 186_staging_acceptance_control_plane.sql
-- Build 2026-09-02r
--
-- Purpose:
-- - Reuse the existing staging run/result/fixture system as the canonical acceptance evidence plane.
-- - Bind new staging acceptance runs to a current scorecard rail, exact source SHA and schema version.
-- - Keep human staging acceptance fail-closed: automated success is evidence, never automatic rail closure.
-- - Make staging evidence and fixture mutation service-role-only.
-- - Surface current staging acceptance state inside Admin > I.T. Readiness.
-- - Advance the canonical schema marker to 186 in the same migration.
--
-- No business rail is auto-completed. Finance posting execution, payment/provider mutation and
-- Production promotion remain untouched.

begin;

alter table public.operations_staging_test_runs
  add column if not exists target_rail_key text references public.admin_scorecard_progress_rails(rail_key) on delete restrict,
  add column if not exists source_sha text,
  add column if not exists source_workflow_run_id bigint,
  add column if not exists schema_version integer,
  add column if not exists fixture_set_id uuid references public.operations_staging_fixture_sets(id) on delete set null,
  add column if not exists acceptance_class text not null default 'legacy',
  add column if not exists human_signoff_required boolean not null default false,
  add column if not exists human_signoff_status text not null default 'not_required',
  add column if not exists human_signoff_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists human_signoff_at timestamptz,
  add column if not exists evidence_note text;

alter table public.operations_staging_test_results
  add column if not exists evidence_kind text not null default 'legacy',
  add column if not exists is_blocking boolean not null default true,
  add column if not exists expected_outcome text,
  add column if not exists observed_outcome text;

do $$
begin
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.operations_staging_test_runs'::regclass
      and conname='operations_staging_test_runs_source_sha_check'
  ) then
    alter table public.operations_staging_test_runs
      add constraint operations_staging_test_runs_source_sha_check
      check(source_sha is null or source_sha ~ '^[0-9a-f]{40}$');
  end if;
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.operations_staging_test_runs'::regclass
      and conname='operations_staging_test_runs_schema_version_check'
  ) then
    alter table public.operations_staging_test_runs
      add constraint operations_staging_test_runs_schema_version_check
      check(schema_version is null or schema_version >= 153);
  end if;
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.operations_staging_test_runs'::regclass
      and conname='operations_staging_test_runs_acceptance_class_check'
  ) then
    alter table public.operations_staging_test_runs
      add constraint operations_staging_test_runs_acceptance_class_check
      check(acceptance_class in ('legacy','staging_acceptance'));
  end if;
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.operations_staging_test_runs'::regclass
      and conname='operations_staging_test_runs_human_signoff_status_check'
  ) then
    alter table public.operations_staging_test_runs
      add constraint operations_staging_test_runs_human_signoff_status_check
      check(human_signoff_status in ('not_required','pending','approved','rejected'));
  end if;
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.operations_staging_test_results'::regclass
      and conname='operations_staging_test_results_evidence_kind_check'
  ) then
    alter table public.operations_staging_test_results
      add constraint operations_staging_test_results_evidence_kind_check
      check(evidence_kind in ('legacy','automated','runtime','browser','manual'));
  end if;
end;
$$;

create index if not exists operations_staging_test_runs_target_rail_idx
  on public.operations_staging_test_runs(target_rail_key,started_at desc)
  where target_rail_key is not null;
create index if not exists operations_staging_test_runs_source_idx
  on public.operations_staging_test_runs(schema_version,source_sha)
  where source_sha is not null;

-- The historical test tables had RLS but retained broad table grants with no policies.
-- Remove those grants so the control plane is private by privilege as well as by RLS.
alter table public.operations_staging_test_runs enable row level security;
alter table public.operations_staging_test_results enable row level security;
alter table public.operations_staging_fixture_sets enable row level security;
alter table public.operations_staging_fixture_records enable row level security;

revoke all on table public.operations_staging_test_runs from public,anon,authenticated;
revoke all on table public.operations_staging_test_results from public,anon,authenticated;
revoke all on table public.operations_staging_fixture_sets from public,anon,authenticated;
revoke all on table public.operations_staging_fixture_records from public,anon,authenticated;
grant select,insert,update,delete on table public.operations_staging_test_runs to service_role;
grant select,insert,update,delete on table public.operations_staging_test_results to service_role;
grant select,insert,update,delete on table public.operations_staging_fixture_sets to service_role;
grant select,insert,update,delete on table public.operations_staging_fixture_records to service_role;

-- Historical fixture RPCs are SECURITY DEFINER and accept an explicit actor profile ID.
-- They therefore must never be browser-callable; staging automation invokes them with service role.
revoke all on function public.ywi_rpc_create_staging_fixture_set(uuid,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_cleanup_staging_fixture_set(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ywi_rpc_create_staging_fixture_set(uuid,text) to service_role;
grant execute on function public.ywi_rpc_cleanup_staging_fixture_set(uuid,uuid,text) to service_role;

create or replace function public.ywi_rpc_start_staging_acceptance_run(
  p_actor_profile_id uuid,
  p_run_key text,
  p_suite_name text,
  p_target_rail_key text,
  p_source_sha text,
  p_schema_version integer,
  p_source_workflow_run_id bigint default null,
  p_fixture_set_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_run public.operations_staging_test_runs%rowtype;
  v_expected_schema integer;
  v_latest_schema integer;
  v_schema_status text;
  v_requires_human boolean;
  v_resolution_class text;
  v_rail_status text;
  v_fixture public.operations_staging_fixture_sets%rowtype;
  v_key text := btrim(coalesce(p_run_key,''));
  v_suite text := btrim(coalesce(p_suite_name,''));
  v_rail text := btrim(coalesce(p_target_rail_key,''));
  v_sha text := lower(btrim(coalesce(p_source_sha,'')));
begin
  perform public.ywi_require_rpc_rank(p_actor_profile_id,45,'start staging acceptance');

  if v_key='' or length(v_key)>180 then
    raise exception 'A bounded staging run key is required.' using errcode='22023';
  end if;
  if v_suite='' or length(v_suite)>180 then
    raise exception 'A staging suite name is required.' using errcode='22023';
  end if;
  if v_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'A full lowercase 40-character source SHA is required.' using errcode='22023';
  end if;

  select expected_schema_version,latest_applied_schema_version,drift_status
    into v_expected_schema,v_latest_schema,v_schema_status
  from public.v_schema_drift_status
  limit 1;

  if v_schema_status<>'current'
     or p_schema_version is distinct from v_expected_schema
     or v_latest_schema < v_expected_schema then
    raise exception 'Staging acceptance requires the current schema marker. Expected %, applied %, supplied %.',
      v_expected_schema,v_latest_schema,p_schema_version using errcode='23514';
  end if;

  select c.resolution_class,c.requires_human,r.rail_status
    into v_resolution_class,v_requires_human,v_rail_status
  from public.admin_scorecard_progress_rails r
  join public.it_scorecard_rail_resolution_contracts c on c.rail_key=r.rail_key
  where r.rail_key=v_rail;

  if not found then
    raise exception 'Target readiness rail % does not exist or has no resolution contract.',v_rail using errcode='23503';
  end if;
  if v_resolution_class<>'staging_acceptance' then
    raise exception 'Target rail % is %, not staging_acceptance.',v_rail,v_resolution_class using errcode='23514';
  end if;
  if v_rail_status='complete' then
    raise exception 'Target rail % is already complete; do not create new acceptance evidence against a closed rail.',v_rail using errcode='23514';
  end if;

  if p_fixture_set_id is not null then
    select * into v_fixture
    from public.operations_staging_fixture_sets
    where id=p_fixture_set_id;
    if not found
       or v_fixture.environment_label<>'staging'
       or v_fixture.fixture_label not like 'STAGING-%'
       or v_fixture.fixture_status not in ('created','in_use') then
      raise exception 'The supplied fixture set is not an active tracked STAGING fixture set.' using errcode='23514';
    end if;
  end if;

  insert into public.operations_staging_test_runs(
    run_key,environment_label,suite_name,run_status,requested_by_profile_id,summary,
    target_rail_key,source_sha,source_workflow_run_id,schema_version,fixture_set_id,
    acceptance_class,human_signoff_required,human_signoff_status,evidence_note
  ) values(
    v_key,'staging',v_suite,'started',p_actor_profile_id,
    jsonb_build_object(
      'build','2026-09-02r','schema',186,'target_rail_key',v_rail,
      'source_sha',v_sha,'source_workflow_run_id',p_source_workflow_run_id,
      'fixture_set_id',p_fixture_set_id,'auto_close_allowed',false
    ),
    v_rail,v_sha,p_source_workflow_run_id,p_schema_version,p_fixture_set_id,
    'staging_acceptance',coalesce(v_requires_human,true),
    case when coalesce(v_requires_human,true) then 'pending' else 'not_required' end,
    'Schema 186 staging acceptance evidence. Automated pass never auto-closes the target rail.'
  ) returning * into v_run;

  return jsonb_build_object(
    'run_id',v_run.id,'run_key',v_run.run_key,'target_rail_key',v_run.target_rail_key,
    'schema_version',v_run.schema_version,'source_sha',v_run.source_sha,
    'human_signoff_required',v_run.human_signoff_required,
    'human_signoff_status',v_run.human_signoff_status,'run_status',v_run.run_status
  );
end;
$$;

create or replace function public.ywi_rpc_record_staging_acceptance_result(
  p_run_id uuid,
  p_actor_profile_id uuid,
  p_case_key text,
  p_case_status text,
  p_evidence_kind text default 'automated',
  p_is_blocking boolean default true,
  p_expected_outcome text default null,
  p_observed_outcome text default null,
  p_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_run public.operations_staging_test_runs%rowtype;
  v_case_key text := btrim(coalesce(p_case_key,''));
  v_status text := lower(btrim(coalesce(p_case_status,'')));
  v_kind text := lower(btrim(coalesce(p_evidence_kind,'automated')));
  v_result public.operations_staging_test_results%rowtype;
begin
  perform public.ywi_require_rpc_rank(p_actor_profile_id,45,'record staging acceptance evidence');
  select * into v_run from public.operations_staging_test_runs where id=p_run_id for update;
  if not found or v_run.environment_label<>'staging' or v_run.acceptance_class<>'staging_acceptance' then
    raise exception 'A tracked Schema 186 staging acceptance run is required.' using errcode='23514';
  end if;
  if v_run.run_status<>'started' then
    raise exception 'Acceptance evidence can only be recorded while the run is started.' using errcode='23514';
  end if;
  if v_case_key='' or length(v_case_key)>180 then
    raise exception 'A bounded case key is required.' using errcode='22023';
  end if;
  if v_status not in ('pending','passed','failed','skipped') then
    raise exception 'Unsupported staging case status %.',v_status using errcode='22023';
  end if;
  if v_kind not in ('automated','runtime','browser','manual') then
    raise exception 'Unsupported evidence kind %.',v_kind using errcode='22023';
  end if;

  insert into public.operations_staging_test_results(
    run_id,case_key,case_status,details,evidence_kind,is_blocking,expected_outcome,observed_outcome
  ) values(
    v_run.id,v_case_key,v_status,coalesce(p_details,'{}'::jsonb),v_kind,coalesce(p_is_blocking,true),
    nullif(left(btrim(coalesce(p_expected_outcome,'')),2000),''),
    nullif(left(btrim(coalesce(p_observed_outcome,'')),2000),'')
  )
  on conflict(run_id,case_key) do update set
    case_status=excluded.case_status,
    details=excluded.details,
    evidence_kind=excluded.evidence_kind,
    is_blocking=excluded.is_blocking,
    expected_outcome=excluded.expected_outcome,
    observed_outcome=excluded.observed_outcome,
    updated_at=now()
  returning * into v_result;

  return jsonb_build_object(
    'result_id',v_result.id,'run_id',v_result.run_id,'case_key',v_result.case_key,
    'case_status',v_result.case_status,'evidence_kind',v_result.evidence_kind,
    'is_blocking',v_result.is_blocking
  );
end;
$$;

create or replace function public.ywi_rpc_finalize_staging_acceptance_run(
  p_run_id uuid,
  p_actor_profile_id uuid,
  p_failure_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_run public.operations_staging_test_runs%rowtype;
  v_total integer;
  v_pending integer;
  v_blocking_failed integer;
  v_status text;
  v_acceptance text;
begin
  perform public.ywi_require_rpc_rank(p_actor_profile_id,45,'finalize staging acceptance');
  select * into v_run from public.operations_staging_test_runs where id=p_run_id for update;
  if not found or v_run.environment_label<>'staging' or v_run.acceptance_class<>'staging_acceptance' then
    raise exception 'A tracked Schema 186 staging acceptance run is required.' using errcode='23514';
  end if;
  if v_run.run_status<>'started' then
    raise exception 'Only a started staging acceptance run can be finalized.' using errcode='23514';
  end if;

  select count(*)::int,
         count(*) filter(where case_status='pending')::int,
         count(*) filter(where case_status='failed' and is_blocking)::int
    into v_total,v_pending,v_blocking_failed
  from public.operations_staging_test_results
  where run_id=v_run.id;

  if v_total=0 then
    raise exception 'A staging acceptance run cannot be finalized without evidence rows.' using errcode='23514';
  end if;
  if v_pending>0 then
    raise exception 'A staging acceptance run cannot be finalized while % evidence row(s) are pending.',v_pending using errcode='23514';
  end if;

  v_status := case when v_blocking_failed>0 then 'failed' else 'passed' end;
  update public.operations_staging_test_runs
  set run_status=v_status,
      finished_at=now(),
      failure_reason=case
        when v_status='failed' then nullif(left(btrim(coalesce(p_failure_reason,'One or more blocking staging acceptance cases failed.')),2000),'')
        else null
      end,
      summary=coalesce(summary,'{}'::jsonb) || jsonb_build_object(
        'result_count',v_total,'blocking_failed_count',v_blocking_failed,'finalized_at',now(),
        'automated_run_status',v_status,'auto_close_allowed',false
      ),
      updated_at=now()
  where id=v_run.id
  returning * into v_run;

  v_acceptance := case
    when v_status='failed' then 'failed'
    when v_run.human_signoff_required then 'awaiting_human_signoff'
    else 'accepted'
  end;

  return jsonb_build_object(
    'run_id',v_run.id,'run_status',v_run.run_status,'target_rail_key',v_run.target_rail_key,
    'result_count',v_total,'blocking_failed_count',v_blocking_failed,
    'human_signoff_required',v_run.human_signoff_required,
    'human_signoff_status',v_run.human_signoff_status,
    'acceptance_status',v_acceptance,'scorecard_auto_closed',false
  );
end;
$$;

create or replace function public.ywi_rpc_signoff_staging_acceptance_run(
  p_run_id uuid,
  p_actor_profile_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_run public.operations_staging_test_runs%rowtype;
  v_decision text := lower(btrim(coalesce(p_decision,'')));
begin
  perform public.ywi_require_rpc_rank(p_actor_profile_id,45,'sign off staging acceptance');
  if v_decision not in ('approved','rejected') then
    raise exception 'Staging acceptance signoff must be approved or rejected.' using errcode='22023';
  end if;

  select * into v_run from public.operations_staging_test_runs where id=p_run_id for update;
  if not found or v_run.environment_label<>'staging' or v_run.acceptance_class<>'staging_acceptance' then
    raise exception 'A tracked Schema 186 staging acceptance run is required.' using errcode='23514';
  end if;
  if not v_run.human_signoff_required then
    raise exception 'This staging acceptance run does not require human signoff.' using errcode='23514';
  end if;
  if v_decision='approved' and v_run.run_status<>'passed' then
    raise exception 'A staging acceptance run cannot be approved unless automated/runtime evidence passed.' using errcode='23514';
  end if;
  if v_run.run_status='started' then
    raise exception 'Finalize the staging acceptance evidence before human signoff.' using errcode='23514';
  end if;

  update public.operations_staging_test_runs
  set human_signoff_status=v_decision,
      human_signoff_by_profile_id=p_actor_profile_id,
      human_signoff_at=now(),
      evidence_note=coalesce(nullif(left(btrim(coalesce(p_note,'')),2000),''),evidence_note),
      summary=coalesce(summary,'{}'::jsonb) || jsonb_build_object(
        'human_signoff_status',v_decision,'human_signoff_at',now(),
        'human_signoff_by_profile_id',p_actor_profile_id,'scorecard_auto_closed',false
      ),
      updated_at=now()
  where id=v_run.id
  returning * into v_run;

  return jsonb_build_object(
    'run_id',v_run.id,'target_rail_key',v_run.target_rail_key,
    'run_status',v_run.run_status,'human_signoff_status',v_run.human_signoff_status,
    'human_signoff_at',v_run.human_signoff_at,
    'acceptance_status',case when v_decision='approved' then 'accepted' else 'rejected' end,
    'scorecard_auto_closed',false
  );
end;
$$;

revoke all on function public.ywi_rpc_start_staging_acceptance_run(uuid,text,text,text,text,integer,bigint,uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_record_staging_acceptance_result(uuid,uuid,text,text,text,boolean,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.ywi_rpc_finalize_staging_acceptance_run(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_signoff_staging_acceptance_run(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ywi_rpc_start_staging_acceptance_run(uuid,text,text,text,text,integer,bigint,uuid) to service_role;
grant execute on function public.ywi_rpc_record_staging_acceptance_result(uuid,uuid,text,text,text,boolean,text,text,jsonb) to service_role;
grant execute on function public.ywi_rpc_finalize_staging_acceptance_run(uuid,uuid,text) to service_role;
grant execute on function public.ywi_rpc_signoff_staging_acceptance_run(uuid,uuid,text,text) to service_role;

create or replace view public.v_it_staging_acceptance_status
with (security_invoker=true)
as
with staging_rails as (
  select
    r.rail_key,r.rail_area,r.rail_title,r.rail_status,r.progress_percent,
    r.next_action_hint,r.owner_hint,r.sort_order,
    c.resolution_class,c.requires_human,c.requires_external,c.resolution_note
  from public.admin_scorecard_progress_rails r
  join public.it_scorecard_rail_resolution_contracts c on c.rail_key=r.rail_key
  where r.rail_status<>'complete'
    and c.resolution_class='staging_acceptance'
), schema_state as (
  select expected_schema_version,latest_applied_schema_version,drift_status
  from public.v_schema_drift_status
  limit 1
)
select
  sr.rail_key,sr.rail_area,sr.rail_title,sr.rail_status,sr.progress_percent,
  sr.next_action_hint,sr.owner_hint,sr.sort_order,sr.resolution_class,
  sr.requires_human,sr.requires_external,sr.resolution_note,
  lr.id as run_id,lr.run_key,lr.suite_name,lr.run_status,
  lr.source_sha,lr.source_workflow_run_id,lr.schema_version,lr.fixture_set_id,
  fs.fixture_status,fs.fixture_label,fs.cleaned_at,
  lr.human_signoff_required,lr.human_signoff_status,lr.human_signoff_by_profile_id,lr.human_signoff_at,
  lr.started_at,lr.finished_at,lr.evidence_note,
  coalesce(rs.result_count,0)::int as result_count,
  coalesce(rs.passed_count,0)::int as passed_count,
  coalesce(rs.failed_count,0)::int as failed_count,
  coalesce(rs.blocking_failed_count,0)::int as blocking_failed_count,
  coalesce(rs.skipped_count,0)::int as skipped_count,
  cs.expected_schema_version,
  case
    when lr.id is null then 'pending'
    when lr.schema_version is distinct from cs.expected_schema_version then 'stale_schema'
    when lr.run_status='failed' then 'failed'
    when lr.run_status='started' then 'in_progress'
    when lr.human_signoff_status='rejected' then 'rejected'
    when lr.run_status='passed' and coalesce(lr.human_signoff_required,sr.requires_human)
         and lr.human_signoff_status='approved' then 'accepted'
    when lr.run_status='passed' and coalesce(lr.human_signoff_required,sr.requires_human)
         then 'awaiting_human_signoff'
    when lr.run_status='passed' then 'accepted'
    else 'pending'
  end::text as staging_acceptance_status,
  case
    when lr.run_status='passed'
      and (not coalesce(lr.human_signoff_required,sr.requires_human)
           or lr.human_signoff_status='approved')
      and lr.schema_version=cs.expected_schema_version
    then true else false
  end as acceptance_complete,
  now() as checked_at
from staging_rails sr
cross join schema_state cs
left join lateral (
  select r.*
  from public.operations_staging_test_runs r
  where r.target_rail_key=sr.rail_key
    and r.acceptance_class='staging_acceptance'
  order by r.started_at desc,r.id desc
  limit 1
) lr on true
left join public.operations_staging_fixture_sets fs on fs.id=lr.fixture_set_id
left join lateral (
  select count(*)::int as result_count,
         count(*) filter(where case_status='passed')::int as passed_count,
         count(*) filter(where case_status='failed')::int as failed_count,
         count(*) filter(where case_status='failed' and is_blocking)::int as blocking_failed_count,
         count(*) filter(where case_status='skipped')::int as skipped_count
  from public.operations_staging_test_results rr
  where rr.run_id=lr.id
) rs on true
order by sr.sort_order,sr.rail_key;

revoke all on table public.v_it_staging_acceptance_status from public,anon,authenticated;
grant select on table public.v_it_staging_acceptance_status to service_role;

create or replace function public.ywi_staging_acceptance_security_assertions()
returns table(assertion_key text,assertion_status text,assertion_detail text)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select 'staging_control_tables_private',
    case when
      not exists(
        select 1 from information_schema.table_privileges
        where table_schema='public'
          and table_name in (
            'operations_staging_test_runs','operations_staging_test_results',
            'operations_staging_fixture_sets','operations_staging_fixture_records'
          )
          and grantee in ('anon','authenticated','PUBLIC')
      )
      and not exists(
        select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public'
          and c.relname in (
            'operations_staging_test_runs','operations_staging_test_results',
            'operations_staging_fixture_sets','operations_staging_fixture_records'
          )
          and c.relrowsecurity is not true
      )
    then 'passed' else 'failed' end,
    'Staging run/result/fixture tables are RLS-enabled and service-private.'
  union all
  select 'staging_fixture_rpcs_service_only',
    case when not exists(
      select 1 from information_schema.routine_privileges
      where routine_schema='public'
        and routine_name in ('ywi_rpc_create_staging_fixture_set','ywi_rpc_cleanup_staging_fixture_set')
        and grantee in ('anon','authenticated','PUBLIC') and privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
    'SECURITY DEFINER staging fixture RPCs cannot be invoked by browser roles.'
  union all
  select 'staging_acceptance_rpcs_service_only',
    case when not exists(
      select 1 from information_schema.routine_privileges
      where routine_schema='public'
        and routine_name in (
          'ywi_rpc_start_staging_acceptance_run','ywi_rpc_record_staging_acceptance_result',
          'ywi_rpc_finalize_staging_acceptance_run','ywi_rpc_signoff_staging_acceptance_run'
        )
        and grantee in ('anon','authenticated','PUBLIC') and privilege_type='EXECUTE'
    ) then 'passed' else 'failed' end,
    'Schema 186 staging acceptance mutation RPCs are service-role-only.'
  union all
  select 'staging_environment_locked',
    case when
      not exists(select 1 from public.operations_staging_test_runs where environment_label<>'staging')
      and not exists(select 1 from public.operations_staging_fixture_sets where environment_label<>'staging')
    then 'passed' else 'failed' end,
    'Acceptance evidence and fixtures remain explicitly staging-only.'
  union all
  select 'staging_human_signoff_fail_closed',
    case when not exists(
      select 1 from public.v_it_staging_acceptance_status
      where requires_human=true
        and acceptance_complete=true
        and human_signoff_status is distinct from 'approved'
    ) then 'passed' else 'failed' end,
    'A human-required staging rail cannot become acceptance-complete without explicit approval.'
  union all
  select 'staging_active_runs_current_schema',
    case when not exists(
      select 1 from public.operations_staging_test_runs r
      cross join public.v_schema_drift_status s
      where r.acceptance_class='staging_acceptance'
        and r.run_status='started'
        and (r.schema_version is distinct from s.expected_schema_version or r.source_sha is null)
    ) then 'passed' else 'failed' end,
    'Every active Schema 186 acceptance run is bound to the current schema and exact source SHA.'
  union all
  select 'staging_evidence_never_auto_closes_scorecard',
    case when not exists(
      select 1
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public'
        and p.proname in (
          'ywi_rpc_start_staging_acceptance_run','ywi_rpc_record_staging_acceptance_result',
          'ywi_rpc_finalize_staging_acceptance_run','ywi_rpc_signoff_staging_acceptance_run'
        )
        and pg_get_functiondef(p.oid) ~* 'update[[:space:]]+public\\.admin_scorecard_progress_rails'
    ) then 'passed' else 'failed' end,
    'Staging evidence/signoff RPCs never update readiness rail completion state.';
$$;

revoke all on function public.ywi_staging_acceptance_security_assertions() from public,anon,authenticated;
grant execute on function public.ywi_staging_acceptance_security_assertions() to service_role;

insert into public.it_readiness_check_registry(
  check_key,check_group,check_title,severity_if_failed,action_hint,route_hint,sort_order,is_enabled
) values(
  'staging_acceptance_control_plane','Acceptance','Staging acceptance evidence is current, private and human-gated','critical',
  'Use the dedicated staging runner against a non-production project, resolve blocking cases, then record explicit human signoff. Automated success alone never closes the rail.',
  'Admin > I.T. Readiness',38,true
)
on conflict(check_key) do update set
  check_group=excluded.check_group,check_title=excluded.check_title,severity_if_failed=excluded.severity_if_failed,
  action_hint=excluded.action_hint,route_hint=excluded.route_hint,sort_order=excluded.sort_order,
  is_enabled=excluded.is_enabled,updated_at=now();

insert into public.admin_scorecard_progress_rails(
  rail_key,rail_area,rail_title,rail_status,progress_percent,current_value,target_value,
  next_action_hint,owner_hint,sort_order,metadata
) values(
  'schema186_staging_acceptance_control_plane','release','Staging acceptance control plane and evidence runner modernization',
  'active',90,9,10,
  'Verify service-private staging evidence, project-ref production guard, current-schema/source binding, Admin I.T. rendering, and exact-main release evidence. Do not auto-close any business acceptance rail.',
  'I.T. / Release',106,
  jsonb_build_object(
    'schema',186,'build','2026-09-02r','business_rail_auto_close',false,
    'finance_mutation',false,'payment_provider_mutation',false,'production_promotion',false
  )
)
on conflict(rail_key) do update set
  rail_area=excluded.rail_area,rail_title=excluded.rail_title,rail_status=excluded.rail_status,
  progress_percent=excluded.progress_percent,current_value=excluded.current_value,target_value=excluded.target_value,
  next_action_hint=excluded.next_action_hint,owner_hint=excluded.owner_hint,sort_order=excluded.sort_order,
  metadata=excluded.metadata,updated_at=now();

insert into public.it_scorecard_rail_resolution_contracts(
  rail_key,resolution_class,requires_human,requires_external,auto_close_allowed,resolution_note,introduced_by_schema
) values(
  'schema186_staging_acceptance_control_plane','build_acceptance',false,false,false,
  'Close Build 186 only after Schema 186 assertions, current Admin I.T. rendering and exact-main source/browser evidence are green. This build must not auto-close business acceptance rails.',186
)
on conflict(rail_key) do update set
  resolution_class=excluded.resolution_class,requires_human=excluded.requires_human,
  requires_external=excluded.requires_external,auto_close_allowed=excluded.auto_close_allowed,
  resolution_note=excluded.resolution_note,introduced_by_schema=excluded.introduced_by_schema,updated_at=now();

create or replace view public.v_schema_drift_status
with (security_invoker=true)
as
select
  186::int as expected_schema_version,
  coalesce(max(schema_version) filter(where status='applied'),0)::int as latest_applied_schema_version,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0) >= 186 then 'current'
    else 'behind'
  end::text as drift_status,
  case
    when coalesce(max(schema_version) filter(where status='applied'),0) >= 186
      then 'Live database is at or ahead of the repo schema marker.'
    else 'Live database is behind the deployed app. Apply migrations through schema 186 in order.'
  end::text as message,
  now() as checked_at
from public.app_schema_versions;

revoke all on table public.v_schema_drift_status from public,anon,authenticated;
grant select on table public.v_schema_drift_status to service_role;

insert into public.app_schema_versions(
  schema_version,migration_key,schema_name,release_label,description,status,notes
) values(
  186,'186_staging_acceptance_control_plane','186_staging_acceptance_control_plane.sql','2026-09-02r',
  'Reuses the canonical staging fixture/run/result system as a private, current-schema, source-bound and human-gated acceptance evidence control plane.',
  'applied',
  'No business rail is auto-closed. Finance posting execution, provider/payment mutation and Production promotion remain untouched.'
)
on conflict(schema_version) do update set
  migration_key=excluded.migration_key,schema_name=excluded.schema_name,release_label=excluded.release_label,
  description=excluded.description,status=excluded.status,notes=excluded.notes,applied_at=now();

commit;
