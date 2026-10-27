-- YW 465: verify a 464 owner proposal and present it to a distinct human reviewer.
-- Acknowledgement is not an evidence recheck, field authorization, invitation or dispatch.
begin;
create table if not exists public.ywi_reassignment_handoffs_465 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 operation_id uuid not null,
 proposal_id uuid not null unique references public.ywi_recheck_discrepancy_reviews_464(id) on delete restrict,
 owner_user_id uuid not null references auth.users(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 source_reference text not null check(char_length(btrim(source_reference)) between 4 and 250),
 notes text check(notes is null or char_length(notes)<=500),
 created_at timestamptz not null default now(),
 unique(company_id,operation_id),check(owner_user_id<>reviewer_user_id)
);
create index if not exists ywi_465_reviewer_inbox on public.ywi_reassignment_handoffs_465(reviewer_user_id,created_at desc);
alter table public.ywi_reassignment_handoffs_465 enable row level security;
revoke all on public.ywi_reassignment_handoffs_465 from public,anon,authenticated;

create table if not exists public.ywi_reassignment_receipts_465 (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.ywi_companies(id) on delete restrict,
 operation_id uuid not null,
 handoff_id uuid not null unique references public.ywi_reassignment_handoffs_465(id) on delete restrict,
 reviewer_user_id uuid not null references auth.users(id) on delete restrict,
 response text not null check(response in ('acknowledged_for_review','declined_handoff')),
 source_reference text not null check(char_length(btrim(source_reference)) between 4 and 250),
 notes text check(notes is null or char_length(notes)<=500),
 created_at timestamptz not null default now(),
 unique(company_id,operation_id)
);
alter table public.ywi_reassignment_receipts_465 enable row level security;
revoke all on public.ywi_reassignment_receipts_465 from public,anon,authenticated;

create or replace function public.ywi_465_assert_proposal(p_company_id uuid,p_proposal_id uuid)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare v record;v_role text;v_level text;
begin
 select p.id,p.owner_user_id,p.proposed_reviewer_user_id,p.decision,p.created_at proposed_at,
  r.disposition,r.created_at discrepancy_at,r.reviewer_user_id outcome_reviewer,
  a.reviewer_user_id old_reviewer_id,a.created_at assignment_at,a.evidence_outcome_id,
  x.reassessor_user_id,c.reviewer_user_id comparing_reviewer_id
 into v from public.ywi_recheck_discrepancy_reviews_464 p
 join public.ywi_recheck_outcomes_463 r on r.id=p.recheck_outcome_id and r.company_id=p.company_id
 join public.ywi_recheck_assignments_463 a on a.id=r.assignment_id and a.company_id=r.company_id
 join public.ywi_evidence_outcomes_462 o on o.id=a.evidence_outcome_id and o.company_id=p.company_id
 join public.ywi_reassessment_evidence_requests_461 rq on rq.id=o.request_id and rq.company_id=p.company_id
 join public.ywi_retest_reassessments_460 x on x.id=rq.reassessment_id and x.company_id=p.company_id
 join public.ywi_retest_triages_460 t on t.id=x.triage_id and t.company_id=p.company_id
 join public.ywi_retest_comparisons_459 c on c.id=t.comparison_id and c.company_id=p.company_id
 where p.id=p_proposal_id and p.company_id=p_company_id;
 if not found or v.decision<>'propose_reassignment' or v.proposed_reviewer_user_id is null
  or v.disposition not in ('evidence_incomplete','further_review_required')
  or v.outcome_reviewer<>v.old_reviewer_id or v.proposed_at<v.discrepancy_at or v.discrepancy_at<v.assignment_at
  or v.owner_user_id is distinct from (select owner_user_id from public.ywi_companies where id=p_company_id)
  or v.proposed_reviewer_user_id in (v.owner_user_id,v.old_reviewer_id,v.reassessor_user_id,v.comparing_reviewer_id)
 then raise exception '465 verified independent proposal chain required: HOLD';end if;
 perform public.ywi_463_assert_source(p_company_id,v.evidence_outcome_id);
 select lower(role) into v_role from public.profiles where id=v.proposed_reviewer_user_id and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions where profile_id=v.proposed_reviewer_user_id and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level not in ('approve','manage') then raise exception '465 proposed reviewer inactive or Jobs approval denied';end if;
 return v.proposed_reviewer_user_id;
end $$;
revoke all on function public.ywi_465_assert_proposal(uuid,uuid) from public,anon,authenticated;

create or replace function public.ywi_rpc_handoff_inbox_465()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_role text;v_level text;v_total integer;v_rows jsonb;
begin
 select lower(role) into v_role from public.profiles where id=v_actor and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level not in ('view','edit','approve','manage') then raise exception '465 active Jobs sign-in required';end if;
 select count(*) into v_total from public.ywi_companies c where c.owner_user_id=v_actor or exists(
  select 1 from public.ywi_reassignment_handoffs_465 h where h.company_id=c.id and h.reviewer_user_id=v_actor);
 select coalesce(jsonb_agg(to_jsonb(q) order by q.name,q.id),'[]'::jsonb) into v_rows from (
  select c.id,c.name,(c.owner_user_id=v_actor) is_owner,
   exists(select 1 from public.ywi_reassignment_handoffs_465 h where h.company_id=c.id and h.reviewer_user_id=v_actor) is_reviewer
  from public.ywi_companies c where c.owner_user_id=v_actor or exists(
   select 1 from public.ywi_reassignment_handoffs_465 h where h.company_id=c.id and h.reviewer_user_id=v_actor)
  order by c.name,c.id limit 60) q;
 return jsonb_build_object('viewer_id',v_actor,'captured_at',statement_timestamp(),'companies',v_rows,'total',v_total,
  'sample_capped',v_total>60,'field_accepted',false,'release_green',false,'outbound_actions',false);
end $$;

create or replace function public.ywi_rpc_handoff_workspace_465(p_company_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_role text;v_level text;v_owner boolean;v_reviewer boolean;
 v_services jsonb;v_cases jsonb;v_handoffs jsonb;v_receipts jsonb;v_total integer;v_ht integer;v_rt integer;v_row record;
begin
 select lower(role) into v_role from public.profiles where id=v_actor and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level not in ('view','edit','approve','manage') then raise exception '465 Jobs access required';end if;
 select exists(select 1 from public.ywi_companies where id=p_company_id and owner_user_id=v_actor) into v_owner;
 select exists(select 1 from public.ywi_reassignment_handoffs_465 where company_id=p_company_id and reviewer_user_id=v_actor) into v_reviewer;
 if not v_owner and not v_reviewer then raise exception '465 foreign company denied';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.module_key),'[]'::jsonb) into v_services from (
  select company_id,module_key,enabled from public.ywi_company_service_modules where company_id=p_company_id order by module_key) q;
 select count(*) into v_total from public.ywi_recheck_discrepancy_reviews_464 p
  left join public.ywi_reassignment_handoffs_465 h on h.proposal_id=p.id and h.company_id=p.company_id
  where p.company_id=p_company_id and p.decision='propose_reassignment' and (v_owner or h.reviewer_user_id=v_actor);
 select count(*) into v_ht from public.ywi_reassignment_handoffs_465 where company_id=p_company_id and (v_owner or reviewer_user_id=v_actor);
 select count(*) into v_rt from public.ywi_reassignment_receipts_465 r
  join public.ywi_reassignment_handoffs_465 h on h.id=r.handoff_id and h.company_id=r.company_id
  where r.company_id=p_company_id and (v_owner or h.reviewer_user_id=v_actor);
 if v_total>60 or v_ht>60 or v_rt>60 then raise exception '465 source or journal sample capped: HOLD';end if;
 for v_row in select p.id from public.ywi_recheck_discrepancy_reviews_464 p
  left join public.ywi_reassignment_handoffs_465 h on h.proposal_id=p.id and h.company_id=p.company_id
  where p.company_id=p_company_id and p.decision='propose_reassignment' and (v_owner or h.reviewer_user_id=v_actor)
 loop perform public.ywi_465_assert_proposal(p_company_id,v_row.id);end loop;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.proposed_at desc,q.proposal_id desc),'[]'::jsonb) into v_cases from (
  select p.id proposal_id,p.company_id,p.owner_user_id,p.proposed_reviewer_user_id,p.source_reference proposal_reference,p.created_at proposed_at,
   r.id outcome_id,r.disposition,r.created_at discrepancy_at,
   a.evidence_outcome_id,a.reviewer_user_id old_reviewer_id,x.reassessor_user_id,c.reviewer_user_id comparing_reviewer_id,
   rev.service_module_key,rev.target_table,rev.target_id,sm.enabled service_enabled
  from public.ywi_recheck_discrepancy_reviews_464 p
  join public.ywi_recheck_outcomes_463 r on r.id=p.recheck_outcome_id and r.company_id=p.company_id
  join public.ywi_recheck_assignments_463 a on a.id=r.assignment_id and a.company_id=p.company_id
  join public.ywi_evidence_outcomes_462 o on o.id=a.evidence_outcome_id and o.company_id=p.company_id
  join public.ywi_reassessment_evidence_requests_461 rq on rq.id=o.request_id and rq.company_id=p.company_id
  join public.ywi_retest_reassessments_460 x on x.id=rq.reassessment_id and x.company_id=p.company_id
  join public.ywi_retest_triages_460 t on t.id=x.triage_id and t.company_id=p.company_id
  join public.ywi_retest_comparisons_459 c on c.id=t.comparison_id and c.company_id=p.company_id
  join public.ywi_retest_assignments_459 a459 on a459.id=c.assignment_id and a459.company_id=p.company_id
  join public.ywi_owner_independent_followups_458 f on f.id=a459.owner_followup_id and f.company_id=p.company_id
  join public.ywi_first_service_decisions_457 d on d.id=f.independent_decision_id and d.company_id=p.company_id
  join public.ywi_first_service_handoffs_457 h457 on h457.id=d.handoff_id and h457.company_id=p.company_id
  join public.ywi_first_service_reviews_456 rev on rev.id=h457.owner_review_id and rev.company_id=p.company_id
  join public.ywi_company_service_modules sm on sm.company_id=p.company_id and sm.module_key=rev.service_module_key
  left join public.ywi_reassignment_handoffs_465 h on h.proposal_id=p.id and h.company_id=p.company_id
  where p.company_id=p_company_id and p.decision='propose_reassignment' and (v_owner or h.reviewer_user_id=v_actor)
  order by p.created_at desc,p.id desc limit 60) q;
 if pg_catalog.jsonb_array_length(v_cases)<>v_total then raise exception '465 incomplete source chain: HOLD';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]'::jsonb) into v_handoffs from (
  select id,company_id,proposal_id,owner_user_id,reviewer_user_id,source_reference,created_at
  from public.ywi_reassignment_handoffs_465 where company_id=p_company_id and (v_owner or reviewer_user_id=v_actor)
  order by created_at desc,id desc limit 60) q;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc),'[]'::jsonb) into v_receipts from (
  select r.id,r.company_id,r.handoff_id,r.reviewer_user_id,r.response,r.source_reference,r.created_at
  from public.ywi_reassignment_receipts_465 r join public.ywi_reassignment_handoffs_465 h on h.id=r.handoff_id and h.company_id=r.company_id
  where r.company_id=p_company_id and (v_owner or h.reviewer_user_id=v_actor)
  order by r.created_at desc,r.id desc limit 60) q;
 return jsonb_build_object('company_id',p_company_id,'viewer_id',v_actor,'captured_at',statement_timestamp(),
  'is_owner',v_owner,'is_reviewer',v_reviewer,'services',v_services,'cases',v_cases,'case_total',v_total,'case_sample_capped',false,
  'handoffs',v_handoffs,'handoff_total',v_ht,'handoff_sample_capped',false,
  'receipts',v_receipts,'receipt_total',v_rt,'receipt_sample_capped',false,
  'field_accepted',false,'service_authorized',false,'independent_reapproval',false,'reassignment_executed',false,
  'release_green',false,'outbound_actions',false,'mutation_authorized',false,'synthetic',false);
end $$;

create or replace function public.ywi_rpc_verify_handoff_465(
 p_company_id uuid,p_operation_id uuid,p_proposal_id uuid,p_source_reference text,p_notes text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_owner uuid:=auth.uid();v_role text;v_level text;v_reviewer uuid;v_old record;v_id uuid;
 v_ref text:=btrim(coalesce(p_source_reference,''));v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 perform public.ywi_422_assert_owner(p_company_id);
 if p_operation_id is null or p_proposal_id is null or char_length(v_ref) not between 4 and 250
  or char_length(coalesce(v_notes,''))>500 then raise exception '465 invalid handoff verification: HOLD';end if;
 select lower(role) into v_role from public.profiles where id=v_owner and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions where profile_id=v_owner and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level not in ('approve','manage') then raise exception '465 owner Jobs approval denied';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,465));
 v_reviewer:=public.ywi_465_assert_proposal(p_company_id,p_proposal_id);
 select * into v_old from public.ywi_reassignment_handoffs_465 where company_id=p_company_id
  and (operation_id=p_operation_id or proposal_id=p_proposal_id) for update;
 if found then
  if v_old.operation_id is distinct from p_operation_id or v_old.proposal_id is distinct from p_proposal_id
   or v_old.owner_user_id is distinct from v_owner or v_old.reviewer_user_id is distinct from v_reviewer
   or v_old.source_reference is distinct from v_ref or v_old.notes is distinct from v_notes
  then raise exception '465 handoff already recorded or replay differs: HOLD';end if;v_id:=v_old.id;
 else
  if (select count(*) from public.ywi_reassignment_handoffs_465 where company_id=p_company_id)>=200
  then raise exception '465 handoff journal capacity: HOLD';end if;
  insert into public.ywi_reassignment_handoffs_465(company_id,operation_id,proposal_id,owner_user_id,reviewer_user_id,source_reference,notes)
  values(p_company_id,p_operation_id,p_proposal_id,v_owner,v_reviewer,v_ref,v_notes) returning id into v_id;
 end if;
 return jsonb_build_object('id',v_id,'company_id',p_company_id,'recorded',true,'field_accepted',false,
  'service_authorized',false,'independent_reapproval',false,'reassignment_executed',false,'release_green',false,'outbound_actions',false);
end $$;

create or replace function public.ywi_rpc_ack_handoff_465(
 p_company_id uuid,p_operation_id uuid,p_handoff_id uuid,p_response text,p_source_reference text,p_notes text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_role text;v_level text;v_handoff record;v_old record;v_id uuid;
 v_ref text:=btrim(coalesce(p_source_reference,''));v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
begin
 if p_operation_id is null or p_handoff_id is null or p_response not in ('acknowledged_for_review','declined_handoff')
  or char_length(v_ref) not between 4 and 250 or char_length(coalesce(v_notes,''))>500
 then raise exception '465 invalid reviewer response: HOLD';end if;
 select lower(role) into v_role from public.profiles where id=v_actor and is_active is true;
 select coalesce((select access_level from public.app_profile_module_permissions where profile_id=v_actor and module_key='jobs'),
  (select access_level from public.app_role_module_permissions where role=v_role and module_key='jobs')) into v_level;
 if v_role is null or v_level not in ('approve','manage') then raise exception '465 independent reviewer Jobs approval denied';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text,465));
 select * into v_handoff from public.ywi_reassignment_handoffs_465
  where id=p_handoff_id and company_id=p_company_id and reviewer_user_id=v_actor and owner_user_id<>v_actor;
 if not found then raise exception '465 assigned separate reviewer required: HOLD';end if;
 if public.ywi_465_assert_proposal(p_company_id,v_handoff.proposal_id)<>v_actor then
  raise exception '465 proposed reviewer identity changed: HOLD';end if;
 if v_handoff.created_at>statement_timestamp() then raise exception '465 future handoff denied';end if;
 select * into v_old from public.ywi_reassignment_receipts_465 where company_id=p_company_id
  and (operation_id=p_operation_id or handoff_id=p_handoff_id) for update;
 if found then
  if v_old.operation_id is distinct from p_operation_id or v_old.handoff_id is distinct from p_handoff_id
   or v_old.reviewer_user_id is distinct from v_actor or v_old.response is distinct from p_response
   or v_old.source_reference is distinct from v_ref or v_old.notes is distinct from v_notes
  then raise exception '465 response already recorded or replay differs: HOLD';end if;v_id:=v_old.id;
 else
  if (select count(*) from public.ywi_reassignment_receipts_465 where company_id=p_company_id)>=200
  then raise exception '465 response journal capacity: HOLD';end if;
  insert into public.ywi_reassignment_receipts_465(company_id,operation_id,handoff_id,reviewer_user_id,response,source_reference,notes)
  values(p_company_id,p_operation_id,p_handoff_id,v_actor,p_response,v_ref,v_notes) returning id into v_id;
 end if;
 return jsonb_build_object('id',v_id,'company_id',p_company_id,'recorded',true,'field_accepted',false,
  'service_authorized',false,'independent_reapproval',false,'reassignment_executed',false,'release_green',false,'outbound_actions',false);
end $$;
revoke all on function public.ywi_rpc_handoff_inbox_465() from public,anon,authenticated;
revoke all on function public.ywi_rpc_handoff_workspace_465(uuid) from public,anon,authenticated;
revoke all on function public.ywi_rpc_verify_handoff_465(uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.ywi_rpc_ack_handoff_465(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.ywi_rpc_handoff_inbox_465() to authenticated;
grant execute on function public.ywi_rpc_handoff_workspace_465(uuid) to authenticated;
grant execute on function public.ywi_rpc_verify_handoff_465(uuid,uuid,uuid,text,text) to authenticated;
grant execute on function public.ywi_rpc_ack_handoff_465(uuid,uuid,uuid,text,text,text) to authenticated;
comment on table public.ywi_reassignment_receipts_465 is 'Separate human reviewer acknowledgement/decline only; never an independent evidence comparison or approval.';
commit;
