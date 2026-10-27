-- YW 464: owner-only documentary follow-up for genuine 463 discrepancies.
-- An alternative reviewer is only a proposal; this does not assign a reviewer or approve field evidence.
begin;
create table if not exists public.ywi_recheck_discrepancy_reviews_464 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 operation_id uuid not null,
 recheck_outcome_id uuid not null unique references public.ywi_recheck_outcomes_463(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 decision text not null check(decision in ('request_clarification','retain_hold','propose_reassignment')),
 proposed_reviewer_user_id uuid references auth.users(id) on delete restrict,
 source_reference text not null check(char_length(btrim(source_reference)) between 4 and 250),
 notes text check(notes is null or char_length(notes)<=500),
 created_at timestamptz not null default now(),
 unique(company_id,operation_id),
 check((decision='propose_reassignment')=(proposed_reviewer_user_id is not null)),
 check(proposed_reviewer_user_id is null or proposed_reviewer_user_id<>owner_user_id)
);
create index if not exists ywi_464_owner_review_index on public.ywi_recheck_discrepancy_reviews_464(company_id,created_at desc);
alter table public.ywi_recheck_discrepancy_reviews_464 enable row level security;
revoke all on public.ywi_recheck_discrepancy_reviews_464 from public,anon,authenticated;

create or replace function public.ywi_rpc_discrepancy_workspace_464(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_role text;v_level text;v_services jsonb;v_cases jsonb;v_reviews jsonb;
 v_case_count integer;v_review_count integer;v_row record;
begin
 perform public.ywi_422_assert_owner(p_company_id);
 select lower(role) into v_role from public.profiles where id=v_actor and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level not in ('view','edit','approve','manage') then raise exception '464 owner Jobs access denied';end if;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.module_key),'[]'::jsonb) into v_services from
  (select company_id,module_key,enabled from public.ywi_company_service_modules where company_id=p_company_id order by module_key) s;
 select count(*) into v_case_count from public.ywi_recheck_outcomes_463 r
  join public.ywi_recheck_assignments_463 a on a.id=r.assignment_id and a.company_id=r.company_id
  where r.company_id=p_company_id and r.disposition in ('evidence_incomplete','further_review_required');
 select count(*) into v_review_count from public.ywi_recheck_discrepancy_reviews_464 where company_id=p_company_id;
 if v_case_count>60 or v_review_count>60 then raise exception '464 source or review sample capped: HOLD';end if;
 for v_row in select a.evidence_outcome_id from public.ywi_recheck_outcomes_463 r
  join public.ywi_recheck_assignments_463 a on a.id=r.assignment_id and a.company_id=r.company_id
  where r.company_id=p_company_id and r.disposition in ('evidence_incomplete','further_review_required')
 loop perform public.ywi_463_assert_source(p_company_id,v_row.evidence_outcome_id);end loop;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.outcome_id desc),'[]'::jsonb) into v_cases from (
  select r.id outcome_id,r.company_id,r.disposition,r.source_reference,r.created_at,
   a.id assignment_id,a.evidence_outcome_id,a.owner_user_id,a.reviewer_user_id old_reviewer_id,a.created_at assignment_at,
   x.reassessor_user_id,c.reviewer_user_id comparing_reviewer_id,rev.service_module_key,rev.target_table,rev.target_id,
   sm.enabled service_enabled
  from public.ywi_recheck_outcomes_463 r
  join public.ywi_recheck_assignments_463 a on a.id=r.assignment_id and a.company_id=r.company_id
  join public.ywi_evidence_outcomes_462 o on o.id=a.evidence_outcome_id and o.company_id=r.company_id
  join public.ywi_reassessment_evidence_requests_461 rq on rq.id=o.request_id and rq.company_id=r.company_id
  join public.ywi_retest_reassessments_460 x on x.id=rq.reassessment_id and x.company_id=r.company_id
  join public.ywi_retest_triages_460 t on t.id=x.triage_id and t.company_id=r.company_id
  join public.ywi_retest_comparisons_459 c on c.id=t.comparison_id and c.company_id=r.company_id
  join public.ywi_retest_assignments_459 a459 on a459.id=c.assignment_id and a459.company_id=r.company_id
  join public.ywi_owner_independent_followups_458 f on f.id=a459.owner_followup_id and f.company_id=r.company_id
  join public.ywi_first_service_decisions_457 d on d.id=f.independent_decision_id and d.company_id=r.company_id
  join public.ywi_first_service_handoffs_457 h on h.id=d.handoff_id and h.company_id=r.company_id
  join public.ywi_first_service_reviews_456 rev on rev.id=h.owner_review_id and rev.company_id=r.company_id
  join public.ywi_company_service_modules sm on sm.company_id=r.company_id and sm.module_key=rev.service_module_key
  where r.company_id=p_company_id and r.disposition in ('evidence_incomplete','further_review_required')
  order by r.created_at desc,r.id desc limit 60) q;
 if pg_catalog.jsonb_array_length(v_cases)<>v_case_count then raise exception '464 incomplete source chain: HOLD';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]'::jsonb) into v_reviews from (
  select id,company_id,recheck_outcome_id,owner_user_id,decision,proposed_reviewer_user_id,source_reference,created_at
  from public.ywi_recheck_discrepancy_reviews_464 where company_id=p_company_id
  order by created_at desc,id desc limit 60) q;
 return jsonb_build_object('company_id',p_company_id,'viewer_id',v_actor,'captured_at',statement_timestamp(),
  'is_owner',true,'services',v_services,'cases',v_cases,'case_total',v_case_count,'case_sample_capped',false,
  'reviews',v_reviews,'review_total',v_review_count,'review_sample_capped',false,
  'field_accepted',false,'service_authorized',false,'independent_reapproval',false,
  'reassignment_executed',false,'release_green',false,'outbound_actions',false,'mutation_authorized',false,'synthetic',false);
end $$;

create or replace function public.ywi_rpc_review_discrepancy_464(
 p_company_id uuid,p_operation_id uuid,p_recheck_outcome_id uuid,p_decision text,
 p_proposed_reviewer_user_id uuid,p_source_reference text,p_notes text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_owner uuid:=auth.uid();v_role text;v_level text;v_other_role text;v_other_level text;
 v_case record;v_old record;v_id uuid;v_ref text:=btrim(coalesce(p_source_reference,''));v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 perform public.ywi_422_assert_owner(p_company_id);
 if p_operation_id is null or p_recheck_outcome_id is null or p_decision not in ('request_clarification','retain_hold','propose_reassignment')
  or (p_decision='propose_reassignment') is distinct from (p_proposed_reviewer_user_id is not null)
  or char_length(v_ref) not between 4 and 250 or char_length(coalesce(v_notes,''))>500
 then raise exception '464 invalid discrepancy review: HOLD';end if;
 select lower(role) into v_role from public.profiles where id=v_owner and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions where profile_id=v_owner and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level not in ('approve','manage') then raise exception '464 owner Jobs approval denied';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,464));
 select r.id,r.disposition,r.created_at outcome_at,r.reviewer_user_id outcome_reviewer,
  a.reviewer_user_id old_reviewer_id,a.owner_user_id,a.created_at assignment_at,a.evidence_outcome_id,
  x.reassessor_user_id,c.reviewer_user_id comparing_reviewer_id
 into v_case from public.ywi_recheck_outcomes_463 r
 join public.ywi_recheck_assignments_463 a on a.id=r.assignment_id and a.company_id=r.company_id
 join public.ywi_evidence_outcomes_462 o on o.id=a.evidence_outcome_id and o.company_id=r.company_id
 join public.ywi_reassessment_evidence_requests_461 rq on rq.id=o.request_id and rq.company_id=r.company_id
 join public.ywi_retest_reassessments_460 x on x.id=rq.reassessment_id and x.company_id=r.company_id
 join public.ywi_retest_triages_460 t on t.id=x.triage_id and t.company_id=r.company_id
 join public.ywi_retest_comparisons_459 c on c.id=t.comparison_id and c.company_id=r.company_id
 where r.id=p_recheck_outcome_id and r.company_id=p_company_id and r.disposition in ('evidence_incomplete','further_review_required');
 if not found or v_case.owner_user_id<>v_owner or v_case.outcome_reviewer<>v_case.old_reviewer_id
  or v_case.outcome_at<v_case.assignment_at then raise exception '464 verified independent discrepancy required: HOLD';end if;
 perform public.ywi_463_assert_source(p_company_id,v_case.evidence_outcome_id);
 if p_decision='propose_reassignment' then
  if p_proposed_reviewer_user_id in (v_owner,v_case.old_reviewer_id,v_case.reassessor_user_id,v_case.comparing_reviewer_id)
  then raise exception '464 separate alternative reviewer required: HOLD';end if;
  select lower(role) into v_other_role from public.profiles where id=p_proposed_reviewer_user_id and is_active is true;
  select coalesce((select access_level from public.app_profile_module_permissions where profile_id=p_proposed_reviewer_user_id and module_key='jobs'),
   (select access_level from public.app_role_module_permissions where role=v_other_role and module_key='jobs')) into v_other_level;
  if v_other_role is null or v_other_level not in ('approve','manage') then raise exception '464 alternative reviewer Jobs approval denied';end if;
 end if;
 select * into v_old from public.ywi_recheck_discrepancy_reviews_464 where company_id=p_company_id
  and (operation_id=p_operation_id or recheck_outcome_id=p_recheck_outcome_id) for update;
 if found then
  if v_old.operation_id is distinct from p_operation_id or v_old.recheck_outcome_id is distinct from p_recheck_outcome_id
   or v_old.owner_user_id is distinct from v_owner or v_old.decision is distinct from p_decision
   or v_old.proposed_reviewer_user_id is distinct from p_proposed_reviewer_user_id
   or v_old.source_reference is distinct from v_ref or v_old.notes is distinct from v_notes
  then raise exception '464 review already recorded or replay differs: HOLD';end if;v_id:=v_old.id;
 else
  if (select count(*) from public.ywi_recheck_discrepancy_reviews_464 where company_id=p_company_id)>=200
  then raise exception '464 review journal capacity: HOLD';end if;
  insert into public.ywi_recheck_discrepancy_reviews_464(company_id,operation_id,recheck_outcome_id,owner_user_id,
   decision,proposed_reviewer_user_id,source_reference,notes)
  values(p_company_id,p_operation_id,p_recheck_outcome_id,v_owner,p_decision,p_proposed_reviewer_user_id,v_ref,v_notes)
  returning id into v_id;
 end if;
 return jsonb_build_object('id',v_id,'company_id',p_company_id,'recorded',true,
  'field_accepted',false,'service_authorized',false,'independent_reapproval',false,
  'reassignment_executed',false,'release_green',false,'outbound_actions',false);
end $$;
revoke all on function public.ywi_rpc_discrepancy_workspace_464(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_review_discrepancy_464(uuid,uuid,uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ywi_rpc_discrepancy_workspace_464(uuid) to authenticated;
grant execute on function public.ywi_rpc_review_discrepancy_464(uuid,uuid,uuid,text,uuid,text,text) to authenticated;
comment on table public.ywi_recheck_discrepancy_reviews_464 is 'Owner-only discrepancy journal: alternative reviewer is a proposal, never assignment or approval.';
commit;
