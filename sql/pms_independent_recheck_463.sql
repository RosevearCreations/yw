-- YW 463: distinct human reviewer assignment and immutable documentary outcome linking.
-- Never certifies the new evidence or changes original 457/Safety/Jobs/release decisions.
begin;
create table if not exists public.ywi_recheck_assignments_463 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 operation_id uuid not null,
 evidence_outcome_id uuid not null unique references public.ywi_evidence_outcomes_462(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 source_reference text not null check(char_length(btrim(source_reference)) between 4 and 250),
 notes text check(notes is null or char_length(notes)<=500),
 created_at timestamptz not null default now(),
 unique(company_id,operation_id),check(owner_user_id<>reviewer_user_id)
);
create index if not exists ywi_463_reviewer_inbox on public.ywi_recheck_assignments_463(reviewer_user_id,created_at desc);
alter table public.ywi_recheck_assignments_463 enable row level security;
revoke all on public.ywi_recheck_assignments_463 from public,anon,authenticated;

create table if not exists public.ywi_recheck_outcomes_463 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 operation_id uuid not null,
 assignment_id uuid not null unique references public.ywi_recheck_assignments_463(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 disposition text not null check(disposition in ('source_corresponds','evidence_incomplete','further_review_required')),
 source_reference text not null check(char_length(btrim(source_reference)) between 4 and 250),
 notes text check(notes is null or char_length(notes)<=500),
 created_at timestamptz not null default now(),unique(company_id,operation_id)
);
alter table public.ywi_recheck_outcomes_463 enable row level security;
revoke all on public.ywi_recheck_outcomes_463 from public,anon,authenticated;

create or replace function public.ywi_463_assert_source(p_company_id uuid,p_outcome_id uuid)
returns text language plpgsql volatile security definer set search_path='' as $$
declare v record;v_module text;
begin
 select o.id,o.outcome,o.created_at outcome_at,r.created_at request_at,r.owner_user_id,
  a.id reassessment_id,a.reassessor_user_id,a.created_at reassessed_at,
  t.comparison_id,c.reviewer_user_id comparing_reviewer_id
 into v from public.ywi_evidence_outcomes_462 o
 join public.ywi_reassessment_evidence_requests_461 r on r.id=o.request_id and r.company_id=o.company_id
 join public.ywi_retest_reassessments_460 a on a.id=r.reassessment_id and a.company_id=o.company_id
 join public.ywi_retest_triages_460 t on t.id=a.triage_id and t.company_id=a.company_id
 join public.ywi_retest_comparisons_459 c on c.id=t.comparison_id and c.company_id=a.company_id
 where o.id=p_outcome_id and o.company_id=p_company_id;
 if not found or v.outcome<>'evidence_received' or v.outcome_at<v.request_at or v.request_at<v.reassessed_at
  or v.owner_user_id is distinct from (select owner_user_id from public.ywi_companies where id=p_company_id)
 then raise exception '463 verified received-outcome chain required: HOLD';end if;
 v_module:=public.ywi_460_assert_comparison_source(p_company_id,v.comparison_id);
 return v_module;
end $$;
revoke all on function public.ywi_463_assert_source(uuid,uuid) from public,anon,authenticated;

create or replace function public.ywi_rpc_recheck_inbox_463()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_total integer;v_rows jsonb;
begin
 if v_actor is null or not exists(select 1 from public.profiles where id=v_actor and is_active is true)
 then raise exception '463 active sign-in required';end if;
 select count(*) into v_total from public.ywi_companies c where c.owner_user_id=v_actor
  or exists(select 1 from public.ywi_recheck_assignments_463 a where a.company_id=c.id and a.reviewer_user_id=v_actor);
 select coalesce(jsonb_agg(to_jsonb(q) order by q.name,q.id),'[]'::jsonb) into v_rows from (
  select c.id,c.name,(c.owner_user_id=v_actor) is_owner,
   exists(select 1 from public.ywi_recheck_assignments_463 a where a.company_id=c.id and a.reviewer_user_id=v_actor) is_reviewer
  from public.ywi_companies c where c.owner_user_id=v_actor
   or exists(select 1 from public.ywi_recheck_assignments_463 a where a.company_id=c.id and a.reviewer_user_id=v_actor)
  order by c.name,c.id limit 60) q;
 return jsonb_build_object('captured_at',statement_timestamp(),'viewer_id',v_actor,
  'companies',v_rows,'total',v_total,'sample_capped',v_total>60,'field_accepted',false,'release_green',false,'outbound_actions',false);
end $$;

create or replace function public.ywi_rpc_recheck_workspace_463(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_owner boolean;v_reviewer boolean;v_role text;v_level text;
 v_services jsonb;v_cases jsonb;v_assignments jsonb;v_outcomes jsonb;v_total integer;v_at integer;v_ot integer;v_case record;
begin
 select lower(role) into v_role from public.profiles where id=v_actor and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level not in ('view','edit','approve','manage') then raise exception '463 Jobs access required';end if;
 select exists(select 1 from public.ywi_companies where id=p_company_id and owner_user_id=v_actor) into v_owner;
 select exists(select 1 from public.ywi_recheck_assignments_463 where company_id=p_company_id and reviewer_user_id=v_actor) into v_reviewer;
 if not v_owner and not v_reviewer then raise exception '463 foreign company denied';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.module_key),'[]'::jsonb) into v_services from
  (select company_id,module_key,enabled from public.ywi_company_service_modules where company_id=p_company_id order by module_key) q;
 select count(*) into v_total from public.ywi_evidence_outcomes_462 o
  left join public.ywi_recheck_assignments_463 a on a.evidence_outcome_id=o.id and a.company_id=o.company_id
  where o.company_id=p_company_id and o.outcome='evidence_received' and (v_owner or a.reviewer_user_id=v_actor);
 if v_total>60 then raise exception '463 source sample capped: HOLD';end if;
 for v_case in select t.comparison_id from public.ywi_evidence_outcomes_462 o
  join public.ywi_reassessment_evidence_requests_461 r on r.id=o.request_id and r.company_id=o.company_id
  join public.ywi_retest_reassessments_460 x on x.id=r.reassessment_id and x.company_id=r.company_id
  join public.ywi_retest_triages_460 t on t.id=x.triage_id and t.company_id=x.company_id
  left join public.ywi_recheck_assignments_463 a on a.evidence_outcome_id=o.id and a.company_id=o.company_id
  where o.company_id=p_company_id and o.outcome='evidence_received' and (v_owner or a.reviewer_user_id=v_actor)
 loop perform public.ywi_460_assert_comparison_source(p_company_id,v_case.comparison_id);end loop;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.outcome_at desc,q.evidence_outcome_id desc),'[]'::jsonb) into v_cases from (
  select o.id evidence_outcome_id,o.company_id,o.owner_user_id,o.outcome,o.source_reference evidence_reference,o.created_at outcome_at,
   r.id request_id,r.reassessment_id,r.created_at request_at,x.reassessor_user_id,x.created_at reassessed_at,
   t.comparison_id,c.reviewer_user_id comparing_reviewer_id,rev.service_module_key,rev.target_table,rev.target_id
  from public.ywi_evidence_outcomes_462 o
  join public.ywi_reassessment_evidence_requests_461 r on r.id=o.request_id and r.company_id=o.company_id
  join public.ywi_retest_reassessments_460 x on x.id=r.reassessment_id and x.company_id=o.company_id
  join public.ywi_retest_triages_460 t on t.id=x.triage_id and t.company_id=o.company_id
  join public.ywi_retest_comparisons_459 c on c.id=t.comparison_id and c.company_id=o.company_id
  join public.ywi_retest_assignments_459 a459 on a459.id=c.assignment_id and a459.company_id=o.company_id
  join public.ywi_owner_independent_followups_458 f on f.id=a459.owner_followup_id and f.company_id=o.company_id
  join public.ywi_first_service_decisions_457 d on d.id=f.independent_decision_id and d.company_id=o.company_id
  join public.ywi_first_service_handoffs_457 h on h.id=d.handoff_id and h.company_id=o.company_id
  join public.ywi_first_service_reviews_456 rev on rev.id=h.owner_review_id and rev.company_id=o.company_id
  left join public.ywi_recheck_assignments_463 a on a.evidence_outcome_id=o.id and a.company_id=o.company_id
  where o.company_id=p_company_id and o.outcome='evidence_received' and (v_owner or a.reviewer_user_id=v_actor)
  order by o.created_at desc,o.id desc limit 60) q;
 select count(*) into v_at from public.ywi_recheck_assignments_463 where company_id=p_company_id and (v_owner or reviewer_user_id=v_actor);
 select count(*) into v_ot from public.ywi_recheck_outcomes_463 x join public.ywi_recheck_assignments_463 a on a.id=x.assignment_id
  where x.company_id=p_company_id and (v_owner or a.reviewer_user_id=v_actor);
 if v_at>60 or v_ot>60 then raise exception '463 journal sample capped: HOLD';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]'::jsonb) into v_assignments from
  (select id,company_id,evidence_outcome_id,owner_user_id,reviewer_user_id,source_reference,created_at
   from public.ywi_recheck_assignments_463 where company_id=p_company_id and (v_owner or reviewer_user_id=v_actor)
   order by created_at desc,id desc limit 60) q;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]'::jsonb) into v_outcomes from
  (select x.id,x.company_id,x.assignment_id,x.reviewer_user_id,x.disposition,x.source_reference,x.created_at
   from public.ywi_recheck_outcomes_463 x join public.ywi_recheck_assignments_463 a on a.id=x.assignment_id
   where x.company_id=p_company_id and (v_owner or a.reviewer_user_id=v_actor)
   order by x.created_at desc,x.id desc limit 60) q;
 return jsonb_build_object('company_id',p_company_id,'viewer_id',v_actor,'captured_at',statement_timestamp(),
  'is_owner',v_owner,'is_reviewer',v_reviewer,'services',v_services,
  'cases',v_cases,'case_total',v_total,'case_sample_capped',false,
  'assignments',v_assignments,'assignment_total',v_at,'assignment_sample_capped',false,
  'rechecks',v_outcomes,'recheck_total',v_ot,'recheck_sample_capped',false,
  'field_accepted',false,'service_authorized',false,'independent_reapproval',false,
  'release_green',false,'outbound_actions',false,'mutation_authorized',false,'synthetic',false);
end $$;

create or replace function public.ywi_rpc_assign_recheck_463(
 p_company_id uuid,p_operation_id uuid,p_evidence_outcome_id uuid,p_reviewer_user_id uuid,p_source_reference text,p_notes text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_owner uuid:=auth.uid();v_role text;v_level text;v_other_role text;v_other_level text;
 v_case record;v_id uuid;v_old record;v_ref text:=btrim(coalesce(p_source_reference,''));v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 perform public.ywi_422_assert_owner(p_company_id);
 if p_operation_id is null or p_evidence_outcome_id is null or p_reviewer_user_id is null or p_reviewer_user_id=v_owner
  or char_length(v_ref) not between 4 and 250 or char_length(coalesce(v_notes,''))>500
 then raise exception '463 invalid recheck assignment';end if;
 select lower(role) into v_role from public.profiles where id=v_owner and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions where profile_id=v_owner and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level not in ('approve','manage') then raise exception '463 owner Jobs approval denied';end if;
 select lower(role) into v_other_role from public.profiles where id=p_reviewer_user_id and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions where profile_id=p_reviewer_user_id and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_other_role and module_key='jobs')) into v_other_level;
 if v_other_role is null or v_other_level not in ('approve','manage') then raise exception '463 independent reviewer Jobs approval denied';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,463));
 select x.reassessor_user_id,c.reviewer_user_id comparing_reviewer_id into v_case
 from public.ywi_evidence_outcomes_462 o
 join public.ywi_reassessment_evidence_requests_461 r on r.id=o.request_id and r.company_id=o.company_id
 join public.ywi_retest_reassessments_460 x on x.id=r.reassessment_id and x.company_id=o.company_id
 join public.ywi_retest_triages_460 t on t.id=x.triage_id and t.company_id=o.company_id
 join public.ywi_retest_comparisons_459 c on c.id=t.comparison_id and c.company_id=o.company_id
 where o.id=p_evidence_outcome_id and o.company_id=p_company_id and o.outcome='evidence_received';
 if not found or p_reviewer_user_id in (v_owner,v_case.reassessor_user_id,v_case.comparing_reviewer_id)
 then raise exception '463 distinct third-party reviewer and received outcome required';end if;
 perform public.ywi_463_assert_source(p_company_id,p_evidence_outcome_id);
 if (select count(*) from public.ywi_recheck_assignments_463 where company_id=p_company_id)>=200 then raise exception '463 assignment capacity HOLD';end if;
 insert into public.ywi_recheck_assignments_463(company_id,operation_id,evidence_outcome_id,owner_user_id,reviewer_user_id,source_reference,notes)
 values(p_company_id,p_operation_id,p_evidence_outcome_id,v_owner,p_reviewer_user_id,v_ref,v_notes)
 on conflict(company_id,operation_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_recheck_assignments_463 where company_id=p_company_id and operation_id=p_operation_id;
  if not found or v_old.evidence_outcome_id is distinct from p_evidence_outcome_id or v_old.owner_user_id is distinct from v_owner
   or v_old.reviewer_user_id is distinct from p_reviewer_user_id or v_old.source_reference is distinct from v_ref or v_old.notes is distinct from v_notes
  then raise exception '463 assignment replay differs';end if;v_id:=v_old.id;
 end if;
 return jsonb_build_object('id',v_id,'company_id',p_company_id,'recorded',true,
  'field_accepted',false,'service_authorized',false,'independent_reapproval',false,'release_green',false,'outbound_actions',false);
end $$;

create or replace function public.ywi_rpc_record_recheck_463(
 p_company_id uuid,p_operation_id uuid,p_assignment_id uuid,p_disposition text,p_source_reference text,p_notes text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_role text;v_level text;v_assignment record;v_id uuid;v_old record;
 v_ref text:=btrim(coalesce(p_source_reference,''));v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 if p_operation_id is null or p_assignment_id is null or p_disposition not in ('source_corresponds','evidence_incomplete','further_review_required')
  or char_length(v_ref) not between 4 and 250 or char_length(coalesce(v_notes,''))>500
 then raise exception '463 invalid independent recheck';end if;
 select lower(role) into v_role from public.profiles where id=v_actor and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level not in ('approve','manage') then raise exception '463 independent reviewer Jobs approval denied';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,463));
 select * into v_assignment from public.ywi_recheck_assignments_463
 where id=p_assignment_id and company_id=p_company_id and reviewer_user_id=v_actor and owner_user_id<>v_actor;
 if not found or v_assignment.created_at>statement_timestamp() then raise exception '463 assigned independent reviewer required';end if;
 perform public.ywi_463_assert_source(p_company_id,v_assignment.evidence_outcome_id);
 if (select count(*) from public.ywi_recheck_outcomes_463 where company_id=p_company_id)>=200 then raise exception '463 recheck journal capacity HOLD';end if;
 insert into public.ywi_recheck_outcomes_463(company_id,operation_id,assignment_id,reviewer_user_id,disposition,source_reference,notes)
 values(p_company_id,p_operation_id,p_assignment_id,v_actor,p_disposition,v_ref,v_notes)
 on conflict(company_id,operation_id) do nothing returning id into v_id;
 if v_id is null then
  select * into v_old from public.ywi_recheck_outcomes_463 where company_id=p_company_id and operation_id=p_operation_id;
  if not found or v_old.assignment_id is distinct from p_assignment_id or v_old.reviewer_user_id is distinct from v_actor
   or v_old.disposition is distinct from p_disposition or v_old.source_reference is distinct from v_ref or v_old.notes is distinct from v_notes
  then raise exception '463 recheck replay differs';end if;v_id:=v_old.id;
 end if;
 return jsonb_build_object('id',v_id,'company_id',p_company_id,'recorded',true,
  'field_accepted',false,'service_authorized',false,'independent_reapproval',false,'release_green',false,'outbound_actions',false);
end $$;
revoke all on function public.ywi_rpc_recheck_inbox_463() from public,anon,authenticated;
revoke all on function public.ywi_rpc_recheck_workspace_463(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_assign_recheck_463(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_record_recheck_463(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.ywi_rpc_recheck_inbox_463() to authenticated;
grant execute on function public.ywi_rpc_recheck_workspace_463(uuid) to authenticated;
grant execute on function public.ywi_rpc_assign_recheck_463(uuid,uuid,uuid,uuid,text,text) to authenticated;
grant execute on function public.ywi_rpc_record_recheck_463(uuid,uuid,uuid,text,text,text) to authenticated;
comment on table public.ywi_recheck_outcomes_463 is 'Independent reviewer documentary source-link outcome only; never operational acceptance or Safety certification.';
commit;
